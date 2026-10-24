/** Smallest document movement that exposes the card, including its caption.
 * If a very short viewport cannot fit it, the caption takes priority.
 */
export function mosaicRevealDelta(top: number, height: number, viewportTop: number, viewportBottom: number) {
  if (top + height > viewportBottom) return top + height - viewportBottom;
  if (top < viewportTop && height <= viewportBottom - viewportTop) return top - viewportTop;
  return 0;
}
