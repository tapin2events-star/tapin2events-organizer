import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useFeature } from '../../lib/preview';
import MusicPlayerCard from './MusicPlayerCard';
import type { PlayerTrack } from '../../lib/player';
import { useAuth } from '../../context/AuthContext';
import { useOwnedTracks, trackSalesFor } from '../../lib/musicOwned';

// Group page: "Music from our members": approved songs from members' own profiles. Each song stays the member's (plays
// and earnings go to them), credited "by <member>".
interface T { id: string; title: string; url: string; duration_sec: number | null; price: number | null; preview_only: boolean; sale_mode: string; donation_amounts: number[]; cover: string | null; artist: string; artist_id: string; can_sell: boolean; mine: boolean }
export default function GroupMemberMusic({ groupId, groupName, bare = false }: { groupId: string; groupName: string; bare?: boolean }) {
  const on = useFeature('music_uploads');
  const { user } = useAuth();
  const [tracks, setTracks] = useState<T[]>([]);
  useEffect(() => { if (on) supabase.rpc('group_member_music', { p_group_id: groupId }).then(({ data }) => setTracks((data ?? []) as T[])); }, [on, groupId]);
  const owned = useOwnedTracks(tracks.map((t) => t.id), !!user);
  if (!on || tracks.length === 0) return null;
  const list: PlayerTrack[] = tracks.map((t) => ({ id: t.id, title: t.title, url: t.url, duration_sec: t.duration_sec, artist: t.artist, artistId: t.artist_id, cover: t.cover,
    preview: t.can_sell && !t.mine && !owned.has(t.id) && t.sale_mode === 'paid' && t.preview_only && !!t.price }));
  // Buy/donate only where that member can take payments, and never on your own song.
  const sales = trackSalesFor(tracks.filter((t) => t.can_sell && !t.mine), owned);
  return (
    <section className={bare ? '' : 'mt-6'} aria-label={`Music from ${groupName}'s members`}>
      <MusicPlayerCard title="🎤 Music from our members" subtitle={`Solo music from ${groupName}'s members`} cover={tracks[0].cover} tracks={list} trackSales={sales} canSell showArtist pagePath={window.location.pathname} artist={groupName} />
    </section>
  );
}
