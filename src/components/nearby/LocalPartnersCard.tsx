import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Sheet from '../scouting/Sheet';
import PremiumBadge from '../business/PremiumBadge';
import InvitePartnerSheet from './InvitePartnerSheet';

// Event > Promote: local partners and ticket-holder perks (free for 2 per event; more with Performers & Promotion).
interface Partner { id: string; name: string; address: string | null; website: string | null; perk: string; perk_details: string | null; business_email: string | null; redeemed: number | null; distance_m: number | null }
interface Place { id: string; name: string; category: string; kind: string | null; distance_m: number | null; address: string | null; website: string | null }
const field = 'mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 sm:text-sm';

export default function LocalPartnersCard({ eventId }: { eventId: string }) {
  const [rows, setRows] = useState<Partner[] | null>(null);
  const [editing, setEditing] = useState<Partial<Partner> | null>(null);
  const [inviting, setInviting] = useState(false);
  const [invites, setInvites] = useState<{ id: string; business_name: string; status: string; perk: string | null; perk_details: string | null; contact_name: string | null; contact_email: string | null; partner_id: string | null }[]>([]);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const loadInvites = useCallback(() => { supabase.rpc('event_partner_invites', { p_event_id: eventId }).then(({ data }) => setInvites((data ?? []) as typeof invites)); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadInvites(); }, [loadInvites]);
  async function removeInvite(i: { id: string; business_name: string; status: string }) {
    if (i.status === 'sent' && !window.confirm(`Withdraw the invitation to ${i.business_name}? Their link will stop working.`)) return;
    setInviteMsg(null);
    const { error } = await supabase.rpc('remove_partner_invite', { p_invite_id: i.id });
    if (error) return setInviteMsg(error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't remove it.");
    loadInvites();
  }
  async function decide(id: string, approve: boolean) {
    setInviteMsg(null);
    const { error } = await supabase.rpc('decide_partner_invite', { p_invite_id: id, p_approve: approve });
    if (error) return setInviteMsg(error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't update it.");
    loadInvites(); load();
  }
  const load = useCallback(() => { supabase.rpc('event_partners_list', { p_event_id: eventId }).then(({ data }) => setRows((data ?? []) as Partner[])); }, [eventId]);
  useEffect(() => { load(); }, [load]);
  async function remove(p: Partner) {
    if (!window.confirm(`Remove ${p.name} and its perk from this event?`)) return;
    await supabase.rpc('delete_event_partner', { p_partner_id: p.id }); load();
  }
  return (
    <section className="mt-8 rounded-2xl border border-gray-200 bg-surface p-4">
      <p className="flex flex-wrap items-center gap-2 font-semibold text-bone">🤝 Local partners & perks</p>
      <p className="text-sm text-muted">Team up with nearby restaurants, bars and shops: they offer a perk to your ticket holders, and the perks help sell tickets. Perks show on your event page, on each ticket, and staff can mark them used.</p>
      <p className="mt-1 text-xs text-gray-500">Free for up to 2 partners per event. More partners: <PremiumBadge feature="local_partners" /></p>
      {rows && rows.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((p) => (
            <li key={p.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
              <p className="font-semibold text-gray-900">{p.name}</p>
              <p className="text-gray-700">🎁 {p.perk}</p>
              <p className="text-xs text-gray-500">Redeemed {p.redeemed ?? 0} time{p.redeemed === 1 ? '' : 's'}{p.business_email ? ` · Contact: ${p.business_email}` : ''}</p>
              <div className="mt-1.5 flex gap-4 text-xs"><button onClick={() => setEditing(p)} className="font-medium text-marigold">Edit</button><a href={`/partners/${p.id}/card`} target="_blank" rel="noopener" className="font-medium text-gray-700">Counter card</a><button onClick={() => remove(p)} className="text-gray-500 hover:text-red-600">Remove</button></div>
            </li>
          ))}
        </ul>
      )}
      {invites.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Invitations</p>
          {inviteMsg && <p role="alert" className="mt-1 text-sm text-red-600">{inviteMsg}</p>}
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {invites.map((i) => (
              <li key={i.id} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium text-gray-900">{i.business_name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${i.status === 'accepted' ? 'bg-amber-100 text-amber-800' : i.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {i.status === 'sent' ? 'Waiting for reply' : i.status === 'accepted' ? 'Said yes · approve?' : i.status === 'approved' ? 'Partner' : i.status === 'declined' ? 'Passed' : 'Not approved'}
                  </span>
                </div>
                {['sent', 'declined', 'not_approved'].includes(i.status) && (
                  <button onClick={() => removeInvite(i)} className="mt-1 text-xs font-medium text-gray-500 hover:text-red-600">{i.status === 'sent' ? 'Withdraw invitation' : 'Remove from list'}</button>
                )}
                {i.status === 'accepted' && (
                  <div className="mt-1.5">
                    <p className="text-gray-700">🎁 {i.perk}{i.perk_details ? <span className="text-gray-500"> · {i.perk_details}</span> : null}</p>
                    {(i.contact_name || i.contact_email) && <p className="text-xs text-gray-500">Contact: {[i.contact_name, i.contact_email].filter(Boolean).join(' · ')}</p>}
                    <div className="mt-1.5 flex gap-2">
                      <button onClick={() => decide(i.id, true)} className="rounded-lg bg-marigold px-3 py-1.5 text-xs font-semibold text-white">Approve perk</button>
                      <button onClick={() => decide(i.id, false)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700">Not this time</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => setInviting(true)} className="rounded-xl bg-[#0F1B3D] px-4 py-2.5 text-sm font-semibold text-white">✉️ Invite a business</button>
        <button onClick={() => setEditing({})} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800">+ Add one yourself</button>
      </div>
      {inviting && <InvitePartnerSheet eventId={eventId} onClose={() => setInviting(false)} onCreated={loadInvites} />}
      {editing && <PartnerSheet eventId={eventId} initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </section>
  );
}

function PartnerSheet({ eventId, initial, onClose, onSaved }: { eventId: string; initial: Partial<Partner>; onClose: () => void; onSaved: () => void }) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [name, setName] = useState(initial.name ?? '');
  const [address, setAddress] = useState(initial.address ?? '');
  const [website, setWebsite] = useState(initial.website ?? '');
  const [perk, setPerk] = useState(initial.perk ?? '');
  const [details, setDetails] = useState(initial.perk_details ?? '');
  const [email, setEmail] = useState(initial.business_email ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (initial.id) return;
    supabase.rpc('event_nearby', { p_event_id: eventId }).then(({ data }) => setPlaces((((data as { places?: Place[] } | null)?.places) ?? []).filter((p) => p.category !== 'parking')));
  }, [eventId, initial.id]);
  function pick(p: Place) { setPlaceId(p.id); setName(p.name); setAddress(p.address ?? ''); setWebsite(p.website ?? ''); }
  async function save() {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc('save_event_partner', { p_event_id: eventId, p: { id: initial.id ?? null, place_id: placeId, name, address, website, perk, perk_details: details, business_email: email } });
    setBusy(false);
    if (error) return setErr(error.message && !/function|permission/i.test(error.message) ? error.message : "Couldn't save the partner.");
    onSaved();
  }
  return (
    <Sheet title={initial.id ? 'Edit local partner' : 'Add a local partner'} onClose={onClose}>
      {!initial.id && places.length > 0 && (
        <>
          <p className="-mt-2 text-xs font-medium text-gray-500">Nearby places (tap to fill in)</p>
          <div className="mt-1.5 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {places.slice(0, 24).map((p) => (
              <button key={p.id} onClick={() => pick(p)} className={`rounded-full border px-3 py-1 text-xs ${placeId === p.id ? 'border-marigold bg-marigold/10 font-semibold text-marigold' : 'border-gray-300 text-gray-700'}`}>{p.name}</button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">Or type any business below.</p>
        </>
      )}
      <label className="mt-3 block text-xs font-medium text-gray-500">Business name<input value={name} onChange={(e) => { setName(e.target.value); setPlaceId(null); }} maxLength={120} placeholder="Bella's Pizza" className={field} /></label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Perk for ticket holders<input value={perk} onChange={(e) => setPerk(e.target.value)} maxLength={200} placeholder="10% off food with your ticket" className={field} /></label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Details (optional)<input value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} placeholder="Day of the event, before 8 PM. Dine-in only." className={field} /></label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Address (optional)<input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} className={field} /></label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Website (optional)<input value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={300} inputMode="url" className={field} /></label>
      <label className="mt-3 block text-xs font-medium text-gray-500">Business contact email (optional, for your records)<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={field} /></label>
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <button onClick={save} disabled={busy || !name.trim() || perk.trim().length < 3} className="mt-4 w-full rounded-xl bg-[#0F1B3D] py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : initial.id ? 'Save changes' : 'Add partner'}</button>
    </Sheet>
  );
}
