import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import { buildFrontDoor } from './house-door';
import { mergeSolids } from './house-architecture';

function entrance() {
  const stone=new T.MeshStandardMaterial(),lightStone=new T.MeshStandardMaterial();
  const root=buildFrontDoor({glass:new T.MeshPhysicalMaterial(),stone,lightStone});
  root.updateMatrixWorld(true);return {root,stone,lightStone};
}

test('the limestone surround is symmetric around the door axis, including the cornice',()=>{
  const {root,stone,lightStone}=entrance();const pieces:T.Mesh[]=[];
  root.traverse(object=>{if(object instanceof T.Mesh&&(object.material===stone||object.material===lightStone))pieces.push(object);});
  for(const piece of pieces) {
    const bounds=new T.Box3().setFromObject(piece);
    // Every limestone part must have a matching reflected extent, or be centred.
    assert.ok(pieces.some(other=>{
      const reflected=new T.Box3().setFromObject(other);
      return Math.abs(bounds.min.x+reflected.max.x)<1e-6&&Math.abs(bounds.max.x+reflected.min.x)<1e-6&&Math.abs(bounds.min.y-reflected.min.y)<1e-6&&Math.abs(bounds.max.y-reflected.max.y)<1e-6&&Math.abs(bounds.min.z-reflected.min.z)<1e-6&&Math.abs(bounds.max.z-reflected.max.z)<1e-6;
    }),`Asymmetric limestone piece: ${piece.name}`);
  }
  const cornice=root.getObjectByName('Broad bevelled stone cornice')!;
  const bounds=new T.Box3().setFromObject(cornice);
  assert.ok(Math.abs(bounds.min.x+bounds.max.x)<1e-6);
});

test('the pull bell is connected and its numbered enamel plate has two open numeral shapes',()=>{
  const {root}=entrance();
  const bell=root.getObjectByName('Old-fashioned pull bell')!;
  assert.ok(bell.getObjectByName('Continuous forged pull-bell core'));
  assert.ok(bell.getObjectByName('Continuous curled pull-bell tail'));
  const plate=root.getObjectByName('Enamel house number plate 89')!;
  const numerals=root.children.filter(object=>object.name==='Exact enamel numeral 89') as T.Mesh<T.ExtrudeGeometry>[];
  assert.equal(numerals.length,2);
  assert.ok(numerals.reduce((sum,m)=>sum+(m.geometry.parameters.shapes as T.Shape).holes.length,0)>=3,'8 has two counters and 9 has one');
  const plateBounds=new T.Box3().setFromObject(plate);
  for(const digit of numerals) {
    const bounds=new T.Box3().setFromObject(digit);
    assert.ok(bounds.min.x>=plateBounds.min.x&&bounds.max.x<=plateBounds.max.x);
    assert.ok(bounds.min.y>=plateBounds.min.y&&bounds.max.y<=plateBounds.max.y);
  }
});

test('the curled pull hangs on one vertical axis beneath the crown and carries seven sculpted birds',()=>{
  const {root}=entrance(),bell=root.getObjectByName('Old-fashioned pull bell')!;
  const core=bell.getObjectByName('Continuous forged pull-bell core') as T.Mesh<T.TubeGeometry>;
  const tail=bell.getObjectByName('Continuous curled pull-bell tail') as T.Mesh<T.TubeGeometry>;
  const axis=core.geometry.parameters.path.getPoint(0).x;
  for(const object of [core,tail]) {
    const points=object.geometry.parameters.path.getPoints(360);
    const meanX=points.reduce((sum,p)=>sum+p.x,0)/points.length;
    assert.ok(Math.abs(meanX-axis)<1e-6,'Helix centre must not drift left or right');
    assert.ok(Math.abs(points[0].x-axis)<1e-6);
    assert.ok(Math.abs(points.at(-1)!.x-axis)<1e-6);
  }
  const birds=bell.children.filter(object=>object.name.startsWith('Gilded miniature bird'));
  assert.equal(birds.length,7);
  for(const bird of birds) {
    assert.equal(bird.userData.axisX,axis);
    assert.ok(bird.getObjectByName('Bird head'));
    assert.ok(bird.getObjectByName('Bird pointed beak'));
    assert.equal(bird.children.filter(part=>part.name==='Bird overlapping wing feather').length,5);
  }
});


