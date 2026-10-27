'use client';

import Image, { getImageProps } from 'next/image';
import { useEffect, useState } from 'react';
import { mosaicPhotoSource } from '@/lib/mosaic-photo-source';
import type { CollectionObject } from '@/lib/collection';

export function mosaicPhotoProps(object: CollectionObject, width: number) {
  const source = mosaicPhotoSource(object.image, width, typeof window === 'undefined' ? 1 : window.devicePixelRatio);
  return { src: source.src, alt: object.title, fill: true as const, sizes: `${Math.ceil(width)}px`,
    unoptimized: object.image.startsWith('/api/'), 'data-source-width': object.image.startsWith('/api/') ? source.sourceWidth : undefined };
}

export async function prepareMosaicPhoto(object: CollectionObject, width: number) {
  const { props } = getImageProps(mosaicPhotoProps(object, width));
  const image = new window.Image();
  if (props.sizes) image.sizes = props.sizes;
  if (props.srcSet) image.srcset = props.srcSet;
  image.src = props.src;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([image.decode(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Photo decode timed out')), 8000);
    })]);
  } finally { clearTimeout(timer); }
  return image;
}

/** Retain the painted source while a photo upgrades for a larger footprint. */
export function MosaicPhoto({ object, width }: { object: CollectionObject; width: number }) {
  const desired = mosaicPhotoProps(object, width);
  const [painted, setPainted] = useState(desired);
  useEffect(() => {
    if (painted.src === desired.src && painted.sizes === desired.sizes) return;
    let cancelled = false;
    void prepareMosaicPhoto(object, width).then(() => {
      if (!cancelled) setPainted(desired);
    }).catch(() => { /* Keep the already painted photo if its replacement fails. */ });
    return () => { cancelled = true; };
  }, [object, width, desired.src, desired.sizes, painted.src, painted.sizes]);
  return <Image {...painted} alt={object.title} loading="eager" draggable={false} />;
}
