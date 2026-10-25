export type OperationsReport = {
  backup: { status: 'ready' | 'error' | 'running' | 'unavailable'; lastSuccess: string | null };
  supabase: { status: 'ready' | 'error' | 'running' | 'unavailable'; value: number | null; limit: number; measuredAt: string | null; periodStart?: string; periodEnd?: string; level?: 'normal' | 'warning' | 'danger' };
};
