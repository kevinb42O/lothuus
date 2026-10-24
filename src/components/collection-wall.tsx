'use client';

import { motion } from 'motion/react';
import { ArrowUpRight, Heart } from 'lucide-react';
import { forwardRef, type CSSProperties } from 'react';

type Photograph = { src: string; x: number; y: number; width: number; height: number; photoHeight: number; title: string; category: string; captionOpacity: number; opacity: number; zIndex: number; saved: boolean; stock: string };
export type CapturedWall = {
  top: number; height: number; photographs: Photograph[];
  previous?: { wall: CapturedWall; clip: string };
};

/** Capture the painted positions, including an interrupted hover or previous reveal. */
export function captureWall(grid: HTMLDivElement, previous?: CapturedWall | null, previousElement?: HTMLDivElement | null): CapturedWall {
  const bounds = grid.getBoundingClientRect();
  const top = Math.max(0, -bounds.top - 240);
  const height = Math.max(0, Math.min(bounds.height - top, window.innerHeight + 480));
  const photographs = Array.from(grid.querySelectorAll<HTMLElement>('[data-id]')).flatMap(tile => {
    const rect = tile.getBoundingClientRect();
    const photo = tile.querySelector<HTMLImageElement>('img');
    if (!photo || rect.bottom < -240 || rect.top > window.innerHeight + 240) return [];
    const image = tile.querySelector('.object-photograph')!.getBoundingClientRect();
    const caption = tile.querySelector<HTMLElement>('.fluid-caption');
    const painted = getComputedStyle(tile);
    return [{ src: photo.currentSrc || photo.src, x: rect.left - bounds.left, y: rect.top - bounds.top - top,
      width: rect.width, height: rect.height, photoHeight: image.height,
      title: tile.querySelector('.object-title')?.textContent || '', category: tile.querySelector('.object-category')?.textContent || '',
      captionOpacity: caption ? Number(getComputedStyle(caption).opacity) : 0,
      opacity: Number(painted.opacity), zIndex: Number(painted.zIndex) || 0, saved: !!tile.querySelector('.saved-marker'), stock: tile.querySelector('.stock-badge')?.textContent || '' }];
  });
  return { top, height, photographs, previous: previous && previousElement
    ? { wall: previous, clip: getComputedStyle(previousElement).clipPath } : undefined };
}

function WallContent({ wall }: { wall: CapturedWall }) {
  return <>
    {wall.photographs.map((photo, index) => <div className="wall-photograph" key={index} style={{ left: photo.x, top: photo.y, width: photo.width, height: photo.height, opacity: photo.opacity, zIndex: photo.zIndex }}>
      <img src={photo.src} alt="" draggable={false} style={{ height: photo.photoHeight }} />
      {photo.saved && <span className="heart-button grid-heart is-selected"><span className="heart-glyph"><Heart className="heart-contrast" size={22} fill="none" strokeWidth={5} /><Heart size={22} fill="currentColor" strokeWidth={2} /></span></span>}{photo.stock && <span className="stock-badge" style={{ bottom: photo.height - photo.photoHeight + 9 }}>{photo.stock}</span>}
      {photo.captionOpacity > 0 && <span className="fluid-caption" style={{ opacity: photo.captionOpacity }}><span><span className="object-category">{photo.category}</span><strong className="object-title">{photo.title}</strong></span><ArrowUpRight size={19} strokeWidth={1.3} /></span>}
    </div>)}
    {wall.previous && <div className="collection-wall" style={{ top: wall.previous.wall.top - wall.top, height: wall.previous.wall.height, clipPath: wall.previous.clip }}><WallContent wall={wall.previous.wall} /></div>}
  </>;
}

export const CollectionWall = forwardRef<HTMLDivElement, { wall: CapturedWall; direction: -1 | 1; onComplete: () => void }>(function CollectionWall({ wall, direction, onComplete }, ref) {
  return <motion.div ref={ref} className="collection-wall" aria-hidden="true" inert
    style={{ top: wall.top, height: wall.height } as CSSProperties}
    initial={{ clipPath: 'inset(0% 0% 0% 0%)' }}
    animate={{ clipPath: direction === 1 ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)' }}
    transition={{ duration: .68, ease: [.65, 0, .2, 1] }} onAnimationComplete={onComplete}>
    <WallContent wall={wall} />
  </motion.div>;
});
