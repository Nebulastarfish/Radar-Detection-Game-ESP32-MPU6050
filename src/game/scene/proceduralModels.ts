import * as THREE from 'three';

// Procedural texture cache to avoid duplicate canvas generation
let _carbonTexture: THREE.CanvasTexture | null = null;
let _pcbTexture: THREE.CanvasTexture | null = null;
let _gridTexture: THREE.CanvasTexture | null = null;

function getCarbonFiberTexture(): THREE.CanvasTexture {
  if (_carbonTexture) return _carbonTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#181b22';
  ctx.fillRect(0, 0, 64, 64);

  ctx.fillStyle = '#222733';
  for (let x = 0; x < 64; x += 8) {
    for (let y = 0; y < 64; y += 8) {
      if ((x / 8 + y / 8) % 2 === 0) {
        ctx.fillRect(x, y, 7, 7);
      }
    }
  }

  _carbonTexture = new THREE.CanvasTexture(canvas);
  _carbonTexture.wrapS = THREE.RepeatWrapping;
  _carbonTexture.wrapT = THREE.RepeatWrapping;
  _carbonTexture.repeat.set(8, 8);
  _carbonTexture.colorSpace = THREE.SRGBColorSpace;
  return _carbonTexture;
}

function getPcbTexture(): THREE.CanvasTexture {
  if (_pcbTexture) return _pcbTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Matte dark green / solder mask
  ctx.fillStyle = '#0f291e';
  ctx.fillRect(0, 0, 256, 256);

  // Copper traces
  ctx.strokeStyle = '#1d6342';
  ctx.lineWidth = 2;
  for (let i = 20; i < 240; i += 30) {
    ctx.beginPath();
    ctx.moveTo(10, i);
    ctx.lineTo(80, i);
    ctx.lineTo(120, i + 15);
    ctx.lineTo(240, i + 15);
    ctx.stroke();
  }

  // Gold test pads
  ctx.fillStyle = '#d4af37';
  for (let i = 30; i < 230; i += 25) {
    ctx.beginPath();
    ctx.arc(40, i, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(210, i, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Silkscreen text
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('ESP32-DEVKIT-V1', 60, 40);
  ctx.font = '9px monospace';
  ctx.fillText('I2C: D21(SDA) D22(SCL)', 55, 230);

  _pcbTexture = new THREE.CanvasTexture(canvas);
  _pcbTexture.colorSpace = THREE.SRGBColorSpace;
  return _pcbTexture;
}

export function getTerrainGridTexture(): THREE.CanvasTexture {
  if (_gridTexture) return _gridTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(34, 197, 94, 0.18)'; // Tactical radar green grid
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(34, 197, 94, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 32; i < 256; i += 32) {
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
  }
  ctx.stroke();

  _gridTexture = new THREE.CanvasTexture(canvas);
  _gridTexture.wrapS = THREE.RepeatWrapping;
  _gridTexture.wrapT = THREE.RepeatWrapping;
  _gridTexture.repeat.set(60, 60);
  _gridTexture.colorSpace = THREE.SRGBColorSpace;
  return _gridTexture;
}

/**
 * Creates Hero Tactical Recon Aircraft / Interceptor Drone (Composite 10-part model)
 */
export function createTacticalDrone(): { group: THREE.Group; leftThruster: THREE.Mesh; rightThruster: THREE.Mesh } {
  const group = new THREE.Group();
  const carbonTex = getCarbonFiberTexture();

  // 1. Main Carbon Composite Fuselage (Beveled elongated geometry)
  const fuselageGeo = new THREE.ConeGeometry(1.2, 5.8, 6);
  fuselageGeo.rotateX(Math.PI / 2);
  const fuselageMat = new THREE.MeshStandardMaterial({
    map: carbonTex,
    color: 0x1e2430,
    roughness: 0.35,
    metalness: 0.65,
  });
  const fuselage = new THREE.Mesh(fuselageGeo, fuselageMat);
  fuselage.scale.set(1.1, 0.55, 1.0);
  fuselage.castShadow = true;
  group.add(fuselage);

  // 2. Cockpit Bubble (Physical glass canopy)
  const canopyGeo = new THREE.SphereGeometry(0.7, 16, 16);
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x06b6d4,
    metalness: 0.1,
    roughness: 0.1,
    transmission: 0.75,
    ior: 1.5,
    reflectivity: 0.9,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
  });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.scale.set(0.65, 0.45, 1.4);
  canopy.position.set(0, 0.4, -0.6);
  group.add(canopy);

  // 3. Swept Delta Wings (Left & Right)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(4.2, -1.8);
  wingShape.lineTo(4.0, -2.4);
  wingShape.lineTo(0, -1.2);
  wingShape.closePath();

  const wingExtrude = new THREE.ExtrudeGeometry(wingShape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04 });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x161a23,
    roughness: 0.4,
    metalness: 0.7,
  });

  const leftWing = new THREE.Mesh(wingExtrude, wingMat);
  leftWing.rotation.x = Math.PI / 2;
  leftWing.position.set(0.6, 0.05, 0.5);
  leftWing.castShadow = true;
  group.add(leftWing);

  const rightWing = new THREE.Mesh(wingExtrude, wingMat);
  rightWing.rotation.x = Math.PI / 2;
  rightWing.scale.x = -1;
  rightWing.position.set(-0.6, 0.05, 0.5);
  rightWing.castShadow = true;
  group.add(rightWing);

  // 4. Twin Canted Vertical Stabilizers / Fins
  const finGeo = new THREE.BoxGeometry(0.08, 1.4, 1.2);
  const finMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.8 });

  const leftFin = new THREE.Mesh(finGeo, finMat);
  leftFin.position.set(0.95, 0.75, 2.0);
  leftFin.rotation.z = -0.25; // Canted outwards
  leftFin.rotation.y = 0.05;
  leftFin.castShadow = true;
  group.add(leftFin);

  const rightFin = new THREE.Mesh(finGeo, finMat);
  rightFin.position.set(-0.95, 0.75, 2.0);
  rightFin.rotation.z = 0.25;
  rightFin.rotation.y = -0.05;
  rightFin.castShadow = true;
  group.add(rightFin);

  // 5. Twin Ion Thruster Nozzles with Emissive Plasma Core
  const nozzleGeo = new THREE.CylinderGeometry(0.38, 0.44, 0.8, 16);
  nozzleGeo.rotateX(Math.PI / 2);
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.2, metalness: 0.95 });

  const leftNozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
  leftNozzle.position.set(0.5, 0.0, 2.6);
  group.add(leftNozzle);

  const rightNozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
  rightNozzle.position.set(-0.5, 0.0, 2.6);
  group.add(rightNozzle);

  // Glowing Thruster Plumes
  const plumeGeo = new THREE.ConeGeometry(0.32, 1.6, 16);
  plumeGeo.rotateX(-Math.PI / 2);
  const plumeMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85,
  });

  const leftPlume = new THREE.Mesh(plumeGeo, plumeMat);
  leftPlume.position.set(0.5, 0.0, 3.4);
  group.add(leftPlume);

  const rightPlume = new THREE.Mesh(plumeGeo, plumeMat);
  rightPlume.position.set(-0.5, 0.0, 3.4);
  group.add(rightPlume);

  // 6. Chin FLIR / Sensor Turret Pod
  const podGeo = new THREE.SphereGeometry(0.32, 12, 12);
  const podMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.1,
    metalness: 0.9,
    emissive: 0x0369a1,
    emissiveIntensity: 0.4,
  });
  const pod = new THREE.Mesh(podGeo, podMat);
  pod.position.set(0, -0.3, -2.4);
  group.add(pod);

  // 7. Wingtip Formation Lights (Red on port/left, Green on starboard/right)
  const tipGeo = new THREE.SphereGeometry(0.08, 8, 8);
  const redMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const greenMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });

  const leftLight = new THREE.Mesh(tipGeo, redMat);
  leftLight.position.set(-4.7, 0.05, -1.2);
  group.add(leftLight);

  const rightLight = new THREE.Mesh(tipGeo, greenMat);
  rightLight.position.set(4.7, 0.05, -1.2);
  group.add(rightLight);

  return {
    group,
    leftThruster: leftPlume,
    rightThruster: rightPlume,
  };
}

