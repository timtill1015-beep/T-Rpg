# Archipelago RPG – Netlify Browser MVP

## Was drin ist
- 10 × 10 km große prozedurale Welt (100 km²)
- Meer rund um die Karte
- mehrere Inseln
- Biome: Tiefsee, Meer, Flachwasser, Strand, Grasland, Wald, Dschungel, Sumpf, Felsland, Gebirge, Schnee
- Pixel-Art Rendering im Canvas
- Charakter-Creator
- WASD + Sprint
- Minimap + große Karte
- Host-/Join-Lobby mit 6-stelligem Code
- Peer-to-Peer Multiplayer über PeerJS

## Netlify Deployment
1. Den Inhalt dieses Ordners entpacken.
2. `index.html`, `style.css` und `game.js` müssen direkt im hochgeladenen Netlify-Ordner liegen.
3. Den gesamten Ordner auf Netlify Drop ziehen.
4. Die von Netlify erzeugte HTTPS-Seite öffnen.
5. Ein Spieler klickt "Lobby hosten" und teilt den Code.
6. Andere öffnen dieselbe Netlify-Seite und geben den Code unter "Beitreten" ein.

## Wichtig zum Multiplayer
Die Website selbst ist komplett statisch und kann auf Netlify liegen.
PeerJS wird per CDN geladen und verwendet für das Signaling den öffentlichen PeerJS-Dienst.
Das ist gut für einen Prototypen, aber für ein größeres/öffentliches Spiel sollte später ein eigener Signaling-/Realtime-Dienst verwendet werden.

## Technische Idee hinter der 10-km-Welt
Die Karte wird nicht als riesiges Bild oder vollständige Tilemap gespeichert.
Terrain wird deterministisch aus Weltkoordinaten berechnet. Dadurch sehen alle Spieler dieselbe Welt,
während nur der aktuell sichtbare Bereich gerendert wird.
