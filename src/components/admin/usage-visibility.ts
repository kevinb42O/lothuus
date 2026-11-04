"use client";
import { useEffect, useRef } from "react";
import { trackAdminUsage } from "@/lib/admin-usage-client";
import type { UsageAction } from "@/lib/admin-usage";
// Count interest only after at least 25% of a named area was visible for two
// continuous seconds, while the document was in the foreground.
export function useHostingVisibility(ready: boolean) {
  const recorded = useRef(new Set<string>());
  useEffect(() => {
    if (!ready || typeof IntersectionObserver === "undefined") return;
    const timers = new Map<Element, ReturnType<typeof setTimeout>>(),
      visible = new Map<Element, boolean>();
    const clear = (element: Element) => {
      const timer = timers.get(element);
      if (timer) clearTimeout(timer);
      timers.delete(element);
    };
    const schedule = (element: Element) => {
      const action = element.getAttribute("data-usage-visibility");
      if (
        !action ||
        recorded.current.has(action) ||
        document.hidden ||
        !visible.get(element) ||
        timers.has(element)
      )
        return;
      timers.set(
        element,
        setTimeout(() => {
          timers.delete(element);
          if (
            document.hidden ||
            !visible.get(element) ||
            recorded.current.has(action)
          )
            return;
          recorded.current.add(action);
          trackAdminUsage(action as UsageAction);
        }, 2000),
      );
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible.set(
            entry.target,
            entry.isIntersecting && entry.intersectionRatio >= 0.25,
          );
          if (visible.get(entry.target)) schedule(entry.target);
          else clear(entry.target);
        }
      },
      { threshold: [0, 0.25] },
    );
    document
      .querySelectorAll("[data-usage-visibility]")
      .forEach((element) => observer.observe(element));
    const visibility = () => {
      for (const element of visible.keys()) {
        clear(element);
        if (!document.hidden) schedule(element);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer.disconnect();
      for (const element of timers.keys()) clear(element);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [ready]);
}
