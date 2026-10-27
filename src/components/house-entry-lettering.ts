import * as T from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { HOUSE_ENTRY_WORDMARK as mark } from './house-entry-wordmark-data';
import { HOUSE_WORDMARK_Z, HOUSE_WORDMARK_Y, houseEntryFraming } from './house-entry';

/** The same font outlines as the loading identity, including the O's true hole.
 * Geometry remains in font units; a single world transform fits each viewport.
 */
export function buildEntryLettering() {
  const paths=new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg">${mark.paths.map(d=>`<path d="${d}"/>`).join('')}</svg>`).paths;
  const root=new T.Group();root.name='LOTHUUS — world-space lettering';
  const face=new T.MeshPhysicalMaterial({color:0xfaf9f4,roughness:.26,metalness:.08,clearcoat:.45,clearcoatRoughness:.2,envMapIntensity:1.1,side:T.DoubleSide});
  const edge=new T.MeshPhysicalMaterial({color:0xc9ced2,roughness:.32,metalness:.16,clearcoat:.35,clearcoatRoughness:.22,envMapIntensity:1.2,side:T.DoubleSide});
  const depth={value:null as T.DepthTexture|null},resolution={value:new T.Vector2(1,1)},padding={value:0};
  for(const material of [face,edge])material.onBeforeCompile=shader=>{
    shader.uniforms.tHouseDepth=depth;shader.uniforms.houseResolution=resolution;shader.uniforms.letterPadding=padding;
    shader.fragmentShader='uniform sampler2D tHouseDepth; uniform vec2 houseResolution; uniform float letterPadding;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      vec2 houseUv=(gl_FragCoord.xy-vec2(letterPadding))/houseResolution;
      if(all(greaterThanEqual(houseUv,vec2(0.)))&&all(lessThanEqual(houseUv,vec2(1.)))){
        if(gl_FragCoord.z>texture2D(tHouseDepth,houseUv).x+.000001)discard;
      }`);
  };
  function occlusion(texture:T.DepthTexture|null,width:number,height:number,border:number){
    depth.value=texture;resolution.value.set(width,height);padding.value=border;
  }
  for(const [index,path] of paths.entries()){
    const geometry=new T.ExtrudeGeometry(path.toShapes(),{
      depth:620,steps:1,curveSegments:64,bevelEnabled:true,bevelThickness:15,bevelSize:12,bevelSegments:8,
    });
    const glyph=new T.Mesh(geometry,[face,edge]);glyph.name=`Letter ${'LOTHUUS'[index]}`;
    glyph.castShadow=true;glyph.receiveShadow=true;root.add(glyph);
  }
  function frame(width:number,height:number){
    const {fontScale}=houseEntryFraming(width,height);
    // Font paths use SVG's downward Y. The counter's centre stays fixed at x=0
    // and at the camera's passage height, independently of camera orientation.
    root.scale.set(fontScale,-fontScale,-fontScale);
    root.position.set(-mark.portal.x*fontScale,HOUSE_WORDMARK_Y+mark.portal.y*fontScale,HOUSE_WORDMARK_Z);
    root.updateMatrix();root.updateMatrixWorld(true);
  }
  return {root,frame,occlusion};
}
