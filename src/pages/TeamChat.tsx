import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import BackButton from '../components/BackButton';
import ChatRoom, { type ChatMember } from '../components/chat/ChatRoom';
import { DetailSkeleton } from '../components/ui/Skeleton';

// An organization's private team chat (everyone on its team).
export default function TeamChat() {
  const { orgId = '' } = useParams<{ orgId: string }>();
  const [org, setOrg] = useState<{ name: string; slug: string; logo_url: string | null } | null | undefined>(undefined);
  const [role, setRole] = useState<string | null>(null);
  const [members, setMembers] = useState<ChatMember[]>([]);
  useEffect(() => {
    (async () => {
      const [{ data: o }, { data: r }, { data: m }] = await Promise.all([
        supabase.from('organizations').select('name, slug, logo_url').eq('id', orgId).maybeSingle(),
        supabase.rpc('org_role', { p_org: orgId }),
        supabase.rpc('org_chat_members', { p_org_id: orgId }),
      ]);
      setRole((r as string) ?? null);
      setOrg(r ? ((o ?? null) as typeof org) : null);
      setMembers(((m ?? []) as { email: string; full_name: string | null; photo: string | null }[]).map((x) => ({ email: x.email, name: x.full_name || x.email.split('@')[0], photo: x.photo })));
    })();
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (org === undefined) return <DetailSkeleton className="mx-auto max-w-3xl py-4" />;
  if (org === null) return (
    <div className="mx-auto max-w-3xl">
      <BackButton fallback="/organizer/planning" fallbackLabel="Planning" />
      <p className="mt-4 rounded-xl border border-gray-200 bg-surface p-6 text-center text-sm text-muted">Only this organization's team can see its chat.</p>
    </div>
  );
  return (
    <div className="mx-auto max-w-3xl">
      <BackButton fallback={`/organizer/planning?for=${org.slug}#team`} fallbackLabel="Planning" />
      <div className="mt-3 flex items-center gap-3">
        {org.logo_url ? <img src={org.logo_url} alt="" className="h-11 w-11 rounded-xl object-cover" /> : <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0F1B3D] font-bold text-white">{org.name.charAt(0)}</span>}
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-bold text-bone">{org.name} team chat</h1>
          <p className="text-xs text-muted">{members.length} {members.length === 1 ? 'person' : 'people'} · only the team can see this · <Link to={`/organizer/planning?for=${org.slug}`} className="text-marigold">Planning ›</Link></p>
        </div>
      </div>
      <ChatRoom table="org_messages" scopeColumn="org_id" scopeId={orgId} members={members} canModerate={role === 'owner' || role === 'admin'}
        placeholder={`Message ${org.name}'s team (type @ to mention)`} onRead={() => { void supabase.rpc('mark_org_chat_read', { p_org_id: orgId }).then(() => undefined); }} />
    </div>
  );
}
