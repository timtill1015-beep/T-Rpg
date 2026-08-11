(() => {
"use strict";

const WORLD_SIZE = 10000;        // metres
const TILE_METERS = 20;          // procedural visual tile
const VIEW_SCALE = 2.2;          // px per metre in world camera
const PLAYER_SPEED = 95;         // metres / second
const SPRINT_MULTIPLIER = 1.65;
const NET_SEND_HZ = 12;
const MAP_SAMPLE = 10;

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

const state = {
  running: false,
  paused: false,
  mapOpen: false,
  lastTime: 0,
  lastNetSend: 0,
  seed: 184731,
  player: {
    id: "local",
    name: "Abenteurer",
    x: 5000,
    y: 5000,
    dir: "down",
    moving: false,
    skin: "#f1c27d",
    hair: "#3a2418",
    shirt: "#315d9b"
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
  deepWater: "#173d5d",
  water: "#245b78",
  shallow: "#3f8190",
  beach: "#d0b76b",
  plains: "#73944f",
  forest: "#3e6f48",
  jungle: "#315f3e",
  swamp: "#536b4a",
  rock: "#6d706a",
  mountain: "#565b5d",
  snow: "#d8ded7"
};

const biomeNames = {
  deepWater: "Tiefsee",
  water: "Meer",
  shallow: "Flachwasser",
  beach: "Strand",
  plains: "Grasland",
  forest: "Wald",
  jungle: "Dschungel",
  swamp: "Sumpf",
  rock: "Felsland",
  mountain: "Gebirge",
  snow: "Schneegipfel"
};

function hash2(x, y, seed = state.seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = (h ^ (h >>> 13));
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function smooth(t){ return t*t*(3-2*t); }
function lerp(a,b,t){ return a+(b-a)*t; }

function valueNoise(x,y,scale,seedOff=0){
  const fx=x/scale, fy=y/scale;
  const x0=Math.floor(fx), y0=Math.floor(fy);
  const tx=smooth(fx-x0), ty=smooth(fy-y0);
  const a=hash2(x0,y0,state.seed+seedOff);
  const b=hash2(x0+1,y0,state.seed+seedOff);
  const c=hash2(x0,y0+1,state.seed+seedOff);
  const d=hash2(x0+1,y0+1,state.seed+seedOff);
  return lerp(lerp(a,b,tx),lerp(c,d,tx),ty);
}

function fbm(x,y,seedOff=0){
  let v=0, amp=0.58, total=0, scale=1100;
  for(let i=0;i<5;i++){
    v += valueNoise(x,y,scale,seedOff+i*97)*amp;
    total += amp;
    amp *= 0.5;
    scale *= 0.5;
  }
  return v/total;
}

// Metaball-style archipelago: fixed large + small landmasses.
// Kept deterministic so all peers see the exact same world without syncing terrain.
const islands = [
  [0.49,0.52,0.23,0.18, 1.00],
  [0.25,0.28,0.14,0.10, 0.78],
  [0.76,0.27,0.13,0.16, 0.82],
  [0.77,0.72,0.14,0.11, 0.74],
  [0.23,0.76,0.10,0.13, 0.67],
  [0.54,0.18,0.07,0.055,0.48],
  [0.46,0.83,0.075,0.05,0.45],
  [0.90,0.50,0.05,0.07,0.42]
];

function islandField(x,y){
  const nx=x/WORLD_SIZE, ny=y/WORLD_SIZE;
  let best=0;
  for(const [cx,cy,rx,ry,p] of islands){
    const dx=(nx-cx)/rx, dy=(ny-cy)/ry;
    const d=Math.sqrt(dx*dx+dy*dy);
    const f=Math.max(0,1-d) * p;
    best=Math.max(best,f);
  }
  const detail=(fbm(x,y,310)-0.5)*0.24 + (valueNoise(x,y,210,811)-0.5)*0.08;
  const edge=Math.min(nx,ny,1-nx,1-ny);
  const borderClamp=Math.min(1,Math.max(0,edge/0.075));
  return (best+detail)*borderClamp;
}

function terrainAt(x,y){
  x=Math.max(0,Math.min(WORLD_SIZE,x));
  y=Math.max(0,Math.min(WORLD_SIZE,y));
  const h=islandField(x,y);
  const moisture=fbm(x+1337,y-904,400);
  const temp=1-Math.abs(y/WORLD_SIZE-0.5)*1.25 + (valueNoise(x,y,900,225)-0.5)*0.18;

  let biome;
  if(h<0.10) biome="deepWater";
  else if(h<0.145) biome="water";
  else if(h<0.19) biome="shallow";
  else if(h<0.235) biome="beach";
  else if(h>0.66 && temp<0.52) biome="snow";
  else if(h>0.57) biome="mountain";
  else if(h>0.48) biome="rock";
  else if(moisture>0.69 && temp>0.66) biome="jungle";
  else if(moisture>0.72) biome="swamp";
  else if(moisture>0.53) biome="forest";
  else biome="plains";

  return {height:h,moisture,temp,biome};
}

function isWalkable(x,y){
  const b=terrainAt(x,y).biome;
  return !["deepWater","water","shallow"].includes(b);
}

function findSpawn(){
  const candidates = [
    [5000,5000],[4700,5200],[5200,4800],[2500,2800],[7600,2800]
  ];
  for(const p of candidates) if(isWalkable(p[0],p[1])) return p;
  for(let r=0;r<250;r++){
    const x=5000+(hash2(r,1)-0.5)*3000;
    const y=5000+(hash2(r,2)-0.5)*3000;
    if(isWalkable(x,y)) return [x,y];
  }
  return [5000,5000];
}

function tileDecoration(x,y,biome){
  const gx=Math.floor(x/TILE_METERS), gy=Math.floor(y/TILE_METERS);
  const r=hash2(gx,gy,913);
  if(biome==="forest" && r>0.72) return "tree";
  if(biome==="jungle" && r>0.62) return "palm";
  if(biome==="plains" && r>0.93) return "flower";
  if((biome==="rock"||biome==="mountain") && r>0.78) return "rock";
  if(biome==="beach" && r>0.93) return "shell";
  return null;
}

function drawTile(wx,wy,sx,sy,size,terrain){
  ctx.fillStyle=palette[terrain.biome];
  ctx.fillRect(Math.floor(sx),Math.floor(sy),Math.ceil(size)+1,Math.ceil(size)+1);

  const gx=Math.floor(wx/TILE_METERS), gy=Math.floor(wy/TILE_METERS);
  const n=hash2(gx,gy,77);

  if(terrain.biome==="water"||terrain.biome==="deepWater"||terrain.biome==="shallow"){
    if(n>0.63){
      ctx.fillStyle="rgba(210,240,245,.18)";
      ctx.fillRect(Math.floor(sx+size*0.15),Math.floor(sy+size*0.46),Math.max(1,size*0.48),Math.max(1,size*0.08));
    }
  } else if(terrain.biome==="beach"){
    if(n>0.72){
      ctx.fillStyle="rgba(89,70,40,.20)";
      ctx.fillRect(Math.floor(sx+size*0.65),Math.floor(sy+size*0.3),Math.max(1,size*.08),Math.max(1,size*.08));
    }
  } else {
    if(n>0.75){
      ctx.fillStyle="rgba(0,0,0,.08)";
      ctx.fillRect(Math.floor(sx+size*.15),Math.floor(sy+size*.18),Math.max(1,size*.12),Math.max(1,size*.12));
    }
  }

  const deco=tileDecoration(wx,wy,terrain.biome);
  const px=Math.floor(sx+size*.5), py=Math.floor(sy+size*.5);
  if(deco==="tree"){
    ctx.fillStyle="#25492f"; ctx.fillRect(px-size*.18,py-size*.3,size*.36,size*.34);
    ctx.fillStyle="#493525"; ctx.fillRect(px-size*.05,py+size*.02,size*.1,size*.25);
  } else if(deco==="palm"){
    ctx.fillStyle="#5a3e25"; ctx.fillRect(px-size*.04,py-size*.05,size*.08,size*.35);
    ctx.fillStyle="#234b2c"; ctx.fillRect(px-size*.25,py-size*.16,size*.5,size*.12);
    ctx.fillRect(px-size*.08,py-size*.29,size*.16,size*.38);
  } else if(deco==="rock"){
    ctx.fillStyle="#44494a"; ctx.fillRect(px-size*.17,py-size*.08,size*.34,size*.22);
    ctx.fillStyle="#808582"; ctx.fillRect(px-size*.11,py-size*.12,size*.16,size*.08);
  } else if(deco==="flower"){
    ctx.fillStyle="#ece074"; ctx.fillRect(px,py,Math.max(1,size*.07),Math.max(1,size*.07));
  } else if(deco==="shell"){
    ctx.fillStyle="#f3ddd0"; ctx.fillRect(px,py,Math.max(1,size*.09),Math.max(1,size*.06));
  }
}

function drawWorld(){
  const w=canvas.width, h=canvas.height;
  ctx.clearRect(0,0,w,h);
  const camX=state.player.x, camY=state.player.y;
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

  // Other players first.
  for(const p of state.peers.values()){
    const sx=(p.x-camX)*VIEW_SCALE+w/2;
    const sy=(p.y-camY)*VIEW_SCALE+h/2;
    if(sx>-50&&sx<w+50&&sy>-50&&sy<h+50) drawCharacter(ctx,sx,sy,p,2.25,false);
  }

  drawCharacter(ctx,w/2,h/2,state.player,2.5,true);
}

function drawCharacter(c,x,y,p,scale=2.5,local=false){
  // 12x16 logical pixel sprite
  const u=scale;
  c.save();
  c.translate(Math.round(x-6*u),Math.round(y-13*u));

  // shadow
  c.fillStyle="rgba(0,0,0,.28)";
  c.fillRect(3*u,14*u,6*u,2*u);

  // legs
  c.fillStyle="#2b3340";
  c.fillRect(3*u,10*u,2*u,4*u);
  c.fillRect(7*u,10*u,2*u,4*u);

  // torso
  c.fillStyle=p.shirt||"#315d9b";
  c.fillRect(2*u,6*u,8*u,5*u);
  c.fillStyle="rgba(255,255,255,.14)";
  c.fillRect(2*u,6*u,8*u,1*u);

  // arms
  c.fillStyle=p.skin||"#f1c27d";
  c.fillRect(1*u,7*u,1*u,3*u);
  c.fillRect(10*u,7*u,1*u,3*u);

  // head
  c.fillRect(3*u,2*u,6*u,5*u);

  // hair
  c.fillStyle=p.hair||"#3a2418";
  c.fillRect(3*u,1*u,6*u,2*u);
  c.fillRect(3*u,2*u,1*u,2*u);
  c.fillRect(8*u,2*u,1*u,2*u);

  // face depending direction
  c.fillStyle="#1b1a19";
  if(p.dir==="up"){
    // no eyes
  } else if(p.dir==="left"){
    c.fillRect(3*u,4*u,1*u,1*u);
  } else if(p.dir==="right"){
    c.fillRect(8*u,4*u,1*u,1*u);
  } else {
    c.fillRect(4*u,4*u,1*u,1*u);
    c.fillRect(7*u,4*u,1*u,1*u);
  }

  if(local){
    c.strokeStyle="#f2cf62";
    c.lineWidth=1;
    c.strokeRect(1*u,0,10*u,15*u);
  }
  c.restore();

  if(p.name){
    c.font="bold 11px monospace";
    c.textAlign="center";
    c.fillStyle="#0a0d11";
    c.fillText(p.name,x+1,y-39*scale/2+1);
    c.fillStyle="#f5f1e3";
    c.fillText(p.name,x,y-39*scale/2);
  }
}

function movePlayer(dt){
  if(state.paused||state.mapOpen) return;
  let dx=0,dy=0;
  if(state.keys.has("w")||state.keys.has("arrowup")) dy-=1;
  if(state.keys.has("s")||state.keys.has("arrowdown")) dy+=1;
  if(state.keys.has("a")||state.keys.has("arrowleft")) dx-=1;
  if(state.keys.has("d")||state.keys.has("arrowright")) dx+=1;
  state.player.moving=!!(dx||dy);

  if(!dx&&!dy) return;
  const len=Math.hypot(dx,dy);dx/=len;dy/=len;
  let speed=PLAYER_SPEED*(state.keys.has("shift")?SPRINT_MULTIPLIER:1);

  if(Math.abs(dx)>Math.abs(dy)) state.player.dir=dx>0?"right":"left";
  else state.player.dir=dy>0?"down":"up";

  const nx=Math.max(0,Math.min(WORLD_SIZE,state.player.x+dx*speed*dt));
  const ny=Math.max(0,Math.min(WORLD_SIZE,state.player.y+dy*speed*dt));

  // Axis separated collision keeps coast sliding smooth.
  if(isWalkable(nx,state.player.y)) state.player.x=nx;
  if(isWalkable(state.player.x,ny)) state.player.y=ny;
}

function updateHud(){
  const t=terrainAt(state.player.x,state.player.y);
  $("biomeText").textContent=biomeNames[t.biome];
  $("coordText").textContent=`${(state.player.x/1000).toFixed(2)} / ${(state.player.y/1000).toFixed(2)} km`;
  $("playerCount").textContent=String(1+state.peers.size);
}

function renderMinimapBase(){
  const c=document.createElement("canvas");
  c.width=minimap.width;c.height=minimap.height;
  const mc=c.getContext("2d");mc.imageSmoothingEnabled=false;
  const step=WORLD_SIZE/minimap.width;
  for(let y=0;y<minimap.height;y++){
    for(let x=0;x<minimap.width;x++){
      mc.fillStyle=palette[terrainAt((x+.5)*step,(y+.5)*step).biome];
      mc.fillRect(x,y,1,1);
    }
  }
  state.minimapBase=c;
}
function drawMinimap(){
  if(!state.minimapBase) renderMinimapBase();
  miniCtx.drawImage(state.minimapBase,0,0);
  const px=state.player.x/WORLD_SIZE*minimap.width;
  const py=state.player.y/WORLD_SIZE*minimap.height;
  miniCtx.fillStyle="#ffd65a";
  miniCtx.fillRect(Math.round(px)-2,Math.round(py)-2,5,5);
  for(const p of state.peers.values()){
    miniCtx.fillStyle="#ffffff";
    miniCtx.fillRect(Math.round(p.x/WORLD_SIZE*minimap.width)-1,Math.round(p.y/WORLD_SIZE*minimap.height)-1,3,3);
  }
  miniCtx.strokeStyle="#d3d9dc";
  miniCtx.strokeRect(.5,.5,minimap.width-1,minimap.height-1);
}

function renderWorldMapBase(){
  showToast("Weltkarte wird generiert …",1100);
  const c=document.createElement("canvas");
  c.width=worldMap.width;c.height=worldMap.height;
  const mc=c.getContext("2d");mc.imageSmoothingEnabled=false;
  const sample=MAP_SAMPLE;
  const step=WORLD_SIZE/(c.width/sample);
  for(let y=0;y<c.height;y+=sample){
    for(let x=0;x<c.width;x+=sample){
      mc.fillStyle=palette[terrainAt((x/sample+.5)*step,(y/sample+.5)*step).biome];
      mc.fillRect(x,y,sample,sample);
    }
  }
  state.mapBase=c;
}
function drawWorldMap(){
  if(!state.mapBase) renderWorldMapBase();
  mapCtx.drawImage(state.mapBase,0,0);
  const px=state.player.x/WORLD_SIZE*worldMap.width;
  const py=state.player.y/WORLD_SIZE*worldMap.height;
  mapCtx.fillStyle="#ffd65a";
  mapCtx.fillRect(px-5,py-5,10,10);
  mapCtx.strokeStyle="#151515";mapCtx.strokeRect(px-6,py-6,12,12);
  for(const p of state.peers.values()){
    mapCtx.fillStyle="#fff";
    mapCtx.fillRect(p.x/WORLD_SIZE*worldMap.width-3,p.y/WORLD_SIZE*worldMap.height-3,6,6);
  }
}

function loop(ts){
  if(!state.running) return;
  const dt=Math.min(.04,(ts-state.lastTime)/1000||0);
  state.lastTime=ts;
  movePlayer(dt);
  drawWorld();
  drawMinimap();
  updateHud();
  maybeSendNetwork(ts);
  if(state.mapOpen) drawWorldMap();
  requestAnimationFrame(loop);
}

function characterFromUI(){
  return {
    name:$("playerName").value.trim()||"Abenteurer",
    skin:$("skinSelect").value,
    hair:$("hairSelect").value,
    shirt:$("shirtSelect").value
  };
}
function updatePreview(){
  previewCtx.clearRect(0,0,preview.width,preview.height);
  previewCtx.fillStyle="#87b4c9";previewCtx.fillRect(0,0,preview.width,preview.height);
  previewCtx.fillStyle="#6a9255";previewCtx.fillRect(0,84,preview.width,44);
  const p={...characterFromUI(),dir:"down"};
  drawCharacter(previewCtx,48,88,p,5,false);
}
["playerName","skinSelect","hairSelect","shirtSelect"].forEach(id=>$(id).addEventListener("input",updatePreview));

function startGame(){
  const ch=characterFromUI();
  Object.assign(state.player,ch);
  const [sx,sy]=findSpawn();
  state.player.x=sx+(Math.random()-.5)*35;
  state.player.y=sy+(Math.random()-.5)*35;
  $("setupPanel").classList.add("hidden");
  $("gamePanel").classList.remove("hidden");
  state.running=true;state.paused=false;state.mapOpen=false;state.lastTime=performance.now();
  requestAnimationFrame(loop);
  broadcast({type:"hello",player:publicPlayer()});
}

function publicPlayer(){
  const p=state.player;
  return {id:p.id,name:p.name,x:p.x,y:p.y,dir:p.dir,skin:p.skin,hair:p.hair,shirt:p.shirt};
}
function sanitizePlayer(p){
  if(!p||typeof p!=="object") return null;
  return {
    id:String(p.id||"peer").slice(0,64),
    name:String(p.name||"Spieler").slice(0,18),
    x:Math.max(0,Math.min(WORLD_SIZE,Number(p.x)||5000)),
    y:Math.max(0,Math.min(WORLD_SIZE,Number(p.y)||5000)),
    dir:["up","down","left","right"].includes(p.dir)?p.dir:"down",
    skin:String(p.skin||"#f1c27d").slice(0,16),
    hair:String(p.hair||"#3a2418").slice(0,16),
    shirt:String(p.shirt||"#315d9b").slice(0,16)
  };
}

function setNetStatus(text,online=true){
  $("netStatus").textContent=text;
  $("netDot").classList.toggle("online",online);
  $("netDot").classList.toggle("offline",!online);
}
function showToast(msg,ms=1800){
  const el=$("toast");el.textContent=msg;el.classList.remove("hidden");
  clearTimeout(showToast._t);showToast._t=setTimeout(()=>el.classList.add("hidden"),ms);
}
function makeCode(){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s="";
  crypto.getRandomValues(new Uint32Array(6)).forEach(n=>s+=chars[n%chars.length]);
  return s;
}
function cleanupNetwork(){
  const n=state.network;
  try{ if(n.hostConn) n.hostConn.close(); }catch{}
  for(const c of n.conns.values()) try{c.close();}catch{}
  try{ if(n.peer) n.peer.destroy(); }catch{}
  n.peer=null;n.hostConn=null;n.conns.clear();n.mode="solo";n.lobbyCode=null;
  state.peers.clear();
  setNetStatus("Offline / Solo",false);
  $("hostBox").classList.add("hidden");
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

  peer.on("open",()=>{
    state.player.id=id;
    $("lobbyCode").textContent=code;
    $("hostBox").classList.remove("hidden");
    setNetStatus(`Host · ${code}`,true);
    showToast("Lobby erstellt");
  });
  peer.on("connection",(conn)=>{
    state.network.conns.set(conn.peer,conn);
    bindHostConnection(conn);
  });
  peer.on("error",(err)=>{
    console.error(err);
    alert("Lobby konnte nicht erstellt werden: "+err.type);
    cleanupNetwork();
  });
}

function bindHostConnection(conn){
  conn.on("open",()=>{
    conn.send({type:"welcome",host:publicPlayer(),players:[...state.peers.values()]});
    showToast("Spieler beigetreten");
  });
  conn.on("data",(msg)=>{
    if(!msg||typeof msg!=="object") return;
    if(msg.type==="hello"||msg.type==="state"){
      const p=sanitizePlayer(msg.player);
      if(!p) return;
      p.id=conn.peer;
      state.peers.set(conn.peer,p);
      // relay the client's state to all other clients
      for(const [id,c] of state.network.conns){
        if(id!==conn.peer && c.open) c.send({type:"peerState",player:p});
      }
    }
  });
  conn.on("close",()=>{
    state.network.conns.delete(conn.peer);
    state.peers.delete(conn.peer);
    for(const c of state.network.conns.values()) if(c.open)c.send({type:"peerLeft",id:conn.peer});
  });
  conn.on("error",console.error);
}

function joinLobby(){
  if(!initPeerOrWarn()) return;
  cleanupNetwork();
  const code=$("joinCode").value.trim().toUpperCase().replace(/[^A-Z2-9]/g,"").slice(0,6);
  if(code.length!==6){alert("Bitte einen 6-stelligen Lobby-Code eingeben.");return;}
  const peer=new Peer();
  state.network.peer=peer;
  state.network.mode="client";
  state.network.lobbyCode=code;

  peer.on("open",(id)=>{
    state.player.id=id;
    const conn=peer.connect("archipel-rpg-"+code,{reliable:true});
    state.network.hostConn=conn;
    bindClientConnection(conn,code);
  });
  peer.on("error",(err)=>{
    console.error(err);
    alert("Multiplayer-Fehler: "+err.type);
    cleanupNetwork();
  });
}
function bindClientConnection(conn,code){
  conn.on("open",()=>{
    setNetStatus(`Lobby · ${code}`,true);
    conn.send({type:"hello",player:publicPlayer()});
    showToast("Mit Lobby verbunden");
    if(!state.running) startGame();
  });
  conn.on("data",(msg)=>{
    if(!msg||typeof msg!=="object") return;
    if(msg.type==="welcome"){
      const host=sanitizePlayer(msg.host);
      if(host){host.id=conn.peer;state.peers.set(conn.peer,host);}
      for(const raw of msg.players||[]){
        const p=sanitizePlayer(raw);if(p&&p.id!==state.player.id)state.peers.set(p.id,p);
      }
    }else if(msg.type==="peerState"){
      const p=sanitizePlayer(msg.player);
      if(p&&p.id!==state.player.id) state.peers.set(p.id,p);
    }else if(msg.type==="peerLeft"){
      state.peers.delete(String(msg.id));
    }
  });
  conn.on("close",()=>{
    setNetStatus("Verbindung zum Host getrennt",false);
    showToast("Host-Verbindung getrennt",2800);
  });
  conn.on("error",(err)=>console.error(err));
}
function broadcast(msg){
  const n=state.network;
  if(n.mode==="host"){
    for(const c of n.conns.values()) if(c.open)c.send(msg);
  }else if(n.mode==="client"&&n.hostConn&&n.hostConn.open){
    n.hostConn.send(msg);
  }
}
function maybeSendNetwork(ts){
  if(ts-state.lastNetSend < 1000/NET_SEND_HZ) return;
  state.lastNetSend=ts;
  const msg={type:"state",player:publicPlayer()};
  if(state.network.mode==="host"){
    for(const c of state.network.conns.values()) if(c.open)c.send({type:"peerState",player:msg.player});
  }else if(state.network.mode==="client"&&state.network.hostConn?.open){
    state.network.hostConn.send(msg);
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

window.addEventListener("keydown",(e)=>{
  const k=e.key.toLowerCase();
  if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright","shift"].includes(k)){
    state.keys.add(k);e.preventDefault();
  }
  if(k==="escape"&&state.running){togglePause();e.preventDefault();}
  if(k==="m"&&state.running&&!e.repeat){toggleMap();e.preventDefault();}
});
window.addEventListener("keyup",(e)=>state.keys.delete(e.key.toLowerCase()));

$("soloBtn").addEventListener("click",()=>{
  cleanupNetwork();
  state.player.id="local-"+Math.random().toString(36).slice(2,8);
  startGame();
});
$("hostBtn").addEventListener("click",()=>{
  hostLobby();
  // Host may enter the world immediately; others can join using the code.
  if(!state.running) startGame();
});
$("joinBtn").addEventListener("click",joinLobby);
$("joinCode").addEventListener("keydown",(e)=>{if(e.key==="Enter")joinLobby();});
$("copyCodeBtn").addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText(state.network.lobbyCode||"");showToast("Code kopiert");}
  catch{showToast("Kopieren nicht möglich");}
});
$("resumeBtn").addEventListener("click",()=>togglePause(false));
$("leaveBtn").addEventListener("click",()=>{
  state.running=false;cleanupNetwork();togglePause(false);toggleMap(false);
  $("gamePanel").classList.add("hidden");$("setupPanel").classList.remove("hidden");
});
$("closeMapBtn").addEventListener("click",()=>toggleMap(false));

updatePreview();
})();