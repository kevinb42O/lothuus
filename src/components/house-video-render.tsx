'use client';

import { useEffect, useRef, useState } from 'react';
import { houseEntryTiming, HOUSE_ENTRY_DURATION } from './house-entry';
import { ENTRY_VIDEO_SIZE } from '@/lib/entry-video';
import type { HouseCollectionProjection } from './house-scene';

declare global {
  interface Window {
    renderIntroFrames?: (start: number, end: number) => Promise<{ frames: number; projections: HouseCollectionProjection[] }>;
  }
}

/** Development-only, deterministic offline renderer; never used by the homepage. */
export function HouseVideoRender() {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Preparing the scene…');
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const variant = new URLSearchParams(location.search).get('variant') === 'mobile' ? 'mobile' : 'desktop';
    setMobile(variant === 'mobile');
    const element = host.current!;
    const size = ENTRY_VIDEO_SIZE[variant];
    element.style.width = `${size.width}px`;
    element.style.height = `${size.height}px`;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    let projection: HouseCollectionProjection = { x: 0, y: 0, scale: 1 };
    import('./house-scene').then(module => module.mountHouse(element, undefined, {
      mode: 'hero', capture: true, captureScale: 1.5,
      onProgress: (_progress, next) => { if (next) projection = next; },
    })).then(scene => {
      if (cancelled) { scene.dispose(); return; }
      dispose = scene.dispose;
      window.renderIntroFrames = async (start, end) => {
        const projections: HouseCollectionProjection[] = [];
        for (let frame = start; frame < end; frame++) {
          const canvas = scene.capture!(houseEntryTiming(frame / (60 * HOUSE_ENTRY_DURATION)), frame / 60);
          projections.push({ ...projection });
          const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Frame capture failed')), 'image/png'));
          const response = await fetch(`/api/intro-render?variant=${variant}&frame=${frame}`, { method: 'POST', body: blob });
          if (!response.ok) throw new Error(`Frame ${frame}: ${response.status}`);
        }
        return { frames: end - start, projections };
      };
      setStatus('Ready to render');
    }).catch(error => setStatus(String(error)));
    return () => { cancelled = true; delete window.renderIntroFrames; dispose?.(); };
  }, []);
  return <main style={{ maxWidth: 'none', margin: 0, padding: 0 }}>
    <div ref={host} style={{ width: mobile ? ENTRY_VIDEO_SIZE.mobile.width : ENTRY_VIDEO_SIZE.desktop.width, height: mobile ? ENTRY_VIDEO_SIZE.mobile.height : ENTRY_VIDEO_SIZE.desktop.height }} />
    <p role="status">{status}</p>
  </main>;
}
