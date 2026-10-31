'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle, Copy, RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase/api';

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  registration_number: string;
};

type GateDevice = {
  id: string;
  device_code: string;
  name: string;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
};

type GateCard = {
  id: string;
  student_id: string;
  card_uid: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
};

type GateEvent = {
  id: string;
  student_id: string;
  gate_device_id: string;
  event_type: 'entry' | 'exit';
  occurred_at: string;
  received_at: string;
};

type OneTimeCredential = {
  device_code: string;
  device_name: string;
  device_token: string;
};

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2';

function startOfLocalDayIso(): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

export default function GateAttendancePage(): JSX.Element {
  const [students, setStudents] = useState<Student[]>([]);
  const [devices, setDevices] = useState<GateDevice[]>([]);
  const [cards, setCards] = useState<GateCard[]>([]);
  const [events, setEvents] = useState<GateEvent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [deviceName, setDeviceName] = useState('Main Entrance');
  const [cardUid, setCardUid] = useState('');
  const [cardLabel, setCardLabel] = useState('Student ID card');
  const [credential, setCredential] = useState<OneTimeCredential | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingDevice, setSavingDevice] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: authResult, error: authError } = await supabase.auth.getUser();
      if (authError || !authResult.user) throw new Error('Sign in with your school administrator account.');
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, school_id, role, is_active')
        .eq('user_id', authResult.user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile || !['admin', 'school_admin'].includes(profile.role)) {
        throw new Error('Only an active school administrator can manage gate attendance.');
      }

      const [studentsResult, devicesResult, cardsResult, eventsResult] = await Promise.all([
        supabase.from('students')
          .select('id, first_name, last_name, registration_number')
          .eq('school_id', profile.school_id)
          .eq('is_active', true)
          .order('first_name', { ascending: true }),
        supabase.from('gate_devices')
          .select('id, device_code, name, is_active, last_seen_at, created_at')
          .eq('school_id', profile.school_id)
          .order('created_at', { ascending: false }),
        supabase.from('student_gate_cards')
          .select('id, student_id, card_uid, label, is_active, created_at')
          .eq('school_id', profile.school_id)
          .order('created_at', { ascending: false }),
        supabase.from('gate_events')
          .select('id, student_id, gate_device_id, event_type, occurred_at, received_at')
          .eq('school_id', profile.school_id)
          .gte('occurred_at', startOfLocalDayIso())
          .order('occurred_at', { ascending: false })
          .limit(50),
      ]);

      if (studentsResult.error) throw studentsResult.error;
      if (devicesResult.error) throw devicesResult.error;
      if (cardsResult.error) throw cardsResult.error;
      if (eventsResult.error) throw eventsResult.error;

      const studentRows = (studentsResult.data ?? []) as Student[];
      setStudents(studentRows);
      setDevices((devicesResult.data ?? []) as GateDevice[]);
      setCards((cardsResult.data ?? []) as GateCard[]);
      setEvents((eventsResult.data ?? []) as GateEvent[]);
      setSelectedStudentId((current) => studentRows.some((student) => student.id === current)
        ? current
        : (studentRows[0]?.id ?? ''));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gate attendance could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const studentById = useMemo(
    () => new Map(students.map((student) => [student.id, student])),
    [students]
  );
  const deviceById = useMemo(
    () => new Map(devices.map((device) => [device.id, device])),
    [devices]
  );

  const createDevice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = deviceName.trim();
    if (!name) {
      setError('Enter a name for the gate reader.');
      return;
    }

    setSavingDevice(true);
    setError(null);
    setSuccess(null);
    setCredential(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('create_gate_device', { target_name: name });
      if (rpcError) throw rpcError;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.device_token || !row?.device_code) {
        throw new Error('The device was created but its one-time credential was not returned. Check the database function response.');
      }
      setCredential({
        device_code: row.device_code,
        device_name: row.device_name || name,
        device_token: row.device_token,
      });
      setSuccess('Gate reader created. Copy its token now; the application does not store or display it again.');
      await loadWorkspace();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'The gate reader could not be created.');
    } finally {
      setSavingDevice(false);
    }
  };

  const assignCard = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedStudentId || !cardUid.trim()) {
      setError('Select a student and enter the card UID read from the physical card.');
      return;
    }

    setSavingCard(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: rpcError } = await supabase.rpc('assign_student_gate_card', {
        target_student_id: selectedStudentId,
        target_card_uid: cardUid.trim().toUpperCase(),
        target_label: cardLabel.trim() || null,
      });
      if (rpcError) throw rpcError;
      setCardUid('');
      setSuccess('Student card assigned successfully.');
      await loadWorkspace();
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : 'The student card could not be assigned.');
    } finally {
      setSavingCard(false);
    }
  };

  const revokeDevice = async (device: GateDevice) => {
    if (!window.confirm(`Revoke reader ${device.name} (${device.device_code})? It will no longer be able to submit scans.`)) return;
    setError(null);
    setSuccess(null);
    const { error: rpcError } = await supabase.rpc('revoke_gate_device', { target_device_id: device.id });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setSuccess('Gate reader revoked. Its credential can no longer submit events.');
    await loadWorkspace();
  };

  const revokeCard = async (card: GateCard) => {
    if (!window.confirm(`Deactivate card ${card.card_uid}? Existing gate events will remain in the audit history.`)) return;
    setError(null);
    setSuccess(null);
    const { error: rpcError } = await supabase.rpc('revoke_student_gate_card', { target_card_id: card.id });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setSuccess('Student card deactivated. Existing event history has been retained.');
    await loadWorkspace();
  };

  const copyToken = async () => {
    if (!credential) return;
    try {
      await navigator.clipboard.writeText(credential.device_token);
      setSuccess('One-time device token copied to the clipboard.');
    } catch {
      setError('Clipboard access was blocked. Select and copy the token manually before leaving this page.');
    }
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><p role="status" className="text-slate-600">Loading gate attendance…</p></main>;
  }

  const activeDevices = devices.filter((device) => device.is_active).length;
  const activeCards = cards.filter((card) => card.is_active).length;
  const entries = events.filter((item) => item.event_type === 'entry').length;

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Smart School ERP</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Gate card attendance</h1>
            <p className="mt-1 text-sm text-slate-600">Manage school readers, student cards and entry/exit events.</p>
          </div>
          <div className="flex gap-2">
            <a href="/dashboards/school-admin" className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Back to dashboard</a>
            <button type="button" onClick={() => void loadWorkspace()} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><p>{error}</p></div>}
        {success && <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle className="mt-0.5 h-5 w-5 shrink-0" /><p>{success}</p></div>}

        <section className="grid gap-4 sm:grid-cols-3" aria-label="Gate attendance summary">
          <SummaryCard label="Active readers" value={activeDevices} />
          <SummaryCard label="Active student cards" value={activeCards} />
          <SummaryCard label="Today's entry scans" value={entries} />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-indigo-50 p-3 text-indigo-700"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></div>
              <div><h2 className="font-semibold text-slate-900">Register a gate reader</h2><p className="text-sm text-slate-500">Each physical device receives a separate school-bound credential.</p></div>
            </div>
            <form onSubmit={createDevice} className="space-y-3">
              <div><label htmlFor="gate-device-name" className="mb-1 block text-sm font-medium text-slate-700">Reader name</label><input id="gate-device-name" value={deviceName} onChange={(event) => setDeviceName(event.target.value)} maxLength={100} required className={inputClass} placeholder="Main Entrance" /></div>
              <button type="submit" disabled={savingDevice} className={buttonClass}>{savingDevice ? 'Creating reader…' : 'Create gate reader'}</button>
            </form>
            {credential && (
              <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">One-time credential — save it now</p>
                <p className="mt-2 text-xs text-amber-800">Reader code: <strong>{credential.device_code}</strong></p>
                <label htmlFor="gate-device-token" className="mt-3 block text-xs font-semibold text-amber-900">Device bearer token</label>
                <textarea id="gate-device-token" readOnly value={credential.device_token} rows={3} className="mt-1 w-full rounded-lg border border-amber-300 bg-white p-2 font-mono text-xs text-slate-800" />
                <button type="button" onClick={() => void copyToken()} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"><Copy className="h-4 w-4" aria-hidden="true" /> Copy token</button>
                <p className="mt-2 text-xs text-amber-800">The token is shown only in this response. Store it securely in the reader; never put it in source control or a public app bundle.</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4"><h2 className="font-semibold text-slate-900">Assign a student card</h2><p className="text-sm text-slate-500">Scan or type the RFID UID printed by your card-reader utility.</p></div>
            <form onSubmit={assignCard} className="space-y-3">
              <div><label htmlFor="gate-student" className="mb-1 block text-sm font-medium text-slate-700">Student</label><select id="gate-student" value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)} disabled={students.length === 0} required className={inputClass}><option value="">Select student…</option>{students.map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name} · {student.registration_number}</option>)}</select></div>
              <div><label htmlFor="gate-card-uid" className="mb-1 block text-sm font-medium text-slate-700">Card UID</label><input id="gate-card-uid" value={cardUid} onChange={(event) => setCardUid(event.target.value)} maxLength={128} required className={inputClass} placeholder="A1B2C3D4" /></div>
              <div><label htmlFor="gate-card-label" className="mb-1 block text-sm font-medium text-slate-700">Card label (optional)</label><input id="gate-card-label" value={cardLabel} onChange={(event) => setCardLabel(event.target.value)} maxLength={100} className={inputClass} /></div>
              <button type="submit" disabled={savingCard || students.length === 0} className={buttonClass}>{savingCard ? 'Assigning card…' : 'Assign student card'}</button>
              {students.length === 0 && <p className="text-sm text-slate-500">Add an active student record before assigning a card.</p>}
            </form>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4 sm:px-6"><h2 className="font-semibold text-slate-900">Gate readers</h2><p className="mt-1 text-sm text-slate-500">Only active readers with valid credentials can submit scans.</p></div>
          {devices.length === 0 ? <p className="px-5 py-8 text-sm text-slate-500">No gate readers have been registered yet.</p> : <div className="overflow-x-auto"><table className="min-w-full divide-y"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Reader</th><th className="px-5 py-3">Device code</th><th className="px-5 py-3">Last seen</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Action</th></tr></thead><tbody className="divide-y">{devices.map((device) => <tr key={device.id}><td className="px-5 py-3 text-sm font-medium text-slate-900">{device.name}</td><td className="px-5 py-3 font-mono text-xs text-slate-600">{device.device_code}</td><td className="px-5 py-3 text-sm text-slate-600">{device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : 'No scans received'}</td><td className="px-5 py-3"><StatusLabel active={device.is_active} /></td><td className="px-5 py-3">{device.is_active ? <button type="button" onClick={() => void revokeDevice(device)} className="text-sm font-semibold text-red-700 underline">Revoke reader</button> : <span className="text-sm text-slate-400">Revoked</span>}</td></tr>)}</tbody></table></div>}
        </section>

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4 sm:px-6"><h2 className="font-semibold text-slate-900">Student card registry</h2><p className="mt-1 text-sm text-slate-500">Revoked cards remain in the audit history but can no longer create new gate events.</p></div>
          {cards.length === 0 ? <p className="px-5 py-8 text-sm text-slate-500">No student cards have been assigned yet.</p> : <div className="overflow-x-auto"><table className="min-w-full divide-y"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Student</th><th className="px-5 py-3">Card UID</th><th className="px-5 py-3">Label</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Action</th></tr></thead><tbody className="divide-y">{cards.map((card) => { const student = studentById.get(card.student_id); return <tr key={card.id}><td className="px-5 py-3 text-sm font-medium text-slate-900">{student ? `${student.first_name} ${student.last_name} · ${student.registration_number}` : 'Student record unavailable'}</td><td className="px-5 py-3 font-mono text-xs text-slate-700">{card.card_uid}</td><td className="px-5 py-3 text-sm text-slate-600">{card.label || '—'}</td><td className="px-5 py-3"><StatusLabel active={card.is_active} /></td><td className="px-5 py-3">{card.is_active ? <button type="button" onClick={() => void revokeCard(card)} className="text-sm font-semibold text-red-700 underline">Deactivate card</button> : <span className="text-sm text-slate-400">Revoked</span>}</td></tr>; })}</tbody></table></div>}
        </section>

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4 sm:px-6"><h2 className="font-semibold text-slate-900">Today's gate events</h2><p className="mt-1 text-sm text-slate-500">Recent arrival and departure scans, newest first.</p></div>
          {events.length === 0 ? <p className="px-5 py-8 text-sm text-slate-500">No gate scans have been received today.</p> : <div className="overflow-x-auto"><table className="min-w-full divide-y"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Time</th><th className="px-5 py-3">Student</th><th className="px-5 py-3">Event</th><th className="px-5 py-3">Reader</th></tr></thead><tbody className="divide-y">{events.map((item) => { const student = studentById.get(item.student_id); const device = deviceById.get(item.gate_device_id); return <tr key={item.id}><td className="px-5 py-3 text-sm tabular-nums text-slate-600">{new Date(item.occurred_at).toLocaleTimeString()}</td><td className="px-5 py-3 text-sm font-medium text-slate-900">{student ? `${student.first_name} ${student.last_name} · ${student.registration_number}` : 'Student unavailable'}</td><td className="px-5 py-3"><span className={item.event_type === 'entry' ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700' : 'rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700'}>{item.event_type === 'entry' ? 'Arrival' : 'Departure'}</span></td><td className="px-5 py-3 text-sm text-slate-600">{device?.name ?? 'Reader unavailable'}</td></tr>; })}</tbody></table></div>}
        </section>

        <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 text-sm text-indigo-950">
          <h2 className="font-semibold">Reader integration endpoint</h2>
          <p className="mt-1">Send an HTTPS POST request to <code className="rounded bg-white px-1.5 py-0.5">/api/gate/events</code> with a bearer token and the device ID, event ID, card UID, event type and timestamp. The reader must never send a student ID. See <code>docs/GATE_ATTENDANCE.md</code> for the payload and retry rules.</p>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }): JSX.Element {
  return <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-600">{label}</p><p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{value}</p></div>;
}

function StatusLabel({ active }: { active: boolean }): JSX.Element {
  return <span className={active ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700' : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500'}>{active ? 'Active' : 'Revoked'}</span>;
}