/**
 * Creates 3D Hardware Twin: ESP32 + MPU6050 + SSD1306 OLED Module with Wiring
 */
export function createEsp32HardwareTwin(oledTexture: THREE.CanvasTexture): THREE.Group {
  const twin = new THREE.Group();
  const pcbTex = getPcbTexture();

  // 1. ESP32 DevKit Board (Matte FR4 PCB)
  const espPcbGeo = new THREE.BoxGeometry(2.8, 0.12, 5.2);
  const espPcbMat = new THREE.MeshStandardMaterial({
    map: pcbTex,
    roughness: 0.6,
    metalness: 0.2,
  });
  const espPcb = new THREE.Mesh(espPcbGeo, espPcbMat);
  espPcb.position.set(-2.2, 0, 0);
  espPcb.castShadow = true;
  espPcb.receiveShadow = true;
  twin.add(espPcb);

  // 2. ESP-WROOM-32 Metal RF Can / Shield
  const metalCanGeo = new THREE.BoxGeometry(1.8, 0.25, 1.9);
  const metalCanMat = new THREE.MeshStandardMaterial({
    color: 0xc0c5ce,
    roughness: 0.25,
    metalness: 0.95,
  });
  const metalCan = new THREE.Mesh(metalCanGeo, metalCanMat);
  metalCan.position.set(-2.2, 0.18, -0.6);
  metalCan.castShadow = true;
  twin.add(metalCan);

  // Antenna area (black PCB section at top)
  const antennaGeo = new THREE.BoxGeometry(1.8, 0.14, 0.7);
  const antennaMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });
  const antenna = new THREE.Mesh(antennaGeo, antennaMat);
  antenna.position.set(-2.2, 0.14, -2.0);
  twin.add(antenna);

  // ESP32 Status LED (Blue)
  const ledGeo = new THREE.BoxGeometry(0.12, 0.08, 0.12);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const led = new THREE.Mesh(ledGeo, ledMat);
  led.position.set(-1.8, 0.12, 0.8);
  twin.add(led);

  // Micro USB Port
  const usbGeo = new THREE.BoxGeometry(0.75, 0.28, 0.55);
  const usbMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.2, metalness: 0.9 });
  const usb = new THREE.Mesh(usbGeo, usbMat);
  usb.position.set(-2.2, 0.15, 2.5);
  twin.add(usb);

  // 3. MPU6050 Sensor Breakout Module (Blue PCB)
  const mpuPcbGeo = new THREE.BoxGeometry(1.6, 0.1, 2.1);
  const mpuPcbMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8, // Classic vibrant MPU6050 blue
    roughness: 0.5,
    metalness: 0.3,
  });
  const mpuPcb = new THREE.Mesh(mpuPcbGeo, mpuPcbMat);
  mpuPcb.position.set(0.6, 0, 1.2);
  mpuPcb.castShadow = true;
  twin.add(mpuPcb);

  // MPU6050 QFN Sensor IC
  const mpuChipGeo = new THREE.BoxGeometry(0.48, 0.08, 0.48);
  const mpuChipMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.3, metalness: 0.5 });
  const mpuChip = new THREE.Mesh(mpuChipGeo, mpuChipMat);
  mpuChip.position.set(0.6, 0.09, 1.2);
  twin.add(mpuChip);

  // 4. SSD1306 0.96" OLED Module
  const oledBoardGeo = new THREE.BoxGeometry(2.7, 0.1, 2.7);
  const oledBoardMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
  const oledBoard = new THREE.Mesh(oledBoardGeo, oledBoardMat);
  oledBoard.position.set(1.5, 0, -1.2);
  oledBoard.castShadow = true;
  twin.add(oledBoard);

  // OLED Active Display Glass Face (maps the live 128x64 oledTexture!)
  const oledGlassGeo = new THREE.PlaneGeometry(2.3, 1.3);
  oledGlassGeo.rotateX(-Math.PI / 2);
  const oledGlassMat = new THREE.MeshBasicMaterial({
    map: oledTexture,
  });
  const oledGlass = new THREE.Mesh(oledGlassGeo, oledGlassMat);
  oledGlass.position.set(1.5, 0.06, -1.1);
  twin.add(oledGlass);

  // 5. Procedural Jumper Wires connecting the modules!
  // Color coded according to user's hardware fix:
  // Red (3V3 Power), Black (GND), Green (SDA/GPIO21), Yellow (SCL/GPIO22)
  const createWire = (points: THREE.Vector3[], color: number) => {
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.035, 8, false);
    const tubeMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 });
    return new THREE.Mesh(tubeGeo, tubeMat);
  };

  // Wire 1: 3.3V (Red) from ESP32 3V3 pin to MPU6050 VCC and OLED VCC
  const wire3V3_MPU = createWire([
    new THREE.Vector3(-3.5, 0.1, -2.4),
    new THREE.Vector3(-2.8, 0.8, -0.8),
    new THREE.Vector3(-0.5, 0.6, 0.8),
    new THREE.Vector3(0.0, 0.1, 1.8),
  ], 0xef4444);
  twin.add(wire3V3_MPU);

  const wire3V3_OLED = createWire([
    new THREE.Vector3(-3.5, 0.1, -2.4),
    new THREE.Vector3(-1.8, 0.9, -1.8),
    new THREE.Vector3(0.8, 0.6, -2.2),
    new THREE.Vector3(1.0, 0.1, -2.4),
  ], 0xdc2626);
  twin.add(wire3V3_OLED);

  // Wire 2: GND (Black) from ESP32 top-right to modules
  const wireGND = createWire([
    new THREE.Vector3(-0.9, 0.1, -2.4),
    new THREE.Vector3(-0.3, 0.7, -1.5),
    new THREE.Vector3(0.3, 0.1, 1.8),
  ], 0x18181b);
  twin.add(wireGND);

  // Wire 3: SDA / GPIO 21 (Green)
  const wireSDA = createWire([
    new THREE.Vector3(-0.9, 0.1, 0.8),
    new THREE.Vector3(-0.1, 0.5, 0.2),
    new THREE.Vector3(0.9, 0.1, 1.8),
  ], 0x22c55e);
  twin.add(wireSDA);

  // Wire 4: SCL / GPIO 22 (Yellow)
  const wireSCL = createWire([
    new THREE.Vector3(-0.9, 0.1, -0.4),
    new THREE.Vector3(0.1, 0.6, -0.4),
    new THREE.Vector3(1.2, 0.1, 1.8),
  ], 0xeab308);
  twin.add(wireSCL);

  // Mounting breadboard baseplate
  const baseGeo = new THREE.BoxGeometry(7.2, 0.2, 6.4);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.set(-0.2, -0.16, 0.1);
  base.receiveShadow = true;
  twin.add(base);

  return twin;
}

