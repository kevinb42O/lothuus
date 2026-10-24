/** A repeating, photo-only continuation of the actual mosaic for the entrance.
 * The atlas shares the live grid's tile pitch and origin, so it can disappear
 * into that grid at arrival without a photo swap or a second interactive grid.
 */
export type EntryPhotoWall={url:string;width:number;height:number;x:number;y:number;worldWidth:number};

export function entryPhotoWallKey(world:HTMLElement) {
  const grid=world.querySelector<HTMLElement>('.mosaic-fluid, .mosaic-native');
  if(!grid)return '';
  const tiles=Array.from(grid.querySelectorAll<HTMLElement>('[data-id][data-present="true"]'));
  const photos=tiles.slice(0,64).map(tile=>tile.querySelector<HTMLImageElement>('.object-photograph img')?.currentSrc||tile.querySelector<HTMLImageElement>('img')?.src||'');
  return grid.clientWidth&&photos.length?`${world.clientWidth}:${grid.clientWidth}:${grid.offsetTop}:${grid.dataset.filter}:${photos.join('|')}`:'';
}

export async function createEntryPhotoWall(world:HTMLElement):Promise<EntryPhotoWall|null> {
  const grid=world.querySelector<HTMLElement>('.mosaic-fluid, .mosaic-native');
  if(!grid||!grid.clientWidth)return null;
  const tiles=Array.from(grid.querySelectorAll<HTMLElement>('[data-id][data-present="true"]'));
  if(!tiles.length)return null;
  const columns=Math.max(...tiles.map(tile=>Number(tile.dataset.column)||0))+1;
  const focused=grid.dataset.focused==='true',gap=focused?(grid.clientWidth>500?14:10):(grid.clientWidth>500?10:7);
  const pitch=(grid.clientWidth+gap)/columns,cell=pitch-gap;
  const rows=Math.max(1,Math.min(8,Math.ceil(tiles.length/columns)));
  const sources=tiles.slice(0,columns*rows).map(tile=>tile.querySelector<HTMLImageElement>('.object-photograph img'));
  const pictures=await Promise.all(sources.map(async source=>{
    if(!source)return null;
    const image=new Image();
    // Reuse responsive selection for lazy tiles instead of requesting their
    // full-resolution fallback just to paint a small entrance thumbnail.
    if(source.currentSrc)image.src=source.currentSrc;
    else{image.sizes=source.sizes;image.srcset=source.srcset;image.src=source.src;}
    try{await image.decode();return image;}catch{return null;}
  }));
  const fallback=pictures.find(image=>image!==null);if(!fallback)return null;
  const atlas=document.createElement('canvas');atlas.width=Math.ceil(columns*pitch);atlas.height=Math.ceil(rows*pitch);
  const ctx=atlas.getContext('2d');if(!ctx)return null;
  ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()||'#fafaf7';ctx.fillRect(0,0,atlas.width,atlas.height);
  for(let index=0;index<columns*rows;index++){
    const image=pictures[index%pictures.length]||fallback,size=Math.min(image.naturalWidth,image.naturalHeight);
    ctx.drawImage(image,(image.naturalWidth-size)/2,(image.naturalHeight-size)/2,size,size,(index%columns)*pitch,Math.floor(index/columns)*pitch,cell,cell);
  }
  let x=0,y=0,node:HTMLElement|null=grid;
  while(node&&node!==world){x+=node.offsetLeft;y+=node.offsetTop;node=node.offsetParent as HTMLElement|null;}
  const blob=await new Promise<Blob|null>(resolve=>atlas.toBlob(resolve,'image/webp',.95));
  return blob?{url:URL.createObjectURL(blob),width:columns*pitch,height:rows*pitch,x,y,worldWidth:world.clientWidth}:null;
}
