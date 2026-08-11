(() => {
"use strict";

const WORLD_SIZE = 10000;
const TILE_METERS = 20;
const VIEW_SCALE = 2.35;
const PLAYER_SPEED = 92;
const SPRINT_MULTIPLIER = 1.62;
const NET_SEND_HZ = 12;
const MAP_SAMPLE = 4;

const $ = (id) => document.getElementById(id);
const canvas = $("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const minimap = $("minimap");
const miniCtx = minimap.getContext("2d");
miniCtx.imageSmoothingEnabled = false;

const worldMap = $("worldMap");
const mapCtx = worldMap.getContext("2d");
mapCtx.imageSmoothingEnabled = false;

const preview = $("creatorPreview");
const previewCtx = preview.getContext("2d");
previewCtx.imageSmoothingEnabled = false;

const portrait = $("playerPortrait");
const portraitCtx = portrait.getContext("2d");
portraitCtx.imageSmoothingEnabled = false;

const titleMap = $("titleMap");
const titleCtx = titleMap.getContext("2d");
titleCtx.imageSmoothingEnabled = false;

const directions = ["down", "left", "up", "right"];
const directionLabels = {down:"Vorne", left:"Links", up:"Hinten", right:"Rechts"};

const state = {
  running: false,
  paused: false,
  mapOpen: false,
  lastTime: 0,
  lastNetSend: 0,
  elapsed: 0,
  seed: 184731,
  previewDirection: 0,
  player: {
    id: "local",
    name: "Abenteurer",
    x: 5000,
    y: 5000,
    dir: "down",
    moving: false,
    walkTime: 0,
    health: 100,
    stamina: 100,
    skin: "#f1c27d",
    eyes: "#243b53",
    hair: "#3a2418",
    hairStyle: "tousled",
    shirt: "#315d9b",
    cloak: "#684431"
  },
  peers: new Map(),
  network: {
    mode: "solo",
    peer: null,
    hostConn: null,
    conns: new Map(),
    lobbyCode: null
  },
  keys: new Set(),
  minimapBase: null,
  mapBase: null
};

const palette = {
  deepWater: "#12374f",
  water: "#1e526b",
  shallow: "#438091",
  river: "#4b91a5",
  beach: "#cdb36b",
  plains: "#718c4f",
  forest: "#365f40",
  jungle: "#285237",
  swamp: "#53694a",
  rock: "#777568",
  mountain: "#545b5c",
  snow: "#d9ded7"
};

const biomeNames = {
  deepWater: "Tiefsee",
  water: "Offene See",
  shallow: "Flachwasser",
  river: "Flusslauf",
  beach: "Dünenküste",
  plains: "Grasland",
  forest: "Alter Wald",
  jungle: "Dschungel",
  swamp: "Moorland",
  rock: "Felsland",
  mountain: "Hochland",
  snow: "Schneegipfel"
};

// Several overlapping, rotated lobes form bays, peninsulas and broken coastlines.
// Noise warps the lobes, so the silhouettes never read as simple circles.
const landforms = [
  [0.47,0.51,0.20,0.15,-0.18,1.00,11],
  [0.38,0.47,0.12,0.08, 0.28,0.91,12],
  [0.56,0.42,0.13,0.09,-0.45,0.94,13],
  [0.58,0.59,0.14,0.08, 0.42,0.90,14],
  [0.45,0.64,0.12,0.07,-0.22,0.80,15],
  [0.24,0.27,0.14,0.085,0.34,0.82,21],
  [0.18,0.32,0.08,0.055,-0.55,0.66,22],
  [0.75,0.27,0.125,0.145,-0.22,0.84,31],
  [0.82,0.22,0.07,0.085,0.52,0.61,32],
  [0.77,0.72,0.14,0.09,0.20,0.79,41],
  [0.85,0.68,0.07,0.05,-0.38,0.58,42],
  [0.24,0.75,0.095,0.125,-0.42,0.70,51],
  [0.18,0.82,0.055,0.07,0.18,0.50,52],
  [0.53,0.17,0.072,0.045,-0.16,0.52,61],
  [0.47,0.84,0.078,0.042,0.26,0.49,62],
  [0.91,0.49,0.043,0.068,-0.38,0.45,63]
];

const rivers = [
  {name:"Silberlauf",width:0.0055,points:[[0.53,0.45],[0.50,0.48],[0.48,0.52],[0.45,0.56],[0.42,0.60],[0.39,0.64]]},
  {name:"Dornfluss",width:0.0046,points:[[0.55,0.48],[0.58,0.50],[0.60,0.54],[0.61,0.58],[0.62,0.62]]},
  {name:"Nebelaue",width:0.0042,points:[[0.43,0.45],[0.40,0.47],[0.38,0.51],[0.36,0.53]]},
  {name:"Nordstrom",width:0.0038,points:[[0.25,0.23],[0.24,0.26],[0.22,0.29],[0.20,0.32]]},
  {name:"Königsbach",width:0.0042,points:[[0.76,0.23],[0.74,0.27],[0.75,0.31],[0.78,0.35]]},
  {name:"Südader",width:0.0039,points:[[0.77,0.69],[0.75,0.72],[0.76,0.76],[0.79,0.78]]}
];

const routes = [
  [[0.39,0.53],[0.43,0.56],[0.48,0.58],[0.54,0.56],[0.59,0.52],[0.57,0.45]],
  [[0.48,0.58],[0.47,0.63],[0.44,0.67]],
  [[0.43,0.56],[0.39,0.50],[0.38,0.46]]
];

const landmarks = [
  {x:4820,y:5820,name:"Hafen Dornwacht",short:"Dornwacht",type:"town"},
  {x:3890,y:5050,name:"Moorhain",short:"Moorhain",type:"town"},
  {x:5700,y:4500,name:"Sonnenkliff",short:"Sonnenkliff",type:"town"},
  {x:5360,y:5460,name:"Tempel der Gezeiten",short:"Gezeitentempel",type:"ruin"},
  {x:2420,y:2710,name:"Nordwacht",short:"Nordwacht",type:"town"},
  {x:7560,y:2860,name:"Ruinen von Königsfall",short:"Königsfall",type:"ruin"},
  {x:7650,y:7270,name:"Südmark",short:"Südmark",type:"town"}
];

function hash2(x, y, seed = state.seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = h ^ (h >>> 13);
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t){ return t*t*(3-2*t); }
function lerp(a,b,t){ return a+(b-a)*t; }

function valueNoise(x,y,scale,seedOff=0){
  const fx=x/scale;
  const fy=y/scale;
  const x0=Math.floor(fx);
  const y0=Math.floor(fy);
  const tx=smooth(fx-x0);
  const ty=smooth(fy-y0);
  const a=hash2(x0,y0,state.seed+seedOff);
  const b=hash2(x0+1,y0,state.seed+seedOff);
  const c=hash2(x0,y0+1,state.seed+seedOff);
  const d=hash2(x0+1,y0+1,state.seed+seedOff);
  return lerp(lerp(a,b,tx),lerp(c,d,tx),ty);
}

function fbm(x,y,seedOff=0){
  let v=0;
  let amp=0.58;
  let total=0;
  let scale=1150;
  for(let i=0;i<5;i++){
    v += valueNoise(x,y,scale,seedOff+i*97)*amp;
    total += amp;
    amp *= 0.5;
    scale *= 0.5;
  }
  return v/total;
}

function rotatedLobe(nx,ny,lobe){
  const cx=lobe[0];
  const cy=lobe[1];
  const rx=lobe[2];
  const ry=lobe[3];
  const angle=lobe[4];
  const power=lobe[5];
  const id=lobe[6];
  const wx=(valueNoise(nx*WORLD_SIZE,ny*WORLD_SIZE,1650,id*19)-0.5)*0.045;
  const wy=(valueNoise(nx*WORLD_SIZE,ny*WORLD_SIZE,1480,id*31)-0.5)*0.045;
  const dx=nx-cx+wx;
  const dy=ny-cy+wy;
  const ca=Math.cos(angle);
  const sa=Math.sin(angle);
  const px=(dx*ca-dy*sa)/rx;
  const py=(dx*sa+dy*ca)/ry;
  const d=Math.pow(Math.pow(Math.abs(px),1.58)+Math.pow(Math.abs(py),1.58),1/1.58);
  return Math.max(0,1-d)*power;
}

function islandField(x,y){
  const nx=x/WORLD_SIZE;
  const ny=y/WORLD_SIZE;
  let strongest=0;
  let second=0;
  for(const lobe of landforms){
    const f=rotatedLobe(nx,ny,lobe);
    if(f>strongest){second=strongest;strongest=f;}
    else if(f>second){second=f;}
  }
  const joined=strongest+second*0.24;
  const coast=(fbm(x,y,310)-0.5)*0.22;
  const cuts=(valueNoise(x+700,y-400,165,811)-0.5)*0.065;
  const edge=Math.min(nx,ny,1-nx,1-ny);
  const borderClamp=Math.min(1,Math.max(0,edge/0.07));
  return (joined+coast+cuts)*borderClamp;
}

function segmentDistance(px,py,ax,ay,bx,by){
  const dx=bx-ax;
  const dy=by-ay;
  const len=dx*dx+dy*dy;
  const t=len ? Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/len)) : 0;
  const x=ax+t*dx;
  const y=ay+t*dy;
  return {distance:Math.hypot(px-x,py-y),t};
}

function riverAt(x,y,height){
  if(height<0.17 || height>0.66) return null;
  const nx=x/WORLD_SIZE;
  const ny=y/WORLD_SIZE;
  for(const river of rivers){
    for(let i=0;i<river.points.length-1;i++){
      const a=river.points[i];
      const b=river.points[i+1];
      const hit=segmentDistance(nx,ny,a[0],a[1],b[0],b[1]);
      const flow=(i+hit.t)/(river.points.length-1);
      const meander=(valueNoise(x,y,310,500+i)-0.5)*0.0018;
      const width=river.width*(0.58+flow*0.72)+meander;
      if(hit.distance<Math.max(0.0018,width)) return {river,flow};
    }
  }
  return null;
}

function roadAt(x,y){
  const nx=x/WORLD_SIZE;
  const ny=y/WORLD_SIZE;
  for(const route of routes){
    for(let i=0;i<route.length-1;i++){
      const a=route[i];
      const b=route[i+1];
      if(segmentDistance(nx,ny,a[0],a[1],b[0],b[1]).distance<0.0015) return true;
    }
  }
  return false;
}

function terrainAt(x,y){
  x=Math.max(0,Math.min(WORLD_SIZE,x));
  y=Math.max(0,Math.min(WORLD_SIZE,y));
  const h=islandField(x,y);
  const moisture=fbm(x+1337,y-904,400);
  const temp=1-Math.abs(y/WORLD_SIZE-0.5)*1.22+(valueNoise(x,y,900,225)-0.5)*0.18;
  let biome;

  if(h<0.045) biome="deepWater";
  else if(h<0.09) biome="water";
  else if(h<0.145) biome="shallow";
  else if(h<0.195) biome="beach";
  else if(h>0.68 && temp<0.55) biome="snow";
  else if(h>0.60) biome="mountain";
  else if(h>0.51) biome="rock";
  else if(moisture>0.69 && temp>0.67) biome="jungle";
  else if(moisture>0.73) biome="swamp";
  else if(moisture>0.51) biome="forest";
  else biome="plains";

  const river=riverAt(x,y,h);
  if(river && !["deepWater","water","shallow","beach","snow"].includes(biome)) biome="river";
  return {height:h,moisture,temp,biome,river};
}

function isWalkable(x,y){
  const biome=terrainAt(x,y).biome;
  return !["deepWater","water","shallow"].includes(biome);
}

function findSpawn(){
  const candidates=[[4500,5700],[4700,5660],[4450,5550],[3890,5050],[5700,4500]];
  for(const point of candidates) if(isWalkable(point[0],point[1])) return point;
  for(let r=0;r<350;r++){
    const x=5000+(hash2(r,1)-0.5)*3000;
    const y=5200+(hash2(r,2)-0.5)*3000;
    if(isWalkable(x,y)) return [x,y];
  }
  return [5000,5000];
}

function shade(hex,amount){
  const value=parseInt(hex.slice(1),16);
  const r=Math.max(0,Math.min(255,(value>>16)+amount));
  const g=Math.max(0,Math.min(255,((value>>8)&255)+amount));
  const b=Math.max(0,Math.min(255,(value&255)+amount));
  return "#"+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}

function tileDecoration(x,y,biome){
  const gx=Math.floor(x/TILE_METERS);
  const gy=Math.floor(y/TILE_METERS);
  const r=hash2(gx,gy,913);
  if(biome==="forest" && r>0.39) return r>0.84?"pine":"tree";
  if(biome==="jungle" && r>0.34) return r>0.74?"palm":"broadleaf";
  if(biome==="swamp" && r>0.55) return r>0.82?"deadTree":"reeds";
  if(biome==="plains" && r>0.965) return "tree";
  if(biome==="plains" && r>0.87) return r>0.94?"flowers":"grass";
  if((biome==="rock"||biome==="mountain") && r>0.70) return "rock";
  if(biome==="beach" && r>0.91) return r>0.97?"driftwood":"shell";
  if(biome==="river" && r>0.82) return "reeds";
  return null;
}

function drawDecoration(kind,px,py,size){
  if(kind==="tree"||kind==="broadleaf"){
    ctx.fillStyle="rgba(4,14,10,.22)";
    ctx.fillRect(px-size*.24,py+size*.10,size*.52,size*.17);
    ctx.fillStyle="#4a3323";
    ctx.fillRect(px-size*.045,py-size*.01,size*.09,size*.31);
    ctx.fillStyle=kind==="broadleaf"?"#234c31":"#284d32";
    ctx.fillRect(px-size*.25,py-size*.30,size*.50,size*.28);
    ctx.fillStyle=kind==="broadleaf"?"#376c3c":"#3a6b3f";
    ctx.fillRect(px-size*.17,py-size*.40,size*.34,size*.20);
    ctx.fillStyle="#5e874b";
    ctx.fillRect(px-size*.12,py-size*.34,size*.12,size*.08);
  }else if(kind==="pine"){
    ctx.fillStyle="#493323";
    ctx.fillRect(px-size*.035,py,size*.07,size*.34);
    ctx.fillStyle="#1f4934";
    ctx.fillRect(px-size*.26,py-size*.18,size*.52,size*.12);
    ctx.fillRect(px-size*.20,py-size*.30,size*.40,size*.15);
    ctx.fillRect(px-size*.12,py-size*.40,size*.24,size*.15);
  }else if(kind==="palm"){
    ctx.fillStyle="#604226";
    ctx.fillRect(px-size*.04,py-size*.08,size*.08,size*.40);
    ctx.fillStyle="#24502e";
    ctx.fillRect(px-size*.28,py-size*.20,size*.56,size*.10);
    ctx.fillRect(px-size*.07,py-size*.34,size*.14,size*.34);
    ctx.fillStyle="#3d7138";
    ctx.fillRect(px-size*.22,py-size*.29,size*.44,size*.08);
  }else if(kind==="deadTree"){
    ctx.fillStyle="#473c2d";
    ctx.fillRect(px-size*.035,py-size*.24,size*.07,size*.50);
    ctx.fillRect(px-size*.18,py-size*.18,size*.20,size*.06);
    ctx.fillRect(px,py-size*.08,size*.17,size*.05);
  }else if(kind==="reeds"){
    ctx.fillStyle="#74834c";
    ctx.fillRect(px-size*.14,py-size*.10,size*.035,size*.28);
    ctx.fillRect(px,py-size*.17,size*.035,size*.35);
    ctx.fillRect(px+size*.12,py-size*.06,size*.035,size*.24);
  }else if(kind==="rock"){
    ctx.fillStyle="#404849";
    ctx.fillRect(px-size*.20,py-size*.06,size*.40,size*.24);
    ctx.fillStyle="#85887f";
    ctx.fillRect(px-size*.13,py-size*.12,size*.20,size*.08);
    ctx.fillStyle="#5f6562";
    ctx.fillRect(px+size*.07,py,size*.10,size*.11);
  }else if(kind==="flowers"){
    ctx.fillStyle="#e8d968";
    ctx.fillRect(px-size*.14,py,size*.07,size*.07);
    ctx.fillStyle="#d9a0a4";
    ctx.fillRect(px+size*.08,py-size*.09,size*.07,size*.07);
    ctx.fillStyle="#e6e0cb";
    ctx.fillRect(px+size*.01,py+size*.09,size*.06,size*.06);
  }else if(kind==="grass"){
    ctx.fillStyle="#4f733f";
    ctx.fillRect(px-size*.13,py,size*.03,size*.15);
    ctx.fillRect(px,py-size*.05,size*.03,size*.20);
    ctx.fillRect(px+size*.12,py+size*.02,size*.03,size*.13);
  }else if(kind==="shell"){
    ctx.fillStyle="#f0dccb";
    ctx.fillRect(px,py,size*.10,size*.07);
  }else if(kind==="driftwood"){
    ctx.fillStyle="#806143";
    ctx.fillRect(px-size*.22,py,size*.44,size*.08);
    ctx.fillRect(px+size*.08,py-size*.08,size*.07,size*.12);
  }
}

function drawTile(wx,wy,sx,sy,size,terrain){
  const gx=Math.floor(wx/TILE_METERS);
  const gy=Math.floor(wy/TILE_METERS);
  const n=hash2(gx,gy,77);
  const variation=Math.round((n-0.5)*10);
  ctx.fillStyle=shade(palette[terrain.biome],variation);
  ctx.fillRect(Math.floor(sx),Math.floor(sy),Math.ceil(size)+1,Math.ceil(size)+1);

  if(terrain.biome==="water"||terrain.biome==="deepWater"||terrain.biome==="shallow"||terrain.biome==="river"){
    if(n>0.48){
      ctx.fillStyle=terrain.biome==="river"?"rgba(224,243,239,.20)":"rgba(210,240,245,.15)";
      ctx.fillRect(Math.floor(sx+size*.12),Math.floor(sy+size*.45),Math.max(2,size*.45),Math.max(1,size*.055));
    }
  }else if(terrain.biome==="beach" && n>0.64){
    ctx.fillStyle="rgba(89,70,40,.20)";
    ctx.fillRect(Math.floor(sx+size*.65),Math.floor(sy+size*.30),Math.max(1,size*.08),Math.max(1,size*.08));
  }else if(n>0.72){
    ctx.fillStyle="rgba(0,0,0,.07)";
    ctx.fillRect(Math.floor(sx+size*.15),Math.floor(sy+size*.18),Math.max(1,size*.12),Math.max(1,size*.12));
  }

  const deco=tileDecoration(wx,wy,terrain.biome);
  if(deco) drawDecoration(deco,Math.floor(sx+size*.5),Math.floor(sy+size*.5),size);
}

function drawVisibleRoads(camX,camY){
  ctx.save();
  ctx.lineCap="round";
  ctx.lineJoin="round";
  for(const route of routes){
    ctx.beginPath();
    route.forEach((point,index)=>{
      const x=(point[0]*WORLD_SIZE-camX)*VIEW_SCALE+canvas.width/2;
      const y=(point[1]*WORLD_SIZE-camY)*VIEW_SCALE+canvas.height/2;
      if(index===0) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
    });
    ctx.strokeStyle="rgba(74,58,35,.72)";
    ctx.lineWidth=10;
    ctx.stroke();
    ctx.strokeStyle="#ad915d";
    ctx.lineWidth=6;
    ctx.stroke();
    ctx.setLineDash([16,8]);
    ctx.strokeStyle="rgba(226,199,128,.34)";
    ctx.lineWidth=1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawLandmark(landmark,camX,camY){
  const x=(landmark.x-camX)*VIEW_SCALE+canvas.width/2;
  const y=(landmark.y-camY)*VIEW_SCALE+canvas.height/2;
  if(x<-100||x>canvas.width+100||y<-100||y>canvas.height+100) return;
  const u=2.4;
  ctx.save();
  ctx.translate(Math.round(x),Math.round(y));
  ctx.fillStyle="rgba(0,0,0,.28)";
  ctx.fillRect(-10*u,5*u,20*u,5*u);
  if(landmark.type==="town"){
    ctx.fillStyle="#6d4b2f";
    ctx.fillRect(-8*u,-7*u,16*u,14*u);
    ctx.fillStyle="#c0a66c";
    ctx.fillRect(-6*u,-5*u,12*u,12*u);
    ctx.fillStyle="#70442e";
    ctx.beginPath();
    ctx.moveTo(-10*u,-6*u);
    ctx.lineTo(0,-14*u);
    ctx.lineTo(10*u,-6*u);
    ctx.fill();
    ctx.fillStyle="#2a2017";
    ctx.fillRect(-2*u,1*u,4*u,6*u);
    ctx.fillStyle="#efca67";
    ctx.fillRect(3*u,-2*u,2*u,2*u);
  }else{
    ctx.fillStyle="#756f62";
    ctx.fillRect(-8*u,-9*u,5*u,16*u);
    ctx.fillRect(3*u,-5*u,5*u,12*u);
    ctx.fillStyle="#999181";
    ctx.fillRect(-7*u,-8*u,3*u,4*u);
    ctx.fillRect(4*u,-4*u,3*u,3*u);
    ctx.fillStyle="#496248";
    ctx.fillRect(-8*u,2*u,16*u,3*u);
  }
  if(Math.hypot(landmark.x-camX,landmark.y-camY)>70){
    ctx.font="bold 11px Georgia";
    ctx.textAlign="center";
    ctx.fillStyle="#071014";
    ctx.fillText(landmark.short,1,-40);
    ctx.fillStyle="#f0e5c9";
    ctx.fillText(landmark.short,0,-41);
  }
  ctx.restore();
}

function drawWorld(){
  const w=canvas.width;
  const h=canvas.height;
  ctx.clearRect(0,0,w,h);
  const camX=state.player.x;
  const camY=state.player.y;
  const metresAcross=w/VIEW_SCALE;
  const metresHigh=h/VIEW_SCALE;
  const startX=Math.floor((camX-metresAcross/2)/TILE_METERS)*TILE_METERS;
  const endX=Math.ceil((camX+metresAcross/2)/TILE_METERS)*TILE_METERS;
  const startY=Math.floor((camY-metresHigh/2)/TILE_METERS)*TILE_METERS;
  const endY=Math.ceil((camY+metresHigh/2)/TILE_METERS)*TILE_METERS;
  const size=TILE_METERS*VIEW_SCALE;

  for(let wy=startY;wy<=endY;wy+=TILE_METERS){
    for(let wx=startX;wx<=endX;wx+=TILE_METERS){
      const sx=(wx-camX)*VIEW_SCALE+w/2;
      const sy=(wy-camY)*VIEW_SCALE+h/2;
      if(wx<0||wy<0||wx>WORLD_SIZE||wy>WORLD_SIZE){
        ctx.fillStyle=palette.deepWater;
        ctx.fillRect(sx,sy,size+1,size+1);
        continue;
      }
      drawTile(wx,wy,sx,sy,size,terrainAt(wx+TILE_METERS/2,wy+TILE_METERS/2));
    }
  }

  drawVisibleRoads(camX,camY);
  for(const landmark of landmarks) drawLandmark(landmark,camX,camY);

  for(const peer of state.peers.values()){
    const sx=(peer.x-camX)*VIEW_SCALE+w/2;
    const sy=(peer.y-camY)*VIEW_SCALE+h/2;
    if(sx>-60&&sx<w+60&&sy>-80&&sy<h+60) drawCharacter(ctx,sx,sy,peer,2.35,false);
  }
  drawCharacter(ctx,w/2,h/2,state.player,2.65,true);

  const hour=(8+state.elapsed/120)%24;
  if(hour<6||hour>19){
    const darkness=hour<5||hour>21?0.25:0.12;
    ctx.fillStyle="rgba(8,18,38,"+darkness+")";
    ctx.fillRect(0,0,w,h);
  }
}

function drawHair(c,u,style,hair,dir){
  c.fillStyle=hair;
  if(dir==="side"){
    if(style==="hood"){
      c.fillStyle="#3f4c45";
      c.fillRect(5*u,1*u,7*u,7*u);
      c.fillStyle="#59665d";
      c.fillRect(6*u,1*u,4*u,1*u);
    }else if(style==="bob"){
      c.fillRect(5*u,1*u,7*u,3*u);
      c.fillRect(5*u,3*u,2*u,6*u);
    }else if(style==="braid"){
      c.fillRect(5*u,1*u,7*u,3*u);
      c.fillRect(5*u,3*u,2*u,3*u);
      c.fillRect(4*u,6*u,2*u,5*u);
      c.fillRect(3*u,10*u,2*u,2*u);
    }else if(style==="mohawk"){
      c.fillRect(6*u,0,5*u,2*u);
      c.fillRect(7*u,-1*u,3*u,2*u);
      c.fillRect(5*u,2*u,7*u,2*u);
    }else{
      c.fillRect(5*u,1*u,7*u,3*u);
      c.fillRect(5*u,0,2*u,2*u);
      c.fillRect(8*u,-1*u,2*u,2*u);
      c.fillRect(5*u,3*u,1*u,3*u);
    }
    return;
  }

  if(style==="hood"){
    c.fillStyle="#3f4c45";
    c.fillRect(3*u,1*u,10*u,7*u);
    c.fillStyle="#59665d";
    c.fillRect(4*u,1*u,8*u,1*u);
    if(dir==="down"){
      c.fillStyle="#17211f";
      c.fillRect(4*u,3*u,1*u,4*u);
      c.fillRect(11*u,3*u,1*u,4*u);
    }
  }else if(style==="bob"){
    c.fillRect(3*u,1*u,10*u,3*u);
    c.fillRect(3*u,3*u,2*u,7*u);
    c.fillRect(11*u,3*u,2*u,7*u);
  }else if(style==="braid"){
    c.fillRect(3*u,1*u,10*u,3*u);
    c.fillRect(3*u,3*u,2*u,4*u);
    c.fillRect(11*u,3*u,2*u,4*u);
    if(dir==="up"){
      c.fillRect(7*u,4*u,2*u,8*u);
      c.fillRect(6*u,11*u,3*u,2*u);
    }else{
      c.fillRect(11*u,7*u,2*u,5*u);
      c.fillRect(10*u,11*u,3*u,2*u);
    }
  }else if(style==="mohawk"){
    c.fillRect(6*u,-1*u,4*u,3*u);
    c.fillRect(4*u,1*u,8*u,3*u);
    if(dir==="up") c.fillRect(6*u,3*u,4*u,4*u);
  }else{
    c.fillRect(3*u,1*u,10*u,3*u);
    c.fillRect(4*u,0,2*u,2*u);
    c.fillRect(7*u,-1*u,2*u,3*u);
    c.fillRect(10*u,0,2*u,2*u);
    c.fillRect(3*u,3*u,1*u,4*u);
    c.fillRect(12*u,3*u,1*u,3*u);
  }
}

function drawCharacter(c,x,y,p,scale=2.5,local=false,portraitMode=false){
  const u=scale;
  const moving=!!p.moving;
  const clock=Number(p.walkTime)||0;
  const frames=[0,1,0,-1];
  const step=moving?frames[Math.floor(clock*7)%frames.length]:0;
  const bob=moving && Math.abs(step)===1?-1:0;
  const dir=p.dir||"down";
  const skin=p.skin||"#f1c27d";
  const shirt=p.shirt||"#315d9b";
  const cloak=p.cloak||"#684431";
  const eyes=p.eyes||"#243b53";
  const hair=p.hair||"#3a2418";
  const hairStyle=p.hairStyle||"tousled";

  c.save();
  c.translate(Math.round(x-8*u),Math.round(y-21*u+bob*u));

  if(!portraitMode){
    c.fillStyle="rgba(0,0,0,.30)";
    c.fillRect(3*u,21*u,10*u,2*u);
  }

  if(dir==="left"||dir==="right"){
    if(dir==="left"){
      c.translate(16*u,0);
      c.scale(-1,1);
    }
    c.fillStyle="#222b31";
    c.fillRect((5-step)*u,16*u,3*u,5*u);
    c.fillRect((9+step)*u,16*u,3*u,5*u);
    c.fillStyle="#171c20";
    c.fillRect((4-step)*u,20*u,4*u,2*u);
    c.fillRect((9+step)*u,20*u,4*u,2*u);
    c.fillStyle=cloak;
    c.fillRect(3*u,9*u,5*u,9*u);
    c.fillStyle=shade(cloak,-18);
    c.fillRect(3*u,15*u,5*u,3*u);
    c.fillStyle=shirt;
    c.fillRect(6*u,9*u,6*u,8*u);
    c.fillStyle=shade(shirt,24);
    c.fillRect(10*u,10*u,2*u,5*u);
    c.fillStyle="#8e6d37";
    c.fillRect(6*u,15*u,6*u,1*u);
    c.fillStyle=skin;
    c.fillRect((10+step*.45)*u,10*u,2*u,5*u);
    c.fillRect(6*u,3*u,6*u,7*u);
    c.fillRect(12*u,6*u,1*u,2*u);
    c.fillStyle=shade(skin,20);
    c.fillRect(11*u,4*u,1*u,2*u);
    drawHair(c,u,hairStyle,hair,"side");
    c.fillStyle=eyes;
    c.fillRect(10*u,6*u,1*u,1*u);
    c.fillStyle="#6d3f35";
    c.fillRect(12*u,8*u,1*u,1*u);
  }else{
    c.fillStyle="#222b31";
    c.fillRect((4-step)*u,16*u,3*u,5*u);
    c.fillRect((9+step)*u,16*u,3*u,5*u);
    c.fillStyle="#151b20";
    c.fillRect((3-step)*u,20*u,4*u,2*u);
    c.fillRect((9+step)*u,20*u,4*u,2*u);
    c.fillStyle=cloak;
    if(dir==="up"){
      c.fillRect(3*u,8*u,10*u,10*u);
      c.fillStyle=shade(cloak,16);
      c.fillRect(4*u,9*u,1*u,7*u);
    }else{
      c.fillRect(2*u,9*u,3*u,8*u);
      c.fillRect(11*u,9*u,3*u,8*u);
    }
    c.fillStyle=shirt;
    c.fillRect(4*u,9*u,8*u,8*u);
    c.fillStyle=shade(shirt,24);
    c.fillRect(4*u,9*u,8*u,1*u);
    c.fillStyle="#8e6d37";
    c.fillRect(4*u,15*u,8*u,1*u);
    c.fillStyle=skin;
    c.fillRect(2*u,(10+step*.45)*u,2*u,5*u);
    c.fillRect(12*u,(10-step*.45)*u,2*u,5*u);
    c.fillRect(4*u,3*u,8*u,7*u);
    if(dir==="down"){
      c.fillStyle=shade(skin,20);
      c.fillRect(5*u,4*u,6*u,1*u);
    }
    drawHair(c,u,hairStyle,hair,dir);
    if(dir==="down"){
      c.fillStyle=eyes;
      c.fillRect(6*u,6*u,1*u,1*u);
      c.fillRect(10*u,6*u,1*u,1*u);
      c.fillStyle="#8a4d43";
      c.fillRect(8*u,8*u,1*u,1*u);
    }
  }

  if(local&&!portraitMode){
    c.fillStyle="#f0cd67";
    c.fillRect(7*u,24*u,2*u,1*u);
    c.fillRect(6*u,23*u,4*u,1*u);
  }
  c.restore();

  if(p.name&&!portraitMode){
    c.font="bold 11px Georgia";
    c.textAlign="center";
    c.fillStyle="#071014";
    const nameY=y-22*u-4;
    c.fillText(p.name,x+1,nameY+1);
    c.fillStyle=local?"#f3d47c":"#f0ead8";
    c.fillText(p.name,x,nameY);
  }
}

function movePlayer(dt){
  if(state.paused||state.mapOpen) return;
  let dx=0;
  let dy=0;
  if(state.keys.has("w")||state.keys.has("arrowup")) dy-=1;
  if(state.keys.has("s")||state.keys.has("arrowdown")) dy+=1;
  if(state.keys.has("a")||state.keys.has("arrowleft")) dx-=1;
  if(state.keys.has("d")||state.keys.has("arrowright")) dx+=1;
  state.player.moving=!!(dx||dy);

  const wantsSprint=state.keys.has("shift")&&state.player.moving;
  const sprinting=wantsSprint&&state.player.stamina>1;
  if(sprinting) state.player.stamina=Math.max(0,state.player.stamina-dt*27);
  else state.player.stamina=Math.min(100,state.player.stamina+dt*(state.player.moving?9:18));

  if(!dx&&!dy) return;
  const len=Math.hypot(dx,dy);
  dx/=len;
  dy/=len;
  let speed=PLAYER_SPEED*(sprinting?SPRINT_MULTIPLIER:1);
  const terrain=terrainAt(state.player.x,state.player.y);
  if(terrain.biome==="river") speed*=0.62;
  else if(roadAt(state.player.x,state.player.y)) speed*=1.08;

  if(Math.abs(dx)>Math.abs(dy)) state.player.dir=dx>0?"right":"left";
  else state.player.dir=dy>0?"down":"up";
  state.player.walkTime+=dt*(sprinting?1.9:1.15);

  const nx=Math.max(0,Math.min(WORLD_SIZE,state.player.x+dx*speed*dt));
  const ny=Math.max(0,Math.min(WORLD_SIZE,state.player.y+dy*speed*dt));
  if(isWalkable(nx,state.player.y)) state.player.x=nx;
  if(isWalkable(state.player.x,ny)) state.player.y=ny;
}

function nearestLandmark(x,y){
  let best=null;
  let distance=Infinity;
  for(const landmark of landmarks){
    const d=Math.hypot(x-landmark.x,y-landmark.y);
    if(d<distance){best=landmark;distance=d;}
  }
  return {landmark:best,distance};
}

function updateHud(){
  const terrain=terrainAt(state.player.x,state.player.y);
  const near=nearestLandmark(state.player.x,state.player.y);
  $("biomeText").textContent=biomeNames[terrain.biome];
  $("coordText").textContent=(state.player.x/1000).toFixed(2)+" / "+(state.player.y/1000).toFixed(2)+" km";
  $("playerCount").textContent=String(1+state.peers.size);
  $("hudPlayerName").textContent=state.player.name;
  $("staminaFill").style.width=state.player.stamina.toFixed(1)+"%";
  $("healthFill").style.width=state.player.health.toFixed(1)+"%";
  $("locationText").textContent=near.distance<650?near.landmark.short:biomeNames[terrain.biome];
  const dirText={up:"N",right:"O",down:"S",left:"W"};
  $("compassDirection").textContent=dirText[state.player.dir]||"N";
  const minutes=Math.floor((8*60+state.elapsed*.45)%(24*60));
  $("timeText").textContent=String(Math.floor(minutes/60)).padStart(2,"0")+":"+String(minutes%60).padStart(2,"0");
}

function mapColorAt(x,y){
  const terrain=terrainAt(x,y);
  let color=palette[terrain.biome];
  const grain=(valueNoise(x,y,250,166)-0.5)*12;
  if(terrain.biome==="forest"||terrain.biome==="jungle") color=shade(color,Math.round(grain-3));
  else if(terrain.biome==="plains"||terrain.biome==="rock") color=shade(color,Math.round(grain));
  if(roadAt(x,y)&&isWalkable(x,y)&&terrain.biome!=="river") color="#a68d5c";
  return color;
}

function renderMapBase(target,width,height,sample){
  const stepX=WORLD_SIZE/width;
  const stepY=WORLD_SIZE/height;
  target.fillStyle="#0b2d42";
  target.fillRect(0,0,width,height);
  for(let y=0;y<height;y+=sample){
    for(let x=0;x<width;x+=sample){
      target.fillStyle=mapColorAt((x+sample*.5)*stepX,(y+sample*.5)*stepY);
      target.fillRect(x,y,sample,sample);
    }
  }
}

function drawMapPaths(target,width,height,labels=false){
  target.save();
  target.lineCap="round";
  target.lineJoin="round";
  for(const route of routes){
    target.beginPath();
    route.forEach((point,index)=>{
      const x=point[0]*width;
      const y=point[1]*height;
      if(index===0) target.moveTo(x,y); else target.lineTo(x,y);
    });
    target.strokeStyle="#6d5b3b";
    target.lineWidth=labels?4:1;
    target.setLineDash(labels?[5,5]:[2,2]);
    target.stroke();
    target.strokeStyle="#c0a168";
    target.lineWidth=labels?1.5:.6;
    target.stroke();
  }
  target.setLineDash([]);
  for(const river of rivers){
    target.beginPath();
    river.points.forEach((point,index)=>{
      const x=point[0]*width;
      const y=point[1]*height;
      if(index===0) target.moveTo(x,y); else target.lineTo(x,y);
    });
    target.strokeStyle="#255f78";
    target.lineWidth=labels?7:2;
    target.stroke();
    target.strokeStyle="#62a9bb";
    target.lineWidth=labels?3:1;
    target.stroke();
  }
  target.restore();
}

function renderMinimapBase(){
  const base=document.createElement("canvas");
  base.width=minimap.width;
  base.height=minimap.height;
  const mc=base.getContext("2d");
  mc.imageSmoothingEnabled=false;
  renderMapBase(mc,base.width,base.height,2);
  drawMapPaths(mc,base.width,base.height,false);
  for(const landmark of landmarks){
    mc.fillStyle=landmark.type==="town"?"#e7d7a7":"#8e8372";
    mc.fillRect(Math.round(landmark.x/WORLD_SIZE*base.width)-1,Math.round(landmark.y/WORLD_SIZE*base.height)-1,3,3);
  }
  state.minimapBase=base;
}

function drawMinimap(){
  if(!state.minimapBase) renderMinimapBase();
  miniCtx.drawImage(state.minimapBase,0,0);
  const px=state.player.x/WORLD_SIZE*minimap.width;
  const py=state.player.y/WORLD_SIZE*minimap.height;
  miniCtx.fillStyle="#1b1408";
  miniCtx.fillRect(Math.round(px)-3,Math.round(py)-3,7,7);
  miniCtx.fillStyle="#f4cf63";
  miniCtx.fillRect(Math.round(px)-2,Math.round(py)-2,5,5);
  for(const peer of state.peers.values()){
    miniCtx.fillStyle="#f6f1df";
    miniCtx.fillRect(Math.round(peer.x/WORLD_SIZE*minimap.width)-1,Math.round(peer.y/WORLD_SIZE*minimap.height)-1,3,3);
  }
  miniCtx.strokeStyle="#c1b98f";
  miniCtx.strokeRect(.5,.5,minimap.width-1,minimap.height-1);
}

function renderWorldMapBase(){
  showToast("Die Kartographen zeichnen die Küsten …",1300);
  const base=document.createElement("canvas");
  base.width=worldMap.width;
  base.height=worldMap.height;
  const mc=base.getContext("2d");
  mc.imageSmoothingEnabled=false;
  renderMapBase(mc,base.width,base.height,MAP_SAMPLE);
  drawMapPaths(mc,base.width,base.height,true);
  mc.strokeStyle="rgba(232,220,177,.12)";
  mc.lineWidth=1;
  for(let i=1;i<5;i++){
    mc.beginPath();
    mc.moveTo(i*base.width/5,0);
    mc.lineTo(i*base.width/5,base.height);
    mc.stroke();
    mc.beginPath();
    mc.moveTo(0,i*base.height/5);
    mc.lineTo(base.width,i*base.height/5);
    mc.stroke();
  }
  state.mapBase=base;
}

function drawMapLandmark(target,landmark,width,height){
  const x=landmark.x/WORLD_SIZE*width;
  const y=landmark.y/WORLD_SIZE*height;
  target.save();
  target.translate(x,y);
  if(landmark.type==="town"){
    target.fillStyle="#4b2f1c";
    target.fillRect(-5,-4,10,9);
    target.fillStyle="#eee0b7";
    target.fillRect(-3,-2,6,7);
    target.fillStyle="#7d4e2c";
    target.beginPath();
    target.moveTo(-6,-3);
    target.lineTo(0,-9);
    target.lineTo(6,-3);
    target.fill();
  }else{
    target.strokeStyle="#d0c3a0";
    target.lineWidth=2;
    target.strokeRect(-5,-5,10,10);
    target.beginPath();
    target.moveTo(-5,5);
    target.lineTo(5,-5);
    target.stroke();
  }
  target.font="bold 11px Georgia";
  target.textAlign="center";
  target.fillStyle="#071014";
  target.fillText(landmark.short,1,19);
  target.fillStyle="#f0e4c4";
  target.fillText(landmark.short,0,18);
  target.restore();
}

function drawWorldMap(){
  if(!state.mapBase) renderWorldMapBase();
  mapCtx.drawImage(state.mapBase,0,0);
  for(const landmark of landmarks) drawMapLandmark(mapCtx,landmark,worldMap.width,worldMap.height);
  const px=state.player.x/WORLD_SIZE*worldMap.width;
  const py=state.player.y/WORLD_SIZE*worldMap.height;
  mapCtx.fillStyle="#1c1508";
  mapCtx.beginPath();
  mapCtx.arc(px,py,9,0,Math.PI*2);
  mapCtx.fill();
  mapCtx.fillStyle="#f5d46b";
  mapCtx.beginPath();
  mapCtx.arc(px,py,5,0,Math.PI*2);
  mapCtx.fill();
  mapCtx.strokeStyle="#fff0b1";
  mapCtx.strokeRect(.5,.5,worldMap.width-1,worldMap.height-1);
  for(const peer of state.peers.values()){
    mapCtx.fillStyle="#fff";
    mapCtx.fillRect(peer.x/WORLD_SIZE*worldMap.width-3,peer.y/WORLD_SIZE*worldMap.height-3,6,6);
  }
}

function renderTitleMap(){
  const w=titleMap.width;
  const h=titleMap.height;
  const scale=3;
  titleCtx.fillStyle="#0b2939";
  titleCtx.fillRect(0,0,w,h);
  for(let y=0;y<h;y+=scale){
    for(let x=0;x<w;x+=scale){
      const wx=x/w*WORLD_SIZE;
      const wy=y/h*WORLD_SIZE;
      titleCtx.fillStyle=mapColorAt(wx,wy);
      titleCtx.fillRect(x,y,scale,scale);
    }
  }
  drawMapPaths(titleCtx,w,h,false);
  titleCtx.fillStyle="rgba(2,11,14,.30)";
  titleCtx.fillRect(0,0,w,h);
  for(const landmark of landmarks){
    const x=landmark.x/WORLD_SIZE*w;
    const y=landmark.y/WORLD_SIZE*h;
    titleCtx.fillStyle="rgba(237,203,111,.65)";
    titleCtx.fillRect(x-2,y-2,4,4);
  }
}

function loop(ts){
  if(!state.running) return;
  const dt=Math.min(.04,(ts-state.lastTime)/1000||0);
  state.lastTime=ts;
  state.elapsed+=dt;
  movePlayer(dt);
  drawWorld();
  drawMinimap();
  updateHud();
  updatePortrait();
  maybeSendNetwork(ts);
  if(state.mapOpen) drawWorldMap();
  requestAnimationFrame(loop);
}

function characterFromUI(){
  return {
    name:$("playerName").value.trim()||"Abenteurer",
    skin:$("skinSelect").value,
    eyes:$("eyeSelect").value,
    hair:$("hairSelect").value,
    hairStyle:$("hairStyleSelect").value,
    shirt:$("shirtSelect").value,
    cloak:$("cloakSelect").value
  };
}

function paintPreview(ts=0){
  if(!$("menuScreen").classList.contains("hidden")){
    previewCtx.clearRect(0,0,preview.width,preview.height);
    const sky=previewCtx.createLinearGradient(0,0,0,preview.height);
    sky.addColorStop(0,"#446d73");
    sky.addColorStop(.63,"#76938a");
    sky.addColorStop(.64,"#546f47");
    sky.addColorStop(1,"#263e31");
    previewCtx.fillStyle=sky;
    previewCtx.fillRect(0,0,preview.width,preview.height);
    previewCtx.fillStyle="rgba(235,225,185,.15)";
    previewCtx.fillRect(0,30,preview.width,3);
    const player={...characterFromUI(),dir:directions[state.previewDirection],moving:true,walkTime:ts/1000};
    drawCharacter(previewCtx,72,132,player,4.25,false);
  }
  requestAnimationFrame(paintPreview);
}

function updatePreviewDirection(){
  $("previewDirection").textContent=directionLabels[directions[state.previewDirection]];
}

function updatePortrait(){
  portraitCtx.clearRect(0,0,portrait.width,portrait.height);
  portraitCtx.fillStyle="#1c3437";
  portraitCtx.fillRect(0,0,portrait.width,portrait.height);
  portraitCtx.fillStyle="#29494a";
  portraitCtx.fillRect(0,44,portrait.width,20);
  drawCharacter(portraitCtx,26,58,{...state.player,dir:"down",moving:false},2.6,false,true);
}

function showMenu(multiplayer=false){
  $("titleScreen").classList.add("hidden");
  $("menuScreen").classList.remove("hidden");
  updatePreviewDirection();
  if(multiplayer){
    setTimeout(()=>$("journeyCard").scrollIntoView({behavior:"smooth",block:"center"}),80);
  }
}

function showTitle(){
  $("menuScreen").classList.add("hidden");
  $("gamePanel").classList.add("hidden");
  $("titleScreen").classList.remove("hidden");
}

function startGame(){
  const character=characterFromUI();
  Object.assign(state.player,character);
  const spawn=findSpawn();
  state.player.x=spawn[0]+(Math.random()-.5)*28;
  state.player.y=spawn[1]+(Math.random()-.5)*28;
  state.player.stamina=100;
  state.player.health=100;
  state.player.walkTime=0;
  $("menuScreen").classList.add("hidden");
  $("titleScreen").classList.add("hidden");
  $("gamePanel").classList.remove("hidden");
  state.running=true;
  state.paused=false;
  state.mapOpen=false;
  state.lastTime=performance.now();
  updatePortrait();
  requestAnimationFrame(loop);
  broadcast({type:"hello",player:publicPlayer()});
  showToast("Willkommen in der zersplitterten See");
}

function publicPlayer(){
  const p=state.player;
  return {
    id:p.id,name:p.name,x:p.x,y:p.y,dir:p.dir,moving:p.moving,walkTime:p.walkTime,
    skin:p.skin,eyes:p.eyes,hair:p.hair,hairStyle:p.hairStyle,shirt:p.shirt,cloak:p.cloak
  };
}

function sanitizePlayer(p){
  if(!p||typeof p!=="object") return null;
  const styles=["tousled","bob","braid","mohawk","hood"];
  return {
    id:String(p.id||"peer").slice(0,64),
    name:String(p.name||"Spieler").slice(0,18),
    x:Math.max(0,Math.min(WORLD_SIZE,Number(p.x)||5000)),
    y:Math.max(0,Math.min(WORLD_SIZE,Number(p.y)||5000)),
    dir:["up","down","left","right"].includes(p.dir)?p.dir:"down",
    moving:!!p.moving,
    walkTime:Number(p.walkTime)||0,
    skin:String(p.skin||"#f1c27d").slice(0,16),
    eyes:String(p.eyes||"#243b53").slice(0,16),
    hair:String(p.hair||"#3a2418").slice(0,16),
    hairStyle:styles.includes(p.hairStyle)?p.hairStyle:"tousled",
    shirt:String(p.shirt||"#315d9b").slice(0,16),
    cloak:String(p.cloak||"#684431").slice(0,16)
  };
}

function setNetStatus(text,online=true){
  $("netStatus").textContent=text;
  $("netDot").classList.toggle("online",online);
  $("netDot").classList.toggle("offline",!online);
}

function showToast(message,ms=1800){
  const element=$("toast");
  element.textContent=message;
  element.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer=setTimeout(()=>element.classList.add("hidden"),ms);
}

function makeCode(){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code="";
  crypto.getRandomValues(new Uint32Array(6)).forEach((n)=>code+=chars[n%chars.length]);
  return code;
}

const hostButtonMarkup=$("hostBtn").innerHTML;

function resetHostButton(){
  $("hostBtn").innerHTML=hostButtonMarkup;
  delete $("hostBtn").dataset.ready;
}

function cleanupNetwork(){
  const network=state.network;
  try{if(network.hostConn) network.hostConn.close();}catch{}
  for(const connection of network.conns.values()) try{connection.close();}catch{}
  try{if(network.peer) network.peer.destroy();}catch{}
  network.peer=null;
  network.hostConn=null;
  network.conns.clear();
  network.mode="solo";
  network.lobbyCode=null;
  state.peers.clear();
  setNetStatus("Offline / Solo",false);
  $("hostBox").classList.add("hidden");
  resetHostButton();
}

function initPeerOrWarn(){
  if(typeof Peer==="undefined"){
    alert("PeerJS konnte nicht geladen werden. Solo funktioniert weiter, Multiplayer braucht Internetzugriff.");
    return false;
  }
  return true;
}

function hostLobby(){
  if(!initPeerOrWarn()) return;
  cleanupNetwork();
  const code=makeCode();
  const id="archipel-rpg-"+code;
  const peer=new Peer(id);
  state.network.peer=peer;
  state.network.mode="host";
  state.network.lobbyCode=code;
  $("hostBtn").disabled=true;

  peer.on("open",()=>{
    state.player.id=id;
    $("lobbyCode").textContent=code;
    $("hostBox").classList.remove("hidden");
    setNetStatus("Host · "+code,true);
    $("hostBtn").disabled=false;
    $("hostBtn").dataset.ready="true";
    $("hostBtn").innerHTML='<span class="choice-icon">⚑</span><span><strong>Lobby betreten</strong><small>Code teilen und die Welt öffnen</small></span><b>›</b>';
  });
  peer.on("connection",(connection)=>{
    state.network.conns.set(connection.peer,connection);
    bindHostConnection(connection);
  });
  peer.on("error",(error)=>{
    console.error(error);
    alert("Lobby konnte nicht erstellt werden: "+error.type);
    cleanupNetwork();
  });
}

function bindHostConnection(connection){
  connection.on("open",()=>{
    connection.send({type:"welcome",host:publicPlayer(),players:[...state.peers.values()]});
    showToast("Ein Reisender ist beigetreten");
  });
  connection.on("data",(message)=>{
    if(!message||typeof message!=="object") return;
    if(message.type==="hello"||message.type==="state"){
      const player=sanitizePlayer(message.player);
      if(!player) return;
      player.id=connection.peer;
      state.peers.set(connection.peer,player);
      for(const [id,client] of state.network.conns){
        if(id!==connection.peer&&client.open) client.send({type:"peerState",player});
      }
    }
  });
  connection.on("close",()=>{
    state.network.conns.delete(connection.peer);
    state.peers.delete(connection.peer);
    for(const client of state.network.conns.values()) if(client.open) client.send({type:"peerLeft",id:connection.peer});
  });
  connection.on("error",console.error);
}

function joinLobby(){
  if(!initPeerOrWarn()) return;
  cleanupNetwork();
  const code=$("joinCode").value.trim().toUpperCase().replace(/[^A-Z2-9]/g,"").slice(0,6);
  if(code.length!==6){
    alert("Bitte einen 6-stelligen Lobby-Code eingeben.");
    return;
  }
  const peer=new Peer();
  state.network.peer=peer;
  state.network.mode="client";
  state.network.lobbyCode=code;
  setNetStatus("Verbinde · "+code,false);

  peer.on("open",(id)=>{
    state.player.id=id;
    const connection=peer.connect("archipel-rpg-"+code,{reliable:true});
    state.network.hostConn=connection;
    bindClientConnection(connection,code);
  });
  peer.on("error",(error)=>{
    console.error(error);
    alert("Multiplayer-Fehler: "+error.type);
    cleanupNetwork();
  });
}

function bindClientConnection(connection,code){
  connection.on("open",()=>{
    setNetStatus("Lobby · "+code,true);
    connection.send({type:"hello",player:publicPlayer()});
    if(!state.running) startGame();
  });
  connection.on("data",(message)=>{
    if(!message||typeof message!=="object") return;
    if(message.type==="welcome"){
      const host=sanitizePlayer(message.host);
      if(host){host.id=connection.peer;state.peers.set(connection.peer,host);}
      for(const raw of message.players||[]){
        const player=sanitizePlayer(raw);
        if(player&&player.id!==state.player.id) state.peers.set(player.id,player);
      }
    }else if(message.type==="peerState"){
      const player=sanitizePlayer(message.player);
      if(player&&player.id!==state.player.id) state.peers.set(player.id,player);
    }else if(message.type==="peerLeft"){
      state.peers.delete(String(message.id));
    }
  });
  connection.on("close",()=>{
    setNetStatus("Verbindung zum Host getrennt",false);
    showToast("Host-Verbindung getrennt",2800);
  });
  connection.on("error",console.error);
}

function broadcast(message){
  const network=state.network;
  if(network.mode==="host"){
    for(const connection of network.conns.values()) if(connection.open) connection.send(message);
  }else if(network.mode==="client"&&network.hostConn&&network.hostConn.open){
    network.hostConn.send(message);
  }
}

function maybeSendNetwork(ts){
  if(ts-state.lastNetSend<1000/NET_SEND_HZ) return;
  state.lastNetSend=ts;
  const message={type:"state",player:publicPlayer()};
  if(state.network.mode==="host"){
    for(const connection of state.network.conns.values()) if(connection.open) connection.send({type:"peerState",player:message.player});
  }else if(state.network.mode==="client"&&state.network.hostConn&&state.network.hostConn.open){
    state.network.hostConn.send(message);
  }
}

function togglePause(force){
  state.paused=force??!state.paused;
  $("pauseMenu").classList.toggle("hidden",!state.paused);
}

function toggleMap(force){
  state.mapOpen=force??!state.mapOpen;
  $("mapOverlay").classList.toggle("hidden",!state.mapOpen);
  if(state.mapOpen) drawWorldMap();
}

window.addEventListener("keydown",(event)=>{
  const key=event.key.toLowerCase();
  if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright","shift"].includes(key)){
    state.keys.add(key);
    event.preventDefault();
  }
  if(key==="escape"&&state.running){
    if(state.mapOpen) toggleMap(false);
    else togglePause();
    event.preventDefault();
  }
  if(key==="m"&&state.running&&!event.repeat){
    toggleMap();
    event.preventDefault();
  }
});
window.addEventListener("keyup",(event)=>state.keys.delete(event.key.toLowerCase()));
window.addEventListener("blur",()=>state.keys.clear());

$("beginBtn").addEventListener("click",()=>showMenu(false));
$("multiplayerTitleBtn").addEventListener("click",()=>showMenu(true));
$("backTitleBtn").addEventListener("click",()=>{cleanupNetwork();showTitle();});

["playerName","skinSelect","eyeSelect","hairSelect","hairStyleSelect","shirtSelect","cloakSelect"].forEach((id)=>{
  $(id).addEventListener("input",updatePortrait);
});

$("previewLeftBtn").addEventListener("click",()=>{
  state.previewDirection=(state.previewDirection+1)%directions.length;
  updatePreviewDirection();
});
$("previewRightBtn").addEventListener("click",()=>{
  state.previewDirection=(state.previewDirection+directions.length-1)%directions.length;
  updatePreviewDirection();
});

$("soloBtn").addEventListener("click",()=>{
  cleanupNetwork();
  state.player.id="local-"+Math.random().toString(36).slice(2,8);
  startGame();
});
$("hostBtn").addEventListener("click",()=>{
  if($("hostBtn").dataset.ready==="true") startGame();
  else hostLobby();
});
$("joinBtn").addEventListener("click",joinLobby);
$("joinCode").addEventListener("keydown",(event)=>{if(event.key==="Enter") joinLobby();});
$("copyCodeBtn").addEventListener("click",async()=>{
  try{
    await navigator.clipboard.writeText(state.network.lobbyCode||"");
    $("copyCodeBtn").textContent="Kopiert";
    setTimeout(()=>$("copyCodeBtn").textContent="Kopieren",1200);
  }catch{
    alert("Code: "+(state.network.lobbyCode||""));
  }
});
$("resumeBtn").addEventListener("click",()=>togglePause(false));
$("openMapBtn").addEventListener("click",()=>{togglePause(false);toggleMap(true);});
$("leaveBtn").addEventListener("click",()=>{
  state.running=false;
  cleanupNetwork();
  togglePause(false);
  toggleMap(false);
  showTitle();
});
$("closeMapBtn").addEventListener("click",()=>toggleMap(false));

renderTitleMap();
updatePreviewDirection();
updatePortrait();
requestAnimationFrame(paintPreview);

window.__ARCHIPELAGO_DEBUG__ = {
  terrainAt,
  islandField,
  landmarks,
  rivers,
  routes,
  state
};
})();
