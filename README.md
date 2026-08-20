# Archipelago – Echoes of the Shattered Sea

Ein statisches 2D-Pixel-RPG für den Browser mit einer 20 × 20 km großen, deterministisch generierten Inselwelt und Peer-to-Peer-Multiplayer.

## Aktueller Stand (0.19)

- **Treibholz vollständig überarbeitet:** drei eigens erzeugte, auf Endauflösung skalierte Pixelart-Gebäude, deutlich mehr Küstendetails, freie Dorfwege und ein gerodetes Banditenlager außerhalb des Waldes
- alle Treibholz-Häuser sind betretbar und besitzen eigene Innenräume, Kollisionen und Funktionen wie Betten, Herd, Handel, Fangbuch, Anschlagbrett und Werkplätze
- Mira, Borin, Edda und Taren folgen echten Tagesplänen, laufen zwischen Arbeitsorten, Halle und Häusern, essen gemeinsam und schlafen nachts sichtbar in Innenräumen
- neues bildschirmfüllendes Dialogsystem mit NPC-Nahansicht, Rolle, Stimmung, aktueller Tätigkeit und verzweigten Themen; Eiswacht verwendet dieselbe Darstellung
- neuer offener Pixelart-Rucksack als Inventarhintergrund, sichtbare angelegte Rüstung an Spieler, Dorfbewohnern und Banditen sowie überarbeiteter geradliniger Speerstoß
- gut lesbare goldene Questmarker in HUD und Welt, einschließlich Entfernung und Richtung; das Quest-HUD bleibt auf Mobilgeräten direkt bedienbar
- robuster Start-Entstucker für Tiergruppen mit Gebäudeprüfung und Laufzeitrettung festgelaufener Tiere; Außenwelt-KI pausiert außerdem in Innenräumen
- Touch-Eingaben gegen Doppelauslösung abgesichert, Mehrfingersteuerung stabilisiert und nicht anwendbare Außenweltaktionen in Innenräumen deaktiviert

- **Eiswacht als vollständig eigenes Forschungsdorf:** Das ausgeloste Norddorf verwendet kein generisches Stadtmuster mehr, sondern 32 handplatzierte Gebäude, Einrichtungen und Umgebungsdetails mit eigener Pixelgrafik, Kollision und Interaktion
- individuelles Dorfensemble mit Langhaus **Zur Stillen Flamme**, Observatorium, Werkhof, Wärmestube, Frostgewächshaus, Räucherhaus, Weißnacht-Archiv, Wohnhütten, Dampfgenerator, Eisbecken, Fischgestell, Expeditionsschlitten, Wetterfahne, Schichtglocke und Nordlicht-Leuchtfeuer
- sechs benannte Bewohner – Elara, Tova, Njal, Sela, Orik und Iven – mit eigener Rolle, Erscheinung, Vergangenheit, Beziehungen, Dialogthemen, Arbeitsplätzen und vollständigen Tagesplänen; Dorfhund Murr folgt Njal, bewacht den Werkhof oder schläft während des Sturms am Ofen
- lebendiger Dorfablauf mit Nachtwachen, Fischfang, Schmiede- und Klinikschichten, Botanik, Funkarchiv, Kurierwegen, Mittagsglocke, gemeinsamem Abendessen sowie vollständig veränderten Aufenthaltsorten während eines weißen Sturms
- umfangreiche lokale Geschichte um das gestrandete Schiff **Nordlicht**, siebenundvierzig Winter Forschung, die verschwundenen Bewohner der Weißnacht und ein antwortendes Licht unter dem Gletscher; Gebäude und Kleindetails erzählen zusätzliche Teile davon
- mehrstufige Eiswacht-Aufgabe: drei verstreute Aurora-Peilsteine finden, die Prismensplitter zu Tova bringen, die Linse reparieren und das Nordlicht-Leuchtfeuer aktivieren; Fortschritt, Funde und Belohnung sind im bestehenden Spielstand enthalten
- tägliche Dorfaktivitäten und Belohnungen mit Eisloch-Angeln, Selas Behandlung, Frostblütentee, geräuchertem Eisling, Njals Handel und der einzigartigen Laterne der Weißnacht
- eigenes Eiswacht-HUD, Sturmwarnung, nächtliche Aurora bei repariertem Leuchtfeuer, beleuchtete Fenster und Laternen, Generator-/Schmiededetails, Schneepfade sowie vollständig tiefensortierte Bewohner und Gebäude
- Asset Studio um alle Eiswacht-Bewohner, Murr, fünf neue Gegenstände und 21 Dorfgebäude/-objekte samt Leuchtfeuerzustand erweitert

