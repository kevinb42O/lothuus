'use client';

import { ArrowDown, Pause, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { entryEase, sampleHouseEntry } from './house-entry';
import { createEntryPhotoWall, entryPhotoWallKey, type EntryPhotoWall } from './house-entry-wall';
import type { HouseScene, HouseCollectionProjection, HouseWordmarkProjection } from './house-scene';

gsap.registerPlugin(useGSAP);

/** One real 3D entrance, with the existing live collection immediately behind it. */
export function DoorwayHero({children}:{children:ReactNode}) {
  const pausedRef=useRef(false),readyRef=useRef(false);
  const entrance=useRef<{play:()=>void;pause:()=>void;resume:()=>void}|null>(null);
  const [automatic,setAutomatic]=useState(false),[paused,setPaused]=useState(false),[arrived,setArrived]=useState(false);
  const lettering=useRef<HTMLSpanElement>(null);
  const root=useRef<HTMLDivElement>(null),canvas=useRef<HTMLDivElement>(null);
  const stage=useRef<HTMLElement>(null),photoWall=useRef<HTMLDivElement>(null),world=useRef<HTMLDivElement>(null);
  const scene=useRef<HouseScene|null>(null),progress=useRef(0),pinned=useRef(false);
  const atlas=useRef<EntryPhotoWall|null>(null),lastProjection=useRef<HouseCollectionProjection>({x:0,y:0,scale:1});
  const [loadProgress,setLoadProgress]=useState(0),[loaderDismissed,setLoaderDismissed]=useState(false);
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading'),[attempt,setAttempt]=useState(0);

  function paint(value:number,projection?:HouseCollectionProjection,wordmark?:HouseWordmarkProjection) {
    if(wordmark&&lettering.current){
      lettering.current.style.display=wordmark.opacity===0?'none':'';
      lettering.current.style.setProperty('--brand-x',`${wordmark.x}px`);
      lettering.current.style.setProperty('--brand-y',`${wordmark.y}px`);
      lettering.current.style.setProperty('--brand-scale',String(wordmark.scale));
      lettering.current.style.setProperty('--brand-opacity',String(wordmark.opacity));
    }
    const pose=sampleHouseEntry(value),foreground=stage.current,collection=world.current;
    if(!foreground||!collection)return;
    // Focus follows the rendered approach, including reverse scroll. It is
    // fully resolved before the door exposes the live collection behind it.
    const defocus=pinned.current?1-entryEase(.015,.28,value):0;
    if(canvas.current){
      canvas.current.style.filter=defocus>0?`blur(${(7*defocus).toFixed(3)}px)`:'none';
      canvas.current.style.transform=defocus>0?`scale(${1+.035*defocus})`:'none';
    }
    const reveal=pinned.current?pose.reveal:0;
    foreground.style.opacity=String(scene.current?1:1-reveal);
    foreground.style.visibility=reveal===1?'hidden':'visible';
    foreground.inert=reveal>.98;
    collection.inert=pinned.current&&reveal<.98;
    // Loading completion never grants visibility to the product plane. Only
    // the rendered camera opening the real door can expose it behind the canvas.
    collection.style.visibility=pinned.current&&value<1&&(!scene.current||pose.door===0)?'hidden':'visible';
    if(projection)lastProjection.current=projection;
    collection.style.setProperty('--entry-chrome',String(pinned.current?entryEase(.97,1,value):1));
    const wall=photoWall.current,photo=atlas.current;
    if(wall&&photo){
      const {x,y,scale}=lastProjection.current;
      wall.style.backgroundSize=`${photo.width*scale}px ${photo.height*scale}px`;
      wall.style.backgroundPosition=`${(foreground.clientWidth-photo.worldWidth*scale)/2+x+photo.x*scale}px ${foreground.clientHeight/2*(1-scale)+y+photo.y*scale}px`;
      wall.style.opacity=String(pinned.current?1-entryEase(.965,1,value):0);
      wall.style.visibility=pinned.current&&!!scene.current&&pose.door>0&&value<1?'visible':'hidden';
    }
    if(projection&&pinned.current){
      collection.style.setProperty('--entry-grid-x',`${projection.x}px`);
      collection.style.setProperty('--entry-grid-y',`${projection.y}px`);
      collection.style.setProperty('--entry-grid-scale',String(projection.scale));
    }
  }

  useEffect(()=>{
    const collection=world.current;if(!collection)return;
    let cancelled=false,revision=0,queued=0,key='';
    const rebuild=async()=>{
      queued=0;const nextKey=entryPhotoWallKey(collection);if(!nextKey||nextKey===key)return;
      key=nextKey;const take=++revision;
      const next=await createEntryPhotoWall(collection);
      if(!next)return;
      if(cancelled||take!==revision){URL.revokeObjectURL(next.url);return;}
      const previous=atlas.current;atlas.current=next;
      if(photoWall.current)photoWall.current.style.backgroundImage=`url("${next.url}")`;
      paint(progress.current,lastProjection.current);
      if(previous)URL.revokeObjectURL(previous.url);
    };
    const queue=()=>{cancelAnimationFrame(queued);queued=requestAnimationFrame(()=>{void rebuild();});};
    const observer=new MutationObserver(queue);observer.observe(collection,{childList:true,subtree:true});
    const resize=new ResizeObserver(queue);resize.observe(collection);queue();
    return()=>{cancelled=true;revision++;observer.disconnect();resize.disconnect();cancelAnimationFrame(queued);if(atlas.current){URL.revokeObjectURL(atlas.current.url);atlas.current=null;}};
  },[]);

  useEffect(()=>{
    const element=canvas.current;if(!element)return;
    let cancelled=false,owned:HouseScene|null=null,readyTimer=0,readyFrame=0;
    setStatus('loading');setLoadProgress(.04);setLoaderDismissed(false);
    import('./house-scene').then(module=>cancelled?null:module.mountHouse(element,undefined,{mode:'hero',onProgress:paint,onLoadProgress:value=>{if(!cancelled)setLoadProgress(value);}})).then(api=>{
      if(!api)return;if(cancelled){api.dispose();return;}
      owned=api;scene.current=api;api.scroll(progress.current,true);
      // Allow the first complete WebGL frame to paint, then finish the hairline
      // before dissolving the opaque loading surface.
      readyFrame=requestAnimationFrame(()=>{readyFrame=requestAnimationFrame(()=>{
        readyTimer=window.setTimeout(()=>{if(!cancelled)setStatus('ready');},240);
      });});
    }).catch(()=>{if(!cancelled)setStatus('error');});
    const lost=()=>{cancelAnimationFrame(readyFrame);clearTimeout(readyTimer);setStatus('error');owned?.dispose();owned=null;scene.current=null;};
    element.addEventListener('house-context-lost',lost);
    return()=>{cancelled=true;cancelAnimationFrame(readyFrame);clearTimeout(readyTimer);element.removeEventListener('house-context-lost',lost);if(scene.current===owned)scene.current=null;owned?.dispose();};
  },[attempt]);

  useEffect(()=>{
    const dismiss=(event:MouseEvent)=>{
      if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      if(event.target instanceof Element&&event.target.closest('a[href="#collectie"]'))setLoaderDismissed(true);
    };
    document.addEventListener('click',dismiss);
    return()=>document.removeEventListener('click',dismiss);
  },[]);

  useEffect(()=>{
    readyRef.current=status==='ready';
    if(status==='ready')entrance.current?.play();
    else entrance.current?.pause();
  },[status]);

  useGSAP(()=>{
    const element=root.current!,collection=world.current!;
    const restoration=window.history.scrollRestoration;
    window.history.scrollRestoration='manual';
    window.scrollTo({top:0,left:0,behavior:'instant'});
    const media=gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)',()=>{
      pinned.current=true;pausedRef.current=false;setAutomatic(true);setArrived(false);
      element.classList.add('house-entry-pinned','house-entry-auto');
      let finished=false,finishFrame=0;
      const clock={value:0};
      const seek=(value:number)=>{
        progress.current=value;
        // The camera moves through a stationary page. At arrival these exact
        // coordinates become normal document flow, without a window scroll.
        if(scene.current)scene.current.scroll(value,true);else paint(value);
      };
      const finish=()=>{
        if(finished)return;finished=true;
        tween.pause();pausedRef.current=false;seek(1);
        finishFrame=requestAnimationFrame(()=>{finishFrame=requestAnimationFrame(()=>{
          element.classList.add('house-entry-arrived');
          collection.style.transform='none';
          setArrived(true);setPaused(false);
        });});
      };
      // Begin moving immediately beneath the dissolving white surface. A
      // modest initial speed avoids a perceived hold; arrival still eases to rest.
      const tween=gsap.to(clock,{
        value:1,duration:18,paused:true,
        ease:(t:number)=>.65*t+1.7*t*t-1.35*t*t*t,
        onUpdate:()=>seek(clock.value),onComplete:finish,
      });
      entrance.current={
        play:()=>{if(!finished){seek(0);tween.restart(true);if(document.hidden)tween.pause();}},
        pause:()=>tween.pause(),resume:()=>{if(!finished)tween.resume();},
      };
      seek(0);
      if(readyRef.current)entrance.current.play();
      const visibility=()=>{
        if(document.hidden)tween.pause();
        else if(readyRef.current&&!finished&&!pausedRef.current)tween.resume();
      };
      document.addEventListener('visibilitychange',visibility);
      const jump=(event:MouseEvent)=>{
        if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
        const link=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('a[href="#collectie"]'):null;
        if(!link||finished)return;
        event.preventDefault();setLoaderDismissed(true);finish();
        window.history.replaceState(null,'','#collectie');
        if(link.classList.contains('skip-link'))collection.querySelector<HTMLElement>('#collectie')?.focus({preventScroll:true});
      };
      document.addEventListener('click',jump);
      return()=>{
        tween.kill();cancelAnimationFrame(finishFrame);entrance.current=null;
        document.removeEventListener('visibilitychange',visibility);document.removeEventListener('click',jump);
        pinned.current=false;setAutomatic(false);setArrived(false);setPaused(false);
        element.classList.remove('house-entry-pinned','house-entry-auto','house-entry-arrived');
        progress.current=0;collection.style.transform='none';
        for(const variable of ['--entry-grid-x','--entry-grid-y','--entry-grid-scale'])collection.style.removeProperty(variable);
        scene.current?.scroll(0,true);paint(0);
      };
    });
    return()=>{media.revert();window.history.scrollRestoration=restoration;};
  },{scope:root});

  function togglePause(){
    const next=!paused;pausedRef.current=next;setPaused(next);
    if(next)entrance.current?.pause();else entrance.current?.resume();
  }

  return <div ref={root} className="house-entry-experience">
    <div className={`house-entry-loader ${status==='ready'||loaderDismissed?'is-complete':''}`} aria-hidden={status==='ready'||loaderDismissed} inert={status==='ready'||loaderDismissed}>
      <div className="house-entry-loader-identity">
        <span ref={lettering} className="wordmark house-entry-loader-wordmark" aria-label="LOTHUUS"><b>LO</b><span>THUUS</span></span>
        <p>Een huis voor cultuur en ontmoeting.</p>
        <div className="house-entry-loader-rule" role="progressbar" aria-label="Het 3D-huis wordt geladen" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(loadProgress*100)} aria-valuetext={status==='error'?'Het laden is onderbroken':status==='ready'?'Het huis is klaar':'Het huis wordt opgebouwd'} style={{'--house-load':loadProgress} as CSSProperties}><span/></div>
        <span className="sr-only" role="status">{status==='error'?'Het 3D-huis kon niet worden geladen.':status==='ready'?'Het huis is klaar.':'Het huis wordt opgebouwd…'}</span>
        {status==='error'&&<div className="house-entry-loader-error"><p>Het huis kon niet worden geladen.</p><button onClick={()=>setAttempt(value=>value+1)}>Probeer opnieuw <RotateCcw size={14}/></button></div>}
      </div>
      <a className="house-entry-loader-skip" href="#collectie" onClick={()=>setLoaderDismissed(true)}>Naar de collectie <ArrowDown size={13}/></a>
    </div>
    <div className="house-entry-track"><section ref={stage} className={`house-entry-stage ${status==='ready'?'is-ready':''}`} aria-label="Welkom bij LOTHUUS Vintage — een reis door de voordeur">
      <div ref={photoWall} className="house-entry-photo-wall" aria-hidden="true"/>
      <div ref={canvas} className="house-entry-canvas"/>
      <h1 className="sr-only">LOTHUUS Vintage</h1>
      {automatic&&status==='ready'&&!arrived&&<>
        <button className={`house-entry-playback ${paused?'is-paused':''}`} onClick={togglePause} aria-label={paused?'Hervat de camerarit':'Pauzeer de camerarit'} aria-pressed={paused}>
          <span className="house-entry-pause-symbol" aria-hidden="true"><Pause size={28} strokeWidth={1.5}/></span>
        </button>
        <div className="house-entry-flight-controls"><a href="#collectie">Overslaan <ArrowDown size={13}/></a></div>
      </>}
      {status==='error'&&loaderDismissed&&<div className="house-entry-status" role="status"><span>Het 3D-huis kon niet worden geladen.</span><button onClick={()=>setAttempt(value=>value+1)}>Opnieuw <RotateCcw size={14}/></button><a href="#collectie">Naar de collectie <ArrowDown size={14}/></a></div>}
    </section></div>
    <div ref={world} className="house-entry-world">{children}</div>
  </div>;
}
