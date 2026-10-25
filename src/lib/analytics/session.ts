// No browser storage: this state lives only for the lifetime of the document.
export type VisitSession = { lastActivity: number; id: string; created: number; sent: boolean; attempts: number };
export const SESSION_GAP = 30 * 60000;
export function sessionForActivity(current: VisitSession | undefined, now: number, uuid: () => string): VisitSession {
  if (!current || now - current.lastActivity >= SESSION_GAP) return { lastActivity: now, id: uuid(), created: now, sent: false, attempts: 0 };
  current.lastActivity = now; return current;
}