- vollständiges Wüsten-Rework mit fünf großflächigen Unterbiomen: Goldene Dünen, Rote Tafelwüste, Salzpfannen, Dornsteppe und Schluchtenland; Oasen bleiben als grüne Rückzugsräume erhalten
- eigene Bodentexturen und Kleindetails pro Wüstenzone mit Dünenrippen, Salzrissen und -kristallen, Rotkies, Sonnensteinen, Dornen, Wüstenblüten und regional verteiltem Bewuchs
- drei neue südliche Reiseziele: Karawanserei Qadim mit Tiefbrunnen, das Salzkloster Miraj mit verlorener Karawane und das Observatorium im Glasmeer mit kühlendem Altar und Beute
- neue Wüstenfauna mit fliehenden Wüstenechsen in drei Varianten sowie aggressiven Schakalrudeln in drei Fellfarben; beide besitzen eigene Werte, Animationen, Kadaverlagen, Blutmengen und Loot
- Tageshitze als sanft ansteigendes Reiserisiko mit Ausdauerbelastung und spätem Hitzschlag; Oasen, Tiefbrunnen, Schattenplätze, Rast und der Glasaltar kühlen die Figur wieder ab
- neues südliches Wetter mit Hitzeflimmern, Staubphasen und dichten Sandstürmen, die Sicht und Bewegung beeinflussen, ohne andere Regionen zusätzlich zu belasten
- vier neue prozedurale Wüstenszenen an Straßen: Sonnenobelisken, Karawanenwracks, Knochenfelder und Schattensegel
- Asset Studio um alle fünf Wüstenblöcke, beide Tierbasen, sechs Tier-Varianten, neue Ressourcen/Rezepte und sämtliche neuen Straßen- und Zielobjekte erweitert

- neuer Jagdbogen mit verbrauchbaren Pfeilen, Flugkollision, Fernkampfschaden gegen Tiere und Banditen, Werkbankrezept, Inventar-/Handgrafik, Schnellzugriff über `4` sowie getrennten `DRAW`- und `FLIGHT`-Assets im Studio
- räumlicher Tierindex statt wiederholter globaler Suchen, getrennte deutlich kleinere Langzeit-Caches, bedarfsgebündelte Decal-Pflege und automatisch reduzierte Wetterdichte bei langsamen Frames
- robuste Tierkörper: Bewegung blockiert neue Überlappungen bereits vor dem Schritt; ein dreipassiger, räumlich begrenzter Solver trennt auch dichte Gruppen und Paare an Hindernissen
- drei dauerhaft gewählte Kadaverlagen pro Tierart; Hühner und Wildschweine behalten dabei ihre Gefieder-/Fellvariante, und mehrere `DEAD`-Frames im Asset Studio dienen nun als statische Kadavervarianten
- überarbeitetes Blut pro Tierart mit eigenem Farbprofil, Körperwunde, Lachenform und Blutmenge: starker sichtbarer Ersterguss, kurze Hauptblutung und langes kontinuierliches Nachsickern aus einer gemeinsamen endlichen Reserve

