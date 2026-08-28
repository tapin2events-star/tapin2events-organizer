import { useEffect, useState, useRef, type FormEvent, type ChangeEvent, type KeyboardEvent, type ClipboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, sendCode, verifyCode, signInWithPassword } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  // Once a session actually exists (password sign-in, OTP verify, or the
  // magic-link return), leave the login screen — this doesn't happen on
  // its own just because the session state changed underneath it.
  useEffect(() => {
    if (user) navigate('/organizer', { replace: true });
  }, [user, navigate]);

  async function handlePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await signInWithPassword(email, password);
    setBusy(false);
    if (error) setError('Incorrect email or password.');
  }

  const code = digits.join('');

  async function handleEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await sendCode(email);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    setStep('code');
    setTimeout(() => inputs.current[0]?.focus(), 50);
  }

  async function submitCode(fullCode: string) {
    setError(null);
    setBusy(true);
    const { error } = await verifyCode(email, fullCode);
    setBusy(false);
    if (error) {
      setError('That code didn\u2019t work. It may have expired \u2014 request a new one below.');
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    }
  }

  function setDigit(i: number, val: string) {
    const clean = val.replace(/\D/g, '');
    if (!clean) {
      setDigits((d) => d.map((x, j) => (j === i ? '' : x)));
      return;
    }
    setDigits((prev) => {
      const next = [...prev];
      for (let k = 0; k < clean.length && i + k < 6; k++) next[i + k] = clean[k];
      const filledTo = Math.min(i + clean.length, 5);
      setTimeout(() => inputs.current[filledTo]?.focus(), 0);
      const joined = next.join('');
      if (joined.length === 6) setTimeout(() => submitCode(joined), 0);
      return next;
    });
  }

  function onKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text) setDigit(0, text);
  }

  async function resend() {
    setError(null);
    setResent(false);
    setBusy(true);
    const { error } = await sendCode(email);
    setBusy(false);
    if (error) setError(error);
    else {
      setResent(true);
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    }
  }

  const fieldClass =
    'rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 outline-none placeholder:text-gray-400 focus-visible:border-marigold focus-visible:ring-1 focus-visible:ring-marigold';

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-900 mb-4">
            <span className="text-white font-bold text-xl">T</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">TapIN</h1>
          <p className="text-muted mt-1 text-sm">Organizer console</p>
        </div>

        <div className="bg-surface rounded-2xl shadow-sm border border-gray-200 p-8">
          {step === 'email' && (
            <form onSubmit={handleEmail} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Email
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={fieldClass}
                />
              </label>

              {error && <p className="text-sm text-magenta">{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="mt-2 h-11 rounded-lg bg-marigold px-4 text-sm font-medium text-white transition hover:bg-marigold/90 disabled:opacity-50"
              >
                {busy ? 'Sending\u2026' : 'Email me a sign-in code'}
              </button>
              <p className="text-center text-xs leading-relaxed text-muted">
                No password needed. We\u2019ll email a link and a 6-digit code \u2014 use whichever is handier.
                New here? Your account is created automatically.
              </p>
              <button
                type="button"
                onClick={() => { setStep('password'); setError(null); }}
                className="text-center text-xs text-gray-300 hover:text-muted"
              >
                Use a password instead
              </button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={handlePassword} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Email
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
                Password
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={fieldClass}
                />
              </label>

              {error && <p className="text-sm text-magenta">{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="mt-2 h-11 rounded-lg bg-marigold px-4 text-sm font-medium text-white transition hover:bg-marigold/90 disabled:opacity-50"
              >
                {busy ? 'Signing in\u2026' : 'Sign in'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('email'); setError(null); setPassword(''); }}
                className="text-center text-xs text-muted hover:text-gray-900"
              >
                &larr; Use email code instead
              </button>
            </form>
          )}

          {step === 'code' && (
            <div className="flex flex-col gap-5">
              <p className="text-center text-sm text-muted">
                We sent a code to{' '}
                <span className="text-gray-900 font-medium">{email}</span>. Enter it below, or tap the link in that
                same email.
              </p>

              <div className="flex justify-center gap-2" onPaste={onPaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputs.current[i] = el; }}
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => onKey(i, e)}
                    aria-label={`Digit ${i + 1}`}
                    className="h-14 w-11 rounded-lg border border-gray-300 bg-white text-center text-2xl font-semibold text-marigold outline-none focus-visible:border-marigold focus-visible:ring-1 focus-visible:ring-marigold"
                  />
                ))}
              </div>

              {error && <p className="text-center text-sm text-magenta">{error}</p>}
              {resent && <p className="text-center text-sm text-mint">New code sent.</p>}

              <button
                onClick={() => submitCode(code)}
                disabled={busy || code.length < 6}
                className="h-11 rounded-lg bg-marigold px-4 text-sm font-medium text-white transition hover:bg-marigold/90 disabled:opacity-50"
              >
                {busy ? 'Checking\u2026' : 'Sign in'}
              </button>

              <div className="flex items-center justify-between text-xs text-muted">
                <button onClick={() => { setStep('email'); setDigits(['', '', '', '', '', '']); setError(null); }} className="hover:text-gray-900">
                  &larr; Use a different email
                </button>
                <button onClick={resend} disabled={busy} className="hover:text-gray-900 disabled:opacity-50">
                  Resend code
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
