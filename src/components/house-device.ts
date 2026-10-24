/** iOS browser processes reload under this scene's workload, even without blur.
 * Select the photo entrance before importing Three or constructing the atlas.
 * iPadOS can identify itself as a Mac when requesting desktop websites.
 */
export function needsPhotoEntrance(device:{userAgent:string;maxTouchPoints:number}) {
  return /iPhone|iPad|iPod/i.test(device.userAgent)||
    (/Macintosh/i.test(device.userAgent)&&device.maxTouchPoints>1);
}
