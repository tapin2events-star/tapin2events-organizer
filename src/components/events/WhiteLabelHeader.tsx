import type { WhiteLabelBrand } from '../../lib/whiteLabel';

// The organization's own header on white-labeled pages (replaces TapIN's top bar).
export default function WhiteLabelHeader({ brand }: { brand: WhiteLabelBrand }) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl px-4 py-3 text-white" style={{ background: `linear-gradient(135deg, ${brand.primary}, ${brand.accent})` }}>
      {brand.logo ? <img src={brand.logo} alt="" className="h-10 w-10 rounded-xl bg-white object-contain p-0.5" /> : <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-lg font-extrabold">{brand.name.charAt(0)}</span>}
      <span className="font-display text-lg font-extrabold">{brand.name}</span>
    </div>
  );
}
