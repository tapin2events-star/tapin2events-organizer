import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

// Public profile: the networking card (only when the person chose to show it publicly) and organizations they run.
interface Extras {
  card: { title: string | null; company: string | null; intro: string | null; linkedin: string | null; looking_for: string[] | null } | null;
  orgs: { name: string; slug: string; logo: string | null; role: string; verified: boolean }[];
}
export default function ProfileExtras({ email }: { email: string }) {
  const [x, setX] = useState<Extras | null>(null);
  useEffect(() => { if (email) supabase.rpc('public_profile_extras', { p_email: email }).then(({ data }) => setX((data ?? null) as Extras | null)); }, [email]);
  if (!x || (!x.card && !x.orgs?.length)) return null;
  const c = x.card;
  return (
    <div className="mt-6 flex flex-col gap-4">
      {c && (
        <section className="rounded-2xl border border-gray-200 bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">🤝 Networking card</p>
          {(c.title || c.company) && <p className="mt-1 text-base font-semibold text-bone [overflow-wrap:anywhere]">{[c.title, c.company].filter(Boolean).join(' · ')}</p>}
          {c.intro && <p className="mt-1 whitespace-pre-line text-sm text-gray-600 [overflow-wrap:anywhere]">{c.intro}</p>}
          {c.looking_for && c.looking_for.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted">Looking for:</span>
              {c.looking_for.map((l) => <span key={l} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-marigold">{l}</span>)}
            </div>
          )}
          {c.linkedin && /^https?:\/\//i.test(c.linkedin) && (
            <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800">LinkedIn</a>
          )}
        </section>
      )}
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
