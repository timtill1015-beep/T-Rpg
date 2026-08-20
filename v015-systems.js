(() => {
"use strict";

const api=window.__ARCHIPELAGO_DEBUG__;
if(!api) return;
const {state,TILE_METERS,VIEW_SCALE,PLAYER_RADIUS,itemCatalog,animalCatalog,animalStates,treePhysicsStates}=api;
const canvas=document.getElementById("gameCanvas");
const ctx=canvas.getContext("2d");
const $=(id)=>document.getElementById(id);
const SAVE_PREFIX="archipelago.save.v3.";
const SAVE_VERSION=3;
const AUTOSAVE_SECONDS=20;
const START={x:9000,y:11400};
const BANDIT_CAMP_ONE={x:START.x+455,y:START.y+205};
const DESERT_BIOMES=["desert","redDesert","saltFlat","drySteppe","badlands"];
const houseSpritePaths={
  "hut-west":"assets/treibholz/fischerhaus.png",
  "hut-east":"assets/treibholz/vorratshaus.png",
  "hut-hall":"assets/treibholz/versammlunghalle.png"
};
const houseSprites={};
for(const [id,path] of Object.entries(houseSpritePaths)){const image=new Image();image.src=path;houseSprites[id]=image;}

const npcProfiles={
  mira:{name:"Mira",role:"Dorfvorsteherin",mood:"Wachsam",skin:"#d79a62",hair:"#8d3d2e",hairStyle:"braid",beardStyle:"none",shirt:"#4f7450",cloak:"#5a3940",outfit:"ranger",visibleArmor:"leatherVest"},
  borin:{name:"Borin",role:"Händler & Quartiermeister",mood:"Geschäftig",skin:"#a86f45",hair:"#403027",hairStyle:"undercut",beardStyle:"full",shirt:"#84623c",cloak:"#303d43",outfit:"traveler",visibleArmor:"paddedVest"},
  edda:{name:"Edda",role:"Fischerin & Netzmeisterin",mood:"Konzentriert",skin:"#c48755",hair:"#d9b24c",hairStyle:"bun",beardStyle:"none",shirt:"#315f68",cloak:"#3a514c",outfit:"traveler",visibleArmor:"leatherVest"},
  taren:{name:"Taren",role:"Wächter & Zimmermann",mood:"Aufmerksam",skin:"#8f5d3d",hair:"#1e1b19",hairStyle:"mohawk",beardStyle:"stubble",shirt:"#6d4a38",cloak:"#263c43",outfit:"raider",visibleArmor:"guardArmor"}
};

const interiors={
  fisher:{id:"fisher",name:"Eddas Fischerhaus",buildingId:"hut-west",width:176,height:118,door:{x:88,y:108},beds:[{x:31,y:24}],stations:[{id:"fisher-hearth",kind:"interiorHearth",x:139,y:31,label:"Fischsuppe essen",mobileLabel:"Essen"},{id:"fisher-net",kind:"interiorLore",x:35,y:83,label:"Eddas Fangbuch lesen",mobileLabel:"Lesen"}]},
  store:{id:"store",name:"Borins Vorratshaus",buildingId:"hut-east",width:184,height:120,door:{x:92,y:110},beds:[{x:150,y:23}],stations:[{id:"store-counter",kind:"interiorTrade",x:63,y:42,label:"Mit Borin handeln",mobileLabel:"Handel"},{id:"store-ledger",kind:"interiorLore",x:151,y:83,label:"Vorratsbuch ansehen",mobileLabel:"Lesen"}]},
  hall:{id:"hall",name:"Treibholzer Versammlungshalle",buildingId:"hut-hall",width:210,height:130,door:{x:105,y:120},beds:[{x:28,y:24},{x:182,y:24}],stations:[{id:"hall-hearth",kind:"interiorCampfire",x:105,y:43,label:"Am Hallenfeuer rasten und kochen",mobileLabel:"Rasten"},{id:"hall-board",kind:"interiorBoard",x:174,y:80,label:"Das Anschlagbrett lesen",mobileLabel:"Lesen"},{id:"hall-table",kind:"interiorMeal",x:105,y:82,label:"Gemeinsame Mahlzeit nehmen",mobileLabel:"Essen"}]}
};

Object.assign(itemCatalog,{
  wood:{name:"Holz",short:"Holz",category:"resource",width:2,height:1,maxStack:12,icon:"wood",description:"Ein trockener Holzabschnitt für Werkbank und Lagerfeuer."},
  coin:{name:"Inselmünze",short:"Münzen",category:"resource",width:1,height:1,maxStack:99,icon:"coin",description:"Alte Inselmünzen. Borin nimmt sie noch immer an."},
  cookedChicken:{name:"Gebratenes Huhn",short:"Huhn",category:"food",width:1,height:1,maxStack:6,icon:"cooked",consumable:true,heal:18,description:"Am Feuer gebraten. Stellt 18 Leben wieder her."},
  cookedPork:{name:"Gebratenes Wild",short:"Wild",category:"food",width:2,height:1,maxStack:6,icon:"cooked",consumable:true,heal:30,description:"Kräftiges Wildfleisch. Stellt 30 Leben wieder her."},
  cookedGame:{name:"Gebratenes Wüstenwild",short:"Wüstenwild",category:"food",width:2,height:1,maxStack:6,icon:"cooked",consumable:true,heal:24,description:"Mageres Wüstenfleisch mit Salzkruste. Stellt 24 Leben wieder her und kühlt kurz ab."},
  fieldBandage:{name:"Feldverband",short:"Verband",category:"medicine",width:1,height:2,maxStack:5,icon:"bandage",consumable:true,heal:38,description:"Stoppt Blutung und stellt 38 Leben wieder her."},
  leatherVest:{name:"Verstärkte Lederweste",short:"Lederweste",category:"armor",equipSlot:"body",width:2,height:3,icon:"vest",armor:6,description:"Einfache Rüstung aus zäher Wildschweinhaut."},
  huntingSpear:{name:"Jagdspeer",short:"Speer",category:"weapon",equipSlot:"mainHand",width:1,height:4,action:"spearThrust",duration:.42,cooldown:.55,animalDamage:68,corpseDamage:28,icon:"spear",description:"Lange Reichweite und ein klarer, gerichteter Stoß."},
  huntingBow:{name:"Jagdbogen",short:"Bogen",category:"weapon",equipSlot:"mainHand",width:2,height:3,action:"bowShot",duration:.48,cooldown:.62,animalDamage:58,corpseDamage:12,icon:"bow",description:"Leiser Fernkampf bis etwa 170 Meter. Benötigt für jeden Schuss einen Pfeil."},
  arrow:{name:"Jagdpfeil",short:"Pfeile",category:"ammo",width:1,height:2,maxStack:40,icon:"arrow",description:"Gefiederter Pfeil für den Jagdbogen."}
});

const recipes={
  workbench:[
    {id:"huntingSpear",label:"Jagdspeer",icon:"⚔",needs:{wood:2,bone:1},output:{huntingSpear:1}},
    {id:"huntingBow",label:"Jagdbogen",icon:"⌁",needs:{wood:3,boarHide:1},output:{huntingBow:1}},
    {id:"arrow",label:"6 Jagdpfeile",icon:"➶",needs:{wood:1,feather:2,bone:1},output:{arrow:6}},
    {id:"leatherVest",label:"Lederweste",icon:"◈",needs:{boarHide:2,wood:1},output:{leatherVest:1}},
    {id:"fieldBandage",label:"Feldverband",icon:"✚",needs:{boarHide:1,feather:2},output:{fieldBandage:2}}
  ],
  campfire:[
    {id:"cookedChicken",label:"Huhn braten",icon:"♨",needs:{rawChicken:1},output:{cookedChicken:1}},
    {id:"cookedPork",label:"Wild braten",icon:"♨",needs:{rawPork:1},output:{cookedPork:1}},
    {id:"cookedGame",label:"Wüstenwild braten",icon:"♨",needs:{rawGame:1},output:{cookedGame:1}}
  ],
  trader:[
    {id:"buyBandage",label:"Verband kaufen",icon:"✚",needs:{coin:3},output:{fieldBandage:1}},
    {id:"buyWood",label:"Holzbündel kaufen",icon:"▰",needs:{coin:2},output:{wood:2}}
  ]
};

const worldObjects=[
  {id:"mira",kind:"npc",variant:"mira",x:START.x+28,y:START.y+4,homeX:START.x+28,homeY:START.y+4,label:"Mit Mira sprechen",mobileLabel:"Reden",activity:"beaufsichtigt das Lagerfeuer"},
  {id:"borin",kind:"npc",variant:"borin",x:START.x-34,y:START.y+14,homeX:START.x-34,homeY:START.y+14,label:"Mit Borin sprechen",mobileLabel:"Reden",activity:"führt Handel"},
  {id:"edda",kind:"npc",variant:"edda",x:START.x-104,y:START.y+68,homeX:START.x-104,homeY:START.y+68,label:"Mit Edda sprechen",mobileLabel:"Reden",activity:"flickt Netze"},
  {id:"taren",kind:"npc",variant:"taren",x:START.x+42,y:START.y-62,homeX:START.x+42,homeY:START.y-62,label:"Mit Taren sprechen",mobileLabel:"Reden",activity:"prüft die Palisade"},
  {id:"workbench",kind:"workbench",x:START.x-10,y:START.y-42,radius:7,solid:true,label:"Werkbank benutzen",mobileLabel:"Bauen"},
  {id:"village-fire",kind:"campfire",x:START.x+27,y:START.y-38,radius:4,label:"Am Lagerfeuer rasten und kochen",mobileLabel:"Rasten"},
  {id:"village-well",kind:"well",x:START.x-52,y:START.y-28,radius:8,solid:true,label:"Brunnen untersuchen",mobileLabel:"Ansehen"},
  {id:"hut-west",kind:"hut",interior:"fisher",x:START.x-92,y:START.y+34,radius:22,halfWidth:25,halfHeight:15,solid:true,label:"Eddas Fischerhaus betreten",mobileLabel:"Betreten",pixelSize:[112,88]},
  {id:"hut-east",kind:"hut",interior:"store",x:START.x+89,y:START.y+37,radius:21,halfWidth:24,halfHeight:14,solid:true,label:"Borins Vorratshaus betreten",mobileLabel:"Betreten",pixelSize:[104,80]},
  {id:"hut-hall",kind:"hut",interior:"hall",x:START.x,y:START.y-109,radius:25,halfWidth:30,halfHeight:16,solid:true,label:"Versammlungshalle betreten",mobileLabel:"Betreten",pixelSize:[136,96]},
  {id:"fish-rack",kind:"fishRack",x:START.x-128,y:START.y+13,radius:5,label:"Eddas Trockenfisch begutachten",mobileLabel:"Ansehen"},
  {id:"net-table",kind:"netTable",x:START.x-114,y:START.y+70,radius:5,label:"Flicktisch untersuchen",mobileLabel:"Ansehen"},
  {id:"village-board",kind:"noticeBoard",x:START.x+54,y:START.y-74,radius:5,solid:true,label:"Treibholzer Anschläge lesen",mobileLabel:"Lesen"},
  {id:"boat-west",kind:"beachedBoat",x:START.x-152,y:START.y+76,radius:9,solid:true,label:"Altes Sturmboot untersuchen",mobileLabel:"Ansehen"},
  {id:"lantern-west",kind:"lanternPost",x:START.x-48,y:START.y+44,radius:2},{id:"lantern-east",kind:"lanternPost",x:START.x+48,y:START.y+44,radius:2},{id:"bench-fire",kind:"bench",x:START.x+45,y:START.y-18,radius:4},
  {id:"camp-1-tent",kind:"banditTent",x:BANDIT_CAMP_ONE.x,y:BANDIT_CAMP_ONE.y,radius:13,solid:true,label:"Banditenzelt durchsuchen",mobileLabel:"Suchen",camp:1},
  {id:"camp-1-fire",kind:"campfire",x:BANDIT_CAMP_ONE.x-42,y:BANDIT_CAMP_ONE.y+18,radius:4,label:"Fremdes Lagerfeuer",mobileLabel:"Rasten",camp:1},
  {id:"camp-1-chest",kind:"lootChest",x:BANDIT_CAMP_ONE.x+38,y:BANDIT_CAMP_ONE.y+18,radius:6,solid:true,label:"Banditentruhe öffnen",mobileLabel:"Öffnen",camp:1},
  {id:"camp-2-tent",kind:"banditTent",x:11360,y:8900,radius:13,solid:true,label:"Nordlager untersuchen",mobileLabel:"Suchen",camp:2},
  {id:"camp-2-fire",kind:"campfire",x:11325,y:8922,radius:4,label:"Lagerfeuer",mobileLabel:"Rasten",camp:2},
  {id:"camp-2-chest",kind:"lootChest",x:11382,y:8930,radius:6,solid:true,label:"Nordlager-Truhe öffnen",mobileLabel:"Öffnen",camp:2},
  {id:"camp-3-tent",kind:"banditTent",x:12680,y:15510,radius:13,solid:true,label:"Wüstenlager untersuchen",mobileLabel:"Suchen",camp:3},
  {id:"camp-3-fire",kind:"campfire",x:12644,y:15526,radius:4,label:"Lagerfeuer",mobileLabel:"Rasten",camp:3},
  {id:"camp-3-chest",kind:"lootChest",x:12702,y:15538,radius:6,solid:true,label:"Wüstenlager-Truhe öffnen",mobileLabel:"Öffnen",camp:3},
  {id:"cave-mist",kind:"cave",x:START.x-360,y:START.y+285,radius:14,solid:true,label:"Nebelstollen betreten",mobileLabel:"Erkunden"},
  {id:"cave-frost",kind:"cave",x:8050,y:2850,radius:14,solid:true,label:"Frosthöhle betreten",mobileLabel:"Erkunden"},
  {id:"cave-sun",kind:"cave",x:13220,y:16920,radius:14,solid:true,label:"Gluthöhle betreten",mobileLabel:"Erkunden"},
  {id:"ruin-cache-1",kind:"lootChest",x:10735,y:10905,radius:6,solid:true,label:"Gezeitenkiste öffnen",mobileLabel:"Öffnen"},
  {id:"ruin-cache-2",kind:"lootChest",x:15135,y:5755,radius:6,solid:true,label:"Königskiste öffnen",mobileLabel:"Öffnen"},
  {id:"ruin-cache-3",kind:"lootChest",x:6705,y:17315,radius:6,solid:true,label:"Sonnenuhr-Kassette öffnen",mobileLabel:"Öffnen"},
  {id:"qadim-well",kind:"desertWell",x:9828,y:17462,radius:8,solid:true,label:"Tiefbrunnen benutzen",mobileLabel:"Trinken"},
  {id:"qadim-cache",kind:"lootChest",x:9880,y:17492,radius:6,solid:true,label:"Karawanentruhe öffnen",mobileLabel:"Öffnen"},
  {id:"miraj-caravan",kind:"caravan",x:4928,y:16812,radius:14,solid:true,label:"Salzkarawane untersuchen",mobileLabel:"Suchen"},
  {id:"miraj-cache",kind:"lootChest",x:4970,y:16828,radius:6,solid:true,label:"Salzkassette öffnen",mobileLabel:"Öffnen"},
  {id:"glass-altar",kind:"sunAltar",x:16228,y:17092,radius:10,solid:true,label:"Glasaltar berühren",mobileLabel:"Berühren"},
  {id:"glass-cache",kind:"lootChest",x:16178,y:17114,radius:6,solid:true,label:"Sternentruhe öffnen",mobileLabel:"Öffnen"}
];
const propPixelSizes={workbench:[48,32],campfire:[32,32],well:[48,32],hut:[112,88],fishRack:[52,38],netTable:[46,30],noticeBoard:[42,42],beachedBoat:[78,42],lanternPost:[24,44],bench:[42,24],cave:[64,48],banditTent:[64,48],lootChest:[32,32],desertWell:[48,40],caravan:[72,48],sunAltar:[48,56]};

function createBandits(){
  const camps=[
    [1,BANDIT_CAMP_ONE.x-48,BANDIT_CAMP_ONE.y+38],[1,BANDIT_CAMP_ONE.x+6,BANDIT_CAMP_ONE.y+54],[1,BANDIT_CAMP_ONE.x+54,BANDIT_CAMP_ONE.y+16],
    [2,11310,8875],[2,11362,8862],[2,11402,8915],
    [3,12630,15478],[3,12680,15462],[3,12728,15508]
  ];
  return camps.map(([camp,x,y],index)=>({
    id:"bandit:"+(index+1),kind:"bandit",camp,x,y,homeX:x,homeY:y,ySort:y,health:110,maxHealth:110,status:"alive",
    dir:"down",moving:false,phase:"idle",timer:0,cooldown:index*.18,vx:0,vy:0,hitFlash:0,attackHit:false,gait:index*.7
  }));
}

const runtime={
  activeSlot:null,pendingLoad:null,autosave:0,saveFlash:0,hitStop:0,shake:0,roll:null,arrows:[],arrowSerial:0,renderDensity:1,frameTime:.016,questSignature:"",markerSignature:"",lastSoundAt:new Map(),audio:null,
  interior:null,dialogTimer:null,npcScheduleMinute:-1,
  world:{contentVersion:19,questStage:0,bandits:createBandits(),opened:{},visited:{},crafted:{},meals:{},playSeconds:0,weatherSeed:0}
};

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function distanceTo(object){return Math.hypot(state.player.x-object.x,state.player.y-object.y);}
function inventoryCount(itemId){return state.inventory.items.reduce((sum,item)=>sum+(item.itemId===itemId?(item.quantity||1):0),0);}
function removeInventory(itemId,quantity){
  let remaining=quantity;
  for(let index=state.inventory.items.length-1;index>=0&&remaining>0;index--){
    const item=state.inventory.items[index];if(item.itemId!==itemId) continue;
    const amount=Math.min(remaining,item.quantity||1);remaining-=amount;item.quantity=(item.quantity||1)-amount;
    if(item.quantity<=0){for(const slot of Object.keys(state.inventory.equipment)) if(state.inventory.equipment[slot]===item.id) state.inventory.equipment[slot]=null;state.inventory.items.splice(index,1);}
  }
  api.syncHeldItem();api.renderInventory();return quantity-remaining;
}
function hasIngredients(needs){return Object.entries(needs).every(([id,count])=>inventoryCount(id)>=count);}
function ingredientsText(needs){return Object.entries(needs).map(([id,count])=>count+"× "+(itemCatalog[id]?.short||id)).join(" · ");}

function villageHour(){return (8+state.elapsed/120)%24;}
function exteriorPoint(id,dx=0,dy=0){const object=worldObjects.find((entry)=>entry.id===id);return {x:(object?.x||START.x)+dx,y:(object?.y||START.y)+dy};}
function npcSchedule(id,hour=villageHour()){
  if(id==="mira"){
    if(hour<6||hour>=22) return {interior:"hall",x:30,y:28,pose:"sleep",activity:"schläft in der Halle"};
    if(hour<7.2) return {interior:"hall",x:88,y:78,pose:"eat",activity:"frühstückt mit den Frühwachen"};
    if(hour<10) return {...exteriorPoint("village-fire",-12,8),activity:"beaufsichtigt das Morgenfeuer"};
    if(hour<13) return {...exteriorPoint("workbench",12,8),activity:"prüft Werkzeug und Jagdvorräte"};
    if(hour<16) return {...exteriorPoint("village-board",-9,8),activity:"verteilt Aufgaben am Anschlagbrett"};
    if(hour<18.5) return {...exteriorPoint("village-well",14,5),activity:"spricht mit heimkehrenden Sammlern"};
    if(hour<20.3) return {interior:"hall",x:91,y:79,pose:"eat",activity:"isst in der Versammlungshalle"};
    return {...exteriorPoint("village-fire",10,8),activity:"hält Abendwache am Feuer"};
  }
  if(id==="borin"){
    if(hour<7||hour>=21.5) return {interior:"store",x:151,y:27,pose:"sleep",activity:"schläft über seinem Lager"};
    if(hour<8) return {interior:"hall",x:121,y:79,pose:"eat",activity:"frühstückt in der Halle"};
    if(hour<18) return {x:START.x-34,y:START.y+14,activity:"führt Handel und zählt Vorräte"};
    if(hour<19.2) return {interior:"store",x:64,y:44,pose:"work",activity:"sortiert die Tageslieferungen"};
    if(hour<21) return {interior:"hall",x:124,y:81,pose:"eat",activity:"isst mit den Dorfbewohnern"};
    return {interior:"store",x:145,y:36,pose:"work",activity:"schließt sein Vorratsbuch ab"};
  }
  if(id==="edda"){
    if(hour<5.5||hour>=21.5) return {interior:"fisher",x:31,y:27,pose:"sleep",activity:"schläft nach der Frühfahrt"};
    if(hour<6.2) return {interior:"fisher",x:134,y:34,pose:"eat",activity:"wärmt Fischsuppe auf"};
    if(hour<11) return {...exteriorPoint("boat-west",-5,10),activity:"landet den Morgenfang an"};
    if(hour<14) return {...exteriorPoint("fish-rack",8,7),activity:"salzt und trocknet den Fang"};
    if(hour<15) return {interior:"hall",x:83,y:83,pose:"eat",activity:"isst in der Halle"};
    if(hour<19) return {...exteriorPoint("net-table",5,7),activity:"flickt beschädigte Netze"};
    if(hour<21) return {interior:"hall",x:82,y:82,pose:"eat",activity:"erzählt vom Nebel vor der Küste"};
    return {interior:"fisher",x:37,y:83,pose:"work",activity:"führt ihr Fangbuch"};
  }
  if(hour<6||hour>=23) return {interior:"hall",x:181,y:28,pose:"sleep",activity:"schläft in der Wachnische"};
  if(hour<7) return {interior:"hall",x:128,y:84,pose:"eat",activity:"isst vor der Frühwache"};
  if(hour<10) return {...exteriorPoint("village-board",9,9),activity:"liest Wachmeldungen"};
  if(hour<13) return {...exteriorPoint("workbench",-11,8),activity:"repariert Speere und Schilde"};
  if(hour<16) return {x:START.x+142,y:START.y+54,activity:"patrouilliert das östliche Tor"};
  if(hour<18.5) return {x:START.x-18,y:START.y+58,activity:"prüft Stege und Hauspfähle"};
  if(hour<20) return {interior:"hall",x:127,y:82,pose:"eat",activity:"isst in der Halle"};
  return {...exteriorPoint("village-fire",18,10),activity:"hält Nachtwache am Feuer"};
}

function updateNpcSchedules(dt){
  const frozen=state.paused||state.mapOpen||state.inventoryOpen||state.dead;
  for(const npc of worldObjects.filter((entry)=>entry.kind==="npc")){
    const schedule=npcSchedule(npc.id);
    npc.activity=schedule.activity;npc.pose=schedule.pose||"stand";npc.indoor=schedule.interior||null;npc.indoorX=schedule.x;npc.indoorY=schedule.y;
    if(npc.indoor||frozen){npc.moving=false;continue;}
    const dx=schedule.x-npc.x,dy=schedule.y-npc.y,distance=Math.hypot(dx,dy);
    if(distance<1.2){npc.moving=false;continue;}
    const speed=npc.id==="taren"?12:9.5;const step=Math.min(distance,speed*dt);const nx=npc.x+dx/distance*step,ny=npc.y+dy/distance*step;
    const canMove=api.isWalkable(nx,ny)&&!worldObjects.some((object)=>object.solid&&object!==npc&&Math.hypot(nx-object.x,ny-object.y)<Math.max(3,(object.radius||4)*.72));
    if(canMove){npc.x=nx;npc.y=ny;npc.moving=true;npc.gait=(npc.gait||0)+dt*5.5;}else npc.moving=false;
    npc.dir=Math.abs(dx)>Math.abs(dy)?dx>0?"right":"left":dy>0?"down":"up";
  }
}

function interiorRoom(){return runtime.interior&&interiors[runtime.interior.id];}
function interiorFurniture(room){
  const common=[{x:4,y:4,w:room.width-8,h:8},{x:4,y:4,w:8,h:room.height-8},{x:room.width-12,y:4,w:8,h:room.height-8}];
  if(room.id==="fisher") return common.concat([{x:17,y:14,w:38,h:25},{x:117,y:18,w:46,h:29},{x:18,y:70,w:43,h:25}]);
  if(room.id==="store") return common.concat([{x:18,y:17,w:35,h:27},{x:131,y:14,w:38,h:30},{x:45,y:34,w:45,h:18},{x:128,y:72,w:40,h:26}]);
  return common.concat([{x:14,y:13,w:35,h:27},{x:161,y:13,w:35,h:27},{x:78,y:31,w:54,h:23},{x:70,y:67,w:70,h:30},{x:163,y:67,w:31,h:27}]);
}
function interiorCanStand(x,y){
  const room=interiorRoom();if(!room) return false;if(x<15||y<17||x>room.width-15||y>room.height-10) return false;
  return !interiorFurniture(room).some((rect)=>x>rect.x-4&&x<rect.x+rect.w+4&&y>rect.y-4&&y<rect.y+rect.h+4);
}
function moveInteriorPlayer(dt){
  if(!runtime.interior||state.paused||state.mapOpen||state.inventoryOpen||state.dead) return false;
  let dx=0,dy=0;if(state.keys.has("w")||state.keys.has("arrowup"))dy--;if(state.keys.has("s")||state.keys.has("arrowdown"))dy++;if(state.keys.has("a")||state.keys.has("arrowleft"))dx--;if(state.keys.has("d")||state.keys.has("arrowright"))dx++;
  state.player.moving=!!(dx||dy);state.player.swimming=false;state.player.drowning=false;if(!dx&&!dy) return true;
  const length=Math.hypot(dx,dy);dx/=length;dy/=length;const speed=state.keys.has("shift")?45:31;const nx=runtime.interior.x+dx*speed*dt,ny=runtime.interior.y+dy*speed*dt;
  if(interiorCanStand(nx,runtime.interior.y)) runtime.interior.x=nx;if(interiorCanStand(runtime.interior.x,ny)) runtime.interior.y=ny;
  state.player.dir=Math.abs(dx)>Math.abs(dy)?dx>0?"right":"left":dy>0?"down":"up";state.player.walkTime+=dt*(state.keys.has("shift")?2:1);state.player.stamina=Math.min(100,state.player.stamina+dt*12);return true;
}
function enterInterior(building){
  const room=interiors[building.interior];if(!room) return;
  if(state.mountedHorseId){const horse=animalStates.get(state.mountedHorseId);if(horse) horse.riderId=null;state.mountedHorseId=null;api.showToast("Dein Pferd wartet vor der Tür.",1500);}
  runtime.roll=null;runtime.interior={id:room.id,x:room.door.x,y:room.door.y-8,exteriorX:state.player.x,exteriorY:state.player.y};state.keys.clear();$("gamePanel").classList.add("inside-building");
  const label=$("insideLabel")||document.createElement("div");label.id="insideLabel";label.className="inside-label";label.textContent=room.name;if(!label.parentNode) $("gamePanel").appendChild(label);api.showToast(room.name+" betreten",1300);
  api.updateMobileControlState?.();
}
function exitInterior(){
  if(!runtime.interior) return;runtime.interior=null;state.keys.clear();$("gamePanel").classList.remove("inside-building");$("insideLabel")?.remove();api.updateMobileControlState?.();api.showToast("Zurück in Treibholz",1200);
}

function questCopy(){
  const stage=runtime.world.questStage;
  if(stage===0) return ["AUFBRUCH","Glut im Nebel","Sprich mit Mira im Lager Treibholz."];
  if(stage===1) return ["SAMMELN","Werkzeug für die Jagd","Sammle 2 Holz und 1 Knochen. Holzstücke entstehen aus gefällten, zerteilten Bäumen."];
  if(stage===2) return ["HANDWERK","Ein längerer Arm","Stelle an der Werkbank einen Jagdspeer her."];
  if(stage===3){const defeated=runtime.world.bandits.filter((bandit)=>bandit.camp===1&&bandit.status==="dead").length;return ["GEFAHR","Das Lager am alten Weg","Besiege die Banditen auf der gerodeten Kieslichtung östlich von Treibholz · "+defeated+" / 3."];}
  if(stage===4) return ["RÜCKKEHR","Der Weg ist frei","Kehre zu Mira nach Treibholz zurück."];
  return ["ERKUNDUNG","Die zersplitterte See","Finde Höhlen, Ruinen, Lager und weitere Geheimnisse der Inseln."];
}
function updateQuestHud(){
  const copy=questCopy();const signature=copy.join("|");if(signature===runtime.questSignature) return;runtime.questSignature=signature;if($("questLabel")) $("questLabel").textContent=copy[0];if($("questTitle")) $("questTitle").textContent=copy[1];if($("questDescription")) $("questDescription").textContent=copy[2];
}
function questTarget(){
  const stage=runtime.world.questStage;if(stage===3) return {...worldObjects.find((entry)=>entry.id==="camp-1-tent"),markerLabel:"KIESLICHTUNG",markerGlyph:"!"};if(stage===2) return {...worldObjects.find((entry)=>entry.id==="workbench"),markerLabel:"WERKBANK",markerGlyph:"◆"};
  if(stage===0||stage===4){const mira=worldObjects.find((entry)=>entry.id==="mira");if(mira?.indoor){const hall=worldObjects.find((entry)=>entry.id==="hut-hall");return {...hall,markerLabel:"MIRA · IN DER HALLE",markerGlyph:"!"};}return {...mira,markerLabel:"MIRA",markerGlyph:"!"};}return null;
}
function updateQuestMarker(){
  const target=questTarget();const marker=$("questWorldMarker");if(!marker) return;if(runtime.interior||!target){marker.classList.add("hidden");runtime.markerSignature="";return;}
  const dx=target.x-state.player.x,dy=target.y-state.player.y,distance=Math.hypot(dx,dy);if(distance<34){marker.classList.add("hidden");return;}
  const directionIndex=Math.round((Math.atan2(dy,dx)+Math.PI*2)/(Math.PI/4))%8;const arrow=["→","↘","↓","↙","←","↖","↑","↗"][directionIndex];const metres=Math.max(10,Math.round(distance/10)*10);const signature=target.markerLabel+":"+arrow+":"+metres;
  if(signature!==runtime.markerSignature){runtime.markerSignature=signature;marker.innerHTML='<span class="quest-marker-gem"><b>'+target.markerGlyph+'</b></span><span class="quest-marker-copy"><strong>'+target.markerLabel+'</strong><small>AKTIVES ZIEL · '+metres+' m</small><i class="quest-marker-arrow">'+arrow+'</i></span>';}
  marker.classList.remove("hidden");
}
function advanceQuestFromInventory(){
  if(runtime.world.questStage===1&&inventoryCount("wood")>=2&&inventoryCount("bone")>=1){runtime.world.questStage=2;api.showToast("Neue Aufgabe · Jagdspeer an der Werkbank herstellen",2600);sound("quest");}
  if(runtime.world.questStage===3&&runtime.world.bandits.filter((bandit)=>bandit.camp===1&&bandit.status==="dead").length>=3){runtime.world.questStage=4;api.showToast("Banditenlager geräumt · Kehre zu Mira zurück",3000);sound("quest");}
  updateQuestHud();
}

function npcForSpeaker(speaker){return worldObjects.find((entry)=>entry.kind==="npc"&&npcProfiles[entry.variant]?.name===speaker);}
function renderDialogPortrait(speaker,overrideProfile=null){
  const portrait=$("dialogPortrait");if(!portrait) return;const c=portrait.getContext("2d");c.imageSmoothingEnabled=false;c.clearRect(0,0,portrait.width,portrait.height);
  const gradient=c.createLinearGradient(0,0,0,portrait.height);gradient.addColorStop(0,"#53756d");gradient.addColorStop(.56,"#1b3b3f");gradient.addColorStop(1,"#061013");c.fillStyle=gradient;c.fillRect(0,0,portrait.width,portrait.height);
  c.globalAlpha=.28;c.fillStyle="#d5b66b";c.fillRect(18,94,244,4);c.fillStyle="#122b2f";c.fillRect(0,238,280,122);for(let x=8;x<280;x+=28)c.fillRect(x,218+(x%3)*6,18,34);c.globalAlpha=1;
  const npc=npcForSpeaker(speaker);const profile=overrideProfile||(npc&&npcProfiles[npc.variant]);
  if(profile){const visual={...state.player,...profile,id:"dialog:"+(npc?.id||speaker),name:"",dir:"down",moving:false,walkTime:0,heldItem:null,actionType:null,visibleArmor:profile.visibleArmor};api.drawCharacter(c,140,312,visual,11,false,true);}
  else{c.strokeStyle="#d5b65f";c.lineWidth=3;c.strokeRect(103,118,74,74);c.fillStyle="#d5b65f";c.font="52px Georgia";c.textAlign="center";c.fillText("✦",140,175);}
}
function showDialog(speaker,text,actions=[{label:"Gespräch beenden",action:closeDialog}],context={}){
  state.paused=true;const npc=npcForSpeaker(speaker);const profile=context.profile||(npc&&npcProfiles[npc.variant]);$("dialogSpeaker").textContent=speaker;$("dialogText").textContent=text;$("dialogKicker").textContent=context.kicker||(npc?"TREIBHOLZ · GESPRÄCH":"ERKUNDUNGSFUND");$("dialogRole").textContent=context.role||profile?.role||"Chronik der zersplitterten See";$("dialogMood").textContent=context.mood||profile?.mood||"Entdeckung";$("dialogActivity").textContent=context.activity||(npc?(profile.role+" · "+npc.activity):"Die Welt erzählt ihre Geschichte");renderDialogPortrait(speaker,profile);
  const box=$("dialogActions");box.replaceChildren();for(const entry of actions){const button=document.createElement("button");button.type="button";button.textContent=entry.label;if(entry.primary) button.classList.add("primary");button.addEventListener("click",entry.action,{once:true});box.appendChild(button);}$("dialogOverlay").classList.remove("hidden");requestAnimationFrame(()=>box.querySelector("button")?.focus());
}
function closeDialog(){$("dialogOverlay").classList.add("hidden");state.paused=false;state.keys.clear();}

function talkToMira(){
  const stage=runtime.world.questStage;
  const lore={label:"Was ist Treibholz?",action:()=>showDialog("Mira","Nach der Sturmflut blieben nur Wrackholz, drei Familien und dieses Stück trockenes Land. Jedes Haus hier trägt Balken eines anderen gesunkenen Schiffes. Darum besitzt niemand das Dorf allein.",[{label:"Zurück",action:talkToMira},{label:"Gespräch beenden",action:closeDialog}])};
  if(stage===0){showDialog("Mira","Du bist kaum an Land und ich drücke dir schon Arbeit in die Hände. So funktioniert Treibholz. Bring mir zwei Holzstücke und einen Knochen; an der Werkbank wird daraus ein Speer.",[{label:"Ich übernehme die Jagdaufgabe",primary:true,action:()=>{runtime.world.questStage=1;closeDialog();updateQuestHud();saveNow("quest");}},{label:"Wie komme ich an das Material?",action:()=>showDialog("Mira","Fälle einen Baum mit der Axt und spalte den Stamm. Knochen findest du erst, wenn du einen Kadaver weiter zerlegst. Edda kann dir zeigen, welche Tiere nahe am Dorf ziehen.",[{label:"Aufgabe annehmen",primary:true,action:()=>{runtime.world.questStage=1;closeDialog();updateQuestHud();saveNow("quest");}},{label:"Zurück",action:talkToMira}])},lore,{label:"Vorerst nicht",action:closeDialog}]);return;}
  if(stage===1||stage===2){showDialog("Mira",stage===1?"Zerteile einen gefällten Stamm und sammle die Stücke ein. Einen Knochen findest du erst beim Zerlegen eines Tierkadavers.":"Alles liegt bereit. Die Werkbank steht hinter dem Feuer. Baue dort den Jagdspeer und rüste ihn über den Rucksack oder Taste 3 aus.",[{label:stage===1?"Wo jage ich?":"Ich baue den Speer",primary:true,action:stage===1?()=>showDialog("Mira","Hühner scharren am Dorfrand. Wildschweine halten sich weiter draußen. Unterschätze ihren Ansturm nicht.",[{label:"Verstanden",action:closeDialog}]):closeDialog},lore,{label:"Gespräch beenden",action:closeDialog}]);return;}
  if(stage===3){showDialog("Mira","Tarens Spuren führen zur gerodeten Kieslichtung östlich des Dorfes. Dort können sich die Banditen nicht mehr zwischen den Bäumen verstecken. Bleib in Bewegung und nutze die Ausweichrolle.",[{label:"Ich räume das Lager",primary:true,action:closeDialog},{label:"Warum greifen sie Treibholz an?",action:()=>showDialog("Mira","Sie suchen unsere alte Gezeitenkarte. Angeblich zeigt sie einen Zugang unter den Inseln. Bisher fanden sie nur Fischernetze und Tarens schlechte Laune.",[{label:"Zurück",action:talkToMira}])},lore,{label:"Gespräch beenden",action:closeDialog}]);return;}
  if(stage===4){showDialog("Mira","Der alte Weg ist wieder frei. Treibholz schuldet dir mehr als Münzen, doch vorerst müssen fünfzehn reichen. Jenseits des Nebels warten weitere Lager und die Spuren der Gezeitenkarte.",[{label:"Belohnung nehmen",primary:true,action:()=>{api.addInventoryItem("coin",15);runtime.world.questStage=5;closeDialog();updateQuestHud();saveNow("quest");sound("quest");}},{label:"Später",action:closeDialog}]);return;}
  showDialog("Mira","Treibholz hält. Wenn du weiterziehst: Taren kennt die Gefahren der Wege, Edda die Küste und Borin alles, woran sich noch verdienen lässt.",[{label:"Was liegt jenseits des Nebels?",action:()=>showDialog("Mira","Im Norden brennt das Leuchtfeuer von Eiswacht. Im Süden verschluckt die Wüste ganze Karawanen. Dazwischen liegen Ruinen, die älter sind als unsere Karten.",[{label:"Zurück",action:talkToMira}])},lore,{label:"Gespräch beenden",action:closeDialog}]);
}

function talkToNpc(object){
  if(object.variant==="mira"){talkToMira();return;}
  if(object.pose==="sleep"){const profile=npcProfiles[object.variant];showDialog(profile.name,"Nur ein müdes Murmeln. "+profile.name+" folgt einem echten Tagesablauf und schläft zu dieser Stunde.",[{label:"Leise gehen",action:closeDialog}]);return;}
  if(object.variant==="borin"){
    showDialog("Borin","Was du findest, bekommt bei mir einen Preis. Was du dringend brauchst, wird dadurch leider nicht billiger.",[{label:"Waren ansehen",primary:true,action:()=>{closeDialog();openCraft("trader");}},{label:"Wie läuft dein Tag?",action:()=>showDialog("Borin","Morgens öffne ich den Stand, abends sortiere ich im Vorratshaus nach. Zum Essen bin ich in der Halle. Nachts findest du mich oben im Lager – aber weck mich besser nicht.",[{label:"Zurück",action:()=>talkToNpc(object)}])},{label:"Neuigkeiten",action:()=>showDialog("Borin","Taren sah Rauch auf der Kieslichtung. Edda behauptet außerdem, die Fische würden vor etwas Großem aus der Bucht fliehen.",[{label:"Zurück",action:()=>talkToNpc(object)}])},{label:"Gespräch beenden",action:closeDialog}]);return;
  }
  if(object.variant==="edda"){
    showDialog("Edda","Die Netze reißen nicht vom Wind. Etwas scheucht die Schwärme gegen die Pfähle. Bis ich weiß was, wird jeder Fang doppelt gezählt.",[{label:"Erzähl mir von deiner Arbeit",primary:true,action:()=>showDialog("Edda","Vor Sonnenaufgang fahre ich raus. Danach salze ich den Fang, flicke Netze und schreibe alles ins Fangbuch. Wenn dort drei leere Zeilen stehen, hungert Treibholz zwei Tage später.",[{label:"Zurück",action:()=>talkToNpc(object)}])},{label:"Was ist draußen im Nebel?",action:()=>showDialog("Edda","Manchmal hört man eine Glocke unter dem Wasser. Meine Mutter nannte das Seemannsgarn. Sie fuhr einmal hinaus, um es zu beweisen, und kam ohne Schatten zurück.",[{label:"Zurück",action:()=>talkToNpc(object)}])},{label:"Gespräch beenden",action:closeDialog}]);return;
  }
  showDialog("Taren","Ich stehe nicht nur herum. Morgens prüfe ich Meldungen, mittags repariere ich Waffen, danach gehe ich die Pfähle und beide Zugänge ab.",[{label:"Was weißt du über die Banditen?",primary:true,action:()=>showDialog("Taren","Sie lagern jetzt auf der Kieslichtung östlich von hier. Keine Bäume, keine Deckung – aber auch wir können uns dort nicht anschleichen. Der Anführer trägt eine verstärkte Weste.",[{label:"Zurück",action:()=>talkToNpc(object)}])},{label:"Kannst du Ausrüstung erklären?",action:()=>showDialog("Taren","Rüstung muss tatsächlich angelegt sein. Dann siehst du sie am Körper und sie fängt Schaden ab. Ein Speer stößt geradeaus; halte den Gegner vor dir und nutze die längere Reichweite.",[{label:"Zurück",action:()=>talkToNpc(object)}])},{label:"Gespräch beenden",action:closeDialog}]);
}

function openCraft(kind){
  const titles={workbench:["WERKBANK","Handwerk","Baue dauerhafte Ausrüstung aus gefundenen Materialien."],campfire:["LAGERFEUER","Rasten & Kochen","Rasten heilt vollständig; Fleisch kann haltbar gebraten werden."],trader:["BORINS HANDEL","Handel","Borin tauscht Vorräte gegen alte Inselmünzen."]};
  const copy=titles[kind];$("craftKicker").textContent=copy[0];$("craftTitle").textContent=copy[1];$("craftSubtitle").textContent=copy[2];const list=$("craftRecipeList");list.replaceChildren();
  if(kind==="campfire"){
    const rest=document.createElement("article");rest.className="craft-recipe";rest.innerHTML='<span class="craft-recipe-icon">☾</span><div><h3>Bis zum Morgen rasten</h3><p>Leben, Ausdauer und Blutung vollständig erholen</p></div>';
    const button=document.createElement("button");button.textContent="Rasten";button.className="primary";button.addEventListener("click",()=>{state.player.health=100;state.player.stamina=100;state.player.heat=0;state.player.bleed={intensity:0,duration:0,tickCooldown:0,volume:0,trailDistance:0};const hour=(8+state.elapsed/120)%24;state.elapsed+=(((8-hour+24)%24)||24)*120;api.showToast("Ausgeruht · ein neuer Morgen beginnt",2200);sound("rest");saveNow("rest");renderCraft(kind);});rest.appendChild(button);list.appendChild(rest);
  }
  for(const recipe of recipes[kind]||[]){
    const article=document.createElement("article");const available=hasIngredients(recipe.needs);article.className="craft-recipe"+(available?"":" locked");article.innerHTML='<span class="craft-recipe-icon">'+recipe.icon+'</span><div><h3>'+recipe.label+'</h3><p>'+ingredientsText(recipe.needs)+'</p></div>';
    const button=document.createElement("button");button.textContent=available?(kind==="trader"?"Kaufen":"Herstellen"):"Material fehlt";button.disabled=!available;button.className=available?"primary":"";button.addEventListener("click",()=>craft(recipe,kind));article.appendChild(button);list.appendChild(article);
  }
  state.paused=true;$("craftOverlay").classList.remove("hidden");
}
function renderCraft(kind){openCraft(kind);}
function closeCraft(){$("craftOverlay").classList.add("hidden");state.paused=false;}
function craft(recipe,kind){
  if(!hasIngredients(recipe.needs)) return;
  const inventoryBefore=clone(state.inventory);
  for(const [itemId,count] of Object.entries(recipe.output)){if(api.addInventoryItem(itemId,count)<count){state.inventory=inventoryBefore;api.syncHeldItem();api.renderInventory();api.showToast("Im Rucksack ist nicht genug Platz.");return;}}
  for(const [itemId,count] of Object.entries(recipe.needs)) removeInventory(itemId,count);
  runtime.world.crafted[recipe.id]=(runtime.world.crafted[recipe.id]||0)+1;
  if(recipe.id==="huntingSpear"&&runtime.world.questStage===2) runtime.world.questStage=3;
  api.showToast(recipe.label+" hergestellt",1800);sound("craft");updateQuestHud();saveNow("craft");renderCraft(kind);
}

function nearestWoodPiece(){
  let best=null;
  for(const physics of treePhysicsStates.values()) for(const [index,piece] of (physics.woodPieces||[]).entries()){
    if(piece.collected||!piece.settled) continue;const distance=Math.hypot(state.player.x-piece.x,state.player.y-piece.y);if(distance<16&&(!best||distance<best.distance)) best={type:"v015",kind:"wood",physics,piece,index,distance,label:"Holzstück aufnehmen",mobileLabel:"Nehmen"};
  }
  return best;
}
function nearbyInteraction(){
  if(runtime.interior){
    const room=interiorRoom();let best=null;const consider=(candidate,x,y)=>{const distance=Math.hypot(runtime.interior.x-x,runtime.interior.y-y);if(distance<15&&(!best||distance<best.distance)) best={type:"v015",distance,...candidate};};
    consider({kind:"interiorExit",label:"Nach Treibholz hinausgehen",mobileLabel:"Verlassen"},room.door.x,room.door.y);
    for(const station of room.stations) consider({kind:station.kind,station,label:station.label,mobileLabel:station.mobileLabel},station.x,station.y);
    for(const npc of worldObjects.filter((entry)=>entry.kind==="npc"&&entry.indoor===room.id)) consider({kind:"interiorNpc",object:npc,label:"Mit "+npcProfiles[npc.variant].name+" sprechen",mobileLabel:"Reden"},npc.indoorX,npc.indoorY);
    return best;
  }
  let best=nearestWoodPiece();
  for(const object of worldObjects){
    if(object.kind==="npc"&&object.indoor) continue;
    if(runtime.world.opened[object.id]&&object.kind==="lootChest") continue;
    const distance=Math.max(0,distanceTo(object)-(object.radius||2));
    if(distance<18&&object.label&&(!best||distance<best.distance)) best={type:"v015",kind:object.kind,object,distance,label:object.label,mobileLabel:object.mobileLabel};
  }
  return best;
}
function interact(target){
  if(target.type!=="v015") return false;
  if(target.kind==="interiorExit"){exitInterior();return true;}
  if(target.kind==="interiorNpc"){talkToNpc(target.object);return true;}
  if(target.kind==="interiorTrade"){const borin=worldObjects.find((entry)=>entry.id==="borin");if(borin?.indoor==="store") talkToNpc(borin);else openCraft("trader");return true;}
  if(target.kind==="interiorCampfire"){openCraft("campfire");return true;}
  if(target.kind==="interiorHearth"||target.kind==="interiorMeal"){
    const day=Math.floor(state.elapsed/(120*24));const key=target.station.id+":"+day;if(runtime.world.meals?.[key]){api.showToast("Du hast hier heute bereits gegessen.",1500);return true;}runtime.world.meals=runtime.world.meals||{};runtime.world.meals[key]=true;state.player.health=Math.min(100,state.player.health+18);state.player.stamina=100;api.showToast("Warme Mahlzeit · +18 Leben · volle Ausdauer",1900);sound("heal");return true;
  }
  if(target.kind==="interiorBoard"){showDialog("Anschlagbrett","Drei neue Kerben markieren fehlende Salzsäcke. Darunter warnt Tarens Handschrift vor dem Lager auf der Kieslichtung und Edda sucht Hilfe beim Zählen ungewöhnlich leerer Netze.");return true;}
  if(target.kind==="interiorLore"){showDialog(target.station.id==="fisher-net"?"Eddas Fangbuch":"Borins Vorratsbuch",target.station.id==="fisher-net"?"Die letzten Fänge werden kleiner. Neben drei leeren Zeilen ist eine Glocke gezeichnet, daneben nur: Nicht bei Nebel folgen.":"Holz, Salz und Verbände reichen für neun Tage. Mehrere Lieferungen sind mit demselben Zeichen markiert wie die gestohlenen Kisten im Banditenlager.");return true;}
  if(target.kind==="wood"){
    if(api.addInventoryItem("wood",1)>0){target.piece.collected=true;api.showToast("+1 Holz");sound("pickup");advanceQuestFromInventory();saveNow("pickup");}else api.showToast("Der Rucksack ist voll.");return true;
  }
  const object=target.object;
  if(object.kind==="npc"){talkToNpc(object);return true;}
  if(object.kind==="workbench"){openCraft("workbench");return true;}
  if(object.kind==="campfire"){openCraft("campfire");return true;}
  if(object.kind==="well"){api.showToast("Klares Wasser · Ausdauer vollständig erholt",1800);state.player.stamina=100;sound("water");return true;}
  if(object.kind==="desertWell"){api.showToast("Kühles Tiefenwasser · Hitze und Ausdauer erholt",2200);state.player.stamina=100;state.player.heat=0;sound("water");return true;}
  if(object.kind==="caravan"){
    if(!runtime.world.visited[object.id]){runtime.world.visited[object.id]=true;api.addInventoryItem("coin",4);api.addInventoryItem("lizardScale",2);showDialog("Verlorene Salzkarawane","Zwischen verhärteten Salzsäcken findest du Münzen, Echsenhaut und eine Karte zum Glasmeer. Frische Pfotenabdrücke warnen vor Schakalen.");saveNow("discovery");sound("discovery");}
    else api.showToast("Die Karawane ist leer · Schakalspuren führen nach Osten",1900);
    return true;
  }
  if(object.kind==="sunAltar"){
    state.player.heat=Math.max(0,(state.player.heat||0)-45);
    if(!runtime.world.visited[object.id]){runtime.world.visited[object.id]=true;api.addInventoryItem("arrow",6);showDialog("Altar aus Wüstenglas","Das schwarze Glas bleibt selbst in der Sonne kühl. In einer Nische liegen sechs unversehrte Jagdpfeile.");saveNow("discovery");sound("discovery");}
    else api.showToast("Das Wüstenglas zieht die Hitze aus deiner Ausrüstung",1900);
    return true;
  }
  if(object.kind==="hut"){enterInterior(object);return true;}
  if(object.kind==="fishRack"){api.showToast("Gesalzener Küstenfisch · Edda zählt jeden Fang",1800);return true;}
  if(object.kind==="netTable"){showDialog("Flicktisch","Jede Masche trägt einen andersfarbigen Knoten. Edda markiert damit Fanggebiet, Wetter und die Tiefe des Wassers.");return true;}
  if(object.kind==="noticeBoard"){showDialog("Treibholzer Anschläge","Mira teilt Nachtwachen ein. Borin sucht trockenes Holz. Taren warnt vor Banditen auf der gerodeten Kieslichtung. Ein kleiner Zettel fragt, wer nachts die Glocke aus der Bucht hört.");return true;}
  if(object.kind==="beachedBoat"){showDialog("Sturmboot Morgenkrähe","Der Kiel besteht aus dem gleichen dunklen Holz wie ein Balken in der Versammlungshalle. Edda hält das Boot trotz seines Alters jeden Morgen fahrtüchtig.");return true;}
  if(object.kind==="lootChest"){
    const coins=api.addInventoryItem("coin",object.camp?6:10);const bandages=api.addInventoryItem("fieldBandage",1);if(!coins&&!bandages){api.showToast("Der Rucksack ist voll · Truhe bleibt geschlossen",2200);return true;}runtime.world.opened[object.id]=true;api.showToast("Truhe geöffnet · "+coins+" Münzen"+(bandages?" und Feldverband":""),2400);sound("chest");saveNow("loot");return true;
  }
  if(object.kind==="cave"){
    if(!runtime.world.visited[object.id]){runtime.world.visited[object.id]=true;api.addInventoryItem("coin",5);api.addInventoryItem("bone",1);showDialog("Höhlenfund","Im Dunkel findest du alte Münzen, einen Knochen und Spuren eines tieferen Tunnels. Dahinter hat ein Felssturz den schmalen Gang verschlossen.");saveNow("discovery");sound("discovery");}
    else showDialog("Höhleneingang","Der erkundete Stollen endet am alten Felssturz. Feuchte Luft zieht durch einen Spalt aus der Tiefe.");
    return true;
  }
  if(object.kind==="banditTent"){api.showToast(object.camp===1?"Gestohlene Vorräte aus Treibholz liegen im Zelt.":"Auf Karten sind weitere Lager und Ruinen markiert.",2200);return true;}
  return true;
}

function collisionAt(x,y){
  for(const object of worldObjects){
    if(!object.solid) continue;
    let halfX=(object.halfWidth||object.radius||6)+PLAYER_RADIUS*.65,halfY=(object.halfHeight||object.radius||6)+PLAYER_RADIUS*.65;
    const editor=window.__ARCHIPELAGO_ASSET_EDITOR__;const assetId="prop_"+object.kind;const asset=editor?.pack?.assets?.[assetId];const definition=editor?.definitions?.[assetId];const size=propPixelSizes[object.kind];
    if(asset?.enabled&&definition&&size){halfX=Math.max(2,asset.meta.hitbox.width/definition.width*size[0]/VIEW_SCALE/2)+PLAYER_RADIUS*.65;halfY=Math.max(2,asset.meta.hitbox.height/definition.height*size[1]/VIEW_SCALE/2)+PLAYER_RADIUS*.65;}
    const dx=(x-object.x)/halfX,dy=(y-object.y)/halfY;if(dx*dx+dy*dy<1) return {type:"v015",object};
  }
  return null;
}

function directionVector(){const map={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};return map[state.player.dir]||[0,1];}
function dodge(){
  if(runtime.interior){if(state.player.stamina<12)return false;let [dx,dy]=directionVector();const nx=runtime.interior.x+dx*18,ny=runtime.interior.y+dy*18;if(interiorCanStand(nx,ny)){runtime.interior.x=nx;runtime.interior.y=ny;state.player.stamina-=12;state.player.walkTime+=1;sound("dodge");return true;}return false;}
  if(!state.running||state.paused||state.mapOpen||state.inventoryOpen||state.dead||runtime.roll||state.mountedHorseId||state.player.stamina<22) return false;
  let [dx,dy]=directionVector();let inputX=0,inputY=0;if(state.keys.has("a")) inputX--;if(state.keys.has("d")) inputX++;if(state.keys.has("w")) inputY--;if(state.keys.has("s")) inputY++;if(inputX||inputY){const length=Math.hypot(inputX,inputY);dx=inputX/length;dy=inputY/length;}
  state.player.stamina-=22;runtime.roll={time:0,duration:.30,dx,dy};sound("dodge");return true;
}
function updateRoll(dt){
  if(!runtime.roll) return;runtime.roll.time+=dt;const speed=106*(1-runtime.roll.time/runtime.roll.duration*.35);const steps=Math.max(1,Math.ceil(speed*dt/2));
  for(let i=0;i<steps;i++){const x=state.player.x+runtime.roll.dx*speed*dt/steps;const y=state.player.y+runtime.roll.dy*speed*dt/steps;if(api.canOccupy(x,y).ok){state.player.x=x;state.player.y=y;}else break;}
  state.player.moving=true;state.player.walkTime+=dt*4;if(runtime.roll.time>=runtime.roll.duration) runtime.roll=null;
}
function playerInvulnerable(){return !!runtime.roll;}
function playerArmor(){const equipped=api.inventoryItemById(state.inventory.equipment.body);return equipped?itemCatalog[equipped.itemId]?.armor||0:0;}
function banditCanOccupy(x,y){return api.isWalkable(x,y)&&api.canOccupy(x,y).ok;}

function banditTarget(reach){
  const [fx,fy]=directionVector();let best=null;
  for(const bandit of runtime.world.bandits){if(bandit.status!=="alive") continue;const dx=bandit.x-state.player.x,dy=bandit.y-state.player.y;const distance=Math.hypot(dx,dy);if(distance>reach) continue;const dot=(dx*fx+dy*fy)/(distance||1);if(dot<-.18) continue;const score=distance+(1-dot)*8;if(!best||score<best.score) best={bandit,score,distance};}
  return best;
}
function damageBandit(bandit,damage){
  bandit.health=Math.max(0,bandit.health-damage);bandit.hitFlash=.16;bandit.phase="hurt";bandit.timer=.18;runtime.hitStop=.065;runtime.shake=Math.max(runtime.shake,2.8);sound("hit");
  const [fx,fy]=directionVector();const nx=bandit.x+fx*5,ny=bandit.y+fy*5;if(banditCanOccupy(nx,ny)){bandit.x=nx;bandit.y=ny;}
  if(bandit.health<=0){bandit.status="dead";bandit.phase="dead";bandit.ySort=bandit.y+2;api.addInventoryItem("coin",3);api.showToast("Bandit besiegt · +3 Inselmünzen",1800);sound("defeat");advanceQuestFromInventory();saveNow("combat");}
  else api.showToast("Bandit · "+Math.ceil(bandit.health)+" / "+bandit.maxHealth,850);
}
function performPlayerStrike(itemId,damage){const reach=itemId==="huntingSpear"?38:25;const target=banditTarget(reach);if(!target) return false;damageBandit(target.bandit,damage);return true;}
function fireBow(definition){
  if(inventoryCount("arrow")<1){api.showToast("Keine Pfeile · stelle sie an der Werkbank her",1700);sound("empty");return true;}
  removeInventory("arrow",1);
  const [dx,dy]=directionVector();
  runtime.arrows.push({
    id:"arrow:"+(++runtime.arrowSerial),x:state.player.x+dx*9,y:state.player.y+dy*9,
    vx:dx*205,vy:dy*205,angle:Math.atan2(dy,dx),life:.86,damage:definition.animalDamage,ownerId:state.player.id
  });
  sound("bow");
  return true;
}
function useEquippedItem(item,definition){
  if(definition.action==="bowShot") return fireBow(definition);
  if(definition.action!=="spearThrust") return false;
  if(!performPlayerStrike(item.itemId,definition.animalDamage)){
    const target=api.findAnimalTarget?.(TILE_METERS*3.15);if(target) api.damageAnimal(target.animal,definition.animalDamage,item.itemId);
  }
  sound("swing","spear");return true;
}
function useConsumable(item,definition){
  if(!definition.consumable) return false;state.player.health=Math.min(100,state.player.health+(definition.heal||0));if(item.itemId==="fieldBandage") state.player.bleed={intensity:0,duration:0,tickCooldown:0,volume:0,trailDistance:0};if(item.itemId==="cookedGame") state.player.heat=Math.max(0,(state.player.heat||0)-18);removeInventory(item.itemId,1);api.showToast(definition.name+" benutzt · "+Math.ceil(state.player.health)+" Leben",1800);sound("heal");saveNow("item");return true;
}

function updateBandits(dt){
  if(state.paused||state.mapOpen||state.inventoryOpen||state.dead) return;
  for(const bandit of runtime.world.bandits){
    if(bandit.status!=="alive") continue;bandit.hitFlash=Math.max(0,bandit.hitFlash-dt);bandit.cooldown=Math.max(0,bandit.cooldown-dt);bandit.timer-=dt;const dx=state.player.x-bandit.x,dy=state.player.y-bandit.y;const distance=Math.hypot(dx,dy)||1;bandit.moving=false;
    if(bandit.phase==="hurt"){if(bandit.timer<=0) bandit.phase="idle";continue;}
    if(bandit.phase==="windup"){
      if(bandit.timer<=0){bandit.phase="attack";bandit.timer=.22;bandit.attackHit=false;const speed=78;bandit.vx=dx/distance*speed;bandit.vy=dy/distance*speed;sound("enemyAttack");}continue;
    }
    if(bandit.phase==="attack"){
      const nx=bandit.x+bandit.vx*dt,ny=bandit.y+bandit.vy*dt;if(banditCanOccupy(nx,ny)){bandit.x=nx;bandit.y=ny;bandit.moving=true;}
      if(!bandit.attackHit&&!playerInvulnerable()&&Math.hypot(state.player.x-bandit.x,state.player.y-bandit.y)<11){bandit.attackHit=true;const damage=Math.max(2,9-playerArmor());state.player.health=Math.max(0,state.player.health-damage);runtime.shake=3.5;runtime.hitStop=.045;api.showToast("Banditentreffer · -"+damage+" Leben",1000);sound("hurt");if(state.player.health<=0) api.killPlayer("Von Banditen niedergeschlagen");}
      if(bandit.timer<=0){bandit.phase="idle";bandit.cooldown=.9;}continue;
    }
    if(distance<24&&bandit.cooldown<=0){bandit.phase="windup";bandit.timer=.52;bandit.dir=Math.abs(dx)>Math.abs(dy)?dx>0?"right":"left":dy>0?"down":"up";continue;}
    if(distance<220){const speed=distance>75?19:12;const nx=bandit.x+dx/distance*speed*dt,ny=bandit.y+dy/distance*speed*dt;if(banditCanOccupy(nx,ny)){bandit.x=nx;bandit.y=ny;bandit.moving=true;bandit.gait+=dt*5;}bandit.dir=Math.abs(dx)>Math.abs(dy)?dx>0?"right":"left":dy>0?"down":"up";}
    else if(Math.hypot(bandit.x-bandit.homeX,bandit.y-bandit.homeY)>6){const hx=bandit.homeX-bandit.x,hy=bandit.homeY-bandit.y,length=Math.hypot(hx,hy)||1;const nx=bandit.x+hx/length*8*dt,ny=bandit.y+hy/length*8*dt;if(banditCanOccupy(nx,ny)){bandit.x=nx;bandit.y=ny;}}
    bandit.ySort=bandit.y;
  }
}

function updateArrows(dt){
  if(state.paused||state.mapOpen||state.inventoryOpen||state.dead) return;
  for(const arrow of runtime.arrows){
    arrow.life-=dt;
    if(arrow.life<=0) continue;
    const distance=Math.hypot(arrow.vx,arrow.vy)*dt;
    const steps=Math.max(1,Math.ceil(distance/5));
    for(let step=0;step<steps&&arrow.life>0;step++){
      arrow.x+=arrow.vx*dt/steps;arrow.y+=arrow.vy*dt/steps;
      if(api.collisionAt(arrow.x,arrow.y)){arrow.life=0;break;}
      let hit=false;
      for(const bandit of runtime.world.bandits){
        if(bandit.status!=="alive"||Math.hypot(arrow.x-bandit.x,arrow.y-bandit.y)>5.4) continue;
        damageBandit(bandit,arrow.damage);hit=true;break;
      }
      if(hit){arrow.life=0;break;}
      for(const animal of api.activeAnimalsNear(arrow.x,arrow.y,15)){
        const meta=animalCatalog[animal.species];
        if(!meta||meta.invulnerable||animal.status!=="alive"||Math.hypot(arrow.x-animal.x,arrow.y-animal.y)>meta.radius+1.4) continue;
        api.damageAnimal(animal,arrow.damage,"huntingBow");hit=true;break;
      }
      if(hit){arrow.life=0;break;}
    }
  }
  runtime.arrows=runtime.arrows.filter((arrow)=>arrow.life>0);
}

function updateAnimalSocial(animal,dt,distance){
  if(animal.status!=="alive"||animal.species==="crow"||state.elapsed<(animal.nextSocialCheckAt||0)) return;
  animal.nextSocialCheckAt=state.elapsed+.42+(animal.id.length%7)*.025;
  if(animalCatalog[animal.species]?.hostile&&distance<72){
    const wounded=api.activeAnimalsNear(animal.x,animal.y,48).some((other)=>other.species===animal.species&&other.health<other.maxHealth*.8);
    if(wounded) animal.aggressionUntil=Math.max(animal.aggressionUntil,state.elapsed+4.5);
  }
}
function onAnimalDamaged(animal,damage,itemId){
  runtime.hitStop=.045;runtime.shake=Math.max(runtime.shake,animal.species==="horse"?3:2);sound(animal.health<=0?"defeat":"hit",animal.species);
  for(const other of api.activeAnimalsNear(animal.x,animal.y,animalCatalog[animal.species]?.hostile?58:44)){
    if(other===animal||other.species!==animal.species||other.status!=="alive") continue;
    if(animalCatalog[animal.species]?.hostile) other.aggressionUntil=Math.max(other.aggressionUntil,state.elapsed+7);
    else other.fleeUntil=Math.max(other.fleeUntil,state.elapsed+6);
    other.heading=Math.atan2(other.y-state.player.y,other.x-state.player.x);
  }
  advanceQuestFromInventory();
}

function worldToScreen(x,y,camX,camY){return {x:(x-camX)*VIEW_SCALE+canvas.width/2,y:(y-camY)*VIEW_SCALE+canvas.height/2};}
function drawGround(camX,camY){
  if(runtime.interior) return;const village=worldToScreen(START.x,START.y,camX,camY);const camp=worldToScreen(BANDIT_CAMP_ONE.x,BANDIT_CAMP_ONE.y,camX,camY);ctx.save();ctx.globalAlpha=.46;
  ctx.fillStyle="#8e784f";ctx.beginPath();ctx.ellipse(Math.round(village.x),Math.round(village.y-5),145,92,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#b09a69";ctx.fillRect(Math.round(village.x-155),Math.round(village.y-7),310,15);ctx.fillRect(Math.round(village.x-7),Math.round(village.y-145),14,245);
  ctx.globalAlpha=.64;ctx.fillStyle="#725f42";ctx.beginPath();ctx.ellipse(Math.round(camp.x),Math.round(camp.y+8),132,84,-.08,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.32;ctx.fillStyle="#b79a63";for(let i=0;i<18;i++){const angle=i*2.39;ctx.fillRect(Math.round(camp.x+Math.cos(angle)*(28+i*5%102)),Math.round(camp.y+Math.sin(angle)*(20+i*3%66)),5+i%7,2+i%3);}
  for(const object of worldObjects.filter((entry)=>entry.kind==="campfire")){const p=worldToScreen(object.x,object.y,camX,camY);if(p.x<-50||p.y<-50||p.x>canvas.width+50||p.y>canvas.height+50) continue;ctx.fillStyle="rgba(255,151,55,.12)";const size=28+Math.sin(state.elapsed*5+object.x)*3;ctx.fillRect(Math.round(p.x-size),Math.round(p.y-size*.45),Math.round(size*2),Math.round(size*.9));}
  ctx.restore();
}
function fallbackNpc(entity,x,y,scale=2){const profile=npcProfiles[entity.variant]||{skin:"#a86f45",hair:"#302721",hairStyle:"undercut",beardStyle:"stubble",shirt:"#6c4337",cloak:"#2f3437",outfit:"raider",visibleArmor:entity.kind==="bandit"?"guardArmor":null};const player={...state.player,...profile,id:entity.id,name:"",x:entity.x,y:entity.y,dir:entity.dir||"down",moving:!!entity.moving,walkTime:entity.gait||0,actionType:null,actionProgress:0,heldItem:entity.heldItem||null,visibleArmor:entity.visibleArmor||profile.visibleArmor};api.drawCharacter(ctx,x,y,player,scale,false);}
function drawQuestTargetFloat(object,p,height=58){const target=questTarget();if(!target||target.id!==object.id||runtime.interior) return;const y=Math.round(p.y-height+Math.sin(state.elapsed*4)*3);ctx.save();ctx.translate(Math.round(p.x),y);ctx.rotate(Math.PI/4);ctx.fillStyle="#31250f";ctx.strokeStyle="#f2cc69";ctx.lineWidth=2;ctx.fillRect(-9,-9,18,18);ctx.strokeRect(-9,-9,18,18);ctx.rotate(-Math.PI/4);ctx.fillStyle="#fff0af";ctx.font="bold 15px Georgia";ctx.textAlign="center";ctx.fillText(target.markerGlyph||"!",0,5);ctx.restore();}
function drawNpc(object,camX,camY){if(object.indoor)return;const p=worldToScreen(object.x,object.y,camX,camY);const entity={id:object.id,variant:object.variant,dir:object.dir||"down",moving:!!object.moving,gait:object.gait||0,talking:!$("dialogOverlay")?.classList.contains("hidden"),visibleArmor:npcProfiles[object.variant]?.visibleArmor,heldItem:object.variant==="taren"?"huntingSpear":null};const assetId="npc_"+object.variant;const editor=window.__ARCHIPELAGO_ASSET_EDITOR__;if(!editor?.drawArtistSpriteOverride(assetId,entity,ctx,p.x,p.y)) fallbackNpc({...entity,kind:"npc",x:object.x,y:object.y},p.x,p.y);ctx.fillStyle="#f2dfae";ctx.font="10px Georgia";ctx.textAlign="center";ctx.fillText(npcProfiles[object.variant]?.name||object.variant,Math.round(p.x),Math.round(p.y-54));drawQuestTargetFloat(object,p,72);}
function drawBandit(bandit,camX,camY){const p=worldToScreen(bandit.x,bandit.y,camX,camY);const editor=window.__ARCHIPELAGO_ASSET_EDITOR__;if(!editor?.drawArtistSpriteOverride("bandit",bandit,ctx,p.x,p.y)){if(bandit.status==="dead"){ctx.fillStyle="rgba(17,20,20,.28)";ctx.fillRect(Math.round(p.x-22),Math.round(p.y-5),44,7);ctx.fillStyle="#49312d";ctx.fillRect(Math.round(p.x-17),Math.round(p.y-12),34,10);ctx.fillStyle="#a86f45";ctx.fillRect(Math.round(p.x+10),Math.round(p.y-13),10,9);}else fallbackNpc({...bandit,kind:"bandit",variant:"bandit",visibleArmor:bandit.id.endsWith(":2")?"guardArmor":"paddedVest",heldItem:"ironSword"},p.x,p.y);}if(bandit.status==="alive"){ctx.fillStyle="#241516";ctx.fillRect(Math.round(p.x-15),Math.round(p.y-56),30,4);ctx.fillStyle=bandit.phase==="windup"?"#f0b85c":"#b34d48";ctx.fillRect(Math.round(p.x-14),Math.round(p.y-55),Math.round(28*bandit.health/bandit.maxHealth),2);if(bandit.phase==="windup"){ctx.strokeStyle="#edc66d";ctx.strokeRect(Math.round(p.x-18),Math.round(p.y-18),36,10);}}}
function drawProp(object,camX,camY){
  if(object.kind==="npc"){drawNpc(object,camX,camY);return;}const p=worldToScreen(object.x,object.y,camX,camY);const editor=window.__ARCHIPELAGO_ASSET_EDITOR__;const assetId=["workbench","campfire","well","hut","cave","banditTent","lootChest","desertWell","caravan","sunAltar"].includes(object.kind)?"prop_"+object.kind:null;
  const size=object.pixelSize||propPixelSizes[object.kind]||[48,32];
  const propAnimation=object.kind==="campfire"?"burn":object.kind==="sunAltar"?"glow":object.kind==="desertWell"?"water":runtime.world.opened[object.id]?"open":"idle";
  if(object.kind==="hut"&&houseSprites[object.id]?.complete&&houseSprites[object.id].naturalWidth){ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle="rgba(2,8,7,.34)";ctx.fillRect(Math.round(p.x-size[0]*.43),Math.round(p.y-9),Math.round(size[0]*.86),9);ctx.drawImage(houseSprites[object.id],Math.round(p.x-size[0]/2),Math.round(p.y-size[1]),size[0],size[1]);ctx.restore();drawQuestTargetFloat(object,p,size[1]+17);return;}
  if(assetId&&object.kind!=="hut"&&editor?.drawArtistSizedOverride(assetId,ctx,p.x-size[0]/2,p.y-size[1],size[0],size[1],{animation:propAnimation})){drawQuestTargetFloat(object,p,size[1]+17);return;}
  if(object.kind==="workbench"){ctx.fillStyle="#5d3d26";ctx.fillRect(Math.round(p.x-20),Math.round(p.y-13),40,13);ctx.fillStyle="#a97746";ctx.fillRect(Math.round(p.x-22),Math.round(p.y-18),44,7);ctx.fillStyle="#3e2a1e";ctx.fillRect(Math.round(p.x-17),Math.round(p.y),5,17);ctx.fillRect(Math.round(p.x+12),Math.round(p.y),5,17);}
  else if(object.kind==="campfire"){ctx.fillStyle="#4c3326";ctx.fillRect(Math.round(p.x-12),Math.round(p.y+3),24,5);ctx.fillStyle="#e15b2d";ctx.fillRect(Math.round(p.x-7),Math.round(p.y-13),14,16);ctx.fillStyle="#ffd36b";ctx.fillRect(Math.round(p.x-3),Math.round(p.y-18-Math.sin(state.elapsed*9)*3),7,14);}
  else if(object.kind==="well"){ctx.fillStyle="#555b57";ctx.fillRect(Math.round(p.x-17),Math.round(p.y-10),34,22);ctx.fillStyle="#8b8d82";ctx.fillRect(Math.round(p.x-20),Math.round(p.y-15),40,8);ctx.fillStyle="#18343c";ctx.fillRect(Math.round(p.x-12),Math.round(p.y-11),24,7);}
  else if(object.kind==="hut"){ctx.fillStyle="#725138";ctx.fillRect(Math.round(p.x-32),Math.round(p.y-38),64,41);ctx.fillStyle="#345a59";ctx.fillRect(Math.round(p.x-38),Math.round(p.y-58),76,22);ctx.fillStyle="#35251e";ctx.fillRect(Math.round(p.x-7),Math.round(p.y-22),14,25);}
  else if(object.kind==="fishRack"){ctx.fillStyle="#4b3425";ctx.fillRect(Math.round(p.x-24),Math.round(p.y-26),4,30);ctx.fillRect(Math.round(p.x+20),Math.round(p.y-26),4,30);ctx.fillRect(Math.round(p.x-25),Math.round(p.y-27),50,4);for(let i=0;i<4;i++){ctx.fillStyle=i%2?"#bd7546":"#b6a66f";ctx.fillRect(Math.round(p.x-17+i*10),Math.round(p.y-20+i%2*3),5,17);ctx.fillStyle="#d5cfac";ctx.fillRect(Math.round(p.x-19+i*10),Math.round(p.y-18+i%2*3),2,3);}}
  else if(object.kind==="netTable"){ctx.fillStyle="#5c3e29";ctx.fillRect(Math.round(p.x-21),Math.round(p.y-13),42,12);ctx.fillRect(Math.round(p.x-17),Math.round(p.y-1),4,14);ctx.fillRect(Math.round(p.x+13),Math.round(p.y-1),4,14);ctx.strokeStyle="#c9b88b";ctx.lineWidth=1;for(let i=-15;i<16;i+=6){ctx.beginPath();ctx.moveTo(p.x+i,p.y-12);ctx.lineTo(p.x+i+8,p.y-2);ctx.stroke();}}
  else if(object.kind==="noticeBoard"){ctx.fillStyle="#4b321f";ctx.fillRect(Math.round(p.x-18),Math.round(p.y-30),36,27);ctx.fillRect(Math.round(p.x-13),Math.round(p.y-3),4,18);ctx.fillRect(Math.round(p.x+9),Math.round(p.y-3),4,18);ctx.fillStyle="#c9b983";ctx.fillRect(Math.round(p.x-13),Math.round(p.y-25),12,15);ctx.fillRect(Math.round(p.x+3),Math.round(p.y-21),10,12);ctx.fillStyle="#7a3d2e";ctx.fillRect(Math.round(p.x-4),Math.round(p.y-13),7,7);}
  else if(object.kind==="beachedBoat"){ctx.fillStyle="rgba(4,9,8,.3)";ctx.fillRect(Math.round(p.x-38),Math.round(p.y),76,8);ctx.fillStyle="#503424";ctx.beginPath();ctx.moveTo(p.x-38,p.y-14);ctx.lineTo(p.x+34,p.y-18);ctx.lineTo(p.x+25,p.y+3);ctx.lineTo(p.x-27,p.y+3);ctx.fill();ctx.fillStyle="#9a7044";ctx.fillRect(Math.round(p.x-26),Math.round(p.y-14),49,4);ctx.fillRect(Math.round(p.x-15),Math.round(p.y-6),34,3);}
  else if(object.kind==="lanternPost"){ctx.fillStyle="#4c3324";ctx.fillRect(Math.round(p.x-2),Math.round(p.y-34),4,38);ctx.fillStyle="#d7a345";ctx.fillRect(Math.round(p.x-6),Math.round(p.y-35),12,13);ctx.fillStyle="#ffe28a";ctx.fillRect(Math.round(p.x-3),Math.round(p.y-32),6,7);ctx.fillStyle="rgba(255,196,91,.11)";ctx.fillRect(Math.round(p.x-18),Math.round(p.y-47),36,34);}
  else if(object.kind==="bench"){ctx.fillStyle="#62442d";ctx.fillRect(Math.round(p.x-20),Math.round(p.y-12),40,7);ctx.fillRect(Math.round(p.x-16),Math.round(p.y-5),4,13);ctx.fillRect(Math.round(p.x+12),Math.round(p.y-5),4,13);}
  else if(object.kind==="banditTent"){ctx.fillStyle="#4b3430";ctx.fillRect(Math.round(p.x-27),Math.round(p.y-23),54,30);ctx.fillStyle="#7b4b3e";ctx.beginPath();ctx.moveTo(p.x-31,p.y-22);ctx.lineTo(p.x,p.y-54);ctx.lineTo(p.x+31,p.y-22);ctx.fill();ctx.fillStyle="#21191a";ctx.fillRect(Math.round(p.x-7),Math.round(p.y-24),14,31);}
  else if(object.kind==="cave"){ctx.fillStyle="#454b4b";ctx.fillRect(Math.round(p.x-34),Math.round(p.y-30),68,35);ctx.fillStyle="#171e21";ctx.fillRect(Math.round(p.x-20),Math.round(p.y-36),40,42);ctx.fillStyle="#090f12";ctx.fillRect(Math.round(p.x-13),Math.round(p.y-30),26,36);}
  else if(object.kind==="desertWell"){ctx.fillStyle="#604238";ctx.fillRect(Math.round(p.x-21),Math.round(p.y-10),42,22);ctx.fillStyle="#a36a47";ctx.fillRect(Math.round(p.x-24),Math.round(p.y-15),48,8);ctx.fillStyle="#173c47";ctx.fillRect(Math.round(p.x-14),Math.round(p.y-11),28,7);ctx.fillStyle="#493127";ctx.fillRect(Math.round(p.x-20),Math.round(p.y-38),4,27);ctx.fillRect(Math.round(p.x+16),Math.round(p.y-38),4,27);ctx.fillRect(Math.round(p.x-18),Math.round(p.y-39),36,4);ctx.fillStyle="#c9b071";ctx.fillRect(Math.round(p.x-2),Math.round(p.y-37),4,18);}
  else if(object.kind==="caravan"){ctx.fillStyle="rgba(18,13,10,.27)";ctx.fillRect(Math.round(p.x-34),Math.round(p.y),68,9);ctx.fillStyle="#6e4930";ctx.fillRect(Math.round(p.x-28),Math.round(p.y-29),56,28);ctx.fillStyle="#a87847";ctx.fillRect(Math.round(p.x-25),Math.round(p.y-34),50,10);ctx.fillStyle="#3c2a22";ctx.fillRect(Math.round(p.x-30),Math.round(p.y-5),15,15);ctx.fillRect(Math.round(p.x+15),Math.round(p.y-5),15,15);ctx.fillStyle="#c7a46b";ctx.fillRect(Math.round(p.x-11),Math.round(p.y-29),22,11);ctx.fillStyle="#52372b";ctx.fillRect(Math.round(p.x-4),Math.round(p.y-35),8,36);}
  else if(object.kind==="sunAltar"){ctx.fillStyle="rgba(20,10,8,.30)";ctx.fillRect(Math.round(p.x-24),Math.round(p.y),48,8);ctx.fillStyle="#5a3634";ctx.fillRect(Math.round(p.x-20),Math.round(p.y-17),40,21);ctx.fillStyle="#a05c42";ctx.fillRect(Math.round(p.x-15),Math.round(p.y-45),30,30);ctx.fillStyle="#1c2022";ctx.fillRect(Math.round(p.x-8),Math.round(p.y-38),16,17);ctx.fillStyle="#d8914d";ctx.fillRect(Math.round(p.x-3),Math.round(p.y-32),6,6);ctx.fillStyle="rgba(255,195,92,.18)";ctx.fillRect(Math.round(p.x-24),Math.round(p.y-52),48,44);}
  else if(object.kind==="lootChest"&&!runtime.world.opened[object.id]){ctx.fillStyle="#4f301f";ctx.fillRect(Math.round(p.x-14),Math.round(p.y-10),28,18);ctx.fillStyle="#a67336";ctx.fillRect(Math.round(p.x-15),Math.round(p.y-13),30,7);ctx.fillStyle="#d7b85b";ctx.fillRect(Math.round(p.x-2),Math.round(p.y-7),5,7);}
  drawQuestTargetFloat(object,p,size[1]+17);
}
function drawArrow(arrow,camX,camY){
  const p=worldToScreen(arrow.x,arrow.y,camX,camY);ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y));ctx.rotate(arrow.angle);
  const editor=window.__ARCHIPELAGO_ASSET_EDITOR__;
  if(!editor?.drawArtistStaticOverride("item_arrow",ctx,0,4,{animation:"flight",pixelSize:1.5})){
    ctx.fillStyle="#87603a";ctx.fillRect(-9,-1,17,2);ctx.fillStyle="#d8d1ba";ctx.fillRect(-9,-3,4,2);ctx.fillRect(-9,1,4,2);ctx.fillStyle="#d9e0dc";ctx.fillRect(7,-2,4,4);
  }
  ctx.restore();
}
function renderables(left,top,right,bottom){if(runtime.interior)return[];const result=[];for(const object of worldObjects){if(object.kind==="npc"&&object.indoor)continue;if(object.kind==="lootChest"&&runtime.world.opened[object.id]) continue;if(object.x<left-100||object.x>right+100||object.y<top-110||object.y>bottom+100) continue;result.push({kind:"object",object,y:object.y});}for(const bandit of runtime.world.bandits){if(bandit.x<left-60||bandit.x>right+60||bandit.y<top-60||bandit.y>bottom+60) continue;result.push({kind:"bandit",bandit,y:bandit.ySort||bandit.y});}for(const arrow of runtime.arrows){if(arrow.x<left-20||arrow.x>right+20||arrow.y<top-20||arrow.y>bottom+20) continue;result.push({kind:"arrow",arrow,y:arrow.y});}return result;}
function drawRenderable(renderable,camX,camY){if(renderable.kind==="bandit") drawBandit(renderable.bandit,camX,camY);else if(renderable.kind==="arrow") drawArrow(renderable.arrow,camX,camY);else drawProp(renderable.object,camX,camY);}

function weatherType(){
  const biome=api.terrainAt(state.player.x,state.player.y).biome;
  const cycle=Math.floor((state.elapsed+runtime.world.weatherSeed)/75)%7;
  if(["snow","glacier","tundra","packIce"].includes(biome)) return cycle<4?"snow":cycle===4?"fog":"clear";
  if(DESERT_BIOMES.includes(biome)) return cycle===2?"sandstorm":cycle===3?"dust":cycle===0?"heatHaze":"clear";
  if(biome==="beach") return cycle===2||cycle===3?"dust":"clear";
  if(["forest","jungle","swamp","plains"].includes(biome)) return cycle===1||cycle===2?"rain":cycle===3?"storm":cycle===5?"fog":"clear";
  return cycle===3?"rain":"clear";
}
function updateDesertExposure(dt){
  if(runtime.interior||state.paused||state.mapOpen||state.inventoryOpen||state.dead) return;
  state.player.heat=Number.isFinite(state.player.heat)?state.player.heat:0;
  const terrain=api.terrainAt(state.player.x,state.player.y);
  const hour=(8+state.elapsed/120)%24;
  const currentWeather=weatherType();
  const hotDay=DESERT_BIOMES.includes(terrain.biome)&&hour>=9.5&&hour<=18.5;
  const nearbyShade=worldObjects.some((object)=>["desertWell","caravan","sunAltar"].includes(object.kind)&&Math.hypot(object.x-state.player.x,object.y-state.player.y)<30);
  if(hotDay&&!nearbyShade){
    const gain=.28+(state.player.moving?.10:0)+(currentWeather==="sandstorm"?.28:currentWeather==="heatHaze"?.08:0);
    state.player.heat=Math.min(100,state.player.heat+dt*gain);
  }else state.player.heat=Math.max(0,state.player.heat-dt*(terrain.biome==="oasis"?.9:nearbyShade?.65:.34));
  if(state.player.heat>72) state.player.stamina=Math.max(0,state.player.stamina-dt*(state.player.heat>92?1.1:.42));
  if(state.player.heat>96){
    state.player.health=Math.max(0,state.player.health-dt*.38);
    if(state.elapsed>(runtime.heatWarnAt||0)){runtime.heatWarnAt=state.elapsed+7;api.showToast("Hitzschlag · suche Wasser oder Schatten",2300);}
    if(state.player.health<=0) api.killPlayer("In der Wüstenhitze zusammengebrochen");
  }
  const indicator=$("desertHeatIndicator");
  if(indicator){
    const visible=DESERT_BIOMES.includes(terrain.biome)&&(state.player.heat>8||hotDay);
    indicator.classList.toggle("hidden",!visible);
    const signature=Math.round(state.player.heat)+":"+currentWeather;
    if(visible&&signature!==runtime.heatUiSignature){runtime.heatUiSignature=signature;indicator.textContent="☀ HITZE "+Math.round(state.player.heat)+"% · "+(currentWeather==="sandstorm"?"SANDSTURM":currentWeather==="dust"?"STAUBWIND":currentWeather==="heatHaze"?"FLIMMERN":"TROCKEN");}
  }
}
function desertMovementMultiplier(){return (weatherType()==="sandstorm"?.82:1)*((state.player.heat||0)>92?.90:1);}
function drawInterior(){
  const room=interiorRoom();if(!room)return;const scale=Math.max(1,Math.min(5,Math.floor(Math.min((canvas.width-24)/room.width,(canvas.height-46)/room.height))));const ox=Math.round((canvas.width-room.width*scale)/2),oy=Math.round((canvas.height-room.height*scale)/2+8);const sx=(x)=>Math.round(ox+x*scale),sy=(y)=>Math.round(oy+y*scale);
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle="#02090b";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#142025";ctx.fillRect(sx(0),sy(0),room.width*scale,room.height*scale);
  for(let y=8;y<room.height-7;y+=6){ctx.fillStyle=(Math.floor(y/6)%2?"#745238":"#68472f");ctx.fillRect(sx(8),sy(y),Math.round((room.width-16)*scale),Math.max(2,Math.round(5.5*scale)));ctx.fillStyle="#9b724b";for(let x=12+(y%12);x<room.width-10;x+=24)ctx.fillRect(sx(x),sy(y+1),Math.max(1,scale),Math.max(1,scale));}
  ctx.fillStyle="#2b211d";ctx.fillRect(sx(3),sy(3),Math.round((room.width-6)*scale),Math.round(8*scale));ctx.fillRect(sx(3),sy(3),Math.round(8*scale),Math.round((room.height-6)*scale));ctx.fillRect(sx(room.width-11),sy(3),Math.round(8*scale),Math.round((room.height-6)*scale));ctx.fillStyle="#8d6845";for(let x=9;x<room.width-8;x+=18)ctx.fillRect(sx(x),sy(4),Math.round(3*scale),Math.round(8*scale));
  const rugColor=room.id==="hall"?"#315c62":room.id==="fisher"?"#3e6762":"#6b4b36";ctx.fillStyle=rugColor;const rugW=room.id==="hall"?82:58;ctx.fillRect(sx(room.width/2-rugW/2),sy(room.height-32),Math.round(rugW*scale),Math.round(19*scale));ctx.fillStyle="#d1ad61";ctx.fillRect(sx(room.width/2-rugW/2),sy(room.height-32),Math.round(rugW*scale),Math.max(1,scale));
  const drawBed=(bed)=>{ctx.fillStyle="#4d3427";ctx.fillRect(sx(bed.x-15),sy(bed.y-8),Math.round(30*scale),Math.round(21*scale));ctx.fillStyle="#c9b68d";ctx.fillRect(sx(bed.x-12),sy(bed.y-6),Math.round(24*scale),Math.round(6*scale));ctx.fillStyle="#49636a";ctx.fillRect(sx(bed.x-12),sy(bed.y),Math.round(24*scale),Math.round(10*scale));};for(const bed of room.beds)drawBed(bed);
  if(room.id==="fisher"){ctx.fillStyle="#8d6845";ctx.fillRect(sx(118),sy(17),Math.round(45*scale),Math.round(28*scale));ctx.fillStyle="#1b2525";ctx.fillRect(sx(126),sy(20),Math.round(29*scale),Math.round(20*scale));ctx.fillStyle="#e28b45";ctx.fillRect(sx(137),sy(27),Math.round(8*scale),Math.round(8*scale));ctx.strokeStyle="#cabb91";for(let x=19;x<55;x+=6){ctx.beginPath();ctx.moveTo(sx(x),sy(72));ctx.lineTo(sx(x+8),sy(94));ctx.stroke();}}
  if(room.id==="store"){ctx.fillStyle="#553923";for(const [x,y] of [[16,54],[137,50],[137,73],[17,80]]){ctx.fillRect(sx(x),sy(y),Math.round(28*scale),Math.round(18*scale));ctx.fillStyle="#9d7447";ctx.fillRect(sx(x+3),sy(y+3),Math.round(22*scale),Math.max(1,scale));ctx.fillStyle="#553923";}ctx.fillStyle="#6b472b";ctx.fillRect(sx(43),sy(34),Math.round(50*scale),Math.round(13*scale));ctx.fillStyle="#c19b5a";ctx.fillRect(sx(46),sy(35),Math.round(44*scale),Math.round(3*scale));}
  if(room.id==="hall"){ctx.fillStyle="#4d3325";ctx.fillRect(sx(72),sy(66),Math.round(66*scale),Math.round(28*scale));ctx.fillStyle="#9c7149";ctx.fillRect(sx(69),sy(67),Math.round(72*scale),Math.round(7*scale));ctx.fillStyle="#272321";ctx.fillRect(sx(83),sy(29),Math.round(44*scale),Math.round(25*scale));ctx.fillStyle="#da7136";ctx.fillRect(sx(95),sy(35),Math.round(20*scale),Math.round(14*scale));ctx.fillStyle="#ffd071";ctx.fillRect(sx(101),sy(35),Math.round(8*scale),Math.round(10*scale));ctx.fillStyle="#5b3e28";ctx.fillRect(sx(163),sy(66),Math.round(31*scale),Math.round(28*scale));ctx.fillStyle="#ccb983";ctx.fillRect(sx(169),sy(70),Math.round(9*scale),Math.round(12*scale));ctx.fillRect(sx(181),sy(75),Math.round(8*scale),Math.round(11*scale));}
  ctx.fillStyle="#1b1512";ctx.fillRect(sx(room.door.x-10),sy(room.height-10),Math.round(20*scale),Math.round(10*scale));ctx.fillStyle="#d2aa59";ctx.fillRect(sx(room.door.x-2),sy(room.height-8),Math.round(4*scale),Math.round(3*scale));
  for(const station of room.stations){const near=Math.hypot(runtime.interior.x-station.x,runtime.interior.y-station.y)<15;if(!near)continue;ctx.strokeStyle="#f0c969";ctx.lineWidth=Math.max(1,scale);ctx.strokeRect(sx(station.x-8),sy(station.y-8),Math.round(16*scale),Math.round(16*scale));}
  const indoorNpcs=worldObjects.filter((entry)=>entry.kind==="npc"&&entry.indoor===room.id).sort((a,b)=>a.indoorY-b.indoorY);for(const npc of indoorNpcs){const px=sx(npc.indoorX),py=sy(npc.indoorY);if(npc.pose==="sleep"){ctx.save();ctx.translate(px,py);ctx.rotate(Math.PI/2);fallbackNpc({...npc,moving:false,dir:"right"},0,0,Math.max(2,Math.round(scale*.7)));ctx.restore();ctx.fillStyle="#e6d99e";ctx.font=Math.max(9,scale*3)+"px Georgia";ctx.fillText("z",px+8*scale,py-5*scale);}else fallbackNpc({...npc,moving:false,dir:npc.pose==="eat"?"up":"down"},px,py,Math.max(2,Math.round(scale*.7)));
    ctx.fillStyle="#f0dfad";ctx.font=Math.max(8,scale*2)+"px Georgia";ctx.textAlign="center";ctx.fillText(npcProfiles[npc.variant].name,px,py-17*Math.max(2,Math.round(scale*.7)));
  }
  api.drawCharacter(ctx,sx(runtime.interior.x),sy(runtime.interior.y),state.player,Math.max(2,Math.round(scale*.72)),true);ctx.restore();
}
function drawOverlay(){
  if(runtime.interior){drawInterior();return;}
  const weather=weatherType();const t=state.elapsed;
  if(weather==="rain"||weather==="storm"){ctx.save();ctx.strokeStyle=weather==="storm"?"rgba(190,218,220,.5)":"rgba(179,210,211,.35)";ctx.lineWidth=1;const count=Math.round((weather==="storm"?90:55)*runtime.renderDensity);for(let i=0;i<count;i++){const x=(i*83+t*270)% (canvas.width+60)-30;const y=(i*47+t*430)% (canvas.height+60)-30;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-8,y+20);ctx.stroke();}if(weather==="storm"&&Math.floor(t*2)%23===0){ctx.fillStyle="rgba(220,238,236,.15)";ctx.fillRect(0,0,canvas.width,canvas.height);}ctx.restore();}
  else if(weather==="snow"){ctx.fillStyle="rgba(239,247,241,.7)";for(let i=0;i<Math.round(48*runtime.renderDensity);i++){const x=(i*71+t*18)%canvas.width,y=(i*43+t*(28+i%5))%canvas.height;ctx.fillRect(Math.round(x),Math.round(y),i%7===0?3:2,i%7===0?3:2);}}
  else if(weather==="dust"){ctx.fillStyle="rgba(201,156,85,.16)";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="rgba(233,193,118,.28)";for(let i=0;i<Math.round(38*runtime.renderDensity);i++){const x=(i*91+t*74)%canvas.width,y=(i*37+t*8)%canvas.height;ctx.fillRect(Math.round(x),Math.round(y),8+i%9,1);}}
  else if(weather==="sandstorm"){ctx.fillStyle="rgba(157,103,53,.25)";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="rgba(240,194,112,.42)";for(let i=0;i<Math.round(82*runtime.renderDensity);i++){const x=(i*97+t*230)%(canvas.width+130)-65,y=(i*41+t*21)%canvas.height;ctx.fillRect(Math.round(x),Math.round(y),18+i%24,i%9===0?2:1);}ctx.fillStyle="rgba(94,55,35,.08)";for(let band=0;band<4;band++){const x=((band*290+t*55)%(canvas.width+420))-210;ctx.fillRect(Math.round(x),band*145,260,74);}}
  else if(weather==="heatHaze"){ctx.fillStyle="rgba(236,178,88,.055)";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="rgba(255,226,158,.07)";for(let i=0;i<7;i++){const y=70+i*92+Math.sin(t*1.7+i)*7;ctx.fillRect(0,Math.round(y),canvas.width,3);}}
  else if(weather==="fog"){ctx.fillStyle="rgba(182,202,195,.13)";ctx.fillRect(0,0,canvas.width,canvas.height);for(let i=0;i<5;i++){const x=((i*240+t*12)%(canvas.width+360))-180;ctx.fillStyle="rgba(207,221,215,.08)";ctx.fillRect(Math.round(x),80+i*95,330,54);}}
  const hour=(8+state.elapsed/120)%24;const night=hour<5?.46:hour<7?(7-hour)*.19:hour>21?.46:hour>18?(hour-18)*.13:0;if(night>0){ctx.fillStyle="rgba(5,13,35,"+Math.min(.48,night)+")";ctx.fillRect(0,0,canvas.width,canvas.height);}
}

function frameDt(dt){if(runtime.hitStop>0){runtime.hitStop=Math.max(0,runtime.hitStop-dt);return dt*.07;}return dt;}
function cameraOffset(){if(runtime.shake<=0) return {x:0,y:0};return {x:(Math.random()-.5)*runtime.shake,y:(Math.random()-.5)*runtime.shake};}
function update(dt,realDt){
  if(!state.running) return;runtime.world.playSeconds+=realDt;runtime.autosave+=realDt;runtime.saveFlash=Math.max(0,runtime.saveFlash-realDt);runtime.shake=Math.max(0,runtime.shake-realDt*10);runtime.frameTime=runtime.frameTime*.94+realDt*.06;runtime.renderDensity=runtime.frameTime>.03 ? .55 : runtime.frameTime>.022 ? .76 : 1;updateNpcSchedules(dt);if(!runtime.interior){updateRoll(dt);updateBandits(dt);updateArrows(dt);updateDesertExposure(dt);}advanceQuestFromInventory();
  updateQuestMarker();
  const indicator=$("autosaveIndicator");if(indicator) indicator.classList.toggle("hidden",runtime.saveFlash<=0);
  if(runtime.autosave>=AUTOSAVE_SECONDS){runtime.autosave=0;saveNow("auto");}
  if(Math.floor(runtime.world.playSeconds)%20===0&&Math.floor((runtime.world.playSeconds-realDt))%20!==0) sound(weatherType()==="rain"?"rain":"ambient");
}

function serializeTrees(){const entries=[];for(const physics of treePhysicsStates.values()) if(physics.status!=="standing") entries.push({gx:physics.tree.gx,gy:physics.tree.gy,status:physics.status,health:physics.health,maxHealth:physics.maxHealth,fallDirection:physics.fallDirection,fallProgress:physics.fallProgress,splitHits:physics.splitHits,segments:physics.segments,woodPieces:clone(physics.woodPieces)});return entries;}
function serializeAnimals(){const entries=[];for(const animal of animalStates.values()){const meta=animalCatalog[animal.species];if(!meta||animal.species==="crow"||animal.status==="alive"&&!animal.owned&&animal.health===animal.maxHealth) continue;const copy=clone(animal);delete copy.associatedTree;entries.push(copy);}return entries.slice(-180);}
function snapshot(){return {version:SAVE_VERSION,savedAt:new Date().toISOString(),slot:runtime.activeSlot,elapsed:state.elapsed,player:clone(state.player),lastSafe:clone(state.lastSafe),inventory:clone(state.inventory),inventorySerial:state.inventorySerial,trees:serializeTrees(),animals:serializeAnimals(),starterHorseId:state.starterHorseId,mountedHorseId:state.mountedHorseId,world:clone(runtime.world)};}
function saveKey(slot){return SAVE_PREFIX+slot;}
function readSlot(slot){try{const value=localStorage.getItem(saveKey(slot));if(!value) return null;const parsed=JSON.parse(value);return parsed?.version===SAVE_VERSION?parsed:null;}catch{return null;}}
function saveNow(reason="manual"){
  if(!runtime.activeSlot||!state.running) return false;try{localStorage.setItem(saveKey(runtime.activeSlot),JSON.stringify(snapshot()));runtime.saveFlash=2.2;updateSaveUi();if(reason!=="auto") api.showToast("Spielstand "+runtime.activeSlot+" gespeichert",1200);return true;}catch{api.showToast("Speichern fehlgeschlagen · Browser-Speicher prüfen",2200);return false;}
}
function restoreSnapshot(save){
  Object.assign(state.player,clone(save.player));state.lastSafe=clone(save.lastSafe);state.inventory=clone(save.inventory);state.inventorySerial=save.inventorySerial||2;state.elapsed=Number(save.elapsed)||0;state.camera.x=state.player.x;state.camera.y=state.player.y;state.effects=[];state.dead=false;state.draggingAnimalId=null;
  if(state.player.health<=0){state.player.health=100;state.player.x=state.lastSafe.x;state.player.y=state.lastSafe.y;state.player.bleed={intensity:0,duration:0,tickCooldown:0,volume:0,trailDistance:0};state.camera.x=state.player.x;state.camera.y=state.player.y;}
  treePhysicsStates.clear();for(const entry of save.trees||[]){const tree=api.treeAtGrid(entry.gx,entry.gy);if(!tree) continue;const physics=api.getTreePhysics(tree,true);Object.assign(physics,clone(entry),{tree,key:entry.gx+","+entry.gy});}
  if(api.clearAnimalRuntimeCaches) api.clearAnimalRuntimeCaches();else{api.animalStates.clear();api.animalCellCache.clear();}for(const raw of save.animals||[]){const cellX=raw.originCellX??Math.floor(raw.x/(18*TILE_METERS));const cellY=raw.originCellY??Math.floor(raw.y/(18*TILE_METERS));api.createAnimalState(raw.species,cellX,cellY,0,{x:raw.x,y:raw.y},clone(raw));}
  state.starterHorseId=save.starterHorseId||null;state.mountedHorseId=save.mountedHorseId||null;runtime.world=clone(save.world||runtime.world);if(!Array.isArray(runtime.world.bandits)) runtime.world.bandits=createBandits();if((runtime.world.contentVersion||0)<19){const fresh=new Map(createBandits().map((bandit)=>[bandit.id,bandit]));for(const bandit of runtime.world.bandits.filter((entry)=>entry.camp===1)){const target=fresh.get(bandit.id);if(target){bandit.x=target.x;bandit.y=target.y;bandit.homeX=target.homeX;bandit.homeY=target.homeY;}}runtime.world.contentVersion=19;}runtime.world.meals=runtime.world.meals||{};api.syncHeldItem();api.renderInventory();updateQuestHud();
}
function loadSlot(slot){const save=readSlot(slot);if(!save) return false;if(state.running) saveNow("switch");runtime.activeSlot=slot;runtime.pendingLoad=save;closeSaveSlots();api.togglePause(false);api.startGame();return true;}
function nextEmptySlot(){for(let slot=1;slot<=3;slot++) if(!readSlot(slot)) return slot;return 1;}
function onGameStarted(){
  runtime.arrows=[];runtime.interior=null;runtime.roll=null;$("gamePanel").classList.remove("inside-building");$("insideLabel")?.remove();
  if(runtime.pendingLoad){const save=runtime.pendingLoad;runtime.pendingLoad=null;restoreSnapshot(save);api.showToast("Spielstand "+runtime.activeSlot+" geladen",1800);}
  else{runtime.activeSlot=runtime.activeSlot||nextEmptySlot();runtime.world={contentVersion:19,questStage:0,bandits:createBandits(),opened:{},visited:{},crafted:{},meals:{},playSeconds:0,weatherSeed:Math.floor(Math.random()*525)};updateQuestHud();saveNow("new");}
  updateNpcSchedules(0);runtime.autosave=0;updateSaveUi();
}
function formatDate(value){try{return new Date(value).toLocaleString("de-DE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});}catch{return "Unbekannt";}}
function updateSaveUi(){const any=[1,2,3].some((slot)=>readSlot(slot));$("continueBtn").disabled=!any;$("continueBtn").querySelector("small").textContent=any?"Drei lokale Plätze":"Noch kein Spielstand";}
function renderSaveSlots(){
  const list=$("saveSlotList");list.replaceChildren();
  for(let slot=1;slot<=3;slot++){
    const save=readSlot(slot);const card=document.createElement("article");card.className="save-slot"+(save?"":" empty")+(runtime.activeSlot===slot?" active":"");
    const title=document.createElement("h3");title.textContent=save?save.player.name:"Freier Platz";
    const meta=document.createElement("p");meta.textContent=save?"Stufe "+(save.world?.questStage>=5?"2":"1")+" · "+(save.player.x/1000).toFixed(2)+" / "+(save.player.y/1000).toFixed(2)+" km · "+Math.floor((save.world?.playSeconds||0)/60)+" min":state.running?"Aktuelle Reise hier zusätzlich sichern":"Neue Reise auf diesem Platz beginnen";
    const time=document.createElement("time");time.textContent=save?formatDate(save.savedAt):"Noch nicht verwendet";const badge=document.createElement("span");badge.textContent="SPIELSTAND "+slot;
    const actions=document.createElement("div");actions.className="save-slot-actions";const primary=document.createElement("button");primary.className="primary";primary.textContent=save?"Laden":state.running?"Hier speichern":"Verwenden";
    primary.addEventListener("click",()=>{if(save) loadSlot(slot);else{runtime.activeSlot=slot;closeSaveSlots();if(state.running) saveNow("manual");else api.showMenu(false);}});actions.appendChild(primary);
    if(save){const remove=document.createElement("button");remove.className="danger";remove.textContent="Löschen";remove.disabled=state.running&&runtime.activeSlot===slot;remove.title=remove.disabled?"Der aktive Spielstand kann während des Spiels nicht gelöscht werden":"";remove.addEventListener("click",()=>{if(confirm("Spielstand "+slot+" wirklich löschen?")){localStorage.removeItem(saveKey(slot));if(runtime.activeSlot===slot) runtime.activeSlot=null;renderSaveSlots();updateSaveUi();}});actions.appendChild(remove);}
    card.append(badge,title,meta,time,actions);list.appendChild(card);
  }
}
function openSaveSlots(){renderSaveSlots();$("saveSlotsOverlay").classList.remove("hidden");}
function closeSaveSlots(){$("saveSlotsOverlay").classList.add("hidden");}

function ensureAudio(){if(runtime.audio) return runtime.audio;const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext) return null;runtime.audio=new AudioContext();return runtime.audio;}
function sound(type,variant=""){
  const audio=runtime.audio;if(!audio||audio.state!=="running") return;const now=audio.currentTime;const last=runtime.lastSoundAt.get(type)||0;if(now-last<(type==="footstep"?.09:.035)) return;runtime.lastSoundAt.set(type,now);
  const profiles={footstep:[95,.035,"square",.025],swing:[260,.07,"sawtooth",.035],bow:[178,.14,"triangle",.045],empty:[82,.045,"square",.018],hit:[82,.09,"square",.06],hurt:[62,.16,"sawtooth",.07],defeat:[55,.24,"triangle",.065],dodge:[180,.08,"triangle",.025],craft:[440,.14,"triangle",.04],quest:[660,.28,"sine",.045],pickup:[520,.08,"sine",.035],heal:[390,.22,"sine",.04],chest:[310,.16,"square",.035],rest:[220,.35,"sine",.03],water:[280,.12,"sine",.025],discovery:[330,.42,"triangle",.035],enemyAttack:[120,.12,"sawtooth",.04],ambient:[160,.35,"sine",.008],rain:[110,.25,"triangle",.006]};const [frequency,duration,wave,volume]=profiles[type]||profiles.ambient;const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type=wave;oscillator.frequency.setValueAtTime(frequency+(variant?variant.length%7*3:0),now);gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);oscillator.connect(gain).connect(audio.destination);oscillator.start(now);oscillator.stop(now+duration);
}

function bindUi(){
  window.addEventListener("pointerdown",()=>{const audio=ensureAudio();if(audio?.state==="suspended") audio.resume();},{once:true});window.addEventListener("keydown",(event)=>{const audio=ensureAudio();if(audio?.state==="suspended") audio.resume();const dialogOpen=!$("dialogOverlay").classList.contains("hidden");if(dialogOpen){if(event.key==="Escape")closeDialog();if(["Escape"," ","e","i","m","1","2","3","4"].includes(event.key.toLowerCase())){event.preventDefault();event.stopImmediatePropagation();}return;}if(event.code==="Space"&&state.running&&!event.repeat){event.preventDefault();dodge();}},{capture:true});
  $("continueBtn").addEventListener("click",openSaveSlots);$("closeSaveSlots").addEventListener("click",closeSaveSlots);$("saveSlotsOverlay").addEventListener("click",(event)=>{if(event.target===$("saveSlotsOverlay")) closeSaveSlots();});
  $("beginBtn").addEventListener("click",()=>{runtime.activeSlot=nextEmptySlot();});$("saveGameBtn").addEventListener("click",()=>saveNow("manual"));$("openSaveSlotsInGame").addEventListener("click",openSaveSlots);$("closeCraft").addEventListener("click",closeCraft);$("craftOverlay").addEventListener("click",(event)=>{if(event.target===$("craftOverlay")) closeCraft();});$("dialogClose")?.addEventListener("click",closeDialog);$("dialogOverlay")?.addEventListener("click",(event)=>{if(event.target===$("dialogOverlay")) closeDialog();});$("questLabel")?.closest(".quest-hud")?.addEventListener("click",(event)=>{if(matchMedia("(hover:none) and (pointer:coarse), (max-width:700px)").matches){event.currentTarget.classList.toggle("expanded");}});
  const indicator=document.createElement("div");indicator.id="autosaveIndicator";indicator.className="autosave-indicator hidden";indicator.textContent="✓ AUTOMATISCH GESPEICHERT";$("gamePanel").appendChild(indicator);
  const marker=document.createElement("div");marker.id="questWorldMarker";marker.className="quest-world-marker hidden";$("gamePanel").appendChild(marker);
  const heat=document.createElement("div");heat.id="desertHeatIndicator";heat.className="desert-heat hidden";heat.textContent="☀ HITZE 0%";$("gamePanel").appendChild(heat);
  updateSaveUi();updateQuestHud();api.renderInventory();
}

const exported={
  version:"0.19",recipes,worldObjects,runtime,collisionAt,nearbyInteraction,interact,drawGround,renderables,drawRenderable,drawOverlay,
  frameDt,cameraOffset,update,dodge,isRolling:()=>!!runtime.roll,performPlayerStrike,useEquippedItem,useConsumable,onAnimalDamaged,updateAnimalSocial,sound,
  onGameStarted,saveNow,readSlot,loadSlot,snapshot,restoreSnapshot,inventoryCount,removeInventory,weatherType,desertMovementMultiplier,advanceQuestFromInventory,
  isInterior:()=>!!runtime.interior,moveInteriorPlayer,exitInterior,questTarget,showDialog,closeDialog
};
window.__ARCHIPELAGO_V015__=exported;
bindUi();
})();
