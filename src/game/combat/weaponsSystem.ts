import * as THREE from 'three';
import { soundEngine } from '../../audio/soundEngine';

export interface BlasterBolt {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  owner: 'player' | 'enemy';
  life: number;
  damage: number;
}

export interface SeekerMissile {
  mesh: THREE.Group;
  plumeMesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  speed: number;
  targetId: string | null;
  life: number;
  damage: number;
  smokeTimer: number;
}

export interface ExplosionFx {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  scale: number;
  maxScale: number;
  life: number;
  maxLife: number;
}

export interface SmokePuff {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class WeaponsSystem {
  public scene: THREE.Scene;

  // Pools
  public blasterBolts: BlasterBolt[] = [];
  public seekerMissiles: SeekerMissile[] = [];
  public explosions: ExplosionFx[] = [];
  public smokePuffs: SmokePuff[] = [];

  // Player Arsenal State
  public missileCount: number = 4;
  public maxMissiles: number = 4;
  public missileReloadTimer: number = 0;
  public missileReloadDuration: number = 4.5; // Seconds to rearm a missile
  public blasterCooldown: number = 0;
  public blasterFireRate: number = 0.12; // ~8 rounds/sec
  public alternateMuzzle: boolean = false;

  // Camera Shake & Hitstop
  public cameraShake: number = 0;
  public hitstopTimer: number = 0;

  // Geometries and Materials cache
  private boltGeo: THREE.CylinderGeometry;
  private playerBoltMat: THREE.MeshBasicMaterial;
  private enemyBoltMat: THREE.MeshBasicMaterial;
  private explosionGeo: THREE.SphereGeometry;
  private smokeGeo: THREE.DodecahedronGeometry;
  private smokeMat: THREE.MeshBasicMaterial;

  // Scratch objects for high performance
  private _targetDir: THREE.Vector3 = new THREE.Vector3();
  private _missileFwd: THREE.Vector3 = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Fast reusable meshes
    this.boltGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.4, 8);
    this.boltGeo.rotateX(Math.PI / 2);

