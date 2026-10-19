import * as THREE from 'three';

export interface TelemetryData {
  t: number;          // Runtime in seconds
  ax: number;         // Accelerometer X in m/s^2
  ay: number;         // Accelerometer Y in m/s^2
  az: number;         // Accelerometer Z in m/s^2
  gx: number;         // Gyroscope X in rad/s (Roll rate)
  gy: number;         // Gyroscope Y in rad/s (Pitch rate)
  gz: number;         // Gyroscope Z in rad/s (Yaw rate)
  pitch: number;      // Degrees
  roll: number;       // Degrees
  yaw: number;        // Degrees [0, 360)
  temp: number;       // Sensor temperature in Celsius
  lockOn: boolean;    // Target lock flag
}

export interface RadarTargetPoint {
  id: string;
  earthAngle: number; // 0..360 absolute Earth-grid bearing
  distance: number;   // 0..30 pixel radius from radar center
  type: 'recon' | 'interceptor' | 'beacon';
}

interface PhosphorTargetState {
  intensity: number;      // 0.05 to 1.0
  lastRelativeAngle: number;
  historyTrail: Array<{
    x: number;
    y: number;
    intensity: number;
    age: number;
  }>;
}

export class OledRenderer {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public texture: THREE.CanvasTexture;
  public sweepAngle: number = 0;
  private prevSweepAngle: number = 0;
  public targets: RadarTargetPoint[] = [
    { id: 'T1', earthAngle: 45, distance: 18, type: 'recon' },
    { id: 'T2', earthAngle: 135, distance: 25, type: 'interceptor' },
    { id: 'T3', earthAngle: 280, distance: 12, type: 'beacon' }
  ];

