# Archipelago – Echoes of the Shattered Sea

Ein statisches 2D-Pixel-RPG für den Browser mit einer 20 × 20 km großen, deterministisch generierten Inselwelt und Peer-to-Peer-Multiplayer.

## Aktueller Stand (0.11)

- richtiger Titelscreen mit animierter Weltkulisse
- erweiterter Charaktereditor mit zehn Frisuren, sechs Bartstilen, sechs Kleidungsformen sowie zusätzlichen Haar-, Stoff- und Mantelfarben
- vier eigenständige Blickrichtungen und animierte Laufzyklen; Seitenansichten besitzen echte Profilsprites
- richtungsabhängige Figuren-Layer: lange Haare, Zöpfe und Pferdeschwänze liegen hinter Kopf/Körper und vor dem Rückenmantel; Gebäude, Bäume und Straßendeko werden gemeinsam mit Figuren tiefensortiert
- neues Ingame-HUD mit Lebensenergie, Ausdauer, Kompass, Uhrzeit, Region und Ortsanzeige
- kleinerer, zur 8-m-Welt passender Spielermaßstab mit weich nachlaufender Kamera
- pixelklarer Spieler-Renderpfad mit ganzzahligen Sprite-Pixeln und einer Canvas-Auflösung, die der tatsächlichen Fenstergröße entspricht; Spielernamen werden ohne geglättete Browser-Schrift als eigenes 5×7-Pixelalphabet gezeichnet
- funktionales Sprint- und Schwimmsystem mit Strömungs-, Flachwasser- und Tiefseegeschwindigkeiten
- Tiefseeschwimmen verbraucht Ausdauer; erschöpfte Figuren sinken, ertrinken und erwachen am letzten sicheren Ufer
- 20 × 20 km große Welt mit Nordpol, Packeis, Tundra, Gletschern, südlicher Sonnenwüste und Oasen
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
- 13 deterministische Straßendeko-Typen: große Findlinge, Steinmale, Wegweiser, Meilensteine, kaputte Wagen, Handkarren, Vorräte, Laternen, Wegschreine, Lager, Baumstämme, Trümmer und Anschlagtafeln
- deutlich größere Abstände zwischen Straßenszenen, damit Wege wieder ruhig lesbar und frei begehbar bleiben
- vollständiger Baum-/Kronenabstand zu Wegen sowie Kollisionen und eigene Interaktionen für große Straßendekorationen
- Mehrfeld-Inventar mit 10×6-Rucksackraster, Verschieben, Drehen, Schnellwechsel und vorbereiteten Slots für Kopf, Körper, Beine, Stiefel und Haupthand
- Eisenschwert als 1×3-Gegenstand mit einzelnem Hieb und sichtbarem Pixel-Trail sowie Holzfälleraxt als 2×3-Gegenstand
- persistente Baumzustände mit Trefferpunkten, beschleunigter Fallphysik, kontinuierlichem sicherem Push-out für Figuren/Tiere und anschließendem Zerlegen in drei Holzabschnitte; Länge, Drehpunkt, Stamm- und Kronenhitbox des gefällten Baums werden direkt aus seiner sichtbaren Blockform berechnet
- frei umherlaufende Hühnergruppen und Wildschweine mit Lebenspunkten, Fluchtverhalten sowie verwundeten Keilern mit lesbarer Aushol-, Charge-, Treffer- und Erholungsphase
- frei umherlaufende Pferde in vier Rassen (Warmblut, Araber, Kaltblut und Pony) und sechs Fellvarianten (Brauner, Rappe, Fuchs, Schimmel, Palomino und Schecke); Körperlänge, Körperhöhe, Beinlänge und Reitgeschwindigkeit unterscheiden sich je nach Rasse
- gesattelte und ungesattelte Pferde als echte Tierzustände; ein ungesatteltes Pferd kann angesehen, aber noch nicht geritten werden
- bei jedem Spielstart erscheint ein gesatteltes, dem Spieler zugeordnetes Pferd direkt neben der Figur; `H` beziehungsweise der mobile Pferdebutton schaltet deterministisch zwischen `FOLLOW` und `STAY`
- Aufsitzen und Absteigen über `E` oder die mobile Aktionstaste, unverkleinerte Sitzpose ohne Laufbeine, richtungsabhängige Reitdarstellung, distanzgekoppelte Schritt-/Galoppzyklen, natürlicher Schweif, Pferdeausdauer, Hufspuren sowie blockierte Tiefseewege
- alle lebenden Figuren und Tiere mit Augen blinzeln in deterministisch versetzten Intervallen; tote Tiere behalten dauerhaft sichtbar geschlossene Augen
- progressive Verletzungsdarstellung mit impulsabhängigen Blutspritzern, begrenzten Bodenspuren und einer langsam anwachsenden, gedeckelten Blutlache
- physische Tierkadaver mit passiver Schleifpose; über `E` lassen sie sich aus einer bewusst knappen Reichweite von 1,4 Weltblöcken aufnehmen, per gedämpfter Constraint nah hinter dem Spieler ziehen und wieder loslassen; frische Kadaver erzeugen dabei eine begrenzte Blutspur
- Tiere und Kadaver bleiben durch ganzzahlige Pixelkörper, gefüllte Gliedmaßen und ohne weich geglättete Vektorrotationen auch während ihrer Bewegung klar gerastert
- artspezifische Kadaververwertung durch weitere Waffentreffer mit rohem Hühner-/Wildfleisch, Federn, Haut, Hauern und Knochen als echten Raster- und Stapelitems
- datengetriebene Tierarten, Verhaltenszustände, Trefferwerte, Loottabellen, Itemkatalog, Equipment-Regeln und Aktions-Handler als Basis für weitere Tiere, Waffen, Rüstung, Ressourcen, Behälter und Beute
- getrennte Terrain-Ebene mit blockweise verschobenem Bildcache, begrenzte Welt-/Partikel-Caches und gedrosselte HUD-/Kartenupdates für deutlich stabilere Bildraten
- Minimap und große beschriftete Weltkarte mit Legende
- mobile Touch-Steuerung mit Mehrfinger-D-Pad, gedrückt gehaltenem Sprint, großen Aktions-/Interaktionstasten sowie direkten Buttons für Inventar, Karte und Pause; HUD und Overlays berücksichtigen Hochformat, Querformat und Display-Safe-Areas
- Host-/Join-Lobby mit sechsstelligem Code über PeerJS

