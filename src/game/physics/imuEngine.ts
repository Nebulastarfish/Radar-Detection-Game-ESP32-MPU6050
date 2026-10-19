import * as THREE from 'three';
import { TelemetryData } from '../oled/oledRenderer';

export class ImuPhysicsEngine {
  public position: THREE.Vector3 = new THREE.Vector3(0, 45, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, -30);
  public rotation: THREE.Euler = new THREE.Euler(0, 0, 0, 'YXZ');
  public quaternion: THREE.Quaternion = new THREE.Quaternion();

  // Angular velocities (rad/s)
  public gyroX: number = 0; // Roll rate
  public gyroY: number = 0; // Yaw rate
  public gyroZ: number = 0; // Pitch rate

  // Proper linear accelerations in body frame (m/s^2)
  public accelX: number = 0;
  public accelY: number = 0;
  public accelZ: number = 9.81;

  // Earth attitude angles (degrees)
  public pitchDeg: number = 0;
  public rollDeg: number = 0;
  public yawDeg: number = 0;

  // Running mission time (seconds)
  public missionTime: number = 0;

  // Sensitivity / Hardware settings (matching MPU6050 datasheet)
  public accelRange: '2g' | '4g' | '8g' | '16g' = '4g';
  public gyroRange: '250dps' | '500dps' | '1000dps' | '2000dps' = '250dps';
  public filterBandwidthHz: number = 44;

  // Control inputs
  public inputPitch: number = 0;   // -1..1 (W/S)
  public inputRoll: number = 0;    // -1..1 (A/D)
  public inputYaw: number = 0;     // -1..1 (Q/E)
  public inputThrottle: number = 0.5; // 0..1
  public isBoosting: boolean = false; // Space

  // Simulation mode
  public mode: 'flight' | 'bench' = 'flight';

  // Manual bench override values
  public benchPitch: number = 0;
  public benchRoll: number = 0;
  public benchYaw: number = 0;
  public benchAccelNoise: boolean = true;

  // Reusable scratch objects to avoid GC
  private _forward: THREE.Vector3 = new THREE.Vector3();
  private _right: THREE.Vector3 = new THREE.Vector3();
  private _up: THREE.Vector3 = new THREE.Vector3();
  private _earthGravity: THREE.Vector3 = new THREE.Vector3(0, -9.81, 0);
  private _invQuat: THREE.Quaternion = new THREE.Quaternion();
  private _bodyGravity: THREE.Vector3 = new THREE.Vector3();
  private _linearAccel: THREE.Vector3 = new THREE.Vector3();
  private _prevVelocity: THREE.Vector3 = new THREE.Vector3();

  public update(dt: number): TelemetryData {
    // Clamp dt to prevent tunneling / large delta jumps
    const clampedDt = Math.min(dt, 0.05);
    this.missionTime += clampedDt;

    if (this.mode === 'flight') {
      this.updateFlightPhysics(clampedDt);
    } else {
      this.updateBenchPhysics(clampedDt);
    }

    // Pack into TelemetryData payload
    return {
      t: this.missionTime,
      ax: this.accelX,
      ay: this.accelY,
      az: this.accelZ,
      gx: this.gyroX,
      gy: this.gyroY,
      gz: this.gyroZ,
      pitch: this.pitchDeg,
      roll: this.rollDeg,
      yaw: this.yawDeg,
      temp: 24.5 + Math.sin(this.missionTime * 0.1) * 1.2,
      lockOn: false,
    };
  }

