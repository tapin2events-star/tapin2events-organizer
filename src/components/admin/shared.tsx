import { useEffect, useState, type ReactNode } from 'react';
import { useEscapeKey } from '../../lib/useEscapeKey';

export type Notify = (kind: 'ok' | 'err', text: string) => void;

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

// Characters that would break a PostgREST or() filter (or act as wildcards) are dropped.
export function safeSearch(q: string): string {
  return q.replace(/[,()%*\\_"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export function fmtDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) });
}

export const PAGE_SIZE = 25;

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 placeholder:text-gray-400"
    />
  );
}

export function Chips<T extends string>({ options, value, onChange, counts }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; counts?: Partial<Record<T, number>> }) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${value === o.id ? 'bg-marigold text-white' : 'border border-gray-200 bg-white text-gray-700 hover:border-marigold'}`}
        >
          {o.label}
          {counts?.[o.id] != null && <span className={`ml-1.5 ${value === o.id ? 'text-white/80' : 'text-gray-400'}`}>{counts[o.id]}</span>}
        </button>
      ))}
    </div>
  );
}

export function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  if (total <= PAGE_SIZE) return total > 0 ? <p className="mt-4 text-center text-xs text-gray-400">{total} result{total === 1 ? '' : 's'}</p> : null;
  const btn = 'rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-marigold disabled:opacity-40';
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <button className={btn} disabled={page <= 0} onClick={() => onPage(page - 1)}>← Previous</button>
      <span className="text-center text-xs text-gray-500">Page {page + 1} of {pages} · {total} total</span>
      <button className={btn} disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Next →</button>
    </div>
  );
}

const TONES: Record<string, string> = {
  green: 'bg-green-100 text-green-800',
  orange: 'bg-orange-100 text-orange-800',
  red: 'bg-red-100 text-red-800',
  gray: 'bg-gray-100 text-gray-700',
  blue: 'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
};
export function Badge({ tone = 'gray', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

export const actionBtn = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-marigold hover:text-marigold disabled:opacity-50';
export const dangerBtn = 'rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50';

export function Row({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">{children}</div>;
}

export function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-gray-300 bg-white/60 py-10 text-center text-sm text-gray-500">{text}</p>;
}

function Overlay({ children, onClose, busy }: { children: ReactNode; onClose: () => void; busy?: boolean }) {
  useEscapeKey(() => !busy && onClose());
  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// A confirmation screen (instead of a browser popup), optionally asking for a reason.
export function ConfirmDialog({ title, body, confirmLabel, danger, askReason, onConfirm, onClose }: {
  title: string; body: ReactNode; confirmLabel: string; danger?: boolean; askReason?: string;
  onConfirm: (reason: string) => Promise<void>; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  async function go() {
    setBusy(true);
    await onConfirm(reason.trim());
    setBusy(false);
    onClose();
  }
  return (
    <Overlay onClose={onClose} busy={busy}>
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <div className="mt-2 text-sm text-gray-600">{body}</div>
      {askReason && (
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} placeholder={askReason}
          className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900" />
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={go} disabled={busy} className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-marigold hover:bg-marigold/90'}`}>
          {busy ? 'Working…' : confirmLabel}
        </button>
        <button onClick={onClose} disabled={busy} className={actionBtn}>Cancel</button>
      </div>
    </Overlay>
  );
}

export interface FormField { key: string; label: string; multiline?: boolean; number?: boolean }

export function FormDialog({ title, fields, initial, onSave, onClose }: {
  title: string; fields: FormField[]; initial: Record<string, string>;
  onSave: (values: Record<string, string>) => Promise<void>; onClose: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    await onSave(values);
    setBusy(false);
    onClose();
  }
  const input = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900';
  return (
    <Overlay onClose={onClose} busy={busy}>
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <div className="mt-3 flex flex-col gap-3">
        {fields.map((f) => (
          <label key={f.key} className="text-sm font-medium text-gray-700">
            {f.label}
            {f.multiline
              ? <textarea rows={4} className={input} value={values[f.key] ?? ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
              : <input type={f.number ? 'number' : 'text'} step={f.number ? '0.01' : undefined} className={input} value={values[f.key] ?? ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />}
          </label>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={save} disabled={busy} className="rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
        <button onClick={onClose} disabled={busy} className={actionBtn}>Cancel</button>
      </div>
    </Overlay>
  );
}
