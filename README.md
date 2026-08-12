# Archipelago – Echoes of the Shattered Sea

Ein statisches 2D-Pixel-RPG für den Browser mit einer 10 × 10 km großen, deterministisch generierten Inselwelt und Peer-to-Peer-Multiplayer.

## Aktueller Stand (0.4)

- richtiger Titelscreen mit animierter Weltkulisse
- überarbeiteter Charaktereditor mit Haut-, Augen-, Haar-, Frisur-, Kleidungs- und Mantelvarianten
- vier eigenständige Blickrichtungen und animierte Laufzyklen; Seitenansichten besitzen echte Profilsprites
- korrigierte Figuren-Layer: Mantel auf dem Rücken, richtungsgetreue Füße und reduzierte Gesichter ohne Nase/Mund
- neues Ingame-HUD mit Lebensenergie, Ausdauer, Kompass, Uhrzeit, Region und Ortsanzeige
- kleinerer, zur 8-m-Welt passender Spielermaßstab mit weich nachlaufender Kamera
- funktionales Sprint-Ausdauersystem sowie Geschwindigkeitsunterschiede auf Wegen und in Flüssen
- organischere Inselkonturen mit Buchten, Halbinseln und kleinen Schären
- höhenbasierte Flüsse, die vom Hochland abwärts bis an die Küste entwässern
- acht Baumarten mit mehreren Blocksilhouetten und biomeigenen Farbpaletten
- Kollisionen mit Wasser, Baumstämmen, Häusern und Ruinen
- Fußspuren, Wasserwellen, Staub, fallende Blätter, Vegetationsbewegung und Interaktionen mit E
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
| Esc | Pause / Overlay schließen |

## Netlify-Deployment

1. index.html, style.css und game.js müssen direkt im veröffentlichten Ordner liegen.
2. Den Ordner über Netlify Drop veröffentlichen.
3. Die erzeugte HTTPS-Seite öffnen.
4. Für Multiplayer eine Lobby hosten, den Code teilen und anschließend die Lobby betreten.

Die Website bleibt vollständig statisch. PeerJS wird über ein CDN geladen und nutzt für das Signaling den öffentlichen PeerJS-Dienst. Für ein größeres öffentliches Spiel sollte später ein eigener Signaling- oder Realtime-Dienst verwendet werden.

## Welttechnik

Die Karte wird nicht als riesige Tilemap gespeichert. Terrain, Flüsse, Wege und Biome werden deterministisch aus Weltkoordinaten berechnet und anschließend auf ein gemeinsames 8-m-Blockraster gelegt. Flüsse suchen sich vom Hochland aus einen stetig sinkenden Weg bis zur Küste. Große Weltobjekte wie Bäume, Straßen, Häuser und Ruinen bestehen aus mehreren vollständigen Blöcken; nur kleine Bodendetails wie Gras, Blumen und Steine dürfen innerhalb eines Blocks liegen. Kollision, Tiefensortierung und Oberflächeneffekte binden die Figuren sichtbar an diese Welt. Dadurch sehen alle verbundenen Spieler dieselbe Welt, während im Spiel nur der sichtbare Ausschnitt gerendert wird.
