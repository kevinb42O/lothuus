/** The ObjectLoader document with its exact typed arrays stored as binary blocks.
 * Parsing the small manifest avoids converting megabytes of decimal JSON on
 * the browser's main thread. No geometry or texture quantization is performed.
 */
const arrays={Float32Array,Float64Array,Uint32Array,Uint16Array,Uint8Array,Int32Array,Int16Array,Int8Array};
export function decodeHouseEntrance(buffer:ArrayBuffer){
  const headerLength=new DataView(buffer).getUint32(0,true),dataStart=Math.ceil((headerLength+4)/8)*8;
  if(headerLength>buffer.byteLength-4)throw new Error('Invalid house entrance header');
  return JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,4,headerLength)),(_key,value)=>{
    if(!value||typeof value!=='object'||!('$houseArray' in value))return value;
    const ArrayType=arrays[value.$houseArray as keyof typeof arrays];
    if(!ArrayType||!Number.isInteger(value.offset)||value.offset<0||!Number.isInteger(value.length)||value.length<0)throw new Error('Invalid house entrance buffer');
    return new ArrayType(buffer,dataStart+value.offset,value.length);
  });
}