- Startgebiet **Treibholz** als lebendiges Küstendorf mit drei betretbaren Häusern, vier Bewohnern, Werkbank, Brunnen, Lagerfeuer, Fischerei- und Hafendetails
- vollständige erste Questkette: Materialien sammeln, Jagdspeer herstellen, das erste Banditenlager räumen und Belohnung abholen
- Werkbank-, Lagerfeuer- und Händlerrezepte für Jagdspeer, Lederweste, Feldverbände, gebratenes Fleisch und Vorräte
- drei getrennte lokale Spielstände mit Laden, Überschreiben, Löschen, 20-Sekunden-Autosave und sichtbarer Speicherbestätigung
- Spielstände erhalten Position, Figur, Inventar/Ausrüstung, Questfortschritt, Banditen, geöffnete Truhen, veränderte Tiere und bearbeitete Bäume
- direkteres Kampffeedback mit kurzem Hit-Stop, Kamerawackeln, Geräuschen, klaren Banditen-Telegraphen, Ausweichrolle und Rüstungswirkung
- neuer Jagdspeer mit größerer Reichweite, eigener Animation, Inventarbild, Asset-Slot und Schnellzugriff über `3`
- soziale Tierreaktionen: Wildschweine verteidigen verwundete Artgenossen, während friedliche Tiere als Gruppe fliehen
- drei Banditenlager mit insgesamt neun Gegnern, drei Höhleneingänge und drei Ruinen-Beutekisten als neue Erkundungsziele
- dynamische Regen-, Sturm-, Schnee-, Staub- und Nebelphasen sowie ein stärker lesbarer Tag-/Nachtwechsel
- Asset Studio 2.0 mit Laufzeitbindung, Vererbungsmodell für Varianten, Szenenvorschau, Richtungsansicht, Anker-, Hand- und Hitbox-Metadaten sowie konkreter Validierung pro Asset
- neue editierbare Figuren, Animationen und Weltobjekte: Mira, Borin, Banditen, Jagdspeer, Werkbank, Lagerfeuer, Brunnen, Dorfhütten, Höhlen, Zelte und Beutetruhen

