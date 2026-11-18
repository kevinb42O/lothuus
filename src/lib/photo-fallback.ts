/** Retry the established same-origin transport once if direct R2 delivery fails. */
export function retryPhotoViaServer(image: HTMLImageElement) {
  const url = new URL(image.src, window.location.href);
  if (url.origin !== window.location.origin || !/^\/api\/(?:collection-images|images)\//.test(url.pathname) || url.searchParams.get('delivery') === 'proxy') return false;
  url.searchParams.set('delivery', 'proxy');
  image.src = url.href;
  return true;
}
