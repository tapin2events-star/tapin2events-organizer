import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

// "Part of": the organizations a person belongs to, on their public and artist profiles. Featured people show
// automatically; team members only if they chose to; anyone can hide one (Profile > Organizations on your profile).
interface Aff { org_id: string; name: string; slug: string; logo: string | null; verified: boolean; label: string }
export default function PartOfOrgs({ userId, resourceId, className = '' }: { userId?: string | null; resourceId?: string | null; className?: string }) {
  const [rows, setRows] = useState<Aff[]>([]);
  useEffect(() => {
    if (!userId && !resourceId) return;
    supabase.rpc('person_affiliations', { p_user_id: userId ?? null, p_resource_id: resourceId ?? null }).then(({ data }) => setRows((data ?? []) as Aff[]));
  }, [userId, resourceId]);
  if (!rows.length) return null;
  return (
    <section className={className} aria-label="Part of">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Part of</p>
      <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
        {rows.map((o) => (
          <Link key={o.org_id} to={`/o/${o.slug}`} className="flex min-h-[52px] shrink-0 items-center gap-2.5 rounded-2xl border border-gray-200 bg-white py-2 pl-2 pr-4 hover:border-marigold">
            {o.logo ? <img src={o.logo} alt="" className="h-9 w-9 rounded-xl object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-base" aria-hidden="true">🏢</span>}
            <span className="min-w-0">
              <span className="block max-w-[11rem] truncate text-sm font-semibold text-gray-900">{o.name}{o.verified ? ' ✓' : ''}</span>
              <span className="block max-w-[11rem] truncate text-xs text-gray-500">{o.label}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
