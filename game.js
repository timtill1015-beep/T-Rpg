(() => {
"use strict";

const WORLD_SIZE = 20000;
// One visible world block is eight metres. Terrain, roads, rivers, trees and
// structures all use this same grid; only tiny ground clutter may use sub-blocks.
const TILE_METERS = 8;
const VIEW_SCALE = 2.35;
const PLAYER_SPEED = 44;
const SPRINT_MULTIPLIER = 1.55;
// The in-world sprite is roughly two world blocks tall, matching the grid scale.
const WORLD_CHARACTER_SCALE = 1.65;
const PLAYER_RADIUS = 2.15;
const NET_SEND_HZ = 12;
const MAP_SAMPLE = 4;
const TREE_PLOT_TILES = 4;
const RIVER_TRACE_STEP = TILE_METERS * 8;
const RIVER_INDEX_METERS = TILE_METERS * 8;
const SWIM_STAMINA_DRAIN = 8;
const DEEP_SWIM_STAMINA_DRAIN = 14;
const DROWNING_DAMAGE = 28;

const snapToGrid = (value) => Math.round(value / TILE_METERS) * TILE_METERS;

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
  camera: {x:10000,y:10000},
  effects: [],
  footstepDistance: 0,
  blockedUntil: 0,
  interactionTarget: null,
  dead: false,
  lastSafe: {x:9000,y:11200},
  debug: {enabled:false},
  player: {
    id: "local",
    name: "Abenteurer",
    x: 10000,
    y: 10000,
    dir: "down",
    moving: false,
    walkTime: 0,
    health: 100,
    stamina: 100,
    swimming: false,
    drowning: false,
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
  packIce: "#b9d7d7",
  glacier: "#d8e8e5",
  tundra: "#7e927e",
  beach: "#cdb36b",
  desert: "#c59a50",
  oasis: "#4f8552",
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
  packIce: "Nördliches Packeis",
  glacier: "Polargletscher",
  tundra: "Frosttundra",
  beach: "Dünenküste",
  desert: "Sonnenwüste",
  oasis: "Oasengarten",
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
  [0.30,0.12,0.27,0.105,-0.10,0.83,71],
  [0.66,0.115,0.31,0.115,0.08,0.86,72],
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
  [0.91,0.49,0.043,0.068,-0.38,0.45,63],
  [0.31,0.875,0.27,0.105,0.08,0.86,81],
  [0.67,0.865,0.30,0.12,-0.11,0.90,82]
];

// Anchors only select a mountain catchment. The actual rivers are traced from
// high ground to the coast and every stored point is lower than the previous
// one, so a river can no longer run uphill or end in the middle of a field.
const riverSources = [
  {name:"Silberlauf",anchor:[0.50,0.48],width:24},
  {name:"Dornfluss",anchor:[0.57,0.50],width:21},
  {name:"Nebelaue",anchor:[0.40,0.48],width:19},
  {name:"Nordstrom",anchor:[0.24,0.26],width:18},
  {name:"Königsbach",anchor:[0.75,0.27],width:19},
  {name:"Südader",anchor:[0.76,0.72],width:18},
  {name:"Frostwasser",anchor:[0.40,0.13],width:17},
  {name:"Sonnenader",anchor:[0.63,0.85],width:16}
];
let rivers = [];
const riverSegmentIndex = new Map();

const routes = [
  [[0.39,0.53],[0.43,0.56],[0.48,0.58],[0.54,0.56],[0.59,0.52],[0.57,0.45]],
  [[0.48,0.58],[0.47,0.63],[0.44,0.67]],
  [[0.43,0.56],[0.39,0.50],[0.38,0.46]],
  [[0.24,0.27],[0.31,0.20],[0.405,0.125]],
  [[0.765,0.727],[0.71,0.78],[0.635,0.845],[0.49,0.875],[0.335,0.865]]
];

const landmarks = [
  {x:snapToGrid(WORLD_SIZE*.482),y:snapToGrid(WORLD_SIZE*.582),name:"Hafen Dornwacht",short:"Dornwacht",type:"town"},
  {x:snapToGrid(WORLD_SIZE*.389),y:snapToGrid(WORLD_SIZE*.505),name:"Moorhain",short:"Moorhain",type:"town"},
  {x:snapToGrid(WORLD_SIZE*.570),y:snapToGrid(WORLD_SIZE*.450),name:"Sonnenkliff",short:"Sonnenkliff",type:"town"},
  {x:snapToGrid(WORLD_SIZE*.536),y:snapToGrid(WORLD_SIZE*.546),name:"Tempel der Gezeiten",short:"Gezeitentempel",type:"ruin"},
  {x:snapToGrid(WORLD_SIZE*.242),y:snapToGrid(WORLD_SIZE*.271),name:"Nordwacht",short:"Nordwacht",type:"town"},
  {x:snapToGrid(WORLD_SIZE*.756),y:snapToGrid(WORLD_SIZE*.286),name:"Ruinen von Königsfall",short:"Königsfall",type:"ruin"},
  {x:snapToGrid(WORLD_SIZE*.765),y:snapToGrid(WORLD_SIZE*.727),name:"Südmark",short:"Südmark",type:"town"},
  {x:snapToGrid(WORLD_SIZE*.405),y:snapToGrid(WORLD_SIZE*.125),name:"Forscherdorf Eiswacht",short:"Eiswacht",type:"town"},
  {x:snapToGrid(WORLD_SIZE*.635),y:snapToGrid(WORLD_SIZE*.845),name:"Oase von Sahra",short:"Oase Sahra",type:"town"},
  {x:snapToGrid(WORLD_SIZE*.335),y:snapToGrid(WORLD_SIZE*.865),name:"Versunkene Sonnenuhr",short:"Sonnenuhr",type:"ruin"}
];

const terrainCache = new Map();
const visualTileCache = new Map();
const treePlotCache = new Map();

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

function findRiverSource(source){
  const centreX=source.anchor[0]*WORLD_SIZE;
  const centreY=source.anchor[1]*WORLD_SIZE;
  let best={x:snapToGrid(centreX),y:snapToGrid(centreY),height:-Infinity};
  for(let oy=-960;oy<=960;oy+=128){
    for(let ox=-960;ox<=960;ox+=128){
      const x=snapToGrid(centreX+ox);
      const y=snapToGrid(centreY+oy);
      const height=islandField(x,y);
      if(height>best.height && height<.82) best={x,y,height};
    }
  }
  return best;
}

function findLowerOutlet(current,previousAngle,visited){
  for(let ring=1;ring<=30;ring++){
    const radius=RIVER_TRACE_STEP*ring;
    let best=null;
    for(let direction=0;direction<32;direction++){
      const angle=direction/32*Math.PI*2;
      const x=snapToGrid(current.x+Math.cos(angle)*radius);
      const y=snapToGrid(current.y+Math.sin(angle)*radius);
      if(x<0||y<0||x>WORLD_SIZE||y>WORLD_SIZE) continue;
      const key=Math.round(x/RIVER_TRACE_STEP)+","+Math.round(y/RIVER_TRACE_STEP);
      if(visited.has(key)) continue;
      const height=islandField(x,y);
      if(height>=current.height-.0012) continue;
      const turn=previousAngle==null?0:Math.abs(Math.atan2(Math.sin(angle-previousAngle),Math.cos(angle-previousAngle)));
      const score=height+turn*.006+hash2(Math.round(x/32),Math.round(y/32),2401)*.002;
      if(!best||score<best.score) best={x,y,height,angle,score,key};
    }
    if(best) return best;
  }
  return null;
}

function traceRiver(source,index){
  let current=findRiverSource(source);
  let previousAngle=null;
  const points=[{x:current.x,y:current.y,bed:current.height}];
  const visited=new Set();
  visited.add(Math.round(current.x/RIVER_TRACE_STEP)+","+Math.round(current.y/RIVER_TRACE_STEP));

  for(let section=0;section<190&&current.height>.125;section++){
    const outlet=findLowerOutlet(current,previousAngle,visited);
    if(!outlet) break;
    const distance=Math.hypot(outlet.x-current.x,outlet.y-current.y);
    const steps=Math.max(1,Math.round(distance/RIVER_TRACE_STEP));
    const nx=-(outlet.y-current.y)/distance;
    const ny=(outlet.x-current.x)/distance;
    const bend=(hash2(index,section,2601)-.5)*Math.min(22,distance*.12);
    for(let step=1;step<=steps;step++){
      const t=step/steps;
      const meander=Math.sin(t*Math.PI)*bend;
      points.push({
        x:snapToGrid(lerp(current.x,outlet.x,t)+nx*meander),
        y:snapToGrid(lerp(current.y,outlet.y,t)+ny*meander),
        bed:lerp(current.height,outlet.height,t)-points.length*.0000005
      });
    }
    previousAngle=outlet.angle;
    current=outlet;
    visited.add(outlet.key);
  }

  return {
    name:source.name,
    width:source.width,
    points,
    source:points[0],
    mouth:points[points.length-1]
  };
}

function ensureRivers(){
  if(rivers.length) return rivers;
  rivers=riverSources.map(traceRiver).filter((river)=>river.points.length>3&&river.mouth.bed<.18);
  for(const river of rivers){
    for(let index=0;index<river.points.length-1;index++){
      const a=river.points[index];
      const b=river.points[index+1];
      const padding=river.width;
      const minX=Math.floor((Math.min(a.x,b.x)-padding)/RIVER_INDEX_METERS);
      const maxX=Math.floor((Math.max(a.x,b.x)+padding)/RIVER_INDEX_METERS);
      const minY=Math.floor((Math.min(a.y,b.y)-padding)/RIVER_INDEX_METERS);
      const maxY=Math.floor((Math.max(a.y,b.y)+padding)/RIVER_INDEX_METERS);
      for(let by=minY;by<=maxY;by++){
        for(let bx=minX;bx<=maxX;bx++){
          const key=bx+","+by;
          if(!riverSegmentIndex.has(key)) riverSegmentIndex.set(key,[]);
          riverSegmentIndex.get(key).push({river,index,a,b});
        }
      }
    }
  }
  return rivers;
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
  if(height<0.12 || height>0.82) return null;
  ensureRivers();
  const candidates=riverSegmentIndex.get(Math.floor(x/RIVER_INDEX_METERS)+","+Math.floor(y/RIVER_INDEX_METERS))||[];
  for(const candidate of candidates){
      const {river,index:i,a,b}=candidate;
      const hit=segmentDistance(x,y,a.x,a.y,b.x,b.y);
      const flow=(i+hit.t)/(river.points.length-1);
      const width=river.width*(.55+flow*.9);
      if(hit.distance<width*.5){
        const length=Math.hypot(b.x-a.x,b.y-a.y)||1;
        return {river,flow,bed:lerp(a.bed,b.bed,hit.t),dirX:(b.x-a.x)/length,dirY:(b.y-a.y)/length};
      }
  }
  return null;
}

function roadAt(x,y){
  // Roads occupy complete world blocks. Sampling the block centre turns every
  // diagonal into an intentional pixel staircase instead of a smooth vector line.
  const gx=Math.floor(Math.max(0,Math.min(WORLD_SIZE-.001,x))/TILE_METERS);
  const gy=Math.floor(Math.max(0,Math.min(WORLD_SIZE-.001,y))/TILE_METERS);
  const nx=(gx*TILE_METERS+TILE_METERS/2)/WORLD_SIZE;
  const ny=(gy*TILE_METERS+TILE_METERS/2)/WORLD_SIZE;
  const halfWidth=TILE_METERS*.78/WORLD_SIZE;
  for(const route of routes){
    for(let i=0;i<route.length-1;i++){
      const a=route[i];
      const b=route[i+1];
      if(segmentDistance(nx,ny,a[0],a[1],b[0],b[1]).distance<halfWidth) return true;
    }
  }
  return false;
}

function terrainAt(x,y){
  const gx=Math.floor(Math.max(0,Math.min(WORLD_SIZE-.001,x))/TILE_METERS);
  const gy=Math.floor(Math.max(0,Math.min(WORLD_SIZE-.001,y))/TILE_METERS);
  const key=gx+","+gy;
  const cached=terrainCache.get(key);
  if(cached) return cached;
  x=gx*TILE_METERS+TILE_METERS/2;
  y=gy*TILE_METERS+TILE_METERS/2;
  const h=islandField(x,y);
  const moisture=fbm(x+1337,y-904,400);
  const latitude=y/WORLD_SIZE;
  const temp=1-Math.abs(latitude-0.5)*1.22+(valueNoise(x,y,900,225)-0.5)*0.18;
  let biome;

  if(latitude<.065) biome="packIce";
  else if(h<0.045) biome=latitude<.135?"packIce":"deepWater";
  else if(h<0.09) biome=latitude<.145?"packIce":"water";
  else if(h<0.145) biome=latitude<.16?"packIce":"shallow";
  else if(h<0.195) biome=latitude<.19?"tundra":"beach";
  else if(latitude<.205) biome=h>.57?"glacier":"tundra";
  else if(latitude>.765){
    const oasisNoise=valueNoise(x+420,y-180,680,388);
    const forcedOasis=Math.hypot(x-WORLD_SIZE*.635,y-WORLD_SIZE*.845)<WORLD_SIZE*.024;
    if(h>.66) biome="mountain";
    else if(h>.57) biome="rock";
    else if(forcedOasis||(moisture>.64&&oasisNoise>.56)) biome="oasis";
    else biome="desert";
  }else if(h>0.68 && temp<0.55) biome="snow";
  else if(h>0.60) biome="mountain";
  else if(h>0.51) biome="rock";
  else if(moisture>0.69 && temp>0.67) biome="jungle";
  else if(moisture>0.73) biome="swamp";
  else if(moisture>0.51) biome="forest";
  else biome="plains";

  const river=riverAt(x,y,h);
  if(river && !["deepWater","water","shallow","packIce","glacier","snow"].includes(biome)) biome="river";
  const result={height:h,moisture,temp,latitude,biome,river,gx,gy};
  terrainCache.set(key,result);
  return result;
}

function isWalkable(x,y){
  const biome=terrainAt(x,y).biome;
  return !["deepWater","water","shallow"].includes(biome);
}

function isSwimmingBiome(biome){
  return biome==="water"||biome==="deepWater";
}

function isSafeGroundBiome(biome){
  return !["deepWater","water","shallow","river"].includes(biome);
}

function findSpawn(){
  const candidates=[[9000,11400],[9400,11320],[8900,11100],[7780,10100],[11400,9000]];
  for(const point of candidates) if(isWalkable(point[0],point[1])&&canOccupy(point[0],point[1]).ok) return point;
  for(let r=0;r<350;r++){
    const x=10000+(hash2(r,1)-0.5)*6000;
    const y=10400+(hash2(r,2)-0.5)*6000;
    if(isWalkable(x,y)&&canOccupy(x,y).ok) return [x,y];
  }
  return [10000,10000];
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
  // These are deliberately small overlays. Large vegetation is generated as
  // multi-block grid objects by drawVisibleTrees().
  if((biome==="forest"||biome==="jungle") && r>0.82) return r>.94?"mushrooms":r>.88?"fern":"grass";
  if(biome==="plains" && r>0.84) return r>0.94?"flowers":"grass";
  if(biome==="swamp" && r>0.82) return "reeds";
  if((biome==="rock"||biome==="mountain") && r>0.70) return "rock";
  if(biome==="beach" && r>0.91) return r>0.97?"driftwood":"shell";
  if((biome==="river"||biome==="oasis") && r>0.80) return r>.94?"lilies":"reeds";
  if((biome==="tundra"||biome==="glacier") && r>.82) return r>.95?"iceCrystal":"snowTuft";
  if(biome==="packIce" && r>.90) return "iceCrack";
  if(biome==="desert" && r>.82) return r>.96?"bones":"duneGrass";
  if(biome==="shallow" && r>.94) return "fish";
  return null;
}

function drawDecoration(kind,px,py,size){
  if(kind==="reeds"){
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
  }else if(kind==="mushrooms"){
    ctx.fillStyle="#e7d8bc";
    ctx.fillRect(px-size*.11,py,size*.04,size*.14);
    ctx.fillRect(px+size*.08,py+size*.03,size*.04,size*.11);
    ctx.fillStyle="#a85d4e";
    ctx.fillRect(px-size*.16,py-size*.05,size*.14,size*.07);
    ctx.fillStyle="#d1a45d";
    ctx.fillRect(px+size*.03,py,size*.14,size*.06);
  }else if(kind==="fern"){
    ctx.fillStyle="#315f39";
    ctx.fillRect(px,py-size*.17,size*.035,size*.31);
    for(let i=-2;i<=2;i++){
      ctx.fillRect(px-size*.05,py+i*size*.055,size*.13,size*.035);
      ctx.fillRect(px-size*.15,py+(i+.45)*size*.055,size*.13,size*.035);
    }
  }else if(kind==="lilies"){
    ctx.fillStyle="#47794b";
    ctx.fillRect(px-size*.19,py-size*.06,size*.18,size*.10);
    ctx.fillRect(px+size*.04,py+size*.03,size*.17,size*.09);
    ctx.fillStyle="#f2cbd4";
    ctx.fillRect(px-size*.03,py-size*.08,size*.07,size*.07);
  }else if(kind==="iceCrystal"){
    ctx.fillStyle="#eaf8f4";
    ctx.fillRect(px-size*.05,py-size*.25,size*.10,size*.36);
    ctx.fillStyle="#9ecaca";
    ctx.fillRect(px-size*.14,py-size*.08,size*.09,size*.22);
    ctx.fillRect(px+size*.06,py-size*.14,size*.08,size*.25);
  }else if(kind==="snowTuft"){
    ctx.fillStyle="#d9e6df";
    ctx.fillRect(px-size*.20,py,size*.42,size*.10);
    ctx.fillStyle="#f5faf5";
    ctx.fillRect(px-size*.10,py-size*.08,size*.23,size*.09);
  }else if(kind==="iceCrack"){
    ctx.fillStyle="#739eaa";
    ctx.fillRect(px-size*.22,py,size*.18,size*.035);
    ctx.fillRect(px-size*.05,py,size*.035,size*.13);
    ctx.fillRect(px-size*.02,py+size*.10,size*.18,size*.035);
  }else if(kind==="duneGrass"){
    ctx.fillStyle="#806b38";
    ctx.fillRect(px-size*.10,py-size*.08,size*.035,size*.23);
    ctx.fillRect(px,py-size*.14,size*.035,size*.29);
    ctx.fillRect(px+size*.10,py-size*.05,size*.035,size*.20);
  }else if(kind==="bones"){
    ctx.fillStyle="#e6d7aa";
    ctx.fillRect(px-size*.20,py,size*.38,size*.055);
    ctx.fillRect(px-size*.23,py-size*.04,size*.08,size*.12);
    ctx.fillRect(px+size*.14,py-size*.04,size*.08,size*.12);
  }else if(kind==="fish"){
    const swim=(state.elapsed*7+px*.01)%1;
    ctx.fillStyle="rgba(224,237,218,.48)";
    ctx.fillRect(px-size*.12+swim*size*.08,py-size*.03,size*.17,size*.06);
    ctx.fillRect(px-size*.18+swim*size*.08,py-size*.07,size*.07,size*.14);
  }
}

function drawGridBlock(gx,gy,camX,camY,color,accent=null){
  const size=TILE_METERS*VIEW_SCALE;
  const x=(gx*TILE_METERS-camX)*VIEW_SCALE+canvas.width/2;
  const y=(gy*TILE_METERS-camY)*VIEW_SCALE+canvas.height/2;
  const px=Math.floor(x);
  const py=Math.floor(y);
  const block=Math.ceil(size)+1;
  ctx.fillStyle=color;
  ctx.fillRect(px,py,block,block);
  ctx.fillStyle="rgba(7,14,12,.20)";
  ctx.fillRect(px,py+block-2,block,2);
  ctx.fillRect(px+block-2,py,2,block);
  ctx.fillStyle="rgba(255,255,230,.10)";
  ctx.fillRect(px+1,py+1,block-3,2);
  if(accent){
    ctx.fillStyle=accent;
    const chip=Math.max(2,Math.floor(block*.22));
    ctx.fillRect(px+3,py+3,chip,chip);
  }
}

function nearLandmarkGrid(gx,gy,padding=0){
  for(const landmark of landmarks){
    const lx=Math.round(landmark.x/TILE_METERS);
    const ly=Math.round(landmark.y/TILE_METERS);
    const rx=landmark.type==="town"?8:6;
    const ry=landmark.type==="town"?7:6;
    if(Math.abs(gx-lx)<=rx+padding && Math.abs(gy-ly)<=ry+padding) return true;
  }
  return false;
}

function treeForPlot(plotX,plotY){
  const cacheKey=plotX+","+plotY;
  if(treePlotCache.has(cacheKey)) return treePlotCache.get(cacheKey);
  const plotSeed=hash2(plotX,plotY,1701);
  const speciesSeed=hash2(plotX,plotY,1703);
  const gx=plotX*TREE_PLOT_TILES+1+Math.floor(hash2(plotX,plotY,1702)*2);
  const gy=plotY*TREE_PLOT_TILES+2;
  if(nearLandmarkGrid(gx,gy,3)){
    treePlotCache.set(cacheKey,null);
    return null;
  }
  const terrain=terrainAt((gx+.5)*TILE_METERS,(gy+.5)*TILE_METERS);
  let chance=0;
  let kind="oak";
  if(terrain.biome==="forest"){
    chance=.88;
    kind=speciesSeed<.34?"oak":speciesSeed<.52?"birch":speciesSeed<.74?"ancient":"pine";
  }else if(terrain.biome==="jungle"){
    chance=.94;
    kind=speciesSeed>.76?"palm":"jungle";
  }else if(terrain.biome==="swamp"){
    chance=.54;
    kind=speciesSeed>.56?"willow":"dead";
  }else if(terrain.biome==="plains"){
    chance=.11;
    kind=speciesSeed>.72?"birch":"oak";
  }else if(terrain.biome==="tundra"){
    chance=.31;
    kind=speciesSeed>.72?"iceSpire":"frostPine";
  }else if(terrain.biome==="glacier"){
    chance=.12;
    kind="iceSpire";
  }else if(terrain.biome==="desert"){
    chance=.18;
    kind=speciesSeed>.76?"acacia":"cactus";
  }else if(terrain.biome==="oasis"){
    chance=.79;
    kind=speciesSeed>.42?"palm":"acacia";
  }
  if(plotSeed>chance){
    treePlotCache.set(cacheKey,null);
    return null;
  }
  const tree={
    gx,gy,kind,
    variant:Math.floor(hash2(plotX,plotY,1711)*3),
    phase:hash2(plotX,plotY,1712)*Math.PI*2,
    reactUntil:0
  };
  treePlotCache.set(cacheKey,tree);
  return tree;
}

const treeShapes = {
  oak:[
    [[-1,-4],[0,-4],[1,-4],[-2,-3],[-1,-3],[0,-3],[1,-3],[2,-3],[-2,-2],[-1,-2],[0,-2],[1,-2],[2,-2],[-1,-1],[0,-1],[1,-1]],
    [[0,-5],[-1,-4],[0,-4],[1,-4],[-2,-3],[-1,-3],[0,-3],[1,-3],[2,-3],[-2,-2],[-1,-2],[0,-2],[1,-2],[2,-2],[0,-1]],
    [[-1,-4],[0,-4],[-2,-3],[-1,-3],[0,-3],[1,-3],[-2,-2],[-1,-2],[0,-2],[1,-2],[2,-2],[-1,-1],[0,-1],[1,-1]]
  ],
  birch:[
    [[0,-5],[-1,-4],[0,-4],[1,-4],[-1,-3],[0,-3],[1,-3],[-1,-2],[0,-2],[1,-2],[0,-1]],
    [[-1,-5],[0,-5],[-1,-4],[0,-4],[1,-4],[-2,-3],[-1,-3],[0,-3],[1,-3],[-1,-2],[0,-2],[1,-2],[0,-1]],
    [[0,-5],[-1,-4],[0,-4],[-2,-3],[-1,-3],[0,-3],[1,-3],[-1,-2],[0,-2],[1,-2],[0,-1]]
  ],
  ancient:[
    [[-1,-5],[0,-5],[1,-5],[-2,-4],[-1,-4],[0,-4],[1,-4],[2,-4],[-3,-3],[-2,-3],[-1,-3],[0,-3],[1,-3],[2,-3],[3,-3],[-2,-2],[-1,-2],[0,-2],[1,-2],[2,-2],[-1,-1],[0,-1],[1,-1]],
    [[0,-5],[-2,-4],[-1,-4],[0,-4],[1,-4],[2,-4],[-3,-3],[-2,-3],[-1,-3],[0,-3],[1,-3],[2,-3],[-2,-2],[-1,-2],[0,-2],[1,-2],[2,-2],[3,-2],[-1,-1],[0,-1],[1,-1]],
    [[-1,-5],[0,-5],[1,-5],[-2,-4],[-1,-4],[0,-4],[1,-4],[-3,-3],[-2,-3],[-1,-3],[0,-3],[1,-3],[2,-3],[-2,-2],[-1,-2],[0,-2],[1,-2],[2,-2],[-1,-1],[0,-1],[1,-1]]
  ],
  pine:[
    [[0,-6],[-1,-5],[0,-5],[1,-5],[-1,-4],[0,-4],[1,-4],[-2,-3],[-1,-3],[0,-3],[1,-3],[2,-3],[-2,-2],[-1,-2],[0,-2],[1,-2],[2,-2],[0,-1]],
    [[0,-7],[-1,-6],[0,-6],[1,-6],[-1,-5],[0,-5],[1,-5],[-2,-4],[-1,-4],[0,-4],[1,-4],[2,-4],[-1,-3],[0,-3],[1,-3],[-2,-2],[-1,-2],[0,-2],[1,-2],[2,-2],[0,-1]],
    [[0,-6],[-1,-5],[0,-5],[1,-5],[-2,-4],[-1,-4],[0,-4],[1,-4],[2,-4],[-1,-3],[0,-3],[1,-3],[-2,-2],[-1,-2],[0,-2],[1,-2],[2,-2],[0,-1]]
  ],
  jungle:[
    [[-1,-5],[0,-5],[1,-5],[-2,-4],[-1,-4],[0,-4],[1,-4],[2,-4],[-2,-3],[-1,-3],[0,-3],[1,-3],[2,-3],[-1,-2],[0,-2],[1,-2],[0,-1]],
    [[0,-5],[-2,-4],[-1,-4],[0,-4],[1,-4],[2,-4],[-3,-3],[-2,-3],[-1,-3],[0,-3],[1,-3],[2,-3],[-2,-2],[-1,-2],[0,-2],[1,-2],[2,-2],[0,-1]],
    [[-1,-5],[0,-5],[-2,-4],[-1,-4],[0,-4],[1,-4],[-2,-3],[-1,-3],[0,-3],[1,-3],[2,-3],[-1,-2],[0,-2],[1,-2],[0,-1]]
  ],
  willow:[
    [[-1,-5],[0,-5],[1,-5],[-2,-4],[-1,-4],[0,-4],[1,-4],[2,-4],[-2,-3],[-1,-3],[0,-3],[1,-3],[2,-3],[-2,-2],[-1,-2],[0,-2],[1,-2],[2,-2],[-2,-1],[0,-1],[2,-1]],
    [[0,-5],[-2,-4],[-1,-4],[0,-4],[1,-4],[-3,-3],[-2,-3],[-1,-3],[0,-3],[1,-3],[2,-3],[-2,-2],[-1,-2],[0,-2],[1,-2],[2,-2],[-2,-1],[1,-1]],
    [[-1,-5],[0,-5],[1,-5],[-2,-4],[-1,-4],[0,-4],[1,-4],[2,-4],[-2,-3],[-1,-3],[0,-3],[1,-3],[2,-3],[-1,-2],[0,-2],[1,-2],[-2,-1],[2,-1]]
  ],
  frostPine:[
    [[0,-7],[-1,-6],[0,-6],[1,-6],[-1,-5],[0,-5],[1,-5],[-2,-4],[-1,-4],[0,-4],[1,-4],[2,-4],[-1,-3],[0,-3],[1,-3],[-2,-2],[-1,-2],[0,-2],[1,-2],[2,-2],[0,-1]],
    [[0,-6],[-1,-5],[0,-5],[1,-5],[-2,-4],[-1,-4],[0,-4],[1,-4],[2,-4],[-1,-3],[0,-3],[1,-3],[-2,-2],[-1,-2],[0,-2],[1,-2],[2,-2],[0,-1]],
    [[0,-7],[-1,-6],[0,-6],[1,-6],[-1,-5],[0,-5],[1,-5],[-2,-4],[-1,-4],[0,-4],[1,-4],[2,-4],[-2,-3],[-1,-3],[0,-3],[1,-3],[2,-3],[-1,-2],[0,-2],[1,-2],[0,-1]]
  ],
  acacia:[
    [[-2,-4],[-1,-4],[0,-4],[1,-4],[2,-4],[-3,-3],[-2,-3],[-1,-3],[0,-3],[1,-3],[2,-3],[3,-3],[-2,-2],[-1,-2],[0,-2],[1,-2],[2,-2]],
    [[-3,-4],[-2,-4],[-1,-4],[0,-4],[1,-4],[2,-4],[-3,-3],[-2,-3],[-1,-3],[0,-3],[1,-3],[2,-3],[3,-3],[-1,-2],[0,-2],[1,-2],[2,-2]],
    [[-2,-5],[-1,-5],[0,-5],[1,-5],[-3,-4],[-2,-4],[-1,-4],[0,-4],[1,-4],[2,-4],[3,-4],[-2,-3],[-1,-3],[0,-3],[1,-3],[2,-3],[0,-2]]
  ]
};

const treePalettes = {
  oak:["#254b2e","#37663a","#4f7d43"],
  birch:["#315b37","#477747","#6b9557"],
  ancient:["#1e432b","#2c5a34","#477443"],
  pine:["#17382c","#23503a","#376748"],
  jungle:["#16402a","#245b32","#3e743d"],
  willow:["#334d2d","#4e6838","#73834a"],
  frostPine:["#315c58","#4f7b72","#8da79a"],
  acacia:["#4e572d","#6f7134","#9a8d46"]
};

function drawTreeBlock(gx,gy,camX,camY,colors,seed){
  const size=TILE_METERS*VIEW_SCALE;
  const x=Math.floor((gx*TILE_METERS-camX)*VIEW_SCALE+canvas.width/2);
  const y=Math.floor((gy*TILE_METERS-camY)*VIEW_SCALE+canvas.height/2);
  const block=Math.ceil(size)+1;
  ctx.fillStyle=colors[1];
  ctx.fillRect(x,y,block,block);
  ctx.fillStyle=colors[0];
  ctx.fillRect(x,y+block-3,block,3);
  ctx.fillRect(x+block-3,y,3,block);
  ctx.fillStyle=colors[2];
  const chip=Math.max(2,Math.floor(block*.22));
  const side=hash2(gx,gy,seed)>.5?3:block-chip-3;
  ctx.fillRect(x+side,y+3,chip,chip);
  if(hash2(gx,gy,seed+1)>.58){
    ctx.fillStyle=colors[0];
    ctx.fillRect(x+3,y+Math.floor(block*.56),chip,chip);
  }
}

function drawGridTree(tree,camX,camY){
  const {gx,gy,kind}=tree;
  const distance=Math.hypot(state.player.x-(gx+.5)*TILE_METERS,state.player.y-(gy+.5)*TILE_METERS);
  const reaction=tree.reactUntil>state.elapsed?1:Math.max(0,1-distance/24);
  const sway=Math.sin(state.elapsed*(reaction?9:1.2)+tree.phase)*(reaction*1.6+.25);
  const revealPlayer=distance<28&&state.player.y<(gy+.8)*TILE_METERS;
  drawGridBlock(gx-1,gy,camX,camY,"rgba(8,18,12,.16)");

  if(kind==="iceSpire"){
    drawGridBlock(gx,gy,camX,camY,"#8fc5c9","#e7f6f2");
    drawGridBlock(gx,gy-1,camX,camY,"#aad8d7","#f1fbf7");
    drawGridBlock(gx-1,gy,camX,camY,"#6da9b4","#bfe3e0");
    if(tree.variant===2) drawGridBlock(gx+1,gy,camX,camY,"#7fb6bd","#d9efeb");
    return;
  }

  if(kind==="cactus"){
    const cactus=["#386a43","#4e854d","#76a35b"];
    drawGridBlock(gx,gy,camX,camY,cactus[0],cactus[2]);
    drawGridBlock(gx,gy-1,camX,camY,cactus[1],cactus[2]);
    drawGridBlock(gx,gy-2,camX,camY,cactus[1],cactus[2]);
    const side=tree.variant===1?-1:1;
    drawGridBlock(gx+side,gy-1,camX,camY,cactus[0],cactus[2]);
    drawGridBlock(gx+side,gy-2,camX,camY,cactus[1]);
    if(tree.variant===2) drawGridBlock(gx-1,gy,camX,camY,cactus[0],"#d7ba5e");
    return;
  }

  const paleTrunk=kind==="birch";
  const frostTrunk=kind==="frostPine";
  drawGridBlock(gx,gy,camX,camY,paleTrunk?"#9d957d":frostTrunk?"#65706a":kind==="palm"?"#76512e":"#5b3d29",paleTrunk?"#5e5b54":frostTrunk?"#a6b2a8":"#93673a");

  if(kind==="dead"){
    drawGridBlock(gx,gy-1,camX,camY,"#514536","#75634b");
    drawGridBlock(gx,gy-2,camX,camY,"#463c31");
    drawGridBlock(gx-1,gy-2,camX,camY,"#463c31");
    drawGridBlock(gx+1,gy-2,camX,camY,"#514536");
    return;
  }

  if(kind==="palm"){
    drawGridBlock(gx,gy-1,camX,camY,"#76512e","#93673a");
    ctx.save();
    ctx.translate(Math.round(sway),0);
    if(revealPlayer) ctx.globalAlpha=.38;
    const colors=["#1d512e","#2e6a37","#4a8645"];
    for(const [dx,dy] of [[0,-3],[-1,-3],[1,-3],[-2,-3],[2,-3],[0,-4],[-1,-4],[1,-4]]){
      drawTreeBlock(gx+dx,gy+dy,camX,camY,colors,3100+tree.variant);
    }
    ctx.restore();
    return;
  }

  const shapes=treeShapes[kind]||treeShapes.oak;
  const colors=treePalettes[kind]||treePalettes.oak;
  const leafBlocks=shapes[tree.variant%shapes.length];
  ctx.save();
  ctx.translate(Math.round(sway),0);
  if(revealPlayer) ctx.globalAlpha=.38;
  for(const [dx,dy] of leafBlocks) drawTreeBlock(gx+dx,gy+dy,camX,camY,colors,3200+tree.variant);
  ctx.restore();
}

function visibleTrees(startGX,endGX,startGY,endGY){
  const trees=[];
  const minPlotX=Math.floor(startGX/TREE_PLOT_TILES)-1;
  const maxPlotX=Math.floor(endGX/TREE_PLOT_TILES)+1;
  const minPlotY=Math.floor(startGY/TREE_PLOT_TILES)-1;
  const maxPlotY=Math.floor(endGY/TREE_PLOT_TILES)+1;
  for(let py=minPlotY;py<=maxPlotY;py++){
    for(let px=minPlotX;px<=maxPlotX;px++){
      const tree=treeForPlot(px,py);
      if(tree) trees.push(tree);
    }
  }
  return trees;
}

function drawTile(wx,wy,sx,sy,size,terrain){
  const gx=Math.floor(wx/TILE_METERS);
  const gy=Math.floor(wy/TILE_METERS);
  const cacheKey=gx+","+gy;
  let visual=visualTileCache.get(cacheKey);
  if(!visual){
    const n=hash2(gx,gy,77);
    const road=roadAt(wx+TILE_METERS/2,wy+TILE_METERS/2)
      && !["deepWater","water","shallow","river"].includes(terrain.biome);
    const deco=!road&&!nearLandmarkGrid(gx,gy,2)?tileDecoration(wx,wy,terrain.biome):null;
    const variation=Math.round((n-.5)*10);
    visual={
      n,road,deco,
      baseColor:shade(palette[terrain.biome],variation),
      roadColor:road?shade("#9b8255",Math.round((n-.5)*14)):null,
      waterLike:["water","deepWater","shallow","river"].includes(terrain.biome)
    };
    visualTileCache.set(cacheKey,visual);
  }
  const {n,road,deco}=visual;
  ctx.fillStyle=visual.baseColor;
  ctx.fillRect(Math.floor(sx),Math.floor(sy),Math.ceil(size)+1,Math.ceil(size)+1);
  if(road){
    ctx.fillStyle=visual.roadColor;
    ctx.fillRect(Math.floor(sx),Math.floor(sy),Math.ceil(size)+1,Math.ceil(size)+1);
    ctx.fillStyle="rgba(239,211,145,.20)";
    const pebble=Math.max(2,Math.floor(size*.18));
    ctx.fillRect(Math.floor(sx+size*.16),Math.floor(sy+size*.19),pebble,pebble);
    ctx.fillStyle="rgba(66,49,31,.18)";
    ctx.fillRect(Math.floor(sx+size*.66),Math.floor(sy+size*.62),pebble,pebble);
  }

  if(!road&&visual.waterLike){
    if(n>0.48){
      ctx.fillStyle=terrain.biome==="river"?"rgba(224,243,239,.20)":"rgba(210,240,245,.15)";
      ctx.fillRect(Math.floor(sx+size*.12),Math.floor(sy+size*.45),Math.max(2,size*.45),Math.max(1,size*.055));
    }
    if(terrain.biome==="river"&&terrain.river){
      const flow=terrain.river;
      const travel=(state.elapsed*18+(gx*7+gy*11))%Math.max(3,size*.64);
      const alongX=flow.dirX>=0?travel:size*.64-travel;
      const alongY=flow.dirY>=0?travel:size*.64-travel;
      const cx=sx+size*.18+Math.abs(flow.dirX)*alongX;
      const cy=sy+size*.18+Math.abs(flow.dirY)*alongY;
      ctx.fillStyle="rgba(226,247,243,.34)";
      if(Math.abs(flow.dirX)>Math.abs(flow.dirY)) ctx.fillRect(Math.floor(cx),Math.floor(sy+size*.48),Math.max(2,size*.24),2);
      else ctx.fillRect(Math.floor(sx+size*.48),Math.floor(cy),2,Math.max(2,size*.24));
    }
  }else if(terrain.biome==="beach" && n>0.64){
    ctx.fillStyle="rgba(89,70,40,.20)";
    ctx.fillRect(Math.floor(sx+size*.65),Math.floor(sy+size*.30),Math.max(1,size*.08),Math.max(1,size*.08));
  }else if(n>0.72){
    ctx.fillStyle="rgba(0,0,0,.07)";
    ctx.fillRect(Math.floor(sx+size*.15),Math.floor(sy+size*.18),Math.max(1,size*.12),Math.max(1,size*.12));
  }

  if(deco) drawDecoration(deco,Math.floor(sx+size*.5),Math.floor(sy+size*.5),size);
}

const townBlocks = [
  "..RRR..pp.HHH.",
  "..RCR..pp.HDH.",
  "..RRR..pp.HHH.",
  ".......pp.....",
  "pppppppppppppp",
  "pppppppppppppp",
  "...WWW.pp.BBB.",
  "...WDW.pp.BDB.",
  "...WWW.pp.BBB.",
  ".......pp....."
];

const ruinBlocks = [
  "..S...S..",
  ".SS...SS.",
  ".S..p..S.",
  "...ppp...",
  "S..ppp..S",
  "...ppp...",
  ".S..p..S.",
  ".SS...SS.",
  "..S...S.."
];

function structureAtGrid(gx,gy){
  for(const landmark of landmarks){
    const pattern=landmark.type==="town"?townBlocks:ruinBlocks;
    const originGX=Math.round(landmark.x/TILE_METERS)-Math.floor(pattern[0].length/2);
    const originGY=Math.round(landmark.y/TILE_METERS)-Math.floor(pattern.length/2);
    const column=gx-originGX;
    const row=gy-originGY;
    if(row<0||row>=pattern.length||column<0||column>=pattern[row].length) continue;
    const code=pattern[row][column];
    if(code!==".") return {type:"structure",code,landmark,gx,gy};
  }
  return null;
}

function treeAtGrid(gx,gy){
  const plotX=Math.floor(gx/TREE_PLOT_TILES);
  const plotY=Math.floor(gy/TREE_PLOT_TILES);
  for(let py=plotY-1;py<=plotY+1;py++){
    for(let px=plotX-1;px<=plotX+1;px++){
      const tree=treeForPlot(px,py);
      if(tree&&tree.gx===gx&&tree.gy===gy) return tree;
    }
  }
  return null;
}

function collisionAt(x,y){
  if(x<PLAYER_RADIUS||y<PLAYER_RADIUS||x>WORLD_SIZE-PLAYER_RADIUS||y>WORLD_SIZE-PLAYER_RADIUS) return {type:"edge"};
  const gx=Math.floor(x/TILE_METERS);
  const gy=Math.floor(y/TILE_METERS);
  const tree=treeAtGrid(gx,gy);
  if(tree) return {type:"tree",tree,gx,gy};
  const structure=structureAtGrid(gx,gy);
  if(structure&&structure.code!=="p") return structure;
  return null;
}

function canOccupy(x,y){
  const samples=[[0,0],[-1,-1],[1,-1],[-1,1],[1,1],[0,-1],[0,1],[-1,0],[1,0]];
  for(const [sx,sy] of samples){
    const hit=collisionAt(x+sx*PLAYER_RADIUS,y+sy*PLAYER_RADIUS);
    if(hit) return {ok:false,hit};
  }
  return {ok:true,hit:null};
}

function drawStructureBlock(code,gx,gy,camX,camY){
  const colors={
    p:["#9b8255","#c0a36b"],R:["#793e31","#a65a42"],C:["#4b3b34","#78706a"],
    H:["#b18a4b","#d0ae64"],W:["#735037","#aa7a4e"],B:["#4f6570","#748793"],
    D:["#34261d","#b58a52"],S:["#696b65","#929389"]
  };
  const pair=colors[code];
  if(!pair) return;
  drawGridBlock(gx,gy,camX,camY,pair[0],pair[1]);
  if(code==="D"){
    const size=TILE_METERS*VIEW_SCALE;
    const x=Math.floor((gx*TILE_METERS-camX)*VIEW_SCALE+canvas.width/2);
    const y=Math.floor((gy*TILE_METERS-camY)*VIEW_SCALE+canvas.height/2);
    ctx.fillStyle="#e3bd62";
    ctx.fillRect(Math.floor(x+size*.72),Math.floor(y+size*.48),Math.max(2,size*.12),Math.max(2,size*.12));
  }
}

function drawLandmark(landmark,camX,camY){
  const x=(landmark.x-camX)*VIEW_SCALE+canvas.width/2;
  const y=(landmark.y-camY)*VIEW_SCALE+canvas.height/2;
  if(x<-220||x>canvas.width+220||y<-220||y>canvas.height+220) return;
  const pattern=landmark.type==="town"?townBlocks:ruinBlocks;
  const originGX=Math.round(landmark.x/TILE_METERS)-Math.floor(pattern[0].length/2);
  const originGY=Math.round(landmark.y/TILE_METERS)-Math.floor(pattern.length/2);
  for(let row=0;row<pattern.length;row++){
    for(let column=0;column<pattern[row].length;column++){
      const code=pattern[row][column];
      if(code!==".") drawStructureBlock(code,originGX+column,originGY+row,camX,camY);
    }
  }
  if(Math.hypot(landmark.x-camX,landmark.y-camY)>70){
    ctx.save();
    ctx.font="bold 11px Georgia";
    ctx.textAlign="center";
    ctx.fillStyle="#071014";
    ctx.fillText(landmark.short,x+1,y-pattern.length*TILE_METERS*VIEW_SCALE/2-12);
    ctx.fillStyle="#f0e5c9";
    ctx.fillText(landmark.short,x,y-pattern.length*TILE_METERS*VIEW_SCALE/2-13);
    ctx.restore();
  }
}

function addEffect(effect){
  state.effects.push({...effect,maxLife:effect.life});
  if(state.effects.length>90) state.effects.splice(0,state.effects.length-90);
}

function emitFootstep(x,y){
  const terrain=terrainAt(x,y);
  if(["river","shallow","water","deepWater"].includes(terrain.biome)){
    addEffect({type:"ripple",layer:"ground",x,y,life:.72,size:1.3});
  }else{
    addEffect({
      type:"footprint",layer:"ground",x,y,life:2.8,size:.75,
      dir:state.player.dir,
      color:terrain.biome==="beach"?"#806b45":roadAt(x,y)?"#665238":"#31452f"
    });
    if(roadAt(x,y)) addEffect({type:"dust",layer:"air",x,y,life:.5,size:.7,vx:(Math.random()-.5)*2,vy:-2-Math.random()*2});
  }
}

function shakeTree(tree,strong=false){
  tree.reactUntil=Math.max(tree.reactUntil,state.elapsed+(strong?1.35:.55));
  const count=strong?8:3;
  const colors=tree.kind==="iceSpire"?["#d9f0ed","#8fc8ce","#f4fbf7"]:tree.kind==="cactus"?["#4f854d","#76a35b","#d7ba5e"]:["#6f8f42","#4f7738","#9a9a4d"];
  for(let i=0;i<count;i++){
    addEffect({
      type:"leaf",layer:"air",
      x:(tree.gx+.5)*TILE_METERS+(Math.random()-.5)*12,
      y:(tree.gy-1.5)*TILE_METERS+(Math.random()-.5)*10,
      life:.75+Math.random()*.65,size:.65+Math.random()*.45,
      vx:(Math.random()-.5)*7,vy:3+Math.random()*5,
      color:colors[i%colors.length]
    });
  }
}

function reactToCollision(hit,x,y){
  if(!hit||state.elapsed<state.blockedUntil) return;
  state.blockedUntil=state.elapsed+.2;
  if(hit.type==="tree") shakeTree(hit.tree,false);
  else if(hit.type==="structure"){
    for(let i=0;i<3;i++) addEffect({type:"dust",layer:"air",x,y,life:.55,size:.7,vx:(Math.random()-.5)*4,vy:-2-Math.random()*3});
  }
}

function updateWorldReactions(dt){
  for(const effect of state.effects){
    effect.life-=dt;
    effect.x+=(effect.vx||0)*dt;
    effect.y+=(effect.vy||0)*dt;
    if(effect.type==="leaf") effect.vy+=5*dt;
  }
  state.effects=state.effects.filter((effect)=>effect.life>0);
  const follow=1-Math.exp(-dt*7.5);
  state.camera.x=lerp(state.camera.x,state.player.x,follow);
  state.camera.y=lerp(state.camera.y,state.player.y,follow);
}

function drawEffects(camX,camY,layer){
  for(const effect of state.effects){
    if(effect.layer!==layer) continue;
    const x=(effect.x-camX)*VIEW_SCALE+canvas.width/2;
    const y=(effect.y-camY)*VIEW_SCALE+canvas.height/2;
    if(x<-30||y<-30||x>canvas.width+30||y>canvas.height+30) continue;
    const progress=1-effect.life/effect.maxLife;
    ctx.save();
    ctx.globalAlpha=Math.min(1,effect.life/effect.maxLife*1.6);
    if(effect.type==="ripple"){
      const size=(effect.size+progress*3.5)*VIEW_SCALE;
      ctx.strokeStyle="#b8dde0";
      ctx.lineWidth=1;
      ctx.strokeRect(Math.round(x-size),Math.round(y-size*.45),Math.round(size*2),Math.max(2,Math.round(size*.9)));
    }else if(effect.type==="footprint"){
      ctx.fillStyle=effect.color;
      const horizontal=effect.dir==="left"||effect.dir==="right";
      const width=(horizontal?effect.size*1.3:effect.size)*VIEW_SCALE;
      const height=(horizontal?effect.size:effect.size*1.3)*VIEW_SCALE;
      ctx.fillRect(Math.round(x-width/2),Math.round(y-height/2),Math.max(2,Math.round(width)),Math.max(2,Math.round(height)));
    }else if(effect.type==="leaf"){
      ctx.fillStyle=effect.color;
      const size=Math.max(2,Math.round(effect.size*VIEW_SCALE));
      ctx.fillRect(Math.round(x),Math.round(y),size,size);
    }else if(effect.type==="dust"){
      ctx.fillStyle="#b8a47a";
      const size=Math.max(2,Math.round((effect.size+progress)*VIEW_SCALE));
      ctx.fillRect(Math.round(x),Math.round(y),size,size);
    }else if(effect.type==="bubble"){
      ctx.strokeStyle="rgba(218,245,243,.82)";
      ctx.lineWidth=1;
      const size=Math.max(2,Math.round((effect.size+progress*.8)*VIEW_SCALE));
      ctx.strokeRect(Math.round(x-size/2),Math.round(y-size/2),size,size);
    }
    ctx.restore();
  }
}

function nearbyInteraction(){
  const px=state.player.x;
  const py=state.player.y;
  const playerGX=Math.floor(px/TILE_METERS);
  const playerGY=Math.floor(py/TILE_METERS);
  let best=null;
  for(let gy=playerGY-2;gy<=playerGY+2;gy++){
    for(let gx=playerGX-2;gx<=playerGX+2;gx++){
      const tree=treeAtGrid(gx,gy);
      if(tree){
        const distance=Math.hypot(px-(tree.gx+.5)*TILE_METERS,py-(tree.gy+.5)*TILE_METERS);
        const label=tree.kind==="iceSpire"?"Eisformation untersuchen":tree.kind==="cactus"?"Kaktus untersuchen":"Baum untersuchen";
        if(distance<15&&(!best||distance<best.distance)) best={type:"tree",tree,distance,label};
      }
      const structure=structureAtGrid(gx,gy);
      if(structure&&structure.code!=="p"){
        const distance=Math.hypot(px-(gx+.5)*TILE_METERS,py-(gy+.5)*TILE_METERS);
        const label=structure.code==="D"?"Tür untersuchen":structure.landmark.type==="ruin"?"Ruine untersuchen":"Gebäude ansehen";
        if(distance<15&&(!best||distance<best.distance)) best={...structure,distance,label};
      }
    }
  }
  return best;
}

function updateInteractionHint(){
  state.interactionTarget=nearbyInteraction();
  const hint=$("interactionHint");
  if(!hint) return;
  hint.classList.toggle("hidden",!state.interactionTarget);
  if(state.interactionTarget) hint.innerHTML='<kbd>E</kbd> '+state.interactionTarget.label;
}

function interactWithWorld(){
  const target=state.interactionTarget||nearbyInteraction();
  if(!target) return;
  if(target.type==="tree"){
    shakeTree(target.tree,true);
    if(target.tree.kind==="iceSpire") showToast("Im Eis sind uralte Luftblasen eingeschlossen.");
    else if(target.tree.kind==="cactus") showToast("Der Kaktus speichert Wasser für die trockene Jahreszeit.");
    else showToast(target.tree.kind==="dead"?"Das morsche Holz knarrt im Wind.":"Blätter rascheln durch die Krone.");
  }else{
    for(let i=0;i<7;i++) addEffect({type:"dust",layer:"air",x:state.player.x,y:state.player.y,life:.55+Math.random()*.45,size:.6,vx:(Math.random()-.5)*5,vy:-2-Math.random()*4});
    if(target.code==="D") showToast("Die schwere Tür gibt noch nicht nach.");
    else if(target.landmark.type==="ruin") showToast("Verwitterte Zeichen glimmen für einen Augenblick.");
    else showToast(target.landmark.name+" wirkt bewohnt.");
  }
}

function drawSwimmingOverlay(x,y,player){
  const sink=player.drowning?7:0;
  const wave=Math.sin(state.elapsed*8+player.x*.02)*2;
  ctx.fillStyle=player.drowning?"rgba(15,55,78,.80)":"rgba(58,126,145,.62)";
  ctx.fillRect(Math.round(x-14),Math.round(y-11+sink),28,17);
  ctx.fillStyle="rgba(210,239,238,.72)";
  ctx.fillRect(Math.round(x-18+wave),Math.round(y-12+sink),14,2);
  ctx.fillRect(Math.round(x+3-wave),Math.round(y-10+sink),15,2);
  if(player.drowning){
    ctx.fillStyle="rgba(220,245,244,.70)";
    ctx.fillRect(Math.round(x+10),Math.round(y-25-(state.elapsed*13)%12),3,3);
    ctx.fillRect(Math.round(x+15),Math.round(y-18-(state.elapsed*9)%9),2,2);
  }
}

function drawAmbientNature(){
  const biome=terrainAt(state.player.x,state.player.y).biome;
  const polar=["packIce","glacier","tundra"].includes(biome);
  const sandy=biome==="desert";
  const alive=["forest","jungle","oasis","plains"].includes(biome);
  if(!polar&&!sandy&&!alive) return;
  const count=polar?28:sandy?20:10;
  for(let i=0;i<count;i++){
    const phase=hash2(i,31,4401);
    const speed=polar?18:sandy?34:8;
    let x=(hash2(i,17,4402)*canvas.width+state.elapsed*speed*(sandy?1:-.35))%(canvas.width+40)-20;
    let y=(hash2(i,23,4403)*canvas.height+state.elapsed*speed*(polar?1:.18))%(canvas.height+30)-15;
    if(x<0) x+=canvas.width+40;
    if(polar){
      ctx.fillStyle="rgba(239,249,245,"+(0.28+phase*.42)+")";
      const size=phase>.72?3:2;
      ctx.fillRect(Math.round(x),Math.round(y),size,size);
    }else if(sandy){
      ctx.fillStyle="rgba(226,190,112,"+(0.18+phase*.30)+")";
      ctx.fillRect(Math.round(x),Math.round(y),phase>.75?5:3,1);
    }else{
      const flutter=Math.sin(state.elapsed*4+i)*4;
      ctx.fillStyle=biome==="oasis"?"rgba(245,216,107,.62)":"rgba(218,232,131,.48)";
      ctx.fillRect(Math.round(x+flutter),Math.round(y),2,2);
    }
  }
}

function drawWorld(){
  const w=canvas.width;
  const h=canvas.height;
  ctx.clearRect(0,0,w,h);
  const camX=state.camera.x;
  const camY=state.camera.y;
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

  drawEffects(camX,camY,"ground");
  const trees=visibleTrees(
    Math.floor(startX/TILE_METERS),Math.ceil(endX/TILE_METERS),
    Math.floor(startY/TILE_METERS),Math.ceil(endY/TILE_METERS)
  );
  for(const landmark of landmarks) drawLandmark(landmark,camX,camY);

  const renderQueue=trees.map((tree)=>({type:"tree",y:(tree.gy+.8)*TILE_METERS,tree}));
  for(const peer of state.peers.values()) renderQueue.push({type:"peer",y:peer.y,player:peer});
  renderQueue.push({type:"local",y:state.player.y,player:state.player});
  renderQueue.sort((a,b)=>a.y-b.y);
  for(const item of renderQueue){
    if(item.type==="tree"){
      drawGridTree(item.tree,camX,camY);
      continue;
    }
    const player=item.player;
    const sx=(player.x-camX)*VIEW_SCALE+w/2;
    const sy=(player.y-camY)*VIEW_SCALE+h/2+(player.drowning?5:0);
    if(sx>-45&&sx<w+45&&sy>-60&&sy<h+45){
      drawCharacter(ctx,sx,sy,player,item.type==="local"?WORLD_CHARACTER_SCALE:WORLD_CHARACTER_SCALE*.94,item.type==="local");
      if(player.swimming) drawSwimmingOverlay(sx,sy,player);
    }
  }
  drawEffects(camX,camY,"air");

  const hour=(8+state.elapsed/120)%24;
  if(hour<6||hour>19){
    const darkness=hour<5||hour>21?0.25:0.12;
    ctx.fillStyle="rgba(8,18,38,"+darkness+")";
    ctx.fillRect(0,0,w,h);
  }
  drawAmbientNature();
}

function drawHair(c,u,style,hair,dir){
  c.fillStyle=hair;
  if(dir==="side"){
    if(style==="hood"){
      c.fillStyle="#3f4c45";
      c.fillRect(5*u,1*u,7*u,3*u);
      c.fillRect(5*u,3*u,2*u,7*u);
      c.fillRect(11*u,3*u,1*u,4*u);
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
    c.fillRect(3*u,1*u,10*u,3*u);
    c.fillRect(3*u,3*u,2*u,7*u);
    c.fillRect(11*u,3*u,2*u,7*u);
    c.fillStyle="#59665d";
    c.fillRect(4*u,1*u,8*u,1*u);
    if(dir==="up"){
      c.fillStyle="#3f4c45";
      c.fillRect(5*u,3*u,6*u,6*u);
      c.fillStyle="#59665d";
      c.fillRect(5*u,3*u,2*u,5*u);
    }else{
      c.fillStyle="#3f4c45";
      c.fillRect(5*u,8*u,6*u,2*u);
    }
  }else if(style==="bob"){
    c.fillRect(3*u,1*u,10*u,3*u);
    c.fillRect(3*u,3*u,2*u,7*u);
    c.fillRect(11*u,3*u,2*u,7*u);
    if(dir==="up"){
      c.fillRect(5*u,3*u,6*u,6*u);
      c.fillStyle=shade(hair,14);
      c.fillRect(5*u,3*u,2*u,4*u);
    }
  }else if(style==="braid"){
    c.fillRect(3*u,1*u,10*u,3*u);
    c.fillRect(3*u,3*u,2*u,4*u);
    c.fillRect(11*u,3*u,2*u,4*u);
    if(dir==="up"){
      c.fillRect(5*u,3*u,6*u,3*u);
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
    if(dir==="up"){
      c.fillRect(4*u,3*u,8*u,3*u);
      c.fillRect(5*u,6*u,2*u,2*u);
      c.fillRect(9*u,6*u,3*u,1*u);
      c.fillStyle=shade(hair,12);
      c.fillRect(7*u,3*u,2*u,3*u);
    }
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

    // Side view faces right here; mirroring above produces the complete left
    // sprite. The cloak always trails behind the torso.
    c.fillStyle=cloak;
    c.fillRect(2*u,8*u,5*u,10*u);
    c.fillStyle=shade(cloak,-18);
    c.fillRect(2*u,15*u,4*u,3*u);

    const farLegX=5-step;
    const nearLegX=8+step;
    c.fillStyle="#222b31";
    c.fillRect(farLegX*u,16*u,3*u,5*u);
    c.fillRect(nearLegX*u,16*u,3*u,5*u);
    c.fillStyle="#171c20";
    // Both toe blocks point towards the face instead of away from each other.
    c.fillRect(farLegX*u,20*u,4*u,2*u);
    c.fillRect(nearLegX*u,20*u,4*u,2*u);
    c.fillStyle="#39434a";
    c.fillRect((farLegX+3)*u,20*u,1*u,1*u);
    c.fillRect((nearLegX+3)*u,20*u,1*u,1*u);

    c.fillStyle=shirt;
    c.fillRect(6*u,9*u,6*u,8*u);
    c.fillStyle=shade(shirt,24);
    c.fillRect(10*u,10*u,2*u,5*u);
    c.fillStyle="#8e6d37";
    c.fillRect(6*u,15*u,6*u,1*u);
    c.fillStyle=skin;
    c.fillRect((10+step*.45)*u,10*u,2*u,5*u);
    c.fillRect(6*u,3*u,6*u,7*u);
    drawHair(c,u,hairStyle,hair,"side");
    c.fillStyle=eyes;
    c.fillRect(10*u,6*u,1*u,1*u);
  }else if(dir==="down"){
    // Front view: the cloak sits behind the body and only shows at the sides.
    c.fillStyle=cloak;
    c.fillRect(2*u,8*u,12*u,10*u);
    c.fillStyle=shade(cloak,-18);
    c.fillRect(2*u,15*u,3*u,3*u);
    c.fillRect(11*u,15*u,3*u,3*u);

    const leftLift=step===1?1:0;
    const rightLift=step===-1?1:0;
    c.fillStyle="#222b31";
    c.fillRect(4*u,(16-leftLift)*u,3*u,5*u);
    c.fillRect(9*u,(16-rightLift)*u,3*u,5*u);
    c.fillStyle="#151b20";
    c.fillRect(3*u,(20-leftLift)*u,4*u,2*u);
    c.fillRect(9*u,(20-rightLift)*u,4*u,2*u);
    c.fillStyle="#39434a";
    c.fillRect(3*u,(21-leftLift)*u,4*u,1*u);
    c.fillRect(9*u,(21-rightLift)*u,4*u,1*u);

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
    drawHair(c,u,hairStyle,hair,"down");
    c.fillStyle=eyes;
    c.fillRect(6*u,6*u,1*u,1*u);
    c.fillRect(10*u,6*u,1*u,1*u);
  }else{
    // Back view: shoes point north, while the cloak correctly covers the back
    // between the shoulders and its hem. Arms and head remain in front of it.
    const leftLift=step===1?1:0;
    const rightLift=step===-1?1:0;
    c.fillStyle="#222b31";
    c.fillRect(4*u,(16-leftLift)*u,3*u,5*u);
    c.fillRect(9*u,(16-rightLift)*u,3*u,5*u);
    c.fillStyle="#151b20";
    c.fillRect(3*u,(18-leftLift)*u,4*u,2*u);
    c.fillRect(9*u,(18-rightLift)*u,4*u,2*u);
    c.fillStyle="#39434a";
    c.fillRect(3*u,(18-leftLift)*u,4*u,1*u);
    c.fillRect(9*u,(18-rightLift)*u,4*u,1*u);

    c.fillStyle=shirt;
    c.fillRect(4*u,9*u,8*u,8*u);
    c.fillStyle=shade(shirt,-16);
    c.fillRect(4*u,9*u,8*u,1*u);
    c.fillStyle=cloak;
    c.fillRect(3*u,8*u,10*u,10*u);
    c.fillStyle=shade(cloak,16);
    c.fillRect(4*u,9*u,1*u,7*u);
    c.fillStyle=shade(cloak,-18);
    c.fillRect(4*u,17*u,8*u,1*u);
    c.fillStyle=skin;
    c.fillRect(2*u,(10+step*.45)*u,2*u,5*u);
    c.fillRect(12*u,(10-step*.45)*u,2*u,5*u);
    c.fillRect(4*u,3*u,8*u,7*u);
    drawHair(c,u,hairStyle,hair,"up");
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
  if(state.paused||state.mapOpen||state.dead) return;
  let dx=0;
  let dy=0;
  if(state.keys.has("w")||state.keys.has("arrowup")) dy-=1;
  if(state.keys.has("s")||state.keys.has("arrowdown")) dy+=1;
  if(state.keys.has("a")||state.keys.has("arrowleft")) dx-=1;
  if(state.keys.has("d")||state.keys.has("arrowright")) dx+=1;
  state.player.moving=!!(dx||dy);

  const terrain=terrainAt(state.player.x,state.player.y);
  const swimming=isSwimmingBiome(terrain.biome);
  const deep=terrain.biome==="deepWater";
  state.player.swimming=swimming;
  const wantsSprint=state.keys.has("shift")&&state.player.moving;
  const sprinting=wantsSprint&&state.player.stamina>1;
  if(swimming){
    const baseDrain=deep?DEEP_SWIM_STAMINA_DRAIN:SWIM_STAMINA_DRAIN;
    const effort=state.player.moving?1:.62;
    state.player.stamina=Math.max(0,state.player.stamina-dt*(baseDrain*effort+(sprinting?10:0)));
  }else if(sprinting){
    state.player.stamina=Math.max(0,state.player.stamina-dt*27);
  }else{
    state.player.stamina=Math.min(100,state.player.stamina+dt*(state.player.moving?9:18));
  }

  state.player.drowning=deep&&state.player.stamina<=0;
  if(state.player.drowning){
    state.player.health=Math.max(0,state.player.health-dt*DROWNING_DAMAGE);
    if(hash2(Math.floor(state.elapsed*8),17,991)>.60) addEffect({type:"bubble",layer:"air",x:state.player.x+(Math.random()-.5)*3,y:state.player.y,life:.8,size:.7,vy:-5});
    if(state.player.health<=0){
      killPlayer("In der Tiefsee ertrunken");
      return;
    }
  }

  if(!dx&&!dy) return;
  const len=Math.hypot(dx,dy);
  dx/=len;
  dy/=len;
  let speed=PLAYER_SPEED*(sprinting?SPRINT_MULTIPLIER:1);
  if(terrain.biome==="deepWater") speed*=state.player.drowning ? .18 : .40;
  else if(terrain.biome==="water") speed*=.52;
  else if(terrain.biome==="shallow") speed*=.72;
  else if(terrain.biome==="river") speed*=0.62;
  else if(roadAt(state.player.x,state.player.y)) speed*=1.08;

  if(Math.abs(dx)>Math.abs(dy)) state.player.dir=dx>0?"right":"left";
  else state.player.dir=dy>0?"down":"up";
  state.player.walkTime+=dt*(sprinting?1.9:1.15);

  const oldX=state.player.x;
  const oldY=state.player.y;
  const distance=speed*dt;
  const steps=Math.max(1,Math.ceil(distance/(TILE_METERS*.18)));
  const stepX=dx*distance/steps;
  const stepY=dy*distance/steps;
  for(let step=0;step<steps;step++){
    const nextX=Math.max(PLAYER_RADIUS,Math.min(WORLD_SIZE-PLAYER_RADIUS,state.player.x+stepX));
    const xCheck=canOccupy(nextX,state.player.y);
    if(xCheck.ok) state.player.x=nextX;
    else reactToCollision(xCheck.hit,nextX,state.player.y);

    const nextY=Math.max(PLAYER_RADIUS,Math.min(WORLD_SIZE-PLAYER_RADIUS,state.player.y+stepY));
    const yCheck=canOccupy(state.player.x,nextY);
    if(yCheck.ok) state.player.y=nextY;
    else reactToCollision(yCheck.hit,state.player.x,nextY);
  }
  const moved=Math.hypot(state.player.x-oldX,state.player.y-oldY);
  state.player.moving=moved>.02;
  const currentTerrain=terrainAt(state.player.x,state.player.y);
  state.player.swimming=isSwimmingBiome(currentTerrain.biome);
  if(isSafeGroundBiome(currentTerrain.biome)){
    state.lastSafe.x=state.player.x;
    state.lastSafe.y=state.player.y;
  }
  state.footstepDistance+=moved;
  const stepInterval=["deepWater","water","shallow","river"].includes(currentTerrain.biome)?4.2:6.5;
  if(state.footstepDistance>=stepInterval){
    state.footstepDistance%=stepInterval;
    emitFootstep(state.player.x,state.player.y);
  }
}

function killPlayer(reason){
  state.dead=true;
  state.player.moving=false;
  state.keys.clear();
  $("deathReason").textContent=reason;
  $("deathMenu").classList.remove("hidden");
}

function respawnPlayer(){
  state.dead=false;
  state.player.health=100;
  state.player.stamina=100;
  state.player.swimming=false;
  state.player.drowning=false;
  state.player.x=state.lastSafe.x;
  state.player.y=state.lastSafe.y;
  state.camera.x=state.player.x;
  state.camera.y=state.player.y;
  state.effects=[];
  $("deathMenu").classList.add("hidden");
  showToast("Du erwachst am letzten sicheren Ufer.",2400);
}

function findTeleportSpot(x,y){
  const clampedX=Math.max(PLAYER_RADIUS,Math.min(WORLD_SIZE-PLAYER_RADIUS,x));
  const clampedY=Math.max(PLAYER_RADIUS,Math.min(WORLD_SIZE-PLAYER_RADIUS,y));
  if(isSwimmingBiome(terrainAt(clampedX,clampedY).biome)) return [clampedX,clampedY];
  if(canOccupy(clampedX,clampedY).ok) return [clampedX,clampedY];
  for(let ring=1;ring<=8;ring++){
    for(let direction=0;direction<16;direction++){
      const angle=direction/16*Math.PI*2;
      const tx=clampedX+Math.cos(angle)*ring*TILE_METERS;
      const ty=clampedY+Math.sin(angle)*ring*TILE_METERS;
      if((isSwimmingBiome(terrainAt(tx,ty).biome)||canOccupy(tx,ty).ok)) return [tx,ty];
    }
  }
  return [clampedX,clampedY];
}

function teleportPlayer(x,y){
  if(!state.debug.enabled) return false;
  const [tx,ty]=findTeleportSpot(x,y);
  if(state.dead){
    state.dead=false;
    state.player.health=100;
    state.player.stamina=100;
    $("deathMenu").classList.add("hidden");
  }
  state.player.x=tx;
  state.player.y=ty;
  state.camera.x=tx;
  state.camera.y=ty;
  const terrain=terrainAt(tx,ty);
  state.player.swimming=isSwimmingBiome(terrain.biome);
  state.player.drowning=false;
  if(isSafeGroundBiome(terrain.biome)) state.lastSafe={x:tx,y:ty};
  state.effects=[];
  drawWorldMap();
  showToast("Debug-Teleport · "+(tx/1000).toFixed(2)+" / "+(ty/1000).toFixed(2)+" km",2200);
  return true;
}

function setDebugMode(enabled){
  state.debug.enabled=enabled;
  $("debugBadge").classList.toggle("hidden",!enabled);
  $("gamePanel").classList.toggle("debug-active",enabled);
  if(enabled) showToast("Debugmodus aktiv · Karte oder Welt anklicken",2800);
  else showToast("Debugmodus beendet");
}

function requestDebugMode(){
  if(state.debug.enabled){
    setDebugMode(false);
    return;
  }
  const password=window.prompt("Debug-Passwort eingeben:","");
  if(password==="1234") setDebugMode(true);
  else if(password!==null) showToast("Falsches Debug-Passwort");
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
  $("healthText").textContent=Math.ceil(state.player.health)+" / 100";
  $("staminaText").textContent=state.player.drowning?"ERTRINKEN":state.player.swimming?"SCHWIMMEN":"AUSDAUER";
  $("movementStateText").textContent=state.player.drowning?"SINKT":state.player.swimming?"SCHWIMMT":"LV. 1";
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
  for(const river of ensureRivers()){
    target.beginPath();
    river.points.forEach((point,index)=>{
      const x=point.x/WORLD_SIZE*width;
      const y=point.y/WORLD_SIZE*height;
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
  mc.save();
  mc.textAlign="center";
  mc.font="bold 24px Georgia";
  mc.fillStyle="rgba(238,249,246,.55)";
  mc.fillText("NORDPOL",base.width/2,35);
  mc.fillStyle="rgba(82,51,19,.48)";
  mc.fillText("SONNENWÜSTE",base.width/2,base.height-30);
  mc.restore();
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
  updateWorldReactions(dt);
  drawWorld();
  drawMinimap();
  updateHud();
  updatePortrait();
  updateInteractionHint();
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
  if(!isWalkable(state.player.x,state.player.y)||!canOccupy(state.player.x,state.player.y).ok){
    state.player.x=spawn[0];
    state.player.y=spawn[1];
  }
  state.camera.x=state.player.x;
  state.camera.y=state.player.y;
  state.lastSafe={x:state.player.x,y:state.player.y};
  state.effects=[];
  state.footstepDistance=0;
  state.player.stamina=100;
  state.player.health=100;
  state.player.swimming=false;
  state.player.drowning=false;
  state.dead=false;
  state.player.walkTime=0;
  $("menuScreen").classList.add("hidden");
  $("titleScreen").classList.add("hidden");
  $("gamePanel").classList.remove("hidden");
  state.running=true;
  state.paused=false;
  state.mapOpen=false;
  $("deathMenu").classList.add("hidden");
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
    health:p.health,stamina:p.stamina,swimming:p.swimming,drowning:p.drowning,
    skin:p.skin,eyes:p.eyes,hair:p.hair,hairStyle:p.hairStyle,shirt:p.shirt,cloak:p.cloak
  };
}

function sanitizePlayer(p){
  if(!p||typeof p!=="object") return null;
  const styles=["tousled","bob","braid","mohawk","hood"];
  return {
    id:String(p.id||"peer").slice(0,64),
    name:String(p.name||"Spieler").slice(0,18),
    x:Math.max(0,Math.min(WORLD_SIZE,Number(p.x)||WORLD_SIZE/2)),
    y:Math.max(0,Math.min(WORLD_SIZE,Number(p.y)||WORLD_SIZE/2)),
    dir:["up","down","left","right"].includes(p.dir)?p.dir:"down",
    moving:!!p.moving,
    walkTime:Number(p.walkTime)||0,
    health:Number.isFinite(Number(p.health))?Math.max(0,Math.min(100,Number(p.health))):100,
    stamina:Number.isFinite(Number(p.stamina))?Math.max(0,Math.min(100,Number(p.stamina))):100,
    swimming:!!p.swimming,
    drowning:!!p.drowning,
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
  if(key==="#"&&state.running&&!event.repeat){
    requestDebugMode();
    event.preventDefault();
  }
  if(key==="e"&&state.running&&!state.paused&&!state.mapOpen&&!event.repeat){
    interactWithWorld();
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
$("respawnBtn").addEventListener("click",respawnPlayer);

worldMap.addEventListener("click",(event)=>{
  if(!state.debug.enabled) return;
  const rect=worldMap.getBoundingClientRect();
  const x=(event.clientX-rect.left)/rect.width*WORLD_SIZE;
  const y=(event.clientY-rect.top)/rect.height*WORLD_SIZE;
  teleportPlayer(x,y);
});

canvas.addEventListener("click",(event)=>{
  if(!state.debug.enabled||state.mapOpen||state.paused) return;
  const rect=canvas.getBoundingClientRect();
  const px=(event.clientX-rect.left)/rect.width*canvas.width;
  const py=(event.clientY-rect.top)/rect.height*canvas.height;
  teleportPlayer(state.camera.x+(px-canvas.width/2)/VIEW_SCALE,state.camera.y+(py-canvas.height/2)/VIEW_SCALE);
});

renderTitleMap();
updatePreviewDirection();
updatePortrait();
requestAnimationFrame(paintPreview);

window.__ARCHIPELAGO_DEBUG__ = {
  WORLD_SIZE,
  TILE_METERS,
  terrainAt,
  islandField,
  ensureRivers,
  riverAt,
  roadAt,
  treeForPlot,
  treeAtGrid,
  structureAtGrid,
  collisionAt,
  canOccupy,
  movePlayer,
  updateWorldReactions,
  nearbyInteraction,
  interactWithWorld,
  isSwimmingBiome,
  isSafeGroundBiome,
  killPlayer,
  respawnPlayer,
  teleportPlayer,
  setDebugMode,
  drawCharacter,
  drawWorld,
  drawWorldMap,
  mapColorAt,
  landmarks,
  rivers,
  routes,
  state
};
})();
