'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { categoryLabel, type CollectionObject } from '@/lib/collection';
import { collectionColumns } from '@/lib/filter-transition';
import { HeartButton } from './heart-button';
import { useVisibleMosaicPhotos } from './use-visible-mosaic-photos';

type Props={objects:CollectionObject[];filterKey:string;focused:boolean;saved:string[];onToggle:(id:string)=>void;onOpen:(object:CollectionObject)=>void};

/** Ordinary document-flow tiles: no animation engine, transformed grid or scroll RAF. */
export function NativeMosaic({objects,filterKey,focused,saved,onToggle,onOpen}:Props){
  const grid=useRef<HTMLDivElement>(null);
  const [width,setWidth]=useState(0);
  const columns=collectionColumns(width,focused);
  const gap=focused?(width>500?14:10):(width>500?10:7);
  const cell=Math.max(1,(width-(columns-1)*gap)/columns);
  const visible=useVisibleMosaicPhotos(grid,`${width}:${filterKey}:${objects.map(object=>object.id).join(',')}`);
  useEffect(()=>{
    const element=grid.current;if(!element)return;
    const observer=new ResizeObserver(([entry])=>setWidth(entry.contentRect.width));
    observer.observe(element);return()=>observer.disconnect();
  },[]);
  return <div className="mosaic-wrap">
    <div ref={grid} className="mosaic-native" data-filter={filterKey} aria-label="Objectencollectie"
      style={{gridTemplateColumns:`repeat(${columns}, minmax(0, 1fr))`,gap}}>
      {objects.map((object,index)=><div key={object.id} className="object-tile" data-id={object.id} data-present="true">
        <button className="object-button" data-object={object.id}
          aria-label={`${object.title}, ${categoryLabel(object.category)}. ${object.availability==='reserved'?'Gereserveerd. ':object.availability==='sold'?'Verkocht. ':''}Bekijk het object`}
          onClick={()=>onOpen(object)}
          onKeyDown={event=>{
            const deltas:Record<string,number>={ArrowRight:1,ArrowLeft:-1,ArrowDown:columns,ArrowUp:-columns,Home:-index,End:objects.length-1-index};
            if(!(event.key in deltas))return;
            event.preventDefault();
            const next=Math.max(0,Math.min(objects.length-1,index+deltas[event.key]));
            grid.current?.querySelector<HTMLButtonElement>(`[data-object="${objects[next].id}"]`)?.focus();
          }}>
          <span className="object-photograph">{width>0&&visible.has(object.id)&&<Image src={object.image} unoptimized={object.image.startsWith('/api/')} alt={object.title} fill sizes={`${Math.ceil(cell)}px`} loading="eager" draggable={false}/>}</span>
          {object.availability&&object.availability!=='available'&&<span className={`stock-badge ${object.availability}`}>{object.availability==='reserved'?'Gereserveerd':'Verkocht'}</span>}
        </button>
        <HeartButton className={`grid-heart ${saved.includes(object.id)?'saved-marker':''}`} selected={saved.includes(object.id)} size={22}
          aria-label={`${saved.includes(object.id)?'Verwijder':'Bewaar'} ${object.title} ${saved.includes(object.id)?'uit':'in'} je selectie`} onClick={()=>onToggle(object.id)}/>
      </div>)}
    </div>
    <p className="sr-only" aria-live="polite">{objects.length} objecten in de collectie.</p>
  </div>;
}
