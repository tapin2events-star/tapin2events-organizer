import { useEffect, useState } from 'react';
import { DetailSkeleton } from '../components/ui/Skeleton';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import BackButton from '../components/BackButton';
import ChatRoom, { type ChatMember } from '../components/chat/ChatRoom';

// Private chat for an artist group's members: photos, files, pins and @mentions. New messages appear live.
export default function GroupChat() {
  const { id = '' } = useParams<{ id: string }>();
  const [groupName, setGroupName] = useState('');
  const [role, setRole] = useState<string | null | undefined>(undefined);
  const [members, setMembers] = useState<ChatMember[]>([]);
  useEffect(() => {
    (async () => {
      const [{ data: g }, { data: r }, { data: m }] = await Promise.all([
        supabase.from('resources').select('display_name').eq('id', id).maybeSingle(),
        supabase.rpc('group_role', { p_group: id }),
        supabase.from('group_members').select('user_email').eq('group_id', id).eq('status', 'active'),
      ]);
      setGroupName(g?.display_name ?? 'Group');
      setRole((r as string) ?? null);
      const emails = ((m ?? []) as { user_email: string }[]).map((x) => x.user_email.toLowerCase());
      if (emails.length) {
        const { data: profs } = await supabase.from('public_profiles').select('email, full_name, profile_photo').in('email', emails);
        setMembers(emails.map((e) => { const p = (profs ?? []).find((x) => String(x.email).toLowerCase() === e); return { email: e, name: p?.full_name || e.split('@')[0], photo: p?.profile_photo ?? null }; }));
      }
    })();
  }, [id]);

  if (role === undefined) return <DetailSkeleton className="mx-auto max-w-3xl py-4" />;
  if (role === null) {
    return (
      <div className="mx-auto max-w-3xl">
        <BackButton fallback={`/resources/${id}`} fallbackLabel="Group" />
        <p className="mt-4 rounded-xl border border-gray-200 bg-surface p-6 text-center text-sm text-muted">Only members of this group can see its chat.</p>
      </div>
    );
  }
  const isAdmin = role === 'owner' || role === 'admin';
  return (
    <div className="mx-auto max-w-3xl">
      <BackButton fallback="/groups" fallbackLabel="Artist groups" />
      <div className="mt-3">
        <h1 className="font-display text-2xl font-bold text-bone">{groupName} chat</h1>
        <p className="text-xs text-muted">Only the group's members can see these messages. <Link to={`/resources/${id}`} className="text-marigold">Group profile ›</Link></p>
      </div>
      <ChatRoom table="group_messages" scopeColumn="group_id" scopeId={id} members={members} canModerate={isAdmin} reportable placeholder="Message the group (type @ to mention)" />
    </div>
  );
}