- richtiger Titelscreen mit animierter Weltkulisse
- erweiterter Charaktereditor mit zehn Frisuren, sechs Bartstilen, sechs Kleidungsformen sowie zusätzlichen Haar-, Stoff- und Mantelfarben
- vier eigenständige Blickrichtungen und animierte Laufzyklen; Seitenansichten besitzen echte Profilsprites
- richtungsabhängige Figuren-Layer: lange Haare, Zöpfe und Pferdeschwänze liegen hinter Kopf/Körper und vor dem Rückenmantel; Gebäude, Bäume und Straßendeko werden gemeinsam mit Figuren tiefensortiert
- neues Ingame-HUD mit Lebensenergie, Ausdauer, Kompass, Uhrzeit, Region und Ortsanzeige
- kleinerer, zur 8-m-Welt passender Spielermaßstab mit weich nachlaufender Kamera
- pixelklarer Spieler-Renderpfad mit ganzzahligen Sprite-Pixeln und einer Canvas-Auflösung, die der tatsächlichen Fenstergröße entspricht; Spielernamen werden ohne geglättete Browser-Schrift als eigenes 5×7-Pixelalphabet gezeichnet
- funktionales Sprint- und Schwimmsystem mit Strömungs-, Flachwasser- und Tiefseegeschwindigkeiten
- Tiefseeschwimmen verbraucht Ausdauer; erschöpfte Figuren sinken, ertrinken und erwachen am letzten sicheren Ufer
- 20 × 20 km große Welt mit Nordpol, Packeis, Tundra, Gletschern, fünf südlichen Wüstenzonen und Oasen
- weichere Biomgrenzen durch mehrteilige Farbmischung und 8×8-Pixel-Dithering, ohne die Gameplay-Biome zu verändern
- organischere Inselkonturen mit Buchten, Halbinseln und kleinen Schären
- höhenbasierte Flüsse, die vom Hochland abwärts bis an die Küste entwässern
- zusätzliche Natur mit Frostkiefern, Eisspitzen, Kakteen, Akazien, Palmen, Farnen, Pilzen, Seerosen, Fischen, Knochen sowie Schnee- und Sandpartikeln
- Kollisionen mit Baumstämmen, Naturformationen, Häusern und Ruinen
- langlebige, streng begrenzte Fuß- und Hufspuren auf Schnee, Sand und weiteren weichen Böden sowie passende Wasserwellen und kurze Spuren auf harten Flächen; normale Boden-Decals liegen unter Figuren
- einheitliches 8-m-Blockraster: Terrain, Flüsse, Straßen, mehrteilige Bäume, Häuser und Ruinen bestehen aus denselben Weltblöcken
- dreimal breitere Hauptwege und deutlich seltener gesetzte Geröllfelder im Hochland
- Wege besitzen echte 8×8-Pixeltexturen mit Spurrillen, Pfützen, Steinen und wechselnden Oberflächen
- automatische Holz- und Steinbrücken an jeder Weg-/Flusskreuzung
- 17 deterministische Straßendeko-Typen: große Findlinge, Steinmale, Wegweiser, Meilensteine, kaputte Wagen, Handkarren, Vorräte, Laternen, Wegschreine, Lager, Baumstämme, Trümmer, Anschlagtafeln sowie vier eigene Wüstenszenen
- deutlich größere Abstände zwischen Straßenszenen, damit Wege wieder ruhig lesbar und frei begehbar bleiben
- vollständiger Baum-/Kronenabstand zu Wegen sowie Kollisionen und eigene Interaktionen für große Straßendekorationen
- Mehrfeld-Inventar mit 10×6-Rucksackraster, Verschieben, Drehen, Schnellwechsel und vorbereiteten Slots für Kopf, Körper, Beine, Stiefel und Haupthand
- Eisenschwert als 1×3-Gegenstand mit einzelnem Hieb und sichtbarem Pixel-Trail sowie Holzfälleraxt als 2×3-Gegenstand
- persistente Baumzustände mit Trefferpunkten, erhaltener Block-/Rindentextur, mindestens einem vollen Weltblock Stammdicke, beschleunigter Fallphysik, kontinuierlichem sicherem Push-out und anschließend drei physikalischen Holzabschnitten, die auf nahe freie 8-m-Rasterzellen einrasten
- frei umherlaufende Hühnergruppen mit geschwindigkeitsgekoppeltem, ruhigerem Laufzyklus sowie Wildschweine mit ausweichbarem Telegraph, festgelegtem Dash, einmaligem Trefferfenster und Erholungsphase
- Gruppenspawns reservieren artspezifische Körperabstände bereits während der deterministischen Kandidatensuche; die Laufzeit-Separation löst Restüberlappungen in stabiler Reihenfolge und mit einem Render-Tiebreaker, ohne sichtbares Pendeln oder Teleportieren
- deterministische kleine Rabengruppen sitzen vollständig in passenden Baumkronen verborgen, fliegen bei Annäherung oder Baumfall gemeinsam auf und verlassen anschließend den aktiven Simulationsbereich; deutlich größere, weiterhin begrenzte Himmelsschatten ergänzen weit entfernte Vögel
- frei umherlaufende Pferde in vier Rassen (Warmblut, Araber, Kaltblut und Pony) und sechs Fellvarianten (Brauner, Rappe, Fuchs, Schimmel, Palomino und Schecke); Körperlänge, Körperhöhe, Beinlänge und Reitgeschwindigkeit unterscheiden sich je nach Rasse
- gesattelte und ungesattelte Pferde als echte Tierzustände; ein ungesatteltes Pferd kann angesehen, aber noch nicht geritten werden
- bei jedem Spielstart erscheint ein gesatteltes, dem Spieler zugeordnetes Pferd direkt neben der Figur; `H` beziehungsweise der mobile Pferdebutton schaltet deterministisch zwischen `FOLLOW` und `STAY`
- Aufsitzen und Absteigen über `E` oder die mobile Aktionstaste, unverkleinerte Sitzpose ohne Laufbeine, richtungsabhängige Reitdarstellung, distanzgekoppelte Schritt-/Galoppzyklen, natürlicher Schweif, Pferdeausdauer, Hufspuren sowie blockierte Tiefseewege
- alle lebenden Figuren und Tiere mit Augen blinzeln in deterministisch versetzten Intervallen; tote Tiere behalten dauerhaft sichtbar geschlossene Augen
- progressive Verletzungsdarstellung mit impulsabhängigen Blutspritzern, ortsfesten und langlebigen Welt-Blutdecals sowie einem gemeinsamen endlichen Blutvorrat für ruhende Lache und Ziehspur
- deutlich kräftigere Blutspritzer, größere und länger sichtbare Schleifflecken sowie unregelmäßige, bis zu 15 Minuten sichtbare Blutlachen; die Abgabe ist anfangs stark, fällt anhand Alter und Restmenge stetig ab und speist Ziehspur wie Ruhepool aus derselben artspezifischen Reserve
- Blut verdünnt sich in Meer- und Flachwasser zu kurzlebigen Wolken; in Flüssen folgt es der tatsächlich berechneten Strömungsrichtung
- physische Tierkadaver mit passiver Schleifpose; über `E` lassen sie sich aus einer bewusst knappen Reichweite von 1,4 Weltblöcken aufnehmen, per gedämpfter Constraint nah hinter dem Spieler ziehen und wieder loslassen; frische Kadaver erzeugen größere, mit der Zeit seltener werdende Blutspuren
- Wildschwein-Dashes können eine begrenzte Spielerblutung auslösen: kleiner periodischer Schaden, endliches Blutvolumen, bewegungsabhängige Spur, Wasserverdünnung, HUD-Restzeit und sicherer Reset bei Tod/Respawn
- Wildschwein-Charges starten bereits aus lesbarer Distanz, laden länger sichtbar auf und ziehen während des verlängerten Dashs einen untergrundgefärbten Wind-/Staubschweif hinter sich her
- Tiere und Kadaver bleiben durch ganzzahlige Pixelkörper, gefüllte Gliedmaßen und ohne weich geglättete Vektorrotationen auch während ihrer Bewegung klar gerastert
- artspezifische Kadaververwertung durch weitere Waffentreffer mit rohem Hühner-/Wildfleisch, Federn, Haut, Hauern und Knochen als echten Raster- und Stapelitems
- datengetriebene Tierarten, Verhaltenszustände, Trefferwerte, Loottabellen, Itemkatalog, Equipment-Regeln und Aktions-Handler als Basis für weitere Tiere, Waffen, Rüstung, Ressourcen, Behälter und Beute
- getrennte Terrain-Ebene mit blockweise verschobenem Bildcache, begrenzte Welt-/Partikel-Caches und gedrosselte HUD-/Kartenupdates für deutlich stabilere Bildraten
- Minimap und große beschriftete Weltkarte mit Legende
- mobile Touch-Steuerung mit Mehrfinger-D-Pad, gedrückt gehaltenem Sprint, großen Aktions-/Interaktionstasten sowie direkten Buttons für Inventar, Karte und Pause; HUD und Overlays berücksichtigen Hochformat, Querformat und Display-Safe-Areas
- Host-/Join-Lobby mit sechsstelligem Code über PeerJS
- integriertes Asset Studio für Nicht-Programmierer mit neun übersichtlichen Kategorien und dem vollständigen aktuellen Renderkatalog: Figuren, Tierbasen und Varianten einschließlich Wüstenechsen/Schakalen, zehn Frisuren, alle Waffen/Items, sämtliche Terrain- und Bau-Blöcke, Baumteile sowie alte und neue Weltobjekte; Pixelwerkzeuge, frei verwaltbare Animationsclips/Frames/FPS, Live-Vorschau, bis zu zwölf sortierbare Ebenen, Deckkraft, Undo/Redo und validierter JSON-Transfer bleiben enthalten

