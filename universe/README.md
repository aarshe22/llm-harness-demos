# Voxel Universe: Hell, Earth, Heaven

An interactive Three.js voxel universe featuring three vertically connected realms: Hell, Earth, and Heaven.

## Features

- **Three interconnected realms**: Hell (Dante's Inferno), Earth (detailed landscape), and Heaven (celestial kingdom)
- **Procedural voxel generation**: All geometry generated procedurally without external assets
- **Animated characters**: 
  - Cerberus with three independently animated heads guarding the Gates of Hell
  - Saint Peter at the Pearly Gates with animations
  - Satan enthroned in the deepest circle of Hell
  - Animated angels, demons, animals, and vehicles
- **Environmental storytelling**:
  - Nine circles of Hell with distinct themes and landmarks
  - Detailed Earth with cities, farms, volcanoes, airports, and transportation
  - Heavenly realms with clouds, castles, and celestial gardens
- **Cinematic experience**:
  - Smooth camera transitions between destinations
  - Automatic guided tour covering all major landmarks
  - Time of day system (Morning, Noon, Dusk, Night) with dynamic lighting
  - Responsive UI with navigation controls, performance settings, and accessibility options
- **Technical excellence**:
  - Works offline - no server or build tools required
  - Compatible with file:// protocol in modern browsers
  - Optimized performance with instancing and LOD techniques
  - Optional procedural audio via Web Audio API

## How to Run

1. Download or clone this repository
2. Open `index.html` directly in your web browser (double-click the file)
3. The application will load and you can begin exploring immediately

No web server, npm, or build tools are required. The application works completely offline.

## Controls

### Mouse
- Left Click + Drag: Orbit camera
- Right Click + Drag: Pan camera
- Scroll: Zoom camera

### Keyboard
- WASD/QE: Move camera position
- 1-3: Switch realms (Hell/Earth/Heaven)
- T: Start/stop auto tour
- P: Pause/resume tour
- M: Toggle sound
- F: Toggle fullscreen
- H: Show/hide help
- L: Toggle labels
- R: Reset view
- , / .: Previous/next destination

### Touch (mobile/tablet)
- Drag with one finger: Orbit
- Pinch: Zoom
- Drag with two fingers: Pan

## Features by Realm

### Hell
- Gates of Hell guarded by animated Cerberus (three heads)
- All nine circles of Dante's Inferno: Limbo, Lust, Gluttony, Greed, Wrath, Heresy, Violence, Fraud, Treachery
- River Acheron with Charon's ferry
- Satan's throne at the deepest point
- Flying fire-dragons and lavafalls
- Animated damned souls and demons

### Earth
- Varied terrain: mountains, volcanoes, rivers, forests
- Detailed city with buildings, streets, and vehicles
- Working windmill with rotating blades
- Airport with taxiing and flying airplanes
- Farms with crops, barns, and animals
- Moving cars, trains, and boats
- Day/night cycle with illuminated windows and streetlights

### Heaven
- Pearly Gates guarded by Saint Peter
- Stairway to Heaven connecting Earth and Heaven
- Kingdom of Heaven castle with courtyards and halls
- Angel orchestras and harp players
- Floating souls and peaceful gardens
- Fountain of light and celestial overlook

## Technical Implementation

- **Rendering**: Three.js r152
- **Procedural Geometry**: Voxel-style primitives (boxes, spheres, cylinders) combined to create complex structures
- **Animation**: Custom animation loops for characters and environmental effects
- **Instancing**: Efficient rendering of repeated objects (trees, buildings, voxels)
- **Lighting**: Dynamic time-of-day system affecting all realms
- **UI**: HTML/CSS overlay with responsive design
- **Audio**: Optional Web Audio API procedural soundscape

## Browser Compatibility

Tested and working in:
- Google Chrome (latest)
- Microsoft Edge (latest)
- Mozilla Firefox (latest)

## Performance Settings

Adjust quality in the UI:
- Low: Reduced draw distances, simpler effects
- Medium: Balanced quality and performance (default)
- High: Maximum detail and effects

## Credits

Created as a complete interactive experience demonstrating procedural generation, animation, and world-building with Three.js.

Enjoy your journey through Hell, Earth, and Heaven!