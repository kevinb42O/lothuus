'use client';
import {useEffect,useRef,useState} from 'react';
import type {HouseScene} from '../../components/house-scene';
export default function Perf(){
 const host=useRef<HTMLDivElement>(null),api=useRef<HouseScene|null>(null);const [result,setResult]=useState('loading');
 useEffect(()=>{let cancelled=false,owned:HouseScene|null=null;const params=new URLSearchParams(location.search);
 host.current!.style.width=`${params.get('width')||1920}px`;host.current!.style.height=`${params.get('height')||1080}px`;
 (params.has('after')?import('../../components/house-scene-wide-after'):import('../../components/house-scene-profile')).then(m=>m.mountHouse(host.current!,undefined,{mode:'hero'})).then(a=>{if(cancelled)a.dispose();else{owned=a;api.current=a;setResult('ready');}});return()=>{cancelled=true;owned?.dispose();};},[]);
 function run(){const start=performance.now(),canvas=host.current!.querySelector('canvas')!,first=JSON.parse(canvas.dataset.renderStats!).frames;setResult('running');function tick(){const elapsed=performance.now()-start;if(elapsed>=8000){const stats=JSON.parse(canvas.dataset.renderStats!);setResult(JSON.stringify({fps:(stats.frames-first)/(elapsed/1000),stats}));return;}api.current!.scroll(.01+.27*(.5-.5*Math.cos(elapsed/8000*Math.PI*4)),true);requestAnimationFrame(tick);}requestAnimationFrame(tick);}
 return <><div style={{position:'fixed',zIndex:10,background:'white',top:0,maxWidth:'100vw',overflowWrap:'anywhere'}}><button onClick={run}>Benchmark wide</button>{[0,.1,.2,.3,.5,.65].map(p=><button key={p} onClick={()=>api.current?.scroll(p,true)}>{p}</button>)}{['full','basic','no-planting','no-paving'].map(mode=><button key={mode} onClick={()=>host.current?.dispatchEvent(new CustomEvent('profile-mode',{detail:mode}))}>{mode}</button>)}<button onClick={()=>host.current?.dispatchEvent(new Event('house-capture'))}>Capture</button><output>{result}</output></div><div ref={host} className="house-entry-canvas" style={{position:'relative',width:1920,height:1080,overflow:'hidden'}}/></>;
}