test('the entire iron-and-glass door opens, including the upper glass and all ironwork',()=>{
  const {root}=entrance();const leaf=root.getObjectByName('Opening front door leaf')!;
  const pane=root.getObjectByName('Arched textured main glass')!;
  const top=root.getObjectByName('Glazed ornate transom')!;
  assert.equal(pane.parent,leaf);assert.equal(top.parent,leaf);
  assert.equal(root.getObjectByName('Door leaf head')!.parent,leaf);
  assert.equal(root.getObjectByName('Door leaf left perimeter')!.parent,leaf);
  assert.equal(root.getObjectByName('Door frame threshold')!.parent,root);
  const traced:T.Object3D[]=[];root.traverse(object=>{if(object.name==='Photo-traced transom ironwork')traced.push(object);});
  for(const ornament of traced){
    assert.equal(ornament.parent,leaf,'Every traced ornament must travel with the complete door');
  }
  const fixed=root.getObjectByName('Broad bevelled stone cornice')!.getWorldPosition(new T.Vector3()),before=pane.getWorldPosition(new T.Vector3()),upperBefore=top.getWorldPosition(new T.Vector3());
  leaf.rotation.y=Math.PI/2;root.updateMatrixWorld(true);
  assert.deepEqual(root.getObjectByName('Broad bevelled stone cornice')!.getWorldPosition(new T.Vector3()),fixed);
  assert.ok(top.getWorldPosition(new T.Vector3()).z<upperBefore.z-.5);
  assert.ok(pane.getWorldPosition(new T.Vector3()).z<before.z-.5);
  assert.ok(root.getObjectByName('Old-fashioned pull bell')!.parent===root);
});


test('material batching preserves the hinge and leaf world geometry',()=>{
  const {root}=entrance(),leaf=root.getObjectByName('Opening front door leaf') as T.Group;
  const closed=new T.Box3().setFromObject(leaf);
  leaf.removeFromParent();mergeSolids(root);mergeSolids(leaf);root.add(leaf);root.updateMatrixWorld(true);
  const batched=new T.Box3().setFromObject(leaf);
  assert.ok(closed.min.distanceTo(batched.min)<1e-6);assert.ok(closed.max.distanceTo(batched.max)<1e-6);
  leaf.rotation.y=Math.PI/2;root.updateMatrixWorld(true);
  const open=new T.Box3().setFromObject(leaf);
  assert.ok(Math.abs((open.max.x-open.min.x)-(closed.max.z-closed.min.z))<1e-5);assert.ok(open.min.z<closed.min.z-.9);
});

test('main pane and transom share privacy glass and continuous UV scale',()=>{
  const {root}=entrance();
  const main=root.getObjectByName('Arched textured main glass') as T.Mesh;
  const transom=root.getObjectByName('Glazed ornate transom') as T.Mesh;
  assert.equal(main.material,transom.material);
  assert.ok(Math.abs(main.getWorldPosition(new T.Vector3()).z-transom.getWorldPosition(new T.Vector3()).z)<1e-6);
  for(const mesh of [main,transom]) {
    const position=mesh.geometry.getAttribute('position'),uv=mesh.geometry.getAttribute('uv');
    for(let i=0;i<position.count;i++) {
      const point=mesh.localToWorld(new T.Vector3().fromBufferAttribute(position,i));
      const expected=(point.y-(.4+(657-575)*3.03/552))/(463*3.03/552);
      assert.ok(Math.abs(uv.getY(i)-expected)<1e-6);
    }
  }
});

test('privacy glazing covers the entire opening without gaps at the arch or side stiles',()=>{
  const {root}=entrance();
  const main=root.getObjectByName('Arched textured main glass') as T.Mesh;
  const top=root.getObjectByName('Glazed ornate transom') as T.Mesh;
  const lower=new T.Box3().setFromObject(main),upper=new T.Box3().setFromObject(top);
  assert.ok(Math.abs(lower.max.y-upper.min.y)<1e-6,'Panes must meet behind the arch without a gap');
  assert.ok(Math.abs(lower.min.x-upper.min.x)<1e-6);
  assert.ok(Math.abs(lower.max.x-upper.max.x)<1e-6);
  const material=main.material as T.MeshPhysicalMaterial;
  assert.equal(material.transmission,0);
  assert.equal(material.opacity,1);
  assert.equal(material.transparent,false);
});
