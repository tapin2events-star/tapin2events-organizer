import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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
}

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [savedEvents, setSavedEvents] = useState<TapEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    (async () => {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, email, bio, profile_photo, is_organizer, is_resource, interests')
        .eq('id', user.id)
        .single();
      setProfile(profileData);

      const savedIds = (profileData?.interests as string[]) ?? [];
      if (savedIds.length > 0) {
        const { data: events } = await supabase.from('events').select('*').in('id', savedIds);
        setSavedEvents((events ?? []) as TapEvent[]);
      }
      setLoading(false);
    })();
  }, [user, authLoading, navigate, location.pathname]);

  if (loading) return <p className="text-muted">Loading…</p>;
  if (!profile) return <p className="text-muted">Couldn't load your profile.</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-4">
        {profile.profile_photo ? (
          <img src={profile.profile_photo} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-mint font-display text-2xl font-bold text-white">
            {(profile.full_name || profile.email).charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="font-display text-2xl font-extrabold text-bone">{profile.full_name || profile.email}</h1>
          <p className="text-sm text-muted">{profile.email}</p>
        </div>
      </div>

      {profile.bio && <p className="mt-4 text-sm text-muted">{profile.bio}</p>}

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
            <p className="font-medium text-bone">My Events</p>
            <p className="text-xs text-muted">Events you organize</p>
          </Link>
        )}
        {profile.is_resource && (
          <Link to="/resources/dashboard" className="rounded-xl border border-gray-200 bg-surface2 p-4 hover:border-marigold">
            <p className="font-medium text-bone">Resource Dashboard</p>
            <p className="text-xs text-muted">Your bookings and listing</p>
          </Link>
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
    </div>
  );
}
