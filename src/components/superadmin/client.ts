"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  body?: unknown,
  method?: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/superadmin/${path}`, {
    method: method || (body ? "POST" : "GET"),
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok) {
    if (
      !path.startsWith("session") &&
      [401, 403].includes(response.status) &&
      typeof window !== "undefined"
    )
      window.dispatchEvent(new window.Event("operator-session-expired"));
    throw new RequestError(
      data.error || "De verbinding is onderbroken. Probeer opnieuw.",
      response.status,
    );
  }
  return data;
}
export function useData<T>(path: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const id = ++generation.current,
      controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    void request<T>(path, undefined, undefined, controller.signal)
      .then((result) => {
        if (id === generation.current && !controller.signal.aborted)
          setData(result);
      })
      .catch((e) => {
        if (id === generation.current && !controller.signal.aborted)
          setError((e as Error).message);
      })
      .finally(() => {
        if (id === generation.current && !controller.signal.aborted)
          setLoading(false);
      });
    return () => {
      controller.abort();
      ++generation.current;
    };
  }, [path, revision]);
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  return { data, error, loading, reload };
}
export async function exportData(
  kind: "collection" | "activity",
  filters = "",
) {
  const response = await fetch("/api/superadmin/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, filters }),
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Exporteren is niet gelukt.");
  }
  const blob = await response.blob(),
    url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = `lothuus-${kind === "collection" ? "collectie" : "activiteiten"}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return {
    count: Number(response.headers.get("X-Export-Rows")),
    total: Number(response.headers.get("X-Export-Total")),
  };
}

export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const beforeNavigate = (event: Event) => {
      if (
        !window.confirm(
          "Je hebt nog niet opgeslagen wijzigingen. Wil je deze invoer verlaten?",
        )
      )
        event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("operator-before-navigate", beforeNavigate);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("operator-before-navigate", beforeNavigate);
    };
  }, [dirty]);
}
