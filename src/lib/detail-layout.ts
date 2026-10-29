/** Use the available desktop screen while containing every complete photograph. */
export function detailLayout(ratio: number, viewport: { width: number; height: number }, photoOnly = false, chromeHeight = 0) {
  const aspect = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  const mobile = viewport.width <= 700;
  const inset = mobile ? 12 : Math.max(20, Math.min(64, viewport.width * .025));
  const available = Math.max(1, viewport.width - inset * 2);
  const verticalInset = mobile ? 12 : Math.max(16, Math.min(24, viewport.height * .025));
  const availableHeight = Math.max(1, viewport.height - verticalInset * 2);
  if (photoOnly) {
    const width = Math.min(available, availableHeight * aspect);
    return { mode: 'photo' as const, width, photoWidth: width, photoHeight: width / aspect };
  }
  if (mobile) {
    return { mode: 'stacked' as const, width: available, photoWidth: available, photoHeight: available / aspect };
  }
  const textWidth = Math.min(640, Math.max(340, available * .36));
  const maxPhotoHeight = Math.max(1, availableHeight - chromeHeight);
  const photoWidth = Math.min(Math.max(1, available - textWidth), maxPhotoHeight * aspect);
  const photoHeight = photoWidth / aspect;
  return { mode: 'split' as const, width: available, photoWidth, photoHeight };
}
