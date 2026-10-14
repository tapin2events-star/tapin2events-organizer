import { useState } from 'react';
import { Link } from 'react-router-dom';

// Marks a Business plan feature during early access: free now, part of the paid plan later.
// Tap the badge to see what that means (and a link to the plan page).
export default function PremiumBadge({ note = true }: { note?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-flex flex-col align-middle">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#C9A227]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8A6D0F]">
        ⭐ Business plan · free for now
      </button>
      {note && open && (
        <span className="mt-1.5 block max-w-xs rounded-xl border border-[#C9A227]/40 bg-white p-2.5 text-left text-xs font-normal normal-case tracking-normal text-gray-700 shadow-sm">
          This is a <strong>Business plan feature</strong>, free during early access. When the Business plan launches it will require a paid plan, so you'll need the plan to keep using it.{' '}
          <Link to="/business/plan" className="font-semibold text-[#8A6D0F] underline">See plans and founding pricing</Link>
        </span>
      )}
    </span>
  );
}

// A one-line notice under a premium section's heading.
export function PremiumNotice({ feature }: { feature: string }) {
  return (
    <p className="mt-1 rounded-lg bg-[#C9A227]/10 px-2.5 py-1.5 text-xs text-[#6B5409]">
      ⭐ {feature} is a <strong>Business plan feature</strong>, free during early access. After the Business plan launches, it will require a paid plan. <Link to="/business/plan" className="font-semibold underline">Learn more</Link>
    </p>
  );
}
