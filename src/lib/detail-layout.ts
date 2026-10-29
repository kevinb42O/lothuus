/** Fit each complete photo at its natural ratio beside a readable desktop text column. */
export function detailLayout(ratio: number, viewport: { width: number; height: number }, photoOnly = false, chromeHeight = 0) {
  const aspect = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  const mobile = viewport.width <= 700;
  const available = Math.max(1, Math.min(1060, viewport.width - (mobile ? 24 : 48)));
  const availableHeight = Math.max(1, viewport.height - (mobile ? 24 : 48));
  if (photoOnly) {
    const width = Math.min(available, availableHeight * aspect);
    return { mode: 'photo' as const, width, photoWidth: width, photoHeight: width / aspect };
  }
  if (mobile) {
    return { mode: 'stacked' as const, width: available, photoWidth: available, photoHeight: available / aspect };
  }
  const textWidth = Math.min(440, Math.max(340, available * .42));
  const photoWidth = Math.min(Math.max(1, available - textWidth), Math.max(1, Math.min(720, availableHeight - chromeHeight)) * aspect);
  return { mode: 'split' as const, width: photoWidth + textWidth, photoWidth, photoHeight: photoWidth / aspect };
}
