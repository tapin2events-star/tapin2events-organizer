import { useEffect, useRef, useState } from 'react';
import { resolveProfileId } from '../../lib/profileLinks';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../../lib/supabaseClient';
import Sheet from '../scouting/Sheet';

interface Shared { event_id: string; title: string; start_date: string | null; i_joined: boolean; connected: boolean }
const SCANNER_ID = 'tapin-network-scanner';

// Scan someone's TapIN QR inside the app (always signed in). A personal profile code offers Connect for
// any networking event you're both going to; otherwise it opens their profile. Event codes open that card.
export default function ScanSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [person, setPerson] = useState<{ email: string; name: string | null; photo: string | null; shared: Shared[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    const scanner = new Html5Qrcode(SCANNER_ID);
    scannerRef.current = scanner;
    scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 230 }, (text) => { if (!stopped) { stopped = true; handle(text); } }, () => {})
      .catch(() => setErr("Couldn't open the camera. Allow camera access for TapIN in your settings, or scan with your phone's camera app."));
    return () => { stopped = true; scanner.stop().catch(() => {}); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handle(text: string) {
    await scannerRef.current?.stop().catch(() => {});
    let path = '';
    try { const u = new URL(text); path = u.pathname.replace(import.meta.env.BASE_URL.replace(/\/$/, ''), ''); } catch { setErr("That isn't a TapIN code."); return; }
    const ev = path.match(/^\/?events\/([0-9a-f-]{36})\/network\/qr\/([0-9a-f]+)/i);
    if (ev) { onClose(); navigate(`/events/${ev[1]}/network/qr/${ev[2]}`); return; }
    // Profile codes: new ones are /u/<account id>; older ones are /creator/<email>.
    const byId = path.match(/^\/?u\/([0-9a-f-]{36})/i);
    const cr = path.match(/^\/?creator\/([^/?#]+)/i);
    if (byId || cr) {
      let email = cr ? decodeURIComponent(cr[1]).toLowerCase() : '';
      if (byId) {
        const { data: em } = await supabase.rpc('profile_email_by_id', { p_id: byId[1] });
        if (typeof em !== 'string') { setErr("That profile isn't available."); return; }
        email = em;
      }
      const [{ data: shared }, { data: prof }] = await Promise.all([
        supabase.rpc('shared_networking_events', { p_email: email }),
        supabase.from('public_profiles').select('full_name, profile_photo').eq('email', email).maybeSingle(),
      ]);
      const list = (shared ?? []) as Shared[];
      if (list.length === 0) { onClose(); const pid = await resolveProfileId(email); if (pid) navigate(`/u/${pid}`); return; }
      const p = prof as { full_name: string | null; profile_photo: string | null } | null;
      setPerson({ email, name: p?.full_name ?? null, photo: p?.profile_photo ?? null, shared: list });
      return;
    }
    if (/^\/?(events|resources|o|business)\//.test(path)) { onClose(); navigate(path.startsWith('/') ? path : `/${path}`); return; }
    setErr("That isn't a TapIN code.");
  }

  async function connect(s: Shared) {
    if (!person) return;
    if (!s.i_joined) { onClose(); navigate(`/events/${s.event_id}/network?connect=${encodeURIComponent(person.email)}`); return; }
    setBusy(s.event_id);
    const { error } = await supabase.rpc('connect_in_person', { p_event_id: s.event_id, p_email: person.email });
    setBusy(null);
    if (error) { setErr(error.message && !/function|permission denied/i.test(error.message) ? error.message : "Couldn't connect."); return; }
    setDone(`You're connected with ${person.name || 'them'}! Their contact info is in your connections.`);
    setPerson({ ...person, shared: person.shared.map((x) => (x.event_id === s.event_id ? { ...x, connected: true } : x)) });
  }

  return (
    <Sheet title="Scan a TapIN code" onClose={onClose}>
      {!person && !err && (
        <>
          <div id={SCANNER_ID} className="mx-auto w-full max-w-xs overflow-hidden rounded-2xl bg-black" style={{ minHeight: 240 }} />
          <p className="mt-3 text-center text-sm text-gray-600">Point at someone's TapIN QR code.</p>
        </>
      )}
      {err && (
        <div className="text-center">
          <p className="text-sm text-red-600">{err}</p>
          <button onClick={onClose} className="mt-4 rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-700">Close</button>
        </div>
      )}
      {person && (
        <div>
          <div className="flex items-center gap-3">
            {person.photo ? <img src={person.photo} alt="" className="h-14 w-14 rounded-full object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700">{(person.name || person.email).charAt(0).toUpperCase()}</span>}
            <div className="min-w-0">
              <p className="font-display text-lg font-bold text-gray-900">{person.name || 'TapIN member'}</p>
              <p className="text-sm text-gray-500">You're both going to {person.shared.length === 1 ? 'this event' : 'these events'}</p>
            </div>
          </div>
          {done && <p role="status" className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{done}</p>}
          <ul className="mt-3 flex flex-col gap-2">
            {person.shared.map((s) => (
              <li key={s.event_id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 p-3">
                <span className="min-w-0 truncate text-sm font-medium text-gray-900">{s.title}</span>
                {s.connected ? <span className="shrink-0 text-sm font-semibold text-green-700">✓ Connected</span> : (
                  <button onClick={() => connect(s)} disabled={busy === s.event_id} className="shrink-0 rounded-xl bg-marigold px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {busy === s.event_id ? 'Connecting…' : s.i_joined ? '🤝 Connect' : 'Join & connect'}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button onClick={async () => { onClose(); const pid = await resolveProfileId(person.email); if (pid) navigate(`/u/${pid}`); }} className="mt-3 w-full rounded-xl border border-gray-300 py-2.5 text-sm text-gray-700">View profile</button>
        </div>
      )}
    </Sheet>
  );
}
