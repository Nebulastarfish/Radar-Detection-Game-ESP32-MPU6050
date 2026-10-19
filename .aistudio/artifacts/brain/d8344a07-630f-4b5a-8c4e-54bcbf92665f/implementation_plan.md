# Implementation Plan: Assistive Map, Gyroscopic Controls & Aviation Level HUD

Equip the AeroRadar flight game with a **Corner Tactical Radar Minimap & Full-Screen Sector Map**, **Mouse Virtual Flight Stick & Mobile Device Gyroscope Tilt Controls**, and professional **Aviation Level & Attitude Indicators** (pitch ladder, altitude tape, and wave milestone bar).

---

## 1. User Choices & Vision
* **Assistive Map**: Corner tactical radar minimap in bottom-right with an expandable full-screen sector map (`M` key) showing player position, heading cone, and enemy altitude differentials.
* **Gyroscopic Controls**: Mouse virtual flight stick with a centering control gimbal, paired with HTML5 `DeviceOrientationEvent` tilt support for phone/tablet gyroscopes.
* **Level & Position Indicators**: Aviation pitch ladder with artificial horizon, rolling altitude tape with ground clearance warning, and a top-center wave milestone progress bar.

---

## 2. Core Architecture & Modules

### A. Assistive Tactical Minimap & Expandable Sector Map (`src/components/AssistiveMap.tsx`)
* **Corner Radar Minimap**:
  * Positioned in bottom-right with high-contrast tactical scanline styling.
  * Shows player drone icon with directional heading cone ($45^\circ$ FOV), base runway, radar towers, and enemy blips.
  * Displays relative elevation ($\Delta h$) on each target: `▲ +45m` (above player) or `▼ -30m` (below player).
  * One-click or `M` shortcut to expand.
* **Expandable Full-Screen Sector Map**:
  * Full-viewport tactical overlay displaying coordinate grids (Alpha, Bravo, Charlie sectors).
  * Real-time flight paths, intercept trajectories, target classification cards (Recon, Interceptor, Flagship), and range rings ($500\text{m}$, $1500\text{m}$, $3000\text{m}$).
  * Interactive zoom and pan.

### B. Gyroscopic Flight Controls (`src/game/physics/imuEngine.ts` & `src/game/threeScene.ts`)
* **Mouse Virtual Flight Stick**:
  * Mouse cursor acts as a virtual joystick / gyro rate controller:
    * Vertical mouse offset $\to$ Pitch rate $\omega_y$ / Pitch tilt
    * Horizontal mouse offset $\to$ Roll rate $\omega_x$ / Rudder turn
  * Centering control gimbal HUD overlay showing current stick deflection with deadzone.
  * Toggleable via mouse click or flight controls setting.
* **Mobile & Tablet Physical Gyroscope Tilt**:
  * Integrates `window.DeviceOrientationEvent` (listening to `beta` pitch and `gamma` roll angles).
  * Maps physical device tilt directly into the MPU6050 IMU physics pipeline.
  * On-screen button to calibrate zero-level tilt and request motion permissions on mobile browsers.

### C. Aviation Level & Attitude HUD Gauges (`src/components/AviationHudGauges.tsx`)
* **Aviation Pitch Ladder & Artificial Horizon**:
  * Boresight reticle aligned to aircraft longitudinal axis.
  * Moving pitch ladder with $10^\circ, 20^\circ, 30^\circ$ pitch rungs that rotate with Roll $\phi$ and translate with Pitch $\theta$.
  * Sky/Ground attitude boundary line.
* **Rolling Altitude Tape & Ground Proximity Warning System (GPWS)**:
  * Vertical tape on right side showing exact altitude in meters.
  * Terrain proximity warning: flashes amber below $30\text{m}$ and red with audible siren below $15\text{m}$ ("PULL UP!").
* **Airspeed & Vertical Speed (VSI) Tape**:
  * Rolling airspeed indicator on left side ($0$ to $120\text{ m/s}$ / knots).
* **Wave Milestone & Threat Meter**:
  * Top-center linear milestone bar showing progression through Wave phases (Wave 1 $\to$ Wave 2 $\to$ Flagship Boss).
  * Segmented target nodes that illuminate green on radar scan and red on defeat.

---

## 3. Integration & Control Bindings
* **`M`**: Toggle Expandable Full-Screen Sector Map
* **`G`**: Toggle Mouse Virtual Flight Stick mode / Keyboard mode
* **`T`**: Cycle Code Matrix Opacity
* **`C`**: Cycle Camera Views
* **`Left Click / F`**: Pulse Plasma Blasters
* **`Right Click / Space`**: Guided Radar Seeker Missiles
* **`Shift`**: Afterburner Thrusters

---

## 4. Verification Plan
1. Test corner minimap rendering, player orientation cone, and enemy altitude indicators.
2. Verify full-screen sector map expansion with `M` key and mouse click.
3. Test mouse virtual flight stick responsiveness, deadzone centering, and mobile tilt support.
4. Verify pitch ladder rotation/translation accuracy against MPU6050 Earth-axis angles.
5. Verify build compilation (`compile_applet`) and type checking (`lint_applet`).
