import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

interface Report {
  id: string;
  post_id: string | null;
  comment_id: string | null;
  group_message_id: string | null;
  reporter_email: string;
  reason: string;
  created_at: string;
}

interface ReportedPost {
  id: string;
  caption: string | null;
  thumbnail_url: string | null;
  author_email: string;
  status: string;
}

interface ReportedMessage {
  id: string;
  group_id: string;
  body: string;
  sender_email: string;
  deleted_at: string | null;
  group_name?: string;
}

interface ReportedComment {
  id: string;
  post_id: string;
  content: string;
  author_email: string;
  status: string;
}

export default function ReportsTab() {
  const [reports, setReports] = useState<Report[]>([]);
  const [postsById, setPostsById] = useState<Map<string, ReportedPost>>(new Map());
  const [commentsById, setCommentsById] = useState<Map<string, ReportedComment>>(new Map());
  const [messagesById, setMessagesById] = useState<Map<string, ReportedMessage>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data: reportRows } = await supabase
      .from('post_reports')
      .select('id, post_id, comment_id, group_message_id, reporter_email, reason, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    const rows = (reportRows ?? []) as Report[];
    const postIds = [...new Set(rows.map((r) => r.post_id).filter((id): id is string => !!id))];
    const commentIds = [...new Set(rows.map((r) => r.comment_id).filter((id): id is string => !!id))];
    const messageIds = [...new Set(rows.map((r) => r.group_message_id).filter((id): id is string => !!id))];

    const [{ data: postRows }, { data: commentRows }, { data: messageRows }] = await Promise.all([
      postIds.length
        ? supabase.from('posts').select('id, caption, thumbnail_url, author_email, status').in('id', postIds)
        : Promise.resolve({ data: [] }),
      commentIds.length
        ? supabase.from('post_comments').select('id, post_id, content, author_email, status').in('id', commentIds)
        : Promise.resolve({ data: [] }),
      messageIds.length
        ? supabase.from('group_messages').select('id, group_id, body, sender_email, deleted_at').in('id', messageIds)
        : Promise.resolve({ data: [] }),
    ]);
    const msgs = (messageRows ?? []) as ReportedMessage[];
    const groupIds = [...new Set(msgs.map((m) => m.group_id))];
    if (groupIds.length) {
      const { data: groups } = await supabase.from('resources').select('id, display_name').in('id', groupIds);
      const gn = new Map((groups ?? []).map((g) => [g.id, g.display_name]));
      msgs.forEach((m) => { m.group_name = gn.get(m.group_id) ?? 'a group'; });
    }
    setMessagesById(new Map(msgs.map((m) => [m.id, m])));
    setPostsById(new Map(((postRows ?? []) as ReportedPost[]).map((p) => [p.id, p])));
    setCommentsById(new Map(((commentRows ?? []) as ReportedComment[]).map((c) => [c.id, c])));
    setReports(rows);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // Closing a report closes every pending report about the same post or
  // comment, so one decision clears duplicates from multiple reporters.
  async function closeReportsFor(report: Report, status: 'reviewed' | 'dismissed') {
    let query = supabase.from('post_reports').update({ status }).eq('status', 'pending');
    query = report.post_id ? query.eq('post_id', report.post_id) : report.comment_id ? query.eq('comment_id', report.comment_id) : query.eq('group_message_id', report.group_message_id!);
    await query;
  }

  async function removeContent(report: Report) {
    if (!window.confirm('Remove this from the app? It will no longer be visible to anyone.')) return;
    setBusyId(report.id);
    const { error } = report.group_message_id
      ? await supabase.from('group_messages').update({ deleted_at: new Date().toISOString() }).eq('id', report.group_message_id)
      : await supabase.from(report.post_id ? 'posts' : 'post_comments').update({ status: 'removed', removed_reason: report.reason }).eq('id', report.post_id ?? report.comment_id!);
    if (!error) await closeReportsFor(report, 'reviewed');
    setBusyId(null);
    await load();
  }

  async function dismiss(report: Report) {
    setBusyId(report.id);
    await closeReportsFor(report, 'dismissed');
    setBusyId(null);
    await load();
  }

  if (loading) return <p className="text-muted">Loading reports…</p>;
  if (reports.length === 0) return <p className="text-muted">No pending reports. Nice and quiet.</p>;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">{reports.length} pending report{reports.length === 1 ? '' : 's'}</p>
      {reports.map((r) => {
        const post = r.post_id ? postsById.get(r.post_id) : null;
        const comment = r.comment_id ? commentsById.get(r.comment_id) : null;
        const message = r.group_message_id ? messagesById.get(r.group_message_id) : null;
        const viewPostId = post?.id ?? comment?.post_id ?? null;
        return (
          <div key={r.id} className="flex gap-3 rounded-xl border border-gray-200 bg-surface2 p-4">
            {post?.thumbnail_url && <img src={post.thumbnail_url} alt="" className="h-20 w-14 shrink-0 rounded-lg object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-bone">
                {r.post_id ? 'Post' : r.comment_id ? 'Comment' : 'Group chat message'} reported for: <span className="text-magenta">{r.reason}</span>
              </p>
              {post && <p className="mt-1 text-sm text-bone">"{post.caption || 'No caption'}" by {post.author_email}</p>}
              {comment && <p className="mt-1 text-sm text-bone">"{comment.content}" by {comment.author_email}</p>}
              {message && !message.deleted_at && <p className="mt-1 text-sm text-bone">"{message.body}" by {message.sender_email} <span className="text-muted">in {message.group_name}</span></p>}
              {!post && !comment && !(message && !message.deleted_at) && <p className="mt-1 text-sm text-muted">This content has already been deleted.</p>}
              <p className="mt-1 text-xs text-muted">
                Reported by {r.reporter_email} · {new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {viewPostId && (
                  <Link to={`/feed?post=${viewPostId}`} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-bone hover:border-marigold">
                    View
                  </Link>
                )}
                {(post || comment || (message && !message.deleted_at)) && (
                  <button
                    onClick={() => removeContent(r)}
                    disabled={busyId === r.id}
                    className="rounded-lg bg-magenta px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
                <button
                  onClick={() => dismiss(r)}
                  disabled={busyId === r.id}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-muted hover:text-bone disabled:opacity-50"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
