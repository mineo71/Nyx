// Renders crescent PNGs into a .iconset and calls iconutil to build src/resources/icon.icns.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const fsChk = require('fs');
const pathChk = require('path');
const { execFileSync: execChk } = require('child_process');
const logoPath = pathChk.join(__dirname, '..', 'src', 'resources', 'logo.png');
const resDir = pathChk.join(__dirname, '..', 'src', 'resources');
if (fsChk.existsSync(logoPath)) {
  const set = pathChk.join(resDir, 'icon.iconset');
  fsChk.mkdirSync(set, { recursive: true });
  const specs = [[16,'16x16'],[32,'16x16@2x'],[32,'32x32'],[64,'32x32@2x'],[128,'128x128'],[256,'128x128@2x'],[256,'256x256'],[512,'256x256@2x'],[512,'512x512'],[1024,'512x512@2x']];
  for (const [sz, name] of specs) {
    execChk('sips', ['-z', String(sz), String(sz), logoPath, '--out', pathChk.join(set, `icon_${name}.png`)], { stdio: 'ignore' });
  }
  execChk('iconutil', ['-c', 'icns', '-o', pathChk.join(resDir, 'icon.icns'), set]);
  fsChk.rmSync(set, { recursive: true, force: true });
  console.log('wrote src/resources/icon.icns from logo.png');
  process.exit(0);
}
// ---- else: existing generated-crescent logic runs below ----

function crc32(buf){let c=~0;for(let i=0;i<buf.length;i++){c^=buf[i];for(let k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&-(c&1));}return ~c>>>0;}
function chunk(type,data){const t=Buffer.from(type,'ascii');const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc]);}
function makePNG(size){
  const cx=size/2,cy=size/2,r=size*0.40,ox=cx+size*0.20,oy=cy-size*0.12,orr=r*0.95;
  const raw=Buffer.alloc(size*(size*4+1));let p=0;
  for(let y=0;y<size;y++){raw[p++]=0;for(let x=0;x<size;x++){
    const inMain=(x-cx)**2+(y-cy)**2<=r*r,inSub=(x-ox)**2+(y-oy)**2<=orr*orr,on=inMain&&!inSub;
    const bg=(x-cx)**2+(y-cy)**2<=(size*0.48)**2;
    if(on){raw[p++]=124;raw[p++]=140;raw[p++]=248;raw[p++]=255;}
    else if(bg){raw[p++]=11;raw[p++]=14;raw[p++]=20;raw[p++]=255;}
    else{raw[p++]=0;raw[p++]=0;raw[p++]=0;raw[p++]=0;}
  }}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}

const res=path.join(__dirname,'..','src','resources');
const set=path.join(res,'icon.iconset');
fs.mkdirSync(set,{recursive:true});
const specs=[[16,'16x16'],[32,'16x16@2x'],[32,'32x32'],[64,'32x32@2x'],[128,'128x128'],[256,'128x128@2x'],[256,'256x256'],[512,'256x256@2x'],[512,'512x512'],[1024,'512x512@2x']];
for(const [sz,name] of specs) fs.writeFileSync(path.join(set,`icon_${name}.png`),makePNG(sz));
execFileSync('iconutil',['-c','icns','-o',path.join(res,'icon.icns'),set]);
fs.rmSync(set,{recursive:true,force:true});
console.log('wrote src/resources/icon.icns');
