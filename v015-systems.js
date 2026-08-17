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

Object.assign(itemCatalog,{
  wood:{name:"Holz",short:"Holz",category:"resource",width:2,height:1,maxStack:12,icon:"wood",description:"Ein trockener Holzabschnitt für Werkbank und Lagerfeuer."},
  coin:{name:"Inselmünze",short:"Münzen",category:"resource",width:1,height:1,maxStack:99,icon:"coin",description:"Alte Inselmünzen. Borin nimmt sie noch immer an."},
  cookedChicken:{name:"Gebratenes Huhn",short:"Huhn",category:"food",width:1,height:1,maxStack:6,icon:"cooked",consumable:true,heal:18,description:"Am Feuer gebraten. Stellt 18 Leben wieder her."},
  cookedPork:{name:"Gebratenes Wild",short:"Wild",category:"food",width:2,height:1,maxStack:6,icon:"cooked",consumable:true,heal:30,description:"Kräftiges Wildfleisch. Stellt 30 Leben wieder her."},
  fieldBandage:{name:"Feldverband",short:"Verband",category:"medicine",width:1,height:2,maxStack:5,icon:"bandage",consumable:true,heal:38,description:"Stoppt Blutung und stellt 38 Leben wieder her."},
  leatherVest:{name:"Verstärkte Lederweste",short:"Lederweste",category:"armor",equipSlot:"body",width:2,height:3,icon:"vest",armor:6,description:"Einfache Rüstung aus zäher Wildschweinhaut."},
  huntingSpear:{name:"Jagdspeer",short:"Speer",category:"weapon",equipSlot:"mainHand",width:1,height:4,action:"spearThrust",duration:.42,cooldown:.55,animalDamage:68,corpseDamage:28,icon:"spear",description:"Lange Reichweite und ein klarer, gerichteter Stoß."}
});

const recipes={
  workbench:[
    {id:"huntingSpear",label:"Jagdspeer",icon:"⚔",needs:{wood:2,bone:1},output:{huntingSpear:1}},
    {id:"leatherVest",label:"Lederweste",icon:"◈",needs:{boarHide:2,wood:1},output:{leatherVest:1}},
    {id:"fieldBandage",label:"Feldverband",icon:"✚",needs:{boarHide:1,feather:2},output:{fieldBandage:2}}
  ],
  campfire:[
    {id:"cookedChicken",label:"Huhn braten",icon:"♨",needs:{rawChicken:1},output:{cookedChicken:1}},
    {id:"cookedPork",label:"Wild braten",icon:"♨",needs:{rawPork:1},output:{cookedPork:1}}
  ],
  trader:[
    {id:"buyBandage",label:"Verband kaufen",icon:"✚",needs:{coin:3},output:{fieldBandage:1}},
    {id:"buyWood",label:"Holzbündel kaufen",icon:"▰",needs:{coin:2},output:{wood:2}}
  ]
};

const worldObjects=[
  {id:"mira",kind:"npc",variant:"mira",x:START.x+28,y:START.y+4,label:"Mit Mira sprechen",mobileLabel:"Reden"},
  {id:"borin",kind:"npc",variant:"borin",x:START.x-34,y:START.y+14,label:"Mit Borin handeln",mobileLabel:"Handel"},
  {id:"workbench",kind:"workbench",x:START.x-10,y:START.y-42,radius:7,solid:true,label:"Werkbank benutzen",mobileLabel:"Bauen"},
  {id:"village-fire",kind:"campfire",x:START.x+27,y:START.y-38,radius:4,label:"Am Lagerfeuer rasten und kochen",mobileLabel:"Rasten"},
  {id:"village-well",kind:"well",x:START.x-52,y:START.y-28,radius:8,solid:true,label:"Brunnen untersuchen",mobileLabel:"Ansehen"},
  {id:"hut-west",kind:"hut",x:START.x-80,y:START.y+28,radius:15,solid:true,label:"Hütte der Fischer untersuchen",mobileLabel:"Ansehen"},
  {id:"hut-east",kind:"hut",x:START.x+74,y:START.y+30,radius:15,solid:true,label:"Vorratshütte untersuchen",mobileLabel:"Ansehen"},
  {id:"hut-hall",kind:"hut",x:START.x,y:START.y-95,radius:15,solid:true,label:"Versammlungshütte untersuchen",mobileLabel:"Ansehen"},
  {id:"camp-1-tent",kind:"banditTent",x:START.x+330,y:START.y+230,radius:13,solid:true,label:"Banditenzelt durchsuchen",mobileLabel:"Suchen",camp:1},
  {id:"camp-1-fire",kind:"campfire",x:START.x+300,y:START.y+205,radius:4,label:"Fremdes Lagerfeuer",mobileLabel:"Rasten",camp:1},
  {id:"camp-1-chest",kind:"lootChest",x:START.x+354,y:START.y+205,radius:6,solid:true,label:"Banditentruhe öffnen",mobileLabel:"Öffnen",camp:1},
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
  {id:"ruin-cache-3",kind:"lootChest",x:6705,y:17315,radius:6,solid:true,label:"Sonnenuhr-Kassette öffnen",mobileLabel:"Öffnen"}
];
const propPixelSizes={workbench:[48,32],campfire:[32,32],well:[48,32],hut:[64,48],cave:[64,48],banditTent:[64,48],lootChest:[32,32]};

