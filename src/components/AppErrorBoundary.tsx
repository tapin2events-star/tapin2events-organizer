import { Component, type ErrorInfo, type ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';

// If a screen ever crashes, show a friendly message instead of a blank page. Never reloads by itself.
// The error is reported privately (page, error and device type; nothing personal) so it can be fixed, and a
// "Technical details" link shows the exact error (handy for screenshots).
interface State { failed: boolean; message: string | null; showDetails: boolean }
export default class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false, message: null, showDetails: false };
  static getDerivedStateFromError(error: unknown) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { failed: true, message };
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[TapIN] screen error', error);
    try {
      const e = error instanceof Error ? error : new Error(String(error));
      supabase.rpc('log_client_issue', {
        p_kind: 'app_crash',
        p_detail: { path: window.location.pathname + window.location.search, message: `${e.name}: ${e.message}`.slice(0, 400), stack: (e.stack ?? '').slice(0, 900), component: (info.componentStack ?? '').trim().slice(0, 600) },
        p_user_agent: navigator.userAgent,
      }).then(() => {}, () => {});
    } catch { /* never let reporting cause another crash */ }
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-4xl" aria-hidden="true">😕</p>
        <p className="mt-3 font-display text-xl font-bold text-bone">Something went wrong on this screen</p>
        <p className="mt-1 text-sm text-muted">Nothing you saved is lost. Try again, or go back.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={() => this.setState({ failed: false, showDetails: false })} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700">Try again</button>
          <button onClick={() => window.location.reload()} className="rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white">Reload</button>
        </div>
        {this.state.message && (
          <div className="mt-6">
            <button onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))} className="text-xs text-gray-400 underline">Technical details</button>
            {this.state.showDetails && <p className="mt-2 break-words rounded-lg bg-gray-50 p-2 text-left font-mono text-[11px] text-gray-600">{this.state.message}</p>}
          </div>
        )}
      </div>
    );
  }
}
