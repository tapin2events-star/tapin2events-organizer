import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { reloadSetup } from '../../lib/setup';
import { applyTextSize, useDisplayPrefs, type TextSize } from '../../lib/display';

// Profile > Settings > Display & help: text size, Simple mode, and tutorials.
export default function DisplaySettings() {
  const { simple, textSize } = useDisplayPrefs();
  const [size, setSize] = useState<TextSize>(textSize);
  async function pickSize(v: TextSize) {
    setSize(v); applyTextSize(v);
    await supabase.rpc('set_display_prefs', { p_text_size: v, p_simple_mode: null });
    reloadSetup();
  }
  async function toggleSimple() {
    await supabase.rpc('set_display_prefs', { p_text_size: null, p_simple_mode: !simple });
    reloadSetup();
  }
  const opts: { v: TextSize; label: string; cls: string }[] = [
    { v: 'normal', label: 'Normal', cls: 'text-sm' }, { v: 'large', label: 'Large', cls: 'text-base' }, { v: 'xlarge', label: 'Extra large', cls: 'text-lg' },
  ];
  return (
    <div id="display" className="mt-6 scroll-mt-24 rounded-2xl border border-gray-200 bg-surface p-4">
      <h3 className="font-display text-lg font-bold text-bone">Display & help</h3>
      <p className="mt-3 text-sm font-medium text-gray-700">Text size</p>
      <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Text size">
        {opts.map((o) => (
          <button key={o.v} role="radio" aria-checked={size === o.v} onClick={() => pickSize(o.v)}
            className={`rounded-xl border-2 py-3 font-semibold ${o.cls} ${size === o.v ? 'border-marigold bg-white text-gray-900' : 'border-gray-200 bg-white text-gray-600'}`}>
            <span className="block" aria-hidden="true">Aa</span>{o.label}
          </button>
        ))}
      </div>
      <label className="mt-5 flex cursor-pointer items-start justify-between gap-4">
        <span><span className="block text-base font-semibold text-gray-900">Simple mode</span><span className="block text-sm text-gray-500">A shorter menu with just the essentials, and fewer extras on screens. Great if TapIN feels like a lot.</span></span>
        <button type="button" onClick={toggleSimple} role="switch" aria-checked={simple} aria-label="Simple mode" className={`relative mt-1 h-8 w-14 shrink-0 rounded-full transition ${simple ? 'bg-marigold' : 'bg-gray-300'}`}><span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${simple ? 'left-7' : 'left-1'}`} /></button>
      </label>
      <Link to="/tutorials" className="mt-5 flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-3 text-base font-semibold text-marigold"><span>📚 Step-by-step tutorials</span><span aria-hidden="true">›</span></Link>
    </div>
  );
}
