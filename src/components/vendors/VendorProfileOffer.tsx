import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { RESOURCE_CATEGORIES } from '../../lib/types';

const VENDOR_FIRST = ['Food & Drink', 'Merchandise & Retail', 'Art & Crafts', 'Catering', 'Decor & Design', 'Florist', 'Rentals', 'Photography', 'Entertainment', 'Other'];
const field = 'mt-1 block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';

// "Turn this into a free vendor profile": offered to vendors without a profile, prefilled from their
// application (business name, description) and account (city, state, photo). Asked at most twice.
export default function VendorProfileOffer({ businessName, description, force = false }: { businessName: string; description: string; force?: boolean }) {
  const { user } = useAuth();
  const [state, setState] = useState<'checking' | 'offer' | 'form' | 'done' | 'hidden'>('checking');
  const [name, setName] = useState(businessName);
  const [bio, setBio] = useState(description);
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [cats, setCats] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  useEffect(() => { setName(businessName); setBio(description); }, [businessName, description]);
  useEffect(() => {
    if (!user?.email) { setState('hidden'); return; }
    (async () => {
      const [{ data: res }, { data: prof }] = await Promise.all([
        supabase.from('resources').select('id').ilike('email', user.email!).limit(1),
        supabase.from('profiles').select('city, state, profile_photo, vendor_profile_prompt').eq('id', user.id).maybeSingle(),
      ]);
      if ((res ?? []).length > 0) return setState('hidden');
      const p = prof as { city: string | null; state: string | null; profile_photo: string | null; vendor_profile_prompt: string | null } | null;
      if (!force && (p?.vendor_profile_prompt === 'dismissed' || p?.vendor_profile_prompt === 'created')) return setState('hidden');
      setCity(p?.city ?? ''); setRegion(p?.state ?? ''); setPhoto(p?.profile_photo ?? null);
      setState('offer');
    })();
  }, [user?.email, user?.id, force]);

  async function notNow() {
    await supabase.rpc('set_vendor_profile_prompt', { p_value: 'dismissed' });
    setState('hidden');
  }
  async function create() {
    if (!user?.email) return;
    if (!name.trim()) return setErr('Add your business name.');
    if (cats.length === 0) return setErr('Pick at least one category.');
    setBusy(true); setErr(null);
    const { data, error } = await supabase.from('resources').insert({
      display_name: name.trim().slice(0, 120), email: user.email, categories: cats, bio: bio.trim() || null,
      city: city.trim() || null, state: region.trim() || null, profile_image: photo, pricing_type: 'contact_quote', base_rate: 0,
    }).select('id').single();
    setBusy(false);
    if (error || !data) return setErr("Couldn't create your profile. Please try again.");
    await supabase.rpc('set_vendor_profile_prompt', { p_value: 'created' });
    setCreatedId(data.id);
    setState('done');
  }

  if (state === 'checking' || state === 'hidden') return null;
  if (state === 'done') return (
    <div className="mt-4 rounded-2xl border border-green-200 bg-white p-4 text-left">
      <p className="font-semibold text-gray-900">🎉 Your vendor profile is live!</p>
      <p className="mt-1 text-sm text-gray-600">Organizers can now find you in Artists &amp; vendors. Add photos, rates and links anytime to stand out.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {createdId && <Link to={`/resources/${createdId}`} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700">View my profile</Link>}
        <Link to="/resources/signup" className="rounded-xl bg-marigold px-3 py-2 text-sm font-semibold text-white">Add photos &amp; details</Link>
      </div>
    </div>
  );
  if (state === 'offer') return (
    <div className="mt-4 rounded-2xl border border-indigo-200 bg-white p-4 text-left">
      <p className="font-semibold text-gray-900">✨ Get found by more organizers</p>
      <p className="mt-1 text-sm text-gray-600">Turn this into a <strong>free vendor profile</strong> so organizers can find and invite you to their events. We've filled it in from your application. It takes about a minute, and your next applications will fill themselves in.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => setState('form')} className="rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white">Create my profile</button>
        <button onClick={notNow} className="rounded-xl px-3 py-2.5 text-sm text-gray-500 hover:text-gray-800">Not now</button>
      </div>
    </div>
  );
  return (
    <div className="mt-4 rounded-2xl border border-indigo-200 bg-white p-4 text-left">
      <p className="font-semibold text-gray-900">Your vendor profile</p>
      <div className="mt-3 flex items-center gap-3">
        {photo ? <img src={photo} alt="" className="h-14 w-14 rounded-2xl object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-200 text-xl font-bold text-gray-600">{(name || '?').charAt(0).toUpperCase()}</span>}
        <p className="text-xs text-gray-500">{photo ? 'Using your account photo. You can change it later.' : 'You can add a photo or logo after.'}</p>
      </div>
      <label className="mt-3 block text-xs font-medium text-gray-500">Business name<input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className={field} /></label>
      <div className="mt-3">
        <span className="text-xs font-medium text-gray-500">What do you offer? (pick up to 3)</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {[...VENDOR_FIRST, ...RESOURCE_CATEGORIES.filter((c) => !VENDOR_FIRST.includes(c))].map((c) => (
            <button key={c} type="button" aria-pressed={cats.includes(c)}
              onClick={() => setCats(cats.includes(c) ? cats.filter((x) => x !== c) : cats.length < 3 ? [...cats, c] : cats)}
              className={`min-h-[36px] rounded-full px-3 text-sm ${cats.includes(c) ? 'bg-marigold font-semibold text-white' : 'border border-gray-300 bg-white text-gray-700'}`}>{c}</button>
          ))}
        </div>
      </div>
      <label className="mt-3 block text-xs font-medium text-gray-500">About your business<textarea rows={3} maxLength={1500} value={bio} onChange={(e) => setBio(e.target.value)} className={field} /></label>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block min-w-0 text-xs font-medium text-gray-500">City<input value={city} onChange={(e) => setCity(e.target.value)} className={field} /></label>
        <label className="block min-w-0 text-xs font-medium text-gray-500">State<input value={region} maxLength={30} onChange={(e) => setRegion(e.target.value)} className={field} /></label>
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={create} disabled={busy} className="rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create my profile'}</button>
        <button onClick={() => setState('offer')} className="rounded-xl px-3 py-2.5 text-sm text-gray-500">Back</button>
      </div>
      <p className="mt-2 text-xs text-gray-500">Rates show as "Contact for a quote" until you set them.</p>
    </div>
  );
}
