(() => {
"use strict";

const api=window.__ARCHIPELAGO_DEBUG__;
const systems=window.__ARCHIPELAGO_V015__;
if(!api||!systems) return;

const {state,TILE_METERS,VIEW_SCALE,itemCatalog}=api;
const canvas=document.getElementById("gameCanvas");
const ctx=canvas.getContext("2d");
const $=(id)=>document.getElementById(id);
const landmark=api.landmarks.find((entry)=>entry.settlement==="eiswacht")||{x:8104,y:2504};
const CENTRE={x:landmark.x,y:landmark.y};
const VILLAGE_RADIUS=235;

Object.assign(itemCatalog,{
  rawArcticChar:{name:"Roher Eisling",short:"Eisling roh",category:"resource",width:2,height:1,maxStack:5,icon:"fish",description:"Ein fettreicher Fisch aus einem Eisloch bei Eiswacht."},
  smokedArcticChar:{name:"Geräucherter Eisling",short:"Räucherfisch",category:"food",width:2,height:1,maxStack:6,icon:"cooked",consumable:true,heal:22,stamina:18,description:"Über Wacholderholz geräuchert. Stellt Leben und Ausdauer wieder her."},
  frostTea:{name:"Frostblütentee",short:"Frosttee",category:"food",width:1,height:2,maxStack:6,icon:"potion",consumable:true,heal:8,stamina:34,description:"Selas kräftiger Tee aus dem beheizten Gewächshaus."},
  auroraShard:{name:"Auroraprisma",short:"Prisma",category:"resource",width:1,height:1,maxStack:6,icon:"crystal",description:"Ein Splitter der alten Leuchtfeuerlinse. Im Dunkeln wandert grünes Licht durch das Glas."},
  auroraLantern:{name:"Laterne der Weißnacht",short:"Auroralaterne",category:"quest",width:2,height:2,maxStack:1,icon:"lantern",description:"Eiswachts Dank für die erneuerte Linse. Ihr Licht pulsiert wie eine ruhige Aurora."}
});

if(!systems.recipes.campfire.some((recipe)=>recipe.id==="smokedArcticChar")) systems.recipes.campfire.push({
  id:"smokedArcticChar",label:"Eisling räuchern",icon:"◒",needs:{rawArcticChar:1,wood:1},output:{smokedArcticChar:2}
});

const anchors={
  square:[CENTRE.x,CENTRE.y+6],bell:[CENTRE.x-18,CENTRE.y+3],
  longhouse:[CENTRE.x,CENTRE.y-30],tableElara:[CENTRE.x-14,CENTRE.y-28],tableNjal:[CENTRE.x-7,CENTRE.y-24],tableTova:[CENTRE.x,CENTRE.y-24],tableSela:[CENTRE.x+8,CENTRE.y-24],tableOrik:[CENTRE.x+15,CENTRE.y-28],tableIven:[CENTRE.x,CENTRE.y-17],
  observatory:[CENTRE.x-68,CENTRE.y-68],weatherDeck:[CENTRE.x-72,CENTRE.y-96],
  workshop:[CENTRE.x+70,CENTRE.y-54],generator:[CENTRE.x+92,CENTRE.y-15],
  clinic:[CENTRE.x-77,CENTRE.y+28],greenhouse:[CENTRE.x-116,CENTRE.y-10],
  smokehouse:[CENTRE.x+80,CENTRE.y+31],fishRack:[CENTRE.x+55,CENTRE.y+61],fishingHole:[CENTRE.x-154,CENTRE.y+92],
  archive:[CENTRE.x-25,CENTRE.y+91],memorial:[CENTRE.x-32,CENTRE.y+28],
  hutWest:[CENTRE.x-86,CENTRE.y+96],hutEast:[CENTRE.x+57,CENTRE.y+101],supply:[CENTRE.x+111,CENTRE.y+52],
  beacon:[CENTRE.x,CENTRE.y-153],southGate:[CENTRE.x+7,CENTRE.y+137],westTrail:[CENTRE.x-119,CENTRE.y+54]
};

const villageObjects=[
  {id:"eis-longhouse",kind:"building",variant:"longhouse",x:CENTRE.x,y:CENTRE.y-44,hitW:42,hitH:15,solid:true,label:"Langhaus Zur Stillen Flamme betreten"},
  {id:"eis-observatory",kind:"building",variant:"observatory",x:CENTRE.x-68,y:CENTRE.y-82,hitW:34,hitH:16,solid:true,label:"Meteorologisches Observatorium untersuchen"},
  {id:"eis-workshop",kind:"building",variant:"workshop",x:CENTRE.x+70,y:CENTRE.y-68,hitW:38,hitH:16,solid:true,label:"Tovas Werkhof untersuchen"},
  {id:"eis-clinic",kind:"building",variant:"clinic",x:CENTRE.x-78,y:CENTRE.y+15,hitW:32,hitH:14,solid:true,label:"Selas Wärmestube betreten"},
  {id:"eis-greenhouse",kind:"building",variant:"greenhouse",x:CENTRE.x-118,y:CENTRE.y-22,hitW:31,hitH:14,solid:true,label:"Frostgewächshaus untersuchen"},
  {id:"eis-smokehouse",kind:"building",variant:"smokehouse",x:CENTRE.x+81,y:CENTRE.y+19,hitW:31,hitH:14,solid:true,label:"Räucherhaus untersuchen"},
  {id:"eis-archive",kind:"building",variant:"archive",x:CENTRE.x-25,y:CENTRE.y+79,hitW:30,hitH:14,solid:true,label:"Archiv der Weißnacht betreten"},
  {id:"eis-hut-west",kind:"building",variant:"hut",x:CENTRE.x-87,y:CENTRE.y+84,hitW:28,hitH:13,solid:true,label:"Njal und Tovas Hütte ansehen"},
  {id:"eis-hut-east",kind:"building",variant:"hut",x:CENTRE.x+58,y:CENTRE.y+89,hitW:28,hitH:13,solid:true,label:"Oriks Hütte ansehen"},
  {id:"eis-beacon",kind:"beacon",variant:"beacon",x:CENTRE.x,y:CENTRE.y-160,hitW:19,hitH:14,solid:true,label:"Nordlicht-Leuchtfeuer untersuchen"},
  {id:"eis-generator",kind:"prop",variant:"generator",x:CENTRE.x+94,y:CENTRE.y-20,hitW:12,hitH:9,solid:true,label:"Dampfgenerator untersuchen"},
  {id:"eis-icewell",kind:"prop",variant:"iceWell",x:CENTRE.x+23,y:CENTRE.y+16,hitW:11,hitH:9,solid:true,label:"Blaues Eisbecken untersuchen"},
  {id:"eis-memorial",kind:"prop",variant:"memorial",x:CENTRE.x-34,y:CENTRE.y+22,hitW:9,hitH:7,solid:true,label:"Denkmal der Weißnacht lesen"},
  {id:"eis-fishrack",kind:"prop",variant:"fishRack",x:CENTRE.x+58,y:CENTRE.y+54,hitW:18,hitH:7,solid:true,label:"Fischgestell ansehen"},
  {id:"eis-sled",kind:"prop",variant:"sled",x:CENTRE.x+104,y:CENTRE.y+50,hitW:17,hitH:7,solid:true,label:"Expeditionsschlitten untersuchen"},
  {id:"eis-weather-mast",kind:"prop",variant:"weatherMast",x:CENTRE.x-72,y:CENTRE.y-105,hitW:7,hitH:6,solid:true,label:"Wetterfahne ablesen"},
  {id:"eis-bell",kind:"prop",variant:"bell",x:CENTRE.x-18,y:CENTRE.y+1,hitW:7,hitH:6,solid:true,label:"Schichtglocke untersuchen"},
  {id:"eis-fishing-hole",kind:"discovery",variant:"fishingHole",x:CENTRE.x-157,y:CENTRE.y+95,hitW:13,hitH:8,solid:false,label:"Im Eisloch angeln"},
  {id:"eis-survey-west",kind:"discovery",variant:"surveyMarker",x:CENTRE.x-164,y:CENTRE.y-118,hitW:6,hitH:6,solid:true,shard:1,label:"Vereiste Messstation untersuchen"},
  {id:"eis-survey-east",kind:"discovery",variant:"surveyMarker",x:CENTRE.x+157,y:CENTRE.y-113,hitW:6,hitH:6,solid:true,shard:2,label:"Zerbrochenes Prisma bergen"},
  {id:"eis-survey-south",kind:"discovery",variant:"surveyMarker",x:CENTRE.x+145,y:CENTRE.y+138,hitW:6,hitH:6,solid:true,shard:3,label:"Verschneiten Peilstein untersuchen"},
  ...[-92,-46,0,46,92].map((offset,index)=>({id:"eis-lamp-north-"+index,kind:"decor",variant:"lamp",x:CENTRE.x+offset,y:CENTRE.y-8,hitW:4,hitH:4,solid:false})),
  ...[-76,-25,27,78].map((offset,index)=>({id:"eis-lamp-south-"+index,kind:"decor",variant:"lamp",x:CENTRE.x+offset,y:CENTRE.y+62,hitW:4,hitH:4,solid:false})),
  ...[-1,1].map((side)=>({id:"eis-gate-post-"+side,kind:"decor",variant:"gatePost",x:CENTRE.x+side*19,y:CENTRE.y+132,hitW:4,hitH:4,solid:true}))
];

const residentDefinitions=[
  {id:"elara",name:"Dr. Elara Voss",role:"Leiterin · Klimatologin",speed:9,look:{skin:"#d6a071",hair:"#d7d2c6",hairStyle:"bun",outfit:"scholar",shirt:"#536f7b",cloak:"#d9d7ca"},relations:"Sela ist ihre engste Vertraute; Oriks Warnungen hält sie für übertriebene, aber nützliche Vorsicht.",intro:"Du musst von weit südlich kommen. Ich bin Elara Voss. Eiswacht misst das Wetter, bevor es die übrigen Inseln erreicht – und hält sein altes Licht am Leben.",personal:"Ich kam für eine zweijährige Messreihe. Das war vor elf Wintern. Irgendwann wurde aus Forschung Verantwortung.",lore:"Eiswacht entstand um das Wrack der Nordlicht. Unsere Gründer bauten zuerst das Leuchtfeuer und erst danach Dächer für sich selbst.",schedule:[[0,"tableElara","schläft im Langhaus"],[390,"observatory","wertet Nachtmessungen aus"],[720,"square","leitet den Schichtwechsel"],[780,"weatherDeck","prüft die Höhenmesser"],[990,"archive","vergleicht alte Wetterbücher"],[1110,"tableElara","isst mit dem Dorf"],[1260,"observatory","beobachtet die Aurora"]]},
  {id:"tova",name:"Tova Rune",role:"Mechanikerin · Feuerwartin",speed:10,look:{skin:"#bb7d55",hair:"#6e3528",hairStyle:"mohawk",outfit:"worker",shirt:"#7b5137",cloak:"#303b40"},relations:"Mit Njal verheiratet; behandelt Iven wie einen viel zu neugierigen Lehrling.",intro:"Nicht auf das Kupferrohr treten. Tova Rune – ich halte Generator, Öfen und alles andere am Laufen, das eigentlich längst aufgeben wollte.",personal:"Njal behauptet, ich rede mit Maschinen. Unsinn. Maschinen hören wenigstens zu.",lore:"Unter dem Werkhof liegt noch der Kessel der Nordlicht. Ohne ihn wäre Eiswacht in der ersten Weißnacht erfroren.",schedule:[[0,"hutWest","schläft zu Hause"],[390,"workshop","heizt die Schmiede an"],[720,"square","verteilt Reparaturaufträge"],[780,"generator","wartet den Dampfgenerator"],[930,"supply","prüft Expeditionskisten"],[1110,"tableTova","isst mit Njal"],[1230,"workshop","schließt den Werkhof"]]},
  {id:"njal",name:"Njal Rune",role:"Eisfischer · Pfadfinder",speed:10.5,look:{skin:"#a96f4f",hair:"#342c29",hairStyle:"long",beard:"#342c29",beardStyle:"full",outfit:"ranger",shirt:"#4b665e",cloak:"#7a694f"},relations:"Mit Tova verheiratet; vertraut Murr mehr als jedem Kompass.",intro:"Njal Rune. Wenn du auf dem Eis hinter mir gehst, tritt in meine Spuren – außer Murr läuft plötzlich weg. Dann läufst du auch.",personal:"Tova flickt meine Schlitten, ich bringe ihr Fisch und Gründe, sie wieder zu flicken. So hält eine Ehe im Norden.",lore:"Die Eislinge meiden das Wasser unter dem Leuchtfeuer. Seit die Linse brach, ziehen sie noch weiter nach Westen.",schedule:[[0,"hutWest","schläft zu Hause"],[300,"fishingHole","prüft die Eisnetze"],[660,"fishRack","hängt den Fang auf"],[720,"square","meldet die Eiswege"],[790,"smokehouse","räuchert Eislinge"],[930,"westTrail","markiert einen sicheren Pfad"],[1110,"tableNjal","isst mit Tova"],[1230,"hutWest","schärft seine Eisaxt"]]},
  {id:"sela",name:"Sela Marr",role:"Heilerin · Botanikerin",speed:9.5,look:{skin:"#7f523e",hair:"#161a1c",hairStyle:"braid",outfit:"scholar",shirt:"#58765c",cloak:"#e0ded0"},relations:"Elara ist ihre älteste Freundin; Orik hilft ihr beim Entziffern alter Heilrezepte.",intro:"Setz dich, wenn deine Finger taub werden. Ich bin Sela. Die Wärmestube ist klein, aber wir verlieren hier niemanden an Stolz.",personal:"Im Süden nennt man die Pflanzen hier Unkraut. Im Norden entscheidet dieses Unkraut, wer den Winter übersteht.",lore:"Die Frostblüte öffnet sich nur, wenn die Aurora stark ist. In der Weißnacht blühten alle Pflanzen gleichzeitig – mitten im Sturm.",schedule:[[0,"clinic","führt Nachtwache"],[420,"clinic","behandelt Erfrierungen"],[720,"square","prüft die Schichtmannschaften"],[780,"greenhouse","pflegt Frostblüten"],[930,"hutEast","macht Hausbesuche"],[1110,"tableSela","serviert heißen Tee"],[1230,"clinic","führt Nachtwache"]]},
  {id:"orik",name:"Orik Vael",role:"Chronist · Funker",speed:8,look:{skin:"#c08c68",hair:"#b8b5ae",hairStyle:"undercut",beard:"#aaa8a1",beardStyle:"short",outfit:"scholar",shirt:"#59606f",cloak:"#4b3e4f"},relations:"Hat Iven aufgenommen; streitet mit Elara darüber, ob Geschichte Warnung oder Beweis sein muss.",intro:"Orik Vael, Hüter von Dingen, die alle anderen lieber vergessen. Wenn du eine schöne Geschichte willst, geh ins Langhaus. Für die wahre komm ins Archiv.",personal:"Iven nennt mich Großvater, wenn er etwas will, und Orik, wenn er etwas angestellt hat. Meistens höre ich beides am selben Tag.",lore:"In der Weißnacht antwortete etwas unter dem Gletscher auf unsere Glocke. Neun Menschen folgten dem Licht. Nur ihre Schatten kamen zurück.",schedule:[[0,"hutEast","schläft unruhig"],[450,"archive","ordnet Expeditionsberichte"],[720,"square","protokolliert den Schichtwechsel"],[770,"memorial","reinigt die Namenstafel"],[840,"archive","zeichnet Funkmeldungen auf"],[1050,"tableOrik","erzählt Kindern Geschichten"],[1170,"beacon","kontrolliert die alte Frequenz"],[1260,"hutEast","hört den Nachtfunk"]]},
  {id:"iven",name:"Iven Vael",role:"Kurier · Lehrling",speed:13,look:{skin:"#d79a62",hair:"#7a4b2e",hairStyle:"tousled",outfit:"traveler",shirt:"#b1783f",cloak:"#416372"},relations:"Oriks Ziehsohn; lernt bei Tova, obwohl er häufiger Teile verliert als repariert.",intro:"Iven! Also, eigentlich Iven Vael, offizieller Kurier von Eiswacht. Wenn du etwas schnell brauchst, bin ich zuständig. Wenn es heil ankommen soll, vielleicht auch.",personal:"Orik sagt, Neugier sei gefährlich. Tova sagt, nur ohne Werkzeug. Deshalb trage ich beides.",lore:"Ich habe grünes Licht im südlichen Peilstein gesehen. Es war tagsüber. Orik glaubt mir, aber er glaubt leider auch sehr viele schlimme Dinge.",schedule:[[0,"hutEast","schläft bei Orik"],[420,"supply","zählt Vorräte"],[540,"workshop","lernt bei Tova"],[660,"clinic","bringt Sela Verbände"],[720,"square","läutet den Schichtwechsel"],[750,"observatory","trägt Elaras Messblätter"],[840,"southGate","prüft die Wegmarken"],[930,"archive","hilft Orik widerwillig"],[1050,"tableIven","hört Geschichten"],[1140,"square","spielt mit Murr"],[1230,"hutEast","schläft bei Orik"]]}
];

const residents=residentDefinitions.map((definition)=>({
  ...definition,kind:"resident",x:anchors[definition.schedule[0][1]][0],y:anchors[definition.schedule[0][1]][1],dir:"down",moving:false,gait:0,activity:"",trackDistance:0
}));
const dog={id:"murr",kind:"dog",name:"Murr",x:anchors.workshop[0]+7,y:anchors.workshop[1]+5,dir:"left",moving:false,gait:0,activity:"bewacht den Werkhof",trackDistance:0};

function worldState(){
  const world=systems.runtime.world;
  if(!world.eiswacht||typeof world.eiswacht!=="object") world.eiswacht={questStage:0,foundShards:{},rapport:{},discoveries:{},beaconLit:false,lastFishDay:-1,lastTreatmentDay:-1,arrived:false};
  const local=world.eiswacht;
  local.foundShards=local.foundShards||{};local.rapport=local.rapport||{};local.discoveries=local.discoveries||{};
  return local;
}

function gameMinute(){return Math.floor((8*60+state.elapsed*.45)%1440);}
function gameDay(){return Math.floor((8*60+state.elapsed*.45)/1440);}
function blizzardActive(){return Math.floor((state.elapsed+(systems.runtime.world.weatherSeed||0))/75)%7===1;}
function nightActive(){const minute=gameMinute();return minute>=1230||minute<270;}
function villageDistance(){return Math.hypot(state.player.x-CENTRE.x,state.player.y-CENTRE.y);}

function scheduleEntry(resident,minute=gameMinute()){
  let entry=resident.schedule[0];
  for(const candidate of resident.schedule) if(candidate[0]<=minute) entry=candidate; else break;
  if(blizzardActive()){
    if(resident.id==="elara") return [minute,"observatory","verfolgt den weißen Sturm"];
    if(resident.id==="tova") return [minute,"generator","hält den Generator unter Last"];
    const seats={njal:"tableNjal",sela:"tableSela",orik:"tableOrik",iven:"tableIven"};
    return [minute,seats[resident.id]||"longhouse","wartet den Sturm im Langhaus ab"];
  }
  return entry;
}

function moveActor(actor,target,activity,dt,speed){
  const dx=target[0]-actor.x,dy=target[1]-actor.y,distance=Math.hypot(dx,dy);
  actor.activity=activity;
  if(villageDistance()>900){actor.x=target[0];actor.y=target[1];actor.moving=false;return;}
  if(distance<.7){actor.x=target[0];actor.y=target[1];actor.moving=false;return;}
  const step=Math.min(distance,speed*dt);const nx=dx/distance,ny=dy/distance;
  actor.x+=nx*step;actor.y+=ny*step;actor.moving=true;actor.gait+=step*.78;
  actor.dir=Math.abs(dx)>Math.abs(dy)?dx>0?"right":"left":dy>0?"down":"up";
  actor.trackDistance+=step;
  if(actor.trackDistance>6){actor.trackDistance%=6;api.emitGroundTrack(actor.x,actor.y,actor.dir,"foot");}
}

function updateResidents(dt){
  for(const resident of residents){const entry=scheduleEntry(resident);moveActor(resident,anchors[entry[1]],entry[2],dt,resident.speed);}
  const njal=residents.find((entry)=>entry.id==="njal");
  const dogTarget=blizzardActive()?anchors.tableIven:njal.moving?[njal.x-5,njal.y+4]:gameMinute()>1080?anchors.longhouse:[anchors.workshop[0]+8,anchors.workshop[1]+7];
  moveActor(dog,dogTarget,blizzardActive()?"liegt am Ofen":njal.moving?"folgt Njal":"bewacht den Werkhof",dt,15);
}

function closeDialogue(){const overlay=$("dialogOverlay");if(overlay) overlay.classList.add("hidden");systems.runtime.eiswachtTalkingId=null;state.paused=false;}
function showDialogue(speaker,text,actions=[]){
  state.paused=true;$("dialogSpeaker").textContent=speaker;$("dialogText").textContent=text;const box=$("dialogActions");box.replaceChildren();
  const choices=actions.length?actions:[{label:"Schließen",action:closeDialogue}];
  for(const choice of choices){const button=document.createElement("button");button.type="button";button.textContent=choice.label;if(choice.primary) button.classList.add("primary");button.addEventListener("click",choice.action);box.appendChild(button);}
  $("dialogOverlay").classList.remove("hidden");
}
function saveQuiet(){systems.saveNow?.("auto");}
function shardCount(){return systems.inventoryCount("auroraShard");}

function talkToResident(resident){
  systems.runtime.eiswachtTalkingId=resident.id;
  const local=worldState();local.rapport[resident.id]=(local.rapport[resident.id]||0)+1;
  const greeting=(local.rapport[resident.id]===1?resident.intro:resident.name.split(" ")[resident.name.split(" ").length-1]+" blickt von der Arbeit auf. ")+" Gerade "+resident.activity+".";
  const actions=[
    {label:"Deine Arbeit",action:()=>showDialogue(resident.name,resident.personal,[{label:"Zurück",action:()=>talkToResident(resident)}])},
    {label:"Geschichte Eiswachts",action:()=>showDialogue(resident.name,resident.lore,[{label:"Zurück",action:()=>talkToResident(resident)}])},
    {label:"Beziehungen",action:()=>showDialogue(resident.name,resident.relations,[{label:"Zurück",action:()=>talkToResident(resident)}])}
  ];
  if(resident.id==="elara"&&local.questStage===0) actions.unshift({label:"Das Leuchtfeuer",primary:true,action:()=>{
    local.questStage=1;showDialogue("Dr. Elara Voss","Die Linse zerbrach in drei Auroraprismen. Unsere alten Peilsteine liegen westlich, östlich und südlich des Dorfes. Bring die Splitter zu Tova – bevor der nächste weiße Sturm die Wege schließt.",[{label:"Ich finde sie",primary:true,action:()=>{closeDialogue();api.showToast("Eiswacht-Aufgabe · Drei Auroraprismen bergen",2600);saveQuiet();}}]);
  }});
  if(resident.id==="tova"&&local.questStage===1&&shardCount()>=3) actions.unshift({label:"Linse reparieren",primary:true,action:()=>{
    systems.removeInventory("auroraShard",3);local.questStage=2;saveQuiet();showDialogue("Tova Rune","Alle drei – und keiner blind geworden. Gib mir einen Moment … So. Die Fassung hält. Trag die Linse zum Leuchtfeuer und setz sie unter der Glocke ein.",[{label:"Zum Leuchtfeuer",primary:true,action:()=>{closeDialogue();api.showToast("Linse repariert · Nordlicht-Leuchtfeuer aktivieren",2500);}}]);
  }});
  if(resident.id==="njal") actions.unshift({label:"Räucherfisch kaufen · 2 Münzen",action:()=>{
    if(systems.inventoryCount("coin")<2){showDialogue("Njal Rune","Zwei Inselmünzen. Nicht weil der Fisch selten wäre – das Salz ist es.",[{label:"Zurück",action:()=>talkToResident(resident)}]);return;}
    const added=api.addInventoryItem("smokedArcticChar",1);if(!added) api.showToast("Kein Platz im Rucksack");else{systems.removeInventory("coin",2);api.showToast("+1 Geräucherter Eisling");}closeDialogue();
  }});
  if(resident.id==="sela") actions.unshift({label:"Behandeln lassen",action:()=>{
    const day=gameDay();if(local.lastTreatmentDay===day){showDialogue("Sela Marr","Mehr Wärme als Medizin brauchst du heute nicht. Im Langhaus ist der Ofen frei.",[{label:"Zurück",action:()=>talkToResident(resident)}]);return;}
    local.lastTreatmentDay=day;state.player.health=Math.min(100,state.player.health+35);state.player.stamina=100;api.addInventoryItem("frostTea",1);closeDialogue();api.showToast("Versorgt · +35 Leben · +1 Frostblütentee",2200);saveQuiet();
  }});
  actions.push({label:"Abschied",action:closeDialogue});showDialogue(resident.name+" · "+resident.role,greeting,actions);saveQuiet();
}

const objectTexts={
  longhouse:"Die Stille Flamme wurde um den ersten Kessel der gestrandeten Nordlicht gebaut. An der Decke hängen Namensbänder jeder Expedition, die lebend zurückkehrte.",
  observatory:"Messnadeln zittern hinter vereistem Glas. Eine Karte zeigt Sturmfronten, die Tage später weit im Süden ankommen.",
  workshop:"Kupferrohre führen vom alten Schiffskessel in jedes Haus. Tova hat auf eine Wand geschrieben: NICHT DREHEN – besonders für Iven.",
  clinic:"Vier Betten, ein eiserner Ofen und Reihen getrockneter Frostblüten. Sela hält eines davon immer für Reisende frei.",
  greenhouse:"Unter doppeltem Glas wachsen Frostblüte, Eisklee und eine einzige störrische Tomatenpflanze namens Sommer.",
  smokehouse:"Wacholderrauch und Salz konservieren den Fang. Kerben im Türrahmen zählen besonders harte Winter – es sind siebenundvierzig.",
  archive:"Wetterbücher, Funkprotokolle und Karten füllen die Regale. Ein versiegeltes Fach trägt nur die Aufschrift WEISSNACHT.",
  hut:"Das kleine Haus steht auf Kufen, damit es versetzt werden kann, wenn das Eis arbeitet. Filz und Moos dichten jede Fuge.",
  generator:"Der Dampfgenerator schlägt in einem ruhigen Dreiertakt. Eine vierte, leisere Vibration scheint aus dem Boden zu kommen.",
  iceWell:"Das Wasser ist tiefblau und erstaunlich warm. Unter der Oberfläche verlaufen feine grüne Lichtadern.",
  memorial:"WEISSNACHT, 17. WINTER: Aila, Benno, Cor, Dagna, Eren, Fara, Gorm, Heda, Isak. Darunter steht: Folgt keinem Licht, das euren Namen kennt.",
  fishRack:"Eislinge hängen im Wind, jeder mit Njals Knoten markiert. Ein leerer Haken ist mit MURR beschriftet.",
  sled:"Der Schlitten trägt Seile, Schneeschuhe, Peilstangen und eine Notkiste. Drei Kratzspuren ziehen sich quer über die Unterseite.",
  weatherMast:"Die Fahne zeigt starken Nordostwind. Kleine Glöckchen warnen vor Druckabfall – eine davon klingelt gegen den Wind.",
  bell:"Die Glocke stammt von der Nordlicht. Um 12:00 ruft Iven damit zum Schichtwechsel; im Sturm bedeutet dreimaliges Läuten: alle ins Langhaus.",
  gatePost:"In den Pfosten sind die Regeln der Eiswege geschnitzt: Abstand halten. Seil prüfen. Bei grünem Licht umkehren."
};

function inspectObject(object){
  const local=worldState();
  if(object.kind==="beacon"){
    if(local.questStage===2){if(!api.addInventoryItem("auroraLantern",1)){api.showToast("Schaffe Platz für Eiswachts besondere Belohnung",2200);return;}local.questStage=3;local.beaconLit=true;api.addInventoryItem("coin",18);api.addInventoryItem("frostTea",2);saveQuiet();systems.sound?.("discovery");showDialogue("Nordlicht-Leuchtfeuer","Die reparierte Linse fängt erst weißes, dann tiefgrünes Licht. Weit unter dem Eis antwortet ein dumpfer Ton – und verstummt, als die Glocke einmal von selbst schlägt. Eiswachts Dächer leuchten wieder.",[{label:"Das Licht steht",primary:true,action:()=>{closeDialogue();api.showToast("Eiswacht gerettet · 18 Münzen · Frosttee · Auroralaterne",3200);}}]);return;
    }
    const text=local.beaconLit?"Die erneuerte Linse schickt einen grünen Puls über das Packeis. Reisende können Eiswacht wieder aus vielen Kilometern Entfernung finden.":local.questStage===1?"Die Messingfassung ist leer. Drei Kerben zeigen, wo die Auroraprismen saßen. Tova kann eine neue Linse zusammensetzen.":"Das Leuchtfeuer ist dunkel. Im Sockel liegen Glassplitter, die wie gefrorenes Nordlicht schimmern.";
    showDialogue("Nordlicht-Leuchtfeuer",text);return;
  }
  if(object.variant==="surveyMarker"){
    if(local.foundShards[object.id]){api.showToast("Der Peilstein ist leer · die Markierung zeigt weiter nach Eiswacht",1900);return;}
    const added=api.addInventoryItem("auroraShard",1);if(!added){api.showToast("Kein Platz für das Auroraprisma",1900);return;}
    local.foundShards[object.id]=true;systems.sound?.("discovery");api.showToast("Auroraprisma geborgen · "+Object.keys(local.foundShards).length+" / 3",2300);saveQuiet();return;
  }
  if(object.variant==="fishingHole"){
    const day=gameDay();if(local.lastFishDay===day){api.showToast("Das Eisloch ist für heute leergefischt",1800);return;}
    const added=api.addInventoryItem("rawArcticChar",1);if(!added){api.showToast("Kein Platz für den Eisling",1800);return;}
    local.lastFishDay=day;api.showToast("Ein Eisling beißt an · +1 Roher Eisling",2200);systems.sound?.("water");saveQuiet();return;
  }
  local.discoveries[object.id]=true;
  if(object.variant==="longhouse"){state.player.stamina=100;api.showToast("Die Stille Flamme wärmt dich · Ausdauer erholt",1900);}
  showDialogue(object.variant==="memorial"?"Denkmal der Weißnacht":object.label||"Eiswacht",objectTexts[object.variant]||"Dieses Detail gehört zu Eiswachts täglichem Überleben.");saveQuiet();
}

function nearbyEisInteraction(){
  let best=null;
  for(const resident of residents){const distance=Math.hypot(state.player.x-resident.x,state.player.y-resident.y);if(distance<17&&(!best||distance<best.distance)) best={type:"eiswacht",resident,distance,label:"Mit "+resident.name+" sprechen",mobileLabel:"Reden"};}
  const dogDistance=Math.hypot(state.player.x-dog.x,state.player.y-dog.y);if(dogDistance<14&&(!best||dogDistance<best.distance)) best={type:"eiswacht",dog,distance:dogDistance,label:"Murr begrüßen",mobileLabel:"Streicheln"};
  for(const object of villageObjects){if(object.kind==="decor"&&object.variant==="lamp") continue;const distance=Math.max(0,Math.hypot(state.player.x-object.x,state.player.y-object.y)-Math.max(object.hitW||4,object.hitH||4)*.35);if(distance<18&&(!best||distance<best.distance)) best={type:"eiswacht",object,distance,label:object.label||"Eiswacht-Objekt ansehen",mobileLabel:"Ansehen"};}
  return best;
}

function worldToScreen(x,y,camX,camY){return {x:(x-camX)*VIEW_SCALE+canvas.width/2,y:(y-camY)*VIEW_SCALE+canvas.height/2};}
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function drawArcticBuilding(object,p){
  const editor=window.__ARCHIPELAGO_ASSET_EDITOR__;const assetId="prop_eis_"+object.variant;const sizes={longhouse:[108,72],observatory:[82,76],workshop:[88,68],clinic:[76,60],greenhouse:[76,58],smokehouse:[74,60],archive:[72,58],hut:[68,54],beacon:[58,98]};const size=sizes[object.variant]||[70,56];
  if(editor?.drawArtistSizedOverride(assetId,ctx,p.x-size[0]/2,p.y-size[1],size[0],size[1],{animation:object.variant==="beacon"&&worldState().beaconLit?"lit":"idle"})) return;
  const night=nightActive();const glow=night||blizzardActive();
  if(object.variant==="observatory"){
    rect(p.x-38,p.y-13,76,15,"rgba(9,17,23,.28)");rect(p.x-31,p.y-41,62,39,"#52656b");rect(p.x-27,p.y-45,54,8,"#d9e7e4");rect(p.x-25,p.y-63,50,25,"#7f9599");rect(p.x-20,p.y-68,40,7,"#e9f3ef");rect(p.x-4,p.y-74,8,35,"#34464d");rect(p.x+1,p.y-82,38,6,"#98abad");rect(p.x+35,p.y-84,8,10,"#dce8e4");rect(p.x-14,p.y-29,11,13,glow?"#e7c978":"#31505a");rect(p.x+8,p.y-29,11,13,glow?"#e7c978":"#31505a");return;
  }
  if(object.variant==="greenhouse"){
    rect(p.x-36,p.y-9,72,12,"rgba(9,17,23,.26)");rect(p.x-33,p.y-38,66,36,"#476167");rect(p.x-29,p.y-42,58,8,"#dce9e5");for(let x=-25;x<=23;x+=12){rect(p.x+x,p.y-37,9,28,"rgba(113,181,177,.42)");rect(p.x+x+8,p.y-37,3,28,"#8fa5a3");}rect(p.x-13,p.y-15,26,13,"#426044");rect(p.x-7,p.y-24,4,12,"#77a75c");rect(p.x+8,p.y-21,4,9,"#9cc267");return;
  }
  if(object.variant==="beacon"){
    const lit=worldState().beaconLit;rect(p.x-24,p.y-9,48,12,"rgba(8,14,18,.3)");rect(p.x-17,p.y-65,34,61,"#58666a");rect(p.x-12,p.y-69,24,8,"#d9e4df");rect(p.x-21,p.y-78,42,13,"#333f44");rect(p.x-16,p.y-91,32,17,"#8d7046");rect(p.x-11,p.y-87,22,10,lit?"#a7f0ba":"#293c42");rect(p.x-4,p.y-104,8,14,"#c9d8d4");if(lit){ctx.fillStyle="rgba(104,235,154,.16)";ctx.fillRect(Math.round(p.x-90),Math.round(p.y-112),180,65);rect(p.x-65,p.y-94,130,4,"rgba(151,255,184,.28)");}return;
  }
  const palettes={longhouse:["#59473e","#7d6250","#dfe9e5"],workshop:["#4e5050","#76523a","#d6e2df"],clinic:["#5d6b6d","#829397","#e4eeeb"],smokehouse:["#51433b","#735743","#d8e3df"],archive:["#4a4652","#686374","#dce6e3"],hut:["#554940","#745f4d","#dce7e3"]};const colors=palettes[object.variant]||palettes.hut;const width=object.variant==="longhouse"?102:object.variant==="workshop"?84:object.variant==="clinic"?72:70;const height=object.variant==="longhouse"?45:38;
  rect(p.x-width/2,p.y-7,width,11,"rgba(8,14,18,.28)");rect(p.x-width/2+5,p.y-height,width-10,height,colors[0]);rect(p.x-width/2,p.y-height-8,width,13,colors[1]);rect(p.x-width/2+6,p.y-height-13,width-12,8,colors[2]);
  for(let wx=p.x-width/2+14;wx<p.x+width/2-12;wx+=25){rect(wx,p.y-height+13,10,12,glow?"#eac875":"#36515a");rect(wx+2,p.y-height+15,6,2,glow?"#fff0a3":"#59727a");}
  rect(p.x-7,p.y-22,14,20,"#302924");rect(p.x+3,p.y-13,2,2,"#d6af55");
  if(object.variant==="longhouse"){rect(p.x-43,p.y-height-23,12,18,"#4b3c35");for(let i=0;i<3;i++) rect(p.x-41+i*5+Math.sin(state.elapsed+i)*2,p.y-height-30-i*8,7,7,"rgba(206,219,215,.18)");}
  if(object.variant==="workshop"){rect(p.x+22,p.y-height-25,12,23,"#42494a");rect(p.x+24,p.y-height-31,9,8,"rgba(171,188,184,.22)");rect(p.x-34,p.y-18,14,5,"#d1783d");}
  if(object.variant==="clinic"){rect(p.x-3,p.y-height-4,6,18,"#e8eee9");rect(p.x-9,p.y-height+2,18,6,"#e8eee9");}
  if(object.variant==="smokehouse") for(let i=0;i<3;i++) rect(p.x-27+i*26,p.y-height-22-i*6,9,9,"rgba(116,93,74,.18)");
  if(object.variant==="archive"){rect(p.x-30,p.y-height-4,60,5,"#a9b7b5");rect(p.x-24,p.y-height-8,48,4,"#dce8e4");}
}

function drawVillageProp(object,p){
  const editor=window.__ARCHIPELAGO_ASSET_EDITOR__;const assetId="prop_eis_"+object.variant;if(editor?.drawArtistSizedOverride(assetId,ctx,p.x-24,p.y-42,48,42,{animation:"idle"})) return;
  const v=object.variant;
  if(v==="generator"){rect(p.x-22,p.y-19,44,20,"#3c474a");rect(p.x-18,p.y-25,29,12,"#6f7b78");rect(p.x+12,p.y-34,8,24,"#855b3c");rect(p.x-10,p.y-14,12,8,"#d18b42");rect(p.x-7,p.y-12,6,4,"#f1c66f");}
  else if(v==="iceWell"||v==="fishingHole"){rect(p.x-21,p.y-7,42,10,"rgba(17,41,53,.28)");rect(p.x-17,p.y-11,34,14,"#d8e8e5");rect(p.x-12,p.y-8,24,8,"#286879");rect(p.x-7,p.y-6,14,3,"rgba(104,235,191,.32)");}
  else if(v==="memorial"||v==="surveyMarker"){rect(p.x-8,p.y-37,16,38,"#586565");rect(p.x-11,p.y-40,22,7,"#dce8e3");rect(p.x-4,p.y-30,8,3,v==="surveyMarker"?"#78d89a":"#2c3537");rect(p.x-5,p.y-19,10,2,"#343d3e");}
  else if(v==="fishRack"){rect(p.x-27,p.y-31,5,32,"#5b493a");rect(p.x+22,p.y-31,5,32,"#5b493a");rect(p.x-24,p.y-29,48,4,"#856747");for(let x=-18;x<=18;x+=12){rect(p.x+x,p.y-24,5,14,"#9aa9a0");rect(p.x+x+1,p.y-21,3,4,"#c6d2c8");}}
  else if(v==="sled"){rect(p.x-29,p.y-10,58,5,"#4e3b31");rect(p.x-24,p.y-18,43,11,"#806143");rect(p.x-26,p.y,53,3,"#c3d4d0");rect(p.x+18,p.y-24,9,14,"#aa8150");}
  else if(v==="weatherMast"){rect(p.x-2,p.y-53,5,55,"#465359");rect(p.x,p.y-52,28,3,"#9aa9a6");rect(p.x+22,p.y-58,11,8,"#c77947");rect(p.x-9,p.y-31,20,3,"#d9e4df");}
  else if(v==="bell"){rect(p.x-3,p.y-35,6,37,"#5f4735");rect(p.x-15,p.y-36,30,4,"#7f603f");rect(p.x-8,p.y-33,16,14,"#aa8247");rect(p.x-3,p.y-18,6,6,"#d6ad5d");}
  else if(v==="lamp"){ctx.fillStyle="rgba(236,199,103,.12)";ctx.fillRect(Math.round(p.x-17),Math.round(p.y-31),34,30);rect(p.x-2,p.y-22,4,24,"#3f4d50");rect(p.x-5,p.y-29,10,9,"#bb934d");rect(p.x-3,p.y-27,6,5,"#f0cf76");}
  else if(v==="gatePost"){rect(p.x-4,p.y-29,8,31,"#4f5d5e");rect(p.x-7,p.y-33,14,7,"#d9e5e1");rect(p.x-2,p.y-20,4,4,"#73c996");}
}

function drawResident(resident,camX,camY){
  const p=worldToScreen(resident.x,resident.y,camX,camY);if(p.x<-70||p.y<-90||p.x>canvas.width+70||p.y>canvas.height+70) return;
  const editor=window.__ARCHIPELAGO_ASSET_EDITOR__;const entity={...resident,status:"alive",moving:resident.moving,dir:resident.dir,gait:resident.gait,talking:systems.runtime.eiswachtTalkingId===resident.id};
  if(!editor?.drawArtistSpriteOverride("npc_eis_"+resident.id,entity,ctx,p.x,p.y)) api.drawCharacter(ctx,p.x,p.y,{...state.player,...resident.look,id:"eis:"+resident.id,name:"",x:resident.x,y:resident.y,dir:resident.dir,moving:resident.moving,walkTime:resident.gait,actionType:null,heldItem:null},2,false);
  ctx.textAlign="center";ctx.font="10px Georgia";ctx.fillStyle="#091316";ctx.fillText(resident.name,Math.round(p.x+1),Math.round(p.y-55));ctx.fillStyle="#e9e2ca";ctx.fillText(resident.name,Math.round(p.x),Math.round(p.y-56));
  if(Math.hypot(state.player.x-resident.x,state.player.y-resident.y)<55){ctx.font="7px Courier New";ctx.fillStyle="#91aaa8";ctx.fillText(resident.activity,Math.round(p.x),Math.round(p.y-45));}
}
function drawDog(camX,camY){const p=worldToScreen(dog.x,dog.y,camX,camY);const editor=window.__ARCHIPELAGO_ASSET_EDITOR__;if(editor?.drawArtistSpriteOverride("eisDog",dog,ctx,p.x,p.y)) return;const flip=dog.dir==="left"?-1:1;ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y));ctx.scale(flip,1);rect(-15,-4,30,6,"rgba(8,14,17,.24)");rect(-12,-14,20,12,"#5d554c");rect(6,-17,12,11,"#423d38");rect(9,-23,4,8,"#332f2c");rect(16,-22,4,8,"#332f2c");rect(-17,-15,7,4,"#83786a");rect(-8,-4,4,10,"#403b37");rect(5,-4,4,10,"#403b37");rect(16,-13,2,2,"#d9c96c");ctx.restore();}

