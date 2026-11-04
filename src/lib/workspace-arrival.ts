/** One opening per document; a return after 30 minutes away starts another visit.
 * No idle-time inference, periodic heartbeat or browser storage. */
export const workspaceReturnAfter = 30 * 60 * 1000;
type Arrival = { opened: boolean; awaySince: number | null };
const arrivals = new WeakMap<Document, Arrival>();
export function resetWorkspaceArrival(document: Document) {
  arrivals.delete(document);
}
export function observeWorkspaceArrival(
  document: Document,
  window: Pick<Window, "addEventListener" | "removeEventListener">,
  onArrival: () => void,
  now: () => number = Date.now,
) {
  const state = arrivals.get(document) || { opened: false, awaySince: null };
  arrivals.set(document, state);
  const away = () => {
    state.awaySince ??= now();
  };
  const visible = () => {
    if (document.hidden) {
      away();
      return;
    }
    const returned =
      state.awaySince !== null &&
      now() - state.awaySince >= workspaceReturnAfter;
    state.awaySince = null;
    if (!state.opened || returned) {
      state.opened = true;
      onArrival();
    }
  };
  document.addEventListener("visibilitychange", visible);
  window.addEventListener("pagehide", away);
  window.addEventListener("pageshow", visible);
  visible();
  return () => {
    document.removeEventListener("visibilitychange", visible);
    window.removeEventListener("pagehide", away);
    window.removeEventListener("pageshow", visible);
    away();
  };
}
