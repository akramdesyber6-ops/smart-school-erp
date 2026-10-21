import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

const InvitePortalAccountSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  role: z.enum(['student', 'parent']),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).origin !== request.nextUrl.origin) {
        return NextResponse.json({ error: 'Cross-origin requests are not allowed.' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
    }
  }

  const supabase = createRouteHandlerClient({ cookies });
  const { data: authResult, error: authError } = await supabase.auth.getUser();
  if (authError || !authResult.user) {
    return NextResponse.json({ error: 'Sign in with a school administrator account to continue.' }, { status: 401 });
  }

  const { data: actorProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, school_id, role, is_active')
    .eq('user_id', authResult.user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: 'The administrator profile could not be verified.' }, { status: 500 });
  }
  if (!actorProfile || !['admin', 'school_admin'].includes(actorProfile.role)) {
    return NextResponse.json({ error: 'Only an active school administrator can invite portal users.' }, { status: 403 });
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const parsed = InvitePortalAccountSchema.safeParse(requestBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email, first name, last name, and portal role.' }, { status: 400 });
  }

  let adminClient: ReturnType<typeof createAdminClient>;
  try {
    adminClient = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'Portal invitations are not configured on the server. Contact the system administrator.' }, { status: 503 });
  }

  const appOrigin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  let redirectTo: string;
  try {
    const configuredUrl = new URL(appOrigin);
    if (configuredUrl.protocol !== 'https:' && configuredUrl.hostname !== 'localhost') {
      return NextResponse.json({ error: 'The configured application URL must use HTTPS.' }, { status: 503 });
    }
    redirectTo = new URL('/login', configuredUrl).toString();
  } catch {
    return NextResponse.json({ error: 'The configured application URL is invalid.' }, { status: 503 });
  }

  const { data: inviteResult, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      redirectTo,
      data: {
        first_name: parsed.data.first_name,
        last_name: parsed.data.last_name,
      },
    }
  );

  if (inviteError || !inviteResult.user) {
    return NextResponse.json(
      { error: 'The invite could not be sent. The email may already be registered, or the Auth email provider may need configuration.' },
      { status: 409 }
    );
  }

  const { error: createProfileError } = await adminClient
    .from('profiles')
    .insert({
      user_id: inviteResult.user.id,
      school_id: actorProfile.school_id,
      role: parsed.data.role,
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      email: parsed.data.email,
      is_active: true,
    });

  if (createProfileError) {
    // Avoid leaving an Auth account without its school-scoped authorization profile.
    await adminClient.auth.admin.deleteUser(inviteResult.user.id);
    return NextResponse.json(
      { error: 'The account invite could not be finalized. No portal profile was created; check for duplicate profiles and retry.' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { message: 'Invitation sent. The portal profile is ready to link to a student or parent record.', role: parsed.data.role },
    { status: 201 }
  );
}
