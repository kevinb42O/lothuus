'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, ArrowUpRight } from 'lucide-react';
import { houseEntryTiming, HOUSE_ENTRY_DURATION } from './house-entry';
import type { HouseScene } from './house-scene';
import './house-entry-study.css';

const END=7.2;
const FRAMES=[['Brand',0],['Approach',3.8],['Near lens',5.45],['Through',6.1],['House',6.8]] as const;

/** Development-only motion study; it renders the same camera, geometry and focus
 * as the homepage, with no second interactive collection or production controls.
 */
export function HouseEntryStudy() {
  const host=useRef<HTMLDivElement>(null),scene=useRef<HouseScene|null>(null),time=useRef(0);
  const [status,setStatus]=useState('loading'),[playing,setPlaying]=useState(false),[seconds,setSeconds]=useState(0),[rate,setRate]=useState(1);
  const [progress,setProgress]=useState(0),[baseline,setBaseline]=useState(false);
  useEffect(()=>{
    let cancelled=false,owned:HouseScene|null=null;
    const houseOnly=new URLSearchParams(window.location.search).get('house-only')==='1';setBaseline(houseOnly);setStatus('loading');
    import('./house-scene').then(module=>cancelled?null:module.mountHouse(host.current!,undefined,{mode:'hero',entryLettering:!houseOnly,onLoadProgress:setProgress})).then(api=>{
      if(!api)return;if(cancelled){api.dispose();return;}
      owned=api;scene.current=api;api.scroll(houseEntryTiming(time.current/HOUSE_ENTRY_DURATION),true);setStatus('ready');
    }).catch(()=>{if(!cancelled)setStatus('error');});
    return()=>{cancelled=true;owned?.dispose();if(scene.current===owned)scene.current=null;};
  },[]);
  function seek(value:number){
    const next=Math.max(0,Math.min(END,value));time.current=next;setSeconds(next);
    scene.current?.scroll(houseEntryTiming(next/HOUSE_ENTRY_DURATION),true);
  }
  useEffect(()=>{
    if(!playing||status!=='ready')return;
    let frame=0,last=0;
    const tick=(now:number)=>{
      const dt=last?Math.min((now-last)/1000,.1):0;last=now;
      if(!document.hidden){
        const next=Math.min(END,time.current+dt*rate);time.current=next;setSeconds(next);
        scene.current?.scroll(houseEntryTiming(next/HOUSE_ENTRY_DURATION),true);
        if(next===END){setPlaying(false);return;}
      }else last=0;
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[playing,rate,status]);
  function toggle(){if(!playing&&time.current>=END)seek(0);setPlaying(value=>!value);}
  const ready=status==='ready';
  return <main className="house-entry-study">
    <div className="house-entry-study-scene" ref={host}/>
    {!ready&&<div className="house-entry-study-status" role="status">{status==='error'?'The scene could not be loaded.':`Preparing the shot · ${Math.round(progress*100)}%`}</div>}
    <div className="house-entry-study-controls">
      <div className="house-entry-study-playback">
        <button onClick={toggle} disabled={!ready} aria-label={playing?'Pause study':'Play study'}>{playing?<Pause size={18}/>:<Play size={18}/>}</button>
        <button onClick={()=>{seek(0);setPlaying(true);}} disabled={!ready} aria-label="Replay study"><RotateCcw size={18}/></button>
        <label>Speed<select value={rate} onChange={event=>setRate(Number(event.target.value))}><option value={1}>1×</option><option value={.25}>¼×</option></select></label>
        {baseline&&<span>House baseline</span>}
        <output aria-live="off">{seconds.toFixed(2)} s</output>
        <a href="/">Full intro <ArrowUpRight size={14}/></a>
      </div>
      <label className="house-entry-study-timeline"><span className="sr-only">Shot time</span><input type="range" min={0} max={END} step={.01} value={seconds} disabled={!ready} onChange={event=>{setPlaying(false);seek(Number(event.target.value));}}/></label>
      <div className="house-entry-study-frames" role="group" aria-label="Shot compositions">{FRAMES.map(([label,value])=><button key={label} disabled={!ready} onClick={()=>{setPlaying(false);seek(value);}}>{label}</button>)}</div>
    </div>
  </main>;
}
