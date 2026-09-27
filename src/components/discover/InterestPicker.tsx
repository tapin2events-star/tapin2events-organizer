import { useState } from 'react';
import { INTEREST_GROUPS, type InterestGroup } from '../../lib/interests';

// Chip picker for interest groups, used on Discover and in Profile settings.
export default function InterestPicker({
  initial,
  onSave,
  onCancel,
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
}: {
  initial: InterestGroup[];
  onSave: (groups: InterestGroup[]) => Promise<void> | void;
  onCancel?: () => void;
  saveLabel?: string;
  cancelLabel?: string;
}) {
  const [picked, setPicked] = useState<Set<InterestGroup>>(new Set(initial));
  const [saving, setSaving] = useState(false);

  function toggle(g: InterestGroup) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {INTEREST_GROUPS.map((g) => {
          const on = picked.has(g.id);
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => toggle(g.id)}
              aria-pressed={on}
              className={`rounded-full border px-3.5 py-2 text-sm font-medium transition ${on ? 'border-marigold bg-marigold text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-marigold'}`}
            >
              <span className="mr-1" aria-hidden>{g.emoji}</span>
              {g.id}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await onSave(INTEREST_GROUPS.map((g) => g.id).filter((g) => picked.has(g)));
            setSaving(false);
          }}
          className="rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : saveLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-800">{cancelLabel}</button>
        )}
      </div>
    </div>
  );
}