function drawVillageGround(camX,camY){
  if(Math.hypot(camX-CENTRE.x,camY-CENTRE.y)>650) return;
  const square=worldToScreen(CENTRE.x,CENTRE.y+12,camX,camY);rect(square.x-58*VIEW_SCALE,square.y-32*VIEW_SCALE,116*VIEW_SCALE,64*VIEW_SCALE,"rgba(104,122,119,.22)");
  const paths=[[CENTRE.x,CENTRE.y+8,CENTRE.x,CENTRE.y-157],[CENTRE.x,CENTRE.y+8,CENTRE.x,CENTRE.y+138],[CENTRE.x-158,CENTRE.y+93,CENTRE.x+112,CENTRE.y+48],[CENTRE.x-118,CENTRE.y-14,CENTRE.x+95,CENTRE.y-18],[CENTRE.x-86,CENTRE.y+81,CENTRE.x+61,CENTRE.y+88]];
  for(const [ax,ay,bx,by] of paths){const a=worldToScreen(ax,ay,camX,camY),b=worldToScreen(bx,by,camX,camY);ctx.strokeStyle="rgba(79,99,100,.32)";ctx.lineWidth=16;ctx.beginPath();ctx.moveTo(Math.round(a.x),Math.round(a.y));ctx.lineTo(Math.round(b.x),Math.round(b.y));ctx.stroke();ctx.strokeStyle="rgba(208,224,219,.28)";ctx.lineWidth=3;ctx.stroke();}
  for(const object of villageObjects.filter((entry)=>entry.variant==="lamp")){const p=worldToScreen(object.x,object.y,camX,camY);ctx.fillStyle="rgba(234,190,91,.07)";ctx.fillRect(Math.round(p.x-23),Math.round(p.y-12),46,20);}
}

