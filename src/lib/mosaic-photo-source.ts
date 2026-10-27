import { photoVariant } from './collection';

/** API variants bypass Next's optimizer, so sizes alone cannot select their resolution. */
export function mosaicPhotoSource(src: string, width: number, pixelRatio = 1) {
  const required = Math.max(1, width) * Math.max(1, Math.min(2, pixelRatio));
  const sourceWidth = required <= 320 ? 320 : 800;
  return { src: photoVariant(src, sourceWidth === 320 ? 'thumb' : 'grid'), sourceWidth };
}

/** A failed or stalled source must not hold a filter transition indefinitely. */
export async function settlePhotoPreparation(tasks: Promise<unknown>[], deadline = 2500) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.allSettled(tasks),
      new Promise<void>(resolve => { timer = setTimeout(resolve, deadline); }),
    ]);
  } finally { clearTimeout(timer); }
}
