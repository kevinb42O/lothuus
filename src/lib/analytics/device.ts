import type { Device } from './types';
export function deviceType(agent: string): Device {
  if (!agent || agent.length > 2048) return 'unknown';
  if (/ipad|tablet|kindle|silk|playbook|android(?!.*mobile)/i.test(agent)) return 'tablet';
  if (/mobi|iphone|ipod|windows phone/i.test(agent)) return 'mobile';
  if (/windows nt|macintosh|x11|cros/i.test(agent)) return 'desktop';
  return 'unknown';
}
export const automated = (agent: string) => /bot\b|crawler|spider|headless|lighthouse|facebookexternalhit|preview|curl\//i.test(agent);
