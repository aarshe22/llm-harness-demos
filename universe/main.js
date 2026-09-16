// Voxel Universe: Hell, Earth, Heaven
// A complete interactive Three.js experience

// Global variables
let scene, camera, renderer, controls;
let clock = new THREE.Clock();
let mixer = new THREE.AnimationMixer();
let realms = {};
let currentRealm = 'earth';
let destinations = {};
let tourActive = false;
let tourStep = 0;
let tourPaused = false;
let timeOfDay = 'noon'; // morning, noon, dusk, night
let quality = 'medium'; // low, medium, high
let labelsVisible = true;
let reducedMotion = false;
let soundEnabled = true;
let FPSCounter = { fps: 0, lastUpdate: Date.now(), frames: 0 };

// Initialize the application
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 20);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit DPR for performance
    document.getElementById('container').appendChild(renderer.domElement);
    
    // Create controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    
    // Add basic lighting
    addLights();
    
    // Load Three.js and OrbitControls from CDN (already loaded via HTML)
    
    // Initialize realms
    initRealms();
    
    // Initialize destinations
    initDestinations();
    
    // Initialize UI
    initUI();
    
    // Initialize audio (if enabled)
    if (soundEnabled) initAudio();
    
    // Start animation loop
    animate();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Hide loading overlay
    document.getElementById('loading-overlay').classList.add('hidden');
}

// Add lights based on time of day
function addLights() {
    // Remove existing lights
    scene.traverse((obj) => {
        if (obj.isLight) scene.remove(obj);
    });
    
    // Ambient light
    let ambientIntensity = 0.4;
    if (timeOfDay === 'night') ambientIntensity = 0.2;
    else if (timeOfDay === 'morning' || timeOfDay === 'dusk') ambientIntensity = 0.3;
    const ambientLight = new THREE.AmbientLight(0xffffff, ambientIntensity);
    scene.add(ambientLight);
    
    // Directional light (sun/moon)
    let sunColor = 0xffffff;
    let sunIntensity = 1.0;
    if (timeOfDay === 'morning') { sunColor = 0xffcc66; sunIntensity = 0.8; }
    else if (timeOfDay === 'noon') { sunColor = 0xffffff; sunIntensity = 1.2; }
    else if (timeOfDay === 'dusk') { sunColor = 0xff6633; sunIntensity = 0.7; }
    else if (timeOfDay === 'night') { 
        sunColor = 0x404060; // Moonlight
        sunIntensity = 0.3; 
    }
    
    const directionalLight = new THREE.DirectionalLight(sunColor, sunIntensity);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    scene.add(directionalLight);
    
    // Add hemisphere light for sky/ground
    const skyColor = timeOfDay === 'night' ? 0x000033 : 0x87ceeb;
    const groundColor = timeOfDay === 'night' ? 0x000000 : 0xcccccc;
    const hemisphereLight = new THREE.HemisphereLight(skyColor, groundColor, 0.5);
    scene.add(hemisphereLight);
}

// Initialize realms (Hell, Earth, Heaven)
function initRealms() {
    // Create realm containers
    realms.hell = new THREE.Group();
    realms.earth = new THREE.Group();
    realms.heaven = new THREE.Group();
    
    scene.add(realms.hell);
    scene.add(realms.earth);
    scene.add(realms.heaven);
    
    // Generate realm content
    generateHell();
    generateEarth();
    generateHeaven();
    
    // Initially show only Earth
    realms.hell.visible = false;
    realms.earth.visible = true;
    realms.heaven.visible = false;
}