function createBandits(){
  const camps=[
    [1,START.x+292,START.y+242],[1,START.x+340,START.y+258],[1,START.x+372,START.y+225],
    [2,11310,8875],[2,11362,8862],[2,11402,8915],
    [3,12630,15478],[3,12680,15462],[3,12728,15508]
  ];
  return camps.map(([camp,x,y],index)=>({
    id:"bandit:"+(index+1),kind:"bandit",camp,x,y,homeX:x,homeY:y,ySort:y,health:110,maxHealth:110,status:"alive",
    dir:"down",moving:false,phase:"idle",timer:0,cooldown:index*.18,vx:0,vy:0,hitFlash:0,attackHit:false,gait:index*.7
  }));
}

const runtime={
  activeSlot:null,pendingLoad:null,autosave:0,saveFlash:0,hitStop:0,shake:0,roll:null,questSignature:"",markerSignature:"",lastSocial:new Map(),lastSoundAt:new Map(),audio:null,
  world:{questStage:0,bandits:createBandits(),opened:{},visited:{},crafted:{},playSeconds:0,weatherSeed:0}
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

function questCopy(){
  const stage=runtime.world.questStage;
  if(stage===0) return ["AUFBRUCH","Glut im Nebel","Sprich mit Mira im Lager Treibholz."];
  if(stage===1) return ["SAMMELN","Werkzeug für die Jagd","Sammle 2 Holz und 1 Knochen. Holzstücke entstehen aus gefällten, zerteilten Bäumen."];
  if(stage===2) return ["HANDWERK","Ein längerer Arm","Stelle an der Werkbank einen Jagdspeer her."];
  if(stage===3){const defeated=runtime.world.bandits.filter((bandit)=>bandit.camp===1&&bandit.status==="dead").length;return ["GEFAHR","Das Lager am alten Weg","Besiege die Banditen südöstlich von Treibholz · "+defeated+" / 3."];}
  if(stage===4) return ["RÜCKKEHR","Der Weg ist frei","Kehre zu Mira nach Treibholz zurück."];
  return ["ERKUNDUNG","Die zersplitterte See","Finde Höhlen, Ruinen, Lager und weitere Geheimnisse der Inseln."];
}
function updateQuestHud(){
  const copy=questCopy();const signature=copy.join("|");if(signature===runtime.questSignature) return;runtime.questSignature=signature;if($("questLabel")) $("questLabel").textContent=copy[0];if($("questTitle")) $("questTitle").textContent=copy[1];if($("questDescription")) $("questDescription").textContent=copy[2];
}
function updateQuestMarker(){
  const stage=runtime.world.questStage;const target=stage===3?worldObjects.find((entry)=>entry.id==="camp-1-tent"):stage===0||stage===4?worldObjects.find((entry)=>entry.id==="mira"):stage===2?worldObjects.find((entry)=>entry.id==="workbench"):null;const marker=$("questWorldMarker");if(!marker) return;
  if(!target){marker.classList.add("hidden");runtime.markerSignature="";return;}const dx=target.x-state.player.x,dy=target.y-state.player.y,distance=Math.hypot(dx,dy);if(distance<45){marker.classList.add("hidden");return;}
  const directionIndex=Math.round((Math.atan2(dy,dx)+Math.PI*2)/(Math.PI/4))%8;const arrow=["→","↘","↓","↙","←","↖","↑","↗"][directionIndex];const label=stage===3?"BANDITENLAGER":stage===2?"WERKBANK":"MIRA";const signature=label+":"+arrow+":"+Math.round(distance/10);if(signature!==runtime.markerSignature){runtime.markerSignature=signature;marker.textContent=arrow+"  "+label+" · "+Math.round(distance/10)*10+" m";}marker.classList.remove("hidden");
}
function advanceQuestFromInventory(){
  if(runtime.world.questStage===1&&inventoryCount("wood")>=2&&inventoryCount("bone")>=1){runtime.world.questStage=2;api.showToast("Neue Aufgabe · Jagdspeer an der Werkbank herstellen",2600);sound("quest");}
  if(runtime.world.questStage===3&&runtime.world.bandits.filter((bandit)=>bandit.camp===1&&bandit.status==="dead").length>=3){runtime.world.questStage=4;api.showToast("Banditenlager geräumt · Kehre zu Mira zurück",3000);sound("quest");}
  updateQuestHud();
}

function showDialog(speaker,text,actions=[{label:"Schließen",action:closeDialog}]){
  state.paused=true;$("dialogSpeaker").textContent=speaker;$("dialogText").textContent=text;const box=$("dialogActions");box.replaceChildren();
  for(const entry of actions){const button=document.createElement("button");button.type="button";button.textContent=entry.label;if(entry.primary) button.classList.add("primary");button.addEventListener("click",entry.action);box.appendChild(button);}
  $("dialogOverlay").classList.remove("hidden");
}
function closeDialog(){$("dialogOverlay").classList.add("hidden");state.paused=false;}

function talkToMira(){
  const stage=runtime.world.questStage;
  if(stage===0){showDialog("Mira","Treibholz hält nur, wenn jeder etwas beiträgt. Bring mir zwei Holzstücke und einen Knochen. An der Werkbank entsteht daraus ein Speer.",[{label:"Aufgabe annehmen",primary:true,action:()=>{runtime.world.questStage=1;closeDialog();updateQuestHud();saveNow("quest");}},{label:"Später",action:closeDialog}]);return;}
  if(stage===1||stage===2){showDialog("Mira",stage===1?"Zerteile einen gefällten Stamm und sammle die Stücke ein. Einen Knochen findest du bei Tierkadavern.":"Alles da. Die Werkbank steht gleich hinter dem Feuer – baue dort deinen Jagdspeer.");return;}
  if(stage===3){showDialog("Mira","Das Banditenlager liegt südöstlich am alten Weg. Ihre Anführer greifen gemeinsam an – bleib in Bewegung und nutze die Ausweichrolle.");return;}
  if(stage===4){showDialog("Mira","Der Weg ist wieder frei. Nimm diese Münzen. Höhlen, Ruinen und weitere Lager warten jenseits des Nebels.",[{label:"Belohnung nehmen",primary:true,action:()=>{api.addInventoryItem("coin",15);runtime.world.questStage=5;closeDialog();updateQuestHud();saveNow("quest");sound("quest");}}]);return;}
  showDialog("Mira","Treibholz steht. Wenn du weiterziehst: Lagerfeuer heilen, Höhlen bergen Vorräte und Borin handelt mit Inselmünzen.");
}

function openCraft(kind){
  const titles={workbench:["WERKBANK","Handwerk","Baue dauerhafte Ausrüstung aus gefundenen Materialien."],campfire:["LAGERFEUER","Rasten & Kochen","Rasten heilt vollständig; Fleisch kann haltbar gebraten werden."],trader:["BORINS HANDEL","Handel","Borin tauscht Vorräte gegen alte Inselmünzen."]};
  const copy=titles[kind];$("craftKicker").textContent=copy[0];$("craftTitle").textContent=copy[1];$("craftSubtitle").textContent=copy[2];const list=$("craftRecipeList");list.replaceChildren();
  if(kind==="campfire"){
    const rest=document.createElement("article");rest.className="craft-recipe";rest.innerHTML='<span class="craft-recipe-icon">☾</span><div><h3>Bis zum Morgen rasten</h3><p>Leben, Ausdauer und Blutung vollständig erholen</p></div>';
    const button=document.createElement("button");button.textContent="Rasten";button.className="primary";button.addEventListener("click",()=>{state.player.health=100;state.player.stamina=100;state.player.bleed={intensity:0,duration:0,tickCooldown:0,volume:0,trailDistance:0};const hour=(8+state.elapsed/120)%24;state.elapsed+=(((8-hour+24)%24)||24)*120;api.showToast("Ausgeruht · ein neuer Morgen beginnt",2200);sound("rest");saveNow("rest");renderCraft(kind);});rest.appendChild(button);list.appendChild(rest);
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
  let best=nearestWoodPiece();
  for(const object of worldObjects){
    if(runtime.world.opened[object.id]&&object.kind==="lootChest") continue;
    const distance=Math.max(0,distanceTo(object)-(object.radius||2));
    if(distance<18&&(!best||distance<best.distance)) best={type:"v015",kind:object.kind,object,distance,label:object.label,mobileLabel:object.mobileLabel};
  }
  return best;
}
function interact(target){
  if(target.type!=="v015") return false;
  if(target.kind==="wood"){
    if(api.addInventoryItem("wood",1)>0){target.piece.collected=true;api.showToast("+1 Holz");sound("pickup");advanceQuestFromInventory();saveNow("pickup");}else api.showToast("Der Rucksack ist voll.");return true;
  }
  const object=target.object;
  if(object.kind==="npc"){object.variant==="mira"?talkToMira():openCraft("trader");return true;}
  if(object.kind==="workbench"){openCraft("workbench");return true;}
  if(object.kind==="campfire"){openCraft("campfire");return true;}
  if(object.kind==="well"){api.showToast("Klares Wasser · Ausdauer vollständig erholt",1800);state.player.stamina=100;sound("water");return true;}
  if(object.kind==="hut"){api.showToast(object.id==="hut-hall"?"An der Wand hängt eine Karte der zersplitterten Inseln.":"Die Hütte ist bewohnt und für die Nacht verriegelt.",2200);return true;}
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
    let halfX=(object.radius||6)+PLAYER_RADIUS*.65,halfY=halfX;
    const editor=window.__ARCHIPELAGO_ASSET_EDITOR__;const assetId="prop_"+object.kind;const asset=editor?.pack?.assets?.[assetId];const definition=editor?.definitions?.[assetId];const size=propPixelSizes[object.kind];
    if(asset?.enabled&&definition&&size){halfX=Math.max(2,asset.meta.hitbox.width/definition.width*size[0]/VIEW_SCALE/2)+PLAYER_RADIUS*.65;halfY=Math.max(2,asset.meta.hitbox.height/definition.height*size[1]/VIEW_SCALE/2)+PLAYER_RADIUS*.65;}
    const dx=(x-object.x)/halfX,dy=(y-object.y)/halfY;if(dx*dx+dy*dy<1) return {type:"v015",object};
  }
  return null;
}

function directionVector(){const map={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};return map[state.player.dir]||[0,1];}
function dodge(){
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
function useEquippedItem(item,definition){
  if(definition.action!=="spearThrust") return false;
  if(!performPlayerStrike(item.itemId,definition.animalDamage)){
    const target=api.findAnimalTarget?.(TILE_METERS*3.15);if(target) api.damageAnimal(target.animal,definition.animalDamage,item.itemId);
  }
  sound("swing","spear");return true;
}
function useConsumable(item,definition){
  if(!definition.consumable) return false;state.player.health=Math.min(100,state.player.health+(definition.heal||0));if(item.itemId==="fieldBandage") state.player.bleed={intensity:0,duration:0,tickCooldown:0,volume:0,trailDistance:0};removeInventory(item.itemId,1);api.showToast(definition.name+" benutzt · "+Math.ceil(state.player.health)+" Leben",1800);sound("heal");saveNow("item");return true;
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

function updateAnimalSocial(animal,dt,distance){
  if(animal.status!=="alive"||animal.species==="crow") return;const key=animal.id+":"+Math.floor(state.elapsed*2);if(runtime.lastSocial.has(key)) return;runtime.lastSocial.set(key,state.elapsed);
  if(runtime.lastSocial.size>600) for(const [id,time] of runtime.lastSocial) if(state.elapsed-time>3) runtime.lastSocial.delete(id);
  if(animal.species==="boar"&&distance<72){
    const wounded=api.activeAnimalsNear(animal.x,animal.y,48).some((other)=>other.species==="boar"&&other.health<other.maxHealth*.8);
    if(wounded) animal.aggressionUntil=Math.max(animal.aggressionUntil,state.elapsed+4.5);
  }
}
function onAnimalDamaged(animal,damage,itemId){
  runtime.hitStop=.045;runtime.shake=Math.max(runtime.shake,animal.species==="horse"?3:2);sound(animal.health<=0?"defeat":"hit",animal.species);
  for(const other of api.activeAnimalsNear(animal.x,animal.y,animal.species==="boar"?58:44)){
    if(other===animal||other.species!==animal.species||other.status!=="alive") continue;
    if(animal.species==="boar") other.aggressionUntil=Math.max(other.aggressionUntil,state.elapsed+7);
    else other.fleeUntil=Math.max(other.fleeUntil,state.elapsed+6);
    other.heading=Math.atan2(other.y-state.player.y,other.x-state.player.x);
  }
  advanceQuestFromInventory();
}

function worldToScreen(x,y,camX,camY){return {x:(x-camX)*VIEW_SCALE+canvas.width/2,y:(y-camY)*VIEW_SCALE+canvas.height/2};}
function drawGround(camX,camY){
  const village=worldToScreen(START.x,START.y,camX,camY);ctx.save();ctx.globalAlpha=.35;ctx.fillStyle="#9c8254";ctx.fillRect(Math.round(village.x-102),Math.round(village.y-10),204,20);ctx.fillRect(Math.round(village.x-10),Math.round(village.y-120),20,190);
  for(const object of worldObjects.filter((entry)=>entry.kind==="campfire")){const p=worldToScreen(object.x,object.y,camX,camY);if(p.x<-50||p.y<-50||p.x>canvas.width+50||p.y>canvas.height+50) continue;ctx.fillStyle="rgba(255,151,55,.12)";const size=28+Math.sin(state.elapsed*5+object.x)*3;ctx.fillRect(Math.round(p.x-size),Math.round(p.y-size*.45),Math.round(size*2),Math.round(size*.9));}
  ctx.restore();
}
function fallbackNpc(entity,x,y){const player={...state.player,id:entity.id,name:"",x:entity.x,y:entity.y,dir:entity.dir||"down",moving:!!entity.moving,walkTime:entity.gait||0,actionType:null,actionProgress:0,skin:entity.variant==="mira"?"#d79a62":"#a86f45",hair:entity.variant==="mira"?"#8d3d2e":"#403027",hairStyle:entity.variant==="mira"?"braid":"undercut",beardStyle:entity.variant==="borin"?"full":"none",shirt:entity.variant==="mira"?"#4f7450":"#84623c",cloak:entity.variant==="mira"?"#5a3940":"#303d43",outfit:entity.kind==="bandit"?"raider":"traveler",heldItem:null};api.drawCharacter(ctx,x,y,player,2,false);}
function drawNpc(object,camX,camY){const p=worldToScreen(object.x,object.y,camX,camY);const entity={id:object.id,variant:object.variant,dir:"down",moving:false,talking:!$("dialogOverlay")?.classList.contains("hidden")};const assetId=object.variant==="mira"?"npc_mira":"npc_borin";const editor=window.__ARCHIPELAGO_ASSET_EDITOR__;if(!editor?.drawArtistSpriteOverride(assetId,entity,ctx,p.x,p.y)) fallbackNpc({...entity,kind:"npc",x:object.x,y:object.y},p.x,p.y);ctx.fillStyle="#f2dfae";ctx.font="10px Georgia";ctx.textAlign="center";ctx.fillText(object.variant==="mira"?"Mira":"Borin",Math.round(p.x),Math.round(p.y-54));}
function drawBandit(bandit,camX,camY){const p=worldToScreen(bandit.x,bandit.y,camX,camY);const editor=window.__ARCHIPELAGO_ASSET_EDITOR__;if(!editor?.drawArtistSpriteOverride("bandit",bandit,ctx,p.x,p.y)){if(bandit.status==="dead"){ctx.fillStyle="rgba(17,20,20,.28)";ctx.fillRect(Math.round(p.x-22),Math.round(p.y-5),44,7);ctx.fillStyle="#49312d";ctx.fillRect(Math.round(p.x-17),Math.round(p.y-12),34,10);ctx.fillStyle="#a86f45";ctx.fillRect(Math.round(p.x+10),Math.round(p.y-13),10,9);}else fallbackNpc({...bandit,kind:"bandit",variant:"bandit"},p.x,p.y);}if(bandit.status==="alive"){ctx.fillStyle="#241516";ctx.fillRect(Math.round(p.x-15),Math.round(p.y-56),30,4);ctx.fillStyle=bandit.phase==="windup"?"#f0b85c":"#b34d48";ctx.fillRect(Math.round(p.x-14),Math.round(p.y-55),Math.round(28*bandit.health/bandit.maxHealth),2);if(bandit.phase==="windup"){ctx.strokeStyle="#edc66d";ctx.strokeRect(Math.round(p.x-18),Math.round(p.y-18),36,10);}}}
function drawProp(object,camX,camY){
  if(object.kind==="npc"){drawNpc(object,camX,camY);return;}const p=worldToScreen(object.x,object.y,camX,camY);const editor=window.__ARCHIPELAGO_ASSET_EDITOR__;const assetId=["workbench","campfire","well","hut","cave","banditTent","lootChest"].includes(object.kind)?"prop_"+object.kind:null;
  const size=propPixelSizes[object.kind]||[48,32];
  if(assetId&&editor?.drawArtistSizedOverride(assetId,ctx,p.x-size[0]/2,p.y-size[1],size[0],size[1],{animation:object.kind==="campfire"?"burn":runtime.world.opened[object.id]?"open":"idle"})) return;
  if(object.kind==="workbench"){ctx.fillStyle="#5d3d26";ctx.fillRect(Math.round(p.x-20),Math.round(p.y-13),40,13);ctx.fillStyle="#a97746";ctx.fillRect(Math.round(p.x-22),Math.round(p.y-18),44,7);ctx.fillStyle="#3e2a1e";ctx.fillRect(Math.round(p.x-17),Math.round(p.y),5,17);ctx.fillRect(Math.round(p.x+12),Math.round(p.y),5,17);}
  else if(object.kind==="campfire"){ctx.fillStyle="#4c3326";ctx.fillRect(Math.round(p.x-12),Math.round(p.y+3),24,5);ctx.fillStyle="#e15b2d";ctx.fillRect(Math.round(p.x-7),Math.round(p.y-13),14,16);ctx.fillStyle="#ffd36b";ctx.fillRect(Math.round(p.x-3),Math.round(p.y-18-Math.sin(state.elapsed*9)*3),7,14);}
  else if(object.kind==="well"){ctx.fillStyle="#555b57";ctx.fillRect(Math.round(p.x-17),Math.round(p.y-10),34,22);ctx.fillStyle="#8b8d82";ctx.fillRect(Math.round(p.x-20),Math.round(p.y-15),40,8);ctx.fillStyle="#18343c";ctx.fillRect(Math.round(p.x-12),Math.round(p.y-11),24,7);}
  else if(object.kind==="hut"){ctx.fillStyle="#725138";ctx.fillRect(Math.round(p.x-27),Math.round(p.y-35),54,38);ctx.fillStyle="#9c7148";ctx.fillRect(Math.round(p.x-22),Math.round(p.y-31),44,30);ctx.fillStyle="#5b3528";ctx.beginPath();ctx.moveTo(p.x-34,p.y-34);ctx.lineTo(p.x,p.y-65);ctx.lineTo(p.x+34,p.y-34);ctx.fill();ctx.fillStyle="#35251e";ctx.fillRect(Math.round(p.x-7),Math.round(p.y-20),14,23);ctx.fillStyle="#d4ac58";ctx.fillRect(Math.round(p.x+3),Math.round(p.y-10),2,2);}
  else if(object.kind==="banditTent"){ctx.fillStyle="#4b3430";ctx.fillRect(Math.round(p.x-27),Math.round(p.y-23),54,30);ctx.fillStyle="#7b4b3e";ctx.beginPath();ctx.moveTo(p.x-31,p.y-22);ctx.lineTo(p.x,p.y-54);ctx.lineTo(p.x+31,p.y-22);ctx.fill();ctx.fillStyle="#21191a";ctx.fillRect(Math.round(p.x-7),Math.round(p.y-24),14,31);}
  else if(object.kind==="cave"){ctx.fillStyle="#454b4b";ctx.fillRect(Math.round(p.x-34),Math.round(p.y-30),68,35);ctx.fillStyle="#171e21";ctx.fillRect(Math.round(p.x-20),Math.round(p.y-36),40,42);ctx.fillStyle="#090f12";ctx.fillRect(Math.round(p.x-13),Math.round(p.y-30),26,36);}
  else if(object.kind==="lootChest"&&!runtime.world.opened[object.id]){ctx.fillStyle="#4f301f";ctx.fillRect(Math.round(p.x-14),Math.round(p.y-10),28,18);ctx.fillStyle="#a67336";ctx.fillRect(Math.round(p.x-15),Math.round(p.y-13),30,7);ctx.fillStyle="#d7b85b";ctx.fillRect(Math.round(p.x-2),Math.round(p.y-7),5,7);}
}
function renderables(left,top,right,bottom){const result=[];for(const object of worldObjects){if(object.kind==="lootChest"&&runtime.world.opened[object.id]) continue;if(object.x<left-80||object.x>right+80||object.y<top-80||object.y>bottom+80) continue;result.push({kind:"object",object,y:object.y});}for(const bandit of runtime.world.bandits){if(bandit.x<left-60||bandit.x>right+60||bandit.y<top-60||bandit.y>bottom+60) continue;result.push({kind:"bandit",bandit,y:bandit.ySort||bandit.y});}return result;}
function drawRenderable(renderable,camX,camY){renderable.kind==="bandit"?drawBandit(renderable.bandit,camX,camY):drawProp(renderable.object,camX,camY);}

function weatherType(){const biome=api.terrainAt(state.player.x,state.player.y).biome;const cycle=Math.floor((state.elapsed+runtime.world.weatherSeed)/75)%7;if(["snow","glacier","tundra","packIce"].includes(biome)) return cycle<4?"snow":cycle===4?"fog":"clear";if(["desert","beach"].includes(biome)) return cycle===2||cycle===3?"dust":"clear";if(["forest","jungle","swamp","plains"].includes(biome)) return cycle===1||cycle===2?"rain":cycle===3?"storm":cycle===5?"fog":"clear";return cycle===3?"rain":"clear";}
function drawOverlay(){
  const weather=weatherType();const t=state.elapsed;
  if(weather==="rain"||weather==="storm"){ctx.save();ctx.strokeStyle=weather==="storm"?"rgba(190,218,220,.5)":"rgba(179,210,211,.35)";ctx.lineWidth=1;const count=weather==="storm"?90:55;for(let i=0;i<count;i++){const x=(i*83+t*270)% (canvas.width+60)-30;const y=(i*47+t*430)% (canvas.height+60)-30;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-8,y+20);ctx.stroke();}if(weather==="storm"&&Math.floor(t*2)%23===0){ctx.fillStyle="rgba(220,238,236,.15)";ctx.fillRect(0,0,canvas.width,canvas.height);}ctx.restore();}
  else if(weather==="snow"){ctx.fillStyle="rgba(239,247,241,.7)";for(let i=0;i<48;i++){const x=(i*71+t*18)%canvas.width,y=(i*43+t*(28+i%5))%canvas.height;ctx.fillRect(Math.round(x),Math.round(y),i%7===0?3:2,i%7===0?3:2);}}
  else if(weather==="dust"){ctx.fillStyle="rgba(201,156,85,.16)";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="rgba(233,193,118,.28)";for(let i=0;i<38;i++){const x=(i*91+t*74)%canvas.width,y=(i*37+t*8)%canvas.height;ctx.fillRect(Math.round(x),Math.round(y),8+i%9,1);}}
  else if(weather==="fog"){ctx.fillStyle="rgba(182,202,195,.13)";ctx.fillRect(0,0,canvas.width,canvas.height);for(let i=0;i<5;i++){const x=((i*240+t*12)%(canvas.width+360))-180;ctx.fillStyle="rgba(207,221,215,.08)";ctx.fillRect(Math.round(x),80+i*95,330,54);}}
  const hour=(8+state.elapsed/120)%24;const night=hour<5?.46:hour<7?(7-hour)*.19:hour>21?.46:hour>18?(hour-18)*.13:0;if(night>0){ctx.fillStyle="rgba(5,13,35,"+Math.min(.48,night)+")";ctx.fillRect(0,0,canvas.width,canvas.height);}
}

function frameDt(dt){if(runtime.hitStop>0){runtime.hitStop=Math.max(0,runtime.hitStop-dt);return dt*.07;}return dt;}
function cameraOffset(){if(runtime.shake<=0) return {x:0,y:0};return {x:(Math.random()-.5)*runtime.shake,y:(Math.random()-.5)*runtime.shake};}
function update(dt,realDt){
  if(!state.running) return;runtime.world.playSeconds+=realDt;runtime.autosave+=realDt;runtime.saveFlash=Math.max(0,runtime.saveFlash-realDt);runtime.shake=Math.max(0,runtime.shake-realDt*10);updateRoll(dt);updateBandits(dt);advanceQuestFromInventory();
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
  api.animalStates.clear();api.animalCellCache.clear();for(const raw of save.animals||[]){const cellX=raw.originCellX??Math.floor(raw.x/(18*TILE_METERS));const cellY=raw.originCellY??Math.floor(raw.y/(18*TILE_METERS));api.createAnimalState(raw.species,cellX,cellY,0,{x:raw.x,y:raw.y},clone(raw));}
  state.starterHorseId=save.starterHorseId||null;state.mountedHorseId=save.mountedHorseId||null;runtime.world=clone(save.world||runtime.world);if(!Array.isArray(runtime.world.bandits)) runtime.world.bandits=createBandits();api.syncHeldItem();api.renderInventory();updateQuestHud();
}
function loadSlot(slot){const save=readSlot(slot);if(!save) return false;if(state.running) saveNow("switch");runtime.activeSlot=slot;runtime.pendingLoad=save;closeSaveSlots();api.togglePause(false);api.startGame();return true;}
function nextEmptySlot(){for(let slot=1;slot<=3;slot++) if(!readSlot(slot)) return slot;return 1;}
function onGameStarted(){
  if(runtime.pendingLoad){const save=runtime.pendingLoad;runtime.pendingLoad=null;restoreSnapshot(save);api.showToast("Spielstand "+runtime.activeSlot+" geladen",1800);}
  else{runtime.activeSlot=runtime.activeSlot||nextEmptySlot();runtime.world={questStage:0,bandits:createBandits(),opened:{},visited:{},crafted:{},playSeconds:0,weatherSeed:Math.floor(Math.random()*525)};updateQuestHud();saveNow("new");}
  runtime.autosave=0;updateSaveUi();
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
  const profiles={footstep:[95,.035,"square",.025],swing:[260,.07,"sawtooth",.035],hit:[82,.09,"square",.06],hurt:[62,.16,"sawtooth",.07],defeat:[55,.24,"triangle",.065],dodge:[180,.08,"triangle",.025],craft:[440,.14,"triangle",.04],quest:[660,.28,"sine",.045],pickup:[520,.08,"sine",.035],heal:[390,.22,"sine",.04],chest:[310,.16,"square",.035],rest:[220,.35,"sine",.03],water:[280,.12,"sine",.025],discovery:[330,.42,"triangle",.035],enemyAttack:[120,.12,"sawtooth",.04],ambient:[160,.35,"sine",.008],rain:[110,.25,"triangle",.006]};const [frequency,duration,wave,volume]=profiles[type]||profiles.ambient;const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type=wave;oscillator.frequency.setValueAtTime(frequency+(variant?variant.length%7*3:0),now);gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);oscillator.connect(gain).connect(audio.destination);oscillator.start(now);oscillator.stop(now+duration);
}

function bindUi(){
  window.addEventListener("pointerdown",()=>{const audio=ensureAudio();if(audio?.state==="suspended") audio.resume();},{once:true});window.addEventListener("keydown",(event)=>{const audio=ensureAudio();if(audio?.state==="suspended") audio.resume();if(event.code==="Space"&&state.running&&!event.repeat){event.preventDefault();dodge();}},{capture:true});
  $("continueBtn").addEventListener("click",openSaveSlots);$("closeSaveSlots").addEventListener("click",closeSaveSlots);$("saveSlotsOverlay").addEventListener("click",(event)=>{if(event.target===$("saveSlotsOverlay")) closeSaveSlots();});
  $("beginBtn").addEventListener("click",()=>{runtime.activeSlot=nextEmptySlot();});$("saveGameBtn").addEventListener("click",()=>saveNow("manual"));$("openSaveSlotsInGame").addEventListener("click",openSaveSlots);$("closeCraft").addEventListener("click",closeCraft);$("craftOverlay").addEventListener("click",(event)=>{if(event.target===$("craftOverlay")) closeCraft();});
  const indicator=document.createElement("div");indicator.id="autosaveIndicator";indicator.className="autosave-indicator hidden";indicator.textContent="✓ AUTOMATISCH GESPEICHERT";$("gamePanel").appendChild(indicator);
  const marker=document.createElement("div");marker.id="questWorldMarker";marker.className="world-prompt hidden";$("gamePanel").appendChild(marker);
  updateSaveUi();updateQuestHud();api.renderInventory();
}

const exported={
  version:"0.15",recipes,worldObjects,runtime,collisionAt,nearbyInteraction,interact,drawGround,renderables,drawRenderable,drawOverlay,
  frameDt,cameraOffset,update,dodge,isRolling:()=>!!runtime.roll,performPlayerStrike,useEquippedItem,useConsumable,onAnimalDamaged,updateAnimalSocial,sound,
  onGameStarted,saveNow,readSlot,loadSlot,snapshot,restoreSnapshot,inventoryCount,removeInventory,weatherType,advanceQuestFromInventory
};
window.__ARCHIPELAGO_V015__=exported;
bindUi();
})();
