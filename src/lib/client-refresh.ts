// Refresh on an actual return to the page, coalescing focus + visibility events.
// A visible but idle tab has no permanent network timer.
export function observeFreshness(refresh: () => Promise<unknown>, lastLoaded: () => number, age = 60000) {
  let pending = false, disposed = false;
  const reveal = () => {
    if (disposed || document.hidden || pending || Date.now() - lastLoaded() < age) return;
    pending = true;
    void refresh().catch(() => undefined).finally(() => { pending = false; });
  };
  window.addEventListener('focus', reveal); window.addEventListener('online', reveal);
  document.addEventListener('visibilitychange', reveal);
  return () => { disposed = true; window.removeEventListener('focus', reveal); window.removeEventListener('online', reveal); document.removeEventListener('visibilitychange', reveal); };
}
