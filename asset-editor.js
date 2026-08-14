"use strict";

const ARTIST_ASSET_SCHEMA_VERSION=1;
const ARTIST_ASSET_PROJECT_URL="artist-assets.json";
const ARTIST_ASSET_STORAGE_KEY="archipelago.artist-assets.v1";
const ARTIST_ASSET_GATE_KEY="archipelago.artist-studio.local-gate.v1";
const ARTIST_ASSET_MAX_LAYERS=12;
const ARTIST_ASSET_MAX_FRAMES=24;
const ARTIST_ASSET_HISTORY_LIMIT=40;
const ARTIST_SPRITE_CACHE_LIMIT=192;
const $=(id)=>document.getElementById(id);
const state=window.__ARCHIPELAGO_DEBUG__?.state||{running:false,elapsed:0};

const artistAssetDefinitions={
  player:{label:"Spieler",width:16,height:24,scale:3,animations:["idle","walk","attack","ride"]},
  chicken:{label:"Huhn",width:16,height:16,scale:2,animations:["idle","walk","panic","dead"]},
  boar:{label:"Wildschwein",width:22,height:18,scale:3,animations:["idle","walk","windup","charge","dead"]},
  horse:{label:"Pferd",width:30,height:28,scale:2,animations:["idle","walk","gallop","dead"]},
  crow:{label:"Rabe",width:18,height:16,scale:2,animations:["perched","fly"]}
};

function paintArtistRect(frame,x,y,width,height,color){
  for(let py=y;py<y+height;py++) for(let px=x;px<x+width;px++) frame[px+","+py]=color;
}

function createArtistGuideLayers(id){
  const shadow={};const body={};const details={};
  if(id==="player"){
    paintArtistRect(shadow,3,22,10,1,"#08101499");
    paintArtistRect(body,2,8,12,10,"#684431");paintArtistRect(body,4,9,8,8,"#315d9b");paintArtistRect(body,4,16,3,6,"#222b31");paintArtistRect(body,9,16,3,6,"#222b31");paintArtistRect(body,4,3,8,7,"#f1c27d");paintArtistRect(body,2,10,2,5,"#f1c27d");paintArtistRect(body,12,10,2,5,"#f1c27d");
    paintArtistRect(details,3,1,10,3,"#3a2418");paintArtistRect(details,3,3,2,5,"#3a2418");paintArtistRect(details,11,3,2,5,"#3a2418");paintArtistRect(details,6,6,1,1,"#243b53");paintArtistRect(details,10,6,1,1,"#243b53");paintArtistRect(details,4,15,8,1,"#8e6d37");paintArtistRect(details,4,20,3,2,"#151b20");paintArtistRect(details,9,20,3,2,"#151b20");
  }else if(id==="chicken"){
    paintArtistRect(shadow,2,13,11,1,"#08101488");
    paintArtistRect(body,3,7,8,5,"#e8e1c4");paintArtistRect(body,8,3,5,5,"#e8e1c4");paintArtistRect(body,5,8,4,3,"#b8aa88");paintArtistRect(body,5,12,1,3,"#b78939");paintArtistRect(body,9,12,1,3,"#b78939");
    paintArtistRect(details,13,5,2,1,"#d7a73a");paintArtistRect(details,9,1,1,2,"#a7352e");paintArtistRect(details,10,1,1,1,"#a7352e");paintArtistRect(details,11,5,1,1,"#1b211d");
  }else if(id==="boar"){
    paintArtistRect(shadow,2,15,18,1,"#08101488");
    paintArtistRect(body,2,6,13,7,"#5e4637");paintArtistRect(body,13,8,6,5,"#463329");paintArtistRect(body,18,10,3,3,"#3a2922");paintArtistRect(body,4,12,2,4,"#3d2d25");paintArtistRect(body,12,12,2,4,"#3d2d25");
    paintArtistRect(details,18,13,3,1,"#d5c49a");paintArtistRect(details,19,11,1,2,"#d5c49a");paintArtistRect(details,16,9,1,1,"#151815");paintArtistRect(details,5,4,5,3,"#463329");paintArtistRect(details,10,3,2,2,"#3a2922");paintArtistRect(details,1,8,1,2,"#7a5a42");
  }else if(id==="horse"){
    paintArtistRect(shadow,3,25,24,2,"#08101488");
    paintArtistRect(body,4,8,17,9,"#8d4f2d");paintArtistRect(body,19,5,5,9,"#8d4f2d");paintArtistRect(body,22,3,6,6,"#8d4f2d");paintArtistRect(body,6,16,3,10,"#60311f");paintArtistRect(body,11,16,3,10,"#60311f");paintArtistRect(body,18,16,3,10,"#60311f");paintArtistRect(body,22,16,3,10,"#60311f");
    paintArtistRect(details,4,6,4,4,"#241b19");paintArtistRect(details,2,8,3,8,"#241b19");paintArtistRect(details,24,2,2,3,"#241b19");paintArtistRect(details,26,2,2,3,"#241b19");paintArtistRect(details,26,6,1,1,"#111817");paintArtistRect(details,27,7,2,1,"#d9c8ad");paintArtistRect(details,9,8,9,2,"#b86f3e");
  }else{
    paintArtistRect(shadow,3,13,12,1,"#08101477");
    paintArtistRect(body,4,6,10,6,"#20272a");paintArtistRect(body,10,3,5,5,"#151b1e");paintArtistRect(body,3,7,6,3,"#333a3c");paintArtistRect(body,7,12,1,3,"#352a24");paintArtistRect(body,11,12,1,3,"#352a24");
    paintArtistRect(details,15,5,2,1,"#6d5940");paintArtistRect(details,13,5,1,1,"#d6c688");paintArtistRect(details,5,8,6,1,"#4b5354");
  }
  return [{id:"shadow",name:"Schatten",visible:true,opacity:1,frame:shadow},{id:"body",name:"Körper",visible:true,opacity:1,frame:body},{id:"details",name:"Details",visible:true,opacity:1,frame:details}];
}

