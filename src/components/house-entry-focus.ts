import * as T from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { HOUSE_WORDMARK_Z } from './house-entry';

/** Expand the film gate for defocus beyond the screen edge. Cropping this image
 * back to the viewport gives exactly the source camera's rays and perspective.
 */
export function frameEntryLetterCamera(source:T.PerspectiveCamera,target:T.PerspectiveCamera,width:number,height:number,padding:number) {
  target.copy(source,false);
  const matrix=target.projectionMatrix.elements;
  const sx=width/(width+2*padding),sy=height/(height+2*padding);
  for(const index of [0,4,8,12])matrix[index]*=sx;
  for(const index of [1,5,9,13])matrix[index]*=sy;
  target.projectionMatrixInverse.copy(target.projectionMatrix).invert();
}

/** Only the nearby lettering defocuses. The house stays at native resolution.
 * Rendering the small lettering layer separately leaves real background colour
 * behind its soft edges. It reuses the house depth for physical occlusion and
 * never repeats the house geometry pass. Premultiplied RGBA blur avoids a hard
 * cutout, white ghosts or dark halos around the O.
 */
export class HouseEntryFocusPass extends Pass {
  readonly letters=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:true,samples:4});
  private readonly horizontal=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false});
  private readonly vertical=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false});
  readonly uvScale=new T.Vector2(1,1);
  readonly uvOffset=new T.Vector2();
  private readonly letterCamera=new T.PerspectiveCamera();
  private readonly material:T.ShaderMaterial;
  private readonly quad:FullScreenQuad;
  private readonly clearColour=new T.Color();
  private width=1;
  private height=1;
  private radius=0;
  private readonly padding:number;
  active=false;
  constructor(
    private readonly scene:T.Scene,
    private readonly camera:T.PerspectiveCamera,
    private readonly occlusion:(depth:T.DepthTexture|null,width:number,height:number,padding:number)=>void,
    private readonly maxBlur:number,
  ) {
    super();this.needsSwap=false;this.padding=Math.ceil(maxBlur)+2;
    this.material=new T.ShaderMaterial({
      depthTest:false,depthWrite:false,toneMapped:false,
      uniforms:{tColor:{value:null},direction:{value:new T.Vector2()},radius:{value:0}},
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`uniform sampler2D tColor; uniform vec2 direction; uniform float radius; varying vec2 vUv;
        void main(){
          vec4 colour=vec4(0.);float total=0.;
          // Dense Gaussian sampling remains smooth even on a near-white edge.
          // Both colour and coverage are filtered in linear premultiplied space.
          for(int i=-20;i<=20;i++){
            float position=float(i),weight=exp(-.5*position*position/64.);
            colour+=texture2D(tColor,vUv+direction*radius*position/20.)*weight;total+=weight;
          }
          gl_FragColor=colour/total;
        }`,
    });
    this.quad=new FullScreenQuad(this.material);
  }
  get blurRadius(){return this.radius;}
  get texture(){return this.radius>1.5?this.vertical.texture:this.letters.texture;}
  setFocus(distance:number,strength:number,visible:boolean){
    this.active=visible;
    const letterDistance=Math.max(.04,this.camera.position.z-HOUSE_WORDMARK_Z);
    this.radius=Math.min(this.maxBlur,Math.max(0,(1/letterDistance-1/Math.max(.25,distance))*.06*this.height*strength));
  }
  setSize(width:number,height:number){
    this.width=width;this.height=height;
    const w=width+2*this.padding,h=height+2*this.padding;
    this.letters.setSize(w,h);
    this.horizontal.setSize(w,h);
    this.vertical.setSize(w,h);
    this.uvScale.set(width/w,height/h);this.uvOffset.set(this.padding/w,this.padding/h);
  }
  render(renderer:T.WebGLRenderer,_write:T.WebGLRenderTarget,read:T.WebGLRenderTarget){
    if(!this.active)return;
    frameEntryLetterCamera(this.camera,this.letterCamera,this.width,this.height,this.padding);
    this.occlusion(read.depthTexture,this.width,this.height,this.padding);
    const previous=renderer.getRenderTarget(),alpha=renderer.getClearAlpha();
    renderer.getClearColor(this.clearColour);renderer.setClearColor(0x000000,0);
    renderer.shadowMap.needsUpdate=true;
    renderer.setRenderTarget(this.letters);renderer.clear();renderer.render(this.scene,this.letterCamera);
    if(this.radius>1.5){
      const u=this.material.uniforms,w=this.letters.width,h=this.letters.height;
      u.radius.value=this.radius;u.tColor.value=this.letters.texture;u.direction.value.set(1/w,0);
      renderer.setRenderTarget(this.horizontal);this.quad.render(renderer);
      u.tColor.value=this.horizontal.texture;u.direction.value.set(0,1/h);
      renderer.setRenderTarget(this.vertical);this.quad.render(renderer);
    }
    renderer.setClearColor(this.clearColour,alpha);renderer.setRenderTarget(previous);
  }
  dispose(){this.letters.dispose();this.horizontal.dispose();this.vertical.dispose();this.material.dispose();this.quad.dispose();}
}
