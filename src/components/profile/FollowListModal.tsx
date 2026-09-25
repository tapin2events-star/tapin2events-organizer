import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

interface FollowListEntry {
  email: string;
  full_name: string | null;
  profile_photo: string | null;
  is_organizer: boolean | null;
  is_resource: boolean | null;
}

interface FollowListModalProps {
  email: string;
  direction: 'followers' | 'following';
  isPrivate: boolean;
  isOwnList: boolean;
  onClose: () => void;
}

export default function FollowListModal({ email, direction, isPrivate, isOwnList, onClose }: FollowListModalProps) {
  const [entries, setEntries] = useState<FollowListEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Someone else's private profile hides who follows them and who they
  // follow; a private profile can still see its own lists.
  const isHidden = isPrivate && !isOwnList;

  useEffect(() => {
    if (isHidden) {
      setLoading(false);
      return;
    }
    supabase
      .rpc('get_follow_list', { p_email: email, p_direction: direction })
      .then(({ data }) => {
        setEntries((data ?? []) as FollowListEntry[]);
        setLoading(false);
      });
  }, [email, direction, isHidden]);

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[75vh] w-full max-w-sm flex-col rounded-t-2xl bg-surface sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <p className="font-semibold text-bone">{direction === 'followers' ? 'Followers' : 'Following'}</p>
          <button onClick={onClose} aria-label="Close" className="text-muted">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isHidden ? (
            <p className="p-6 text-center text-sm text-muted">This person's {direction} list is private.</p>
          ) : loading ? (
            <p className="p-6 text-center text-sm text-muted">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted">
              {direction === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
            </p>
          ) : (
            entries.map((entry) => (
              <Link
                key={entry.email}
                to={`/creator/${encodeURIComponent(entry.email)}`}
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface2"
              >
                {entry.profile_photo ? (
                  <img src={entry.profile_photo} alt="" className="h-11 w-11 rounded-full object-cover" />
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-teal text-sm font-bold text-white">
                    {(entry.full_name || entry.email).charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-bone">{entry.full_name || entry.email}</p>
                  <div className="flex gap-1.5">
                    {entry.is_organizer && <span className="text-xs text-marigold">Organizer</span>}
                    {entry.is_organizer && entry.is_resource && <span className="text-xs text-muted">·</span>}
                    {entry.is_resource && <span className="text-xs text-purple">Resource</span>}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