function prepareArtistGuideFrame(id,layerId,animation,source){
  const frame=cloneArtistData(source);
  if(layerId!=="details"||animation!=="dead") return frame;
  if(id==="chicken"){delete frame["11,5"];frame["10,6"]="#24201b";frame["11,6"]="#24201b";}
  else if(id==="boar"){delete frame["16,9"];frame["15,10"]="#211b18";frame["16,10"]="#211b18";}
  else if(id==="horse"){delete frame["26,6"];frame["25,7"]="#111817";frame["26,7"]="#111817";}
  return frame;
}

function createArtistAsset(id){
  const definition=artistAssetDefinitions[id];
  const animations={};
  for(const animation of definition.animations) animations[animation]={fps:animation==="idle"||animation==="perched"?2:animation==="attack"||animation==="charge"?8:6,frames:1};
  const layers=createArtistGuideLayers(id).map((guide)=>{
    const frames={};
    for(const animation of definition.animations) frames[animation]=[prepareArtistGuideFrame(id,guide.id,animation,guide.frame)];
    return {id:guide.id,name:guide.name,visible:guide.visible,opacity:guide.opacity,frames};
  });
  return {
    id,enabled:false,width:definition.width,height:definition.height,scale:definition.scale,
    animations,layers
  };
}

function createDefaultArtistPack(){
  const assets={};
  for(const id of Object.keys(artistAssetDefinitions)) assets[id]=createArtistAsset(id);
  return {schemaVersion:ARTIST_ASSET_SCHEMA_VERSION,name:"Archipelago Artist Pack",updatedAt:null,assets};
}

let artistAssetPack=createDefaultArtistPack();
const artistSpriteCanvasCache=new Map();
const assetEditorState={
  unlocked:false,open:false,assetId:"player",animation:"idle",frameIndex:0,layerIndex:0,tool:"pencil",
  onion:false,showGrid:true,drawing:false,lastPixel:null,dirty:false,history:[],redo:[],previewStartedAt:performance.now(),saveTimer:null
};

function cloneArtistData(value){return JSON.parse(JSON.stringify(value));}
function invalidateArtistSpriteCache(){artistSpriteCanvasCache.clear();}
function clampArtistNumber(value,min,max,fallback){value=Number(value);return Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;}
function validArtistColor(value){return typeof value==="string"&&/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value);}
function cleanArtistId(value,fallback){const clean=String(value||"").toLowerCase().replace(/[^a-z0-9_-]/g,"").slice(0,32);return clean||fallback;}

function normalizeArtistFrame(frame,width,height){
  const normalized={};
  if(!frame||typeof frame!=="object"||Array.isArray(frame)) return normalized;
  let count=0;
  for(const [key,color] of Object.entries(frame)){
    if(count>=width*height) break;
    if(!validArtistColor(color)) continue;
    const match=/^(\d+),(\d+)$/.exec(key);
    if(!match) continue;
    const x=Number(match[1]);
    const y=Number(match[2]);
    if(x<0||y<0||x>=width||y>=height) continue;
    normalized[x+","+y]=color.toLowerCase();
    count++;
  }
  return normalized;
}

function normalizeArtistPack(candidate){
  const defaults=createDefaultArtistPack();
  const source=candidate&&typeof candidate==="object"?candidate:{};
  if(source.schemaVersion!=null&&Number(source.schemaVersion)!==ARTIST_ASSET_SCHEMA_VERSION) throw new Error("Nicht unterstützte Asset-Pack-Version");
  const pack={schemaVersion:ARTIST_ASSET_SCHEMA_VERSION,name:String(source.name||defaults.name).slice(0,80),updatedAt:source.updatedAt||null,assets:{}};
  for(const [id,definition] of Object.entries(artistAssetDefinitions)){
    const fallback=defaults.assets[id];
    const input=source.assets?.[id]&&typeof source.assets[id]==="object"?source.assets[id]:fallback;
    const asset={
      id,enabled:input.enabled===true,width:definition.width,height:definition.height,
      scale:clampArtistNumber(input.scale,1,6,definition.scale),animations:{},layers:[]
    };
    for(const animation of definition.animations){
      const track=input.animations?.[animation]||{};
      asset.animations[animation]={
        fps:Math.round(clampArtistNumber(track.fps,1,24,fallback.animations[animation].fps)),
        frames:Math.round(clampArtistNumber(track.frames,1,ARTIST_ASSET_MAX_FRAMES,1))
      };
    }
    const inputLayers=Array.isArray(input.layers)?input.layers.slice(0,ARTIST_ASSET_MAX_LAYERS):[];
    for(let index=0;index<inputLayers.length;index++){
      const inputLayer=inputLayers[index]||{};
      const layer={
        id:cleanArtistId(inputLayer.id,"layer"+(index+1)),name:String(inputLayer.name||"Ebene "+(index+1)).slice(0,24),
        visible:inputLayer.visible!==false,opacity:clampArtistNumber(inputLayer.opacity,0,1,1),frames:{}
      };
      for(const animation of definition.animations){
        const frameCount=asset.animations[animation].frames;
        const sourceFrames=Array.isArray(inputLayer.frames?.[animation])?inputLayer.frames[animation]:[];
        layer.frames[animation]=Array.from({length:frameCount},(_,frameIndex)=>normalizeArtistFrame(sourceFrames[frameIndex],definition.width,definition.height));
      }
      asset.layers.push(layer);
    }
    if(!asset.layers.length) asset.layers=fallback.layers;
    const usedIds=new Set();
    for(const layer of asset.layers){
      let unique=layer.id;
      let suffix=2;
      while(usedIds.has(unique)) unique=layer.id+suffix++;
      layer.id=unique;usedIds.add(unique);
    }
    pack.assets[id]=asset;
  }
  return pack;
}

