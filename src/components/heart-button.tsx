'use client';

import { Heart } from 'lucide-react';
import { useEffect, useRef, type ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean; size?: number };

/** Animate the shared selection state, including changes made by the text action. */
export function HeartButton({ selected, size = 26, className = '', ...props }: Props) {
  const glyph = useRef<HTMLSpanElement>(null);
  const previous = useRef(selected);
  useEffect(() => {
    if (previous.current === selected) return;
    previous.current = selected;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = glyph.current?.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(.78)', offset: .18 },
      { transform: `scale(${selected ? '1.3' : '1.12'})`, offset: .48 },
      { transform: 'scale(.96)', offset: .75 },
      { transform: 'scale(1)' },
    ], { duration: selected ? 380 : 280, easing: 'cubic-bezier(.2,.7,.3,1)' });
    return () => animation?.cancel();
  }, [selected]);
  return <button {...props} type="button" className={`heart-button ${className} ${selected ? 'is-selected' : ''}`} aria-pressed={selected}>
    <span className="heart-glyph" ref={glyph} aria-hidden="true">
      <Heart className="heart-contrast" size={size} fill="none" strokeWidth={5} />
      <Heart size={size} fill={selected ? 'currentColor' : 'none'} strokeWidth={2} />
    </span>
  </button>;
}