// Generate Hell realm
function generateHell() {
    // Create a simple Hell representation for demonstration
    const hellGroup = realms.hell;
    
    // Ground
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x4b0000 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -10;
    hellGroup.add(ground);
    
    // Gates of Hell (simple arch)
    const gateHeight = 20;
    const gateWidth = 15;
    const gateDepth = 5;
    const gateGeometry = new THREE.BoxGeometry(gateWidth, gateHeight, gateDepth);
    const gateMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const gate = new THREE.Mesh(gateGeometry, gateMaterial);
    gate.position.set(0, gateHeight/2, -50);
    hellGroup.add(gate);
    
    // Inscription
    const inscription = makeTextSprite("ABANDON ALL HOPE, YE WHO ENTER HERE", { 
        fontsize: 24, 
        borderColor: { r: 255, g: 0, b: 0, a: 1.0 },
        backgroundColor: { r: 0, g: 0, b: 0, a: 0.8 }
    });
    inscription.position.set(0, gateHeight/2 + 5, -gateDepth/2 - 0.1);
    hellGroup.add(inscription);
    
    // Simple Cerberus (three spheres for heads)
    const cerberusGroup = new THREE.Group();
    cerberusGroup.position.set(0, 0, -45);
    hellGroup.add(cerberusGroup);
    
    // Three heads
    for (let i = 0; i < 3; i++) {
        const headGeometry = new THREE.SphereGeometry(3, 16, 16);
        const headMaterial = new THREE.MeshStandardMaterial({ color: 0x8b0000 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.set((i - 1) * 4, 5, 0);
        cerberusGroup.add(head);
        
        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.5, 8, 8);
        const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 });
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.8, 0.3, 2.5);
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.8, 0.3, 2.5);
        head.add(leftEye);
        head.add(rightEye);
        
        // Mouth
        const mouthGeometry = new THREE.BoxGeometry(1.5, 0.5, 0.5);
        const mouthMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
        mouth.position.set(0, -1.2, 2.2);
        head.add(mouth);
    }
    
    // Add some flames (simple cones)
    for (let i = 0; i < 20; i++) {
        const flameGeometry = new THREE.ConeGeometry(0.5, 2, 8);
        const flameMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xff4500,
            emissive: 0xff4500,
            emissiveIntensity: 0.5
        });
        const flame = new THREE.Mesh(flameGeometry, flameMaterial);
        flame.position.set(
            (Math.random() - 0.5) * 100,
            Math.random() * 10,
            (Math.random() - 0.5) * 100 - 50
        );
        flame.rotation.x = -Math.PI / 2;
        hellGroup.add(flame);
    }
}

