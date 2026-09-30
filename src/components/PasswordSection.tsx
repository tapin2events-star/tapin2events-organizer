import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';

// Lets a signed-in person set a password (e.g. someone who came over from the
// old Base44 app, whose password didn't carry over) or change an existing one.
// If Supabase asks for extra confirmation, we email a 6-digit code first.
export default function PasswordSection({ email }: { email: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [code, setCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function friendly(message: string, code?: string): string {
    if (code === 'same_password' || /different from the old/i.test(message)) return "That's already your password. Choose a new one.";
    if (code === 'weak_password' || /weak|at least|characters/i.test(message)) return 'Please choose a stronger password: at least 8 characters, mixing letters and numbers.';
    if (/nonce|otp|expired|invalid/i.test(message)) return "That code didn't work. It may have expired. Tap \u201cSend a new code\u201d.";
    return "Couldn't save your password. Please try again.";
  }

  async function sendCode() {
    const { error: e } = await supabase.auth.reauthenticate();
    if (e) { setError("Couldn't send a code. Please try again in a minute."); return false; }
    setNeedsCode(true);
    return true;
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return setError('Mix letters and numbers so it\u2019s harder to guess.');
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser(needsCode ? { password, nonce: code.trim() } : { password });
    if (err) {
      const errCode = (err as { code?: string }).code;
      if (!needsCode && (errCode === 'reauthentication_needed' || /reauthenticat/i.test(err.message))) {
        await sendCode();
        setBusy(false);
        return;
      }
      setBusy(false);
      return setError(friendly(err.message, errCode));
    }
    setBusy(false);
    setDone(true);
    setPassword(''); setConfirm(''); setCode(''); setNeedsCode(false);
  }

  const input = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900';
  return (
    <div className="rounded-xl border border-gray-200 bg-surface px-4 py-4">
      {done ? (
        <div role="status">
          <p className="text-sm font-medium text-green-700">✓ Your password is saved.</p>
          <p className="mt-1 text-xs text-muted">Next time, choose <strong>Use a password instead</strong> on the sign-in screen and enter {email} with your new password. Email codes still work too.</p>
          <button type="button" onClick={() => setDone(false)} className="mt-2 text-xs font-medium text-marigold hover:underline">Change it again</button>
        </div>
      ) : (
        <form onSubmit={save} className="flex flex-col gap-3">
          <p className="text-xs text-muted">
            Set a password so you can sign in without waiting for an email code, or change the one you have.
            Coming from the old TapIN app? Your old password didn't carry over, so set a new one here.
          </p>
          <label className="text-sm font-medium text-gray-700">
            New password
            <input type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Confirm new password
            <input type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4 accent-marigold" /> Show passwords
          </label>
          {needsCode && (
            <label className="text-sm font-medium text-gray-700">
              6-digit code we just emailed to {email}
              <input inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className={input} />
              <button type="button" onClick={() => { setError(null); sendCode(); }} className="mt-1 text-xs font-medium text-marigold hover:underline">Send a new code</button>
            </label>
          )}
          {error && <p role="alert" className="text-sm text-magenta">{error}</p>}
          <button type="submit" disabled={busy || !password || !confirm || (needsCode && code.length < 6)} className="self-start rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-white hover:bg-marigold/90 disabled:opacity-50">
            {busy ? 'Saving\u2026' : needsCode ? 'Confirm & save password' : 'Save password'}
          </button>
        </form>
      )}
    </div>
  );
}
