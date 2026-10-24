/** Keep iOS on the document-flow collection grid, including iPad desktop mode. */
export function needsNativeGrid(device:{userAgent:string;maxTouchPoints:number}) {
  return /iPhone|iPad|iPod/i.test(device.userAgent)||
    (/Macintosh/i.test(device.userAgent)&&device.maxTouchPoints>1);
}
