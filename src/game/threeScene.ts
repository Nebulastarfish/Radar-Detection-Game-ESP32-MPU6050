import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ImuPhysicsEngine } from './physics/imuEngine';
import { OledRenderer, TelemetryData, RadarTargetPoint } from './oled/oledRenderer';
import {
  createTacticalDrone,
  createEsp32HardwareTwin,
  createRogueTargetDrone,
  createRadarTower,
  createTacticalRadarHudRing,
  getTerrainGridTexture
} from './scene/proceduralModels';
import { WeaponsSystem } from './combat/weaponsSystem';
import { soundEngine } from '../audio/soundEngine';

export interface GameState {
  score: number;
  targetsScanned: number;
  targetsDestroyed: number;
  totalWaveTargets: number;
  wave: number;
  currentObjective: string;
  lockProgress: number; // 0..100%
  lockedTargetId: string | null;
  radarRangeMeters: number; // 500, 1000, 2000
  cameraMode: 'chase' | 'cockpit' | 'hardware' | 'orbit';
  isPaused: boolean;
  gameStatus: 'title' | 'playing' | 'gameover' | 'victory';
  // Combat stats
  playerHealth: number; // 0..100
  playerShield: number; // 0..100
  missileCount: number; // 0..4
  missileReloadProgress: number; // 0..100%
  blasterHeat: number; // 0..100%
  lastCombatAction: 'blaster' | 'missile' | 'lock' | 'hit' | 'idle';
  codeMatrixOpacity: number; // 0, 0.25, 0.5, 0.75
}

export interface TargetEntity {
  id: string;
  mesh: THREE.Group;
  transponderMesh: THREE.Mesh;
  transponderMat: THREE.MeshBasicMaterial;
  ghostTrails: THREE.Mesh[];
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  type: 'recon' | 'interceptor' | 'beacon' | 'flagship';
  scanned: boolean;
  scanProgress: number; // 0..1
  phosphorIntensity: number; // 0.15 to 1.0 (P7 phosphor afterglow)
  baseColor: number;
  health: number;
  maxHealth: number;
  isDestroyed: boolean;
  fireCooldown: number;
  trailHistory: Array<{
    pos: THREE.Vector3;
    intensity: number;
    age: number;
  }>;
}

interface RadarPingEcho {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  currentRadius: number;
  maxRadius: number;
  opacity: number;
  decayRate: number;
  expansionSpeed: number;
}

export class ThreeSceneManager {
  public container: HTMLElement;
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public imuEngine: ImuPhysicsEngine;
  public oledRenderer: OledRenderer;
  public weapons: WeaponsSystem;

  public gameState: GameState = {
    score: 0,
    targetsScanned: 0,
    targetsDestroyed: 0,
    totalWaveTargets: 5,
    wave: 1,
    currentObjective: 'Wave 1: Neutralize or Scan Rogue Aerial Contacts via Radar Lock',
    lockProgress: 0,
    lockedTargetId: null,
    radarRangeMeters: 1000,
    cameraMode: 'chase',
    isPaused: false,
    gameStatus: 'title',
    playerHealth: 100,
    playerShield: 100,
    missileCount: 4,
    missileReloadProgress: 0,
    blasterHeat: 0,
    lastCombatAction: 'idle',
    codeMatrixOpacity: 0.35,
  };

  public telemetry: TelemetryData = {
    t: 0,
    ax: 0,
    ay: 0,
    az: 9.81,
    gx: 0,
    gy: 0,
    gz: 0,
    pitch: 0,
    roll: 0,
    yaw: 0,
    temp: 24.5,
    lockOn: false,
  };

  // 3D Objects
  private droneGroup: THREE.Group;
  private leftThruster: THREE.Mesh;
  private rightThruster: THREE.Mesh;
  private hardwareTwin: THREE.Group;
  private radarTowers: { group: THREE.Group; dishGroup: THREE.Group }[] = [];
  private targets: TargetEntity[] = [];

  // Hardpoint muzzle vectors
  private leftWingMuzzle: THREE.Vector3 = new THREE.Vector3();
  private rightWingMuzzle: THREE.Vector3 = new THREE.Vector3();
  private bellyHardpoint: THREE.Vector3 = new THREE.Vector3();

  // 3D Holographic Tactical Radar Ring & Sweep
  private radarHudGroup: THREE.Group;
  private radarSweepMesh: THREE.Mesh;