## Steuerung

| Taste | Aktion |
| --- | --- |
| WASD / Pfeiltasten | Laufen / Pferd lenken |
| Shift | Sprinten / auf dem Pferd galoppieren |
| I | Inventar öffnen / schließen |
| 1 / 2 / 3 / 4 | Schwert / Axt / Jagdspeer / Jagdbogen ausrüsten |
| Leertaste | Ausweichrolle in Blick- oder Laufrichtung |
| Linksklick | Ausgerüsteten Gegenstand benutzen |
| R | Ausgewählten Gegenstand im Inventar drehen |
| E | Weltobjekt untersuchen / Tierkadaver ziehen oder loslassen / Pferd besteigen oder absteigen |
| H | Eigenes Pferd zwischen `FOLLOW` und `STAY` umschalten |
| M | Weltkarte |
| # im Haupt-/Charaktermenü | Asset Studio öffnen; beim ersten Öffnen lokales Studio-Passwort für dieses Gerät setzen |
| # im laufenden Spiel | Debugmodus für die aktuelle Browser-Sitzung aktivieren |
| Esc | Pause / Overlay schließen |

Auf Smartphones und Tablets erscheint automatisch eine eigene Touch-Oberfläche. Links liegt das D-Pad, rechts befinden sich Sprint beziehungsweise Galopp, Ausweichrolle, eine kontextabhängige Aktionstaste mit den Zuständen `Reiten`, `Absteigen`, `Ziehen` und `Loslassen` sowie der große Werkzeug-/Angriffsknopf. Inventar, Karte, Pferdekommando und Pause sind oben rechts erreichbar. Die Steuerung unterstützt mehrere gleichzeitig gehaltene Finger, beispielsweise Lenken plus Galopp und Angriff.

