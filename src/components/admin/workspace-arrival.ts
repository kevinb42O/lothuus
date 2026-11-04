"use client";
import { useEffect } from "react";
import {
  observeWorkspaceArrival,
  resetWorkspaceArrival,
} from "@/lib/workspace-arrival";
import { trackAdminUsage, flushAdminUsage } from "@/lib/admin-usage-client";
export function useWorkspaceArrival(authenticated: boolean | null) {
  useEffect(() => {
    if (!authenticated) {
      resetWorkspaceArrival(document);
      return;
    }
    return observeWorkspaceArrival(document, window, () => {
      trackAdminUsage("workspace_open", "overview");
      void flushAdminUsage();
    });
  }, [authenticated]);
}
