import { createHash, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const GateEventSchema = z.object({
  device_id: z.string().uuid(),
  event_id: z.string().trim().min(1).max(128),
  card_uid: z.string().trim().min(1).max(128).transform((value) => value.toUpperCase()),
  event_type: z.enum(['entry', 'exit']),
  occurred_at: z.string().datetime({ offset: true }),
});

const MAX_BODY_BYTES = 16 * 1024;
const MAX_EVENT_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

function sameEvent(
  existing: { card_id: string; event_type: string; occurred_at: string },
  expected: { cardId: string; eventType: string; occurredAt: string }
): boolean {
  return existing.card_id === expected.cardId
    && existing.event_type === expected.eventType
    && Date.parse(existing.occurred_at) === Date.parse(expected.occurredAt);
}

async function loadExistingEvent(
  admin: ReturnType<typeof createAdminClient>,
  deviceId: string,
  eventId: string
) {
  return admin
    .from('gate_events')
    .select('id, card_id, event_type, occurred_at, received_at')
    .eq('gate_device_id', deviceId)
    .eq('device_event_id', eventId)
    .maybeSingle();
}

/**
 * Trusted RFID reader ingestion endpoint.
 *
 * The caller authenticates as a provisioned gate device using a 256-bit
 * bearer token. The device sends a card UID, not a student ID. Student
 * identity is always resolved inside the device's school boundary.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body is too large.' }, { status: 413 });
  }

  const authorization = request.headers.get('authorization') || '';
  const match = /^Bearer ([a-f0-9]{64})$/i.exec(authorization);
  if (!match) {
    return NextResponse.json({ error: 'A valid gate-device credential is required.' }, { status: 401 });
  }

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return NextResponse.json({ error: 'Request body could not be read.' }, { status: 400 });
  }

  // Enforce the limit on actual bytes, not only the optional Content-Length header.
  if (Buffer.byteLength(bodyText, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body is too large.' }, { status: 413 });
  }

  let rawBody: unknown;
  try {
    rawBody = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const parsed = GateEventSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({
      error: 'Provide a device ID, unique event ID, card UID, entry/exit type and timestamp with timezone.',
    }, { status: 400 });
  }

  const occurredAtMs = Date.parse(parsed.data.occurred_at);
  const nowMs = Date.now();
  if (occurredAtMs < nowMs - MAX_EVENT_AGE_MS || occurredAtMs > nowMs + MAX_FUTURE_SKEW_MS) {
    return NextResponse.json({ error: 'The scan timestamp is outside the accepted device clock window.' }, { status: 422 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'Gate ingestion is not configured on this server.' }, { status: 503 });
  }

  const { data: device, error: deviceError } = await admin
    .from('gate_devices')
    .select('id, school_id, secret_hash, is_active')
    .eq('id', parsed.data.device_id)
    .maybeSingle();

  if (deviceError) {
    return NextResponse.json({ error: 'The gate device could not be verified.' }, { status: 503 });
  }
  if (!device || !device.is_active || typeof device.secret_hash !== 'string') {
    return NextResponse.json({ error: 'Gate device is not registered or has been revoked.' }, { status: 401 });
  }

  const suppliedHash = createHash('sha256').update(match[1].toLowerCase(), 'utf8').digest();
  const storedHash = Buffer.from(device.secret_hash, 'hex');
  if (storedHash.length !== suppliedHash.length || !timingSafeEqual(storedHash, suppliedHash)) {
    return NextResponse.json({ error: 'Gate device credential is invalid.' }, { status: 401 });
  }

  const { data: card, error: cardError } = await admin
    .from('student_gate_cards')
    .select('id, student_id')
    .eq('school_id', device.school_id)
    .eq('card_uid', parsed.data.card_uid)
    .eq('is_active', true)
    .maybeSingle();

  if (cardError) {
    return NextResponse.json({ error: 'The card registry could not be checked.' }, { status: 503 });
  }
  if (!card) {
    return NextResponse.json({ error: 'This card is not active in the device’s school.' }, { status: 404 });
  }

  const { data: student, error: studentError } = await admin
    .from('students')
    .select('id')
    .eq('id', card.student_id)
    .eq('school_id', device.school_id)
    .eq('is_active', true)
    .maybeSingle();

  if (studentError) {
    return NextResponse.json({ error: 'The student record could not be checked.' }, { status: 503 });
  }
  if (!student) {
    return NextResponse.json({ error: 'The card is linked to an inactive or unavailable student.' }, { status: 409 });
  }

  const expected = {
    cardId: card.id,
    eventType: parsed.data.event_type,
    occurredAt: new Date(occurredAtMs).toISOString(),
  };

  const existingResult = await loadExistingEvent(admin, device.id, parsed.data.event_id);
  if (existingResult.error) {
    return NextResponse.json({ error: 'The gate event could not be checked for duplicates.' }, { status: 503 });
  }
  if (existingResult.data) {
    if (!sameEvent(existingResult.data, expected)) {
      return NextResponse.json({ error: 'This device event ID was already used for a different scan.' }, { status: 409 });
    }

    await admin.from('gate_devices')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', device.id);
    return NextResponse.json({ accepted: true, duplicate: true, event_id: existingResult.data.id }, { status: 200 });
  }

  const { data: inserted, error: insertError } = await admin
    .from('gate_events')
    .insert({
      school_id: device.school_id,
      gate_device_id: device.id,
      card_id: card.id,
      student_id: student.id,
      device_event_id: parsed.data.event_id,
      event_type: parsed.data.event_type,
      occurred_at: expected.occurredAt,
    })
    .select('id, received_at')
    .single();

  if (insertError) {
    // A simultaneous retry may win the unique constraint after our first read.
    if (insertError.code === '23505') {
      const retryResult = await loadExistingEvent(admin, device.id, parsed.data.event_id);
      if (retryResult.data && sameEvent(retryResult.data, expected)) {
        await admin.from('gate_devices')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', device.id);
        return NextResponse.json({ accepted: true, duplicate: true, event_id: retryResult.data.id }, { status: 200 });
      }
      return NextResponse.json({ error: 'This device event ID conflicts with a different scan.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'The gate event could not be recorded.' }, { status: 503 });
  }

  await admin.from('gate_devices')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', device.id);

  return NextResponse.json({
    accepted: true,
    duplicate: false,
    event_id: inserted.id,
    received_at: inserted.received_at,
  }, { status: 201 });
}
