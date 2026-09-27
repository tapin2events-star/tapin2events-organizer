import { Link } from 'react-router-dom';

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="font-display text-lg font-bold text-gray-900">{title}</h2>
      <div className="mt-1.5 flex flex-col gap-2 text-sm leading-relaxed text-gray-700 [&_a]:font-medium [&_a]:text-marigold [&_a:hover]:underline [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1">{children}</div>
    </section>
  );
}

export function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl pb-10">
      <h1 className="font-display text-3xl font-extrabold text-bone">{title}</h1>
      <p className="mt-1 text-sm text-muted">Effective {updated}</p>
      <div className="mt-4 text-sm leading-relaxed text-gray-700">{intro}</div>
      {children}
      <p className="mt-10 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-200 pt-4 text-sm">
        <Link to="/terms" className="font-medium text-marigold hover:underline">Terms of Service</Link>
        <Link to="/privacy" className="font-medium text-marigold hover:underline">Privacy Policy</Link>
        <Link to="/refund-policy" className="font-medium text-marigold hover:underline">Refund Policy</Link>
      </p>
    </div>
  );
}

export const LEGAL_EFFECTIVE = 'September 27, 2026';
export const CONTACT_EMAIL = 'tapin2events@gmail.com';