  // Persistent phosphor state across frames
  private phosphorMap: Map<string, PhosphorTargetState> = new Map();

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 128;
    this.canvas.height = 64;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Failed to create 2D canvas context for OLED');
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false; // Authentic sharp 1-bit OLED look

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
  }

  public update(telemetry: TelemetryData, deltaSec: number, dynamicTargets?: RadarTargetPoint[]): void {
    if (dynamicTargets) {
      this.targets = dynamicTargets;
    }

    this.prevSweepAngle = this.sweepAngle;
    // Advance radar sweep angle (e.g. ~240 deg/s)
    this.sweepAngle = (this.sweepAngle + 240 * deltaSec) % 360;

    const ctx = this.ctx;
    // Clear OLED black background
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, 128, 64);

    // Color definitions for OLED P7 tactical phosphor
    const oledColor = '#5eead4'; // Crisp high-contrast OLED Cyan
    const oledDim = '#115e59';
    const oledDark = '#042f2e';
    const oledBright = '#ffffff';

    // -------------------------------------------------------------
    // LEFT ZONE: TELEMETRY DASHBOARD (Matches user's ESP32 Sketch)
    // -------------------------------------------------------------
    ctx.fillStyle = oledColor;
    ctx.font = '6px "JetBrains Mono", monospace';
    ctx.textBaseline = 'top';

    ctx.fillText(`t: ${telemetry.t.toFixed(1)}s`, 2, 2);
    ctx.fillText(`x: ${telemetry.ax >= 0 ? ' ' : ''}${telemetry.ax.toFixed(1)}`, 2, 10);
    ctx.fillText(`y: ${telemetry.ay >= 0 ? ' ' : ''}${telemetry.ay.toFixed(1)}`, 2, 18);
    ctx.fillText(`z: ${telemetry.az >= 0 ? ' ' : ''}${telemetry.az.toFixed(1)}`, 2, 26);

    // Divider line
    ctx.strokeStyle = oledDim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(2, 34);
    ctx.lineTo(58, 34);
    ctx.stroke();

    ctx.fillText(`P:${Math.round(telemetry.pitch)}°`, 2, 37);
    ctx.fillText(`R:${Math.round(telemetry.roll)}°`, 2, 45);
    ctx.fillText(`Y:${Math.round(telemetry.yaw)}°`, 2, 53);

    // -------------------------------------------------------------
    // RIGHT ZONE: MILITARY RADAR SIMULATION (31px radius circular display)
    // -------------------------------------------------------------
    const centerX = 95;
    const centerY = 31;
    const maxRadius = 30;

    // Concentric range rings
    ctx.strokeStyle = oledDark;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, maxRadius - 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, maxRadius - 20, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(centerX - maxRadius, centerY);
    ctx.lineTo(centerX + maxRadius, centerY);
    ctx.moveTo(centerX, centerY - maxRadius);
    ctx.lineTo(centerX, centerY + maxRadius);
    ctx.stroke();

    // -------------------------------------------------------------
    // PHOSPHOR DECAY WEDGE (Trailing persistence afterglow fan behind sweep)
    // -------------------------------------------------------------
    const sweepRad = (this.sweepAngle * Math.PI) / 180;
    const trailSegments = 8;
    const trailAngleSpread = (50 * Math.PI) / 180; // 50-degree phosphor fade wedge

    for (let s = 0; s < trailSegments; s++) {
      const segRatio = s / trailSegments; // 0 (closest to beam) to 1 (oldest)
      const startRad = sweepRad - (segRatio + 1 / trailSegments) * trailAngleSpread;
      const endRad = sweepRad - segRatio * trailAngleSpread;
      const alpha = (1 - segRatio) * 0.14; // Smooth exponential alpha drop

      ctx.fillStyle = `rgba(94, 234, 212, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, maxRadius - 1, startRad, endRad);
      ctx.closePath();
      ctx.fill();
    }

    // Active Rotating Sweep Vector Line
    const sweepEndX = centerX + maxRadius * Math.cos(sweepRad);
    const sweepEndY = centerY + maxRadius * Math.sin(sweepRad);

    ctx.strokeStyle = oledBright;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(sweepEndX, sweepEndY);
    ctx.stroke();

    // -------------------------------------------------------------
    // TARGETS WITH PHOSPHOR DECAY & TRAILING BREADCRUMB ECHOES
    // -------------------------------------------------------------
    for (let i = 0; i < this.targets.length; i++) {
      const target = this.targets[i];
      let pState = this.phosphorMap.get(target.id);
      if (!pState) {
        pState = {
          intensity: 0.1,
          lastRelativeAngle: 0,
          historyTrail: [],
        };
        this.phosphorMap.set(target.id, pState);
      }

      // Compute relative screen angle factoring in device yaw
      let relAngle = (target.earthAngle - telemetry.yaw) % 360;
      if (relAngle < 0) relAngle += 360;
      pState.lastRelativeAngle = relAngle;

      const relRad = (relAngle * Math.PI) / 180;
      const targetX = centerX + target.distance * Math.cos(relRad);
      const targetY = centerY + target.distance * Math.sin(relRad);

      // Check if radar sweep just crossed or is near this target's bearing
      let angleDist = Math.abs(this.sweepAngle - relAngle);
      if (angleDist > 180) angleDist = 360 - angleDist;

      // When the beam strikes the target: excite phosphor to maximum 1.0!
      if (angleDist < 12) {
        pState.intensity = 1.0;

        // Record a new trail breadcrumb if moved significantly
        const lastBreadcrumb = pState.historyTrail[pState.historyTrail.length - 1];
        if (
          !lastBreadcrumb ||
          Math.hypot(lastBreadcrumb.x - targetX, lastBreadcrumb.y - targetY) > 1.2
        ) {
          pState.historyTrail.push({
            x: targetX,
            y: targetY,
            intensity: 1.0,
            age: 0,
          });
          // Keep up to 5 history trail echoes
          if (pState.historyTrail.length > 5) {
            pState.historyTrail.shift();
          }
        }
      } else {
        // Exponential phosphor decay over time (P7 decay rate ~ 1.2 / sec)
        pState.intensity = Math.max(0.12, pState.intensity * Math.exp(-1.3 * deltaSec));
      }

      // Update and draw historical phosphor trail echoes (ghost positions)
      for (let h = pState.historyTrail.length - 1; h >= 0; h--) {
        const breadcrumb = pState.historyTrail[h];
        breadcrumb.age += deltaSec;
        breadcrumb.intensity = Math.max(0, breadcrumb.intensity * Math.exp(-1.1 * deltaSec));

        if (breadcrumb.intensity < 0.05 || breadcrumb.age > 4.5) {
          pState.historyTrail.splice(h, 1);
          continue;
        }

        // Draw fading ghost dot for historical detection
        const trailAlpha = breadcrumb.intensity * 0.7;
        ctx.fillStyle = `rgba(45, 212, 191, ${trailAlpha.toFixed(2)})`;
        const radius = Math.max(0.8, 1.8 * breadcrumb.intensity);
        ctx.beginPath();
        ctx.arc(breadcrumb.x, breadcrumb.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw the primary detected target with its current phosphor decay level
      const currentIntensity = pState.intensity;

      if (currentIntensity > 0.6) {
        // Fresh strike: High-luminance core + blooming outer optical halo
        ctx.fillStyle = oledBright;
        ctx.beginPath();
        ctx.arc(targetX, targetY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Expanding decay ring
        ctx.strokeStyle = `rgba(94, 234, 212, ${(currentIntensity * 0.9).toFixed(2)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(targetX, targetY, 4.5, 0, Math.PI * 2);
        ctx.stroke();
      } else if (currentIntensity > 0.3) {
        // Mid-decay phosphor afterglow
        ctx.fillStyle = oledColor;
        ctx.beginPath();
        ctx.arc(targetX, targetY, 2.0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(20, 184, 166, ${(currentIntensity * 0.6).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(targetX, targetY, 3.5, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Resting baseline phosphor dot
        ctx.fillStyle = oledDim;
        ctx.fillRect(Math.floor(targetX - 1), Math.floor(targetY - 1), 2, 2);
      }
    }

    // OLED subtle screen border
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(0, 0, 128, 64);

    this.texture.needsUpdate = true;
  }
}
