import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

// Public profile: organizations the person runs (Owner or Admin).
interface Extras {
  card: { title: string | null; company: string | null; intro: string | null; linkedin: string | null; looking_for: string[] | null } | null;
  orgs: { name: string; slug: string; logo: string | null; role: string; verified: boolean }[];
}
export default function ProfileExtras({ email }: { email: string }) {
  const [x, setX] = useState<Extras | null>(null);
  useEffect(() => { if (email) supabase.rpc('public_profile_extras', { p_email: email }).then(({ data }) => setX((data ?? null) as Extras | null)); }, [email]);
  // The networking card already shows as the compact "Networking card · View" row on the profile.
  if (!x || !x.orgs?.length) return null;
  return (
    <div className="mt-6 flex flex-col gap-4">
      {x.orgs?.length > 0 && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">🏢 Organizations</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {x.orgs.map((o) => (
              <Link key={o.slug} to={`/o/${o.slug}`} className="flex max-w-full items-center gap-2 rounded-xl border border-gray-200 bg-surface px-3 py-2 hover:border-marigold">
                {o.logo ? <img src={o.logo} alt="" className="h-8 w-8 shrink-0 rounded-lg bg-white object-cover" /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-500">{o.name.charAt(0)}</span>}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-bone">{o.name}{o.verified && <span className="ml-1 text-purple-600" aria-label="Verified">✓</span>}</span>
                  <span className="block text-xs text-muted">{o.role === 'owner' ? 'Owner' : 'Admin'}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
