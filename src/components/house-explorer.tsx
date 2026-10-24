'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Maximize2, Minus, Plus, RotateCcw, Wind, Play, Pause } from 'lucide-react';
import type { HouseScene } from './house-scene';
import './house-explorer.css';

export function HouseExplorer() {
  const container=useRef<HTMLDivElement>(null),stage=useRef<HTMLDivElement>(null),api=useRef<HouseScene|null>(null);
  const [filming,setFilming]=useState(false),[entered,setEntered]=useState(false);
  const [status,setStatus]=useState<'waiting'|'loading'|'ready'|'error'>('waiting');
  const [attempt,setAttempt]=useState(0),[wind,setWind]=useState(true),[view,setView]=useState<'front'|'angle'|'door'|'gate'|'street'>('front');
  useEffect(()=>{
    const element=container.current;if(!element)return;let cancelled=false;
    const observer=new IntersectionObserver(entries=>{
      if(!entries.some(entry=>entry.isIntersecting))return;observer.disconnect();setStatus('loading');
      import('./house-scene').then(module=>cancelled?null:module.mountHouse(element,(playing,inside)=>{if(!cancelled){setFilming(playing);setEntered(Boolean(inside));}})).then(scene=>{
        if(!scene)return;if(cancelled){scene.dispose();return;}api.current=scene;scene.wind(true);setWind(true);setStatus('ready');setView('front');
      }).catch(()=>{if(!cancelled)setStatus('error');});
    },{rootMargin:'250px'});observer.observe(element);
    const lost=()=>setStatus('error');element.addEventListener('house-context-lost',lost);
    return()=>{cancelled=true;observer.disconnect();element.removeEventListener('house-context-lost',lost);api.current?.dispose();api.current=null;};
  },[attempt]);
  function chooseView(next:typeof view){setView(next);api.current?.view(next);}
  function toggleFilm(){api.current?.film(!filming);}
  function toggleWind(){setWind(value=>{api.current?.wind(!value);return!value;});}
  async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.current?.requestFullscreen();}catch{/* Embedded browsers may not offer fullscreen. */}}
  const ready=status==='ready';
  return <section className="house-explorer" id="huis-in-3d" aria-labelledby="house-explorer-title">
    <div className="house-explorer-heading"><div><h2 id="house-explorer-title">Het huis, van dichtbij.</h2><p>Verken het huis en zijn omgeving in drie dimensies.</p></div><a className="house-explorer-open" href="/huis">Geef het huis de ruimte <ArrowUpRight size={15}/></a></div>
    <div ref={stage} className="house-explorer-stage">
      <div ref={container} className={`house-explorer-canvas ${!ready?'is-hidden':''}`}/>
      {!ready&&status!=='error'&&<div className="house-explorer-status" role="status"><span className="house-loading-mark" aria-hidden="true"/><span>Het 3D-model wordt opgebouwd…</span></div>}
      {status==='error'&&<div className="house-explorer-error" role="status"><p>Het 3D-model kon niet worden geladen.</p><button onClick={()=>setAttempt(n=>n+1)}>Probeer opnieuw <RotateCcw size={14}/></button></div>}
      {ready&&<div className="house-explorer-instruction">{filming?'Naar de voordeur · sleep om over te nemen':entered?'Je bent binnen · speel opnieuw of kies een standpunt':'Sleep om rond te kijken'}</div>}
      <button className="house-explorer-fullscreen" onClick={()=>void fullscreen()} aria-label="Bekijk het huis op volledig scherm"><Maximize2 size={18}/></button>
    </div>
    <div className="house-explorer-toolbar"><div className="house-explorer-views" role="group" aria-label="Kies een standpunt">{([['front','Voorgevel'],['angle','Schuine blik'],['door','De voordeur'],['gate','De poort'],['street','De zijstraat']]as const).map(([key,label])=><button key={key} disabled={!ready} aria-pressed={view===key} onClick={()=>chooseView(key)}>{label}</button>)}</div><div className="house-explorer-tools"><button className="house-explorer-film" disabled={!ready} aria-pressed={filming} onClick={toggleFilm} aria-label={filming?'Pauzeer het naar binnen gaan':entered?'Speel de wandeling opnieuw':'Ga door de voordeur naar binnen'}>{filming?<Pause size={16}/>:<Play size={16}/>}<span>{entered?'Opnieuw':'Naar binnen'}</span></button><button className="house-explorer-wind" disabled={!ready} aria-pressed={wind} onClick={toggleWind} aria-label="Subtiele wind in de bladeren"><Wind size={17}/><span>Wind</span></button><div className="house-explorer-zoom" role="group" aria-label="Zoom en herstel"><button disabled={!ready} onClick={()=>api.current?.zoom(1.18)} aria-label="Uitzoomen"><Minus size={17}/></button><button disabled={!ready} onClick={()=>api.current?.zoom(.85)} aria-label="Inzoomen"><Plus size={17}/></button><button disabled={!ready} onClick={()=>chooseView('front')} aria-label="Herstel het vooraanzicht"><RotateCcw size={16}/></button></div></div></div>
    <div className="house-explorer-caption"><p>Een 3D-reconstructie naar de kleurenfoto. Maatvoering en niet-zichtbare delen zijn benaderd.</p></div>
  </section>;
}
