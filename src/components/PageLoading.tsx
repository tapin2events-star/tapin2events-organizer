// Shown for a moment while a page's code loads (the menu and top bar stay on screen).
export default function PageLoading() {
  return (
    <div className="mx-auto max-w-3xl py-4" role="status" aria-label="Loading">
      <div className="h-7 w-48 animate-pulse rounded-lg bg-gray-200/70" />
      <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-gray-200/60" />
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-200/50" />)}
      </div>
    </div>
  );
}
