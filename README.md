# Archipelago – Echoes of the Shattered Sea

Ein statisches 2D-Pixel-RPG für den Browser mit einer 20 × 20 km großen, deterministisch generierten Inselwelt und Peer-to-Peer-Multiplayer.

## Aktueller Stand (0.5)

- richtiger Titelscreen mit animierter Weltkulisse
- überarbeiteter Charaktereditor mit Haut-, Augen-, Haar-, Frisur-, Kleidungs- und Mantelvarianten
- vier eigenständige Blickrichtungen und animierte Laufzyklen; Seitenansichten besitzen echte Profilsprites
- korrigierte Figuren-Layer: Mantel auf dem Rücken, richtungsgetreue Füße und reduzierte Gesichter ohne Nase/Mund
- neues Ingame-HUD mit Lebensenergie, Ausdauer, Kompass, Uhrzeit, Region und Ortsanzeige
- kleinerer, zur 8-m-Welt passender Spielermaßstab mit weich nachlaufender Kamera
- funktionales Sprint- und Schwimmsystem mit Strömungs-, Flachwasser- und Tiefseegeschwindigkeiten
- Tiefseeschwimmen verbraucht Ausdauer; erschöpfte Figuren sinken, ertrinken und erwachen am letzten sicheren Ufer
- 20 × 20 km große Welt mit Nordpol, Packeis, Tundra, Gletschern, südlicher Sonnenwüste und Oasen
- organischere Inselkonturen mit Buchten, Halbinseln und kleinen Schären
- höhenbasierte Flüsse, die vom Hochland abwärts bis an die Küste entwässern
- zusätzliche Natur mit Frostkiefern, Eisspitzen, Kakteen, Akazien, Palmen, Farnen, Pilzen, Seerosen, Fischen, Knochen sowie Schnee- und Sandpartikeln
- Kollisionen mit Baumstämmen, Naturformationen, Häusern und Ruinen
- Fußspuren, Schwimmwellen, Luftblasen, Staub, fallende Blätter, Vegetationsbewegung und Interaktionen mit E
- einheitliches 8-m-Blockraster: Terrain, Flüsse, Straßen, mehrteilige Bäume, Häuser und Ruinen bestehen aus denselben Weltblöcken
- Minimap und große beschriftete Weltkarte mit Legende
- Host-/Join-Lobby mit sechsstelligem Code über PeerJS

## Steuerung

| Taste | Aktion |
| --- | --- |
| WASD / Pfeiltasten | Laufen |
| Shift | Sprinten |
| E | Weltobjekt untersuchen |
| M | Weltkarte |
| # | Debugmodus öffnen (Passwort `1234`) |
| Esc | Pause / Overlay schließen |

Im Debugmodus teleportiert ein Klick auf die Weltkarte an jede gewünschte Position. Ein Klick direkt in die Spielwelt versetzt die Figur innerhalb des sichtbaren Ausschnitts.

## Netlify-Deployment

1. index.html, style.css und game.js müssen direkt im veröffentlichten Ordner liegen.
2. Den Ordner über Netlify Drop veröffentlichen.
3. Die erzeugte HTTPS-Seite öffnen.
4. Für Multiplayer eine Lobby hosten, den Code teilen und anschließend die Lobby betreten.

Die Website bleibt vollständig statisch. PeerJS wird über ein CDN geladen und nutzt für das Signaling den öffentlichen PeerJS-Dienst. Für ein größeres öffentliches Spiel sollte später ein eigener Signaling- oder Realtime-Dienst verwendet werden.

## Welttechnik

Die Karte wird nicht als riesige Tilemap gespeichert. Terrain, Flüsse, Wege und Biome werden deterministisch aus Weltkoordinaten berechnet und anschließend auf ein gemeinsames 8-m-Blockraster gelegt. Flüsse suchen sich vom Hochland aus einen stetig sinkenden Weg bis zur Küste. Große Weltobjekte wie Bäume, Kakteen, Eisformationen, Straßen, Häuser und Ruinen bestehen aus mehreren vollständigen Blöcken; nur kleine Bodendetails dürfen innerhalb eines Blocks liegen. Kollision, Schwimmen, Tiefensortierung und Oberflächeneffekte binden die Figuren sichtbar an diese Welt. Dadurch sehen alle verbundenen Spieler dieselbe Welt, während im Spiel nur der sichtbare Ausschnitt gerendert wird.