// Generate Earth realm
function generateEarth() {
    const earthGroup = realms.earth;
    
    // Ground
    const groundGeometry = new THREE.PlaneGeometry(500, 500);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    earthGroup.add(ground);
    
    // Mountains
    for (let i = 0; i < 10; i++) {
        const mountain = new THREE.Group();
        mountain.position.set(
            (Math.random() - 0.5) * 400,
            0,
            (Math.random() - 0.5) * 400
        );
        
        // Base
        const baseHeight = 20 + Math.random() * 30;
        const baseGeometry = new THREE.ConeGeometry(10, baseHeight, 8);
        const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x556b2f });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        mountain.add(base);
        
        // Snow cap
        const snowHeight = baseHeight * 0.3;
        const snowGeometry = new THREE.ConeGeometry(8, snowHeight, 8);
        const snowMaterial = new THREE.MeshStandardMaterial({ color: 0xf0f8ff });
        const snow = new THREE.Mesh(snowGeometry, snowMaterial);
        snow.position.y = baseHeight - snowHeight/2;
        mountain.add(snow);
        
        earthGroup.add(mountain);
    }
    
    // Simple city (blocks)
    const cityCenter = new THREE.Group();
    cityCenter.position.set(0, 0, 100);
    for (let x = -5; x < 5; x++) {
        for (let z = -5; z < 5; z++) {
            const buildingHeight = 10 + Math.random() * 20;
            const building = new THREE.Mesh(
                new THREE.BoxGeometry(8, buildingHeight, 8),
                new THREE.MeshStandardMaterial({ color: 0x696969 })
            );
            building.position.set(
                x * 15,
                buildingHeight/2,
                z * 15
            );
            cityCenter.add(building);
        }
    }
    earthGroup.add(cityCenter);
    
    // Stairway to Heaven (simple steps)
    const stairway = new THREE.Group();
    stairway.position.set(0, 0, -100);
    const stepCount = 20;
    for (let i = 0; i < stepCount; i++) {
        const step = new THREE.Mesh(
            new THREE.BoxGeometry(30, 2, 10),
            new THREE.MeshStandardMaterial({ color: 0xffd700 })
        );
        step.position.set(0, i * 3, -i * 5);
        stairway.add(step);
    }
    earthGroup.add(stairway);
    
    // Add some trees
    for (let i = 0; i < 50; i++) {
        const tree = new THREE.Group();
        tree.position.set(
            (Math.random() - 0.5) * 300,
            0,
            (Math.random() - 0.5) * 300
        );
        
        // Trunk
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(1, 1.5, 5, 8),
            new THREE.MeshStandardMaterial({ color: 0x8b4513 })
        );
        trunk.position.y = 2.5;
        tree.add(trunk);
        
        // Foliage
        const foliage = new THREE.Mesh(
            new THREE.SphereGeometry(4, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0x228b22 })
        );
        foliage.position.y = 6;
        tree.add(foliage);
        
        earthGroup.add(tree);
    }
    
    // Add some animals (simple spheres)
    for (let i = 0; i < 20; i++) {
        const animal = new THREE.Mesh(
            new THREE.SphereGeometry(1, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0x8b0000 })
        );
        animal.position.set(
            (Math.random() - 0.5) * 300,
            0.5,
            (Math.random() - 0.5) * 300
        );
        earthGroup.add(animal);
    }
}

// Generate Heaven realm
function generateHeaven() {
    const heavenGroup = realms.heaven;
    
    // Cloud layers
    for (let layer = 0; layer < 5; layer++) {
        const cloudGroup = new THREE.Group();
        cloudGroup.position.y = 100 + layer * 50;
        heavenGroup.add(cloudGroup);
        
        for (let i = 0; i < 30; i++) {
            const cloud = new THREE.Group();
            cloud.position.set(
                (Math.random() - 0.5) * 400,
                0,
                (Math.random() - 0.5) * 400
            );
            
            // Multiple spheres for cloud
            const sphereCount = 3 + Math.floor(Math.random() * 3);
            for (let s = 0; s < sphereCount; s++) {
                const sphere = new THREE.Mesh(
                    new THREE.SphereGeometry(5 + Math.random() * 10, 8, 8),
                    new THREE.MeshStandardMaterial({ 
                        color: 0xf0f8ff,
                        transparent: true,
                        opacity: 0.8
                    })
                );
                sphere.position.set(
                    (Math.random() - 0.5) * 15,
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 15
                );
                cloud.add(sphere);
            }
            
            cloudGroup.add(cloud);
        }
    }
    
    // Pearly Gates (simple arch)
    const gateHeight = 30;
    const gateWidth = 25;
    const gateDepth = 5;
    const gateGeometry = new THREE.BoxGeometry(gateWidth, gateHeight, gateDepth);
    const gateMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xf0f8ff,
        emissive: 0xffffe0,
        emissiveIntensity: 0.3
    });
    const gate = new THREE.Mesh(gateGeometry, gateMaterial);
    gate.position.set(0, gateHeight/2, 200);
    heavenGroup.add(gate);
    
    // Saint Peter (simple figure)
    const saintPeter = new THREE.Group();
    saintPeter.position.set(0, 0, 210);
    heavenGroup.add(saintPeter);
    
    // Body
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(2, 3, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xf0f8ff })
    );
    body.position.y = 4;
    saintPeter.add(body);
    
    // Head
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(2, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xffffe0 })
    );
    head.position.y = 10;
    saintPeter.add(head);
    
    // Halo
    const haloGeometry = new THREE.TorusGeometry(3, 0.5, 8, 16);
    const haloMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 0.5
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 12;
    saintPeter.add(halo);
    
    // Keys (simple)
    const keyLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 3, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xffd700 })
    );
    keyLeft.position.set(-1.5, 6, 1);
    saintPeter.add(keyLeft);
    
    const keyRight = keyLeft.clone();
    keyRight.position.set(1.5, 6, 1);
    saintPeter.add(keyRight);
    
    // Kingdom castle (simple)
    const castle = new THREE.Group();
    castle.position.set(0, 0, 250);
    heavenGroup.add(castle);
    
    // Main tower
    const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(5, 5, 30, 8),
        new THREE.MeshStandardMaterial({ color: 0xf0f8ff })
    );
    tower.position.y = 15;
    castle.add(tower);
    
    // Add some angels (simple)
    for (let i = 0; i < 10; i++) {
        const angel = new THREE.Group();
        angel.position.set(
            (Math.random() - 0.5) * 300,
            150 + Math.random() * 100,
            (Math.random() - 0.5) * 300
        );
        
        // Body
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(1, 1.5, 4, 8),
            new THREE.MeshStandardMaterial({ color: 0xf0f8ff })
        );
        body.position.y = 2;
        angel.add(body);
        
        // Head
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(1, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0xffffe0 })
        );
        head.position.y = 5;
        angel.add(head);
        
        // Wings (simple planes)
        const wingLeft = new THREE.Mesh(
            new THREE.PlaneGeometry(3, 4),
            new THREE.MeshStandardMaterial({ color: 0xf0f8ff, side: THREE.DoubleSide })
        );
        wingLeft.rotation.y = Math.PI / 4;
        wingLeft.position.set(-1.5, 2, 0);
        angel.add(wingLeft);
        
        const wingRight = wingLeft.clone();
        wingRight.rotation.y = -Math.PI / 4;
        wingRight.position.set(1.5, 2, 0);
        angel.add(wingRight);
        
        heavenGroup.add(angel);
    }
}

