import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { MAX_TAGS, type TaggedPerson } from '../../lib/postTags';

interface Person extends TaggedPerson {
  is_organizer: boolean | null;
  is_resource: boolean | null;
}

interface ProfileRow {
  email: string;
  full_name: string | null;
  profile_photo: string | null;
  is_organizer: boolean | null;
  is_resource: boolean | null;
  is_profile_private: boolean | null;
}

// Pick other creators to tag in a post: search by name, up to MAX_TAGS people.
// Private profiles aren't offered (the database won't allow tagging them).
export default function TagCreatorsField({
  value,
  onChange,
  selfEmail,
  inputClassName,
}: {
  value: TaggedPerson[];
  onChange: (next: TaggedPerson[]) => void;
  selfEmail: string | undefined;
  inputClassName: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [searched, setSearched] = useState(false);
  const atLimit = value.length >= MAX_TAGS;

  useEffect(() => {
    // Strip characters that mean something in search patterns.
    const q = query.trim().replace(/[%_\\]/g, ' ').replace(/\s+/g, ' ').trim();
    if (q.length < 2 || atLimit) {
      setResults([]);
      setSearched(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('public_profiles')
        .select('email, full_name, profile_photo, is_organizer, is_resource, is_profile_private')
        .ilike('full_name', `%${q}%`)
        .limit(20);
      if (cancelled) return;
      const chosen = new Set(value.map((v) => v.email));
      setResults(
        ((data ?? []) as ProfileRow[])
          .filter((p) => p.email !== selfEmail && !chosen.has(p.email) && !p.is_profile_private)
          .slice(0, 6)
          .map((p) => ({ email: p.email, name: p.full_name?.trim() || 'Creator', photo: p.profile_photo, is_organizer: p.is_organizer, is_resource: p.is_resource }))
      );
      setSearched(true);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, value, selfEmail, atLimit]);

  function add(p: Person) {
    onChange([...value, { email: p.email, name: p.name, photo: p.photo }]);
    setQuery('');
    setResults([]);
    setSearched(false);
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-bone">
        Tag creators <span className="font-normal text-muted">(Optional)</span>
      </span>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((p) => (
            <span key={p.email} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 py-1 pl-3 pr-1 text-sm font-medium text-marigold">
              {p.name}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v.email !== p.email))}
                aria-label={`Remove ${p.name}`}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-indigo-100"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {atLimit ? (
        <p className="text-xs text-muted">You can tag up to {MAX_TAGS} people.</p>
      ) : (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search creators by name"
          autoComplete="off"
          className={inputClassName}
        />
      )}

      {results.length > 0 && (
        <ul className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {results.map((p) => (
            <li key={p.email}>
              <button type="button" onClick={() => add(p)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50">
                {p.photo ? (
                  <img src={p.photo} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-teal text-xs font-bold text-white">
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{p.name}</span>
                {p.is_resource && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple">Resource</span>}
                {p.is_organizer && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-marigold">Organizer</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {searched && results.length === 0 && <p className="text-xs text-muted">No matching creators found.</p>}
      <p className="text-xs text-muted">They'll get a notification, the post shows on their profile, and they can remove themselves from it.</p>
    </div>
  );
}
