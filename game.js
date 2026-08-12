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
const WORLD_CHARACTER_SCALE = 2;
const PLAYER_RADIUS = 2.15;
const NET_SEND_HZ = 12;
const MAP_SAMPLE = 4;
const TREE_PLOT_TILES = 4;
// Roadside scenes should feel discovered, not form an obstacle course. A
// larger placement cell plus a low deterministic chance leaves long quiet
// stretches between landmarks.
const ROAD_DECOR_PLOT_TILES = 20;
const BLOCK_TEXTURE_PIXELS = 8;
const RIVER_TRACE_STEP = TILE_METERS * 8;
const RIVER_INDEX_METERS = TILE_METERS * 8;
const SWIM_STAMINA_DRAIN = 8;
const DEEP_SWIM_STAMINA_DRAIN = 14;
const DROWNING_DAMAGE = 28;
// Cache a viewport-sized terrain surface on the world-tile grid. When the
// camera crosses a block boundary, only the newly exposed row/column is drawn;
// the existing surface is shifted into a second reusable canvas.
const TERRAIN_TILE_PIXELS = Math.round(TILE_METERS * VIEW_SCALE);
const TERRAIN_CACHE_LIMIT = 70000;
const VISUAL_CACHE_LIMIT = 36000;
// Large enough to keep deterministic tree object identity during broad scans,
// still bounded so exploring the entire 20 km world cannot grow forever.
const TREE_CACHE_LIMIT = 120000;
const ROAD_DECOR_CACHE_LIMIT = 24000;
const ROAD_DECOR_CELL_CACHE_LIMIT = 64000;
const EFFECT_LIMIT = 56;
const UI_UPDATE_MS = 100;
const INVENTORY_COLUMNS = 10;
const INVENTORY_ROWS = 6;
const TREE_HIT_RANGE = TILE_METERS * 2.8;
const TREE_SPLIT_HITS = 3;
const ANIMAL_CELL_TILES = 18;
const ANIMAL_CACHE_LIMIT = 32000;
const ANIMAL_ACTIVE_RADIUS = 520;
const ANIMAL_HIT_RANGE = TILE_METERS * 2.75;
const CORPSE_DRAG_RANGE = TILE_METERS * 2.8;

const snapToGrid = (value) => Math.round(value / TILE_METERS) * TILE_METERS;

const $ = (id) => document.getElementById(id);
const terrainCanvas = $("terrainCanvas");
const terrainCtx = terrainCanvas.getContext("2d");
terrainCtx.imageSmoothingEnabled = false;

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

// Items are data-first: adding another weapon, tool, armour piece or resource
// only requires a catalog entry and (for new behaviours) an action handler.
const itemCatalog = {
  ironSword:{
    name:"Eisenschwert",short:"Schwert",category:"weapon",equipSlot:"mainHand",
    width:1,height:3,action:"swordSwing",cooldown:.42,animalDamage:52,corpseDamage:24,
    description:"Eine verlässliche Klinge. Linksklick führt genau einen Hieb aus."
  },
  woodsmanAxe:{
    name:"Holzfälleraxt",short:"Axt",category:"tool",equipSlot:"mainHand",
    width:2,height:3,action:"axeSwing",cooldown:.58,treeDamage:38,animalDamage:36,corpseDamage:34,
    description:"Fällt Bäume und zerlegt liegende Stämme in handliche Abschnitte."
  },
  rawChicken:{name:"Rohes Hühnerfleisch",short:"Huhn roh",category:"resource",width:1,height:1,maxStack:4,icon:"meatPale",description:"Frisches rohes Fleisch. Sollte vor dem Essen gebraten werden."},
  rawPork:{name:"Rohes Wildschweinfleisch",short:"Wild roh",category:"resource",width:2,height:1,maxStack:4,icon:"meatRed",description:"Schweres, rohes Wildfleisch aus einem erlegten Keiler."},
  feather:{name:"Feder",short:"Federn",category:"resource",width:1,height:1,maxStack:12,icon:"feather",description:"Leichtes Material für Pfeile, Kleidung und Handwerk."},
  boarHide:{name:"Wildschweinhaut",short:"Tierhaut",category:"resource",width:2,height:2,maxStack:2,icon:"hide",description:"Robuste Haut, aus der später Leder und Rüstung entstehen können."},
  tusk:{name:"Hauer",short:"Hauer",category:"resource",width:1,height:2,maxStack:4,icon:"tusk",description:"Ein harter Wildschweinhauer für Werkzeuge oder Trophäen."},
  bone:{name:"Knochen",short:"Knochen",category:"resource",width:1,height:2,maxStack:5,icon:"bone",description:"Ein stabiler Knochen für spätere Rezepte und Werkzeuge."}
};

// Species, behaviour, body size and harvesting are catalog-driven. New fauna
// can share the complete roaming, damage, ragdoll, dragging and loot pipeline.
const animalCatalog = {
  chicken:{
    name:"Huhn",corpseName:"Hühnerkadaver",maxHealth:30,radius:2.1,walkSpeed:8.5,runSpeed:20,
    habitats:["plains","forest","oasis"],spawnChance:.48,group:[2,4],timidRange:34,
    loot:[{itemId:"rawChicken",quantity:2},{itemId:"feather",quantity:3},{itemId:"bone",quantity:1}]
  },
  boar:{
    name:"Wildschwein",corpseName:"Wildschweinkadaver",maxHealth:105,radius:3.8,walkSpeed:10,runSpeed:24,
    habitats:["forest","plains","swamp","jungle"],spawnChance:.31,group:[1,2],timidRange:16,
    loot:[{itemId:"rawPork",quantity:2},{itemId:"rawPork",quantity:2},{itemId:"boarHide",quantity:1},{itemId:"tusk",quantity:2},{itemId:"bone",quantity:2}]
  }
};

const equipmentSlotCatalog = {
  head:{label:"Kopf",accepts:["helmet"]},
  body:{label:"Körper",accepts:["armor"]},
  legs:{label:"Beine",accepts:["legs"]},
  feet:{label:"Stiefel",accepts:["boots"]},
  mainHand:{label:"Haupthand",accepts:["weapon","tool"]}
};

function createStartingInventory(){
  return {
    columns:INVENTORY_COLUMNS,
    rows:INVENTORY_ROWS,
    selectedId:"sword-1",
    items:[
      {id:"sword-1",itemId:"ironSword",x:null,y:null,rotated:false},
      {id:"axe-1",itemId:"woodsmanAxe",x:1,y:1,rotated:false}
    ],
    equipment:{head:null,body:null,legs:null,feet:null,mainHand:"sword-1"}
  };
}

