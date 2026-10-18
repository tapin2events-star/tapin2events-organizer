import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { WhiteLabelBrand } from '../lib/whiteLabel';

// White-labeled events: sign in (or create an account) right on the event page, in the organization's colors.
// Just an email and a 6-digit code; a TapIN account is created quietly so tickets, QR codes and transfers work.
export default function BrandedSignIn({ brand, onClose, onDone }: { brand: WhiteLabelBrand; onClose: () => void; onDone: () => void }) {
  const { sendCode, verifyCode, user } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (user) onDone(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, []);
  async function send() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Enter your email address.');
    setBusy(true); setErr(null);
    const { error } = await sendCode(email);
    setBusy(false);
    if (error) return setErr(error);
    setStep('code'); setTimeout(() => codeRef.current?.focus(), 100);
  }
  async function verify() {
    if (code.trim().length < 6) return setErr('Enter the 6-digit code from your email.');
    setBusy(true); setErr(null);
    const { error } = await verifyCode(email, code);
    setBusy(false);
    if (error) return setErr(error);
  }
  return (
    <div className="fixed inset-0 z-[1500] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose} role="dialog" aria-label="Get your tickets">
      <div className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ background: brand.primary }}>
          <span className="flex min-w-0 items-center gap-3">
            {brand.logo && <img src={brand.logo} alt="" className="h-9 w-9 rounded-lg bg-white object-contain p-0.5" />}
            <span className="truncate text-base font-bold text-white">{brand.name}</span>
          </span>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 text-2xl leading-none text-white/80">×</button>
        </div>
        <div className="p-5">
          {step === 'email' ? (
            <>
              <p className="text-xl font-bold text-gray-900">Get your tickets</p>
              <p className="mt-1 text-sm text-gray-600">Enter your email. We'll send a 6-digit code to confirm it's you, and your tickets will go to this address.</p>
              <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} type="email" autoComplete="email" inputMode="email" placeholder="you@email.com" aria-label="Email" autoFocus
                className="mt-4 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3.5 text-base text-gray-900" />
              {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
              <button onClick={send} disabled={busy} className="mt-4 w-full rounded-xl py-3.5 text-base font-bold text-white disabled:opacity-60" style={{ background: brand.primary }}>{busy ? 'Sending…' : 'Continue'}</button>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-gray-900">Check your email</p>
              <p className="mt-1 text-sm text-gray-600">We sent a 6-digit code to <strong>{email.trim()}</strong>. It can take a minute; check spam if you don't see it.</p>
              <input ref={codeRef} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={(e) => e.key === 'Enter' && verify()} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" aria-label="6-digit code"
                className="mt-4 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3.5 text-center text-2xl font-bold tracking-[0.4em] text-gray-900" />
              {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
              <button onClick={verify} disabled={busy} className="mt-4 w-full rounded-xl py-3.5 text-base font-bold text-white disabled:opacity-60" style={{ background: brand.primary }}>{busy ? 'Checking…' : 'Continue to tickets'}</button>
              <button onClick={() => { setStep('email'); setCode(''); setErr(null); }} className="mt-3 w-full text-sm font-medium text-gray-500">Use a different email</button>
            </>
          )}
          <p className="mt-5 text-center text-[11px] text-gray-400">By continuing you agree to the <a href="/terms" target="_blank" rel="noopener" className="underline">Terms</a> and <a href="/privacy" target="_blank" rel="noopener" className="underline">Privacy Policy</a>.</p>
        </div>
      </div>
    </div>
  );
}
