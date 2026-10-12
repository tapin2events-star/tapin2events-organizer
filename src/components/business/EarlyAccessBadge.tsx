// Marks features that will be part of the Business plan, free while TapIN for Business is in early access.
export default function EarlyAccessBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full bg-[#C9A227]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8a6d12] ${className}`}
      title="This will be part of the Business plan. It's free for everyone during early access.">
      Business plan · free during early access
    </span>
  );
}
