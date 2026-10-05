import ImageUpload from '../ImageUpload';
import { RESOURCE_CATEGORIES } from '../../lib/types';

export interface GroupFields {
  name: string; bio: string; categories: string[]; city: string; state: string;
  profile_image: string | null; cover_image: string | null; instagram: string; website: string;
}
export const EMPTY_GROUP: GroupFields = { name: '', bio: '', categories: [], city: '', state: '', profile_image: null, cover_image: null, instagram: '', website: '' };

const input = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';

// The group's public profile fields, shared by Create group and Manage group.
export default function GroupProfileFields({ value, onChange }: { value: GroupFields; onChange: (v: GroupFields) => void }) {
  const set = (patch: Partial<GroupFields>) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <label className="text-sm font-medium text-gray-700">Group name
        <input className={input} value={value.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. The Monday Night Collective" />
      </label>
      <ImageUpload currentUrl={value.profile_image} onUploaded={(url) => set({ profile_image: url })} pathPrefix="groups" label="Group photo or logo" />
      <ImageUpload currentUrl={value.cover_image} onUploaded={(url) => set({ cover_image: url })} pathPrefix="groups" label="Banner image (optional, wide works best)" />
      <label className="text-sm font-medium text-gray-700">About the group
        <textarea className={input} rows={5} maxLength={3000} value={value.bio} onChange={(e) => set({ bio: e.target.value })} placeholder="Who you are, what you do, and what you bring to an event." />
      </label>
      <fieldset>
        <legend className="text-sm font-medium text-gray-700">What does the group do?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {RESOURCE_CATEGORIES.map((c) => {
            const on = value.categories.includes(c);
            return (
              <button type="button" key={c} aria-pressed={on}
                onClick={() => set({ categories: on ? value.categories.filter((x) => x !== c) : [...value.categories, c] })}
                className={`rounded-full border px-3 py-1.5 text-sm ${on ? 'border-marigold bg-marigold text-white' : 'border-gray-300 bg-white text-gray-700'}`}>
                {on ? '✓ ' : ''}{c}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-medium text-gray-700">City<input className={input} value={value.city} maxLength={80} onChange={(e) => set({ city: e.target.value })} /></label>
        <label className="text-sm font-medium text-gray-700">State<input className={input} value={value.state} maxLength={40} onChange={(e) => set({ state: e.target.value })} placeholder="NC" /></label>
      </div>
      <label className="text-sm font-medium text-gray-700">Instagram <span className="font-normal text-gray-400">(optional)</span>
        <input className={input} value={value.instagram} onChange={(e) => set({ instagram: e.target.value })} placeholder="https://instagram.com/yourgroup" inputMode="url" />
      </label>
      <label className="text-sm font-medium text-gray-700">Website <span className="font-normal text-gray-400">(optional)</span>
        <input className={input} value={value.website} onChange={(e) => set({ website: e.target.value })} placeholder="https://" inputMode="url" />
      </label>
    </div>
  );
}
