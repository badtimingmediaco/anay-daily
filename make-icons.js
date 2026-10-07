// Generates PNG app icons with no external dependencies (zlib only).
// Design: indigo gradient square with three ascending white bars + a marker dot.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf){
  let c, crcTable = crc32.table;
  if(!crcTable){
    crcTable = crc32.table = [];
    for(let n=0;n<256;n++){ c=n; for(let k=0;k<8;k++){ c = (c&1)?(0xEDB88320^(c>>>1)):(c>>>1);} crcTable[n]=c>>>0; }
  }
  c = 0xFFFFFFFF;
  for(let i=0;i<buf.length;i++){ c = crcTable[(c^buf[i])&0xFF]^(c>>>8); }
  return (c^0xFFFFFFFF)>>>0;
}
function chunk(type, data){
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length,0);
  const t = Buffer.from(type,'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t,data])),0);
  return Buffer.concat([len,t,data,crc]);
}
function makePNG(size, draw){
  const px = Buffer.alloc(size*size*4);
  function set(x,y,r,g,b,a){ if(x<0||y<0||x>=size||y>=size)return; const i=(y*size+x)*4; px[i]=r;px[i+1]=g;px[i+2]=b;px[i+3]=a; }
  draw(set, size);
  // raw image data with filter byte 0 per row
  const raw = Buffer.alloc(size*(size*4+1));
  for(let y=0;y<size;y++){
    raw[y*(size*4+1)] = 0;
    px.copy(raw, y*(size*4+1)+1, y*size*4, (y+1)*size*4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size,0); ihdr.writeUInt32BE(size,4);
  ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
  const idat = zlib.deflateSync(raw, {level:9});
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),
    chunk('IHDR',ihdr), chunk('IDAT',idat), chunk('IEND',Buffer.alloc(0))
  ]);
}

function draw(set, S){
  const scale = S/512;
  // background vertical gradient: #5b5bd6 -> #4646c0
  for(let y=0;y<S;y++){
    const t=y/S;
    const r=Math.round(0x5b+(0x46-0x5b)*t);
    const g=Math.round(0x5b+(0x46-0x5b)*t);
    const b=Math.round(0xd6+(0xc0-0xd6)*t);
    for(let x=0;x<S;x++) set(x,y,r,g,b,255);
  }
  // three ascending bars
  const bars=[{h:150,c:[255,255,255,150]},{h:230,c:[255,255,255,200]},{h:300,c:[255,255,255,255]}];
  const baseY=416*scale, bw=70*scale, gap=40*scale;
  const totalW=bars.length*bw+(bars.length-1)*gap;
  let x0=(512*scale-totalW)/2;
  const rad=12*scale;
  bars.forEach(bar=>{
    const h=bar.h*scale, top=baseY-h, left=x0, right=x0+bw;
    for(let y=Math.floor(top);y<baseY;y++){
      for(let x=Math.floor(left);x<right;x++){
        // round the top corners
        if(y<top+rad){
          const cx = x<left+rad?left+rad:(x>right-rad?right-rad:x);
          const cy = top+rad;
          if((x-cx)*(x-cx)+(y-cy)*(y-cy) > rad*rad && (x<left+rad||x>right-rad)) continue;
        }
        set(x,y,bar.c[0],bar.c[1],bar.c[2],bar.c[3]);
      }
    }
    x0=right+gap;
  });
  // marker dot above tallest bar
  const dcx=x0-bw/2-gap, dcy=(baseY-300*scale)-34*scale, dr=20*scale;
  for(let y=Math.floor(dcy-dr);y<=dcy+dr;y++) for(let x=Math.floor(dcx-dr);x<=dcx+dr;x++){
    if((x-dcx)*(x-dcx)+(y-dcy)*(y-dcy)<=dr*dr) set(x,y,255,255,255,255);
  }
}

const outDir = path.join(__dirname,'icons');
fs.mkdirSync(outDir,{recursive:true});
[[192,'icon-192.png'],[512,'icon-512.png'],[180,'apple-touch-icon.png']].forEach(([s,name])=>{
  fs.writeFileSync(path.join(outDir,name), makePNG(s,draw));
  console.log('wrote', name, s+'x'+s);
});
console.log('done');
