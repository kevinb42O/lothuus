import type { HostingPlan } from './catalogue';

export function hasExtendedAnalytics(plan: HostingPlan | undefined) {
  return plan === 'pro' || plan === 'premium';
}