// Initialize destinations for navigation
function initDestinations() {
    // Hell destinations
    destinations['Cerberus and the Gates of Hell'] = {
        realm: 'hell',
        title: 'Cerberus and the Gates of Hell',
        description: 'The monumental entrance to Hell guarded by the three-headed Cerberus.',
        position: new THREE.Vector3(0, 10, -50),
        lookAt: new THREE.Vector3(0, 5, -45)
    };
    
    destinations['River Acheron'] = {
        realm: 'hell',
        title: 'River Acheron',
        description: 'The river of woe that souls must cross to enter Hell.',
        position: new THREE.Vector3(0, 5, -80),
        lookAt: new THREE.Vector3(0, 0, -90)
    };
    
    // Add more Hell destinations (circles, etc.)
    const circles = ['Limbo', 'Lust', 'Gluttony', 'Greed', 'Wrath', 'Heresy', 'Violence', 'Fraud', 'Treachery'];
    circles.forEach((circle, index) => {
        destinations[circle] = {
            realm: 'hell',
            title: circle,
            description: `The ${circle} circle of Hell.`,
            position: new THREE.Vector3(0, -10 - index*15, -60),
            lookAt: new THREE.Vector3(0, -15 - index*15, -60)
        };
    });
    
    destinations['Satan'] = {
        realm: 'hell',
        title: "Satan's Throne",
        description: 'The deepest point of Hell where Satan resides.',
        position: new THREE.Vector3(0, -140, -60),
        lookAt: new THREE.Vector3(0, -130, -60)
    };
    
    // Earth destinations
    destinations['Earth Overview'] = {
        realm: 'earth',
        title: 'Earth Overview',
        description: 'A panoramic view of the Earthly realm.',
        position: new THREE.Vector3(0, 100, 200),
        lookAt: new THREE.Vector3(0, 0, 0)
    };
    
    destinations['Capital City'] = {
        realm: 'earth',
        title: 'Capital City',
        description: 'The bustling metropolis at the heart of civilization.',
        position: new THREE.Vector3(0, 50, 100),
        lookAt: new THREE.Vector3(0, 20, 100)
    };
    
    destinations['Volcano Summit'] = {
        realm: 'earth',
        title: 'Volcano Summit',
        description: 'The fiery peak of the active volcano.',
        position: new THREE.Vector3(200, 50, -200),
        lookAt: new THREE.Vector3(200, 60, -200)
    };
    
    // Heaven destinations
    destinations['Stairway Summit'] = {
        realm: 'heaven',
        title: 'Stairway Summit',
        description: 'The top of the Stairway to Heaven, before the Pearly Gates.',
        position: new THREE.Vector3(0, 60, -100),
        lookAt: new THREE.Vector3(0, 80, -50)
    };
    
    destinations['Saint Peter and the Pearly Gates'] = {
        realm: 'heaven',
        title: 'Saint Peter and the Pearly Gates',
        description: 'The magnificent gates of Heaven guarded by Saint Peter.',
        position: new THREE.Vector3(0, 20, 200),
        lookAt: new THREE.Vector3(0, 10, 210)
    };
    
    destinations['Kingdom of Heaven Castle'] = {
        realm: 'heaven',
        title: 'Kingdom of Heaven Castle',
        description: 'The magnificent castle at the heart of Heaven.',
        position: new THREE.Vector3(0, 30, 250),
        lookAt: new THREE.Vector3(0, 20, 260)
    };
}

