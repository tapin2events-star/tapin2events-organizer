import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

// Shows your videos that are still processing on the server (and recent failures), checking every 15s.
// When one goes live, the Feed reloads so it appears.
export default function ProcessingChip({ refreshKey, onLive }: { refreshKey: number; onLive: () => void }) {
  const { user } = useAuth();
  const [items, setItems] = useState<{ id: string; status: string }[]>([]);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    let prev = new Set<string>();
    const check = async () => {
      const { data } = await supabase.rpc('my_processing_posts');
      if (!alive) return;
      const list = (data ?? []) as { id: string; status: string }[];
      const nowProcessing = new Set(list.filter((x) => x.status === 'processing').map((x) => x.id));
      if ([...prev].some((id) => !nowProcessing.has(id))) onLive();
      prev = nowProcessing;
      setItems(list);
    };
    check();
    const t = setInterval(check, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [user, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const processing = items.filter((x) => x.status === 'processing').length;
  const failed = items.filter((x) => x.status === 'failed').length;
  if (!processing && !failed) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(4.5rem+env(safe-area-inset-top,0px))] z-40 flex justify-center px-4 md:top-4">
      <div className="pointer-events-auto rounded-full bg-black/75 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur">
        {processing ? <span>🎬 {processing === 1 ? 'Your video is' : `${processing} videos are`} processing… we'll post {processing === 1 ? 'it' : 'them'} soon</span>
          : <span>⚠️ A video couldn't be processed. Try uploading it again.</span>}
      </div>
    </div>
  );
}