async function loadArtistAssetPack(){
  let projectPack=null;
  try{
    const response=await fetch(ARTIST_ASSET_PROJECT_URL,{cache:"no-store"});
    if(response.ok) projectPack=normalizeArtistPack(await response.json());
  }catch{}
  let localPack=null;
  try{
    const stored=localStorage.getItem(ARTIST_ASSET_STORAGE_KEY);
    if(stored) localPack=normalizeArtistPack(JSON.parse(stored));
  }catch{}
  artistAssetPack=localPack||projectPack||createDefaultArtistPack();
  invalidateArtistSpriteCache();
  if(assetEditorState.open) renderAssetEditor();
  return artistAssetPack;
}

function currentArtistAsset(){return artistAssetPack.assets[assetEditorState.assetId];}
function currentArtistTrack(){return currentArtistAsset().animations[assetEditorState.animation];}
function currentArtistLayer(){return currentArtistAsset().layers[assetEditorState.layerIndex];}
function currentArtistFrame(){return currentArtistLayer().frames[assetEditorState.animation][assetEditorState.frameIndex];}

function ensureArtistSelection(){
  if(!artistAssetDefinitions[assetEditorState.assetId]) assetEditorState.assetId="player";
  const definition=artistAssetDefinitions[assetEditorState.assetId];
  if(!definition.animations.includes(assetEditorState.animation)) assetEditorState.animation=definition.animations[0];
  const asset=currentArtistAsset();
  assetEditorState.layerIndex=Math.max(0,Math.min(asset.layers.length-1,assetEditorState.layerIndex));
  assetEditorState.frameIndex=Math.max(0,Math.min(asset.animations[assetEditorState.animation].frames-1,assetEditorState.frameIndex));
}

function setAssetEditorStatus(message,error=false){
  const element=$("assetEditorStatus");
  if(!element) return;
  element.textContent=message;
  element.style.color=error?"#db7b6d":"";
}

function serializeArtistPack(){
  const pack=cloneArtistData(artistAssetPack);
  pack.updatedAt=new Date().toISOString();
  return JSON.stringify(pack,null,2)+"\n";
}

function saveArtistDraft(showMessage=true){
  try{
    artistAssetPack.updatedAt=new Date().toISOString();
    localStorage.setItem(ARTIST_ASSET_STORAGE_KEY,JSON.stringify(artistAssetPack));
    assetEditorState.dirty=false;
    if(showMessage) setAssetEditorStatus("Entwurf in diesem Browser gespeichert · "+new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}));
    return true;
  }catch(error){
    setAssetEditorStatus("Entwurf konnte nicht gespeichert werden: "+error.message,true);
    return false;
  }
}

function scheduleArtistDraftSave(){
  clearTimeout(assetEditorState.saveTimer);
  invalidateArtistSpriteCache();
  assetEditorState.dirty=true;
  setAssetEditorStatus("Ungespeicherte Änderungen …");
  assetEditorState.saveTimer=setTimeout(()=>saveArtistDraft(false),700);
}

function captureArtistHistory(){
  assetEditorState.history.push(JSON.stringify(artistAssetPack));
  if(assetEditorState.history.length>ARTIST_ASSET_HISTORY_LIMIT) assetEditorState.history.shift();
  assetEditorState.redo.length=0;
}

function restoreArtistSnapshot(serialized){
  artistAssetPack=normalizeArtistPack(JSON.parse(serialized));
  ensureArtistSelection();
  scheduleArtistDraftSave();
  renderAssetEditor();
}

function undoArtistEdit(){
  const snapshot=assetEditorState.history.pop();
  if(!snapshot) return;
  assetEditorState.redo.push(JSON.stringify(artistAssetPack));
  restoreArtistSnapshot(snapshot);
}

function redoArtistEdit(){
  const snapshot=assetEditorState.redo.pop();
  if(!snapshot) return;
  assetEditorState.history.push(JSON.stringify(artistAssetPack));
  restoreArtistSnapshot(snapshot);
}

function artistFrameHasPixels(asset,animation,frameIndex){
  return compiledArtistFrame(asset,animation,frameIndex).painted;
}

function artistAnimationForEntity(assetId,entity){
  if(assetId==="player"){
    if(entity.riding) return "ride";
    if(entity.actionType) return "attack";
    return entity.moving?"walk":"idle";
  }
  if(assetId==="crow") return entity.flightState==="flying"?"fly":"perched";
  if(entity.status&&entity.status!=="alive") return "dead";
  if(assetId==="boar"&&entity.attackPhase==="windup") return "windup";
  if(assetId==="boar"&&entity.attackPhase==="charge") return "charge";
  if(assetId==="chicken"&&entity.fleeUntil>state.elapsed) return "panic";
  if(assetId==="horse"&&entity.gaitMode==="gallop") return "gallop";
  return entity.gaitMode&&entity.gaitMode!=="idle"?"walk":"idle";
}

