import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import FollowListModal from '../components/profile/FollowListModal';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { TapEvent } from '../lib/types';

interface ProfileRow {
  full_name: string | null;
  email: string;
  bio: string | null;
  profile_photo: string | null;
  is_organizer: boolean | null;
  is_resource: boolean | null;
  followers_count: number | null;
  following_count: number | null;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone_number: string | null;
  is_profile_private: boolean | null;
  preferred_home_page: string | null;
  notification_preferences: {
    event_updates?: boolean;
    new_followers?: boolean;
    email_notifications?: boolean;
    collaboration_invites?: boolean;
  } | null;
}

type SettingsTab = 'basic' | 'prefs' | 'notifs';

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [savedEvents, setSavedEvents] = useState<TapEvent[]>([]);
  const [myResourceId, setMyResourceId] = useState<string | null>(null);
  const [openList, setOpenList] = useState<'followers' | 'following' | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [tab, setTab] = useState<SettingsTab>('basic');
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);

  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    (async () => {
      const { data: profileData } = await supabase
        .from('profiles')
        .select(
          'full_name, email, bio, profile_photo, is_organizer, is_resource, interests, followers_count, following_count, location, city, state, country, phone_number, is_profile_private, preferred_home_page, notification_preferences'
        )
        .eq('id', user.id)
        .single();
      setProfile(profileData);
      setFullName(profileData?.full_name ?? '');
      setBio(profileData?.bio ?? '');
      setCity(profileData?.city ?? '');
      setState(profileData?.state ?? '');
      setPhone(profileData?.phone_number ?? '');

      const savedIds = (profileData?.interests as string[]) ?? [];
      if (savedIds.length > 0) {
        const { data: events } = await supabase.from('events').select('*').in('id', savedIds);
        setSavedEvents((events ?? []) as TapEvent[]);
      }
      if (profileData?.is_resource) {
        const { data: resource } = await supabase.from('resources').select('id').eq('email', user.email).maybeSingle();
        setMyResourceId(resource?.id ?? null);
      }
      setLoading(false);
    })();
  }, [user, authLoading, navigate, location.pathname]);

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingPhoto(true);
    const path = `${user.id}/profile-photo-${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('user-uploads').upload(path, file, { upsert: true });
    if (!uploadError) {
      const { data: publicUrlData } = supabase.storage.from('user-uploads').getPublicUrl(path);
      await supabase.from('profiles').update({ profile_photo: publicUrlData.publicUrl }).eq('id', user.id);
      setProfile((prev) => (prev ? { ...prev, profile_photo: publicUrlData.publicUrl } : prev));
    }
    setUploadingPhoto(false);
  }

  async function saveBasicInfo() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, bio, city, state, phone_number: phone })
      .eq('id', user.id);
    setSaving(false);
    if (!error) {
      setProfile((prev) => (prev ? { ...prev, full_name: fullName, bio, city, state, phone_number: phone } : prev));
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 2000);
    }
  }

  async function togglePrivate() {
    if (!user || !profile) return;
    const next = !profile.is_profile_private;
    setProfile({ ...profile, is_profile_private: next });
    await supabase.from('profiles').update({ is_profile_private: next }).eq('id', user.id);
  }

  async function toggleNotification(key: keyof NonNullable<ProfileRow['notification_preferences']>) {
    if (!user || !profile) return;
    const current = profile.notification_preferences ?? {};
    const next = { ...current, [key]: !current[key] };
    setProfile({ ...profile, notification_preferences: next });
    await supabase.from('profiles').update({ notification_preferences: next }).eq('id', user.id);
  }

  if (loading) return <p className="text-muted">Loading…</p>;
  if (!profile) return <p className="text-muted">Couldn't load your profile.</p>;

  const notifs = profile.notification_preferences ?? {};

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          {profile.profile_photo ? (
            <img src={profile.profile_photo} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-teal font-display text-2xl font-bold text-white">
              {(profile.full_name || profile.email).charAt(0).toUpperCase()}
            </div>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            aria-label="Change profile photo"
            className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-ink bg-surface2 text-muted shadow-sm hover:text-marigold"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" strokeLinejoin="round" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-extrabold text-bone">{profile.full_name || profile.email}</h1>
          <p className="text-sm text-muted">{profile.email}</p>
          <div className="mt-2 flex gap-2">
            {profile.is_organizer && (
              <span className="flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-marigold">
                💼 Organizer
              </span>
            )}
            {profile.is_resource && (
              <span className="flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple">
                ⭐ Resource
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-8 border-y border-gray-200 py-4">
        <div>
          <p className="text-center font-display text-xl font-bold text-bone">0</p>
          <p className="text-xs text-muted">Posts</p>
        </div>
        <button onClick={() => setOpenList('followers')} className="text-left">
          <p className="text-center font-display text-xl font-bold text-bone">{profile.followers_count ?? 0}</p>
          <p className="text-xs text-muted">Followers</p>
        </button>
        <button onClick={() => setOpenList('following')} className="text-left">
          <p className="text-center font-display text-xl font-bold text-bone">{profile.following_count ?? 0}</p>
          <p className="text-xs text-muted">Following</p>
        </button>
      </div>

      {profile.bio && <p className="mt-4 text-sm text-muted">{profile.bio}</p>}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link to="/activity" className="rounded-xl border border-gray-200 bg-surface2 p-4 hover:border-marigold">
          <p className="font-medium text-bone">My Activity</p>
          <p className="text-xs text-muted">Tickets and registrations</p>
        </Link>
        <Link to="/products?tab=orders" className="rounded-xl border border-gray-200 bg-surface2 p-4 hover:border-marigold">
          <p className="font-medium text-bone">My Orders</p>
          <p className="text-xs text-muted">Products you've purchased</p>
        </Link>
        {profile.is_organizer && (
          <Link to="/organizer" className="rounded-xl border border-gray-200 bg-surface2 p-4 hover:border-marigold">
            <p className="font-medium text-bone">Organizer Dashboard</p>
            <p className="text-xs text-muted">Events you organize</p>
          </Link>
        )}
        {profile.is_resource && (
          <Link to="/resources/dashboard" className="rounded-xl border border-gray-200 bg-surface2 p-4 hover:border-marigold">
            <p className="font-medium text-bone">Resource Dashboard</p>
            <p className="text-xs text-muted">Your bookings and listing</p>
          </Link>
        )}
        {profile.is_resource && myResourceId && (
          <Link to={`/resources/${myResourceId}`} className="rounded-xl border border-gray-200 bg-surface2 p-4 hover:border-marigold">
            <p className="font-medium text-bone">View My Resource Page</p>
            <p className="text-xs text-muted">What others see when they find you</p>
          </Link>
        )}
      </div>

      <div className="mt-10">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
          {([
            { id: 'basic', label: 'Basic' },
            { id: 'prefs', label: 'Prefs' },
            { id: 'notifs', label: 'Notifs' },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === t.id ? 'bg-surface text-bone shadow-sm' : 'text-muted hover:text-bone'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'basic' && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-surface2 p-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">Full name</span>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="rounded-lg border border-gray-300 bg-surface px-3 py-2 text-bone outline-none focus-visible:border-marigold" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">Bio</span>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="rounded-lg border border-gray-300 bg-surface px-3 py-2 text-bone outline-none focus-visible:border-marigold" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">City</span>
                <input value={city} onChange={(e) => setCity(e.target.value)} className="rounded-lg border border-gray-300 bg-surface px-3 py-2 text-bone outline-none focus-visible:border-marigold" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">State</span>
                <input value={state} onChange={(e) => setState(e.target.value)} className="rounded-lg border border-gray-300 bg-surface px-3 py-2 text-bone outline-none focus-visible:border-marigold" />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">Phone</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-lg border border-gray-300 bg-surface px-3 py-2 text-bone outline-none focus-visible:border-marigold" />
            </label>
            <button
              onClick={saveBasicInfo}
              disabled={saving}
              className="self-start rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white hover:bg-marigold/90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : savedMessage ? 'Saved!' : 'Save changes'}
            </button>
          </div>
        )}

        {tab === 'prefs' && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-surface2 p-4">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-medium text-bone">Private profile</span>
                <span className="block text-xs text-muted">Only you can see your saved events and activity</span>
              </span>
              <input type="checkbox" checked={!!profile.is_profile_private} onChange={togglePrivate} className="h-5 w-5 accent-marigold" />
            </label>
          </div>
        )}

        {tab === 'notifs' && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-surface2 p-4">
            {([
              { key: 'event_updates', label: 'Event updates', desc: "Changes to events you're attending or organizing" },
              { key: 'new_followers', label: 'New followers', desc: 'When someone follows your profile' },
              { key: 'email_notifications', label: 'Email notifications', desc: 'Receive these updates by email' },
              { key: 'collaboration_invites', label: 'Collaboration invites', desc: "When you're invited to help manage an event" },
            ] as const).map((n) => (
              <label key={n.key} className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-medium text-bone">{n.label}</span>
                  <span className="block text-xs text-muted">{n.desc}</span>
                </span>
                <input
                  type="checkbox"
                  checked={notifs[n.key] ?? true}
                  onChange={() => toggleNotification(n.key)}
                  className="h-5 w-5 accent-marigold"
                />
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="mt-10">
        <h2 className="font-display text-lg font-semibold text-bone">Saved Events</h2>
        {savedEvents.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Nothing saved yet — tap the bookmark icon on any event to keep track of it here.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {savedEvents.map((e) => (
              <Link key={e.id} to={`/events/${e.id}`} className="flex gap-3 rounded-xl border border-gray-200 bg-surface2 p-3 hover:border-marigold">
                {e.poster_url ? (
                  <img src={e.poster_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-16 w-16 shrink-0 rounded-lg bg-gradient-to-br from-indigo-200 to-teal-200" />
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-bone">{e.title}</p>
                  {e.start_date && (
                    <p className="text-xs text-muted">{new Date(e.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {openList && (
        <FollowListModal
          email={profile.email}
          direction={openList}
          isPrivate={false}
          isOwnList={true}
          onClose={() => setOpenList(null)}
        />
      )}
    </div>
  );
}
