/** Local persistent Node server: process deadlines even with no dashboard open. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { transact } = await import('./lib/backend/repository');
  const scope = globalThis as typeof globalThis & { lothuusDeadlineTimer?: ReturnType<typeof setInterval> };
  if (!scope.lothuusDeadlineTimer) {
    scope.lothuusDeadlineTimer = setInterval(() => {
      try { transact(() => undefined); } catch { console.error('LOTHUUS: betaaltermijnen konden niet worden bijgewerkt.'); }
    }, 60_000);
    scope.lothuusDeadlineTimer.unref();
  }
}