function artistFrameForEntity(asset,animation,entity){
  const track=asset.animations[animation];
  if(!track||track.frames<=1) return 0;
  if(animation==="attack"&&Number.isFinite(entity.actionProgress)) return Math.min(track.frames-1,Math.floor(entity.actionProgress*track.frames));
  if(Number.isFinite(entity.gait)&&["walk","panic","charge","gallop","fly"].includes(animation)){
    const cycle=((entity.gait%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
    return Math.floor(cycle/(Math.PI*2)*track.frames)%track.frames;
  }
  return Math.floor(state.elapsed*track.fps)%track.frames;
}

function compiledArtistFrame(asset,animation,frameIndex){
  const key=asset.id+":"+animation+":"+frameIndex;
  const cached=artistSpriteCanvasCache.get(key);
  if(cached) return cached;
  const surface=document.createElement("canvas");surface.width=asset.width;surface.height=asset.height;
  const target=surface.getContext("2d");target.imageSmoothingEnabled=false;
  let painted=false;
  for(const layer of asset.layers){
    if(!layer.visible||layer.opacity<=0) continue;
    const frame=layer.frames[animation]?.[frameIndex]||{};
    target.save();target.globalAlpha*=layer.opacity;
    for(const [key,color] of Object.entries(frame)){
      const comma=key.indexOf(",");
      const px=Number(key.slice(0,comma));
      const py=Number(key.slice(comma+1));
      target.fillStyle=color;
      target.fillRect(px,py,1,1);
      painted=true;
    }
    target.restore();
  }
  const compiled={surface,painted};artistSpriteCanvasCache.set(key,compiled);
  if(artistSpriteCanvasCache.size>ARTIST_SPRITE_CACHE_LIMIT) artistSpriteCanvasCache.delete(artistSpriteCanvasCache.keys().next().value);
  return compiled;
}

function drawArtistAssetFrame(target,asset,animation,frameIndex,x,y,pixelSize,flip=false,alpha=1){
  if(!asset||!asset.layers.length) return false;
  const compiled=compiledArtistFrame(asset,animation,frameIndex);
  if(!compiled.painted) return false;
  const width=asset.width;
  const height=asset.height;
  target.save();
  target.imageSmoothingEnabled=false;
  target.globalAlpha*=alpha;
  target.translate(Math.round(x),Math.round(y));
  if(flip) target.scale(-1,1);
  const originX=-Math.floor(width*pixelSize/2);
  const originY=-height*pixelSize;
  target.drawImage(compiled.surface,0,0,width,height,originX,originY,width*pixelSize,height*pixelSize);
  target.restore();
  return true;
}

function drawArtistSpriteOverride(assetId,entity,target,x,y,options={}){
  const asset=artistAssetPack.assets[assetId];
  if(!asset?.enabled) return false;
  let animation=artistAnimationForEntity(assetId,entity);
  let frameIndex=artistFrameForEntity(asset,animation,entity);
  if(!artistFrameHasPixels(asset,animation,frameIndex)){
    const fallback=artistAssetDefinitions[assetId].animations[0];
    if(!artistFrameHasPixels(asset,fallback,0)) return false;
    animation=fallback;frameIndex=0;
  }
  const direction=entity.dir||(typeof animalDirection==="function"&&entity.species?animalDirection(entity):"down");
  const requestedScale=Number(options.scale);
  const pixelSize=assetId==="player"&&options.portraitMode?Math.max(1,Math.round(asset.scale*.72))
    :assetId==="player"&&Number.isFinite(requestedScale)?Math.max(1,Math.round(asset.scale*requestedScale/3))
      :Math.max(1,Math.round(asset.scale));
  return drawArtistAssetFrame(target,asset,animation,frameIndex,x,y,pixelSize,direction==="left");
}

function artistGridMetrics(canvasElement,asset=currentArtistAsset()){
  const padding=24;
  const cell=Math.max(2,Math.floor(Math.min((canvasElement.width-padding*2)/asset.width,(canvasElement.height-padding*2)/asset.height)));
  return {cell,originX:Math.floor((canvasElement.width-asset.width*cell)/2),originY:Math.floor((canvasElement.height-asset.height*cell)/2)};
}

function drawArtistEditorGrid(){
  const canvasElement=$("assetEditorCanvas");
  if(!canvasElement||$("assetEditorOverlay").classList.contains("hidden")) return;
  const target=canvasElement.getContext("2d");
  target.imageSmoothingEnabled=false;
  const asset=currentArtistAsset();
  const metrics=artistGridMetrics(canvasElement,asset);
  target.clearRect(0,0,canvasElement.width,canvasElement.height);
  target.fillStyle="#081418";target.fillRect(0,0,canvasElement.width,canvasElement.height);
  for(let py=0;py<asset.height;py++) for(let px=0;px<asset.width;px++){
    target.fillStyle=(px+py)%2?"#122327":"#172a2e";
    target.fillRect(metrics.originX+px*metrics.cell,metrics.originY+py*metrics.cell,metrics.cell,metrics.cell);
  }
  if(assetEditorState.onion&&assetEditorState.frameIndex>0){
    drawArtistLayersOnGrid(target,asset,assetEditorState.animation,assetEditorState.frameIndex-1,metrics,.17);
  }
  drawArtistLayersOnGrid(target,asset,assetEditorState.animation,assetEditorState.frameIndex,metrics,1);
  if(assetEditorState.showGrid){
    target.strokeStyle="rgba(92,122,125,.34)";target.lineWidth=1;target.beginPath();
    for(let x=0;x<=asset.width;x++){const px=metrics.originX+x*metrics.cell+.5;target.moveTo(px,metrics.originY);target.lineTo(px,metrics.originY+asset.height*metrics.cell);}
    for(let y=0;y<=asset.height;y++){const py=metrics.originY+y*metrics.cell+.5;target.moveTo(metrics.originX,py);target.lineTo(metrics.originX+asset.width*metrics.cell,py);}
    target.stroke();
  }
  target.strokeStyle="#d8ad55";target.lineWidth=2;target.strokeRect(metrics.originX-1,metrics.originY-1,asset.width*metrics.cell+2,asset.height*metrics.cell+2);
}

function drawArtistLayersOnGrid(target,asset,animation,frameIndex,metrics,alpha){
  target.save();target.globalAlpha=alpha;
  for(const layer of asset.layers){
    if(!layer.visible||layer.opacity<=0) continue;
    target.save();target.globalAlpha*=layer.opacity;
    for(const [key,color] of Object.entries(layer.frames[animation]?.[frameIndex]||{})){
      const [x,y]=key.split(",").map(Number);
      target.fillStyle=color;target.fillRect(metrics.originX+x*metrics.cell,metrics.originY+y*metrics.cell,metrics.cell,metrics.cell);
    }
    target.restore();
  }
  target.restore();
}

function drawArtistPreview(timestamp=performance.now()){
  const preview=$("assetEditorPreview");
  if(!preview) return;
  const target=preview.getContext("2d");
  target.imageSmoothingEnabled=false;
  target.clearRect(0,0,preview.width,preview.height);
  const asset=currentArtistAsset();
  const track=currentArtistTrack();
  const frameIndex=Math.floor((timestamp-assetEditorState.previewStartedAt)/1000*track.fps)%track.frames;
  target.fillStyle="#102226";target.fillRect(0,0,preview.width,preview.height);
  target.fillStyle="#172f31";target.fillRect(0,Math.round(preview.height*.76),preview.width,preview.height);
  const maxScale=Math.floor(Math.min(preview.width/(asset.width+4),preview.height/(asset.height+5)));
  drawArtistAssetFrame(target,asset,assetEditorState.animation,frameIndex,preview.width/2,preview.height*.84,Math.max(2,maxScale));
  target.fillStyle="#d8ad55";target.fillRect(Math.round(preview.width/2)-2,Math.round(preview.height*.84)+3,4,2);
}

function renderArtistAssetButtons(){
  const container=$("assetEditorAssetList");
  container.replaceChildren();
  for(const [id,definition] of Object.entries(artistAssetDefinitions)){
    const button=document.createElement("button");button.type="button";button.classList.toggle("active",id===assetEditorState.assetId);
    button.innerHTML="<span>"+definition.label+"</span><small>"+definition.width+"×"+definition.height+"</small>";
    button.addEventListener("click",()=>{
      assetEditorState.assetId=id;assetEditorState.animation=definition.animations[0];assetEditorState.frameIndex=0;assetEditorState.layerIndex=0;assetEditorState.previewStartedAt=performance.now();renderAssetEditor();
    });
    container.appendChild(button);
  }
}

function renderArtistLayerList(){
  const asset=currentArtistAsset();
  const container=$("assetEditorLayerList");
  container.replaceChildren();
  asset.layers.forEach((layer,index)=>{
    const row=document.createElement("div");row.className="asset-editor-layer-row";
    const visibility=document.createElement("button");visibility.type="button";visibility.className="asset-layer-visibility"+(layer.visible?"":" off");visibility.textContent=layer.visible?"◉":"○";visibility.title=layer.visible?"Ebene ausblenden":"Ebene einblenden";
    visibility.addEventListener("click",()=>{captureArtistHistory();layer.visible=!layer.visible;scheduleArtistDraftSave();renderAssetEditor();});
    const select=document.createElement("button");select.type="button";select.classList.toggle("active",index===assetEditorState.layerIndex);select.textContent=layer.name;
    select.addEventListener("click",()=>{assetEditorState.layerIndex=index;renderAssetEditor();});
    row.append(visibility,select);container.appendChild(row);
  });
}

function renderAssetEditor(){
  if(!assetEditorState.open) return;
  ensureArtistSelection();
  const definition=artistAssetDefinitions[assetEditorState.assetId];
  const asset=currentArtistAsset();
  const track=currentArtistTrack();
  const layer=currentArtistLayer();
  renderArtistAssetButtons();
  const animationSelect=$("assetEditorAnimation");
  animationSelect.replaceChildren();
  for(const animation of definition.animations){const option=document.createElement("option");option.value=animation;option.textContent=animation.toUpperCase();animationSelect.appendChild(option);}
  animationSelect.value=assetEditorState.animation;
  $("assetEditorEnabled").checked=asset.enabled;
  $("assetEditorScale").value=String(asset.scale);
  $("assetEditorScaleValue").textContent=Number(asset.scale).toFixed(asset.scale%1?2:0)+"×";
  $("assetEditorFps").value=String(track.fps);
  $("assetEditorFrameLabel").textContent=(assetEditorState.frameIndex+1)+" / "+track.frames;
  $("assetEditorDeleteFrame").disabled=track.frames<=1;
  $("assetEditorUndo").disabled=!assetEditorState.history.length;
  $("assetEditorRedo").disabled=!assetEditorState.redo.length;
  $("assetEditorOnion").checked=assetEditorState.onion;
  $("assetEditorGridToggle").checked=assetEditorState.showGrid;
  renderArtistLayerList();
  $("assetEditorLayerName").value=layer.name;
  $("assetEditorLayerOpacity").value=String(layer.opacity);
  $("assetEditorLayerOpacityValue").textContent=Math.round(layer.opacity*100)+"%";
  $("assetEditorDeleteLayer").disabled=asset.layers.length<=1;
  $("assetEditorLayerUp").disabled=assetEditorState.layerIndex>=asset.layers.length-1;
  $("assetEditorLayerDown").disabled=assetEditorState.layerIndex<=0;
  for(const button of document.querySelectorAll("[data-asset-tool]")) button.classList.toggle("active",button.dataset.assetTool===assetEditorState.tool);
  drawArtistEditorGrid();drawArtistPreview();
}

function canvasEventArtistPixel(event){
  const canvasElement=$("assetEditorCanvas");
  const rect=canvasElement.getBoundingClientRect();
  const x=(event.clientX-rect.left)*canvasElement.width/rect.width;
  const y=(event.clientY-rect.top)*canvasElement.height/rect.height;
  const metrics=artistGridMetrics(canvasElement);
  const px=Math.floor((x-metrics.originX)/metrics.cell);
  const py=Math.floor((y-metrics.originY)/metrics.cell);
  const asset=currentArtistAsset();
  return px>=0&&py>=0&&px<asset.width&&py<asset.height?{x:px,y:py,key:px+","+py}:null;
}

function compositeArtistColorAt(x,y){
  const asset=currentArtistAsset();
  for(let index=asset.layers.length-1;index>=0;index--){
    const layer=asset.layers[index];
    if(!layer.visible) continue;
    const color=layer.frames[assetEditorState.animation]?.[assetEditorState.frameIndex]?.[x+","+y];
    if(color) return color.slice(0,7);
  }
  return null;
}

function setArtistColor(color){
  if(!validArtistColor(color)) return false;
  const normalized=color.slice(0,7).toLowerCase();
  $("assetEditorColor").value=normalized;$("assetEditorColorText").value=normalized;
  return true;
}

function floodFillArtistFrame(start,color){
  const asset=currentArtistAsset();
  const frame=currentArtistFrame();
  const target=frame[start.key];
  if(target===color) return;
  const queue=[start];const seen=new Set();
  while(queue.length){
    const point=queue.pop();
    if(point.x<0||point.y<0||point.x>=asset.width||point.y>=asset.height||seen.has(point.key)||frame[point.key]!==target) continue;
    seen.add(point.key);frame[point.key]=color;
    queue.push({x:point.x-1,y:point.y,key:(point.x-1)+","+point.y},{x:point.x+1,y:point.y,key:(point.x+1)+","+point.y},{x:point.x,y:point.y-1,key:point.x+","+(point.y-1)},{x:point.x,y:point.y+1,key:point.x+","+(point.y+1)});
  }
}

function applyArtistTool(point,button=0){
  if(!point) return;
  const tool=button===2?"eraser":assetEditorState.tool;
  const frame=currentArtistFrame();
  if(tool==="picker"){
    const color=compositeArtistColorAt(point.x,point.y);
    if(color) setArtistColor(color);
    return;
  }
  if(tool==="eraser") delete frame[point.key];
  else if(tool==="fill") floodFillArtistFrame(point,$("assetEditorColor").value);
  else frame[point.key]=$("assetEditorColor").value;
  scheduleArtistDraftSave();drawArtistEditorGrid();drawArtistPreview();
}

function addArtistFrame(duplicate=false){
  const asset=currentArtistAsset();const track=currentArtistTrack();
  if(track.frames>=ARTIST_ASSET_MAX_FRAMES){setAssetEditorStatus("Maximal "+ARTIST_ASSET_MAX_FRAMES+" Frames pro Animation.",true);return;}
  captureArtistHistory();
  const insertAt=assetEditorState.frameIndex+1;
  for(const layer of asset.layers){
    const frames=layer.frames[assetEditorState.animation];
    frames.splice(insertAt,0,duplicate?cloneArtistData(frames[assetEditorState.frameIndex]):{});
  }
  track.frames++;assetEditorState.frameIndex=insertAt;assetEditorState.previewStartedAt=performance.now();scheduleArtistDraftSave();renderAssetEditor();
}

function deleteArtistFrame(){
  const asset=currentArtistAsset();const track=currentArtistTrack();if(track.frames<=1) return;
  captureArtistHistory();
  for(const layer of asset.layers) layer.frames[assetEditorState.animation].splice(assetEditorState.frameIndex,1);
  track.frames--;assetEditorState.frameIndex=Math.min(assetEditorState.frameIndex,track.frames-1);scheduleArtistDraftSave();renderAssetEditor();
}

function addArtistLayer(duplicate=false){
  const asset=currentArtistAsset();if(asset.layers.length>=ARTIST_ASSET_MAX_LAYERS){setAssetEditorStatus("Maximal "+ARTIST_ASSET_MAX_LAYERS+" Ebenen pro Asset.",true);return;}
  captureArtistHistory();
  const source=currentArtistLayer();
  const frames={};
  for(const animation of artistAssetDefinitions[assetEditorState.assetId].animations){
    const count=asset.animations[animation].frames;
    frames[animation]=duplicate?cloneArtistData(source.frames[animation]):Array.from({length:count},()=>({}));
  }
  const serial=asset.layers.length+1;
  asset.layers.splice(assetEditorState.layerIndex+1,0,{id:"layer"+Date.now().toString(36),name:duplicate?source.name+" Kopie":"Ebene "+serial,visible:true,opacity:duplicate?source.opacity:1,frames});
  assetEditorState.layerIndex++;scheduleArtistDraftSave();renderAssetEditor();
}

function deleteArtistLayer(){
  const asset=currentArtistAsset();if(asset.layers.length<=1) return;
  captureArtistHistory();asset.layers.splice(assetEditorState.layerIndex,1);assetEditorState.layerIndex=Math.min(assetEditorState.layerIndex,asset.layers.length-1);scheduleArtistDraftSave();renderAssetEditor();
}

function moveArtistLayer(direction){
  const asset=currentArtistAsset();const from=assetEditorState.layerIndex;const to=from+direction;if(to<0||to>=asset.layers.length) return;
  captureArtistHistory();const [layer]=asset.layers.splice(from,1);asset.layers.splice(to,0,layer);assetEditorState.layerIndex=to;scheduleArtistDraftSave();renderAssetEditor();
}

function mirrorArtistFrame(){
  const asset=currentArtistAsset();const frame=currentArtistFrame();captureArtistHistory();const mirrored={};
  for(const [key,color] of Object.entries(frame)){const [x,y]=key.split(",").map(Number);mirrored[(asset.width-1-x)+","+y]=color;}
  currentArtistLayer().frames[assetEditorState.animation][assetEditorState.frameIndex]=mirrored;scheduleArtistDraftSave();renderAssetEditor();
}

function clearArtistFrame(){
  if(!Object.keys(currentArtistFrame()).length) return;
  captureArtistHistory();currentArtistLayer().frames[assetEditorState.animation][assetEditorState.frameIndex]={};scheduleArtistDraftSave();renderAssetEditor();
}

function downloadArtistPack(filename="artist-assets.json"){
  const blob=new Blob([serializeArtistPack()],{type:"application/json"});
  const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function saveArtistProjectFile(){
  const json=serializeArtistPack();
  if(typeof window.showSaveFilePicker==="function"){
    try{
      const handle=await window.showSaveFilePicker({suggestedName:"artist-assets.json",types:[{description:"Archipelago Asset Pack",accept:{"application/json":[".json"]}}]});
      const writable=await handle.createWritable();await writable.write(json);await writable.close();
      setAssetEditorStatus("Projektdatei gespeichert · nach Commit/Deploy für alle Spieler aktiv");return;
    }catch(error){if(error.name==="AbortError") return;setAssetEditorStatus("Dateizugriff fehlgeschlagen · JSON wird heruntergeladen",true);}
  }
  downloadArtistPack("artist-assets.json");
  setAssetEditorStatus("artist-assets.json heruntergeladen · Datei ins Projekt übernehmen und committen");
}

async function importArtistPackFile(file){
  try{
    if(file.size>2_000_000) throw new Error("Datei ist größer als 2 MB");
    const candidate=JSON.parse(await file.text());
    const normalized=normalizeArtistPack(candidate);
    captureArtistHistory();artistAssetPack=normalized;invalidateArtistSpriteCache();ensureArtistSelection();saveArtistDraft(false);renderAssetEditor();setAssetEditorStatus("Asset-Pack geprüft und importiert");
  }catch(error){setAssetEditorStatus("Import abgelehnt: "+error.message,true);}
}

async function hashArtistGateValue(value){
  if(!crypto?.subtle) throw new Error("Kein WebCrypto verfügbar");
  const data=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest("SHA-256",data);
  return [...new Uint8Array(digest)].map((byte)=>byte.toString(16).padStart(2,"0")).join("");
}

async function verifyArtistPassword(password){
  const value=String(password||"");
  const stored=localStorage.getItem(ARTIST_ASSET_GATE_KEY);
  if(!stored){
    if(value.length<4) return {ok:false,message:"Mindestens 4 Zeichen eingeben, um ein lokales Studio-Passwort zu setzen."};
    try{
      localStorage.setItem(ARTIST_ASSET_GATE_KEY,await hashArtistGateValue(value));
      return {ok:true,message:"Lokales Studio-Passwort gesetzt."};
    }catch{return {ok:false,message:"Passwort konnte in diesem Browser nicht gespeichert werden."};}
  }
  try{
    return {ok:(await hashArtistGateValue(value))===stored,message:"Passwort stimmt nicht."};
  }catch{return {ok:false,message:"Passwortprüfung ist in diesem Browser nicht verfügbar."};}
}

function openAssetEditor(){
  if(state.running) return;
  assetEditorState.open=true;
  $("assetEditorOverlay").classList.remove("hidden");
  document.body.style.overflow="hidden";
  if(assetEditorState.unlocked){$("assetEditorLogin").classList.add("hidden");$("assetEditorWorkspace").classList.remove("hidden");renderAssetEditor();}
  else{$("assetEditorLogin").classList.remove("hidden");$("assetEditorWorkspace").classList.add("hidden");$("assetEditorPassword").value="";$("assetEditorLoginError").classList.add("hidden");setTimeout(()=>$(("assetEditorPassword")).focus(),30);}
}

function closeAssetEditor(){
  if(assetEditorState.dirty) saveArtistDraft(false);
  assetEditorState.open=false;assetEditorState.drawing=false;
  $("assetEditorOverlay").classList.add("hidden");document.body.style.overflow="";
}

async function unlockAssetEditor(){
  const result=await verifyArtistPassword($("assetEditorPassword").value);
  $("assetEditorLoginError").textContent=result.message||"Passwort stimmt nicht.";
  $("assetEditorLoginError").classList.toggle("hidden",result.ok);
  if(!result.ok){$("assetEditorPassword").select();return;}
  assetEditorState.unlocked=true;$("assetEditorLogin").classList.add("hidden");$("assetEditorWorkspace").classList.remove("hidden");renderAssetEditor();
}

function bindAssetEditor(){
  $("assetEditorUnlock").addEventListener("click",unlockAssetEditor);
  $("assetEditorCancelLogin").addEventListener("click",closeAssetEditor);
  $("assetEditorPassword").addEventListener("keydown",(event)=>{if(event.key==="Enter") unlockAssetEditor();});
  $("assetEditorClose").addEventListener("click",closeAssetEditor);
  $("assetEditorUndo").addEventListener("click",undoArtistEdit);$("assetEditorRedo").addEventListener("click",redoArtistEdit);
  $("assetEditorAnimation").addEventListener("change",(event)=>{assetEditorState.animation=event.target.value;assetEditorState.frameIndex=0;assetEditorState.previewStartedAt=performance.now();renderAssetEditor();});
  $("assetEditorFps").addEventListener("change",(event)=>{captureArtistHistory();currentArtistTrack().fps=Math.round(clampArtistNumber(event.target.value,1,24,6));assetEditorState.previewStartedAt=performance.now();scheduleArtistDraftSave();renderAssetEditor();});
  $("assetEditorEnabled").addEventListener("change",(event)=>{captureArtistHistory();currentArtistAsset().enabled=event.target.checked;scheduleArtistDraftSave();renderAssetEditor();});
  $("assetEditorScale").addEventListener("input",(event)=>{$("assetEditorScaleValue").textContent=Number(event.target.value).toFixed(2)+"×";});
  $("assetEditorScale").addEventListener("change",(event)=>{captureArtistHistory();currentArtistAsset().scale=clampArtistNumber(event.target.value,1,6,3);scheduleArtistDraftSave();renderAssetEditor();});
  $("assetEditorPrevFrame").addEventListener("click",()=>{const count=currentArtistTrack().frames;assetEditorState.frameIndex=(assetEditorState.frameIndex+count-1)%count;renderAssetEditor();});
  $("assetEditorNextFrame").addEventListener("click",()=>{assetEditorState.frameIndex=(assetEditorState.frameIndex+1)%currentArtistTrack().frames;renderAssetEditor();});
  $("assetEditorAddFrame").addEventListener("click",()=>addArtistFrame(false));$("assetEditorDuplicateFrame").addEventListener("click",()=>addArtistFrame(true));$("assetEditorDeleteFrame").addEventListener("click",deleteArtistFrame);
  $("assetEditorAddLayer").addEventListener("click",()=>addArtistLayer(false));$("assetEditorDuplicateLayer").addEventListener("click",()=>addArtistLayer(true));$("assetEditorDeleteLayer").addEventListener("click",deleteArtistLayer);
  $("assetEditorLayerUp").addEventListener("click",()=>moveArtistLayer(1));$("assetEditorLayerDown").addEventListener("click",()=>moveArtistLayer(-1));
  $("assetEditorLayerName").addEventListener("change",(event)=>{captureArtistHistory();currentArtistLayer().name=String(event.target.value||"Ebene").slice(0,24);scheduleArtistDraftSave();renderAssetEditor();});
  $("assetEditorLayerOpacity").addEventListener("input",(event)=>{$("assetEditorLayerOpacityValue").textContent=Math.round(Number(event.target.value)*100)+"%";});
  $("assetEditorLayerOpacity").addEventListener("change",(event)=>{captureArtistHistory();currentArtistLayer().opacity=clampArtistNumber(event.target.value,0,1,1);scheduleArtistDraftSave();renderAssetEditor();});
  $("assetEditorOnion").addEventListener("change",(event)=>{assetEditorState.onion=event.target.checked;drawArtistEditorGrid();});
  $("assetEditorGridToggle").addEventListener("change",(event)=>{assetEditorState.showGrid=event.target.checked;drawArtistEditorGrid();});
  for(const button of document.querySelectorAll("[data-asset-tool]")) button.addEventListener("click",()=>{assetEditorState.tool=button.dataset.assetTool;renderAssetEditor();});
  $("assetEditorColor").addEventListener("input",(event)=>setArtistColor(event.target.value));
  $("assetEditorColorText").addEventListener("change",(event)=>{if(!setArtistColor(event.target.value)) event.target.value=$("assetEditorColor").value;});
  $("assetEditorMirror").addEventListener("click",mirrorArtistFrame);$("assetEditorClearFrame").addEventListener("click",clearArtistFrame);
  $("assetEditorSaveDraft").addEventListener("click",()=>saveArtistDraft(true));$("assetEditorSaveProject").addEventListener("click",saveArtistProjectFile);$("assetEditorExport").addEventListener("click",()=>downloadArtistPack("archipelago-artist-pack.json"));
  $("assetEditorImport").addEventListener("click",()=>$("assetEditorImportFile").click());$("assetEditorImportFile").addEventListener("change",(event)=>{const file=event.target.files?.[0];if(file) importArtistPackFile(file);event.target.value="";});
  $("assetEditorReset").addEventListener("click",()=>{captureArtistHistory();artistAssetPack.assets[assetEditorState.assetId]=createArtistAsset(assetEditorState.assetId);assetEditorState.animation=artistAssetDefinitions[assetEditorState.assetId].animations[0];assetEditorState.frameIndex=0;assetEditorState.layerIndex=0;scheduleArtistDraftSave();renderAssetEditor();});

  const canvasElement=$("assetEditorCanvas");
  canvasElement.addEventListener("contextmenu",(event)=>event.preventDefault());
  canvasElement.addEventListener("pointerdown",(event)=>{
    const point=canvasEventArtistPixel(event);if(!point) return;event.preventDefault();canvasElement.setPointerCapture(event.pointerId);captureArtistHistory();assetEditorState.drawing=true;assetEditorState.lastPixel=point.key;applyArtistTool(point,event.button);
    if(assetEditorState.tool==="fill"||assetEditorState.tool==="picker") assetEditorState.drawing=false;
  });
  canvasElement.addEventListener("pointermove",(event)=>{if(!assetEditorState.drawing) return;const point=canvasEventArtistPixel(event);if(!point||point.key===assetEditorState.lastPixel) return;assetEditorState.lastPixel=point.key;applyArtistTool(point,event.buttons===2?2:0);});
  const endDraw=()=>{assetEditorState.drawing=false;assetEditorState.lastPixel=null;};canvasElement.addEventListener("pointerup",endDraw);canvasElement.addEventListener("pointercancel",endDraw);canvasElement.addEventListener("lostpointercapture",endDraw);

  window.addEventListener("keydown",(event)=>{
    const editable=event.target instanceof HTMLElement&&(event.target.isContentEditable||["INPUT","TEXTAREA","SELECT"].includes(event.target.tagName));
    if(event.key==="#"&&!state.running&&!assetEditorState.open&&!editable){event.preventDefault();openAssetEditor();return;}
    if(!assetEditorState.open) return;
    if(event.key==="Escape"){event.preventDefault();closeAssetEditor();return;}
    if(!assetEditorState.unlocked||editable) return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"){event.preventDefault();event.shiftKey?redoArtistEdit():undoArtistEdit();return;}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="y"){event.preventDefault();redoArtistEdit();return;}
    const tools={p:"pencil",e:"eraser",f:"fill",i:"picker"};const tool=tools[event.key.toLowerCase()];if(tool){event.preventDefault();assetEditorState.tool=tool;renderAssetEditor();}
  });
}

function assetEditorPreviewLoop(timestamp){
  if(assetEditorState.open&&assetEditorState.unlocked) drawArtistPreview(timestamp);
  requestAnimationFrame(assetEditorPreviewLoop);
}

bindAssetEditor();
loadArtistAssetPack();
requestAnimationFrame(assetEditorPreviewLoop);

window.__ARCHIPELAGO_ASSET_EDITOR__={
  definitions:artistAssetDefinitions,get pack(){return artistAssetPack;},normalizeArtistPack,createDefaultArtistPack,
  drawArtistSpriteOverride,openAssetEditor,closeAssetEditor,saveArtistDraft,loadArtistAssetPack
};
