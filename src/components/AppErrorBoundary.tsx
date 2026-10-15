import { Component, type ReactNode } from 'react';

// If a screen ever crashes, show a friendly message instead of a blank page. Never reloads by itself.
export default class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error('[TapIN] screen error', error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-4xl" aria-hidden="true">😕</p>
        <p className="mt-3 font-display text-xl font-bold text-bone">Something went wrong on this screen</p>
        <p className="mt-1 text-sm text-muted">Nothing you saved is lost. Try again, or go back.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={() => this.setState({ failed: false })} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700">Try again</button>
          <button onClick={() => window.location.reload()} className="rounded-xl bg-marigold px-4 py-2.5 text-sm font-semibold text-white">Reload</button>
        </div>
      </div>
    );
  }
}
