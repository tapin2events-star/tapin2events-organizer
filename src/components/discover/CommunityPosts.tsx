import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

interface Post {
  id: string;
  thumbnail_url: string | null;
  caption: string | null;
}

export default function CommunityPosts({ eventId }: { eventId: string }) {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('posts')
        .select('id, thumbnail_url, caption')
        .eq('event_id', eventId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(9);
      setPosts(data ?? []);
      setLoading(false);
    })();
  }, [eventId]);

  if (loading || posts.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-gray-900">Community Posts</h2>
        <button onClick={() => navigate(`/feed?event=${eventId}`)} className="text-sm font-medium text-marigold">
          See all &rarr;
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {posts.map((post) => (
          <button
            key={post.id}
            onClick={() => navigate(`/feed?event=${eventId}`)}
            className="aspect-[9/16] overflow-hidden rounded-xl bg-gray-100"
          >
            {post.thumbnail_url ? (
              <img src={post.thumbnail_url} alt={post.caption ?? ''} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl">🎥</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