const state = {
  running: false,
  paused: false,
  mapOpen: false,
  inventoryOpen: false,
  lastTime: 0,
  lastNetSend: 0,
  lastUiUpdate: 0,
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
  inventory:createStartingInventory(),
  inventorySerial:2,
  draggingAnimalId:null,
  action:{type:null,itemId:null,elapsed:0,duration:0,cooldown:0},
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
    heldItem:"ironSword",
    actionType:null,
    actionProgress:0,
    skin: "#f1c27d",
    eyes: "#243b53",
    hair: "#3a2418",
    hairStyle: "tousled",
    beard: "#3a2418",
    beardStyle: "none",
    outfit: "traveler",
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

// Keyboard and touch input share state.keys, but keep their ownership apart so
// lifting a thumb never cancels a physical key that is still being held (and
// vice versa). Pointer IDs make diagonal movement plus sprint/attack possible.
const keyboardHeldKeys = new Set();
const mobileHeldPointers = new Map();

function touchControlsActive(){
  return window.matchMedia?.("(hover:none) and (pointer:coarse)").matches
    || window.matchMedia?.("(max-width:700px)").matches;
}

function setMobileHeldKey(pointerId,key,button){
  const previous=mobileHeldPointers.get(pointerId);
  if(previous) releaseMobilePointer(pointerId);
  mobileHeldPointers.set(pointerId,{key,button});
  state.keys.add(key);
  button.classList.add("is-pressed");
  button.setAttribute("aria-pressed","true");
}

function releaseMobilePointer(pointerId){
  const held=mobileHeldPointers.get(pointerId);
  if(!held) return;
  mobileHeldPointers.delete(pointerId);
  held.button.classList.remove("is-pressed");
  held.button.setAttribute("aria-pressed","false");
  const stillHeld=[...mobileHeldPointers.values()].some((entry)=>entry.key===held.key);
  if(!stillHeld&&!keyboardHeldKeys.has(held.key)) state.keys.delete(held.key);
}

function releaseAllMobileControls(){
  const keys=new Set([...mobileHeldPointers.values()].map((entry)=>entry.key));
  mobileHeldPointers.clear();
  for(const button of document.querySelectorAll("[data-mobile-key]")){
    button.classList.remove("is-pressed");
    button.setAttribute("aria-pressed","false");
  }
  for(const key of keys) if(!keyboardHeldKeys.has(key)) state.keys.delete(key);
}

function mobileHaptic(pattern=8){
  if(touchControlsActive()&&navigator.vibrate) navigator.vibrate(pattern);
}

function updateMobileControlState(){
  const states={inventory:state.inventoryOpen,map:state.mapOpen,pause:state.paused};
  for(const [action,active] of Object.entries(states)){
    const button=document.querySelector('[data-mobile-action="'+action+'"]');
    if(!button) continue;
    button.classList.toggle("active",active);
    button.setAttribute("aria-pressed",String(active));
  }
  const equipped=inventoryItemById(state.inventory.equipment.mainHand);
  const definition=equipped&&itemCatalog[equipped.itemId];
  const attackLabel=$("mobileAttackLabel");
  if(attackLabel) attackLabel.textContent=definition?.short||"Benutzen";
}

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
// Only touched trees enter this map, so procedural forests stay cheap while
// chopped trees keep persistent health and physics state during exploration.
const treePhysicsStates = new Map();
const animalCellCache = new Map();
const animalStates = new Map();
const roadDecorPlotCache = new Map();
const roadDecorCellCache = new Map();
const terrainFrameCache = {canvas:null,scratch:null,anchorX:NaN,anchorY:NaN,width:0,height:0,columns:0,rows:0,displayRevision:-1};
const renderStats = {terrainFrameBuilds:0,terrainFrameShifts:0,tileBuilds:0};

function cacheValue(cache,key,value,limit){
  cache.set(key,value);
  if(cache.size<=limit) return value;
  const removeCount=Math.max(1,Math.ceil(limit*.12));
  const keys=cache.keys();
  for(let i=0;i<removeCount;i++){
    const oldest=keys.next();
    if(oldest.done) break;
    cache.delete(oldest.value);
  }
  return value;
}

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

function roadSegmentAt(x,y){
  // Roads occupy complete world blocks. Sampling the block centre turns every
  // diagonal into an intentional pixel staircase instead of a smooth vector line.
  const gx=Math.floor(Math.max(0,Math.min(WORLD_SIZE-.001,x))/TILE_METERS);
  const gy=Math.floor(Math.max(0,Math.min(WORLD_SIZE-.001,y))/TILE_METERS);
  const nx=(gx*TILE_METERS+TILE_METERS/2)/WORLD_SIZE;
  const ny=(gy*TILE_METERS+TILE_METERS/2)/WORLD_SIZE;
  // Five blocks across at the widest points: about three times the old trail.
  const halfWidth=TILE_METERS*2.34/WORLD_SIZE;
  let nearest=null;
  for(let routeIndex=0;routeIndex<routes.length;routeIndex++){
    const route=routes[routeIndex];
    for(let i=0;i<route.length-1;i++){
      const a=route[i];
      const b=route[i+1];
      const hit=segmentDistance(nx,ny,a[0],a[1],b[0],b[1]);
      if(hit.distance>=halfWidth||nearest&&hit.distance>=nearest.distance) continue;
      const dx=(b[0]-a[0])*WORLD_SIZE;
      const dy=(b[1]-a[1])*WORLD_SIZE;
      const length=Math.hypot(dx,dy)||1;
      nearest={distance:hit.distance,dirX:dx/length,dirY:dy/length,route,routeIndex,index:i};
    }
  }
  return nearest;
}

function roadAt(x,y){
  return !!roadSegmentAt(x,y);
}

function bridgeAt(x,y,terrain=null){
  const ground=terrain||terrainAt(x,y);
  if(ground.biome!=="river") return null;
  const road=roadSegmentAt(x,y);
  if(!road) return null;
  return {
    axis:Math.abs(road.dirX)>=Math.abs(road.dirY)?"horizontal":"vertical",
    material:hash2(road.routeIndex,ground.river?.river?.name.length||0,5101)>.78?"stone":"wood",
    dirX:road.dirX,
    dirY:road.dirY
  };
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
  return cacheValue(terrainCache,key,result,TERRAIN_CACHE_LIMIT);
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

function colorChannels(hex){
  const value=parseInt(hex.slice(1),16);
  return [(value>>16)&255,(value>>8)&255,value&255];
}

function colorFromChannels(r,g,b){
  return "#"+((1<<24)+(Math.round(r)<<16)+(Math.round(g)<<8)+Math.round(b)).toString(16).slice(1);
}

function softBiomeColor(gx,gy,biome){
  // Rivers stay crisp enough to read. All other borders borrow colour from a
  // three-block neighbourhood, creating a transition band without changing
  // gameplay/collision biomes or adding another full terrain pass.
  if(biome==="river") return palette.river;
  const current=colorChannels(palette[biome]);
  let red=current[0]*6;
  let green=current[1]*6;
  let blue=current[2]*6;
  let total=6;
  const offsets=[[-3,0,1],[3,0,1],[0,-3,1],[0,3,1],[-2,-2,.72],[2,-2,.72],[-2,2,.72],[2,2,.72]];
  const currentWater=["deepWater","water","shallow","packIce"].includes(biome);
  for(const [dx,dy,baseWeight] of offsets){
    const sample=terrainAt((gx+dx+.5)*TILE_METERS,(gy+dy+.5)*TILE_METERS);
    if(sample.biome==="river") continue;
    const sampleWater=["deepWater","water","shallow","packIce"].includes(sample.biome);
    // Coastlines get a subtler blend than land-to-land climate borders so the
    // shoreline remains obvious while losing the single-tile colour cliff.
    const weight=currentWater===sampleWater?baseWeight:baseWeight*.48;
    const channels=colorChannels(palette[sample.biome]);
    red+=channels[0]*weight;
    green+=channels[1]*weight;
    blue+=channels[2]*weight;
    total+=weight;
  }
  return colorFromChannels(red/total,green/total,blue/total);
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
  if(biome==="rock" && r>0.992) return "rock";
  if(biome==="mountain" && r>0.996) return "rock";
  if(biome==="beach" && r>0.91) return r>0.97?"driftwood":"shell";
  if((biome==="river"||biome==="oasis") && r>0.80) return r>.94?"lilies":"reeds";
  if((biome==="tundra"||biome==="glacier") && r>.82) return r>.95?"iceCrystal":"snowTuft";
  if(biome==="packIce" && r>.90) return "iceCrack";
  if(biome==="desert" && r>.82) return r>.96?"bones":"duneGrass";
  if(biome==="shallow" && r>.94) return "fish";
  return null;
}

function drawDecoration(target,kind,px,py,size){
  const ctx=target;
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

const roadTileTextures = [
  [
    "dddddddd","ddddlddd","ddmddddd","ddddddpd",
    "dldddddd","ddddmddd","ddpddddd","ddddddld"
  ],
  [
    "dddddddd","ddlddddd","dddddpdd","mddddddd",
    "ddddddld","dddmdddd","dddddddd","dldddpdd"
  ],
  [
    "ddmddmdd","ddmddmdd","ddlddlpd","ddmddmdd",
    "ddmddmdd","ddlddlld","ddmddmdd","ddmddmdd"
  ],
  [
    "dddddddd","ddlddddd","ddwwwwdd","dwwwwwwd",
    "dwwwwwwd","ddwwwwdd","ddddlddd","mddddddd"
  ]
];

function drawPixelTexture(target,pattern,colors,sx,sy,size){
  const pixel=size/BLOCK_TEXTURE_PIXELS;
  for(let row=0;row<BLOCK_TEXTURE_PIXELS;row++){
    const line=pattern[row];
    let start=0;
    while(start<BLOCK_TEXTURE_PIXELS){
      const code=line[start];
      let end=start+1;
      while(end<BLOCK_TEXTURE_PIXELS&&line[end]===code) end++;
      if(code!=="."&&colors[code]){
        const left=Math.floor(sx+start*pixel);
        const right=Math.ceil(sx+end*pixel);
        const top=Math.floor(sy+row*pixel);
        const bottom=Math.ceil(sy+(row+1)*pixel);
        target.fillStyle=colors[code];
        target.fillRect(left,top,right-left,bottom-top);
      }
      start=end;
    }
  }
}

function drawRoadTexture(target,sx,sy,size,roadColor,n){
  const texture=n>.97?roadTileTextures[3]:n>.90?roadTileTextures[2]:roadTileTextures[Math.floor(n*2)%2];
  drawPixelTexture(target,texture,{
    d:roadColor,
    l:shade(roadColor,20),
    m:shade(roadColor,-22),
    p:"#746247",
    w:"#6d7c78"
  },sx,sy,size);
}

function drawBiomeTransitionDither(target,sx,sy,size,gx,gy,transitions){
  if(!transitions?.length) return;
  const pixel=size/BLOCK_TEXTURE_PIXELS;
  for(const transition of transitions){
    target.fillStyle=transition.color;
    for(let along=0;along<BLOCK_TEXTURE_PIXELS;along++){
      const depth=hash2(gx*8+along,gy*8+transition.seed,6121)>.58?2:1;
      for(let step=0;step<depth;step++){
        if(hash2(gx*13+along,gy*17+step,transition.seed)<.42) continue;
        const column=transition.edge==="left"?step:transition.edge==="right"?7-step:along;
        const row=transition.edge==="top"?step:transition.edge==="bottom"?7-step:along;
        target.fillRect(
          Math.floor(sx+column*pixel),Math.floor(sy+row*pixel),
          Math.max(1,Math.ceil(pixel)),Math.max(1,Math.ceil(pixel))
        );
      }
    }
  }
}

function bridgeNeighbor(gx,gy,axis){
  if(gx<0||gy<0||gx*TILE_METERS>=WORLD_SIZE||gy*TILE_METERS>=WORLD_SIZE) return false;
  const x=(gx+.5)*TILE_METERS;
  const y=(gy+.5)*TILE_METERS;
  return bridgeAt(x,y,terrainAt(x,y))?.axis===axis;
}

function drawBridgeTexture(target,sx,sy,size,gx,gy,bridge){
  const wood=bridge.material==="wood";
  const base=wood?"#76502f":"#77786d";
  const light=wood?"#a87943":"#9b9c8d";
  const dark=wood?"#4a301f":"#4d514d";
  const plank=wood?"#896039":"#85867a";
  const horizontal=bridge.axis==="horizontal";
  const pattern=horizontal?[
    "dddddddd","plppplpp","plppplpp","plppplpp",
    "plppplpp","plppplpp","plppplpp","dddddddd"
  ]:[
    "dppppppd","dlplplpd","dppppppd","dppppppd",
    "dppppppd","dlplplpd","dppppppd","dppppppd"
  ];
  drawPixelTexture(target,pattern,{d:dark,p:plank,l:light},sx,sy,size);
  const pixel=size/BLOCK_TEXTURE_PIXELS;
  target.fillStyle=light;
  if(horizontal){
    if(!bridgeNeighbor(gx,gy-1,bridge.axis)) target.fillRect(Math.floor(sx),Math.floor(sy),Math.ceil(size),Math.max(2,Math.ceil(pixel)));
    if(!bridgeNeighbor(gx,gy+1,bridge.axis)) target.fillRect(Math.floor(sx),Math.floor(sy+size-pixel),Math.ceil(size),Math.max(2,Math.ceil(pixel)));
  }else{
    if(!bridgeNeighbor(gx-1,gy,bridge.axis)) target.fillRect(Math.floor(sx),Math.floor(sy),Math.max(2,Math.ceil(pixel)),Math.ceil(size));
    if(!bridgeNeighbor(gx+1,gy,bridge.axis)) target.fillRect(Math.floor(sx+size-pixel),Math.floor(sy),Math.max(2,Math.ceil(pixel)),Math.ceil(size));
  }
  target.fillStyle=base;
  const bolt=Math.max(1,Math.ceil(pixel*.55));
  target.fillRect(Math.floor(sx+pixel),Math.floor(sy+pixel),bolt,bolt);
  target.fillRect(Math.floor(sx+size-pixel*1.5),Math.floor(sy+size-pixel*1.5),bolt,bolt);
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
    cacheValue(treePlotCache,cacheKey,null,TREE_CACHE_LIMIT);
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
    cacheValue(treePlotCache,cacheKey,null,TREE_CACHE_LIMIT);
    return null;
  }
  const variant=Math.floor(hash2(plotX,plotY,1711)*3);
  // Check the complete crown/trunk footprint, not only the trunk tile. This
  // keeps broad canopies from hanging across a five-block-wide road.
  if(treeOverlapsRoad(gx,gy,kind,variant)){
    cacheValue(treePlotCache,cacheKey,null,TREE_CACHE_LIMIT);
    return null;
  }
  const tree={
    gx,gy,kind,
    variant,
    phase:hash2(plotX,plotY,1712)*Math.PI*2,
    reactUntil:0
  };
  return cacheValue(treePlotCache,cacheKey,tree,TREE_CACHE_LIMIT);
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
  acacia:["#4e572d","#6f7134","#9a8d46"],
  palm:["#1d512e","#2e6a37","#4a8645"],
  dead:["#3b332b","#514536","#75634b"]
};

function treeFootprint(kind,variant){
  const trunk=[[0,0]];
  if(kind==="iceSpire") return trunk.concat([[0,-1],[-1,0]],variant===2?[[1,0]]:[]);
  if(kind==="cactus"){
    const side=variant===1?-1:1;
    return trunk.concat([[0,-1],[0,-2],[side,-1],[side,-2]],variant===2?[[-1,0]]:[]);
  }
  if(kind==="dead") return trunk.concat([[0,-1],[0,-2],[-1,-2],[1,-2]]);
  if(kind==="palm") return trunk.concat([[0,-1],[0,-3],[-1,-3],[1,-3],[-2,-3],[2,-3],[0,-4],[-1,-4],[1,-4]]);
  const shapes=treeShapes[kind]||treeShapes.oak;
  return trunk.concat(shapes[variant%shapes.length]);
}

function treeOverlapsRoad(gx,gy,kind,variant){
  for(const [dx,dy] of treeFootprint(kind,variant)){
    if(roadAt((gx+dx+.5)*TILE_METERS,(gy+dy+.5)*TILE_METERS)) return true;
  }
  return false;
}

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
  const physics=treePhysicsStates.get(treeKey(tree));
  if(physics&&physics.status!=="standing"){
    drawPhysicalTree(tree,physics,camX,camY);
    return;
  }
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

const roadAssetCatalog = {
  boulder:{w:2,h:2,solid:[[0,0],[1,0],[0,1],[1,1]],label:"Großen Fels untersuchen",message:"Moos wächst in den tiefen Rissen des Findlings."},
  standingStone:{w:1,h:2,solid:[[0,1]],label:"Steinmal untersuchen",message:"Das verwitterte Steinmal weist auf einen vergessenen Pfad."},
  sign:{w:1,h:2,solid:[[0,1]],label:"Wegweiser lesen",message:"Die eingeritzten Pfeile zeigen zu den nächsten Siedlungen."},
  milestone:{w:1,h:2,solid:[[0,1]],label:"Meilenstein ansehen",message:"Die alte Entfernungsangabe ist kaum noch zu erkennen."},
  wagon:{w:3,h:2,solid:[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]],label:"Kaputten Wagen durchsuchen",message:"Zwischen den gebrochenen Speichen liegt nur feuchtes Stroh."},
  handcart:{w:2,h:2,solid:[[0,0],[1,0],[0,1],[1,1]],label:"Handkarren untersuchen",message:"Der Karren wurde hastig am Weg zurückgelassen."},
  supplies:{w:2,h:2,solid:[[0,0],[1,0],[0,1],[1,1]],label:"Vorräte untersuchen",message:"Kisten, ein Fass und ein leerer Sack – alles längst geplündert."},
  lantern:{w:1,h:2,solid:[[0,1]],label:"Weglaterne untersuchen",message:"In der Laterne glimmt noch ein unerwartet warmer Funke."},
  shrine:{w:2,h:2,solid:[[0,1],[1,1]],label:"Wegschrein untersuchen",message:"Eine kleine Kerze flackert im windgeschützten Schrein."},
  camp:{w:2,h:1,solid:[[0,0]],label:"Verlassenes Lager ansehen",message:"Die kalte Feuerstelle und der zusammengerollte Schlafsack sind noch trocken."},
  log:{w:3,h:1,solid:[[0,0],[1,0],[2,0]],label:"Gefallenen Stamm untersuchen",message:"Unter der morschen Rinde krabbeln winzige Käfer."},
  rubble:{w:2,h:1,solid:[[0,0],[1,0]],label:"Trümmer untersuchen",message:"Rad, Achse und Steine stammen wohl von einem alten Unfall."},
  notice:{w:2,h:2,solid:[[0,1],[1,1]],label:"Anschlagtafel lesen",message:"Regen hat die meisten Aushänge unlesbar gemacht."}
};

const roadAssetKinds = [
  "boulder","standingStone","sign","milestone","wagon","handcart","supplies",
  "lantern","shrine","camp","log","rubble","notice"
];

function chooseRoadAssetKind(seed,biome){
  let pool=roadAssetKinds;
  if(biome==="desert") pool=["standingStone","sign","milestone","wagon","supplies","camp","rubble","notice"];
  else if(["tundra","glacier","snow"].includes(biome)) pool=["boulder","standingStone","sign","milestone","wagon","lantern","shrine","rubble"];
  else if(["forest","jungle","swamp"].includes(biome)) pool=["boulder","sign","handcart","supplies","lantern","shrine","camp","log","notice"];
  return pool[Math.floor(seed*pool.length)%pool.length];
}

function roadDecorationForPlot(plotX,plotY){
  const cacheKey=plotX+","+plotY;
  if(roadDecorPlotCache.has(cacheKey)) return roadDecorPlotCache.get(cacheKey);
  const density=hash2(plotX,plotY,5201);
  if(density<.78) return cacheValue(roadDecorPlotCache,cacheKey,null,ROAD_DECOR_CACHE_LIMIT);

  const roadTiles=[];
  const startGX=plotX*ROAD_DECOR_PLOT_TILES;
  const startGY=plotY*ROAD_DECOR_PLOT_TILES;
  for(let localY=0;localY<ROAD_DECOR_PLOT_TILES;localY++){
    for(let localX=0;localX<ROAD_DECOR_PLOT_TILES;localX++){
      const gx=startGX+localX;
      const gy=startGY+localY;
      const x=(gx+.5)*TILE_METERS;
      const y=(gy+.5)*TILE_METERS;
      const road=roadSegmentAt(x,y);
      if(road&&!bridgeAt(x,y,terrainAt(x,y))) roadTiles.push({gx,gy,road});
    }
  }
  if(!roadTiles.length) return cacheValue(roadDecorPlotCache,cacheKey,null,ROAD_DECOR_CACHE_LIMIT);

  const pick=roadTiles[Math.floor(hash2(plotX,plotY,5202)*roadTiles.length)%roadTiles.length];
  const roadHorizontal=Math.abs(pick.road.dirX)>=Math.abs(pick.road.dirY);
  const side=hash2(plotX,plotY,5203)>.5?1:-1;
  const sampleX=(pick.gx+.5)*TILE_METERS;
  const sampleY=(pick.gy+.5)*TILE_METERS;
  const sampleTerrain=terrainAt(sampleX,sampleY);
  const kind=chooseRoadAssetKind(hash2(plotX,plotY,5204),sampleTerrain.biome);
  const meta=roadAssetCatalog[kind];
  const clearance=4+Math.ceil((roadHorizontal?meta.h:meta.w)/2);
  const centreGX=pick.gx+(roadHorizontal?0:side*clearance);
  const centreGY=pick.gy+(roadHorizontal?side*clearance:0);
  const gx=centreGX-Math.floor(meta.w/2);
  const gy=centreGY-Math.floor(meta.h/2);

  for(let ay=0;ay<meta.h;ay++){
    for(let ax=0;ax<meta.w;ax++){
      const cellGX=gx+ax;
      const cellGY=gy+ay;
      if(cellGX<0||cellGY<0||cellGX*TILE_METERS>=WORLD_SIZE||cellGY*TILE_METERS>=WORLD_SIZE) return cacheValue(roadDecorPlotCache,cacheKey,null,ROAD_DECOR_CACHE_LIMIT);
      const x=(cellGX+.5)*TILE_METERS;
      const y=(cellGY+.5)*TILE_METERS;
      const terrain=terrainAt(x,y);
      if(roadAt(x,y)||["deepWater","water","shallow","river","packIce"].includes(terrain.biome)||nearLandmarkGrid(cellGX,cellGY,2)||structureAtGrid(cellGX,cellGY)||treeAtGrid(cellGX,cellGY)){
        return cacheValue(roadDecorPlotCache,cacheKey,null,ROAD_DECOR_CACHE_LIMIT);
      }
    }
  }

  return cacheValue(roadDecorPlotCache,cacheKey,{
    gx,gy,kind,
    variant:Math.floor(hash2(plotX,plotY,5205)*3),
    flip:hash2(plotX,plotY,5206)>.5
  },ROAD_DECOR_CACHE_LIMIT);
}

function visibleRoadDecorations(startGX,endGX,startGY,endGY){
  const assets=[];
  const minPlotX=Math.floor(startGX/ROAD_DECOR_PLOT_TILES)-1;
  const maxPlotX=Math.floor(endGX/ROAD_DECOR_PLOT_TILES)+1;
  const minPlotY=Math.floor(startGY/ROAD_DECOR_PLOT_TILES)-1;
  const maxPlotY=Math.floor(endGY/ROAD_DECOR_PLOT_TILES)+1;
  for(let py=minPlotY;py<=maxPlotY;py++){
    for(let px=minPlotX;px<=maxPlotX;px++){
      const asset=roadDecorationForPlot(px,py);
      if(asset) assets.push(asset);
    }
  }
  return assets;
}

function roadDecorationAtGrid(gx,gy){
  const cacheKey=gx+","+gy;
  if(roadDecorCellCache.has(cacheKey)) return roadDecorCellCache.get(cacheKey);
  const plotX=Math.floor(gx/ROAD_DECOR_PLOT_TILES);
  const plotY=Math.floor(gy/ROAD_DECOR_PLOT_TILES);
  for(let py=plotY-1;py<=plotY+1;py++){
    for(let px=plotX-1;px<=plotX+1;px++){
      const asset=roadDecorationForPlot(px,py);
      if(!asset) continue;
      const meta=roadAssetCatalog[asset.kind];
      const localX=gx-asset.gx;
      const localY=gy-asset.gy;
      if(meta.solid.some(([sx,sy])=>sx===localX&&sy===localY)) return cacheValue(roadDecorCellCache,cacheKey,asset,ROAD_DECOR_CELL_CACHE_LIMIT);
    }
  }
  return cacheValue(roadDecorCellCache,cacheKey,null,ROAD_DECOR_CELL_CACHE_LIMIT);
}

function drawRoadDecoration(asset,camX,camY){
  const meta=roadAssetCatalog[asset.kind];
  const block=TILE_METERS*VIEW_SCALE;
  const unit=block/BLOCK_TEXTURE_PIXELS;
  const screenX=(asset.gx*TILE_METERS-camX)*VIEW_SCALE+canvas.width/2;
  const screenY=(asset.gy*TILE_METERS-camY)*VIEW_SCALE+canvas.height/2;
  const width=meta.w*BLOCK_TEXTURE_PIXELS;
  const height=meta.h*BLOCK_TEXTURE_PIXELS;
  const stoneDark="#454a45",stone="#74766d",stoneLight="#a3a08f",moss="#596b38";
  const woodDark="#3d2a1d",wood="#6e4728",woodLight="#9a6a3b",metal="#777d78";
  const pixelRect=(x,y,w,h,color)=>{
    ctx.fillStyle=color;
    ctx.fillRect(Math.floor(x*unit),Math.floor(y*unit),Math.ceil(w*unit),Math.ceil(h*unit));
  };

  ctx.save();
  ctx.translate(Math.round(screenX),Math.round(screenY));
  if(asset.flip){ctx.translate(Math.round(meta.w*block),0);ctx.scale(-1,1);}
  pixelRect(1,height-2,width-2,2,"rgba(7,13,11,.28)");

  if(asset.kind==="boulder"){
    pixelRect(1,7,14,7,stoneDark);pixelRect(3,3,11,10,stone);pixelRect(5,2,6,4,stoneLight);
    pixelRect(2,6,4,3,moss);pixelRect(9,3,4,2,moss);pixelRect(11,10,3,3,shade(stone,-12));
  }else if(asset.kind==="standingStone"){
    pixelRect(1,4,6,11,stoneDark);pixelRect(2,1,5,13,stone);pixelRect(3,2,3,3,stoneLight);
    pixelRect(4,5,1,4,stoneDark);pixelRect(3,8,2,1,stoneDark);pixelRect(1,12,3,2,moss);
  }else if(asset.kind==="sign"){
    pixelRect(3,5,2,11,woodDark);pixelRect(4,6,1,9,woodLight);pixelRect(0,3,8,3,wood);
    pixelRect(2,7,6,3,wood);pixelRect(1,4,5,1,woodLight);pixelRect(4,4,1,1,metal);pixelRect(3,8,1,1,metal);
  }else if(asset.kind==="milestone"){
    pixelRect(1,7,6,8,stoneDark);pixelRect(2,4,5,10,stone);pixelRect(3,3,3,3,stoneLight);
    pixelRect(3,7,2,1,stoneDark);pixelRect(2,12,3,2,moss);
  }else if(asset.kind==="wagon"){
    pixelRect(3,5,15,8,woodDark);pixelRect(5,4,13,7,wood);pixelRect(6,5,11,1,woodLight);
    for(let x=7;x<18;x+=3) pixelRect(x,5,1,6,woodDark);
    pixelRect(1,10,6,6,woodDark);pixelRect(2,11,4,4,woodLight);pixelRect(3,12,2,2,woodDark);
    pixelRect(15,10,6,6,woodDark);pixelRect(16,11,4,4,woodLight);pixelRect(17,12,2,2,woodDark);
    pixelRect(18,9,6,2,wood);pixelRect(21,8,3,1,woodLight);
  }else if(asset.kind==="handcart"){
    pixelRect(2,5,10,8,woodDark);pixelRect(3,4,9,7,wood);pixelRect(4,5,7,1,woodLight);
    pixelRect(9,10,6,6,woodDark);pixelRect(10,11,4,4,woodLight);pixelRect(11,12,2,2,woodDark);
    pixelRect(0,12,5,2,wood);pixelRect(0,9,2,1,woodLight);
  }else if(asset.kind==="supplies"){
    pixelRect(1,6,7,8,woodDark);pixelRect(2,5,6,7,wood);pixelRect(3,6,4,1,woodLight);
    pixelRect(7,3,8,11,woodDark);pixelRect(8,4,6,9,wood);pixelRect(8,6,6,1,metal);pixelRect(8,10,6,1,metal);
    pixelRect(2,12,5,2,"#9b8355");
  }else if(asset.kind==="lantern"){
    ctx.fillStyle="rgba(244,190,72,.16)";ctx.fillRect(Math.floor(3*unit),Math.floor(3*unit),Math.ceil(5*unit),Math.ceil(7*unit));
    pixelRect(2,2,2,14,woodDark);pixelRect(3,2,1,13,woodLight);pixelRect(3,3,5,1,wood);
    pixelRect(6,4,2,4,metal);pixelRect(6,5,2,2,"#e7b64f");pixelRect(7,5,1,1,"#ffe59a");
  }else if(asset.kind==="shrine"){
    pixelRect(1,6,14,9,stoneDark);pixelRect(3,3,10,11,stone);pixelRect(5,2,6,3,"#8a5a31");
    pixelRect(5,6,6,7,"#252a27");pixelRect(6,11,4,2,stoneLight);pixelRect(7,8,2,3,"#d89b3f");pixelRect(7,7,2,2,"#f1d479");
    pixelRect(2,12,3,2,moss);pixelRect(11,5,3,2,moss);
  }else if(asset.kind==="camp"){
    pixelRect(1,3,8,4,"#58634f");pixelRect(2,2,7,3,"#7b825f");pixelRect(8,5,7,2,stoneDark);
    pixelRect(10,4,3,3,"#a9562f");pixelRect(11,3,1,2,"#edbb4e");pixelRect(9,6,5,1,woodDark);
  }else if(asset.kind==="log"){
    pixelRect(2,2,19,5,woodDark);pixelRect(3,1,18,5,wood);pixelRect(4,2,16,1,woodLight);
    pixelRect(20,1,4,6,"#9a7448");pixelRect(21,2,2,4,woodDark);pixelRect(0,5,5,2,moss);pixelRect(8,1,4,2,moss);
  }else if(asset.kind==="rubble"){
    pixelRect(1,4,5,3,stoneDark);pixelRect(2,3,3,3,stone);pixelRect(7,2,5,5,woodDark);
    pixelRect(8,3,3,3,woodLight);pixelRect(9,4,1,1,woodDark);pixelRect(11,5,5,2,stone);pixelRect(13,3,2,3,stoneLight);
  }else if(asset.kind==="notice"){
    pixelRect(1,5,2,11,woodDark);pixelRect(13,5,2,11,woodDark);pixelRect(1,3,14,9,wood);
    pixelRect(2,4,12,1,woodLight);pixelRect(4,6,3,4,"#d4c9a6");pixelRect(9,6,3,3,"#bfae86");
    pixelRect(5,7,1,1,"#7d6848");pixelRect(10,7,1,1,"#7d6848");
  }
  ctx.restore();
}

function drawTile(target,wx,wy,sx,sy,size,terrain){
  const ctx=target;
  const gx=Math.floor(wx/TILE_METERS);
  const gy=Math.floor(wy/TILE_METERS);
  const cacheKey=gx+","+gy;
  let visual=visualTileCache.get(cacheKey);
  if(!visual){
    const n=hash2(gx,gy,77);
    const centreX=wx+TILE_METERS/2;
    const centreY=wy+TILE_METERS/2;
    const bridge=bridgeAt(centreX,centreY,terrain);
    const road=!bridge&&roadAt(centreX,centreY)
      && !["deepWater","water","shallow","river"].includes(terrain.biome);
    const deco=!road&&!bridge&&!nearLandmarkGrid(gx,gy,2)?tileDecoration(wx,wy,terrain.biome):null;
    const variation=Math.round((n-.5)*10);
    const transitions=[];
    if(terrain.biome!=="river"){
      const neighbours=[
        {edge:"left",dx:-1,dy:0,seed:1},{edge:"right",dx:1,dy:0,seed:2},
        {edge:"top",dx:0,dy:-1,seed:3},{edge:"bottom",dx:0,dy:1,seed:4}
      ];
      for(const neighbour of neighbours){
        const other=terrainAt((gx+neighbour.dx+.5)*TILE_METERS,(gy+neighbour.dy+.5)*TILE_METERS);
        if(other.biome===terrain.biome||other.biome==="river") continue;
        transitions.push({...neighbour,color:shade(palette[other.biome],variation)});
      }
    }
    visual={
      n,road,bridge,deco,transitions,
      baseColor:shade(softBiomeColor(gx,gy,terrain.biome),variation),
      roadColor:road?shade("#9b8255",Math.round((n-.5)*14)):null,
      waterLike:["water","deepWater","shallow","river"].includes(terrain.biome)
    };
    cacheValue(visualTileCache,cacheKey,visual,VISUAL_CACHE_LIMIT);
  }
  const {n,road,bridge,deco,transitions}=visual;
  ctx.fillStyle=visual.baseColor;
  ctx.fillRect(Math.floor(sx),Math.floor(sy),Math.ceil(size)+1,Math.ceil(size)+1);
  if(!road&&!bridge) drawBiomeTransitionDither(ctx,sx,sy,size,gx,gy,transitions);
  if(bridge) drawBridgeTexture(ctx,sx,sy,size,gx,gy,bridge);
  else if(road) drawRoadTexture(ctx,sx,sy,size,visual.roadColor,n);

  if(!road&&!bridge&&visual.waterLike){
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
  }else if(n>(terrain.biome==="mountain"?.998:terrain.biome==="rock"?.995:.82)){
    ctx.fillStyle="rgba(0,0,0,.07)";
    ctx.fillRect(Math.floor(sx+size*.15),Math.floor(sy+size*.18),Math.max(1,size*.12),Math.max(1,size*.12));
  }

  if(deco) drawDecoration(ctx,deco,Math.floor(sx+size*.5),Math.floor(sy+size*.5),size);
}

function renderTerrainFrame(anchorX,anchorY,width,height){
  const tilePixels=TERRAIN_TILE_PIXELS;
  const terrainScale=TILE_METERS*VIEW_SCALE/tilePixels;
  const frameWidth=Math.ceil((width/terrainScale+tilePixels)/tilePixels)*tilePixels;
  const frameHeight=Math.ceil((height/terrainScale+tilePixels)/tilePixels)*tilePixels;
  const columns=frameWidth/tilePixels;
  const rows=frameHeight/tilePixels;
  const sameSize=terrainFrameCache.canvas&&terrainFrameCache.width===frameWidth&&terrainFrameCache.height===frameHeight;
  if(sameSize&&terrainFrameCache.anchorX===anchorX&&terrainFrameCache.anchorY===anchorY) return terrainFrameCache.canvas;

  const deltaX=sameSize?Math.round((anchorX-terrainFrameCache.anchorX)/TILE_METERS):columns;
  const deltaY=sameSize?Math.round((anchorY-terrainFrameCache.anchorY)/TILE_METERS):rows;
  const canShift=sameSize&&Math.abs(deltaX)<columns&&Math.abs(deltaY)<rows;
  let frame;
  let frameCtx;
  if(canShift){
    frame=terrainFrameCache.scratch;
    frameCtx=frame.getContext("2d");
    frameCtx.imageSmoothingEnabled=false;
    frameCtx.clearRect(0,0,frameWidth,frameHeight);
    frameCtx.drawImage(terrainFrameCache.canvas,-deltaX*tilePixels,-deltaY*tilePixels);
    renderStats.terrainFrameShifts++;
  }else{
    frame=document.createElement("canvas");
    frame.width=frameWidth;
    frame.height=frameHeight;
    frameCtx=frame.getContext("2d");
    frameCtx.imageSmoothingEnabled=false;
    renderStats.terrainFrameBuilds++;
  }

  for(let localY=0;localY<rows;localY++){
    for(let localX=0;localX<columns;localX++){
      const oldLocalX=localX+deltaX;
      const oldLocalY=localY+deltaY;
      if(canShift&&oldLocalX>=0&&oldLocalX<columns&&oldLocalY>=0&&oldLocalY<rows) continue;
      const wx=anchorX+localX*TILE_METERS;
      const wy=anchorY+localY*TILE_METERS;
      if(wx<0||wy<0||wx>=WORLD_SIZE||wy>=WORLD_SIZE){
        frameCtx.fillStyle=palette.deepWater;
        frameCtx.fillRect(Math.floor(localX*tilePixels),Math.floor(localY*tilePixels),Math.ceil(tilePixels)+1,Math.ceil(tilePixels)+1);
      }else{
        drawTile(frameCtx,wx,wy,localX*tilePixels,localY*tilePixels,tilePixels,terrainAt(wx+TILE_METERS/2,wy+TILE_METERS/2));
      }
      renderStats.tileBuilds++;
    }
  }
  const previous=terrainFrameCache.canvas;
  terrainFrameCache.canvas=frame;
  terrainFrameCache.scratch=previous||document.createElement("canvas");
  if(terrainFrameCache.scratch.width!==frameWidth) terrainFrameCache.scratch.width=frameWidth;
  if(terrainFrameCache.scratch.height!==frameHeight) terrainFrameCache.scratch.height=frameHeight;
  terrainFrameCache.anchorX=anchorX;
  terrainFrameCache.anchorY=anchorY;
  terrainFrameCache.width=frameWidth;
  terrainFrameCache.height=frameHeight;
  terrainFrameCache.columns=columns;
  terrainFrameCache.rows=rows;
  return frame;
}

function syncTerrainLayer(frame,sourceX,sourceY,viewportWidth,viewportHeight){
  const revision=renderStats.terrainFrameBuilds+renderStats.terrainFrameShifts;
  if(terrainFrameCache.displayRevision!==revision||terrainCanvas.width!==frame.width||terrainCanvas.height!==frame.height){
    if(terrainCanvas.width!==frame.width) terrainCanvas.width=frame.width;
    if(terrainCanvas.height!==frame.height) terrainCanvas.height=frame.height;
    terrainCtx.imageSmoothingEnabled=false;
    terrainCtx.clearRect(0,0,terrainCanvas.width,terrainCanvas.height);
    terrainCtx.drawImage(frame,0,0);
    const terrainScale=TILE_METERS*VIEW_SCALE/TERRAIN_TILE_PIXELS;
    terrainCanvas.style.width=(frame.width*terrainScale/viewportWidth*100)+"%";
    terrainCanvas.style.height=(frame.height*terrainScale/viewportHeight*100)+"%";
    terrainFrameCache.displayRevision=revision;
  }
  terrainCanvas.style.transform="translate3d("+(-sourceX/frame.width*100)+"%,"+(-sourceY/frame.height*100)+"%,0)";
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

function treeKey(tree){
  return tree.gx+","+tree.gy;
}

function isChoppableTree(tree){
  return !!tree&&!['iceSpire','cactus'].includes(tree.kind);
}

function treePhysicalProfile(tree){
  const footprint=treeFootprint(tree.kind,tree.variant);
  let minX=0;
  let maxX=0;
  let minY=0;
  for(const [dx,dy] of footprint){
    minX=Math.min(minX,dx);
    maxX=Math.max(maxX,dx);
    minY=Math.min(minY,dy);
  }
  const lengthTiles=Math.max(2,1-minY);
  const crownWidthTiles=Math.max(1,maxX-minX+1);
  const trunkRadius=TILE_METERS*(tree.kind==="ancient"?.34:tree.kind==="dead"?.22:.28);
  return {
    lengthTiles,
    length:lengthTiles*TILE_METERS,
    trunkRadius,
    crownRadius:Math.max(TILE_METERS*.68,crownWidthTiles*TILE_METERS*.46),
    footprint
  };
}

function treeLengthMeters(tree){
  return treePhysicalProfile(tree).length;
}

function getTreePhysics(tree,create=false){
  const key=treeKey(tree);
  let physics=treePhysicsStates.get(key);
  if(!physics&&create){
    const maxHealth=tree.kind==="ancient"?150:["pine","frostPine"].includes(tree.kind)?120:100;
    physics={
      key,tree,status:"standing",health:maxHealth,maxHealth,
      fallDirection:{x:0,y:1},fallProgress:0,angularVelocity:0,
      splitHits:0,segments:1
    };
    treePhysicsStates.set(key,physics);
  }
  return physics;
}

function pointSegmentDistance(px,py,ax,ay,bx,by){
  const hit=segmentDistance(px,py,ax,ay,bx,by);
  return hit.distance;
}

function treeFallTargetAngle(physics){
  const raw=Math.atan2(physics.fallDirection.y,physics.fallDirection.x)+Math.PI/2;
  return Math.atan2(Math.sin(raw),Math.cos(raw));
}

function fallenTreeSegment(physics){
  const tree=physics.tree;
  const baseX=(tree.gx+.5)*TILE_METERS;
  // The pivot is the same bottom edge used by drawPhysicalTree. Previously the
  // hit line was offset and grew while the full sprite rotated, so the visible
  // trunk and collision could disagree by several blocks.
  const baseY=(tree.gy+1)*TILE_METERS;
  const targetAngle=treeFallTargetAngle(physics);
  const progress=physics.status==="falling"?1-Math.pow(1-physics.fallProgress,2.4):1;
  const angle=targetAngle*progress;
  const length=treeLengthMeters(tree);
  return {
    ax:baseX,ay:baseY,
    bx:baseX+Math.sin(angle)*length,
    by:baseY-Math.cos(angle)*length
  };
}

function fallenTreeHitShapes(physics){
  const segment=fallenTreeSegment(physics);
  const profile=treePhysicalProfile(physics.tree);
  return {segment,trunkRadius:profile.trunkRadius,crown:{x:segment.bx,y:segment.by,radius:profile.crownRadius}};
}

function fallenTreeCollisionAt(x,y){
  for(const physics of treePhysicsStates.values()){
    if(!["falling","fallen"].includes(physics.status)) continue;
    const shapes=fallenTreeHitShapes(physics);
    const trunkHit=pointSegmentDistance(x,y,shapes.segment.ax,shapes.segment.ay,shapes.segment.bx,shapes.segment.by)<shapes.trunkRadius;
    const crownHit=Math.hypot(x-shapes.crown.x,y-shapes.crown.y)<shapes.crown.radius;
    if(trunkHit||crownHit){
      return {type:"fallenTree",tree:physics.tree,physics};
    }
  }
  return null;
}

function drawPhysicalTree(tree,physics,camX,camY){
  const block=TILE_METERS*VIEW_SCALE;
  const baseX=Math.round(((tree.gx+.5)*TILE_METERS-camX)*VIEW_SCALE+canvas.width/2);
  const baseY=Math.round(((tree.gy+1)*TILE_METERS-camY)*VIEW_SCALE+canvas.height/2);
  const profile=treePhysicalProfile(tree);
  const lengthTiles=profile.lengthTiles;
  const targetAngle=treeFallTargetAngle(physics);
  const eased=physics.status==="falling"?1-Math.pow(1-physics.fallProgress,2.4):1;
  const colors=treePalettes[tree.kind]||treePalettes.oak;
  const trunk=tree.kind==="birch"?"#9d957d":tree.kind==="frostPine"?"#65706a":tree.kind==="palm"?"#76512e":"#5b3d29";

  ctx.save();
  ctx.translate(baseX,baseY);
  ctx.rotate(targetAngle*eased);
  ctx.imageSmoothingEnabled=false;

  if(physics.status==="split"){
    const segmentLength=lengthTiles*block/3;
    for(let section=0;section<3;section++){
      const offset=section*(segmentLength+block*.14);
      ctx.fillStyle="rgba(4,10,8,.24)";
      ctx.fillRect(Math.round(-block*.28),Math.round(-offset-segmentLength+block*.12),Math.round(block*.72),Math.round(segmentLength));
      ctx.fillStyle=section%2?shade(trunk,8):trunk;
      ctx.fillRect(Math.round(-block*.23),Math.round(-offset-segmentLength),Math.round(block*.58),Math.round(segmentLength-block*.12));
      ctx.fillStyle="#b88a55";
      ctx.fillRect(Math.round(-block*.18),Math.round(-offset-segmentLength),Math.round(block*.48),Math.max(2,Math.round(block*.12)));
    }
    ctx.restore();
    return;
  }

  ctx.fillStyle="rgba(3,10,7,.24)";
  ctx.fillRect(Math.round(-block*.34),Math.round(-lengthTiles*block+block*.25),Math.round(block*.86),Math.round(lengthTiles*block));
  ctx.fillStyle=trunk;
  ctx.fillRect(Math.round(-block*.24),Math.round(-lengthTiles*block),Math.round(block*.55),Math.round(lengthTiles*block));
  ctx.fillStyle=shade(trunk,22);
  ctx.fillRect(Math.round(-block*.18),Math.round(-lengthTiles*block),Math.round(block*.15),Math.round(lengthTiles*block));

  // Reuse the standing tree's own block footprint. The fallen crown therefore
  // has the same width and length as the tree the player actually cut down.
  for(let index=1;index<profile.footprint.length;index++){
    const [dx,dy]=profile.footprint[index];
    const tone=Math.floor(hash2(tree.gx+dx,tree.gy+dy,7300+tree.variant)*colors.length);
    ctx.fillStyle=colors[tone]||colors[1];
    const px=Math.round((dx-.5)*block);
    const py=Math.round((dy-1)*block);
    ctx.fillRect(px,py,Math.ceil(block)+1,Math.ceil(block)+1);
    ctx.fillStyle=colors[0];
    ctx.fillRect(px,py+Math.ceil(block)-2,Math.ceil(block)+1,3);
  }
  ctx.restore();
}

function animalCellKey(cellX,cellY){
  return cellX+","+cellY;
}

function animalDirection(animal){
  const vx=Math.abs(animal.vx)>.15?animal.vx:Math.cos(animal.heading);
  const vy=Math.abs(animal.vy)>.15?animal.vy:Math.sin(animal.heading);
  if(Math.abs(vx)>Math.abs(vy)) return vx<0?"left":"right";
  return vy<0?"up":"down";
}

function animalSpawnAllowed(species,x,y){
  if(x<32||y<32||x>WORLD_SIZE-32||y>WORLD_SIZE-32) return false;
  const meta=animalCatalog[species];
  const terrain=terrainAt(x,y);
  if(!meta.habitats.includes(terrain.biome)||isSwimmingBiome(terrain.biome)) return false;
  const gx=Math.floor(x/TILE_METERS);
  const gy=Math.floor(y/TILE_METERS);
  return !structureAtGrid(gx,gy)&&!treeAtGrid(gx,gy)&&!roadDecorationAtGrid(gx,gy);
}

function animalSpawnPoint(species,cellX,cellY,index){
  const cellMetres=ANIMAL_CELL_TILES*TILE_METERS;
  const baseX=(cellX+.12+hash2(cellX*7+index,cellY,8101)*.76)*cellMetres;
  const baseY=(cellY+.12+hash2(cellX,cellY*7+index,8102)*.76)*cellMetres;
  for(let attempt=0;attempt<12;attempt++){
    const angle=hash2(cellX+attempt,cellY-index,8110+index)*Math.PI*2;
    const radius=attempt*TILE_METERS*1.45;
    const x=baseX+Math.cos(angle)*radius;
    const y=baseY+Math.sin(angle)*radius;
    if(animalSpawnAllowed(species,x,y)) return {x,y};
  }
  return null;
}

function createAnimalState(species,cellX,cellY,index,point){
  const id=species+":"+cellX+":"+cellY+":"+index;
  const existing=animalStates.get(id);
  if(existing) return existing;
  const meta=animalCatalog[species];
  const heading=hash2(cellX+index*3,cellY-index*5,species==="boar"?8202:8201)*Math.PI*2;
  const animal={
    id,species,originCellX:cellX,originCellY:cellY,
    x:point.x,y:point.y,homeX:point.x,homeY:point.y,
    heading,vx:0,vy:0,dir:"down",gait:hash2(cellX,index,8210)*4,
    health:meta.maxHealth,maxHealth:meta.maxHealth,status:"alive",
    wanderTimer:.8+hash2(cellX,cellY,8211+index)*3.4,idleUntil:0,
    hitFlash:0,fleeUntil:0,aggressionUntil:0,attackCooldown:0,
    bloodLevel:0,corpseDamage:0,harvestCount:0,lootQueue:null,
    angle:0,angularVelocity:0,ragdollPhase:hash2(cellX,index,8212)*Math.PI*2
  };
  return cacheValue(animalStates,id,animal,ANIMAL_CACHE_LIMIT);
}

function animalsForCell(cellX,cellY){
  const key=animalCellKey(cellX,cellY);
  if(animalCellCache.has(key)) return animalCellCache.get(key);
  const animals=[];
  for(const [species,meta] of Object.entries(animalCatalog)){
    const speciesSeed=species==="boar"?8302:8301;
    if(hash2(cellX,cellY,speciesSeed)>meta.spawnChance) continue;
    const amount=meta.group[0]+Math.floor(hash2(cellX,cellY,speciesSeed+1)*(meta.group[1]-meta.group[0]+1));
    for(let index=0;index<amount;index++){
      const point=animalSpawnPoint(species,cellX,cellY,index);
      if(point) animals.push(createAnimalState(species,cellX,cellY,index,point));
    }
  }
  return cacheValue(animalCellCache,key,animals,ANIMAL_CACHE_LIMIT);
}

function animalsInRect(left,top,right,bottom){
  const cellMetres=ANIMAL_CELL_TILES*TILE_METERS;
  const margin=cellMetres;
  const minX=Math.floor((left-margin)/cellMetres);
  const maxX=Math.floor((right+margin)/cellMetres);
  const minY=Math.floor((top-margin)/cellMetres);
  const maxY=Math.floor((bottom+margin)/cellMetres);
  const result=[];
  const seen=new Set();
  for(let cellY=minY;cellY<=maxY;cellY++){
    for(let cellX=minX;cellX<=maxX;cellX++){
      for(const animal of animalsForCell(cellX,cellY)){
        if(seen.has(animal.id)||animal.x<left-margin||animal.x>right+margin||animal.y<top-margin||animal.y>bottom+margin) continue;
        seen.add(animal.id);
        result.push(animal);
      }
    }
  }
  if(state.draggingAnimalId){
    const dragged=animalStates.get(state.draggingAnimalId);
    if(dragged&&!seen.has(dragged.id)) result.push(dragged);
  }
  return result;
}

function activeAnimalsNear(x,y,radius=ANIMAL_ACTIVE_RADIUS){
  return animalsInRect(x-radius,y-radius,x+radius,y+radius);
}

function animalCanStand(animal,x,y){
  const meta=animalCatalog[animal.species];
  if(animal.status!=="alive"){
    if(x<4||y<4||x>WORLD_SIZE-4||y>WORLD_SIZE-4||isSwimmingBiome(terrainAt(x,y).biome)) return false;
    // A limp body uses a compact centre hitbox while being dragged. Reusing
    // the living animal's full habitat/radius checks made corpses snag on
    // nearby foliage before their visible body touched it.
    return !collisionAt(x,y);
  }
  const checks=[[0,0],[-meta.radius,0],[meta.radius,0],[0,-meta.radius],[0,meta.radius]];
  for(const [ox,oy] of checks){
    const px=x+ox;
    const py=y+oy;
    if(px<4||py<4||px>WORLD_SIZE-4||py>WORLD_SIZE-4) return false;
    if(!meta.habitats.includes(terrainAt(px,py).biome)||collisionAt(px,py)) return false;
  }
  return true;
}

function moveAnimalBody(animal,dt){
  const nextX=animal.x+animal.vx*dt;
  const nextY=animal.y+animal.vy*dt;
  let moved=false;
  if(animalCanStand(animal,nextX,animal.y)){animal.x=nextX;moved=true;} else animal.vx*=-.28;
  if(animalCanStand(animal,animal.x,nextY)){animal.y=nextY;moved=true;} else animal.vy*=-.28;
  if(!moved){
    animal.heading+=Math.PI*(.55+hash2(Math.floor(animal.x),Math.floor(animal.y),8401)*.9);
    animal.wanderTimer=.45;
  }
}

function injurePlayerFromBoar(animal){
  if(animal.attackCooldown>0||state.dead) return;
  animal.attackCooldown=1.15;
  state.player.health=Math.max(0,state.player.health-14);
  const dx=state.player.x-animal.x;
  const dy=state.player.y-animal.y;
  const length=Math.hypot(dx,dy)||1;
  for(let i=0;i<5;i++) addEffect({type:"dust",layer:"ground",x:state.player.x,y:state.player.y,life:.4+Math.random()*.25,size:.55,vx:dx/length*5+(Math.random()-.5)*4,vy:dy/length*5+(Math.random()-.5)*4});
  showToast("Das verwundete Wildschwein rammt dich · -14 Leben",1500);
  if(state.player.health<=0) killPlayer("Von einem Wildschwein niedergerannt");
}

function updateLivingAnimal(animal,dt){
  const meta=animalCatalog[animal.species];
  animal.hitFlash=Math.max(0,animal.hitFlash-dt);
  animal.attackCooldown=Math.max(0,animal.attackCooldown-dt);
  animal.wanderTimer-=dt;
  const dx=state.player.x-animal.x;
  const dy=state.player.y-animal.y;
  const distance=Math.hypot(dx,dy)||1;
  let speed=meta.walkSpeed;

  if(animal.species==="boar"&&animal.aggressionUntil>state.elapsed&&distance<190){
    animal.heading=Math.atan2(dy,dx);
    speed=meta.runSpeed;
    if(distance<meta.radius+PLAYER_RADIUS+2) injurePlayerFromBoar(animal);
  }else if(animal.fleeUntil>state.elapsed||(animal.species==="chicken"&&distance<meta.timidRange)){
    animal.heading=Math.atan2(-dy,-dx)+(hash2(Math.floor(state.elapsed*4),animal.originCellY,8420)-.5)*.36;
    speed=meta.runSpeed;
  }else{
    const homeDx=animal.homeX-animal.x;
    const homeDy=animal.homeY-animal.y;
    const homeDistance=Math.hypot(homeDx,homeDy);
    if(homeDistance>ANIMAL_CELL_TILES*TILE_METERS*.55){
      animal.heading=Math.atan2(homeDy,homeDx);
      animal.wanderTimer=1.2;
    }else if(animal.wanderTimer<=0){
      const turn=(hash2(Math.floor(state.elapsed*2)+animal.originCellX,animal.originCellY,8430+animal.harvestCount)-.5)*2.6;
      animal.heading+=turn;
      animal.wanderTimer=1.4+hash2(animal.originCellX,Math.floor(state.elapsed),8431)*3.8;
      animal.idleUntil=hash2(animal.originCellY,Math.floor(state.elapsed),8432)>.72?state.elapsed+.55+Math.random()*.8:0;
    }
    if(animal.idleUntil>state.elapsed) speed=0;
  }

  const response=1-Math.exp(-dt*(animal.species==="chicken"?8:5));
  animal.vx=lerp(animal.vx,Math.cos(animal.heading)*speed,response);
  animal.vy=lerp(animal.vy,Math.sin(animal.heading)*speed,response);
  moveAnimalBody(animal,dt);
  animal.dir=animalDirection(animal);
  animal.gait+=dt*Math.hypot(animal.vx,animal.vy)*.42;
}

function updateAnimalRagdoll(animal,dt){
  animal.hitFlash=Math.max(0,animal.hitFlash-dt);
  const meta=animalCatalog[animal.species];
  if(state.draggingAnimalId===animal.id){
    const facing=directionVector(state.player.dir);
    const towDistance=meta.radius+PLAYER_RADIUS+5;
    const targetX=state.player.x-facing.x*towDistance;
    const targetY=state.player.y-facing.y*towDistance;
    animal.vx+=(targetX-animal.x)*dt*16;
    animal.vy+=(targetY-animal.y)*dt*16;
    const speed=Math.hypot(animal.vx,animal.vy);
    if(speed>36){animal.vx=animal.vx/speed*36;animal.vy=animal.vy/speed*36;}
    animal.angularVelocity+=(animal.vx*Math.sin(animal.angle)-animal.vy*Math.cos(animal.angle))*dt*.018;
    animal.ragdollPhase+=dt*(5+speed*.12);
  }else{
    animal.ragdollPhase+=dt*Math.hypot(animal.vx,animal.vy)*.08;
  }
  moveAnimalBody(animal,dt);
  const damping=Math.exp(-dt*(state.draggingAnimalId===animal.id?4.5:7));
  animal.vx*=damping;
  animal.vy*=damping;
  animal.angle+=animal.angularVelocity*dt;
  animal.angularVelocity*=Math.exp(-dt*5.5);
}

function updateAnimals(dt){
  if(state.paused||state.mapOpen||state.inventoryOpen||state.dead) return;
  for(const animal of activeAnimalsNear(state.player.x,state.player.y)){
    if(animal.status==="alive") updateLivingAnimal(animal,dt);
    else updateAnimalRagdoll(animal,dt);
  }
}

function emitBlood(animal,count=5){
  for(let index=0;index<count;index++) addEffect({
    type:"blood",layer:"ground",x:animal.x+(Math.random()-.5)*3,y:animal.y+(Math.random()-.5)*3,
    life:1.4+Math.random()*1.6,size:.55+Math.random()*.65,
    vx:(Math.random()-.5)*10,vy:(Math.random()-.5)*8-2,
    color:index%3===0?"#8f211d":"#5f1718"
  });
}

function prepareAnimalLoot(animal){
  animal.lootQueue=animalCatalog[animal.species].loot.map((entry)=>({...entry}));
}

function killAnimal(animal,damage){
  if(animal.status!=="alive") return;
  animal.status="dead";
  animal.health=0;
  animal.bloodLevel=Math.min(1.6,Math.max(.65,animal.bloodLevel+.24));
  const dx=animal.x-state.player.x;
  const dy=animal.y-state.player.y;
  const distance=Math.hypot(dx,dy)||1;
  animal.vx=dx/distance*(8+damage*.12);
  animal.vy=dy/distance*(8+damage*.12);
  animal.angularVelocity=(hash2(Math.floor(animal.x),Math.floor(animal.y),8501)-.5)*5;
  animal.angle=0;
  prepareAnimalLoot(animal);
  emitBlood(animal,animal.species==="boar"?10:6);
  showToast(animalCatalog[animal.species].name+" erlegt · der Kadaver kann gezogen und zerlegt werden",2600);
}

function harvestAnimalCorpse(animal,damage){
  animal.corpseDamage+=damage;
  animal.bloodLevel=Math.min(1.8,animal.bloodLevel+damage/animal.maxHealth*.32);
  animal.hitFlash=.14;
  animal.angularVelocity+=(Math.random()-.5)*1.8;
  emitBlood(animal,Math.min(9,3+Math.ceil(damage/12)));
  if(!animal.lootQueue) prepareAnimalLoot(animal);
  const loot=animal.lootQueue[0];
  if(!loot){
    showToast("Der Kadaver ist vollständig verwertet.",1300);
    return false;
  }
  const added=addInventoryItem(loot.itemId,loot.quantity);
  if(added<=0){
    showToast("Kein Platz im Rucksack für "+itemCatalog[loot.itemId].name+".",1700);
    return false;
  }
  loot.quantity-=added;
  animal.harvestCount++;
  if(loot.quantity<=0) animal.lootQueue.shift();
  const remaining=animal.lootQueue.reduce((sum,entry)=>sum+entry.quantity,0);
  showToast("+"+added+" "+itemCatalog[loot.itemId].name+(remaining?" · weiter zerlegen":" · Kadaver verwertet"),1800);
  return true;
}

function damageAnimal(animal,damage,itemId){
  if(!animal) return false;
  const definition=itemCatalog[itemId];
  if(animal.status!=="alive") return harvestAnimalCorpse(animal,definition?.corpseDamage||damage);
  animal.health=Math.max(0,animal.health-damage);
  animal.hitFlash=.18;
  animal.bloodLevel=Math.min(1.25,Math.max(animal.bloodLevel,(animal.maxHealth-animal.health)/animal.maxHealth));
  emitBlood(animal,animal.species==="boar"?7:4);
  if(animal.health<=0){
    killAnimal(animal,damage);
  }else if(animal.species==="boar"){
    animal.aggressionUntil=state.elapsed+7;
    showToast("Wildschwein · "+Math.ceil(animal.health)+" / "+animal.maxHealth+" Leben",1100);
  }else{
    animal.fleeUntil=state.elapsed+5;
    showToast("Huhn · "+Math.ceil(animal.health)+" / "+animal.maxHealth+" Leben",1000);
  }
  return true;
}

function drawBloodPool(animal,x,y,unit){
  if(animal.status==="alive"||animal.bloodLevel<.18) return;
  const size=Math.max(2,Math.round(unit*(1.2+animal.bloodLevel*2.2)));
  ctx.fillStyle="rgba(75,15,17,.66)";
  ctx.fillRect(Math.round(x-size),Math.round(y-unit*.45),size*2,Math.max(2,Math.round(size*.72)));
  ctx.fillStyle="rgba(125,28,23,.46)";
  ctx.fillRect(Math.round(x-size*.45),Math.round(y-unit*.8),Math.max(2,Math.round(size*.9)),Math.max(2,Math.round(size*.34)));
}

function drawAnimalBloodMarks(c,animal,u){
  const level=animal.bloodLevel;
  if(level<.16) return;
  c.fillStyle=animal.hitFlash>0?"#d95343":"#7d211f";
  c.fillRect(-2*u,-3*u,Math.max(2,u*2),u);
  if(level>.48) c.fillRect(2*u,-u,2*u,Math.max(2,u));
  if(level>.82) c.fillRect(-4*u,-u,2*u,2*u);
  if(level>1.18) c.fillRect(0,2*u,3*u,Math.max(2,u));
}

function drawChicken(animal,x,y){
  const u=2;
  const flip=animalDirection(animal)==="left"?-1:1;
  ctx.save();
  ctx.translate(Math.round(x),Math.round(y));
  if(animal.status!=="alive") ctx.rotate(animal.angle);
  ctx.scale(flip,1);
  if(animal.status==="alive"){
    const step=Math.sin(animal.gait*4)>.15?1:0;
    ctx.fillStyle="rgba(0,0,0,.28)";ctx.fillRect(-5*u,u,10*u,2*u);
    ctx.fillStyle=animal.hitFlash>0?"#f7d6cf":"#e8e1c4";ctx.fillRect(-4*u,-4*u,7*u,5*u);
    ctx.fillStyle="#b8aa88";ctx.fillRect(-2*u,-3*u,4*u,3*u);
    ctx.fillStyle="#e8e1c4";ctx.fillRect(1*u,-7*u,4*u,4*u);
    ctx.fillStyle="#d7a73a";ctx.fillRect(5*u,-5*u,2*u,u);
    ctx.fillStyle="#a7352e";ctx.fillRect(2*u,-9*u,u,2*u);ctx.fillRect(3*u,-9*u,u,u);
    ctx.fillStyle="#1b211d";ctx.fillRect(4*u,-6*u,u,u);
    ctx.fillStyle="#b78939";ctx.fillRect((-2-step)*u,u,u,3*u);ctx.fillRect((1+step)*u,u,u,3*u);
    drawAnimalBloodMarks(ctx,animal,u);
  }else{
    const flop=Math.sin(animal.ragdollPhase)*.45;
    ctx.fillStyle=animal.hitFlash>0?"#f1bbb3":"#d8cfad";ctx.fillRect(-4*u,-3*u,8*u,5*u);
    drawAnimalBloodMarks(ctx,animal,u);
    ctx.save();ctx.translate(3*u,-2*u);ctx.rotate(.7+flop);ctx.fillStyle="#e1d8b9";ctx.fillRect(0,-2*u,4*u,4*u);ctx.fillStyle="#d7a73a";ctx.fillRect(4*u,-u,2*u,u);ctx.restore();
    ctx.strokeStyle="#987136";ctx.lineWidth=Math.max(1,u);ctx.beginPath();ctx.moveTo(-2*u,u);ctx.lineTo((-4-flop)*u,4*u);ctx.moveTo(u,u);ctx.lineTo((3+flop)*u,4*u);ctx.stroke();
    if(!animal.lootQueue?.length){ctx.fillStyle="#d7c9aa";ctx.fillRect(-2*u,-3*u,5*u,u);}
  }
  ctx.restore();
}

function drawBoar(animal,x,y){
  const u=3;
  const flip=animalDirection(animal)==="left"?-1:1;
  ctx.save();
  ctx.translate(Math.round(x),Math.round(y));
  if(animal.status!=="alive") ctx.rotate(animal.angle);
  ctx.scale(flip,1);
  if(animal.status==="alive"){
    const step=Math.sin(animal.gait*3.2)>.1?1:-1;
    ctx.fillStyle="rgba(0,0,0,.30)";ctx.fillRect(-6*u,u,13*u,2*u);
    ctx.fillStyle=animal.hitFlash>0?"#9d5d51":"#5e4637";ctx.fillRect(-6*u,-5*u,10*u,6*u);
    ctx.fillStyle="#463329";ctx.fillRect(-4*u,-7*u,5*u,3*u);ctx.fillRect(2*u,-5*u,5*u,5*u);
    ctx.fillStyle="#3a2922";ctx.fillRect(6*u,-3*u,3*u,3*u);ctx.fillRect(0,-7*u,2*u,2*u);
    ctx.fillStyle="#d5c49a";ctx.fillRect(6*u,0,3*u,u);ctx.fillRect(7*u,-u,u,2*u);
    ctx.fillStyle="#151815";ctx.fillRect(5*u,-4*u,u,u);
    ctx.fillStyle="#3d2d25";ctx.fillRect((-4-step)*u,u,2*u,4*u);ctx.fillRect((2+step)*u,u,2*u,4*u);
    ctx.fillStyle="#7a5a42";ctx.fillRect(-7*u,-4*u,u,2*u);
    drawAnimalBloodMarks(ctx,animal,u);
  }else{
    const flop=Math.sin(animal.ragdollPhase)*.5;
    ctx.fillStyle=animal.hitFlash>0?"#9d554c":"#564034";ctx.fillRect(-6*u,-4*u,11*u,6*u);
    drawAnimalBloodMarks(ctx,animal,u);
    ctx.save();ctx.translate(4*u,-2*u);ctx.rotate(.45+flop*.25);ctx.fillStyle="#453129";ctx.fillRect(0,-3*u,5*u,5*u);ctx.fillStyle="#d5c49a";ctx.fillRect(4*u,u,3*u,u);ctx.restore();
    ctx.strokeStyle="#34251f";ctx.lineWidth=2*u;
    for(const [lx,phase] of [[-4,-1],[-1,1],[2,-1],[4,1]]){ctx.beginPath();ctx.moveTo(lx*u,u);ctx.lineTo((lx+phase*flop*2)*u,5*u);ctx.stroke();}
    if(!animal.lootQueue?.length){ctx.fillStyle="#c8b996";ctx.fillRect(-3*u,-4*u,6*u,u);ctx.fillRect(-u,-5*u,2*u,3*u);}
  }
  ctx.restore();
}

function drawAnimal(animal,camX,camY){
  const x=(animal.x-camX)*VIEW_SCALE+canvas.width/2;
  const y=(animal.y-camY)*VIEW_SCALE+canvas.height/2;
  if(animal.species==="boar") drawBoar(animal,x,y);
  else drawChicken(animal,x,y);
}

function drawAnimalGround(animal,camX,camY){
  const x=(animal.x-camX)*VIEW_SCALE+canvas.width/2;
  const y=(animal.y-camY)*VIEW_SCALE+canvas.height/2;
  drawBloodPool(animal,x,y,animal.species==="boar"?3:2);
}

function drawDragTether(camX,camY){
  const animal=state.draggingAnimalId&&animalStates.get(state.draggingAnimalId);
  if(!animal) return;
  const ax=(animal.x-camX)*VIEW_SCALE+canvas.width/2;
  const ay=(animal.y-camY)*VIEW_SCALE+canvas.height/2;
  const px=(state.player.x-camX)*VIEW_SCALE+canvas.width/2;
  const py=(state.player.y-camY)*VIEW_SCALE+canvas.height/2;
  const steps=Math.max(2,Math.ceil(Math.hypot(px-ax,py-ay)/8));
  ctx.fillStyle="#7b6849";
  for(let step=1;step<steps;step+=2){
    const t=step/steps;
    ctx.fillRect(Math.round(lerp(ax,px,t)),Math.round(lerp(ay,py,t)),3,2);
  }
}

function collisionAt(x,y){
  if(x<PLAYER_RADIUS||y<PLAYER_RADIUS||x>WORLD_SIZE-PLAYER_RADIUS||y>WORLD_SIZE-PLAYER_RADIUS) return {type:"edge"};
  const gx=Math.floor(x/TILE_METERS);
  const gy=Math.floor(y/TILE_METERS);
  const tree=treeAtGrid(gx,gy);
  if(tree){
    const physics=treePhysicsStates.get(treeKey(tree));
    if(!physics||physics.status==="standing") return {type:"tree",tree,gx,gy};
  }
  const fallenTree=fallenTreeCollisionAt(x,y);
  if(fallenTree) return fallenTree;
  const structure=structureAtGrid(gx,gy);
  if(structure&&structure.code!=="p") return structure;
  const roadDecoration=roadDecorationAtGrid(gx,gy);
  if(roadDecoration) return {type:"roadDecoration",asset:roadDecoration,gx,gy};
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

function drawLandmarkGround(landmark,camX,camY){
  const x=(landmark.x-camX)*VIEW_SCALE+canvas.width/2;
  const y=(landmark.y-camY)*VIEW_SCALE+canvas.height/2;
  if(x<-220||x>canvas.width+220||y<-220||y>canvas.height+220) return;
  const pattern=landmark.type==="town"?townBlocks:ruinBlocks;
  const originGX=Math.round(landmark.x/TILE_METERS)-Math.floor(pattern[0].length/2);
  const originGY=Math.round(landmark.y/TILE_METERS)-Math.floor(pattern.length/2);
  for(let row=0;row<pattern.length;row++){
    for(let column=0;column<pattern[row].length;column++){
      const code=pattern[row][column];
      if(code==="p") drawStructureBlock(code,originGX+column,originGY+row,camX,camY);
    }
  }
}

function visibleStructureBlocks(startGX,endGX,startGY,endGY){
  const blocks=[];
  for(const landmark of landmarks){
    const pattern=landmark.type==="town"?townBlocks:ruinBlocks;
    const originGX=Math.round(landmark.x/TILE_METERS)-Math.floor(pattern[0].length/2);
    const originGY=Math.round(landmark.y/TILE_METERS)-Math.floor(pattern.length/2);
    for(let row=0;row<pattern.length;row++){
      for(let column=0;column<pattern[row].length;column++){
        const code=pattern[row][column];
        const gx=originGX+column;
        const gy=originGY+row;
        if(code==="."||code==="p"||gx<startGX-1||gx>endGX+1||gy<startGY-1||gy>endGY+1) continue;
        blocks.push({type:"structure",code,landmark,gx,gy});
      }
    }
  }
  return blocks;
}

function drawLandmarkLabel(landmark,camX,camY){
  const x=(landmark.x-camX)*VIEW_SCALE+canvas.width/2;
  const y=(landmark.y-camY)*VIEW_SCALE+canvas.height/2;
  if(x<-220||x>canvas.width+220||y<-220||y>canvas.height+220) return;
  const pattern=landmark.type==="town"?townBlocks:ruinBlocks;
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
  if(state.effects.length>EFFECT_LIMIT) state.effects.splice(0,state.effects.length-EFFECT_LIMIT);
}

function emitFootstep(x,y){
  const terrain=terrainAt(x,y);
  const bridge=bridgeAt(x,y,terrain);
  if(!bridge&&["river","shallow","water","deepWater"].includes(terrain.biome)){
    addEffect({type:"ripple",layer:"ground",x,y,life:.72,size:1.3});
  }else{
    addEffect({
      type:"footprint",layer:"ground",x,y,life:2.8,size:.75,
      dir:state.player.dir,
      color:bridge?bridge.material==="wood"?"#4f3422":"#555954":terrain.biome==="beach"?"#806b45":roadAt(x,y)?"#665238":"#31452f"
    });
    if(roadAt(x,y)&&!bridge) addEffect({type:"dust",layer:"ground",x,y,life:.5,size:.7,vx:(Math.random()-.5)*2,vy:-2-Math.random()*2});
  }
}

function shakeTree(tree,strong=false){
  tree.reactUntil=Math.max(tree.reactUntil,state.elapsed+(strong?1.35:.55));
  const count=strong?8:3;
  const colors=tree.kind==="iceSpire"?["#d9f0ed","#8fc8ce","#f4fbf7"]:tree.kind==="cactus"?["#4f854d","#76a35b","#d7ba5e"]:["#6f8f42","#4f7738","#9a9a4d"];
  for(let i=0;i<count;i++){
    addEffect({
      type:"leaf",layer:"ground",
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
  else if(hit.type==="structure"||hit.type==="roadDecoration"){
    for(let i=0;i<3;i++) addEffect({type:"dust",layer:"ground",x,y,life:.55,size:.7,vx:(Math.random()-.5)*4,vy:-2-Math.random()*3});
  }
}

function updateWorldReactions(dt){
  updateItemAction(dt);
  updateTreePhysics(dt);
  updateAnimals(dt);
  for(const effect of state.effects){
    effect.life-=dt;
    effect.x+=(effect.vx||0)*dt;
    effect.y+=(effect.vy||0)*dt;
    if(effect.type==="leaf"||effect.type==="woodChip"||effect.type==="blood") effect.vy+=5*dt;
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
    }else if(effect.type==="woodChip"){
      ctx.fillStyle=effect.color||"#b47c43";
      const size=Math.max(2,Math.round(effect.size*VIEW_SCALE));
      ctx.fillRect(Math.round(x),Math.round(y),size,Math.max(2,Math.round(size*.55)));
    }else if(effect.type==="blood"){
      ctx.fillStyle=effect.color||"#731c1a";
      const size=Math.max(2,Math.round(effect.size*VIEW_SCALE));
      ctx.fillRect(Math.round(x),Math.round(y),size,Math.max(2,Math.round(size*.65)));
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
  const dragged=state.draggingAnimalId&&animalStates.get(state.draggingAnimalId);
  if(dragged) best={type:"animalCorpse",animal:dragged,distance:-1,label:"Kadaver loslassen"};
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
      const asset=roadDecorationAtGrid(gx,gy);
      if(asset){
        const meta=roadAssetCatalog[asset.kind];
        const distance=Math.hypot(px-(asset.gx+meta.w*.5)*TILE_METERS,py-(asset.gy+meta.h*.5)*TILE_METERS);
        if(distance<18&&(!best||distance<best.distance)) best={type:"roadDecoration",asset,distance,label:meta.label};
      }
    }
  }
  if(!dragged){
    for(const animal of activeAnimalsNear(px,py,CORPSE_DRAG_RANGE+24)){
      if(animal.status==="alive") continue;
      const distance=Math.hypot(px-animal.x,py-animal.y)-animalCatalog[animal.species].radius;
      if(distance<CORPSE_DRAG_RANGE&&(!best||distance<best.distance)){
        const depleted=!animal.lootQueue?.length;
        best={type:"animalCorpse",animal,distance,label:(depleted?"Verwerteten ":"")+animalCatalog[animal.species].corpseName+" ziehen"};
      }
    }
  }
  return best;
}

function updateInteractionHint(){
  state.interactionTarget=nearbyInteraction();
  const hint=$("interactionHint");
  const mobileButton=document.querySelector('[data-mobile-action="interact"]');
  const mobileLabel=$("mobileInteractLabel");
  if(mobileButton){
    mobileButton.classList.toggle("available",!!state.interactionTarget);
    mobileButton.setAttribute("aria-label",state.interactionTarget?.label||"Interagieren");
  }
  if(mobileLabel){
    const target=state.interactionTarget;
    mobileLabel.textContent=!target?"Aktion":target.type==="animalCorpse"
      ?(state.draggingAnimalId===target.animal.id?"Loslassen":"Ziehen")
      :"Ansehen";
  }
  if(!hint) return;
  hint.classList.toggle("hidden",!state.interactionTarget);
  if(state.interactionTarget) hint.innerHTML='<kbd>'+(touchControlsActive()?"AKTION":"E")+'</kbd> '+state.interactionTarget.label;
}

function interactWithWorld(){
  const target=state.interactionTarget||nearbyInteraction();
  if(!target) return;
  if(target.type==="animalCorpse"){
    const animal=target.animal;
    if(state.draggingAnimalId===animal.id){
      state.draggingAnimalId=null;
      showToast(animalCatalog[animal.species].corpseName+" losgelassen");
    }else{
      state.draggingAnimalId=animal.id;
      showToast(animalCatalog[animal.species].corpseName+" wird gezogen · E zum Loslassen",2200);
    }
    state.interactionTarget=null;
  }else if(target.type==="tree"){
    shakeTree(target.tree,true);
    if(target.tree.kind==="iceSpire") showToast("Im Eis sind uralte Luftblasen eingeschlossen.");
    else if(target.tree.kind==="cactus") showToast("Der Kaktus speichert Wasser für die trockene Jahreszeit.");
    else showToast(target.tree.kind==="dead"?"Das morsche Holz knarrt im Wind.":"Blätter rascheln durch die Krone.");
  }else if(target.type==="roadDecoration"){
    const meta=roadAssetCatalog[target.asset.kind];
    for(let i=0;i<4;i++) addEffect({type:"dust",layer:"ground",x:state.player.x,y:state.player.y,life:.45+Math.random()*.35,size:.55,vx:(Math.random()-.5)*4,vy:-2-Math.random()*3});
    showToast(meta.message,2600);
  }else{
    for(let i=0;i<7;i++) addEffect({type:"dust",layer:"ground",x:state.player.x,y:state.player.y,life:.55+Math.random()*.45,size:.6,vx:(Math.random()-.5)*5,vy:-2-Math.random()*4});
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
  const viewLeft=camX-metresAcross/2;
  const viewTop=camY-metresHigh/2;
  const startX=Math.floor(viewLeft/TILE_METERS)*TILE_METERS;
  const endX=Math.ceil((camX+metresAcross/2)/TILE_METERS)*TILE_METERS;
  const startY=Math.floor(viewTop/TILE_METERS)*TILE_METERS;
  const endY=Math.ceil((camY+metresHigh/2)/TILE_METERS)*TILE_METERS;
  const terrainFrame=renderTerrainFrame(startX,startY,w,h);
  const sourceX=(viewLeft-startX)/TILE_METERS*TERRAIN_TILE_PIXELS;
  const sourceY=(viewTop-startY)/TILE_METERS*TERRAIN_TILE_PIXELS;
  syncTerrainLayer(terrainFrame,sourceX,sourceY,w,h);

  // Ambient motes and physical debris belong behind actors. Only explicit
  // overlay effects (currently drowning bubbles) are allowed above them.
  drawAmbientNature();
  drawEffects(camX,camY,"ground");
  const trees=visibleTrees(
    Math.floor(startX/TILE_METERS),Math.ceil(endX/TILE_METERS),
    Math.floor(startY/TILE_METERS),Math.ceil(endY/TILE_METERS)
  );
  const roadDecorations=visibleRoadDecorations(
    Math.floor(startX/TILE_METERS),Math.ceil(endX/TILE_METERS),
    Math.floor(startY/TILE_METERS),Math.ceil(endY/TILE_METERS)
  );
  const structureBlocks=visibleStructureBlocks(
    Math.floor(startX/TILE_METERS),Math.ceil(endX/TILE_METERS),
    Math.floor(startY/TILE_METERS),Math.ceil(endY/TILE_METERS)
  );
  const animals=animalsInRect(viewLeft,viewTop,camX+metresAcross/2,camY+metresHigh/2);
  for(const landmark of landmarks) drawLandmarkGround(landmark,camX,camY);
  for(const animal of animals) drawAnimalGround(animal,camX,camY);
  drawDragTether(camX,camY);

  const renderQueue=trees.map((tree)=>{
    const physics=treePhysicsStates.get(treeKey(tree));
    const segment=physics&&physics.status!=="standing"?fallenTreeSegment(physics):null;
    return {type:"tree",y:segment?Math.max(segment.ay,segment.by):(tree.gy+.8)*TILE_METERS,tree};
  });
  for(const asset of roadDecorations){
    const meta=roadAssetCatalog[asset.kind];
    renderQueue.push({type:"roadDecoration",y:(asset.gy+meta.h-.12)*TILE_METERS,asset});
  }
  for(const structure of structureBlocks) renderQueue.push({...structure,y:(structure.gy+.92)*TILE_METERS});
  for(const animal of animals) renderQueue.push({type:"animal",y:animal.y+animalCatalog[animal.species].radius*.35,animal});
  for(const peer of state.peers.values()) renderQueue.push({type:"peer",y:peer.y,player:peer});
  renderQueue.push({type:"local",y:state.player.y,player:state.player});
  renderQueue.sort((a,b)=>a.y-b.y);
  for(const item of renderQueue){
    if(item.type==="tree"){
      drawGridTree(item.tree,camX,camY);
      continue;
    }
    if(item.type==="roadDecoration"){
      drawRoadDecoration(item.asset,camX,camY);
      continue;
    }
    if(item.type==="structure"){
      drawStructureBlock(item.code,item.gx,item.gy,camX,camY);
      continue;
    }
    if(item.type==="animal"){
      drawAnimal(item.animal,camX,camY);
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
  for(const landmark of landmarks) drawLandmarkLabel(landmark,camX,camY);
  drawEffects(camX,camY,"air");

  const hour=(8+state.elapsed/120)%24;
  if(hour<6||hour>19){
    const darkness=hour<5||hour>21?0.25:0.12;
    ctx.fillStyle="rgba(8,18,38,"+darkness+")";
    ctx.fillRect(0,0,w,h);
  }
}

function drawBackHair(c,u,style,hair,dir){
  if(dir==="up"||style==="hood"||style==="undercut"||style==="mohawk"||style==="tousled") return;
  c.fillStyle=shade(hair,-8);
  if(dir==="side"){
    if(style==="long"){
      c.fillRect(3*u,4*u,3*u,10*u);
      c.fillRect(2*u,10*u,3*u,4*u);
    }else if(style==="curls"){
      for(const [hx,hy] of [[3,5],[4,7],[3,9],[4,11]]) c.fillRect(hx*u,hy*u,3*u,3*u);
    }else if(style==="ponytail"){
      c.fillRect(2*u,5*u,3*u,7*u);
      c.fillRect(3*u,11*u,2*u,3*u);
    }else if(style==="bun"){
      c.fillRect(2*u,0,4*u,4*u);
    }else if(style==="bob"){
      c.fillRect(4*u,4*u,3*u,7*u);
    }else if(style==="braid"){
      c.fillRect(4*u,5*u,2*u,7*u);
      c.fillRect(3*u,10*u,3*u,3*u);
    }
    return;
  }
  if(style==="long"){
    c.fillRect(3*u,3*u,2*u,11*u);
    c.fillRect(11*u,3*u,2*u,11*u);
  }else if(style==="curls"){
    for(const [hx,hy] of [[3,5],[3,8],[10,6],[10,9]]) c.fillRect(hx*u,hy*u,3*u,3*u);
  }else if(style==="ponytail"){
    c.fillRect(11*u,6*u,3*u,7*u);
  }else if(style==="bun"){
    c.fillRect(6*u,-2*u,5*u,4*u);
  }else if(style==="bob"){
    c.fillRect(3*u,3*u,2*u,8*u);
    c.fillRect(11*u,3*u,2*u,8*u);
  }else if(style==="braid"){
    c.fillRect(11*u,6*u,2*u,7*u);
    c.fillRect(10*u,11*u,3*u,3*u);
  }
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
    }else if(style==="long"){
      c.fillRect(4*u,1*u,8*u,3*u);
      c.fillRect(5*u,3*u,2*u,5*u);
      c.fillStyle=shade(hair,12);
      c.fillRect(6*u,2*u,1*u,5*u);
    }else if(style==="curls"){
      for(const [hx,hy] of [[5,0],[8,0],[10,1],[4,2],[6,2],[9,2],[4,4]]) c.fillRect(hx*u,hy*u,3*u,3*u);
    }else if(style==="undercut"){
      c.fillRect(6*u,0,6*u,3*u);
      c.fillStyle=shade(hair,18);
      c.fillRect(5*u,3*u,2*u,3*u);
    }else if(style==="ponytail"){
      c.fillRect(5*u,1*u,7*u,3*u);
      c.fillRect(4*u,3*u,3*u,4*u);
    }else if(style==="bun"){
      c.fillRect(5*u,1*u,7*u,3*u);
      c.fillRect(4*u,2*u,2*u,5*u);
      c.fillRect(2*u,0,4*u,4*u);
    }else if(style==="bob"){
      c.fillRect(5*u,1*u,7*u,3*u);
      c.fillRect(5*u,3*u,2*u,6*u);
    }else if(style==="braid"){
      c.fillRect(5*u,1*u,7*u,3*u);
      c.fillRect(5*u,3*u,2*u,3*u);
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
  }else if(style==="long"){
    c.fillRect(3*u,1*u,10*u,3*u);
    if(dir==="up"){
      c.fillRect(3*u,3*u,2*u,10*u);
      c.fillRect(11*u,3*u,2*u,10*u);
      c.fillRect(5*u,3*u,6*u,9*u);
      c.fillStyle=shade(hair,12);
      c.fillRect(5*u,3*u,2*u,7*u);
    }
  }else if(style==="curls"){
    for(const [hx,hy] of [[3,1],[6,0],[9,0],[11,2],[3,4],[5,3],[8,3],[11,5]]) c.fillRect(hx*u,hy*u,3*u,3*u);
    if(dir==="up"){
      c.fillRect(5*u,5*u,6*u,5*u);
      c.fillStyle=shade(hair,13);
      c.fillRect(6*u,5*u,2*u,3*u);
    }
  }else if(style==="undercut"){
    c.fillRect(5*u,0,7*u,3*u);
    c.fillRect(4*u,2*u,8*u,2*u);
    c.fillStyle=shade(hair,20);
    c.fillRect(3*u,3*u,2*u,3*u);
    if(dir==="up") c.fillRect(5*u,3*u,6*u,2*u);
  }else if(style==="ponytail"){
    c.fillRect(3*u,1*u,10*u,3*u);
    c.fillRect(3*u,3*u,2*u,5*u);
    c.fillRect(11*u,3*u,2*u,5*u);
    if(dir==="up"){
      c.fillRect(5*u,3*u,6*u,4*u);
      c.fillRect(7*u,6*u,3*u,7*u);
      c.fillRect(6*u,11*u,4*u,3*u);
    }
  }else if(style==="bun"){
    c.fillRect(3*u,1*u,10*u,3*u);
    c.fillRect(3*u,3*u,2*u,5*u);
    c.fillRect(11*u,3*u,2*u,5*u);
    c.fillRect(6*u,-2*u,5*u,4*u);
    if(dir==="up") c.fillRect(5*u,3*u,6*u,5*u);
  }else if(style==="bob"){
    c.fillRect(3*u,1*u,10*u,3*u);
    c.fillRect(3*u,3*u,2*u,4*u);
    c.fillRect(11*u,3*u,2*u,4*u);
    if(dir==="up"){
      c.fillRect(3*u,6*u,2*u,4*u);
      c.fillRect(11*u,6*u,2*u,4*u);
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

function drawBeard(c,u,style,color,dir){
  if(!style||style==="none"||dir==="up") return;
  c.save();
  c.fillStyle=color;
  if(style==="stubble") c.globalAlpha=.58;
  if(dir==="side"){
    if(style==="stubble"){
      c.fillRect(8*u,8*u,3*u,2*u);
      c.fillRect(7*u,9*u,3*u,1*u);
    }else if(style==="moustache"){
      c.fillRect(9*u,7*u,3*u,1*u);
      c.fillRect(8*u,8*u,3*u,1*u);
    }else if(style==="goatee"){
      c.fillRect(9*u,8*u,2*u,3*u);
      c.fillRect(8*u,10*u,3*u,2*u);
    }else if(style==="full"||style==="braided"){
      c.fillRect(7*u,7*u,5*u,3*u);
      c.fillRect(6*u,9*u,5*u,3*u);
      if(style==="braided"){
        c.fillRect(8*u,11*u,2*u,4*u);
        c.fillStyle=shade(color,18);
        c.fillRect(8*u,13*u,2*u,1*u);
      }
    }
  }else{
    if(style==="stubble"){
      c.fillRect(5*u,8*u,6*u,2*u);
      c.fillRect(6*u,7*u,1*u,1*u);
      c.fillRect(10*u,7*u,1*u,1*u);
    }else if(style==="moustache"){
      c.fillRect(5*u,8*u,3*u,1*u);
      c.fillRect(9*u,8*u,3*u,1*u);
      c.fillRect(7*u,9*u,3*u,1*u);
    }else if(style==="goatee"){
      c.fillRect(7*u,8*u,3*u,2*u);
      c.fillRect(7*u,10*u,3*u,3*u);
    }else if(style==="full"||style==="braided"){
      c.fillRect(5*u,7*u,7*u,3*u);
      c.fillRect(6*u,9*u,5*u,3*u);
      if(style==="braided"){
        c.fillRect(7*u,11*u,3*u,5*u);
        c.fillStyle=shade(color,18);
        c.fillRect(7*u,13*u,3*u,1*u);
      }
    }
  }
  c.restore();
}

function drawOutfitDetails(c,u,style,dir,shirt){
  const side=dir==="side";
  const back=dir==="up";
  if(style==="ranger"){
    c.fillStyle="#755438";
    if(side) for(let i=0;i<5;i++) c.fillRect((7+Math.floor(i*.7))*u,(10+i)*u,2*u,1*u);
    else for(let i=0;i<6;i++) c.fillRect((5+i)*u,(10+i)*u,2*u,1*u);
  }else if(style==="raider"){
    c.fillStyle="#a99d86";
    c.fillRect((side?5:4)*u,(back?9:8)*u,(side?8:8)*u,2*u);
    c.fillStyle="#6f675b";
    c.fillRect((side?6:5)*u,(back?10:9)*u,(side?6:6)*u,1*u);
  }else if(style==="scholar"){
    c.fillStyle="#d0a94f";
    c.fillRect((side?7:5)*u,9*u,(side?5:6)*u,1*u);
    c.fillRect((side?7:7)*u,10*u,(side?1:2)*u,6*u);
  }else if(style==="north"){
    c.fillStyle="#d1c9b4";
    c.fillRect((side?5:4)*u,8*u,(side?8:8)*u,2*u);
    c.fillStyle="#8d887d";
    c.fillRect((side?7:6)*u,9*u,(side?4:4)*u,1*u);
  }else if(style==="desert"){
    c.fillStyle="#e1c98d";
    c.fillRect((side?6:4)*u,12*u,(side?6:8)*u,2*u);
    c.fillStyle="#a9713e";
    c.fillRect((side?9:8)*u,10*u,2*u,6*u);
  }else{
    c.fillStyle=shade(shirt,-24);
    c.fillRect((side?9:7)*u,12*u,2*u,3*u);
  }
}

function drawHeldItem(c,u,dir,player){
  const itemId=player.heldItem;
  if(!itemCatalog[itemId]) return;
  const progress=Math.max(0,Math.min(1,Number(player.actionProgress)||0));
  const active=!!player.actionType&&progress>0&&progress<1;
  const side=dir==="left"||dir==="right";
  const hand=side?[11,12]:dir==="down"?[13,12]:[3,11];
  const baseAngle=side?-.30:dir==="down"?.78:-2.25;
  const swing=active?lerp(-1.12,1.05,smooth(progress)):0;

  c.save();
  c.translate(hand[0]*u,hand[1]*u);
  c.rotate(baseAngle+swing);

  if(itemId==="ironSword"&&active&&progress>.12&&progress<.88){
    // The trail is deliberately part of the character draw, so it can never
    // leak into the generic particle layer above the sprite.
    c.save();
    c.globalAlpha=.42*(1-Math.abs(progress-.5)*1.35);
    c.strokeStyle="#d9f5ed";
    c.lineWidth=Math.max(2,u*1.35);
    c.beginPath();
    c.arc(0,0,8*u,-1.18,.35);
    c.stroke();
    c.globalAlpha=.28;
    c.strokeStyle="#6dc8d2";
    c.lineWidth=Math.max(1,u*.65);
    c.beginPath();
    c.arc(0,0,10*u,-1.12,.42);
    c.stroke();
    c.restore();
    for(const [offset,alpha,length] of [[-.72,.16,7],[-.48,.25,8],[-.24,.36,9]]){
      c.save();
      c.rotate(offset);
      c.globalAlpha=alpha;
      c.fillStyle=offset<-.5?"#5eb5c2":"#d7f1e9";
      c.fillRect(3*u,-u,length*u,Math.max(2,u));
      c.restore();
    }
  }

  if(itemId==="ironSword"){
    c.fillStyle="#553b25";
    c.fillRect(-2*u,-u,4*u,2*u);
    c.fillStyle="#d5c487";
    c.fillRect(1*u,-2*u,2*u,4*u);
    c.fillStyle="#6d7777";
    c.fillRect(3*u,-u,7*u,2*u);
    c.fillStyle="#c9d2cb";
    c.fillRect(4*u,-u,5*u,u);
    c.fillRect(9*u,0,2*u,u);
  }else if(itemId==="woodsmanAxe"){
    c.fillStyle="#6e492b";
    c.fillRect(-u,-u,10*u,2*u);
    c.fillStyle="#a87945";
    c.fillRect(0,-u,7*u,u);
    c.fillStyle="#454d4e";
    c.fillRect(6*u,-3*u,4*u,6*u);
    c.fillStyle="#929995";
    c.fillRect(7*u,-3*u,4*u,2*u);
    c.fillRect(9*u,-2*u,2*u,4*u);
  }
  c.restore();
}

function drawCharacter(c,x,y,p,scale=2.5,local=false,portraitMode=false){
  // Integer sprite units keep every limb and clothing layer on the pixel
  // grid. Fractional units were the main source of the soft, smeared player.
  const u=Math.max(1,Math.round(scale));
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
  const beard=p.beard||hair;
  const beardStyle=p.beardStyle||"none";
  const outfit=p.outfit||"traveler";

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
    drawBackHair(c,u,hairStyle,hair,"side");
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
    drawOutfitDetails(c,u,outfit,"side",shirt);
    c.fillStyle="#8e6d37";
    c.fillRect(6*u,15*u,6*u,1*u);
    c.fillStyle=skin;
    c.fillRect((10+step*.5)*u,10*u,2*u,5*u);
    c.fillRect(6*u,3*u,6*u,7*u);
    drawHair(c,u,hairStyle,hair,"side");
    c.fillStyle=eyes;
    c.fillRect(10*u,6*u,1*u,1*u);
    drawBeard(c,u,beardStyle,beard,"side");
  }else if(dir==="down"){
    // Front view: the cloak sits behind the body and only shows at the sides.
    drawBackHair(c,u,hairStyle,hair,"down");
    c.fillStyle=cloak;
    c.fillRect(2*u,8*u,12*u,10*u);
    c.fillStyle=shade(cloak,-18);
    c.fillRect(2*u,15*u,3*u,3*u);
    c.fillRect(11*u,15*u,3*u,3*u);

    const leftStride=step;
    const rightStride=-step;
    c.fillStyle="#222b31";
    c.fillRect(4*u,(16+leftStride)*u,3*u,5*u);
    c.fillRect(9*u,(16+rightStride)*u,3*u,5*u);
    c.fillStyle="#151b20";
    c.fillRect(4*u,(20+leftStride)*u,3*u,2*u);
    c.fillRect(9*u,(20+rightStride)*u,3*u,2*u);
    c.fillStyle="#39434a";
    c.fillRect(4*u,(21+leftStride)*u,3*u,1*u);
    c.fillRect(9*u,(21+rightStride)*u,3*u,1*u);

    c.fillStyle=shirt;
    c.fillRect(4*u,9*u,8*u,8*u);
    c.fillStyle=shade(shirt,24);
    c.fillRect(4*u,9*u,8*u,1*u);
    drawOutfitDetails(c,u,outfit,"down",shirt);
    c.fillStyle="#8e6d37";
    c.fillRect(4*u,15*u,8*u,1*u);
    c.fillStyle=skin;
    c.fillRect(2*u,(10+step*.5)*u,2*u,5*u);
    c.fillRect(12*u,(10-step*.5)*u,2*u,5*u);
    c.fillRect(4*u,3*u,8*u,7*u);
    drawHair(c,u,hairStyle,hair,"down");
    c.fillStyle=eyes;
    c.fillRect(6*u,6*u,1*u,1*u);
    c.fillRect(10*u,6*u,1*u,1*u);
    drawBeard(c,u,beardStyle,beard,"down");
  }else{
    // Back view: shoes point north, while the cloak correctly covers the back
    // between the shoulders and its hem. Arms and head remain in front of it.
    const leftStride=-step;
    const rightStride=step;
    c.fillStyle="#222b31";
    c.fillRect(4*u,(16+leftStride)*u,3*u,5*u);
    c.fillRect(9*u,(16+rightStride)*u,3*u,5*u);
    c.fillStyle="#151b20";
    c.fillRect(4*u,(18+leftStride)*u,3*u,2*u);
    c.fillRect(9*u,(18+rightStride)*u,3*u,2*u);
    c.fillStyle="#39434a";
    c.fillRect(4*u,(18+leftStride)*u,3*u,1*u);
    c.fillRect(9*u,(18+rightStride)*u,3*u,1*u);

    c.fillStyle=shirt;
    c.fillRect(4*u,9*u,8*u,8*u);
    c.fillStyle=shade(shirt,-16);
    c.fillRect(4*u,9*u,8*u,1*u);
    drawOutfitDetails(c,u,outfit,"up",shirt);
    c.fillStyle=cloak;
    c.fillRect(3*u,8*u,10*u,10*u);
    c.fillStyle=shade(cloak,16);
    c.fillRect(4*u,9*u,1*u,7*u);
    c.fillStyle=shade(cloak,-18);
    c.fillRect(4*u,17*u,8*u,1*u);
    c.fillStyle=skin;
    c.fillRect(2*u,(10+step*.5)*u,2*u,5*u);
    c.fillRect(12*u,(10-step*.5)*u,2*u,5*u);
    c.fillRect(4*u,3*u,8*u,7*u);
    drawHair(c,u,hairStyle,hair,"up");
  }

  if(!portraitMode) drawHeldItem(c,u,dir,p);

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

function inventoryItemById(id){
  return state.inventory.items.find((item)=>item.id===id)||null;
}

function equippedSlotForItem(id){
  for(const [slot,itemId] of Object.entries(state.inventory.equipment)) if(itemId===id) return slot;
  return null;
}

function inventoryItemSize(item){
  const definition=itemCatalog[item.itemId];
  return item.rotated?{width:definition.height,height:definition.width}:{width:definition.width,height:definition.height};
}

function canPlaceInventoryItem(item,x,y,ignoreId=item.id){
  const size=inventoryItemSize(item);
  if(x<0||y<0||x+size.width>state.inventory.columns||y+size.height>state.inventory.rows) return false;
  for(const other of state.inventory.items){
    if(other.id===ignoreId||equippedSlotForItem(other.id)||other.x==null||other.y==null) continue;
    const otherSize=inventoryItemSize(other);
    const overlaps=x<other.x+otherSize.width&&x+size.width>other.x&&y<other.y+otherSize.height&&y+size.height>other.y;
    if(overlaps) return false;
  }
  return true;
}

function firstInventorySpace(item){
  const size=inventoryItemSize(item);
  for(let y=0;y<=state.inventory.rows-size.height;y++){
    for(let x=0;x<=state.inventory.columns-size.width;x++) if(canPlaceInventoryItem(item,x,y)) return {x,y};
  }
  return null;
}

function addInventoryItem(itemId,quantity=1){
  const definition=itemCatalog[itemId];
  if(!definition||quantity<=0) return 0;
  const maxStack=Math.max(1,definition.maxStack||1);
  let remaining=Math.floor(quantity);
  for(const item of state.inventory.items){
    if(item.itemId!==itemId||equippedSlotForItem(item.id)) continue;
    const current=Math.max(1,item.quantity||1);
    if(current>=maxStack) continue;
    const moved=Math.min(remaining,maxStack-current);
    item.quantity=current+moved;
    remaining-=moved;
    if(remaining<=0) break;
  }
  while(remaining>0){
    const amount=Math.min(remaining,maxStack);
    const item={id:itemId+"-"+(++state.inventorySerial),itemId,x:0,y:0,rotated:false,quantity:amount};
    const space=firstInventorySpace(item);
    if(!space) break;
    item.x=space.x;
    item.y=space.y;
    state.inventory.items.push(item);
    remaining-=amount;
  }
  if(quantity!==remaining) renderInventory();
  return quantity-remaining;
}

function syncHeldItem(){
  const handId=state.inventory.equipment.mainHand;
  const item=inventoryItemById(handId);
  state.player.heldItem=item?item.itemId:null;
  updateQuickbar();
}

function equipInventoryItem(id){
  const item=inventoryItemById(id);
  if(!item) return false;
  const definition=itemCatalog[item.itemId];
  const slot=definition.equipSlot;
  if(!slot||!equipmentSlotCatalog[slot]?.accepts.includes(definition.category)) return false;
  if(state.inventory.equipment[slot]===id) return true;
  const currentId=state.inventory.equipment[slot];
  if(currentId){
    const current=inventoryItemById(currentId);
    const space=firstInventorySpace(current);
    if(!space){showToast("Im Rucksack ist kein Platz zum Wechseln.");return false;}
    current.x=space.x;
    current.y=space.y;
  }
  const previousSlot=equippedSlotForItem(id);
  if(previousSlot) state.inventory.equipment[previousSlot]=null;
  item.x=null;
  item.y=null;
  state.inventory.equipment[slot]=id;
  state.inventory.selectedId=id;
  syncHeldItem();
  renderInventory();
  showToast(definition.name+" ausgerüstet");
  return true;
}

function unequipInventoryItem(id){
  const item=inventoryItemById(id);
  const slot=equippedSlotForItem(id);
  if(!item||!slot) return false;
  const space=firstInventorySpace(item);
  if(!space){showToast("Der Rucksack ist voll.");return false;}
  state.inventory.equipment[slot]=null;
  item.x=space.x;
  item.y=space.y;
  syncHeldItem();
  renderInventory();
  return true;
}

function moveSelectedInventoryItem(x,y){
  const item=inventoryItemById(state.inventory.selectedId);
  if(!item) return;
  const previousSlot=equippedSlotForItem(item.id);
  if(!canPlaceInventoryItem(item,x,y)){
    showToast("Dort ist nicht genug Platz.");
    return;
  }
  if(previousSlot) state.inventory.equipment[previousSlot]=null;
  item.x=x;
  item.y=y;
  syncHeldItem();
  renderInventory();
}

function rotateSelectedInventoryItem(){
  const item=inventoryItemById(state.inventory.selectedId);
  if(!item||equippedSlotForItem(item.id)) return;
  item.rotated=!item.rotated;
  if(!canPlaceInventoryItem(item,item.x,item.y)){
    item.rotated=!item.rotated;
    showToast("Zum Drehen fehlt Platz.");
  }
  renderInventory();
}

function drawInventoryItemIcon(canvas,itemId){
  const c=canvas.getContext("2d");
  c.imageSmoothingEnabled=false;
  c.clearRect(0,0,canvas.width,canvas.height);
  const unit=Math.max(2,Math.floor(Math.min(canvas.width/16,canvas.height/18)));
  const cx=Math.floor(canvas.width/2);
  const cy=Math.floor(canvas.height/2);
  c.save();
  c.translate(cx,cy);
  if(itemId==="ironSword"){
    c.rotate(-.72);
    c.fillStyle="#563b23";c.fillRect(-2*unit,5*unit,4*unit,2*unit);
    c.fillStyle="#d1b866";c.fillRect(-3*unit,3*unit,6*unit,2*unit);
    c.fillStyle="#8c9693";c.fillRect(-unit,-6*unit,2*unit,10*unit);
    c.fillStyle="#d6ded7";c.fillRect(-unit,-6*unit,unit,8*unit);
    c.fillRect(0,-7*unit,unit,2*unit);
  }else if(itemId==="woodsmanAxe"){
    c.rotate(-.55);
    c.fillStyle="#79502e";c.fillRect(-unit,-6*unit,2*unit,13*unit);
    c.fillStyle="#aa7442";c.fillRect(-unit,-5*unit,unit,10*unit);
    c.fillStyle="#4a5352";c.fillRect(-4*unit,-7*unit,8*unit,4*unit);
    c.fillStyle="#a8afaa";c.fillRect(-4*unit,-7*unit,6*unit,unit);
  }else if(itemCatalog[itemId]?.icon==="meatPale"||itemCatalog[itemId]?.icon==="meatRed"){
    c.fillStyle=itemCatalog[itemId].icon==="meatPale"?"#d98b79":"#a53f3d";
    c.fillRect(-5*unit,-3*unit,9*unit,6*unit);c.fillRect(-3*unit,-5*unit,6*unit,10*unit);
    c.fillStyle="#f1c4a1";c.fillRect(-2*unit,-2*unit,3*unit,3*unit);
    c.fillStyle="#f0ddd0";c.fillRect(4*unit,-unit,3*unit,2*unit);
  }else if(itemCatalog[itemId]?.icon==="feather"){
    c.rotate(.5);c.fillStyle="#e8e0c5";c.fillRect(-unit,-7*unit,3*unit,12*unit);c.fillRect(-3*unit,-4*unit,3*unit,6*unit);
    c.fillStyle="#928a76";c.fillRect(0,-5*unit,unit,13*unit);
  }else if(itemCatalog[itemId]?.icon==="hide"){
    c.fillStyle="#74513b";c.fillRect(-6*unit,-5*unit,12*unit,10*unit);c.fillRect(-8*unit,-3*unit,16*unit,6*unit);
    c.fillStyle="#9b7455";c.fillRect(-4*unit,-3*unit,8*unit,6*unit);c.fillStyle="#4c3429";c.fillRect(-2*unit,-unit,4*unit,2*unit);
  }else if(itemCatalog[itemId]?.icon==="tusk"){
    c.fillStyle="#d9ceb0";c.fillRect(-3*unit,-7*unit,4*unit,10*unit);c.fillRect(-2*unit,2*unit,5*unit,3*unit);c.fillRect(unit,4*unit,4*unit,2*unit);
    c.fillStyle="#f2ead1";c.fillRect(-2*unit,-6*unit,2*unit,8*unit);
  }else if(itemCatalog[itemId]?.icon==="bone"){
    c.rotate(-.35);c.fillStyle="#d9d0b5";c.fillRect(-2*unit,-6*unit,4*unit,12*unit);c.fillRect(-4*unit,-7*unit,3*unit,3*unit);c.fillRect(unit,-7*unit,3*unit,3*unit);c.fillRect(-4*unit,5*unit,3*unit,3*unit);c.fillRect(unit,5*unit,3*unit,3*unit);
  }
  c.restore();
}

function renderInventory(){
  const grid=$("inventoryGrid");
  if(!grid) return;
  grid.replaceChildren();
  for(let y=0;y<state.inventory.rows;y++){
    for(let x=0;x<state.inventory.columns;x++){
      const cell=document.createElement("button");
      cell.type="button";
      cell.className="inventory-cell";
      cell.style.gridColumn=String(x+1);
      cell.style.gridRow=String(y+1);
      cell.setAttribute("aria-label","Feld "+(x+1)+", "+(y+1));
      cell.addEventListener("click",()=>moveSelectedInventoryItem(x,y));
      grid.appendChild(cell);
    }
  }
  for(const item of state.inventory.items){
    if(equippedSlotForItem(item.id)||item.x==null||item.y==null) continue;
    const definition=itemCatalog[item.itemId];
    const size=inventoryItemSize(item);
    const button=document.createElement("button");
    button.type="button";
    button.className="inventory-item"+(state.inventory.selectedId===item.id?" selected":"");
    button.style.gridColumn=(item.x+1)+" / span "+size.width;
    button.style.gridRow=(item.y+1)+" / span "+size.height;
    button.title=definition.name;
    const icon=document.createElement("canvas");
    icon.width=Math.max(32,size.width*32);
    icon.height=Math.max(48,size.height*30);
    button.appendChild(icon);
    const label=document.createElement("span");
    label.textContent=definition.short+((item.quantity||1)>1?" ×"+(item.quantity||1):"");
    button.appendChild(label);
    button.addEventListener("click",(event)=>{
      event.stopPropagation();
      state.inventory.selectedId=item.id;
      renderInventory();
    });
    button.addEventListener("dblclick",()=>equipInventoryItem(item.id));
    grid.appendChild(button);
    drawInventoryItemIcon(icon,item.itemId);
  }

  for(const element of document.querySelectorAll("[data-equipment-slot]")){
    const slot=element.dataset.equipmentSlot;
    const item=inventoryItemById(state.inventory.equipment[slot]);
    const meta=equipmentSlotCatalog[slot];
    element.classList.toggle("occupied",!!item);
    element.classList.toggle("selected",!!item&&state.inventory.selectedId===item.id);
    element.innerHTML='<small>'+meta.label+'</small><strong>'+(item?itemCatalog[item.itemId].short:"Leer")+'</strong>';
  }

  const selected=inventoryItemById(state.inventory.selectedId);
  const definition=selected?itemCatalog[selected.itemId]:null;
  $("inventoryItemName").textContent=definition?definition.name:"Kein Gegenstand";
  $("inventoryItemSize").textContent=selected?(inventoryItemSize(selected).width+" × "+inventoryItemSize(selected).height+" Felder"+((selected.quantity||1)>1?" · Menge "+selected.quantity:"")):"–";
  $("inventoryItemDescription").textContent=definition?definition.description:"Wähle einen Gegenstand oder Ausrüstungsslot.";
  const equipped=selected?equippedSlotForItem(selected.id):null;
  $("inventoryEquipBtn").disabled=!definition||!definition.equipSlot;
  $("inventoryEquipBtn").textContent=!definition?.equipSlot?"Material":equipped?"In Rucksack":"Ausrüsten";
  $("inventoryRotateBtn").disabled=!selected||!!equipped;
  updateQuickbar();
}

function updateQuickbar(){
  if(!$("quickbar")) return;
  const equippedId=state.inventory.equipment.mainHand;
  for(const button of document.querySelectorAll("[data-quick-item]")){
    const item=state.inventory.items.find((entry)=>entry.itemId===button.dataset.quickItem);
    button.classList.toggle("active",!!item&&item.id===equippedId);
    button.classList.toggle("stored",!!item&&item.id!==equippedId);
  }
  updateMobileControlState();
}

function toggleInventory(force){
  releaseAllMobileControls();
  state.inventoryOpen=force??!state.inventoryOpen;
  if(state.inventoryOpen){
    state.mapOpen=false;
    $("mapOverlay").classList.add("hidden");
    state.keys.clear();
    renderInventory();
  }
  $("inventoryOverlay").classList.toggle("hidden",!state.inventoryOpen);
  updateMobileControlState();
}

function directionVector(direction){
  return direction==="up"?{x:0,y:-1}:direction==="down"?{x:0,y:1}:direction==="left"?{x:-1,y:0}:{x:1,y:0};
}

function closestPointOnSegment(px,py,ax,ay,bx,by){
  const dx=bx-ax;
  const dy=by-ay;
  const length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/length)):0;
  return {x:ax+dx*t,y:ay+dy*t,t};
}

function findTreeToolTarget(range=TREE_HIT_RANGE){
  const px=state.player.x;
  const py=state.player.y;
  const facing=directionVector(state.player.dir);
  const gx=Math.floor(px/TILE_METERS);
  const gy=Math.floor(py/TILE_METERS);
  const candidates=visibleTrees(gx-5,gx+5,gy-5,gy+5);
  let best=null;
  for(const tree of candidates){
    if(!isChoppableTree(tree)) continue;
    const physics=treePhysicsStates.get(treeKey(tree));
    if(physics?.status==="falling"||physics?.status==="split") continue;
    let point={x:(tree.gx+.5)*TILE_METERS,y:(tree.gy+.5)*TILE_METERS};
    if(physics?.status==="fallen"){
      const segment=fallenTreeSegment(physics);
      point=closestPointOnSegment(px,py,segment.ax,segment.ay,segment.bx,segment.by);
    }
    const dx=point.x-px;
    const dy=point.y-py;
    const distance=Math.hypot(dx,dy);
    if(distance>range) continue;
    const facingDot=distance?(dx*facing.x+dy*facing.y)/distance:1;
    if(facingDot<-.12) continue;
    const score=distance+(1-facingDot)*5;
    if(!best||score<best.score) best={tree,physics,point,distance,score};
  }
  return best;
}

function findAnimalTarget(range=ANIMAL_HIT_RANGE){
  const px=state.player.x;
  const py=state.player.y;
  const facing=directionVector(state.player.dir);
  let best=null;
  for(const animal of activeAnimalsNear(px,py,range+32)){
    const dx=animal.x-px;
    const dy=animal.y-py;
    const centreDistance=Math.hypot(dx,dy);
    const radius=animalCatalog[animal.species].radius*(animal.status==="alive"?1:1.35);
    const distance=Math.max(0,centreDistance-radius);
    if(distance>range) continue;
    const facingDot=centreDistance?(dx*facing.x+dy*facing.y)/centreDistance:1;
    if(facingDot<-.16) continue;
    const score=distance+(1-facingDot)*5+(animal.status==="alive"?0:.35);
    if(!best||score<best.score) best={animal,point:{x:animal.x,y:animal.y},distance,score};
  }
  return best;
}

function emitWoodChips(x,y,count=6){
  for(let index=0;index<count;index++) addEffect({
    type:"woodChip",layer:"ground",x:x+(Math.random()-.5)*2,y:y+(Math.random()-.5)*2,
    life:.55+Math.random()*.5,size:.7+Math.random()*.45,
    vx:(Math.random()-.5)*8,vy:-3-Math.random()*6,
    color:index%2?"#8c5e35":"#c08a4f"
  });
}

function performAxeImpact(){
  const animalTarget=findAnimalTarget();
  const target=findTreeToolTarget();
  if(animalTarget&&(!target||animalTarget.score<=target.score+1.5)){
    damageAnimal(animalTarget.animal,itemCatalog.woodsmanAxe.animalDamage,"woodsmanAxe");
    return;
  }
  if(!target) return;
  const physics=target.physics||getTreePhysics(target.tree,true);
  emitWoodChips(target.point.x,target.point.y,7);
  if(physics.status==="fallen"){
    physics.splitHits++;
    if(physics.splitHits>=TREE_SPLIT_HITS){
      physics.status="split";
      physics.segments=3;
      showToast("Der Stamm zerbricht in drei Holzabschnitte.",2200);
    }else{
      showToast("Stamm zerteilen · "+physics.splitHits+" / "+TREE_SPLIT_HITS);
    }
    return;
  }
  shakeTree(target.tree,true);
  physics.health=Math.max(0,physics.health-itemCatalog.woodsmanAxe.treeDamage);
  if(physics.health>0){
    showToast("Baumstabilität · "+Math.ceil(physics.health/physics.maxHealth*100)+" %",1100);
    return;
  }
  const baseX=(target.tree.gx+.5)*TILE_METERS;
  const baseY=(target.tree.gy+.5)*TILE_METERS;
  let dx=baseX-state.player.x;
  let dy=baseY-state.player.y;
  const length=Math.hypot(dx,dy);
  if(length<.01){const facing=directionVector(state.player.dir);dx=facing.x;dy=facing.y;}
  else {dx/=length;dy/=length;}
  physics.status="falling";
  physics.fallDirection={x:dx,y:dy};
  physics.fallProgress=.01;
  physics.angularVelocity=.22;
  showToast("Der Baum fällt!",1500);
}

function performSwordImpact(){
  const animalTarget=findAnimalTarget(TILE_METERS*2.35);
  if(animalTarget){
    damageAnimal(animalTarget.animal,itemCatalog.ironSword.animalDamage,"ironSword");
    return;
  }
  const target=findTreeToolTarget(TILE_METERS*2.1);
  if(target&&(!target.physics||target.physics.status==="standing")) shakeTree(target.tree,false);
}

function useEquippedItem(){
  if(!state.running||state.paused||state.mapOpen||state.inventoryOpen||state.dead||state.action.cooldown>0) return false;
  const item=inventoryItemById(state.inventory.equipment.mainHand);
  if(!item) return false;
  const definition=itemCatalog[item.itemId];
  state.action.type=definition.action;
  state.action.itemId=item.itemId;
  state.action.elapsed=0;
  state.action.duration=definition.action==="swordSwing"?.34:.48;
  state.action.cooldown=definition.cooldown;
  state.player.actionType=definition.action;
  state.player.actionProgress=.001;
  if(definition.action==="axeSwing") performAxeImpact();
  else if(definition.action==="swordSwing") performSwordImpact();
  return true;
}

function updateItemAction(dt){
  state.action.cooldown=Math.max(0,state.action.cooldown-dt);
  if(!state.action.type) return;
  state.action.elapsed+=dt;
  state.player.actionProgress=Math.min(1,state.action.elapsed/state.action.duration);
  if(state.action.elapsed>=state.action.duration){
    state.action.type=null;
    state.action.itemId=null;
    state.player.actionType=null;
    state.player.actionProgress=0;
  }
}

function updateTreePhysics(dt){
  for(const physics of treePhysicsStates.values()){
    if(physics.status!=="falling") continue;
    physics.angularVelocity+=dt*1.45;
    physics.fallProgress=Math.min(1,physics.fallProgress+physics.angularVelocity*dt);
    if(physics.fallProgress<1) continue;
    physics.status="fallen";
    const segment=fallenTreeSegment(physics);
    for(let i=0;i<10;i++) addEffect({
      type:"dust",layer:"ground",x:segment.bx+(Math.random()-.5)*8,y:segment.by+(Math.random()-.5)*8,
      life:.7+Math.random()*.4,size:.8,vx:(Math.random()-.5)*5,vy:-2-Math.random()*3
    });
    showToast("Der Stamm liegt. Mit der Axt kannst du ihn weiter zerteilen.",2600);
  }
}

function movePlayer(dt){
  if(state.paused||state.mapOpen||state.inventoryOpen||state.dead) return;
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
  const bridge=bridgeAt(state.player.x,state.player.y,terrain);
  if(bridge) speed*=1.08;
  else if(terrain.biome==="deepWater") speed*=state.player.drowning ? .18 : .40;
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
  state.draggingAnimalId=null;
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
    target.lineWidth=labels?12:3;
    target.setLineDash(labels?[5,5]:[2,2]);
    target.stroke();
    target.strokeStyle="#c0a168";
    target.lineWidth=labels?4.5:1.8;
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

function resizeGameCanvas(){
  const panel=$("gamePanel");
  const width=Math.max(320,Math.floor(panel?.clientWidth||window.innerWidth||1280));
  const height=Math.max(240,Math.floor(panel?.clientHeight||window.innerHeight||720));
  if(canvas.width===width&&canvas.height===height) return;
  canvas.width=width;
  canvas.height=height;
  ctx.imageSmoothingEnabled=false;
  // Force one terrain-layer resync after a viewport change; subsequent frames
  // return to cheap row/column shifts.
  terrainFrameCache.displayRevision=-1;
}

function loop(ts){
  if(!state.running) return;
  const dt=Math.min(.04,(ts-state.lastTime)/1000||0);
  state.lastTime=ts;
  state.elapsed+=dt;
  movePlayer(dt);
  updateWorldReactions(dt);
  if(!state.paused&&!state.mapOpen&&!state.inventoryOpen) drawWorld();
  if(ts-state.lastUiUpdate>=UI_UPDATE_MS){
    state.lastUiUpdate=ts;
    drawMinimap();
    updateHud();
    updateInteractionHint();
    if(state.mapOpen) drawWorldMap();
  }
  maybeSendNetwork(ts);
  requestAnimationFrame(loop);
}

function characterFromUI(){
  return {
    name:$("playerName").value.trim()||"Abenteurer",
    skin:$("skinSelect").value,
    eyes:$("eyeSelect").value,
    hair:$("hairSelect").value,
    hairStyle:$("hairStyleSelect").value,
    beard:$("beardSelect").value,
    beardStyle:$("beardStyleSelect").value,
    outfit:$("outfitSelect").value,
    shirt:$("shirtSelect").value,
    cloak:$("cloakSelect").value
  };
}

function paintPreview(ts=0){
  if(!$("menuScreen").classList.contains("hidden")&&ts-(paintPreview._last||0)>=40){
    paintPreview._last=ts;
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
  state.draggingAnimalId=null;
  releaseAllMobileControls();
  state.player.walkTime=0;
  syncHeldItem();
  $("menuScreen").classList.add("hidden");
  $("titleScreen").classList.add("hidden");
  $("gamePanel").classList.remove("hidden");
  resizeGameCanvas();
  state.running=true;
  state.paused=false;
  state.mapOpen=false;
  state.inventoryOpen=false;
  $("inventoryOverlay").classList.add("hidden");
  $("deathMenu").classList.add("hidden");
  state.lastTime=performance.now();
  state.lastUiUpdate=0;
  updatePortrait();
  updateMobileControlState();
  requestAnimationFrame(loop);
  broadcast({type:"hello",player:publicPlayer()});
  showToast("Willkommen in der zersplitterten See");
}

function publicPlayer(){
  const p=state.player;
  return {
    id:p.id,name:p.name,x:p.x,y:p.y,dir:p.dir,moving:p.moving,walkTime:p.walkTime,
    health:p.health,stamina:p.stamina,swimming:p.swimming,drowning:p.drowning,
    heldItem:p.heldItem,actionType:p.actionType,actionProgress:p.actionProgress,
    skin:p.skin,eyes:p.eyes,hair:p.hair,hairStyle:p.hairStyle,
    beard:p.beard,beardStyle:p.beardStyle,outfit:p.outfit,shirt:p.shirt,cloak:p.cloak
  };
}

function sanitizePlayer(p){
  if(!p||typeof p!=="object") return null;
  const styles=["tousled","bob","braid","mohawk","long","curls","undercut","ponytail","bun","hood"];
  const beardStyles=["none","stubble","moustache","goatee","full","braided"];
  const outfits=["traveler","ranger","raider","scholar","north","desert"];
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
    heldItem:["ironSword","woodsmanAxe"].includes(p.heldItem)?p.heldItem:null,
    actionType:["swordSwing","axeSwing"].includes(p.actionType)?p.actionType:null,
    actionProgress:Number.isFinite(Number(p.actionProgress))?Math.max(0,Math.min(1,Number(p.actionProgress))):0,
    skin:String(p.skin||"#f1c27d").slice(0,16),
    eyes:String(p.eyes||"#243b53").slice(0,16),
    hair:String(p.hair||"#3a2418").slice(0,16),
    hairStyle:styles.includes(p.hairStyle)?p.hairStyle:"tousled",
    beard:String(p.beard||p.hair||"#3a2418").slice(0,16),
    beardStyle:beardStyles.includes(p.beardStyle)?p.beardStyle:"none",
    outfit:outfits.includes(p.outfit)?p.outfit:"traveler",
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
  releaseAllMobileControls();
  state.paused=force??!state.paused;
  if(state.paused&&state.inventoryOpen) toggleInventory(false);
  $("pauseMenu").classList.toggle("hidden",!state.paused);
  updateMobileControlState();
}

function toggleMap(force){
  releaseAllMobileControls();
  state.mapOpen=force??!state.mapOpen;
  if(state.mapOpen&&state.inventoryOpen){
    state.inventoryOpen=false;
    $("inventoryOverlay").classList.add("hidden");
  }
  $("mapOverlay").classList.toggle("hidden",!state.mapOpen);
  if(state.mapOpen) drawWorldMap();
  updateMobileControlState();
}

window.addEventListener("keydown",(event)=>{
  const key=event.key.toLowerCase();
  if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright","shift"].includes(key)){
    keyboardHeldKeys.add(key);
    state.keys.add(key);
    event.preventDefault();
  }
  if(key==="escape"&&state.running){
    if(state.inventoryOpen) toggleInventory(false);
    else if(state.mapOpen) toggleMap(false);
    else togglePause();
    event.preventDefault();
  }
  if(key==="i"&&state.running&&!event.repeat){
    if(state.paused) togglePause(false);
    toggleInventory();
    event.preventDefault();
  }
  if(key==="r"&&state.inventoryOpen&&!event.repeat){
    rotateSelectedInventoryItem();
    event.preventDefault();
  }
  if((key==="1"||key==="2")&&state.running&&!event.repeat){
    const itemId=key==="1"?"ironSword":"woodsmanAxe";
    const item=state.inventory.items.find((entry)=>entry.itemId===itemId);
    if(item) equipInventoryItem(item.id);
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
  if(key==="e"&&state.running&&!state.paused&&!state.mapOpen&&!state.inventoryOpen&&!event.repeat){
    interactWithWorld();
    event.preventDefault();
  }
});
window.addEventListener("keyup",(event)=>{
  const key=event.key.toLowerCase();
  keyboardHeldKeys.delete(key);
  const heldByTouch=[...mobileHeldPointers.values()].some((entry)=>entry.key===key);
  if(!heldByTouch) state.keys.delete(key);
});
window.addEventListener("blur",()=>{
  keyboardHeldKeys.clear();
  releaseAllMobileControls();
  state.keys.clear();
});

$("beginBtn").addEventListener("click",()=>showMenu(false));
$("multiplayerTitleBtn").addEventListener("click",()=>showMenu(true));
$("backTitleBtn").addEventListener("click",()=>{cleanupNetwork();showTitle();});

["playerName","skinSelect","eyeSelect","hairSelect","hairStyleSelect","beardSelect","beardStyleSelect","outfitSelect","shirtSelect","cloakSelect"].forEach((id)=>{
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
$("closeInventoryBtn").addEventListener("click",()=>toggleInventory(false));
$("inventoryEquipBtn").addEventListener("click",()=>{
  const selected=inventoryItemById(state.inventory.selectedId);
  if(!selected) return;
  if(equippedSlotForItem(selected.id)) unequipInventoryItem(selected.id);
  else equipInventoryItem(selected.id);
});
$("inventoryRotateBtn").addEventListener("click",rotateSelectedInventoryItem);
for(const slot of document.querySelectorAll("[data-equipment-slot]")){
  slot.addEventListener("click",()=>{
    const itemId=state.inventory.equipment[slot.dataset.equipmentSlot];
    if(itemId){state.inventory.selectedId=itemId;renderInventory();}
  });
}
for(const button of document.querySelectorAll("[data-quick-item]")){
  button.addEventListener("click",()=>{
    const item=state.inventory.items.find((entry)=>entry.itemId===button.dataset.quickItem);
    if(item) equipInventoryItem(item.id);
  });
}

function bindMobileHoldButton(button){
  const key=button.dataset.mobileKey;
  const release=(event)=>releaseMobilePointer(event.pointerId);
  button.addEventListener("pointerdown",(event)=>{
    if(!state.running||state.paused||state.mapOpen||state.inventoryOpen||state.dead) return;
    event.preventDefault();
    event.stopPropagation();
    try{button.setPointerCapture(event.pointerId);}catch{}
    setMobileHeldKey(event.pointerId,key,button);
    mobileHaptic(5);
  });
  button.addEventListener("pointerup",release);
  button.addEventListener("pointercancel",release);
  button.addEventListener("lostpointercapture",release);
  button.addEventListener("contextmenu",(event)=>event.preventDefault());
}

function bindMobileTapButton(button,handler,haptic=8){
  const clear=(event)=>{
    button.classList.remove("is-pressed");
    if(event?.pointerId!==undefined){
      try{button.releasePointerCapture(event.pointerId);}catch{}
    }
  };
  button.addEventListener("pointerdown",(event)=>{
    event.preventDefault();
    event.stopPropagation();
    try{button.setPointerCapture(event.pointerId);}catch{}
    button.classList.add("is-pressed");
    mobileHaptic(haptic);
    handler();
  });
  button.addEventListener("pointerup",clear);
  button.addEventListener("pointercancel",clear);
  button.addEventListener("lostpointercapture",clear);
  button.addEventListener("click",(event)=>{
    event.preventDefault();
    event.stopPropagation();
    // Keyboard activation creates a click without pointer coordinates.
    if(event.detail===0) handler();
  });
  button.addEventListener("contextmenu",(event)=>event.preventDefault());
}

for(const button of document.querySelectorAll("[data-mobile-key]")) bindMobileHoldButton(button);
for(const button of document.querySelectorAll("[data-mobile-action]")){
  const action=button.dataset.mobileAction;
  const handler=action==="attack"?()=>useEquippedItem()
    :action==="interact"?()=>interactWithWorld()
    :action==="inventory"?()=>{
      if(state.paused) togglePause(false);
      toggleInventory();
    }
    :action==="map"?()=>{
      if(state.paused) togglePause(false);
      toggleMap();
    }
    :()=>{
      if(state.inventoryOpen) toggleInventory(false);
      else if(state.mapOpen) toggleMap(false);
      else togglePause();
    };
  bindMobileTapButton(button,handler,action==="attack"?[8,18,8]:7);
}

worldMap.addEventListener("click",(event)=>{
  if(!state.debug.enabled) return;
  const rect=worldMap.getBoundingClientRect();
  const x=(event.clientX-rect.left)/rect.width*WORLD_SIZE;
  const y=(event.clientY-rect.top)/rect.height*WORLD_SIZE;
  teleportPlayer(x,y);
});

canvas.addEventListener("click",(event)=>{
  if(event.button!==0||state.mapOpen||state.paused||state.inventoryOpen) return;
  if(state.debug.enabled){
    const rect=canvas.getBoundingClientRect();
    const px=(event.clientX-rect.left)/rect.width*canvas.width;
    const py=(event.clientY-rect.top)/rect.height*canvas.height;
    teleportPlayer(state.camera.x+(px-canvas.width/2)/VIEW_SCALE,state.camera.y+(py-canvas.height/2)/VIEW_SCALE);
  }else if(!touchControlsActive()){
    useEquippedItem();
  }
});

window.addEventListener("resize",resizeGameCanvas);

renderTitleMap();
resizeGameCanvas();
updatePreviewDirection();
updatePortrait();
renderInventory();
updateQuickbar();
updateMobileControlState();
requestAnimationFrame(paintPreview);

window.__ARCHIPELAGO_DEBUG__ = {
  WORLD_SIZE,
  TILE_METERS,
  palette,
  terrainAt,
  tileDecoration,
  islandField,
  ensureRivers,
  riverAt,
  roadSegmentAt,
  roadAt,
  bridgeAt,
  treeForPlot,
  treeFootprint,
  treeAtGrid,
  roadDecorationForPlot,
  roadDecorationAtGrid,
  visibleRoadDecorations,
  roadAssetCatalog,
  drawRoadDecoration,
  softBiomeColor,
  structureAtGrid,
  visibleStructureBlocks,
  collisionAt,
  canOccupy,
  movePlayer,
  updateWorldReactions,
  nearbyInteraction,
  interactWithWorld,
  itemCatalog,
  animalCatalog,
  equipmentSlotCatalog,
  inventoryItemSize,
  canPlaceInventoryItem,
  addInventoryItem,
  equipInventoryItem,
  unequipInventoryItem,
  rotateSelectedInventoryItem,
  useEquippedItem,
  updateItemAction,
  getTreePhysics,
  treePhysicsStates,
  findTreeToolTarget,
  performAxeImpact,
  updateTreePhysics,
  treePhysicalProfile,
  fallenTreeSegment,
  fallenTreeHitShapes,
  animalsForCell,
  animalsInRect,
  activeAnimalsNear,
  animalStates,
  findAnimalTarget,
  damageAnimal,
  updateAnimals,
  isSwimmingBiome,
  isSafeGroundBiome,
  killPlayer,
  respawnPlayer,
  teleportPlayer,
  setDebugMode,
  drawCharacter,
  sanitizePlayer,
  drawWorld,
  drawWorldMap,
  mapColorAt,
  renderTerrainFrame,
  syncTerrainLayer,
  renderStats,
  terrainFrameCache,
  landmarks,
  rivers,
  routes,
  state
};
})();