function updateVillageUi(){
  const panel=$("eiswachtPanel");if(!panel) return;const distance=villageDistance();const visible=distance<VILLAGE_RADIUS;panel.classList.toggle("hidden",!visible);if(!visible) return;
  const local=worldState();const stageText=local.questStage===0?"Sprich mit Elara über das dunkle Leuchtfeuer":local.questStage===1?"Auroraprismen bergen · "+shardCount()+" / 3":local.questStage===2?"Reparierte Linse am Leuchtfeuer einsetzen":"Leuchtfeuer erneuert · Eiswacht ist wieder sichtbar";
  const event=blizzardActive()?"WEISSER STURM":nightActive()&&local.beaconLit?"AURORA-WACHE":gameMinute()>=1080&&gameMinute()<1200?"GEMEINSAMES ABENDESSEN":"FORSCHUNGSSCHICHT";
  const signature=event+stageText;if(signature!==systems.runtime.eiswachtUiSignature){systems.runtime.eiswachtUiSignature=signature;panel.innerHTML="<b>EISWACHT · "+event+"</b><span>"+stageText+"</span>";}
}

function updateEiswacht(dt){
  updateResidents(dt);updateVillageUi();const local=worldState();const near=villageDistance()<VILLAGE_RADIUS;
  if(near&&!systems.runtime.eiswachtWasNear){systems.runtime.eiswachtWasNear=true;if(!local.arrived){local.arrived=true;api.showToast("Eiswacht · Forschungsdorf am Rand des Packeises",3000);systems.sound?.("discovery");saveQuiet();}else api.showToast("Eiswacht · Die Stille Flamme brennt",1800);}
  if(!near&&villageDistance()>VILLAGE_RADIUS+80) systems.runtime.eiswachtWasNear=false;
}

