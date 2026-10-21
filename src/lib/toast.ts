// App-wide confirmation pop-ups ("✓ Saved"), shown near the bottom of the screen wherever the person is scrolled.
export type ToastKind = 'success' | 'error';
export function toast(text: string, kind: ToastKind = 'success') {
  window.dispatchEvent(new CustomEvent('tapin-toast', { detail: { text, kind } }));
}
export const toastSaved = (what?: string) => toast(what ? `✓ ${what} saved` : '✓ Changes saved');
export const toastError = (text = "Couldn't save. Please try again.") => toast(text, 'error');