// Initialize UI elements and event listeners
function initUI() {
    // Realm buttons
    document.querySelectorAll('.realm-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const realm = btn.getAttribute('data-realm');
            switchRealm(realm);
            updateRealmButtons(realm);
        });
    });
    
    // Time of day buttons
    document.querySelectorAll('.time-mode').forEach(btn => {
        btn.addEventListener('click', () => {
            const time = btn.getAttribute('data-time');
            setTimeOfDay(time);
            updateTimeButtons(time);
        });
    });
    
    // Navigation buttons
    document.getElementById('prev-btn').addEventListener('click', prevDestination);
    document.getElementById('next-btn').addEventListener('click', nextDestination);
    document.getElementById('auto-tour-btn').addEventListener('click', startAutoTour);
    document.getElementById('stop-tour-btn').addEventListener('click', stopAutoTour);
    
    // Control buttons
    document.getElementById('reset-view-btn').addEventListener('click', resetView);
    document.getElementById('toggle-labels-btn').addEventListener('click', toggleLabels);
    document.getElementById('toggle-reduced-motion-btn').addEventListener('click', toggleReducedMotion);
    document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);
    document.getElementById('sound-btn').addEventListener('click', toggleSound);
    document.getElementById('help-btn').addEventListener('click', () => {
        document.getElementById('help-panel').classList.add('active');
    });
    document.getElementById('about-btn').addEventListener('click', () => {
        document.getElementById('about-panel').classList.add('active');
    });
    document.getElementById('close-help').addEventListener('click', () => {
        document.getElementById('help-panel').classList.remove('active');
    });
    document.getElementById('close-about').addEventListener('click', () => {
        document.getElementById('about-panel').classList.remove('active');
    });
    
    // Quality selector
    document.getElementById('quality-selector').addEventListener('change', (e) => {
        setQuality(e.target.value);
    });
    
    // Initialize button states
    updateRealmButtons(currentRealm);
    updateTimeButtons(timeOfDay);
}

// Switch between realms
function switchRealm(realm) {
    if (realm === currentRealm) return;
    
    // Hide all realms
    realms.hell.visible = false;
    realms.earth.visible = false;
    realms.heaven.visible = false;
    
    // Show selected realm
    realms[realm].visible = true;
    currentRealm = realm;
    
    // Smoothly transition camera (simplified)
    // In a full implementation, we would animate to a realm overview position
}