function drawVillageOverlay(){
  if(villageDistance()>VILLAGE_RADIUS*1.5) return;
  if(blizzardActive()){ctx.fillStyle="rgba(218,232,229,.08)";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="rgba(243,249,245,.36)";for(let i=0;i<28;i++){const x=(i*103+state.elapsed*250)%(canvas.width+90)-45,y=(i*47+state.elapsed*34)%canvas.height;ctx.fillRect(Math.round(x),Math.round(y),20+i%16,1);}}
  if(nightActive()&&worldState().beaconLit){ctx.fillStyle="rgba(76,221,139,.055)";for(let band=0;band<4;band++){const y=45+band*72+Math.sin(state.elapsed*.6+band)*17;ctx.fillRect(0,Math.round(y),canvas.width,9+band*3);}ctx.fillStyle="rgba(112,181,232,.03)";ctx.fillRect(0,0,canvas.width,canvas.height*.45);}
}

const originals={
  collisionAt:systems.collisionAt,nearbyInteraction:systems.nearbyInteraction,interact:systems.interact,drawGround:systems.drawGround,
  renderables:systems.renderables,drawRenderable:systems.drawRenderable,drawOverlay:systems.drawOverlay,update:systems.update,onGameStarted:systems.onGameStarted,useConsumable:systems.useConsumable
};

