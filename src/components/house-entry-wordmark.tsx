'use client';

import { useLayoutEffect, useRef } from 'react';
import { HOUSE_ENTRY_WORDMARK as mark } from './house-entry-wordmark-data';

/** Loading identity only. The flight itself is rendered by the house camera. */
export function HouseEntryWordmark() {
  const viewport=useRef<SVGSVGElement>(null),glyphs=useRef<SVGGElement>(null);
  useLayoutEffect(()=>{
    const svg=viewport.current!,group=glyphs.current!;
    const resize=()=>{
      const {width,height}=svg.getBoundingClientRect();if(!width||!height)return;
      const scale=parseFloat(getComputedStyle(svg).fontSize)/mark.units;
      svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
      group.setAttribute('transform',`translate(${width/2-mark.width/2*scale} ${height/2-mark.height/2*scale}) scale(${scale})`);
    };
    const observer=new ResizeObserver(resize);observer.observe(svg);resize();
    return()=>observer.disconnect();
  },[]);
  return <svg ref={viewport} className="house-entry-wordmark" viewBox="0 0 1000 1000" role="img" aria-label="LOTHUUS" focusable="false">
    <g ref={glyphs} transform={`translate(${500-mark.width*.016} ${500-mark.height*.016}) scale(.032)`}>
      {mark.paths.map((path,index)=><path key={index} d={path}/>)}
    </g>
  </svg>;
}