  // Active 3D Radar Ping Echo Rings (Phosphor decay ripple)
  private activeEchoRings: RadarPingEcho[] = [];
  private echoRingGeometry: THREE.RingGeometry;

  // Shield regeneration timer
  private timeSinceLastHit: number = 0;

  // Animation & Loop
  private animFrameId: number | null = null;
  private lastTime: number = 0;
  private isDestroyed: boolean = false;

  // Orbit controls / mouse drag state
  public isDragging: boolean = false;
  private previousMouseX: number = 0;
  private previousMouseY: number = 0;
  public orbitSpherical: THREE.Spherical = new THREE.Spherical(12, Math.PI / 3, Math.PI / 4);

  // Input states
  private isFiringBlasterHeld: boolean = false;

  // Scratch objects for high-performance zero-GC loop
  private _scratchVec1: THREE.Vector3 = new THREE.Vector3();
  private _scratchVec2: THREE.Vector3 = new THREE.Vector3();
  private _camTarget: THREE.Vector3 = new THREE.Vector3();
  private _tempColor: THREE.Color = new THREE.Color();

  // Callback to push state to React HUD
  public onStateUpdate?: (state: GameState, telemetry: TelemetryData) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. WebGL Renderer with ACES Filmic tone mapping
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // 2. Camera & Scene
    this.camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 3500);
    this.camera.position.set(0, 50, 20);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060913); // Deep night sky
    this.scene.fog = new THREE.FogExp2(0x060913, 0.0012);

    // 3. PBR Studio Environment (PMREMGenerator + RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 4. Studio Lighting Rig (Warm key light, cool hemisphere fill)
    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
    keyLight.position.set(120, 200, 100);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 10;
    keyLight.shadow.camera.far = 600;
    const d = 120;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x090d16, 0.85);
    this.scene.add(hemiLight);

    // 5. Initialize Subsystems
    this.imuEngine = new ImuPhysicsEngine();
    this.oledRenderer = new OledRenderer();
    this.weapons = new WeaponsSystem(this.scene);

    // Reusable geometry for 3D expanding radar ping rings
    this.echoRingGeometry = new THREE.RingGeometry(0.9, 1.0, 32);
    this.echoRingGeometry.rotateX(-Math.PI / 2);

    // 6. Build Tactical Environment & Models
    this.buildEnvironment();

    const droneData = createTacticalDrone();
    this.droneGroup = droneData.group;
    this.leftThruster = droneData.leftThruster;
    this.rightThruster = droneData.rightThruster;
    this.scene.add(this.droneGroup);

    // 3D Tactical Radar HUD Disc beneath drone
    const radarHud = createTacticalRadarHudRing();
    this.radarHudGroup = radarHud.group;
    this.radarSweepMesh = radarHud.sweepMesh;
    this.radarHudGroup.position.set(0, -1.2, 0);
    this.droneGroup.add(this.radarHudGroup);

    // Hardware Twin: ESP32 + MPU6050 + OLED
    this.hardwareTwin = createEsp32HardwareTwin(this.oledRenderer.texture);
    this.scene.add(this.hardwareTwin);

    // Spawn initial tactical targets
    this.spawnTargets();

    // Setup input listeners
    this.setupEventListeners();

    // Pre-warm shaders
    this.renderer.compile(this.scene, this.camera);

    // Start loop
    this.lastTime = performance.now();
    this.tick = this.tick.bind(this);
    this.animFrameId = requestAnimationFrame(this.tick);
  }

  private buildEnvironment() {
    // Terrain Ground with tactical radar grid
    const terrainGeo = new THREE.PlaneGeometry(3000, 3000, 1, 1);
    terrainGeo.rotateX(-Math.PI / 2);
    const gridTexture = getTerrainGridTexture();
    const terrainMat = new THREE.MeshStandardMaterial({
      map: gridTexture,
      roughness: 0.85,
      metalness: 0.1,
    });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.receiveShadow = true;
    this.scene.add(terrain);

    // Military Base Runway
    const runwayGeo = new THREE.BoxGeometry(40, 0.2, 350);
    const runwayMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.7,
      metalness: 0.2,
    });
    const runway = new THREE.Mesh(runwayGeo, runwayMat);
    runway.position.set(0, 0.1, 0);
    runway.receiveShadow = true;
    this.scene.add(runway);

    // Runway Centerline Lights
    const lightGeo = new THREE.BoxGeometry(0.8, 0.15, 6);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (let z = -150; z < 150; z += 25) {
      const mark = new THREE.Mesh(lightGeo, lightMat);
      mark.position.set(0, 0.25, z);
      this.scene.add(mark);
    }

    // Radar Towers positioned in the terrain
    const towerPositions = [
      new THREE.Vector3(120, 0, -220),
      new THREE.Vector3(-180, 0, -150),
      new THREE.Vector3(260, 0, 140),
    ];

    towerPositions.forEach((pos) => {
      const tower = createRadarTower();
      tower.group.position.copy(pos);
      this.scene.add(tower.group);
      this.radarTowers.push(tower);
    });
  }

  public spawnTargets() {
    // Remove existing
    this.targets.forEach((t) => {
      this.scene.remove(t.mesh);
      t.ghostTrails.forEach((g) => this.scene.remove(g));
    });
    this.targets = [];

    const wave = this.gameState.wave;
    const targetSpecs = [
      { pos: new THREE.Vector3(140, 65, -380), vel: new THREE.Vector3(-6, 0, 12), type: 'recon' as const, hp: 50 },
      { pos: new THREE.Vector3(-220, 85, -520), vel: new THREE.Vector3(15, 0, 8), type: 'interceptor' as const, hp: 90 },
      { pos: new THREE.Vector3(320, 50, -260), vel: new THREE.Vector3(-10, 0, -12), type: 'interceptor' as const, hp: 90 },
      { pos: new THREE.Vector3(-120, 95, -780), vel: new THREE.Vector3(8, 0, 16), type: 'recon' as const, hp: 60 },
      { pos: new THREE.Vector3(0, 110, -950), vel: new THREE.Vector3(0, 0, 18), type: wave >= 2 ? ('flagship' as const) : ('beacon' as const), hp: wave >= 2 ? 220 : 100 },
    ];

    targetSpecs.forEach((spec, idx) => {
      const color =
        spec.type === 'flagship'
          ? 0x8b5cf6 // Purple Boss Flagship
          : spec.type === 'interceptor'
          ? 0xef4444
          : spec.type === 'recon'
          ? 0xf59e0b
          : 0x06b6d4;

      const targetData = createRogueTargetDrone(color);
      targetData.group.position.copy(spec.pos);
      if (spec.type === 'flagship') {
        targetData.group.scale.set(1.6, 1.6, 1.6);
      }
      this.scene.add(targetData.group);

      targetData.ghostTrails.forEach((ghost) => {
        this.scene.add(ghost);
      });

      this.targets.push({
        id: `TGT-0${idx + 1}`,
        mesh: targetData.group,
        transponderMesh: targetData.transponderMesh,
        transponderMat: targetData.transponderMat,
        ghostTrails: targetData.ghostTrails,
        position: spec.pos.clone(),
        velocity: spec.vel.clone(),
        type: spec.type,
        scanned: false,
        scanProgress: 0,
        phosphorIntensity: 0.2,
        baseColor: color,
        health: spec.hp,
        maxHealth: spec.hp,
        isDestroyed: false,
        fireCooldown: Math.random() * 2,
        trailHistory: [],
      });
    });

    this.gameState.totalWaveTargets = this.targets.length;
  }

  public spawnRadarPingEcho(worldPos: THREE.Vector3) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x5eead4,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const echoMesh = new THREE.Mesh(this.echoRingGeometry, mat);
    echoMesh.position.copy(worldPos);
    this.scene.add(echoMesh);

    this.activeEchoRings.push({
      mesh: echoMesh,
      material: mat,
      currentRadius: 2.0,
      maxRadius: 22.0,
      opacity: 0.85,
      decayRate: 1.2,
      expansionSpeed: 20.0,
    });
  }

  private setupEventListeners() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('resize', this.handleResize);

    const dom = this.renderer.domElement;
    dom.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.code === 'KeyW' || e.code === 'ArrowUp') this.imuEngine.inputPitch = 1.0;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') this.imuEngine.inputPitch = -1.0;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.imuEngine.inputRoll = -1.0;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') this.imuEngine.inputRoll = 1.0;
    if (e.code === 'KeyQ') this.imuEngine.inputYaw = 1.0;
    if (e.code === 'KeyE') this.imuEngine.inputYaw = -1.0;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this.imuEngine.isBoosting = true;
    }

    // Weapons
    if (e.code === 'KeyF') {
      this.triggerBlasterFire();
    }
    if (e.code === 'Space') {
      // Space fires guided missile during flight dogfight!
      this.triggerMissileFire();
    }

    if (e.code === 'KeyR') {
      soundEngine.playRadarPing(1100, 1.2);
      this.targets.forEach((tgt) => {
        if (!tgt.isDestroyed) this.spawnRadarPingEcho(tgt.position);
      });
    }

    // Toggle Code Matrix Opacity (T)
    if (e.code === 'KeyT') {
      this.cycleCodeMatrixOpacity();
    }

    if (e.code === 'KeyC') {
      this.cycleCamera();
    }
    if (e.code === 'Escape') {
      this.togglePause();
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'KeyS' || e.code === 'ArrowDown') {
      this.imuEngine.inputPitch = 0;
    }
    if (e.code === 'KeyA' || e.code === 'ArrowLeft' || e.code === 'KeyD' || e.code === 'ArrowRight') {
      this.imuEngine.inputRoll = 0;
    }
    if (e.code === 'KeyQ' || e.code === 'KeyE') {
      this.imuEngine.inputYaw = 0;
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this.imuEngine.isBoosting = false;
    }
  };

  private handleBlur = () => {
    this.imuEngine.inputPitch = 0;
    this.imuEngine.inputRoll = 0;
    this.imuEngine.inputYaw = 0;
    this.imuEngine.isBoosting = false;
    this.isFiringBlasterHeld = false;
  };

  private handleResize = () => {
    if (!this.container || this.isDestroyed) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (this.gameState.gameStatus === 'playing') {
      if (e.button === 0) {
        // Left click: Fire Blaster
        this.triggerBlasterFire();
        this.isFiringBlasterHeld = true;
      } else if (e.button === 2) {
        // Right click: Launch Guided Seeker Missile
        this.triggerMissileFire();
      }
    }

    this.isDragging = true;
    this.previousMouseX = e.clientX;
    this.previousMouseY = e.clientY;
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    const deltaX = e.clientX - this.previousMouseX;
    const deltaY = e.clientY - this.previousMouseY;
    this.previousMouseX = e.clientX;
    this.previousMouseY = e.clientY;

    if (this.gameState.cameraMode === 'hardware' || this.gameState.cameraMode === 'orbit') {
      this.orbitSpherical.theta -= deltaX * 0.008;
      this.orbitSpherical.phi = THREE.MathUtils.clamp(
        this.orbitSpherical.phi - deltaY * 0.008,
        0.1,
        Math.PI * 0.48
      );
    }
  };

  private handleMouseUp = (e: MouseEvent) => {
    this.isDragging = false;
    if (e.button === 0) {
      this.isFiringBlasterHeld = false;
    }
  };

  public triggerBlasterFire() {
    if (this.gameState.gameStatus !== 'playing') return;

    // Hardpoint positions on drone wings
    const quat = this.droneGroup.quaternion;
    const pos = this.droneGroup.position;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);

    this.leftWingMuzzle.set(-2.2, 0.0, -0.6).applyQuaternion(quat).add(pos);
    this.rightWingMuzzle.set(2.2, 0.0, -0.6).applyQuaternion(quat).add(pos);

    this.weapons.firePlayerBlaster(this.leftWingMuzzle, this.rightWingMuzzle, fwd);
    this.gameState.lastCombatAction = 'blaster';
  }

  public triggerMissileFire() {
    if (this.gameState.gameStatus !== 'playing') return;
    if (!this.weapons.canFireMissile()) return;

    const quat = this.droneGroup.quaternion;
    const pos = this.droneGroup.position;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
    this.bellyHardpoint.set(0, -0.6, 0.2).applyQuaternion(quat).add(pos);

    this.weapons.firePlayerMissile(this.bellyHardpoint, fwd, this.gameState.lockedTargetId);
    this.gameState.lastCombatAction = 'missile';
  }

  public cycleCodeMatrixOpacity() {
    const levels = [0.35, 0.65, 0.9, 0];
    const currIdx = levels.indexOf(this.gameState.codeMatrixOpacity);
    const nextIdx = (currIdx + 1) % levels.length;
    this.gameState.codeMatrixOpacity = levels[nextIdx];
    soundEngine.playUiClick();
  }

  public cycleCamera() {
    const modes: GameState['cameraMode'][] = ['chase', 'cockpit', 'hardware', 'orbit'];
    const nextIdx = (modes.indexOf(this.gameState.cameraMode) + 1) % modes.length;
    this.setCameraMode(modes[nextIdx]);
  }

  public setCameraMode(mode: GameState['cameraMode']) {
    this.gameState.cameraMode = mode;
    if (mode === 'hardware') {
      this.imuEngine.mode = 'bench';
      this.orbitSpherical.set(9, Math.PI / 3.5, Math.PI / 4);
    } else {
      this.imuEngine.mode = 'flight';
      this.orbitSpherical.set(16, Math.PI / 3, Math.PI);
    }
    soundEngine.playUiClick();
  }

  public togglePause() {
    this.gameState.isPaused = !this.gameState.isPaused;
    soundEngine.playUiClick();
  }

  public startGame() {
    this.gameState.gameStatus = 'playing';
    this.gameState.score = 0;
    this.gameState.targetsScanned = 0;
    this.gameState.targetsDestroyed = 0;
    this.gameState.wave = 1;
    this.gameState.playerHealth = 100;
    this.gameState.playerShield = 100;
    this.gameState.lockProgress = 0;
    this.gameState.lockedTargetId = null;
    this.gameState.currentObjective = 'Wave 1: Neutralize or Scan Rogue Aerial Contacts via Radar Lock';
    this.imuEngine.position.set(0, 45, 0);
    this.imuEngine.velocity.set(0, 0, -35);
    this.imuEngine.rotation.set(0, 0, 0);
    this.weapons.reset();
    this.spawnTargets();
    soundEngine.playUiClick();
  }

  private tick(now: number) {
    if (this.isDestroyed) return;
    this.animFrameId = requestAnimationFrame(this.tick);

    const deltaSec = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (!this.gameState.isPaused) {
      // 1. Update Physics and IMU
      this.telemetry = this.imuEngine.update(deltaSec);

      // Continuous blaster firing if held
      if (this.isFiringBlasterHeld && this.gameState.gameStatus === 'playing') {
        this.triggerBlasterFire();
      }

      // Shield regeneration (regenerates if not hit in 3.5 seconds)
      this.timeSinceLastHit += deltaSec;
      if (this.timeSinceLastHit > 3.5 && this.gameState.playerShield < 100) {
        this.gameState.playerShield = Math.min(100, this.gameState.playerShield + 15 * deltaSec);
      }

      // Update Drone 3D Transform
      this.droneGroup.position.copy(this.imuEngine.position);
      this.droneGroup.quaternion.copy(this.imuEngine.quaternion);

      // Thruster flame scale
      const thrusterScale = 1.0 + (this.imuEngine.isBoosting ? 1.4 : this.imuEngine.inputThrottle * 0.6);
      this.leftThruster.scale.set(1, 1, thrusterScale);
      this.rightThruster.scale.set(1, 1, thrusterScale);

      // Rotate 3D holographic radar sweep wedge
      const sweepRad = (this.oledRenderer.sweepAngle * Math.PI) / 180;
      this.radarSweepMesh.rotation.y = -sweepRad;

      // Sound update
      soundEngine.updateThrusterSound(this.imuEngine.inputThrottle, this.imuEngine.isBoosting);

      // Rotate Radar Towers
      this.radarTowers.forEach((tower) => {
        tower.dishGroup.rotation.y += 1.2 * deltaSec;
      });

      // 2. Update Weapons & Combat Simulation
      const combatTargets = this.targets.map((t) => ({
        id: t.id,
        position: t.position,
        health: t.health,
        isDestroyed: t.isDestroyed,
      }));

      this.weapons.update(
        deltaSec,
        combatTargets,
        this.imuEngine.position,
        (targetId, damage, hitPos) => {
          // On Enemy Hit
          const tgt = this.targets.find((t) => t.id === targetId);
          if (tgt && !tgt.isDestroyed) {
            tgt.health -= damage;
            tgt.phosphorIntensity = 1.0;
            this.gameState.lastCombatAction = 'hit';

            // Flash enemy model red
            tgt.mesh.traverse((c) => {
              if (c instanceof THREE.Mesh && c.material) {
                c.material.color?.setHex?.(0xffffff);
              }
            });
            setTimeout(() => {
              tgt.mesh.traverse((c) => {
                if (c instanceof THREE.Mesh && c.material) {
                  c.material.color?.setHex?.(tgt.baseColor);
                }
              });
            }, 60);

            if (tgt.health <= 0) {
              tgt.isDestroyed = true;
              tgt.mesh.visible = false;
              tgt.ghostTrails.forEach((g) => (g.visible = false));
              this.weapons.spawnExplosion(tgt.position, tgt.type === 'flagship' ? 2.8 : 1.8);
              this.gameState.targetsDestroyed += 1;
              this.gameState.score += tgt.type === 'flagship' ? 1500 : 750;

              // Check Wave or Victory
              this.checkWaveProgress();
            }
          }
        },
        (damage) => {
          // On Player Hit
          this.timeSinceLastHit = 0;
          this.weapons.cameraShake = Math.max(this.weapons.cameraShake, 0.8);
          this.gameState.lastCombatAction = 'hit';

          if (this.gameState.playerShield > 0) {
            const absorb = Math.min(this.gameState.playerShield, damage);
            this.gameState.playerShield -= absorb;
            damage -= absorb;
          }
          if (damage > 0) {
            this.gameState.playerHealth = Math.max(0, this.gameState.playerHealth - damage);
            if (this.gameState.playerHealth <= 0) {
              this.gameState.gameStatus = 'gameover';
              this.weapons.spawnExplosion(this.imuEngine.position, 2.5);
            }
          }
        }
      );

      // Sync weapon stats to gameState
      this.gameState.missileCount = this.weapons.missileCount;
      this.gameState.missileReloadProgress = Math.round(
        (this.weapons.missileReloadTimer / this.weapons.missileReloadDuration) * 100
      );
      this.gameState.blasterHeat = Math.round(
        (this.weapons.blasterCooldown / this.weapons.blasterFireRate) * 100
      );

      // 3. Update Targets, Radar, Phosphor Decay & Enemy AI
      this.updateTargetsAndRadar(deltaSec);

      // 4. Update Active 3D Radar Echo Rings
      this.updateActiveEchoRings(deltaSec);

      // 5. Update Hardware Twin Transform
      if (this.gameState.cameraMode === 'hardware') {
        this.hardwareTwin.visible = true;
        this.hardwareTwin.position.set(0, 0, 0);
        this.hardwareTwin.rotation.set(
          (this.telemetry.pitch * Math.PI) / 180,
          (-this.telemetry.yaw * Math.PI) / 180,
          (this.telemetry.roll * Math.PI) / 180
        );
      } else {
        this.hardwareTwin.position.copy(this.droneGroup.position).addScaledVector(
          new THREE.Vector3(0, -0.2, -0.6).applyQuaternion(this.droneGroup.quaternion),
          1
        );
        this.hardwareTwin.scale.set(0.15, 0.15, 0.15);
        this.hardwareTwin.quaternion.copy(this.droneGroup.quaternion);
      }
    }

    // 6. Camera Position & Damping + Camera Shake
    this.updateCamera(deltaSec);

    // 7. Render 3D Scene
    this.renderer.render(this.scene, this.camera);

    // 8. Notify React HUD
    if (this.onStateUpdate) {
      this.onStateUpdate(this.gameState, this.telemetry);
    }
  }

  private checkWaveProgress() {
    const aliveTargets = this.targets.filter((t) => !t.isDestroyed);
    if (aliveTargets.length === 0) {
      if (this.gameState.wave === 1) {
        // Advance to Wave 2
        this.gameState.wave = 2;
        this.gameState.currentObjective = 'Wave 2: Heavy Interceptors & Armed Drone Flight Inbound!';
        soundEngine.playTargetAcquired();
        setTimeout(() => {
          this.spawnTargets();
        }, 1500);
      } else {
        // Victory!
        this.gameState.gameStatus = 'victory';
      }
    }
  }

  private updateTargetsAndRadar(dt: number) {
    const playerPos = this.imuEngine.position;
    const playerFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.imuEngine.quaternion);
    const radarRange = this.gameState.radarRangeMeters;
    const currentSweep = this.oledRenderer.sweepAngle;

    const dynamicRadarPoints: RadarTargetPoint[] = [];
    let closestTarget: TargetEntity | null = null;
    let closestAngleDiff = Infinity;

    this.targets.forEach((target) => {
      if (target.isDestroyed) return;

      // Enemy Combat Maneuvers & Flight AI
      target.position.addScaledVector(target.velocity, dt);

      // Bank turning behaviors
      if (target.type === 'interceptor' || target.type === 'flagship') {
        // Steer slightly towards or around player
        this._scratchVec1.subVectors(playerPos, target.position);
        const distToPlayer = this._scratchVec1.length();

        if (distToPlayer < 450 && distToPlayer > 80) {
          this._scratchVec2.copy(this._scratchVec1).normalize();
          target.velocity.lerp(this._scratchVec2.multiplyScalar(28), 0.8 * dt);
        }

        // Enemy Retaliatory Fire if facing player
        target.fireCooldown -= dt;
        if (target.fireCooldown <= 0 && distToPlayer < 350) {
          target.fireCooldown = target.type === 'flagship' ? 1.2 : 2.5;
          const fireDir = this._scratchVec1.normalize();
          this.weapons.fireEnemyBlaster(target.position, fireDir);
        }
      }

      target.mesh.position.copy(target.position);
      target.mesh.rotation.y += 0.8 * dt;

      // Distance from player
      this._scratchVec1.subVectors(target.position, playerPos);
      const dist = this._scratchVec1.length();

      // Earth-grid absolute azimuth bearing (0..360)
      const earthAngle = ((Math.atan2(this._scratchVec1.x, -this._scratchVec1.z) * 180) / Math.PI + 360) % 360;

      // Distance scaled to OLED radar display radius (0..30px)
      const distScaled = THREE.MathUtils.clamp((dist / radarRange) * 28, 4, 30);

      dynamicRadarPoints.push({
        id: target.id,
        earthAngle,
        distance: distScaled,
        type: target.type === 'flagship' ? 'interceptor' : target.type,
      });

      // Relative angle compared to current device heading
      let relAngle = (earthAngle - this.telemetry.yaw) % 360;
      if (relAngle < 0) relAngle += 360;

      // Check if the radar sweep passed this target this frame
      let sweepDelta = Math.abs(currentSweep - relAngle);
      if (sweepDelta > 180) sweepDelta = 360 - sweepDelta;

      // STRIKE: Radar sweep excitation
      if (sweepDelta < 8) {
        target.phosphorIntensity = 1.0;

        const lastBreadcrumb = target.trailHistory[target.trailHistory.length - 1];
        if (!lastBreadcrumb || lastBreadcrumb.pos.distanceTo(target.position) > 15) {
          target.trailHistory.push({
            pos: target.position.clone(),
            intensity: 1.0,
            age: 0,
          });
          if (target.trailHistory.length > 4) {
            target.trailHistory.shift();
          }
        }

        if (Math.random() < 0.35) {
          this.spawnRadarPingEcho(target.position);
          soundEngine.playRadarPing(800 + (30 - distScaled) * 20, 0.6);
        }
      } else {
        target.phosphorIntensity = Math.max(0.18, target.phosphorIntensity * Math.exp(-1.4 * dt));
      }

      // Render 3D Target Phosphor Trailing Fade
      const p = target.phosphorIntensity;
      if (p > 0.5) {
        this._tempColor.setHex(0xffffff).lerp(new THREE.Color(0x5eead4), 1 - p);
        target.transponderMat.color.copy(this._tempColor);
        target.transponderMat.opacity = 1.0;
        target.transponderMesh.scale.setScalar(1.0 + (p - 0.5) * 0.8);
      } else {
        this._tempColor.setHex(target.baseColor).lerp(new THREE.Color(0x14b8a6), p * 2);
        target.transponderMat.color.copy(this._tempColor);
        target.transponderMat.opacity = 0.5 + p * 0.5;
        target.transponderMesh.scale.setScalar(1.0);
      }

      // Update 3D ghost trail meshes
      for (let g = 0; g < target.ghostTrails.length; g++) {
        const ghostMesh = target.ghostTrails[g];
        const breadcrumb = target.trailHistory[target.trailHistory.length - 1 - g];

        if (breadcrumb && breadcrumb.intensity > 0.08) {
          breadcrumb.age += dt;
          breadcrumb.intensity = Math.max(0, breadcrumb.intensity * Math.exp(-1.0 * dt));

          ghostMesh.visible = true;
          ghostMesh.position.copy(breadcrumb.pos);
          const ghostMat = ghostMesh.material as THREE.MeshBasicMaterial;
          ghostMat.opacity = breadcrumb.intensity * 0.55;
          ghostMesh.scale.setScalar(0.8 + breadcrumb.intensity * 0.4);
        } else {
          ghostMesh.visible = false;
        }
      }

      // Check alignment with player crosshairs (forward cone) for Radar Missile Lock
      this._scratchVec2.copy(this._scratchVec1).normalize();
      const dot = playerFwd.dot(this._scratchVec2);
      const angleDeg = Math.acos(THREE.MathUtils.clamp(dot, -1, 1)) * (180 / Math.PI);

      if (angleDeg < 18 && dist < radarRange * 0.9) {
        if (angleDeg < closestAngleDiff) {
          closestAngleDiff = angleDeg;
          closestTarget = target;
        }
      }
    });

    // Handle Lock-on & Scanning
    if (closestTarget) {
      this.gameState.lockedTargetId = (closestTarget as TargetEntity).id;
      (closestTarget as TargetEntity).scanProgress += dt * 0.85; // Quick lock ~1.2s
      this.gameState.lockProgress = Math.min(100, Math.round((closestTarget as TargetEntity).scanProgress * 100));

      if (this.gameState.lockProgress === 100) {
        soundEngine.playLockAcquired();
        this.gameState.lastCombatAction = 'lock';
      } else if (Math.random() < 0.15) {
        soundEngine.playLockOnAlert();
      }

      if ((closestTarget as TargetEntity).scanProgress >= 1.0 && !(closestTarget as TargetEntity).scanned) {
        (closestTarget as TargetEntity).scanned = true;
        this.gameState.targetsScanned += 1;
        this.gameState.score += 400;
        soundEngine.playTargetAcquired();
      }
    } else {
      this.gameState.lockedTargetId = null;
      this.gameState.lockProgress = Math.max(0, this.gameState.lockProgress - dt * 60);
    }

    // Update OLED canvas texture
    this.oledRenderer.update(this.telemetry, dt, dynamicRadarPoints);
  }

  private updateActiveEchoRings(dt: number) {
    for (let i = this.activeEchoRings.length - 1; i >= 0; i--) {
      const echo = this.activeEchoRings[i];
      echo.currentRadius += echo.expansionSpeed * dt;
      echo.opacity = Math.max(0, echo.opacity - echo.decayRate * dt);

      echo.mesh.scale.setScalar(echo.currentRadius);
      echo.material.opacity = echo.opacity;

      if (echo.opacity <= 0.01 || echo.currentRadius >= echo.maxRadius) {
        this.scene.remove(echo.mesh);
        echo.material.dispose();
        this.activeEchoRings.splice(i, 1);
      }
    }
  }

  private updateCamera(dt: number) {
    // Camera shake offset
    let shakeX = 0;
    let shakeY = 0;
    if (this.weapons.cameraShake > 0) {
      shakeX = (Math.random() - 0.5) * this.weapons.cameraShake * 1.5;
      shakeY = (Math.random() - 0.5) * this.weapons.cameraShake * 1.5;
    }

    if (this.gameState.cameraMode === 'chase') {
      this._scratchVec1.set(0 + shakeX, 3.2 + shakeY, 11).applyQuaternion(this.droneGroup.quaternion);
      const targetCamPos = this._camTarget.copy(this.droneGroup.position).add(this._scratchVec1);

      this.camera.position.lerp(targetCamPos, 1 - Math.exp(-10 * dt));

      this._scratchVec2.set(0, 0.4, -12).applyQuaternion(this.droneGroup.quaternion);
      const lookAtPos = this.droneGroup.position.clone().add(this._scratchVec2);
      this.camera.lookAt(lookAtPos);
    } else if (this.gameState.cameraMode === 'cockpit') {
      this._scratchVec1.set(0 + shakeX * 0.4, 0.45 + shakeY * 0.4, -0.6).applyQuaternion(this.droneGroup.quaternion);
      this.camera.position.copy(this.droneGroup.position).add(this._scratchVec1);

      this._scratchVec2.set(0, 0.3, -30).applyQuaternion(this.droneGroup.quaternion);
      this.camera.lookAt(this.droneGroup.position.clone().add(this._scratchVec2));
    } else if (this.gameState.cameraMode === 'hardware') {
      this._scratchVec1.setFromSpherical(this.orbitSpherical);
      this.camera.position.lerp(this._scratchVec1, 1 - Math.exp(-12 * dt));
      this.camera.lookAt(0, 0, 0);
    } else if (this.gameState.cameraMode === 'orbit') {
      this._scratchVec1.setFromSpherical(this.orbitSpherical).add(this.droneGroup.position);
      this.camera.position.lerp(this._scratchVec1, 1 - Math.exp(-8 * dt));
      this.camera.lookAt(this.droneGroup.position);
    }
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    soundEngine.stopAll();

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('resize', this.handleResize);

    const dom = this.renderer.domElement;
    dom.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);

    this.weapons.reset();
    this.activeEchoRings.forEach((echo) => {
      this.scene.remove(echo.mesh);
      echo.material.dispose();
    });
    this.activeEchoRings = [];
    this.echoRingGeometry.dispose();

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
