import { useState } from 'react';

// "Block this person" with a confirm step, used inside the report sheets and on profiles.
export default function BlockConfirm({ name, onBlock }: { name: string; onBlock: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="w-full rounded-lg border border-red-200 px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50">
        Block {name}
      </button>
    );
  }
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
      <p className="text-sm font-medium text-red-800">Block {name}?</p>
      <p className="mt-0.5 text-xs text-red-700">You won't see each other's posts or comments, and they can't follow you, comment on your posts, tag you, or tip you. They won't be told. You can unblock anytime from your Profile.</p>
      <div className="mt-2 flex gap-2">
        <button disabled={busy} onClick={async () => { setBusy(true); await onBlock(); setBusy(false); }} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Blocking…' : 'Block'}</button>
        <button disabled={busy} onClick={() => setConfirming(false)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">Cancel</button>
      </div>
    </div>
  );
}