// Update realm button active states
function updateRealmButtons(activeRealm) {
    document.querySelectorAll('.realm-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-realm') === activeRealm);
    });
}

// Set time of day
function setTimeOfDay(time) {
    timeOfDay = time;
    addLights(); // Update lighting
    
    // Update realm appearances based on time of day
    // In a full implementation, we would adjust colors, emissive properties, etc.
    updateRealmAppearance();
}

// Update time of day button states
function updateTimeButtons(activeTime) {
    document.querySelectorAll('.time-mode').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-time') === activeTime);
    });
}

// Update realm appearance based on time of day
function updateRealmAppearance() {
    // This would modify materials, colors, etc. for time of day effects
    // For simplicity, we just update lights which affects all materials
}

// Start auto tour
function startAutoTour() {
    if (tourActive) return;
    tourActive = true;
    tourStep = 0;
    tourPaused = false;
    updateTourButtons();
    goToDestination(Object.keys(destinations)[tourStep]);
}

// Stop auto tour
function stopAutoTour() {
    tourActive = false;
    tourPaused = false;
    updateTourButtons();
}

// Go to next destination in tour
function nextDestination() {
    if (!tourActive) return;
    tourStep = (tourStep + 1) % Object.keys(destinations).length;
    goToDestination(Object.keys(destinations)[tourStep]);
}

// Go to previous destination in tour
function prevDestination() {
    if (!tourActive) return;
    tourStep = (tourStep - 1 + Object.keys(destinations).length) % Object.keys(destinations).length;
    goToDestination(Object.keys(destinations)[tourStep]);
}

// Go to a specific destination
function goToDestination(destKey) {
    if (!destinations[destKey]) return;
    
    const dest = destinations[destKey];
    
    // Switch realm if needed
    if (dest.realm !== currentRealm) {
        switchRealm(dest.realm);
        updateRealmButtons(dest.realm);
    }
    
    // Animate camera to destination (simplified - instant for now)
    camera.position.copy(dest.position);
    controls.target.copy(dest.lookAt);
    controls.update();
    
    // Update UI
    document.getElementById('destination-info').innerHTML = 
        `<h3>${dest.title}</h3><p>${dest.description}</p>`;
    
    // Update nav list highlight
    updateNavList(destKey);
}

// Update navigation list highlight
function updateNavList(activeDest) {
    const navList = document.getElementById('nav-list');
    navList.innerHTML = ''; // Clear
    
    // Group destinations by realm
    const realms = { hell: [], earth: [], heaven: [] };
    Object.keys(destinations).forEach(key => {
        realms[destinations[key].realm].push(key);
    });
    
    // Add Hell destinations
    const hellSection = document.createElement('div');
    hellSection.innerHTML = '<h4>Hell</h4>';
    realms.hell.forEach(dest => {
        const item = document.createElement('div');
        item.className = 'nav-item';
        item.textContent = dest;
        if (dest === activeDest) item.classList.add('active');
        item.addEventListener('click', () => goToDestination(dest));
        hellSection.appendChild(item);
    });
    navList.appendChild(hellSection);
    
    // Add Earth destinations
    const earthSection = document.createElement('div');
    earthSection.innerHTML = '<h4>Earth</h4>';
    realms.earth.forEach(dest => {
        const item = document.createElement('div');
        item.className = 'nav-item';
        item.textContent = dest;
        if (dest === activeDest) item.classList.add('active');
        item.addEventListener('click', () => goToDestination(dest));
        earthSection.appendChild(item);
    });
    navList.appendChild(earthSection);
    
    // Add Heaven destinations
    const heavenSection = document.createElement('div');
    heavenSection.innerHTML = '<h4>Heaven</h4>';
    realms.heaven.forEach(dest => {
        const item = document.createElement('div');
        item.className = 'nav-item';
        item.textContent = dest;
        if (dest === activeDest) item.classList.add('active');
        item.addEventListener('click', () => goToDestination(dest));
        heavenSection.appendChild(item);
    });
    navList.appendChild(heavenSection);
}