  private updateFlightPhysics(dt: number) {
    // Aerodynamic flight response
    const pitchSpeed = 1.6;
    const rollSpeed = 2.4;
    const yawSpeed = 1.1;

    // Apply control angular rates with spring damping
    this.gyroX = THREE.MathUtils.damp(this.gyroX, this.inputRoll * rollSpeed, 8, dt);
    this.gyroY = THREE.MathUtils.damp(this.gyroY, -this.inputYaw * yawSpeed, 6, dt);
    this.gyroZ = THREE.MathUtils.damp(this.gyroZ, this.inputPitch * pitchSpeed, 8, dt);

    // Integrate attitude
    this.rotation.x += this.gyroZ * dt;
    this.rotation.y += this.gyroY * dt;
    this.rotation.z += this.gyroX * dt;

    // Natural banking coordination: rolling creates gradual yaw turn
    this.rotation.y -= Math.sin(this.rotation.z) * 0.5 * dt;

    // Damp roll back toward level when no input
    if (Math.abs(this.inputRoll) < 0.05) {
      this.rotation.z = THREE.MathUtils.damp(this.rotation.z, 0, 3, dt);
    }

    // Keep pitch bounded within safe aeronautical envelope (-85° to +85°)
    this.rotation.x = THREE.MathUtils.clamp(this.rotation.x, -Math.PI * 0.45, Math.PI * 0.45);

    // Update quaternion from Euler
    this.quaternion.setFromEuler(this.rotation);

    // Calculate heading (0 to 360) and pitch/roll in degrees
    this.yawDeg = ((-this.rotation.y * 180 / Math.PI) % 360 + 360) % 360;
    this.pitchDeg = this.rotation.x * 180 / Math.PI;
    this.rollDeg = this.rotation.z * 180 / Math.PI;

    // Thrust & Linear Kinematics
    const baseSpeed = 35;
    const maxSpeed = this.isBoosting ? 85 : 55;
    const targetSpeed = baseSpeed + (maxSpeed - baseSpeed) * this.inputThrottle;

    // Direction vectors
    this._forward.set(0, 0, -1).applyQuaternion(this.quaternion);
    this._right.set(1, 0, 0).applyQuaternion(this.quaternion);
    this._up.set(0, 1, 0).applyQuaternion(this.quaternion);

    // Calculate target velocity
    const currentSpeed = this.velocity.length();
    const newSpeed = THREE.MathUtils.damp(currentSpeed, targetSpeed, 4, dt);
    this.velocity.copy(this._forward).multiplyScalar(newSpeed);

    // Compute derivative dV/dt (linear kinematic acceleration)
    this._linearAccel.copy(this.velocity).sub(this._prevVelocity).divideScalar(dt);
    this._prevVelocity.copy(this.velocity);

    // Update position
    this.position.addScaledVector(this.velocity, dt);

    // Keep within world altitude bounds (terrain floor 10, ceiling 350)
    if (this.position.y < 12) {
      this.position.y = 12;
      this.velocity.y = Math.max(0, this.velocity.y);
      this.rotation.x = Math.max(0, this.rotation.x);
    }

    // -----------------------------------------------------------------
    // PROPER ACCELERATION SENSOR EQUATIONS (Earth-Axis & Gravity Frame)
    // -----------------------------------------------------------------
    // The MPU6050 measures: a_sensor = a_inertial - g_gravity
    // In body coordinates:
    this._invQuat.copy(this.quaternion).invert();
    this._bodyGravity.copy(this._earthGravity).applyQuaternion(this._invQuat);

    // Project linear acceleration into body frame
    const bodyLinearAccel = this._linearAccel.clone().applyQuaternion(this._invQuat);

    // MPU6050 raw readings in m/s^2 (proper acceleration)
    // Note: stationary sensor resting flat on table points Z up against gravity -> az = +9.81
    this.accelX = parseFloat((bodyLinearAccel.x - this._bodyGravity.x).toFixed(2));
    this.accelY = parseFloat((bodyLinearAccel.y - this._bodyGravity.y).toFixed(2));
    this.accelZ = parseFloat((bodyLinearAccel.z - this._bodyGravity.z).toFixed(2));

    // Add tiny realistic sensor noise (0.02 m/s^2)
    this.accelX += (Math.random() - 0.5) * 0.04;
    this.accelY += (Math.random() - 0.5) * 0.04;
    this.accelZ += (Math.random() - 0.5) * 0.04;
  }

  private updateBenchPhysics(dt: number) {
    // In workbench mode, orientation is driven directly by sliders/orientation gestures
    this.pitchDeg = this.benchPitch;
    this.rollDeg = this.benchRoll;
    this.yawDeg = (this.benchYaw % 360 + 360) % 360;

    const pitchRad = (this.pitchDeg * Math.PI) / 180;
    const rollRad = (this.rollDeg * Math.PI) / 180;
    const yawRad = (this.yawDeg * Math.PI) / 180;

    this.rotation.set(pitchRad, -yawRad, rollRad, 'YXZ');
    this.quaternion.setFromEuler(this.rotation);

    // Stationary bench: linear acceleration = gravity reaction vector
    // ax = -g * sin(roll) * cos(pitch)
    // ay = g * sin(pitch)
    // az = g * cos(pitch) * cos(roll)
    const g = 9.81;
    let ax = -g * Math.sin(rollRad) * Math.cos(pitchRad);
    let ay = g * Math.sin(pitchRad);
    let az = g * Math.cos(pitchRad) * Math.cos(rollRad);

    if (this.benchAccelNoise) {
      ax += (Math.random() - 0.5) * 0.06;
      ay += (Math.random() - 0.5) * 0.06;
      az += (Math.random() - 0.5) * 0.06;
    }

    this.accelX = parseFloat(ax.toFixed(2));
    this.accelY = parseFloat(ay.toFixed(2));
    this.accelZ = parseFloat(az.toFixed(2));

    this.gyroX = 0;
    this.gyroY = 0;
    this.gyroZ = 0;
  }
}
