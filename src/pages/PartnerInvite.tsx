import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { eventDay, type InviteView } from '../lib/partnerInvite';

// A local business's invitation page: see the event, choose a perk for ticket holders, and say yes (no account needed).
export default function PartnerInvite() {
  const { token } = useParams<{ token: string }>();
  const [v, setV] = useState<InviteView | null | undefined>(undefined);
  const [perk, setPerk] = useState('');
  const [details, setDetails] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null);
  useEffect(() => { supabase.rpc('partner_invite_view', { p_token: token }).then(({ data }) => setV((data ?? null) as InviteView | null)); }, [token]);

  async function respond(accept: boolean) {
    if (accept && perk.trim().length < 3) return setErr('Add the perk you\u2019d like to offer.');
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc('respond_partner_invite', { p_token: token, p_accept: accept, p_perk: perk, p_details: details, p_contact_name: contactName, p_contact_email: contactEmail });
    setBusy(false);
    if (error) return setErr(error.message && !/function|permission/i.test(error.message) ? error.message : 'Something went wrong. Please try again.');
    setDone(data === 'accepted' ? 'accepted' : 'declined');
  }

  const field = 'mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';
  if (v === undefined) return <div className="min-h-screen bg-[#F4F4F7] p-8 text-center text-sm text-gray-500">Loading your invitation…</div>;
  if (v === null) return <div className="min-h-screen bg-[#F4F4F7] p-8 text-center text-gray-600">This invitation link isn't valid anymore.</div>;
  const status = done ?? v.status;
  const walk = v.distance_m == null ? null : v.distance_m < 120 ? 'Right next door' : `${Math.max(1, Math.round(v.distance_m / 80))}-minute walk from you`;
  return (
    <div className="min-h-screen bg-[#F4F4F7] px-4 py-8" style={{ paddingTop: 'calc(2rem + env(safe-area-inset-top, 0px))' }}>
      <div className="mx-auto max-w-lg overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="bg-[#0F1B3D] px-6 py-5 text-white">
          <p className="text-xl font-extrabold">TapIN</p>
          <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#C9A227]">Local partner invitation</p>
        </div>
        {v.event.poster && <img src={v.event.poster} alt="" className="aspect-[2/1] w-full object-cover" />}
        <div className="p-6">
          <p className="text-sm text-gray-600">Hi {v.business_name}! {v.host ? <><strong>{v.host}</strong> would</> : 'We\u2019d'} love to partner with you for:</p>
          <h1 className="mt-1 text-2xl font-extrabold text-gray-900 [overflow-wrap:anywhere]">{v.event.title}</h1>
          <p className="mt-1 text-sm text-gray-600">{eventDay(v.event.start_date)}{v.event.location ? ` · ${v.event.location}` : ''}</p>
          {walk && <p className="text-sm text-gray-600">📍 {walk}</p>}
          {v.event.guests >= 20 && <p className="text-sm text-gray-600">🎟️ {v.event.guests} guests already coming</p>}

          {status === 'approved' || status === 'accepted' ? (
            <div className="mt-5 rounded-2xl bg-green-50 p-4 text-sm text-green-900">
              <p className="font-semibold">{status === 'approved' ? '🎉 You\u2019re a local partner!' : 'Thank you! You\u2019re all set.'}</p>
              <p className="mt-1">{status === 'approved' ? 'Your perk is on the event page and on every guest\u2019s ticket.' : 'The organizer will confirm your perk shortly. Guests will see it on the event page and their tickets.'}</p>
              {v.perk && <p className="mt-2"><strong>Your perk:</strong> {v.perk}{v.perk_details ? ` (${v.perk_details})` : ''}</p>}
              {status === 'approved' && v.partner_id && <a href={`/partners/${v.partner_id}/card`} target="_blank" rel="noopener" className="mt-3 inline-block rounded-xl bg-[#0F1B3D] px-4 py-2.5 font-semibold text-white">Print your counter card</a>}
            </div>
          ) : status === 'declined' || status === 'not_approved' ? (
            <p className="mt-5 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">{status === 'declined' ? 'No problem, thanks for letting us know! Maybe next time.' : 'Thanks for your interest! The organizer isn\u2019t adding partners for this event right now.'}</p>
          ) : (
            <>
              <div className="mt-5 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                <p className="font-semibold text-gray-900">How it works (free for you)</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5">
                  <li>You offer ticket holders a small perk of your choice</li>
                  <li>Your business and perk are featured on the event page, in guests' confirmation emails and on their tickets</li>
                  <li>Guests show their ticket at your counter, and staff can tap "Redeem" so each perk is used once</li>
                </ul>
              </div>
              <label className="mt-5 block text-sm font-medium text-gray-700">Your perk for ticket holders
                <input value={perk} onChange={(e) => setPerk(e.target.value)} maxLength={200} placeholder="10% off food" className={field} />
              </label>
              <label className="mt-3 block text-sm font-medium text-gray-700">Details <span className="font-normal text-gray-400">(optional)</span>
                <input value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} placeholder="Day of the event, before 8 PM, dine-in only" className={field} />
              </label>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="block text-sm font-medium text-gray-700">Your name <span className="font-normal text-gray-400">(optional)</span><input value={contactName} onChange={(e) => setContactName(e.target.value)} maxLength={100} autoComplete="name" className={field} /></label>
                <label className="block text-sm font-medium text-gray-700">Email <span className="font-normal text-gray-400">(optional)</span><input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} type="email" autoComplete="email" maxLength={200} className={field} /></label>
              </div>
              {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
              <button onClick={() => respond(true)} disabled={busy} className="mt-5 w-full rounded-xl bg-[#0F1B3D] py-3.5 text-base font-bold text-white disabled:opacity-50">{busy ? 'Sending…' : 'Yes, count us in'}</button>
              <button onClick={() => respond(false)} disabled={busy} className="mt-2 w-full py-2 text-sm font-medium text-gray-500">No thanks, not this time</button>
            </>
          )}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-gray-500">TapIN connects local events, artists and businesses in Raleigh.</p>
    </div>
  );
}