## Steuerung

| Taste | Aktion |
| --- | --- |
| WASD / Pfeiltasten | Laufen / Pferd lenken |
| Shift | Sprinten / auf dem Pferd galoppieren |
| I | Inventar öffnen / schließen |
| 1 / 2 | Schwert / Axt ausrüsten |
| Linksklick | Ausgerüsteten Gegenstand benutzen |
| R | Ausgewählten Gegenstand im Inventar drehen |
| E | Weltobjekt untersuchen / Tierkadaver ziehen oder loslassen / Pferd besteigen oder absteigen |
| H | Eigenes Pferd zwischen `FOLLOW` und `STAY` umschalten |
| M | Weltkarte |
| # | Debugmodus öffnen (Passwort `1234`) |
| Esc | Pause / Overlay schließen |

Auf Smartphones und Tablets erscheint automatisch eine eigene Touch-Oberfläche. Links liegt das D-Pad, rechts befinden sich Sprint beziehungsweise Galopp, eine kontextabhängige Aktionstaste mit den Zuständen `Reiten`, `Absteigen`, `Ziehen` und `Loslassen` sowie der große Werkzeug-/Angriffsknopf. Inventar, Karte, Pferdekommando und Pause sind oben rechts erreichbar. Die Steuerung unterstützt mehrere gleichzeitig gehaltene Finger, beispielsweise Lenken plus Galopp und Angriff.

Im Debugmodus teleportiert ein Klick auf die Weltkarte an jede gewünschte Position. Ein Klick direkt in die Spielwelt versetzt die Figur innerhalb des sichtbaren Ausschnitts.

## Netlify-Deployment

1. index.html, style.css und game.js müssen direkt im veröffentlichten Ordner liegen.
2. Den Ordner über Netlify Drop veröffentlichen.
3. Die erzeugte HTTPS-Seite öffnen.
4. Für Multiplayer eine Lobby hosten, den Code teilen und anschließend die Lobby betreten.

Die Website bleibt vollständig statisch. PeerJS wird über ein CDN geladen und nutzt für das Signaling den öffentlichen PeerJS-Dienst. Für ein größeres öffentliches Spiel sollte später ein eigener Signaling- oder Realtime-Dienst verwendet werden.

## Welttechnik

Die Karte wird nicht als riesige Tilemap gespeichert. Terrain, Flüsse, Wege und Biome werden deterministisch aus Weltkoordinaten berechnet und anschließend auf ein gemeinsames 8-m-Blockraster gelegt. Jeder sichtbare Weltblock erhält darin eine pixelklare 8×8-Textur; Biomgrenzen mischen benachbarte Paletten über eine kurze Ditherzone. Flüsse suchen sich vom Hochland aus einen stetig sinkenden Weg bis zur Küste; kreuzt dort ein Weg, entsteht automatisch eine ausgerichtete Brücke. Große Weltobjekte wie Bäume, Kakteen, Eisformationen, Straßendeko, Häuser und Ruinen bestehen aus mehreren vollständigen Blöcken; nur kleine Bodendetails dürfen innerhalb eines Blocks liegen. Kollision, Schwimmen, Tiefensortierung und Oberflächeneffekte binden die Figuren sichtbar an diese Welt. Interaktive Bäume besitzen getrennte Simulationszustände. Tiere werden zellenweise nur um den sichtbaren Bereich erzeugt und aktualisiert; Artkatalog, KI-Zustände, Ragdollzustand und Loottabelle bleiben getrennt.

Pferde nutzen denselben persistenten Tierzustand, ergänzen ihn aber um Rasse, Fell, Sattel, Besitzer, Reiter, `FOLLOW`/`STAY`, tatsächliche Bewegungsgeschwindigkeit, Gangart und eigene Ausdauer. Rasse und Fell werden bei wilden Pferden deterministisch aus der Weltzelle gewählt. Das Startpferd wird als persistentes Begleittier außerhalb der normalen Zellerzeugung geführt, damit es beim Spieler bleibt und nicht durch einen Cachewechsel verschwindet. Beim Reiten werden Pferdeposition und Spielerposition in jedem Simulationsschritt synchronisiert; die Kollision prüft einen größeren Pferdekörper und verweigert tiefe Wasserflächen, erlaubt aber Brücken. Für Multiplayer wird die aktuell gerittene Variante samt Gang- und Kommandozustand als kleine Mount-Beschreibung mit dem öffentlichen Spielerzustand übertragen, sodass andere Teilnehmer Pferd und Reiter gemeinsam sehen. Tier- und Effektzustände bleiben datengetrieben und verwenden begrenzte Caches: Blut, Lachen, Schleifspuren, Fußabdrücke und Hufabdrücke laufen durch ein gemeinsames, tiefensortiertes System. Tier-Spawnpunkte werden durch eine begrenzte deterministische Kandidatensuche gegen Stamm-, Kronen-, Natur-, Gebäude- und Deko-Hitboxen geprüft. Dadurch bleibt die 20-km-Welt performant, obwohl gefällte Bäume, berührte Tiere und das persönliche Startpferd ihren Zustand behalten.
