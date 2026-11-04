"use client";
import {
  usageActions,
  type UsageAction,
  type UsageEvent,
  type UsageSection,
} from "./admin-usage";
let queue: UsageEvent[] = [],
  timer: ReturnType<typeof setTimeout> | undefined,
  inflight = false;
const MAX_QUEUE = 30;
export function trackAdminUsage(
  action: UsageAction,
  section: UsageSection = "hosting",
  product?: UsageEvent["product"],
) {
  if (typeof window === "undefined" || !Object.hasOwn(usageActions, action))
    return;
  queue.push({
    id: crypto.randomUUID(),
    action,
    section,
    ...(product ? { product } : {}),
  });
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  if (queue.length >= 10) void flushAdminUsage();
  else if (!timer) timer = setTimeout(() => void flushAdminUsage(), 1500);
}
export async function flushAdminUsage() {
  clearTimeout(timer);
  timer = undefined;
  if (inflight || !queue.length) return;
  const batch = queue.splice(0, 20);
  inflight = true;
  try {
    await fetch("/api/admin/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      cache: "no-store",
      keepalive: true,
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    /* Telemetry never interrupts editing; no persisted retry or sensitive browser storage. */
  } finally {
    inflight = false;
    if (queue.length && !timer)
      timer = setTimeout(() => void flushAdminUsage(), 1500);
  }
}
