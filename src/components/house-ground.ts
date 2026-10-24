import * as T from 'three';
import type { MaterialSet } from './house-architecture';
import { streetLayout } from './house-streetscape';

/** Extend the modeled street in world space without adding thousands of distant blocks. */
export function buildStreetGround(paving:MaterialSet) {
  const material=new T.MeshStandardMaterial({
    color:streetLayout.roadColor,map:paving.color,normalMap:paving.normal,
    transparent:true,roughnessMap:paving.roughness,roughness:.95,normalScale:new T.Vector2(.025,.025),
  });
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      varying vec2 vStreetPosition;`);
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
      vec2 streetPosition = (modelMatrix * vec4(transformed, 1.0)).xz;
      vStreetPosition = streetPosition;
      // The source texture covers roughly two metres. Do not stretch it to the plane.
      vMapUv = streetPosition / 2.0;
      vNormalMapUv = streetPosition / 2.0;
      vRoughnessMapUv = streetPosition / 2.0;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec2 vStreetPosition;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      // Match the near-field: 118 × 231 mm, bonded along the street depth.
      float column = floor(vStreetPosition.x / .118 + .5);
      vec2 grid = vec2(vStreetPosition.x / .118,
                       (vStreetPosition.y - 4.08 - mod(column, 2.0) * .1155) / .231) + .5;
      vec2 cell = floor(grid);
      vec2 edge = min(fract(grid), 1.0 - fract(grid)) * vec2(.118, .231);
      vec2 aa = max(fwidth(grid) * vec2(.118, .231), vec2(.0001));
      vec2 joint = smoothstep(vec2(.002), vec2(.002) + aa, edge);
      float block = joint.x * joint.y;
      // Fade subpixel joints towards their average coverage to avoid distant moire.
      float resolved = 1.0 - smoothstep(.025, .09, max(aa.x, aa.y));
      block = mix(.945, block, resolved);
      float shade = .78 + fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453) * .24;
      vec3 detail = texture2D(map, vMapUv).rgb;
      diffuseColor.rgb *= mix(vec3(.55), vec3(shade, shade * .97, shade * .98), block);
      diffuseColor.rgb *= mix(vec3(.94), vec3(1.06), detail);
      // The square and the side street continue into the distance. Outside
      // them the ground becomes gardens, instead of an endless grey apron.
      float square = smoothstep(3.65, 4.0, vStreetPosition.y)
                   * (1.0 - smoothstep(24.0, 24.4, vStreetPosition.y));
      float sideStreet = smoothstep(8.85, 9.15, vStreetPosition.x)
                       * (1.0 - smoothstep(19.1, 19.4, vStreetPosition.x));
      float forecourt = (1.0 - smoothstep(22.0, 22.4, abs(vStreetPosition.x)))
                      * smoothstep(-5.5, -5.1, vStreetPosition.y)
                      * (1.0 - smoothstep(25.0, 25.4, vStreetPosition.y));
      float paved = max(square, max(sideStreet, forecourt));
      float lawnVariation = .88 + .12 * sin(vStreetPosition.x * .61)
                          * sin(vStreetPosition.y * .47);
      vec3 garden = vec3(.085, .125, .045) * lawnVariation * (.8 + detail.g * .4);
      diffuseColor.rgb = mix(garden, diffuseColor.rgb, paved);
      // Blend the local geometry into the ground-projected HDR surroundings.
      // World-space distance keeps this boundary fixed while the camera orbits.
      diffuseColor.a *= 1.0 - smoothstep(32.0, 58.0, length(vStreetPosition));
    `);
  };
  material.customProgramCacheKey=()=> 'lothuus-continuous-street-v2';
  // The transparent outskirts reveal the projected landscape, never a plane edge.
  const ground=new T.Mesh(new T.PlaneGeometry(120,120),material);
  ground.name='Continuous world-scale paving beneath and around the whole house';
  ground.rotation.x=-Math.PI/2;ground.position.y=-.048;
  ground.receiveShadow=true;
  // Keep this two-triangle receiver separate from mergeSolids: it must never
  // become a shadow caster and darken the underside of the nearby paving.
  return ground;
}
