import { useEffect, useState } from 'react';
import PremiumBadge from '../business/PremiumBadge';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import Sheet from '../scouting/Sheet';
import { buildPitch, inviteLink, type InviteView } from '../../lib/partnerInvite';

interface Place { id: string; name: string; category: string; distance_m: number | null }

// Event > Promote > Local partners: pick a business, TapIN writes the ask; copy or share it with the business's own link.
export default function InvitePartnerSheet({ eventId, onClose, onCreated }: { eventId: string; onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [name, setName] = useState('');
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailState, setEmailState] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sender, setSender] = useState('');
  useEffect(() => {
    supabase.rpc('event_nearby', { p_event_id: eventId }).then(({ data }) => setPlaces((((data as { places?: Place[] } | null)?.places) ?? []).filter((p) => p.category !== 'parking')));
    if (user?.id) supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle().then(({ data }) => setSender(((data?.full_name as string | undefined) ?? '').trim().split(/\s+/)[0] || 'the organizer'));
  }, [eventId, user?.id]);

  async function write() {
    if (!name.trim()) return setErr('Choose or type a business.');
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc('create_partner_invite', { p_event_id: eventId, p_business_name: name.trim(), p_place_id: placeId });
    if (error || !data) { setBusy(false); return setErr(error?.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't create the invitation."); }
    const t = (data as { token: string; id: string }).token;
    setInviteId((data as { id: string }).id);
    const { data: v } = await supabase.rpc('partner_invite_view', { p_token: t });
    setBusy(false);
    setToken(t);
    setText(v ? buildPitch(v as InviteView, t, sender || 'the organizer') : `Hi ${name.trim()}! Would you like to partner with our event and offer our ticket holders a perk? It's free. Say yes here: ${inviteLink(t)}`);
    onCreated();
  }
  async function sendEmail() {
    if (!inviteId) return;
    setSending(true); setEmailState(null);
    const { data, error } = await supabase.functions.invoke('send-partner-invite', { body: { invite_id: inviteId, email: email.trim(), message: text } });
    let err: string | null = data?.error ?? null;
    if (!err && error) { try { err = (await (error as { context?: Response }).context?.json())?.error ?? 'Couldn\u2019t send the email.'; } catch { err = 'Couldn\u2019t send the email.'; } }
    setSending(false);
    setEmailState(err ? { ok: false, text: err } : { ok: true, text: `Sent to ${email.trim()}. Replies go to your email.` });
  }
  async function copy() { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* ignore */ } }
  async function share() { try { if (navigator.share) await navigator.share({ text }); else await copy(); } catch { /* cancelled */ } }

  return (
    <Sheet title="Invite a local business" onClose={onClose}>
      {!token ? (
        <>
          <p className="-mt-2 text-sm text-gray-600">Pick a nearby business (or type one). TapIN writes the message for you, with a link where they can say yes and choose their perk.</p>
          {places.length > 0 && (
            <div className="mt-3 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {places.slice(0, 30).map((p) => (
                <button key={p.id} type="button" onClick={() => { setName(p.name); setPlaceId(p.id); }} className={`rounded-full border px-3 py-1 text-xs ${placeId === p.id ? 'border-marigold bg-marigold/10 font-semibold text-marigold' : 'border-gray-300 text-gray-700'}`}>{p.name}</button>
              ))}
            </div>
          )}
          <label className="mt-3 block text-xs font-medium text-gray-500">Business name
            <input value={name} onChange={(e) => { setName(e.target.value); setPlaceId(null); }} maxLength={120} placeholder="Bella's Pizza" className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 sm:text-sm" />
          </label>
          {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
          <button onClick={write} disabled={busy || !name.trim()} className="mt-4 w-full rounded-xl bg-[#0F1B3D] py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Writing it…' : 'Write the message'}</button>
        </>
      ) : (
        <>
          <p className="-mt-2 text-sm text-gray-600">Here's your message to <strong>{name}</strong>. Edit anything you like, then send it however you usually reach them (text, Instagram, Facebook or email).</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} aria-label="Message" className="mt-3 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 sm:text-sm" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={copy} className="rounded-xl border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-800">{copied ? '✓ Copied' : 'Copy message'}</button>
            <button onClick={share} className="rounded-xl bg-[#0F1B3D] py-3 text-sm font-semibold text-white">Share…</button>
          </div>
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">Or email it from TapIN <PremiumBadge feature="partner_emails" /></p>
            <p className="text-xs text-gray-500">Sent from your name via TapIN, and replies come straight to you. Up to 10 a day per event.</p>
            {emailState?.ok ? (
              <p role="status" className="mt-2 text-sm text-green-800">✓ {emailState.text}</p>
            ) : (
              <div className="mt-2 flex gap-2">
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" placeholder="business@email.com" aria-label="Business email" className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 sm:text-sm" />
                <button onClick={sendEmail} disabled={sending || !/^\S+@\S+\.\S+$/.test(email.trim())} className="shrink-0 rounded-lg bg-[#0F1B3D] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{sending ? 'Sending…' : 'Send by email'}</button>
              </div>
            )}
            {emailState && !emailState.ok && <p role="alert" className="mt-1.5 text-xs text-red-600">{emailState.text}</p>}
          </div>
          <p className="mt-3 text-xs text-gray-500">When they say yes, you'll get a notification to approve their perk. Their counter card is made automatically, and after the event they get a short results summary.</p>
          <button onClick={onClose} className="mt-3 w-full text-sm font-medium text-gray-500">Done</button>
        </>
      )}
    </Sheet>
  );
}
