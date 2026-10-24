/** Reproduce asset transfer/parse costs without a browser or GPU benchmark. */
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {decodeHouseEntrance} from '../src/components/house-entrance-binary';
import {indexExactGeometry} from '../src/components/house-rendering';

async function main(){
  const results=[];
  for(const format of ['json','bin']){
    const compressed=await readFile(new URL(`../public/house/models/entrance.${format}.gz`,import.meta.url));
    const inflated=gunzipSync(compressed),bytes=inflated.buffer.slice(inflated.byteOffset,inflated.byteOffset+inflated.byteLength);
    const samples=[];
    for(let i=0;i<7;i++){
      const start=performance.now();
      if(format==='json')JSON.parse(new TextDecoder().decode(bytes));else decodeHouseEntrance(bytes);
      if(i>1)samples.push(performance.now()-start);
    }
    samples.sort((a,b)=>a-b);
    results.push({format,compressedBytes:compressed.length,inflatedBytes:inflated.length,medianParseMs:samples[Math.floor(samples.length/2)]});
  }
  const original=new RoundedBoxGeometry(.112,.06,.225,1,.003),indexed=indexExactGeometry(original);
  console.log(JSON.stringify({entrance:results,paver:{originalVertices:original.getAttribute('position').count,indexedVertices:indexed.getAttribute('position').count,triangles:indexed.index!.count/3}},null,2));
  original.dispose();indexed.dispose();
}
main().catch(error=>{console.error(error);process.exitCode=1;});
