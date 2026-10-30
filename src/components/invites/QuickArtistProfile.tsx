import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { RESOURCE_CATEGORIES } from '../../lib/types';

// After joining a group by invite: create an artist profile in one short step (name, what you do, a line about you),
// or skip for now. It lets them be credited on the group's songs and add their own music.
export default function QuickArtistProfile({ defaultName, groupName, onDone }: { defaultName: string; groupName: string; onDone: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState(defaultName);
  const [cat, setCat] = useState('Entertainment');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function create() {
    if (!user?.email || !name.trim()) return setErr('Add your artist name.');
    setBusy(true); setErr(null);
    const { error } = await supabase.from('resources').insert({ display_name: name.trim().slice(0, 80), email: user.email.toLowerCase(), kind: 'individual', status: 'active', categories: [cat], bio: bio.trim().slice(0, 500) || `Member of ${groupName}` });
    setBusy(false);
    if (error) return setErr(/duplicate/i.test(error.message) ? 'You already have an artist profile.' : 'Couldn\u2019t create your profile. You can do it later from your dashboard.');
    onDone();
  }
  return (
    <div className="rounded-[28px] border border-gray-200 bg-white p-6">
      <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">🎉 You&apos;re in {groupName}!</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold text-gray-900">Create your artist profile</h1>
      <p className="mt-1 text-sm text-gray-600">So you can be credited on {groupName}&apos;s songs, share your own music, and get booked. You can add a photo and more anytime.</p>
      <div className="mt-4 flex flex-col gap-3">
        <label className="text-sm text-gray-700">Artist name<input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block min-h-[48px] w-full rounded-xl border border-gray-300 px-3 text-base text-gray-900" /></label>
        <label className="text-sm text-gray-700">What you do
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="mt-1 block min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900">{RESOURCE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </label>
        <label className="text-sm text-gray-700">A line about you (optional)<textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={500} placeholder={`Vocalist and songwriter with ${groupName}`} className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 text-base text-gray-900" /></label>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
        <button onClick={create} disabled={busy} className="min-h-[52px] rounded-full bg-[#0F1B3D] text-base font-bold text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create my artist profile'}</button>
        <button onClick={onDone} className="min-h-[44px] text-sm font-medium text-gray-600">Skip for now</button>
      </div>
    </div>
  );
}
