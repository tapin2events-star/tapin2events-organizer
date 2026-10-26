import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { groupsOf } from '../../lib/groups';

// "Organizations and groups": one row instead of three sections (organizations they run, organizations they're
// part of, artist groups). Each listed once with its role. Featured and team affiliations follow the same rules as
// before (featured automatic, team opt-in, anyone can hide one); organizations they own or administer show as before.
interface Item { key: string; to: string; name: string; logo: string | null; label: string; verified?: boolean; round?: boolean }
export default function OrgsAndGroups({ email, userId, className = '' }: { email: string; userId?: string | null; className?: string }) {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    if (!email) return;
    (async () => {
      const [{ data: extras }, aff, groups] = await Promise.all([
        supabase.rpc('public_profile_extras', { p_email: email }),
        userId ? supabase.rpc('person_affiliations', { p_user_id: userId, p_resource_id: null }).then((r) => r.data) : Promise.resolve([]),
        groupsOf(email),
      ]);
      const out = new Map<string, Item>();
      for (const o of ((extras as { orgs?: { name: string; slug: string; logo: string | null; role: string; verified: boolean }[] } | null)?.orgs ?? [])) {
        out.set(o.slug, { key: o.slug, to: `/o/${o.slug}`, name: o.name, logo: o.logo, verified: o.verified, label: o.role ? o.role.charAt(0).toUpperCase() + o.role.slice(1) : 'Member' });
      }
      for (const a of ((aff ?? []) as { slug: string; name: string; logo: string | null; verified: boolean; label: string }[])) {
        if (!out.has(a.slug)) out.set(a.slug, { key: a.slug, to: `/o/${a.slug}`, name: a.name, logo: a.logo, verified: a.verified, label: a.label });
      }
      const list = [...out.values()];
      for (const g of groups) list.push({ key: `g-${g.group_id}`, to: `/resources/${g.group_id}`, name: g.name, logo: g.profile_image, label: g.title ? `Group · ${g.title}` : 'Group', round: true });
      setItems(list);
    })();
  }, [email, userId]);
  if (!items.length) return null;
  return (
    <section className={className} aria-label="Organizations and groups">
      <p className="text-xs font-semibold text-gray-500">Organizations and groups</p>
      <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
        {items.map((o) => (
          <Link key={o.key} to={o.to} className="flex min-h-[52px] shrink-0 items-center gap-2.5 rounded-2xl border border-gray-200 bg-white py-2 pl-2 pr-4 hover:border-marigold">
            {o.logo ? <img src={o.logo} alt="" className={`h-9 w-9 object-cover ${o.round ? 'rounded-full' : 'rounded-xl'}`} />
              : <span className={`flex h-9 w-9 items-center justify-center bg-gray-100 text-sm font-bold text-gray-600 ${o.round ? 'rounded-full' : 'rounded-xl'}`} aria-hidden="true">{o.name.charAt(0)}</span>}
            <span className="min-w-0">
              <span className="block max-w-[12rem] truncate text-sm font-semibold text-gray-900">{o.name}{o.verified ? ' ✓' : ''}</span>
              <span className="block max-w-[12rem] truncate text-xs text-gray-500">{o.label}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
