import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { reloadSetup, useSetup, type Role } from '../lib/setup';
import { uploadImage } from '../lib/business';
import { INTEREST_GROUPS } from '../lib/interests';

const ROLES: { id: Role; emoji: string; title: string; desc: string }[] = [
  { id: 'attendee', emoji: '🎟️', title: 'Find events near me', desc: 'Discover shows, classes, markets and more' },
  { id: 'artist', emoji: '🎤', title: "I'm an artist or performer", desc: 'Get booked, sell merch and get paid' },
  { id: 'services', emoji: '🛠️', title: 'I offer services', desc: 'Vendor, venue, photographer, DJ, caterer…' },
  { id: 'organizer', emoji: '📅', title: 'I organize events', desc: 'Sell tickets and run your events' },
  { id: 'organization', emoji: '🏢', title: 'I run an organization or business', desc: 'A page for your group, team tools and more' },
];
const field = 'mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-base text-gray-900';

// First sign-in welcome: name/photo/city, what brings you here, interests, then a personal next step.
export default function Welcome() {
  const { user } = useAuth();
  const setup = useSetup();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (!setup || prefilled) return;
    setName(setup.full_name ?? ''); setPhoto(setup.photo); setCity(setup.city ?? ''); setInterests(setup.interests ?? []);
    const r = new Set<Role>(setup.roles);
    if (setup.has_events) r.add('organizer');
    if (setup.has_resource) r.add('artist');
    if (setup.has_org) r.add('organization');
    setRoles([...r]);
    setPrefilled(true);
  }, [setup, prefilled]);
  if (!user) return <div className="flex min-h-screen items-center justify-center p-6 text-center"><Link to="/login" className="rounded-xl bg-marigold px-5 py-3 font-semibold text-white">Sign in to get started</Link></div>;

  async function upload(f: File | undefined) {
    if (!f || !user) return;
    setBusy(true); setErr(null);
    const r = await uploadImage(user.id, f, 'profile');
    setBusy(false);
    if (r.error) setErr(r.error); else setPhoto(r.url ?? null);
  }
  async function finish() {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc('complete_onboarding', { p_full_name: name, p_photo: photo, p_city: city, p_roles: roles.length ? roles : ['attendee'], p_interests: interests });
    setBusy(false);
    if (error) return setErr("Couldn't save. Please try again.");
    await reloadSetup();
    setStep(3);
  }
  async function skip() {
    await supabase.rpc('complete_onboarding', { p_full_name: null, p_photo: null, p_city: null, p_roles: roles.length ? roles : ['attendee'], p_interests: null });
    await reloadSetup();
    navigate('/', { replace: true });
  }
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const next: { to: string; label: string; emoji: string }[] = [];
  if (roles.includes('artist')) next.push({ to: '/resources/new', label: 'Create my artist profile', emoji: '🎤' });
  if (roles.includes('services') && !roles.includes('artist')) next.push({ to: '/resources/new', label: 'Create my services listing', emoji: '🛠️' });
  if (roles.includes('organization')) next.push({ to: '/business', label: 'Create my organization page', emoji: '🏢' });
  if (roles.includes('organizer')) next.push({ to: '/organizer/new', label: 'Create my first event', emoji: '📅' });
  next.push({ to: '/', label: 'Explore events near me', emoji: '🎟️' });

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-indigo-50 to-white px-4 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
      <div className="mx-auto w-full max-w-md flex-1">
        <div className="flex items-center justify-between">
          <span className="font-display text-2xl font-extrabold"><span className="bg-gradient-to-r from-marigold to-teal bg-clip-text text-transparent">TapIN</span></span>
          {step < 3 && <button onClick={skip} className="text-sm text-gray-500">Skip for now</button>}
        </div>
        {step < 3 && <div className="mt-4 flex gap-1.5" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-marigold' : 'bg-gray-200'}`} />)}</div>}

        {step === 0 && (
          <section className="mt-8">
            <h1 className="font-display text-3xl font-extrabold text-gray-900">Welcome to TapIN 👋</h1>
            <p className="mt-2 text-gray-600">Let's set you up. It takes about a minute.</p>
            <div className="mt-6 flex items-center gap-4">
              {photo ? <img src={photo} alt="" className="h-20 w-20 rounded-full object-cover" /> : <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-200 text-3xl">🙂</span>}
              <label className="cursor-pointer rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700">{busy ? 'Uploading…' : photo ? 'Change photo' : 'Add a photo'}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
              </label>
            </div>
            <label className="mt-5 block text-sm font-medium text-gray-700">Your name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" className={field} /></label>
            <label className="mt-4 block text-sm font-medium text-gray-700">Your city<input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} placeholder="Raleigh, NC" autoComplete="address-level2" className={field} /></label>
            {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
            <button onClick={() => (name.trim() ? setStep(1) : setErr('Add your name so people know who you are.'))} className="mt-8 w-full rounded-2xl bg-marigold py-3.5 text-base font-bold text-white">Continue</button>
          </section>
        )}

        {step === 1 && (
          <section className="mt-8">
            <h1 className="font-display text-3xl font-extrabold text-gray-900">What brings you to TapIN?</h1>
            <p className="mt-2 text-gray-600">Pick all that apply. We'll set things up for you.</p>
            <div className="mt-6 flex flex-col gap-2.5">
              {ROLES.map((r) => {
                const on = roles.includes(r.id);
                return (
                  <button key={r.id} type="button" onClick={() => setRoles(toggle(roles, r.id))} aria-pressed={on}
                    className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${on ? 'border-marigold bg-white shadow-sm' : 'border-gray-200 bg-white'}`}>
                    <span className="text-3xl" aria-hidden="true">{r.emoji}</span>
                    <span className="min-w-0 flex-1"><span className="block font-semibold text-gray-900">{r.title}</span><span className="block text-sm text-gray-500">{r.desc}</span></span>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${on ? 'border-marigold bg-marigold text-white' : 'border-gray-300 text-transparent'}`}>✓</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-8 flex gap-2">
              <button onClick={() => setStep(0)} className="rounded-2xl border border-gray-300 bg-white px-5 py-3.5 font-semibold text-gray-700">Back</button>
              <button onClick={() => setStep(2)} disabled={!roles.length} className="flex-1 rounded-2xl bg-marigold py-3.5 text-base font-bold text-white disabled:opacity-50">Continue</button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="mt-8">
            <h1 className="font-display text-3xl font-extrabold text-gray-900">What are you into?</h1>
            <p className="mt-2 text-gray-600">We'll show you more of what you love.</p>
            <div className="mt-6 grid grid-cols-2 gap-2.5">
              {INTEREST_GROUPS.map((g) => {
                const on = interests.includes(g.id);
                return (
                  <button key={g.id} type="button" onClick={() => setInterests(toggle(interests, g.id))} aria-pressed={on}
                    className={`rounded-2xl border-2 p-4 text-left ${on ? 'border-marigold bg-white shadow-sm' : 'border-gray-200 bg-white'}`}>
                    <span className="block text-2xl" aria-hidden="true">{g.emoji}</span>
                    <span className="mt-1 block text-sm font-semibold text-gray-900">{g.id}</span>
                  </button>
                );
              })}
            </div>
            {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
            <div className="mt-8 flex gap-2">
              <button onClick={() => setStep(1)} className="rounded-2xl border border-gray-300 bg-white px-5 py-3.5 font-semibold text-gray-700">Back</button>
              <button onClick={finish} disabled={busy} className="flex-1 rounded-2xl bg-marigold py-3.5 text-base font-bold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Finish'}</button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="mt-10 text-center">
            <p className="text-5xl" aria-hidden="true">🎉</p>
            <h1 className="mt-3 font-display text-3xl font-extrabold text-gray-900">You're all set{name.trim() ? `, ${name.trim().split(/\s+/)[0]}` : ''}!</h1>
            <p className="mt-2 text-gray-600">Here's a good place to start:</p>
            <div className="mt-6 flex flex-col gap-2.5">
              {next.map((n, i) => (
                <Link key={n.label} to={n.to} replace className={`flex items-center gap-3 rounded-2xl p-4 text-left font-semibold ${i === 0 ? 'bg-marigold text-white' : 'border border-gray-200 bg-white text-gray-900'}`}>
                  <span className="text-2xl" aria-hidden="true">{n.emoji}</span>{n.label}<span className="ml-auto" aria-hidden="true">›</span>
                </Link>
              ))}
            </div>
            <p className="mt-6 text-sm text-gray-500">You can change these anytime from your profile.</p>
          </section>
        )}
      </div>
    </div>
  );
}
