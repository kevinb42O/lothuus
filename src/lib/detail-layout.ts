/** Fit the photograph itself; text never stretches its frame out of proportion. */
export function detailLayout(ratio: number, viewport: { width: number; height: number }, photoOnly = false) {
  const aspect = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  const mobile = viewport.width <= 700;
  const available = Math.max(1, Math.min(1100, viewport.width - (mobile ? 24 : 48)));
  const availableHeight = Math.max(1, viewport.height - (mobile ? 24 : 48));
  if (photoOnly) {
    const width = Math.min(available, availableHeight * aspect);
    return { mode: 'photo' as const, width, photoWidth: width, photoHeight: width / aspect };
  }
  if (mobile || aspect >= 1.1) {
    const width = mobile ? available : Math.min(available, Math.max(240, viewport.height * .58) * aspect);
    return { mode: 'stacked' as const, width, photoWidth: width, photoHeight: width / aspect };
  }
  const photoWidth = Math.min(Math.max(1, available - 340), Math.min(720, availableHeight) * aspect);
  return { mode: 'split' as const, width: photoWidth + Math.min(480, available - photoWidth), photoWidth, photoHeight: photoWidth / aspect };
}