    this.playerBoltMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8, // High-energy cyan plasma
    });

    this.enemyBoltMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e, // Hostile crimson plasma
    });

    this.explosionGeo = new THREE.SphereGeometry(1.0, 12, 12);
    this.smokeGeo = new THREE.DodecahedronGeometry(0.4, 0);
    this.smokeMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.6,
    });
  }

  public canFireBlaster(): boolean {
    return this.blasterCooldown <= 0;
  }

  public canFireMissile(): boolean {
    return this.missileCount > 0;
  }

  /**
   * Fires high-energy pulse plasma blaster bolt from left or right wing hardpoint
   */
  public firePlayerBlaster(
    leftMuzzle: THREE.Vector3,
    rightMuzzle: THREE.Vector3,
    forwardDir: THREE.Vector3
  ): void {
    if (this.blasterCooldown > 0) return;
    this.blasterCooldown = this.blasterFireRate;

    const spawnPos = this.alternateMuzzle ? rightMuzzle.clone() : leftMuzzle.clone();
    this.alternateMuzzle = !this.alternateMuzzle;

    const boltMesh = new THREE.Mesh(this.boltGeo, this.playerBoltMat);
    boltMesh.position.copy(spawnPos);
    boltMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), forwardDir);
    this.scene.add(boltMesh);

    const speed = 240; // m/s
    const velocity = forwardDir.clone().multiplyScalar(speed);

    this.blasterBolts.push({
      mesh: boltMesh,
      position: spawnPos,
      velocity,
      owner: 'player',
      life: 1.4,
      damage: 28,
    });

    soundEngine.playBlasterFire();
  }

  /**
   * Launches radar-guided seeker missile
   */
  public firePlayerMissile(
    spawnPos: THREE.Vector3,
    forwardDir: THREE.Vector3,
    targetId: string | null
  ): void {
    if (this.missileCount <= 0) return;
    this.missileCount--;

    // Build Composite 3D Seeker Missile Model (Body + 4 Fins + Exhaust Plume)
    const missileGroup = new THREE.Group();
    missileGroup.position.copy(spawnPos);

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.22, 2.2, 10);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.3,
      metalness: 0.8,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    missileGroup.add(body);

    // Nosecone radome
    const noseGeo = new THREE.ConeGeometry(0.2, 0.7, 10);
    noseGeo.rotateX(-Math.PI / 2);
    const noseMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5 });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(0, 0, -1.35);
    missileGroup.add(nose);

    // 4 guidance fins
    const finGeo = new THREE.BoxGeometry(0.8, 0.04, 0.4);
    const finMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 });
    const fin1 = new THREE.Mesh(finGeo, finMat);
    fin1.position.set(0, 0, 0.7);
    missileGroup.add(fin1);
    const fin2 = new THREE.Mesh(finGeo, finMat);
    fin2.rotation.z = Math.PI / 2;
    fin2.position.set(0, 0, 0.7);
    missileGroup.add(fin2);

    // Rocket Exhaust Plume
    const plumeGeo = new THREE.ConeGeometry(0.18, 1.2, 8);
    plumeGeo.rotateX(Math.PI / 2);
    const plumeMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.9,
    });
    const plumeMesh = new THREE.Mesh(plumeGeo, plumeMat);
    plumeMesh.position.set(0, 0, 1.5);
    missileGroup.add(plumeMesh);

    missileGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), forwardDir);
    this.scene.add(missileGroup);

    const initialSpeed = 50;
    const velocity = forwardDir.clone().multiplyScalar(initialSpeed);

    this.seekerMissiles.push({
      mesh: missileGroup,
      plumeMesh,
      position: spawnPos.clone(),
      velocity,
      speed: initialSpeed,
      targetId,
      life: 5.0,
      damage: 180,
      smokeTimer: 0,
    });

    soundEngine.playMissileLaunch();
    this.cameraShake = Math.max(this.cameraShake, 0.4);
  }

  /**
   * Fires an enemy plasma bolt towards the player
   */
  public fireEnemyBlaster(origin: THREE.Vector3, direction: THREE.Vector3): void {
    const boltMesh = new THREE.Mesh(this.boltGeo, this.enemyBoltMat);
    boltMesh.position.copy(origin);
    boltMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
    this.scene.add(boltMesh);

    const speed = 160;
    const velocity = direction.clone().multiplyScalar(speed);

    this.blasterBolts.push({
      mesh: boltMesh,
      position: origin.clone(),
      velocity,
      owner: 'enemy',
      life: 1.8,
      damage: 14,
    });

    soundEngine.playBlasterFire();
  }

  /**
   * Spawns explosive fireball burst and camera shake
   */
  public spawnExplosion(pos: THREE.Vector3, intensity: number = 1.0): void {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.95,
    });
    const mesh = new THREE.Mesh(this.explosionGeo, mat);
    mesh.position.copy(pos);
    mesh.scale.setScalar(0.8);
    this.scene.add(mesh);

    this.explosions.push({
      mesh,
      position: pos.clone(),
      scale: 0.8,
      maxScale: 12.0 * intensity,
      life: 0.65,
      maxLife: 0.65,
    });

    // Spawn smoke debris puffs around explosion
    for (let i = 0; i < 6; i++) {
      const pMat = this.smokeMat.clone();
      const pMesh = new THREE.Mesh(this.smokeGeo, pMat);
      pMesh.position.copy(pos);
      this.scene.add(pMesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        Math.random() * 15,
        (Math.random() - 0.5) * 20
      );

      this.smokePuffs.push({
        mesh: pMesh,
        position: pos.clone(),
        velocity: vel,
        life: 1.2,
        maxLife: 1.2,
      });
    }

    soundEngine.playExplosion();
    this.cameraShake = Math.max(this.cameraShake, 1.2 * intensity);
    this.hitstopTimer = 0.045; // 45ms hitstop punch
  }

  /**
   * Main combat simulation tick
   */
  public update(
    dt: number,
    targets: { id: string; position: THREE.Vector3; health: number; isDestroyed: boolean }[],
    playerPos: THREE.Vector3,
    onEnemyHit: (targetId: string, damage: number, hitPos: THREE.Vector3) => void,
    onPlayerHit: (damage: number) => void
  ): void {
    // Cooldown timers
    if (this.blasterCooldown > 0) {
      this.blasterCooldown -= dt;
    }

    // Missile reload rearm loop
    if (this.missileCount < this.maxMissiles) {
      this.missileReloadTimer += dt;
      if (this.missileReloadTimer >= this.missileReloadDuration) {
        this.missileReloadTimer = 0;
        this.missileCount = Math.min(this.maxMissiles, this.missileCount + 1);
      }
    }

    // Camera shake decay
    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 3.5);
    }
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
    }

    // 1. Update Blaster Bolts
    for (let i = this.blasterBolts.length - 1; i >= 0; i--) {
      const bolt = this.blasterBolts[i];
      bolt.life -= dt;
      bolt.position.addScaledVector(bolt.velocity, dt);
      bolt.mesh.position.copy(bolt.position);

      let hasCollided = false;

      if (bolt.owner === 'player') {
        // Test against enemy targets
        for (let t = 0; t < targets.length; t++) {
          const tgt = targets[t];
          if (tgt.isDestroyed) continue;

          if (bolt.position.distanceTo(tgt.position) < 4.8) {
            hasCollided = true;
            onEnemyHit(tgt.id, bolt.damage, bolt.position);
            this.spawnExplosion(bolt.position, 0.4);
            break;
          }
        }
      } else {
        // Test against player
        if (bolt.position.distanceTo(playerPos) < 3.8) {
          hasCollided = true;
          onPlayerHit(bolt.damage);
          this.spawnExplosion(bolt.position, 0.5);
          soundEngine.playShieldHit();
        }
      }

      if (hasCollided || bolt.life <= 0) {
        this.scene.remove(bolt.mesh);
        this.blasterBolts.splice(i, 1);
      }
    }

    // 2. Update Seeker Missiles (Proportional Navigation)
    for (let i = this.seekerMissiles.length - 1; i >= 0; i--) {
      const missile = this.seekerMissiles[i];
      missile.life -= dt;

      // Rocket acceleration
      missile.speed = Math.min(150, missile.speed + dt * 65);

      // Seek target if assigned and active
      let targetPos: THREE.Vector3 | null = null;
      if (missile.targetId) {
        const found = targets.find((t) => t.id === missile.targetId && !t.isDestroyed);
        if (found) targetPos = found.position;
      }

      // Current missile forward direction
      this._missileFwd.copy(missile.velocity).normalize();

      if (targetPos) {
        this._targetDir.subVectors(targetPos, missile.position).normalize();
        // Turn towards target with angular damping
        this._missileFwd.lerp(this._targetDir, Math.min(1.0, 7.5 * dt)).normalize();
      }

      missile.velocity.copy(this._missileFwd).multiplyScalar(missile.speed);
      missile.position.addScaledVector(missile.velocity, dt);
      missile.mesh.position.copy(missile.position);
      missile.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), this._missileFwd);

      // Plume flicker
      missile.plumeMesh.scale.z = 1.0 + Math.random() * 0.5;

      // Spawn smoke trail puff
      missile.smokeTimer += dt;
      if (missile.smokeTimer > 0.05) {
        missile.smokeTimer = 0;
        const pMesh = new THREE.Mesh(this.smokeGeo, this.smokeMat.clone());
        pMesh.position.copy(missile.position);
        this.scene.add(pMesh);

        this.smokePuffs.push({
          mesh: pMesh,
          position: missile.position.clone(),
          velocity: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3),
          life: 0.8,
          maxLife: 0.8,
        });
      }

      // Check impact collision against targets
      let exploded = false;
      for (let t = 0; t < targets.length; t++) {
        const tgt = targets[t];
        if (tgt.isDestroyed) continue;

        if (missile.position.distanceTo(tgt.position) < 5.8) {
          exploded = true;
          onEnemyHit(tgt.id, missile.damage, missile.position);
          this.spawnExplosion(missile.position, 1.6);
          break;
        }
      }

      if (exploded || missile.life <= 0) {
        if (!exploded && missile.life <= 0) {
          this.spawnExplosion(missile.position, 0.8);
        }
        this.scene.remove(missile.mesh);
        this.seekerMissiles.splice(i, 1);
      }
    }

    // 3. Update Explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      exp.life -= dt;
      const progress = 1 - exp.life / exp.maxLife;

      exp.scale = THREE.MathUtils.lerp(0.8, exp.maxScale, Math.sin(progress * Math.PI * 0.5));
      exp.mesh.scale.setScalar(exp.scale);

      const mat = exp.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1 - progress);

      // Color shifts from yellow-white to burning red
      if (progress < 0.4) {
        mat.color.setHex(0xfef08a);
      } else if (progress < 0.7) {
        mat.color.setHex(0xf97316);
      } else {
        mat.color.setHex(0xef4444);
      }

      if (exp.life <= 0) {
        this.scene.remove(exp.mesh);
        mat.dispose();
        this.explosions.splice(i, 1);
      }
    }

    // 4. Update Smoke Puffs
    for (let i = this.smokePuffs.length - 1; i >= 0; i--) {
      const puff = this.smokePuffs[i];
      puff.life -= dt;
      puff.position.addScaledVector(puff.velocity, dt);
      puff.mesh.position.copy(puff.position);

      const progress = 1 - puff.life / puff.maxLife;
      puff.mesh.scale.setScalar(0.4 + progress * 2.2);
      const mat = puff.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, (1 - progress) * 0.5);

      if (puff.life <= 0) {
        this.scene.remove(puff.mesh);
        mat.dispose();
        this.smokePuffs.splice(i, 1);
      }
    }
  }

  public reset(): void {
    this.blasterBolts.forEach((b) => this.scene.remove(b.mesh));
    this.blasterBolts = [];

    this.seekerMissiles.forEach((m) => this.scene.remove(m.mesh));
    this.seekerMissiles = [];

    this.explosions.forEach((e) => this.scene.remove(e.mesh));
    this.explosions = [];

    this.smokePuffs.forEach((s) => this.scene.remove(s.mesh));
    this.smokePuffs = [];

    this.missileCount = this.maxMissiles;
    this.missileReloadTimer = 0;
    this.blasterCooldown = 0;
    this.cameraShake = 0;
    this.hitstopTimer = 0;
  }
}
