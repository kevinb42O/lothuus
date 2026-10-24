'use client';

import { useEffect, useState, type RefObject } from 'react';

/** Native lazy loading delays requests but leaves every visited image mounted.
 * Keep image elements only around the viewport so offscreen decoded images and
 * compositor surfaces can be released. The tiles themselves retain layout/focus.
 */
export function useVisibleMosaicPhotos(grid:RefObject<HTMLDivElement|null>,revision:string) {
  const [visible,setVisible]=useState<ReadonlySet<string>>(()=>new Set());
  useEffect(()=>{
    const element=grid.current;if(!element)return;
    let active=true;
    const entrance=element.closest('.house-entry-experience');
    const inFlight=()=>!!entrance?.classList.contains('house-entry-pinned')&&!entrance.classList.contains('house-entry-arrived');
    const observer=new IntersectionObserver(entries=>{
      if(!active||inFlight())return;
      setVisible(previous=>{
        const next=new Set(previous);
        for(const entry of entries){
          const id=(entry.target as HTMLElement).dataset.id;
          if(!id)continue;
          if(entry.isIntersecting)next.add(id);else next.delete(id);
        }
        return next.size===previous.size&&[...next].every(id=>previous.has(id))?previous:next;
      });
    },{rootMargin:'240px 0px'});
    const tiles=element.querySelectorAll<HTMLElement>('[data-id][data-present="true"]');
    const current=new Set(Array.from(tiles,tile=>tile.dataset.id!));
    setVisible(previous=>new Set([...previous].filter(id=>current.has(id))));
    const synchronize=()=>{
      observer.disconnect();
      if(inFlight()){
        // The atlas uses eight rows. Keep their sources stable while projection
        // moves the grid through observer boundaries; never load all 195 photos.
        const columns=Math.max(0,...Array.from(tiles,tile=>Number(tile.dataset.column)||0))+1;
        setVisible(new Set(Array.from(tiles).slice(0,columns*8).map(tile=>tile.dataset.id!)));
      }else tiles.forEach(tile=>observer.observe(tile));
    };
    const phase=new MutationObserver(synchronize);
    if(entrance)phase.observe(entrance,{attributes:true,attributeFilter:['class']});
    synchronize();
    return()=>{active=false;observer.disconnect();phase.disconnect();};
  },[grid,revision]);
  return visible;
}
