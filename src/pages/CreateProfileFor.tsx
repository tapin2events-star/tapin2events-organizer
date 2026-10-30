import { useState } from 'react';
import { useFeature } from '../lib/preview';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { RESOURCE_CATEGORIES } from '../lib/types';
import { sendEmailInvite } from '../components/invites/EmailInvites';
import BackButton from '../components/BackButton';

// Create an artist profile for someone else (a manager, parent, label, or an organizer booking a performer who isn't on
// TapIN): it's theirs once they claim it (an email invite); until then you manage it. Visible now or hidden until claimed.
export default function CreateProfileFor() {
  const navigate = useNavigate();
  const on = useFeature('profile_managers');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cat, setCat] = useState('Entertainment');
  const [bio, setBio] = useState('');
  const [visible, setVisible] = useState(true);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function create() {
    setBusy(true); setErr(null);
    const { data: id, error } = await supabase.rpc('create_profile_for', { p_name: name, p_email: email, p_category: cat, p_bio: bio, p_visible: visible });
    if (error || !id) { setBusy(false); return setErr(error?.message ?? 'Couldn\u2019t create the profile.'); }
    const inviteErr = await sendEmailInvite('claim', id as string, { email, name, role: 'member', note });
    setBusy(false);
    navigate(`/resources/dashboard?profile=${id}${inviteErr ? '&invite=failed' : ''}`);
  }
  const input = 'mt-1 block min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900';
  if (!on) return <div className="mx-auto max-w-lg py-10 text-center text-gray-600">This feature is coming soon.</div>;
  return (
    <div className="mx-auto max-w-lg">
      <BackButton fallback="/resources/dashboard" fallbackLabel="Dashboard" />
      <h1 className="mt-3 font-display text-3xl font-extrabold text-gray-900">Create a profile for someone</h1>
      <p className="mt-1 text-sm text-gray-600">For an artist you manage, book or represent. They get an email to claim it and make it theirs, and you keep managing it with them. Payouts always go to the artist.</p>
      <div className="mt-5 flex flex-col gap-4">
        <label className="text-sm text-gray-700">Artist name<input value={name} onChange={(e) => setName(e.target.value)} className={input} /></label>
        <label className="text-sm text-gray-700">Their email<input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" placeholder="We'll send them an invite to claim it" className={input} /></label>
        <label className="text-sm text-gray-700">What they do<select value={cat} onChange={(e) => setCat(e.target.value)} className={input}>{RESOURCE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
        <label className="text-sm text-gray-700">About them (optional)<textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={1000} className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900" /></label>
        <fieldset>
          <legend className="text-sm text-gray-700">Who can see it before they claim it?</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {([[true, 'Visible now'], [false, 'Hidden until claimed']] as const).map(([v, label]) => (
              <button key={label} type="button" aria-pressed={visible === v} onClick={() => setVisible(v)} className={`min-h-[48px] rounded-xl border text-sm font-semibold ${visible === v ? 'border-marigold bg-marigold text-white' : 'border-gray-300 bg-white text-gray-800'}`}>{label}</button>
            ))}
          </div>
        </fieldset>
        <label className="text-sm text-gray-700">A note for them (optional)<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="I set up your TapIN profile so we can get you booked!" className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900" /></label>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
        <button onClick={create} disabled={busy || !name.trim() || !email.trim()} className="min-h-[52px] rounded-full bg-[#0F1B3D] text-base font-bold text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create profile and send invite'}</button>
      </div>
    </div>
  );
}
