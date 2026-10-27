import { collectionPlaneScale, houseEntryYaw, houseEntryFraming, sampleHouseEntry } from '@/components/house-entry';

export const ENTRY_VIDEO_SIZE = { desktop: { width: 1920, height: 1200 }, mobile: { width: 720, height: 1560 } } as const;

/** Project the live collection through the recorded camera, without loading Three.js. */
export function entryVideoProjection(progress: number, width: number, height: number, source: { width: number; height: number }) {
  const pose = sampleHouseEntry(progress);
  const { fov, yaw: initialYaw } = houseEntryFraming(source.width, source.height);
  const yaw = houseEntryYaw(progress, initialYaw);
  const fx = Math.tan(yaw), fy = Math.tan(pose.tilt * Math.PI / 180);
  const length = Math.hypot(fx, fy, 1), horizontal = Math.hypot(fx, 1);
  const rightX = 1 / horizontal, rightZ = fx / horizontal;
  const forwardX = fx / length, forwardY = fy / length, forwardZ = -1 / length;
  const upY = rightZ * forwardX - rightX * forwardZ, upZ = rightX * forwardY;
  const dy = 2.03 - pose.y, dz = -6 - pose.z;
  const depth = dy * forwardY + dz * forwardZ;
  const tangent = Math.tan(fov * Math.PI / 360);
  const cover = Math.max(width / source.width, height / source.height);
  return {
    x: dz * rightZ / (depth * tangent) * source.height / 2 * cover,
    y: -(dy * upY + dz * upZ) / (depth * tangent) * source.height / 2 * cover,
    scale: collectionPlaneScale(pose.z, fov, fov),
  };
}

export function entryVideoSource(device: { userAgent: string; maxTouchPoints: number }, mobile: boolean) {
  const appleBrowser = /iPhone|iPad|iPod/i.test(device.userAgent) ||
    (/Macintosh/i.test(device.userAgent) && device.maxTouchPoints > 1) ||
    (/Safari/i.test(device.userAgent) && !/Chrome|Chromium|CriOS|Edg|OPR|Android/i.test(device.userAgent));
  return `/house/video/entrance-${mobile ? 'mobile' : 'desktop'}.${appleBrowser ? 'mov' : 'webm'}`;
}