// Update tour button states
function updateTourButtons() {
    document.getElementById('auto-tour-btn').disabled = tourActive;
    document.getElementById('stop-tour-btn').disabled = !tourActive;
    // In a full implementation, we would also have pause/resume buttons
}

// Reset view to default
function resetView() {
    camera.position.set(0, 10, 20);
    controls.target.set(0, 0, 0);
    controls.update();
}

// Toggle labels visibility
function toggleLabels() {
    labelsVisible = !labelsVisible;
    // In a full implementation, we would show/hide labels
}

// Toggle reduced motion
function toggleReducedMotion() {
    reducedMotion = !reducedMotion;
    // In a full implementation, we would disable non-essential animations
}

// Toggle fullscreen
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// Toggle sound
function toggleSound() {
    soundEnabled = !soundEnabled;
    const soundBtn = document.getElementById('sound-btn');
    if (soundEnabled) {
        soundBtn.classList.remove('mute');
        // Resume audio
    } else {
        soundBtn.classList.add('mute');
        // Pause audio
    }
    updateSoundButton();
}

// Update sound button appearance
function updateSoundButton() {
    const soundBtn = document.getElementById('sound-btn');
    soundBtn.textContent = soundEnabled ? 'Sound' : 'Muted';
}

// Set quality level
function setQuality(level) {
    quality = level;
    // In a full implementation, we would adjust render distance, particle counts, etc.
    console.log(`Quality set to ${level}`);
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Create a text sprite (for labels)
function makeTextSprite(message, parameters) {
    if (parameters === undefined) parameters = {};
    
    const fontface = parameters.fontface || 'Arial';
    const fontsize = parameters.fontsize || 18;
    const borderThickness = parameters.borderThickness || 4;
    const borderColor = parameters.borderColor || { r: 0, g: 0, b: 0, a: 1.0 };
    const backgroundColor = parameters.backgroundColor || { r: 255, g: 255, b: 255, a: 1.0 };
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = `Bold ${fontsize}px ${fontface}`;
    
    // Get size data
    const metrics = context.measureText(message);
    const textWidth = metrics.width;
    
    // Background color
    context.fillStyle = `rgba(${backgroundColor.r},${backgroundColor.g},${backgroundColor.b},${backgroundColor.a})`;
    // Border color
    context.strokeStyle = `rgba(${borderColor.r},${borderColor.g},${borderColor.b},${borderColor.a})`;
    
    context.lineWidth = borderThickness;
    roundRect(context, borderThickness/2, borderThickness/2, textWidth + borderThickness, fontsize + borderThickness, 6);
    context.fill();
    context.stroke();
    
    // Text color
    context.fillStyle = 'rgba(0, 0, 0, 1.0)';
    context.fillText(message, borderThickness, fontsize + borderThickness);
    
    // Canvas contents will be used for a texture
    const texture = new THREE.Texture(canvas)
    texture.needsUpdate = true;
    
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture, 
        useScreenCoordinates: false 
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(1, fontsize / textWidth * (textWidth / fontsize), 1);
    return sprite;
}

// Helper function for drawing rounded rectangles
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    
    // Update mixer for animations
    mixer.update(delta);
    
    // Update controls
    controls.update();
    
    // Update FPS counter
    updateFPS();
    
    // Render
    renderer.render(scene, camera);
}

// Update FPS counter
function updateFPS() {
    FPSCounter.frames++;
    const now = Date.now();
    if (now - FPSCounter.lastUpdate >= 1000) {
        FPSCounter.fps = Math.round((FPSCounter.frames * 1000) / (now - FPSCounter.lastUpdate));
        FPSCounter.lastUpdate = now;
        FPSCounter.frames = 0;
        document.getElementById('fps-counter').textContent = `FPS: ${FPSCounter.fps}`;
    }
}

// Initialize on load
window.addEventListener('load', init);