Im Debugmodus teleportiert ein Klick auf die Weltkarte an jede gewünschte Position. Ein Klick direkt in die Spielwelt versetzt die Figur innerhalb des sichtbaren Ausschnitts.

## Asset Studio

Das Asset Studio wird im Titel- oder Charaktermenü mit `#` geöffnet. Kategorie und Suche erschließen den vollständigen derzeit renderbaren Katalog: Spieler, Mira, Borin, Banditen, Tierbasen und artspezifische Varianten, alle zehn Frisuren, sämtliche Waffen und Lootitems, Terrain-/Brücken-/Gebäudeblöcke, Baumstämme/-kronen sowie alle alten und neuen Weltobjekte. Neben den fest benannten `GAME`-Clips wie `IDLE`, `WALK`, `ATTACK`, `HURT`, `PANIC`, `WINDUP`, `CHARGE`, `GALLOP`, `DEAD`, `BURN`, `OPEN` und `FLY` können Artists eigene Clips hinzufügen, duplizieren, umbenennen und löschen. Die fest benannten Clips behalten absichtlich ihren Namen, damit die Spiellogik sie weiterhin sicher aufrufen kann. Varianten können die Basisgrafik erben, statt jede Animation erneut kopieren zu müssen.

Die Live-Vorschau besitzt Wald-, Dorf-, Kampf- und Inventarszenen sowie eine Richtungsansicht. Ankerpunkt, Bodenlinie, Hitbox und Handposition sind direkt editierbar und werden in der Vorschau farbig eingeblendet. Eine Validierungsbox meldet fehlende Pflichtanimationen, leere Frames, unplausible Metadaten und die konkrete Laufzeitfunktion, an die das Asset gebunden ist. Ebenen werden von hinten nach vorn gerendert; Sichtbarkeit, Name, Reihenfolge und Deckkraft sind Teil des Packs. Aktivierte Assets ersetzen nur dann die prozedurale Standardgrafik, wenn der gewählte Clip tatsächlich Pixel enthält. Dadurch bleibt auch ein unvollständiger Pack spielbar.

`Entwurf speichern` legt den aktuellen Stand sofort im Browser (`localStorage`) ab und das Spiel verwendet ihn auf diesem Gerät. `JSON exportieren` erzeugt eine transportierbare Datei für andere Artists. `Projektdatei speichern` schreibt – sofern der Browser den Dateidialog unterstützt – eine validierte `artist-assets.json`; andernfalls wird genau diese Datei heruntergeladen. Liegt sie neben `index.html`, lädt das Spiel sie bei jedem Start automatisch. Damit eine Änderung für alle Spieler dauerhaft wird, muss diese Projektdatei anschließend wie die anderen Spieldateien committed und deployed werden. Da das Spiel statisch gehostet wird, kann ein Browser-Editor ohne Backend nicht selbstständig in das öffentliche GitHub-Repository schreiben. Das Studio-Passwort wird deshalb nur lokal im jeweiligen Browser gesetzt; im öffentlichen Code liegt kein gemeinsames Passwort und kein fester Passwort-Hash.

