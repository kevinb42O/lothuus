import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as T from 'three';
import {buildHouseWindow,interiorGeometry,curtainGeometry,type WindowBox} from './house-windows';

function fixture(x=-2.4,bottom=1.02,height=2.4,index=2){
  const material=()=>new T.MeshStandardMaterial();
  const materials={stone:material(),lightStone:material(),dark:material(),timber:material(),brass:material(),iron:material(),glass:material(),curtain:material(),backdrop:material()};
  const box:WindowBox=(x,y,z,w,h,d,mat,parent)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
  const root=buildHouseWindow(x,bottom,height,index,materials,box);root.updateMatrixWorld(true);
  return {root,materials};
}

test('curtains cover the full opening and stay clear of the tilted leaf',()=>{
  for(const height of [2.4,2.08]){
    const {root}=fixture(-2.4,1.02,height);
    const curtains=root.children.filter(child=>child.name.includes('curtain'));
    assert.equal(curtains.length,2);
    for(const curtain of curtains){
      const bounds=new T.Box3().setFromObject(curtain);
      assert.ok(bounds.min.y<root.position.y,'Hang down to the sill');
      assert.ok(bounds.max.y>root.position.y+height,'Conceal the top behind the frame');
    }
    const leaf=new T.Box3().setFromObject(root.getObjectByName('Inward tilted lower casement')!);
    assert.ok(leaf.min.z>Math.max(...curtains.map(c=>new T.Box3().setFromObject(c).max.z))+.15);
  }
});

test('only one lower casement tilts inward, with its frame and handle following the bottom hinge',()=>{
  const {root,materials}=fixture();
  const leaf=root.getObjectByName('Inward tilted lower casement')!;
  assert.ok(leaf);assert.ok(leaf.rotation.x<0);
  const pane=leaf.children.find(child=>child instanceof T.Mesh&&child.material===materials.glass) as T.Mesh;
  const top=new T.Vector3(0,2.4*.67/2,0),bottom=new T.Vector3(0,-2.4*.67/2,0);
  pane.localToWorld(top);pane.localToWorld(bottom);
  assert.ok(top.z<bottom.z-.15,'The top moves into the room');
  assert.ok(Math.abs(bottom.y-(1.02+2.4*.025))<.02,'The bottom stays on its hinge');
  assert.equal(leaf.children.filter(child=>child instanceof T.Mesh&&child.material===materials.timber).length,4);
  assert.equal(leaf.children.filter(child=>child instanceof T.Mesh&&child.material===materials.brass).length,1);
  assert.equal(root.children.filter(child=>child instanceof T.Mesh&&child.material===materials.glass).length,2,'Other lower pane and upper transom remain fixed');
  for(const [x,y] of [[-4.8,1.02],[-2.4,4.32],[2.4,1.02]])assert.equal(fixture(x,y).root.getObjectByName(leaf.name),undefined);
});

test('room crops stay inside their atlas gutters without stretching portrait content',()=>{
  for(const height of [2.56,2.24])for(let variant=0;variant<4;variant++){
    const geometry=interiorGeometry(1.52,height,variant),uv=geometry.getAttribute('uv');
    const us=[],vs=[];for(let i=0;i<uv.count;i++){us.push(uv.getX(i));vs.push(uv.getY(i));}
    assert.ok(Math.min(...us)>(variant*64+2)/256);assert.ok(Math.max(...us)<((variant+1)*64-2)/256);
    assert.ok(Math.min(...vs)>2/128);assert.ok(Math.max(...vs)<126/128);
    const pixelAspect=(Math.max(...us)-Math.min(...us))*256/((Math.max(...vs)-Math.min(...vs))*128);
    // Texel centres span 59×123 pixels; allow the corresponding subpixel crop error.
    assert.ok(Math.abs(pixelAspect-1.52/height)<.005);
    geometry.dispose();
  }
  const curtain=curtainGeometry(.25,2.46);
  assert.ok(curtain.getAttribute('position').count<30,'Keep the folded fabric geometry small');curtain.dispose();
});


test('the shipped atlas fits its UV layout and stays within the measured texture budget',async()=>{
  const {default:sharp}=await import('sharp');
  const {readFile}=await import('node:fs/promises');
  const desktop=await readFile(new URL('../../public/house/materials/window-interiors.webp',import.meta.url));
  const mobile=await readFile(new URL('../../public/house/materials/mobile/window-interiors.webp',import.meta.url));
  const image=await sharp(desktop).metadata();
  assert.equal(image.width,256);assert.equal(image.height,128);assert.equal(image.hasAlpha,false);
  assert.ok(desktop.byteLength<8192,'Do not silently increase the window asset download');
  assert.deepEqual(mobile,desktop,'Both profiles use the same small atlas and UV layout');
});
