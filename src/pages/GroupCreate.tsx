import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import BackButton from '../components/BackButton';
import GroupProfileFields, { EMPTY_GROUP, type GroupFields } from '../components/groups/GroupProfileFields';
import { rpcError } from '../lib/groups';

export default function GroupCreate() {
  const navigate = useNavigate();
  const [fields, setFields] = useState<GroupFields>(EMPTY_GROUP);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (fields.name.trim().length < 2) return setError('Give your group a name.');
    if (!fields.bio.trim()) return setError('Add a short description of the group.');
    setBusy(true); setError(null);
    const { data, error: err } = await supabase.rpc('create_group', {
      p_name: fields.name, p_bio: fields.bio, p_categories: fields.categories, p_city: fields.city, p_state: fields.state,
      p_profile_image: fields.profile_image, p_cover_image: fields.cover_image, p_instagram: fields.instagram, p_website: fields.website,
    });
    setBusy(false);
    if (err || !data) return setError(rpcError(err, "Couldn't create the group. Please try again."));
    navigate(`/groups/${data}/manage?created=1`, { replace: true });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3"><BackButton fallback="/groups" fallbackLabel="Groups" /></div>
      <h1 className="font-display text-3xl font-extrabold text-bone">Create a group</h1>
      <p className="mt-1 text-sm text-muted">Your group gets its own page in Artists &amp; Resources. You'll invite members next.</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-5 rounded-2xl border border-gray-200 bg-surface p-4 sm:p-6">
        <GroupProfileFields value={fields} onChange={setFields} />
        {error && <p role="alert" className="text-sm text-magenta">{error}</p>}
        <button type="submit" disabled={busy} className="self-start rounded-lg bg-marigold px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create group'}</button>
      </form>
    </div>
  );
}
