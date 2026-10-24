import * as T from 'three';
import { doorOrnamentTracing } from './house-door-tracing';
import { houseBellTracing } from './house-bell-tracing';

type DoorMaterials = { glass: T.Material; stone: T.Material; lightStone: T.Material };
type Point = [number, number];

/** The user's close-up is the authority for the entrance (not the older facade photo).
 * Tracing coordinates are pixels in that 812×908 reference; depths remain estimated.
 * All grille work, leaves, glazing, bell and limestone profiles are actual geometry.
 */
export function buildFrontDoor({ stone, lightStone }: DoorMaterials) {
  const root = new T.Group();
  root.name = 'LOTHUUS entrance — ornate glazed iron door and pull bell';
  const iron = new T.MeshStandardMaterial({ color: '#171b1c', roughness: .52, metalness: .58 });
  const edge = new T.MeshStandardMaterial({ color: '#242a2b', roughness: .43, metalness: .48 });
  const paint = new T.MeshStandardMaterial({ color: '#101718', roughness: .42, metalness: .22 });
  const gold = new T.MeshStandardMaterial({ color: '#c4b583', roughness: .5, metalness: .48 });
  const shadow = new T.MeshStandardMaterial({ color: '#080e0e', roughness: 1 });
  const sx = 1.45 / 242, sy = 3.03 / 552;
  const x = (px: number) => (px - 409) * sx;
  const y = (py: number) => .4 + (657 - py) * sy;
  function mesh(geometry: T.BufferGeometry, material: T.Material, name: string) {
    const object = new T.Mesh(geometry, material);
    object.name = name; object.castShadow = object.receiveShadow = true;
    root.add(object); return object;
  }
  function rect(l: number, t: number, r: number, b: number, z: number, d: number, material: T.Material, name: string) {
    const object = mesh(new T.BoxGeometry((r-l)*sx, (b-t)*sy, d), material, name);
    object.position.set(x((l+r)/2), y((t+b)/2), z); return object;
  }
  function solid(shape: T.Shape, z: number, depth: number, material: T.Material, name: string, bevel = .0015, detail = 4) {
    const object = mesh(new T.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel>0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: detail>4?4:2, curveSegments: detail }), material, name);
    object.position.z = z; return object;
  }
  function shapeOf(points: Point[]) {
    const shape = new T.Shape(); points.forEach(([px,py],i)=>i?shape.lineTo(x(px),y(py)):shape.moveTo(x(px),y(py)));
    shape.closePath(); return shape;
  }
  /** Flat forged strips, with rectangular depth and softened edges, rather than round wire. */
  function strip(points: Point[], width = 2.1, z = 3.99, material: T.Material = iron, name = 'Forged scroll') {
    const curve = new T.CatmullRomCurve3(points.map(([px,py])=>new T.Vector3(x(px),y(py),0)), false, 'centripetal');
    const count = Math.max(8, points.length*6), outer:T.Vector2[]=[], inner:T.Vector2[]=[];
    for(let i=0;i<=count;i++) {
      const p=curve.getPoint(i/count), tangent=curve.getTangent(i/count);
      const n=new T.Vector2(-tangent.y,tangent.x).normalize().multiplyScalar(width*sx*.65);
      outer.push(new T.Vector2(p.x+n.x,p.y+n.y));inner.push(new T.Vector2(p.x-n.x,p.y-n.y));
    }
    const shape=new T.Shape([...outer,...inner.reverse()]);shape.closePath();
    return solid(shape,z,.013,material,name,.0009);
  }
  function tube(points:T.Vector3[],radius:number,material:T.Material,name:string) {
    return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),Math.max(12,points.length*5),radius,7,false),material,name);
  }
  function bead(px:number,py:number,rx:number,ry:number,z:number,material:T.Material,name:string) {
    const object=mesh(new T.SphereGeometry(1,12,8),material,name);
    object.position.set(x(px),y(py),z);object.scale.set(rx*sx,ry*sy,.009);return object;
  }
  const mirror=(points:Point[]):Point[]=>points.map(([px,py])=>[818-px,py]);
  function pair(points:Point[],width=2.1,z=3.99,material:T.Material=iron,name='Mirrored forged scroll') {
    strip(points,width,z,material,name);strip(mirror(points),width,z,material,name);
  }
  // Deep reveal and substantial black perimeter frame, with no solid slab behind the glass.
  const darkness=rect(285,104,533,656,2.35,.055,new T.MeshBasicMaterial({color:'#080b0c'}),'Unmodeled entrance darkness');
  darkness.castShadow=false;
  const leafStart=root.children.length;
  rect(286,103,299,657,3.89,.13,paint,'Door leaf left perimeter');
  rect(519,103,532,657,3.89,.13,paint,'Door leaf right perimeter');
  rect(286,103,532,113,3.89,.13,paint,'Door leaf head');
  rect(286,646,532,657,3.89,.13,paint,'Door frame threshold');
  for(const [l,r] of [[300,315],[504,518]]) {
    rect(l,216,r,641,3.926,.075,paint,'Narrow door side stile');
    rect(l+3,279,r-3,516,3.968,.014,edge,'Stile raised central bead');
    rect(l+1,552,r-1,631,3.968,.017,edge,'Stile foot profile');
  }
  // Pebbled privacy glazing: physically shaded texture, generated from surface heights.
  // This contains no pixels of the reference photo and remains correct when orbiting.
  const size=128, heights=new Float32Array(size*size);let seed=98231;
  for(let i=0;i<heights.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;heights[i]=(seed>>>0)/4294967296;}
  const normals=new Uint8Array(size*size*4),colors=new Uint8Array(size*size*4);
  for(let row=0;row<size;row++)for(let col=0;col<size;col++) {
    const i=row*size+col, off=i*4, h=heights[i];
    const nx=(heights[row*size+(col+1)%size]-heights[row*size+(col+size-1)%size])*.8;
    const ny=(heights[((row+1)%size)*size+col]-heights[((row+size-1)%size)*size+col])*.8;
    const normal=new T.Vector3(nx,ny,1).normalize();
    normals.set([(normal.x*.5+.5)*255,(normal.y*.5+.5)*255,normal.z*255,255],off);
    const top=row/(size-1),warm=Math.max(0,(top-.55)/.45),variation=.87+h*.25;
    colors.set([(58+warm*62)*variation,(86+warm*23)*variation,(84+warm*4)*variation,255],off);
  }
  const normalMap=new T.DataTexture(normals,size,size);normalMap.wrapS=normalMap.wrapT=T.RepeatWrapping;normalMap.repeat.set(6,13);normalMap.needsUpdate=true;
  const colorMap=new T.DataTexture(colors,size,size);colorMap.colorSpace=T.SRGBColorSpace;colorMap.magFilter=T.LinearFilter;colorMap.minFilter=T.LinearFilter;colorMap.needsUpdate=true;
  const pebbled=new T.MeshPhysicalMaterial({color:'#ffffff',map:colorMap,normalMap,normalScale:new T.Vector2(.65,.65),roughness:.38,metalness:0,transmission:0,thickness:.018,ior:1.52,transparent:false,opacity:1});
  pebbled.name='Pebbled green privacy glass';
  // Full-width glazing runs behind the arched metalwork and the side stiles.
  // A straight shared boundary with the upper pane eliminates uncovered wedges.
  const mainGlass=shapeOf([[295,205],[523,205],[523,583],[295,583]]);
  const pane=mesh(new T.ShapeGeometry(mainGlass,32),pebbled,'Arched textured main glass');pane.position.z=3.897;
  // Both panes use one material and one continuous world-space glazing field.
  // Matching UVs keep the pebble size and colour consistent across the transom rail.
  function glazingUV(geometry:T.BufferGeometry) {
    const positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
    for(let i=0;i<positions.count;i++)uv.setXY(i,(positions.getX(i)-x(315))/(189*sx),(positions.getY(i)-y(575))/(463*sy));
  }
  glazingUV(pane.geometry);
  const topGlass=shapeOf([[295,108],[523,108],[523,205],[295,205]]);
  const topPane=mesh(new T.ShapeGeometry(topGlass,32),pebbled,'Glazed ornate transom');topPane.position.z=3.897;glazingUV(topPane.geometry);
  // Broad double-curved transom rail and arch below it.
  pair([[296,236],[328,226],[365,214],[409,210]],6.2,3.957,paint,'Curved transom structural rail');
  pair([[300,242],[337,230],[375,220],[409,218]],1.8,3.997,edge,'Arch raised bead');
  pair([[299,227],[331,217],[368,207],[409,204]],1.4,3.997,edge,'Upper arch bead');
  // The upper iron silhouette is traced directly from the close-up. Extrusion
  // preserves its small hooks, uneven forged widths and the open space between curls.
  function tracedShape(contour: { outer: number[][]; holes: number[][][] }) {
    const shape=shapeOf(contour.outer.map(([px,py])=>[px,py]));
    for(const hole of contour.holes) {
      const path=new T.Path(hole.map(([px,py])=>new T.Vector2(x(px),y(py))));
      path.closePath();shape.holes.push(path);
    }
    return shape;
  }
  // Subdivision removes the low-resolution tracing's polygon corners while
  // retaining each contour, curl and opening. Limit smoothing to local corner
  // neighborhoods so long edges and the overall silhouette do not drift.
  function refinedOrnament(contour: { outer: number[][]; holes: number[][][] }) {
    function rounded(points:number[][]) {
      let refined=points.map(([px,py])=>new T.Vector2(px,py));
      for(let pass=0;pass<2;pass++) {
        const next:T.Vector2[]=[];
        for(let i=0;i<refined.length;i++) {
          const p=refined[i],q=refined[(i+1)%refined.length];
          const fraction=Math.min(.25,.65/p.distanceTo(q));
          next.push(p.clone().lerp(q,fraction),p.clone().lerp(q,1-fraction));
        }
        refined=next;
      }
      const path=new T.Path();
      refined.forEach((p,i)=>i?path.lineTo(x(p.x),y(p.y)):path.moveTo(x(p.x),y(p.y)));
      path.closePath();return path;
    }
    const boundary=rounded(contour.outer),shape=new T.Shape();shape.curves=boundary.curves;
    for(const hole of contour.holes)shape.holes.push(rounded(hole));
    return shape;
  }
  for(const contour of doorOrnamentTracing.iron)solid(refinedOrnament(contour),3.994,.024,iron,'Photo-traced transom ironwork',.0007,16);
  pair([[300,223],[301,214],[309,211],[315,215],[314,221],[309,222],[307,218]],2.2);
  // Tall grille: ten slender upright forged bars follow the arched head.
  for(const px of [329,345,360,376,392,409,425,441,457,473,489]) {
    const top=225+Math.pow(Math.abs(px-409)/90,1.5)*24;
    const bottom=px<345||px>475?544:556;
    strip([[px,top],[px,top+18],[px,bottom]],1.65,3.962,iron,'Vertical grille bar');
    for(const yy of [283,514])bead(px,yy,1.6,2,3.981,edge,'Grille forged collar');
  }
  pair([[320,270],[323,306],[323,488],[326,540]],2.5,3.982);
  // The central heart crest and pendant are included in the traced iron contours.
  pair([[380,234],[369,237],[363,249],[364,265],[375,275],[383,273]],2.2,3.994);
  pair([[366,254],[351,253],[340,263],[342,276],[351,280],[356,275],[353,270],[348,273]],2,3.996);
  pair([[352,280],[343,284],[332,277],[330,266],[335,254]],2.2,3.994);
  // Narrow side glazing and repeated side scrolls remain open to the glass behind them.
  for(const side of [-1,1]) {
    const mx=(px:number)=>side<0?px:818-px;
    strip([[mx(302),248],[mx(297),252],[mx(295),265],[mx(300),280],[mx(308),283],[mx(313),275],[mx(310),266],[mx(305),268]],2.1,3.986);
    strip([[mx(302),396],[mx(310),400],[mx(311),409],[mx(306),415],[mx(299),412]],2.2,3.986);
    strip([[mx(302),522],[mx(295),530],[mx(295),548],[mx(302),560],[mx(310),553],[mx(312),543],[mx(308),537],[mx(303),540]],2.4,3.986);
  }
  // Lower grille scrolls, central lattice and the small gilt pendant above the kick plate.
  pair([[328,512],[326,531],[329,550],[343,562],[365,565],[386,560],[394,551],[393,541],[386,537],[381,543],[385,548],[389,545]],2.4,4.001);
  pair([[338,506],[339,528],[345,544],[358,551],[372,551],[379,544]],2,3.995);
  pair([[328,519],[337,514],[345,520],[343,529],[336,531],[333,525]],2.1,4.003);
  pair([[375,524],[383,515],[389,513],[395,518],[392,525],[385,524]],1.8,3.999);
  pair([[379,508],[388,498],[395,501],[398,508],[393,513]],1.7,3.995);
  for(let i=0;i<5;i++) {
    const yy=443+i*15,ww=12+i*3;
    strip([[409,yy-12],[409+ww,yy],[409,yy+14],[409-ww,yy],[409,yy-12]],1.35,3.994,iron,'Central lower grille lozenge');
  }
  pair([[409,478],[402,466],[401,453],[409,440]],1.5,4.001);
  for(const contour of doorOrnamentTracing.gold)solid(refinedOrnament(contour),4.026,.012,gold,'Photo-traced gilded leaf ornament',.0006,16);
  rect(312,571,506,580,3.961,.055,paint,'Grille bottom cross rail');
  // One plain solid kick plate, with a recessed rectangular field and stepped perimeter.
  rect(313,580,505,645,3.929,.071,paint,'Single solid lower kick plate');
  rect(326,588,492,633,3.967,.009,shadow,'Recessed lower kick plate field');
  rect(330,592,488,630,3.974,.009,paint,'Lower kick plate centre');
  for(const [l,t,r,b] of [[321,584,497,587],[321,635,497,639],[321,584,325,639],[493,584,497,639]])rect(l,t,r,b,3.98,.014,edge,'Kick plate moulding');
  rect(306,641,512,650,3.971,.034,edge,'Door bottom moulding');
  const leaf=new T.Group();leaf.name='Opening front door leaf';
  leaf.position.set(x(286),0,3.94);
  // The complete iron-and-glass entrance is one leaf, including the upper
  // ornamental glass and perimeter. Only its threshold remains in the reveal.
  for(const object of root.children.slice(leafStart)) {
    if(object.name==='Door frame threshold')continue;
    object.position.sub(leaf.position);leaf.add(object);
  }
  pebbled.side=T.DoubleSide;
  root.add(leaf);
  // Fixed painted lining covers the ochre masonry returns, including when the
  // leaf opens. Reuse the leaf paint so the inner jambs and head match exactly.
  rect(279,98,288,659,3.84,.4,paint,'Dark fixed left door lining');
  rect(530,98,539,659,3.84,.4,paint,'Dark fixed right door lining');
  rect(279,97,539,107,3.84,.4,paint,'Dark fixed door head lining');

  // The bell combines clean authored wrought-iron curves, a vertical spiral,
  // sculpted gilt birds and the original enamel numeral contours.
  const bell=new T.Group();bell.name='Old-fashioned pull bell';root.add(bell);
  const bellStart=root.children.length;
  for(const px of [159,205]) {
    tube([new T.Vector3(x(px),y(224),4.04),new T.Vector3(x(px),y(224),4.23)],.009,iron,'Bell bracket projecting wall return');
    rect(px-2,225,px+2,253,4.055,.04,iron,'Bell bracket wall attachment');
  }
  // A true helix around one vertical axis. Its centre never drifts sideways;
  // both the heavy upper pull and the fine curled tail hang under the crown.
  const pullX=x(182),core:T.Vector3[]=[],tail:T.Vector3[]=[];
  for(let i=0;i<=180;i++) {
    const phase=i/180*Math.PI*18;
    core.push(new T.Vector3(pullX+Math.sin(phase)*.011,y(233+i/180*168),4.237+Math.cos(phase)*.011));
  }
  tube(core,.0058,iron,'Continuous forged pull-bell core');
  for(let i=0;i<=120;i++) {
    const phase=i/120*Math.PI*12;
    tail.push(new T.Vector3(pullX+Math.sin(phase)*.008,y(401+i/120*59),4.237+Math.cos(phase)*.008));
  }
  tube(tail,.0031,iron,'Continuous curled pull-bell tail');
  // Reconstructed as smooth forged profiles rather than dark, blurred photo edges.
  // The two upright pendants, open crown curls and central finial share one axis.
  function bracketPair(points:Point[],width=1.45,z=4.235) {
    strip(points,width,z,iron,'Smooth bell crown scroll');
    strip(points.map(([px,py])=>[364-px,py]),width,z,iron,'Smooth bell crown scroll');
  }
  bracketPair([[159,225],[160,220],[167,216],[176,213],[182,213]],1.7);
  bracketPair([[181,214],[176,215],[171,218],[171,222],[174,225],[178,224],[179,221],[177,220],[175,221]],1.35,4.24);
  bracketPair([[160,224],[164,222],[167,223],[168,226],[165,228],[162,227]],1.2,4.241);
  strip([[159,229],[182,229],[205,229]],2,4.23,iron,'Bell crown straight lower rail');
  const centreRing=mesh(new T.TorusGeometry(.014,.004,10,32),iron,'Bell crown central open ring');centreRing.position.set(x(182),y(223),4.246);
  const finial=new T.Shape();finial.moveTo(x(182),y(215));
  finial.bezierCurveTo(x(177),y(212),x(181),y(210),x(180),y(207));
  finial.bezierCurveTo(x(178),y(205),x(182),y(204),x(182),y(201));
  finial.bezierCurveTo(x(182),y(204),x(186),y(205),x(184),y(207));
  finial.bezierCurveTo(x(183),y(210),x(187),y(212),x(182),y(215));finial.closePath();
  solid(finial,4.23,.024,iron,'Bell crown sculpted pointed finial',.0018);
  for(const px of [159,205]) {
    solid(shapeOf([[px-1.65,225],[px+1.65,225],[px+1.65,262],[px-1.65,262]]),4.225,.025,iron,'Smooth forged bracket upright',.002);
    for(const py of [227,260]) {
      const collar=mesh(new T.CylinderGeometry(.014,.014,.007,20),iron,'Turned bracket collar');collar.position.set(x(px),y(py),4.238);
    }
    const pendant=mesh(new T.SphereGeometry(1,20,12),iron,'Rounded bracket pendant');pendant.position.set(x(px),y(264),4.238);pendant.scale.set(.012,.016,.014);
    const tip=mesh(new T.ConeGeometry(.009,.014,20),iron,'Pointed bracket terminal');tip.rotation.z=Math.PI;tip.position.set(x(px),y(267.5),4.238);
  }
  const suspension=mesh(new T.TorusGeometry(.009,.003,10,24),iron,'Pull suspension eye');suspension.position.set(x(182),y(232),4.238);
  // Seven sculpted miniature birds, not leaves. Bodies and heads have full volume;
  // the wings have overlapping flight feathers, with separate beaks, eyes and feet.
  const featherGold=new T.MeshStandardMaterial({color:'#d0be8e',roughness:.38,metalness:.58});
  const grooveGold=new T.MeshStandardMaterial({color:'#8b794e',roughness:.5,metalness:.58});
  const birdSphere=new T.SphereGeometry(1,24,16);
  function birdEllipsoid(px:number,py:number,z:number,rx:number,ry:number,rz:number,material:T.Material,name:string) {
    const object=mesh(birdSphere,material,name);object.position.set(x(px),y(py),z);object.scale.set(rx*sx,ry*sy,rz);return object;
  }
  for(const [index,py] of [248,272,296,320,344,368,392].entries()) {
    const direction=index%2===0?-1:1,px=182,birdStart=root.children.length;
    const side=(v:number)=>px+direction*v;
    // Tail feathers are individually rounded and splay out below the breast.
    for(let i=0;i<3;i++) {
      const tailFeather=birdEllipsoid(side((i-1)*.85-.6),py+3.5,4.252,.62,2.6,.0027,grooveGold,'Bird individual tail feather');
      tailFeather.rotation.z=(i-1)*.22;
    }
    birdEllipsoid(px,py,4.26,1.8,3,.008,gold,'Bird rounded breast');
    birdEllipsoid(side(1),py-3.5,4.261,1.4,1.55,.007,gold,'Bird head');
    const beak=mesh(new T.ConeGeometry(.0024,.01,10),featherGold,'Bird pointed beak');
    beak.rotation.z=-direction*Math.PI/2;beak.position.set(x(side(3.05)),y(py-3.65),4.263);
    birdEllipsoid(side(1.52),py-3.9,4.267,.2,.2,.0011,shadow,'Bird dark inset eye');
    // Swept wings, separated into tapered feathers rather than a flat triangle.
    for(let i=0;i<5;i++) {
      const wing=new T.Shape();wing.moveTo(x(side(.4)),y(py+1.2));
      wing.bezierCurveTo(x(side(-1.2)),y(py-1),x(side(-3.8-i*.28)),y(py-4.9+i*1.3),x(side(-4.5+i*.23)),y(py-3.8+i*1.25));
      wing.bezierCurveTo(x(side(-3.8+i*.3)),y(py-1.3+i*.8),x(side(-1.7)),y(py+2),x(side(.4)),y(py+1.2));wing.closePath();
      solid(wing,4.266+i*.0007,.002, i%2?gold:featherGold,'Bird overlapping wing feather',.00065);
    }
    const folded=birdEllipsoid(side(.65),py+.3,4.269,.9,2.05,.0028,gold,'Bird folded shoulder wing');folded.rotation.z=-direction*.35;
    for(const offset of [-.5,.5])tube([new T.Vector3(x(side(offset)),y(py+2),4.259),new T.Vector3(x(side(offset-.5)),y(py+3.5),4.244),new T.Vector3(x(side(offset+.4)),y(py+3.7),4.237)],.00085,grooveGold,'Bird curled foot around pull');
    const bird=new T.Group();bird.name=`Gilded miniature bird ${index+1}`;bird.userData.axisX=pullX;
    for(const object of root.children.slice(birdStart))bird.add(object);root.add(bird);
  }
  for(const object of root.children.slice(bellStart))bell.add(object);
  // A shallow bevel gives the enamel plate its actual rounded, bright rim. The
  // dark figures are the photographed numerals, not approximations made of rings.
  const enamel=new T.MeshStandardMaterial({color:'#e1e2d9',roughness:.33});
  const plate=shapeOf([[199,380],[215.8,380],[216,392.8],[199,393]]);
  solid(plate,4.068,.014,enamel,'Enamel house number plate 89',.002);
  const numeral=new T.MeshStandardMaterial({color:'#172333',roughness:.48});
  for(const contour of houseBellTracing.number)solid(tracedShape(contour),4.084,.0015,numeral,'Exact enamel numeral 89',.00015);
  // Limestone jambs: broad flat outer face, bevel into the deep reveal, and rounded
  // inner column continuing down to its squared foot, as in the close-up.
  for(const side of [-1,1]) {
    const l=side<0?240:560,r=side<0?258:578;
    rect(l,49,r,710,4.08,.25,lightStone,'Outer limestone jamb face');
    rect(side<0?258:539,91,side<0?279:560,691,4.035,.25,stone,'Limestone reveal bevel backing');
    const cylinder=mesh(new T.CylinderGeometry(.058,.058,600*sy,20),lightStone,'Rounded inner limestone jamb');
    cylinder.position.set(x(side<0?270:548),y(391),4.195);
    for(const yy of [286,548,692])rect(side<0?242:539,yy,side<0?279:576,yy+1.2,4.212,.003,stone,'Jamb stone course joint');
    rect(side<0?239:541,693,side<0?277:579,728,4.1,.32,lightStone,'Limestone jamb squared foot');
  }
  rect(256,58,562,84,4.075,.26,lightStone,'Stone lintel face');
  rect(279,85,539,101,4.008,.24,stone,'Recessed lintel soffit');
  rect(234,38,584,57,4.14,.38,lightStone,'Lintel top fascia');
  const cornice=shapeOf([[192,0],[626,0],[611,22],[580,38],[238,38],[207,22]]);
  solid(cornice,3.93,.36,lightStone,'Broad bevelled stone cornice',.004);
  rect(278,660,540,685,4.15,.55,lightStone,'Upper limestone threshold');
  rect(269,687,549,725,4.26,.68,stone,'Entrance step riser');
  rect(198,720,620,737,4.34,.94,lightStone,'Broad lower limestone step');
  return root;
}