## GitHub-Pages-Deployment

1. `index.html`, `style.css`, `game.js`, `v015-systems.js`, `v018-eiswacht.js`, `asset-editor.js` und `artist-assets.json` liegen direkt im veröffentlichten Branch.
2. In GitHub unter **Settings → Pages** den Branch `agent/living-world-ui-pass` und den Ordner `/ (root)` auswählen.
3. Jeder neue Fast-Forward-Commit auf diesem Branch löst den Pages-Build automatisch aus.
4. Das Spiel liegt anschließend unter `https://timtill1015-beep.github.io/T-Rpg/`.

Die Website bleibt vollständig statisch. PeerJS wird über ein CDN geladen und nutzt für das Signaling den öffentlichen PeerJS-Dienst. Für ein größeres öffentliches Spiel sollte später ein eigener Signaling- oder Realtime-Dienst verwendet werden.

## Welttechnik

Die Karte wird nicht als riesige Tilemap gespeichert. Terrain, Flüsse, Wege und Biome werden deterministisch aus Weltkoordinaten berechnet und anschließend auf ein gemeinsames 8-m-Blockraster gelegt. Jeder sichtbare Weltblock erhält darin eine pixelklare 8×8-Textur; Biomgrenzen mischen benachbarte Paletten über eine kurze Ditherzone. Flüsse suchen sich vom Hochland aus einen stetig sinkenden Weg bis zur Küste; kreuzt dort ein Weg, entsteht automatisch eine ausgerichtete Brücke. Große Weltobjekte wie Bäume, Kakteen, Eisformationen, Straßendeko, Häuser und Ruinen bestehen aus mehreren vollständigen Blöcken; nur kleine Bodendetails dürfen innerhalb eines Blocks liegen. Kollision, Schwimmen, Tiefensortierung und Oberflächeneffekte binden die Figuren sichtbar an diese Welt. Interaktive Bäume besitzen getrennte Simulationszustände. Tiere werden zellenweise nur um den sichtbaren Bereich erzeugt und aktualisiert; Artkatalog, KI-Zustände, Ragdollzustand und Loottabelle bleiben getrennt.

Pferde nutzen denselben persistenten Tierzustand, ergänzen ihn aber um Rasse, Fell, Sattel, Besitzer, Reiter, `FOLLOW`/`STAY`, tatsächliche Bewegungsgeschwindigkeit, Gangart und eigene Ausdauer. Rasse und Fell werden bei wilden Pferden deterministisch aus der Weltzelle gewählt. Das Startpferd wird als persistentes Begleittier außerhalb der normalen Zellerzeugung geführt, damit es beim Spieler bleibt und nicht durch einen Cachewechsel verschwindet. Beim Reiten werden Pferdeposition und Spielerposition in jedem Simulationsschritt synchronisiert; die Kollision prüft einen größeren Pferdekörper und verweigert tiefe Wasserflächen, erlaubt aber Brücken. Für Multiplayer werden Mount- und sichtbarer Blutungszustand als kleine öffentliche Beschreibungen übertragen. Tier-, Raben- und Effektzustände bleiben datengetrieben und verwenden begrenzte Caches: Blut, ortsfeste Lachen, Wasserwolken, Schleifspuren, Fußabdrücke, Hufabdrücke und Himmelsschatten laufen durch ein gemeinsames, tiefensortiertes System mit globalem und zellenweisem Recycling. Tier-Spawnpunkte werden durch eine begrenzte deterministische Kandidatensuche gegen Stamm-, Kronen-, Natur-, Gebäude- und Deko-Hitboxen geprüft. Dadurch bleibt die 20-km-Welt performant, obwohl gefällte Bäume, physikalische Holzstücke, berührte Tiere, Baumraben und das persönliche Startpferd ihren Zustand behalten.