/**
 * Creates Rogue Airborne Target Drone with Transponder Beacon and 3D Phosphor Trail Ghost Meshes
 */
export function createRogueTargetDrone(color: number = 0xef4444): {
  group: THREE.Group;
  transponderMesh: THREE.Mesh;
  transponderMat: THREE.MeshBasicMaterial;
  ghostTrails: THREE.Mesh[];
} {
  const group = new THREE.Group();

  // Central Core (Faceted radar stealth pod)
  const coreGeo = new THREE.OctahedronGeometry(1.1, 1);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.3,
    metalness: 0.8,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.scale.set(1.4, 0.6, 1.8);
  core.castShadow = true;
  group.add(core);

  // Pulsing Transponder Light / Reflector Core (Phosphor illuminated)
  const lightGeo = new THREE.SphereGeometry(0.38, 12, 12);
  const transponderMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95,
  });
  const transponderMesh = new THREE.Mesh(lightGeo, transponderMat);
  group.add(transponderMesh);

  // 4 swept sensor winglets
  const wingGeo = new THREE.BoxGeometry(2.4, 0.08, 0.6);
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5, metalness: 0.6 });
  const wing1 = new THREE.Mesh(wingGeo, wingMat);
  wing1.rotation.y = Math.PI / 4;
  group.add(wing1);

  const wing2 = new THREE.Mesh(wingGeo, wingMat);
  wing2.rotation.y = -Math.PI / 4;
  group.add(wing2);

  // 3D Phosphor Trail Ghost Meshes (historical radar echo echoes trailing behind the drone)
  const ghostTrails: THREE.Mesh[] = [];
  for (let g = 0; g < 4; g++) {
    const ghostGeo = new THREE.SphereGeometry(0.3 - g * 0.05, 8, 8);
    const ghostMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf, // Phosphor cyan
      transparent: true,
      opacity: 0,
    });
    const ghostMesh = new THREE.Mesh(ghostGeo, ghostMat);
    ghostMesh.visible = false;
    ghostTrails.push(ghostMesh);
  }

  return {
    group,
    transponderMesh,
    transponderMat,
    ghostTrails,
  };
}