systems.collisionAt=(x,y)=>{
  for(const object of villageObjects){if(!object.solid) continue;const halfX=(object.hitW||6)/2+api.PLAYER_RADIUS*.65,halfY=(object.hitH||6)/2+api.PLAYER_RADIUS*.65;const dx=(x-object.x)/halfX,dy=(y-object.y)/halfY;if(dx*dx+dy*dy<1) return {type:"eiswachtCollision",object};}
  return originals.collisionAt(x,y);
};
systems.nearbyInteraction=()=>{const previous=originals.nearbyInteraction();const local=nearbyEisInteraction();return local&&(!previous||local.distance<previous.distance)?local:previous;};
systems.interact=(target)=>{if(target?.type!=="eiswacht") return originals.interact(target);if(target.resident) talkToResident(target.resident);else if(target.dog){worldState().rapport.murr=(worldState().rapport.murr||0)+1;api.showToast(worldState().rapport.murr===1?"Murr mustert dich, niest und lehnt sich dann gegen dein Bein.":"Murr wedelt und trägt dir einen völlig vereisten Handschuh an.",2200);systems.sound?.("ambient","dog");}else if(target.object) inspectObject(target.object);return true;};
systems.drawGround=(camX,camY)=>{originals.drawGround(camX,camY);drawVillageGround(camX,camY);};
systems.renderables=(left,top,right,bottom)=>{
  const result=originals.renderables(left,top,right,bottom);
  for(const object of villageObjects) if(object.x>=left-100&&object.x<=right+100&&object.y>=top-120&&object.y<=bottom+100) result.push({kind:"eiswachtObject",object,y:object.y});
  for(const resident of residents) if(resident.x>=left-70&&resident.x<=right+70&&resident.y>=top-80&&resident.y<=bottom+70) result.push({kind:"eiswachtResident",resident,y:resident.y});
  if(dog.x>=left-40&&dog.x<=right+40&&dog.y>=top-40&&dog.y<=bottom+40) result.push({kind:"eiswachtDog",y:dog.y});
  return result;
};
systems.drawRenderable=(renderable,camX,camY)=>{
  if(renderable.kind==="eiswachtResident"){drawResident(renderable.resident,camX,camY);return;}
  if(renderable.kind==="eiswachtDog"){drawDog(camX,camY);return;}
  if(renderable.kind==="eiswachtObject"){const p=worldToScreen(renderable.object.x,renderable.object.y,camX,camY);if(renderable.object.kind==="building"||renderable.object.kind==="beacon") drawArcticBuilding(renderable.object,p);else drawVillageProp(renderable.object,p);return;}
  originals.drawRenderable(renderable,camX,camY);
};
systems.drawOverlay=(camX,camY)=>{originals.drawOverlay(camX,camY);drawVillageOverlay();};
systems.update=(dt,realDt)=>{originals.update(dt,realDt);if(state.running&&!state.paused) updateEiswacht(dt);else updateVillageUi();};
systems.onGameStarted=()=>{originals.onGameStarted();worldState();systems.runtime.eiswachtWasNear=false;for(const resident of residents){const entry=scheduleEntry(resident);resident.x=anchors[entry[1]][0];resident.y=anchors[entry[1]][1];resident.activity=entry[2];resident.moving=false;}updateVillageUi();};
systems.useConsumable=(item,definition)=>{if((item?.itemId==="smokedArcticChar"||item?.itemId==="frostTea")&&definition?.consumable) state.player.stamina=Math.min(100,state.player.stamina+(definition.stamina||0));return originals.useConsumable(item,definition);};
systems.version="0.18";

const panel=document.createElement("div");panel.id="eiswachtPanel";panel.className="eiswacht-panel hidden";panel.innerHTML="<b>EISWACHT</b><span>Forschungsdorf am Rand des Packeises</span>";$("gamePanel").appendChild(panel);
$("closeDialog")?.addEventListener("click",()=>{systems.runtime.eiswachtTalkingId=null;});

window.__ARCHIPELAGO_EISWACHT__={version:"0.18",centre:CENTRE,anchors,villageObjects,residents,dog,worldState,gameMinute,gameDay,blizzardActive,scheduleEntry,updateResidents,nearbyEisInteraction,inspectObject,talkToResident,shardCount};
})();
