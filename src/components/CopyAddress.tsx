import { useState } from 'react';

// Copy the venue address, or a map link to it, for texting or pasting into another app.
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / some in-app web views: fall back to a hidden text box.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

export default function CopyAddress({ address, mapLink }: { address: string; mapLink: string }) {
  const [copied, setCopied] = useState<null | 'address' | 'link' | 'error'>(null);
  async function copy(kind: 'address' | 'link') {
    const ok = await copyText(kind === 'address' ? address : mapLink);
    setCopied(ok ? kind : 'error');
    window.setTimeout(() => setCopied(null), 2200);
  }
  const btn = 'inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-marigold hover:text-marigold';
  const icon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => copy('address')} className={btn} aria-live="polite">
        {icon}{copied === 'address' ? 'Address copied!' : 'Copy address'}
      </button>
      <button type="button" onClick={() => copy('link')} className={btn} aria-live="polite">
        {icon}{copied === 'link' ? 'Map link copied!' : 'Copy map link'}
      </button>
      {copied === 'error' && <span className="text-xs text-red-600">Couldn't copy. Press and hold the address to copy it.</span>}
    </div>
  );
}