/**
 * Creates Ground Military Radar Tower with rotating microwave dish
 */
export function createRadarTower(): { group: THREE.Group; dishGroup: THREE.Group } {
  const group = new THREE.Group();

  // Lattice base structure
  const baseGeo = new THREE.CylinderGeometry(1.6, 3.2, 12, 6);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.6,
    metalness: 0.7,
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 6;
  base.castShadow = true;
  group.add(base);

  // Observation platform
  const platGeo = new THREE.CylinderGeometry(3.6, 3.6, 0.6, 12);
  const platMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
  const plat = new THREE.Mesh(platGeo, platMat);
  plat.position.y = 12.3;
  group.add(plat);

  // Rotating Dish Assembly
  const dishGroup = new THREE.Group();
  dishGroup.position.y = 13.5;

  const dishGeo = new THREE.SphereGeometry(2.8, 16, 16, 0, Math.PI);
  dishGeo.rotateX(Math.PI / 2);
  const dishMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.3,
    metalness: 0.8,
  });
  const dish = new THREE.Mesh(dishGeo, dishMat);
  dish.scale.set(1, 0.35, 1);
  dishGroup.add(dish);

  // Feed Horn antenna
  const hornGeo = new THREE.ConeGeometry(0.3, 1.8, 8);
  hornGeo.rotateX(-Math.PI / 2);
  const hornMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9 });
  const horn = new THREE.Mesh(hornGeo, hornMat);
  horn.position.set(0, 0, 1.8);
  dishGroup.add(horn);

  // Red beacon light on top
  const beaconGeo = new THREE.SphereGeometry(0.25, 8, 8);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.y = 2.2;
  dishGroup.add(beacon);

  group.add(dishGroup);

  return { group, dishGroup };
}

/**
 * Creates 3D Holographic Tactical Radar Range Disc with Phosphor Sweep Fan
 */
export function createTacticalRadarHudRing(): {
  group: THREE.Group;
  sweepMesh: THREE.Mesh;
} {
  const group = new THREE.Group();

  // Outer boundary ring
  const outerRingGeo = new THREE.RingGeometry(18, 18.25, 64);
  outerRingGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x14b8a6,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  });
  const outerRing = new THREE.Mesh(outerRingGeo, ringMat);
  group.add(outerRing);

  // Inner range ring
  const innerRingGeo = new THREE.RingGeometry(9, 9.18, 48);
  innerRingGeo.rotateX(-Math.PI / 2);
  const innerRing = new THREE.Mesh(innerRingGeo, ringMat);
  group.add(innerRing);

  // Sweep fan wedge with phosphor decay
  const sweepGeo = new THREE.RingGeometry(0.5, 18, 24, 1, 0, Math.PI / 4);
  sweepGeo.rotateX(-Math.PI / 2);
  const sweepMat = new THREE.MeshBasicMaterial({
    color: 0x5eead4,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const sweepMesh = new THREE.Mesh(sweepGeo, sweepMat);
  group.add(sweepMesh);

  return { group, sweepMesh };
}
