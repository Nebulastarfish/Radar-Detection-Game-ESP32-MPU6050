import React, { useState } from 'react';
import { Copy, Check, X, Cpu, Zap, Radio, BookOpen, AlertCircle, Sparkles } from 'lucide-react';

interface EngineeringModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EngineeringModal: React.FC<EngineeringModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'code' | 'wiring' | 'diagram' | 'math'>('code');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const sketchInoCode = `/**
 * =========================================================================
 * ESP32 + MPU6050 + SSD1306 OLED (128x64 I2C) - Tactical Radar & Telemetry
 * WITH P7 CRT PHOSPHOR DECAY PERSISTENCE SIMULATION
 * =========================================================================
 * Wiring (Both I2C modules share the bus):
 * - ESP32 3V3       -> MPU6050 VCC  &  OLED VCC  (CRITICAL: Do NOT use VN!)
 * - ESP32 GND       -> MPU6050 GND  &  OLED GND
 * - ESP32 GPIO 21   -> MPU6050 SDA  &  OLED SDA (I2C Data)
 * - ESP32 GPIO 22   -> MPU6050 SCL  &  OLED SCL (I2C Clock)
 *
 * Required Wokwi Libraries:
 * 1. Adafruit SSD1306
 * 2. Adafruit GFX Library
 * 3. Adafruit MPU6050
 * 4. Adafruit Unified Sensor
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <math.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define SCREEN_ADDRESS 0x3C // Default SSD1306 I2C address

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
Adafruit_MPU6050 mpu;

float sweep_angle = 0;
const float DEG_TO_RAD_CONST = 0.01745329; // (pi / 180)

// Earth-Axis Orientation & Telemetry
float pitch = 0;
float roll = 0;
float yaw = 0; // Integrated from gyro Z-axis over delta-time
unsigned long last_time = 0;

// Absolute bearings (0-360 deg) and distances of 3 Earth-stationary targets
float target_angle[3] = {45, 135, 280};
float target_dist[3] = {18, 25, 12};

// P7 Phosphor decay intensity counters (decay from 24 down to 0)
uint8_t target_phosphor[3] = {0, 0, 0};

void setup() {
  Serial.begin(115200);

  // 1. Initialize SSD1306 OLED Display
  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("SSD1306 allocation failed - Check 3V3 wiring and I2C SDA/SCL!"));
    for(;;);
  }
  
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("LOCKING HEADING...");
  display.println("ALIGNING EARTH GRID...");
  display.display();

  // 2. Initialize MPU6050 6-Axis IMU
  if (!mpu.begin()) {
    Serial.println("Failed to find MPU6050 chip - Check 3.3V power!");
    while (1) { delay(10); }
  }

  // 3. Configure Hardware Sensitivities
  mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
  mpu.setGyroRange(MPU6050_RANGE_250_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_44_HZ);

  last_time = millis();
  delay(1000);
}

void loop() {
  // A. Compute Delta Time (dt) and Runtime (t)
  unsigned long current_time = millis();
  float dt = (current_time - last_time) / 1000.0;
  last_time = current_time;
  float t_sec = current_time / 1000.0;

  // B. Poll 6-Axis IMU events
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  // C. Calculate Pitch & Roll relative to Earth's Gravity Vector
  pitch = atan2(a.acceleration.y, a.acceleration.z) * 57.29578;
  roll = atan2(-a.acceleration.x, sqrt(a.acceleration.y * a.acceleration.y + a.acceleration.z * a.acceleration.z)) * 57.29578;

  // D. Integrate Gyroscopic Z-rate for Compass Yaw Heading
  if (abs(g.gyro.z) > 0.04) { // Drift noise deadband
    yaw += g.gyro.z * dt * 57.29578; 
  }
  
  // Wrap yaw into [0, 360)
  if (yaw >= 360) yaw -= 360;
  if (yaw < 0) yaw += 360;

  display.clearDisplay();

  // ==========================================
  // LEFT ZONE: TELEMETRY DASHBOARD
  // ==========================================
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  display.setCursor(0, 0);
  display.print("t: "); display.print(t_sec, 1); display.println("s");
  
  display.print("x: "); display.print(a.acceleration.x, 1); display.println(" m/s2");
  display.print("y: "); display.print(a.acceleration.y, 1); display.println(" m/s2");
  display.print("z: "); display.print(a.acceleration.z, 1); display.println(" m/s2");
  display.println("-----------");
  
  display.print("Pit: "); display.print((int)pitch); display.println(" deg");
  display.print("Rol: "); display.print((int)roll); display.println(" deg");
  display.print("Yaw: "); display.print((int)yaw); display.println(" deg");

  // ==========================================
  // RIGHT ZONE: MILITARY RADAR SIMULATION
  // ==========================================
  int centerX = 95;
  int centerY = 31;
  int maxRadius = 31;

  // Concentric radar range circles
  display.drawCircle(centerX, centerY, maxRadius, SSD1306_WHITE);
  display.drawCircle(centerX, centerY, maxRadius - 10, SSD1306_WHITE);
  display.drawCircle(centerX, centerY, maxRadius - 20, SSD1306_WHITE);

  // Axis crosshairs
  display.drawFastHLine(centerX - maxRadius, centerY, maxRadius * 2 + 1, SSD1306_WHITE);
  display.drawFastVLine(centerX, centerY - maxRadius, maxRadius * 2 + 1, SSD1306_WHITE);

  // Sweep line rotation
  sweep_angle += 12;
  if (sweep_angle >= 360) sweep_angle -= 360;

  float sweep_rad = sweep_angle * DEG_TO_RAD_CONST;
  int sweep_end_x = centerX + (int)(maxRadius * cos(sweep_rad));
  int sweep_end_y = centerY + (int)(maxRadius * sin(sweep_rad));
  display.drawLine(centerX, centerY, sweep_end_x, sweep_end_y, SSD1306_WHITE);

  // Draw compass-stabilized targets with phosphor afterglow decay
  for (int i = 0; i < 3; i++) {
    float rel_angle = target_angle[i] - yaw;
    if (rel_angle < 0) rel_angle += 360;
    
    float rel_rad = rel_angle * DEG_TO_RAD_CONST;
    int target_x = centerX + (int)(target_dist[i] * cos(rel_rad));
    int target_y = centerY + (int)(target_dist[i] * sin(rel_rad));

    float sweep_diff = abs(sweep_angle - rel_angle);
    if (sweep_diff > 180) sweep_diff = 360 - sweep_diff;

    // Beam strike excites phosphor to max persistence value
    if (sweep_diff < 12) {
      target_phosphor[i] = 24; // Peak excitation
    } else if (target_phosphor[i] > 0) {
      target_phosphor[i]--;    // Gradual afterglow decay
    }

    // Render multi-stage phosphor decay
    if (target_phosphor[i] > 14) {
      // Fresh strike: High-energy illuminated core + outer bloom ring
      display.fillCircle(target_x, target_y, 3, SSD1306_WHITE);
      display.drawCircle(target_x, target_y, 5, SSD1306_WHITE);
    } else if (target_phosphor[i] > 6) {
      // Mid-stage phosphor afterglow
      display.fillCircle(target_x, target_y, 2, SSD1306_WHITE);
    } else {
      // Faded baseline track point
      display.drawPixel(target_x, target_y, SSD1306_WHITE);
    }
  }

  display.display();
  delay(10);
}`;

  const wokwiDiagramJson = `{
  "version": 1,
  "author": "AeroRadar Tactical Engineer",
  "editor": "wokwi",
  "parts": [
    { "type": "board-esp32-devkit-c-v4", "id": "esp", "top": 0, "left": 0, "attrs": {} },
    { "type": "wokwi-mpu6050", "id": "mpu", "top": -80, "left": -180, "attrs": {} },
    { "type": "board-ssd1306", "id": "oled", "top": 120, "left": -180, "attrs": { "i2cAddress": "0x3c" } }
  ],
  "connections": [
    [ "esp:3V3", "mpu:VCC", "red", [ "h-30", "v-80" ] ],
    [ "esp:3V3", "oled:VCC", "red", [ "h-30", "v120" ] ],
    [ "esp:GND.1", "mpu:GND", "black", [ "h-20", "v-60" ] ],
    [ "esp:GND.1", "oled:GND", "black", [ "h-20", "v140" ] ],
    [ "esp:21", "mpu:SDA", "green", [ "h-15", "v-40" ] ],
    [ "esp:21", "oled:SDA", "green", [ "h-15", "v160" ] ],
    [ "esp:22", "mpu:SCL", "gold", [ "h-10", "v-20" ] ],
    [ "esp:22", "oled:SCL", "gold", [ "h-10", "v180" ] ]
  ],
  "dependencies": {}
}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-wide font-hud text-emerald-400 flex items-center gap-2">
                <span>ESP32 + MPU6050 + SSD1306 OLED ENGINEERING BLUEPRINT</span>
                <span className="px-2 py-0.5 text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full font-mono font-normal flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Phosphor Decay V2
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Ready-to-run Wokwi simulation code, wiring pinout, and Earth-axis mathematics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800 bg-slate-900/50">
          <button
            onClick={() => setActiveTab('code')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${
              activeTab === 'code'
                ? 'bg-slate-800 text-emerald-400 border-t-2 border-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" /> sketch.ino (Arduino Code)
          </button>
          <button
            onClick={() => setActiveTab('wiring')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${
              activeTab === 'wiring'
                ? 'bg-slate-800 text-emerald-400 border-t-2 border-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" /> Hardware Wiring Table
          </button>
          <button
            onClick={() => setActiveTab('diagram')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${
              activeTab === 'diagram'
                ? 'bg-slate-800 text-emerald-400 border-t-2 border-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-4 h-4" /> Wokwi diagram.json
          </button>
          <button
            onClick={() => setActiveTab('math')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${
              activeTab === 'math'
                ? 'bg-slate-800 text-emerald-400 border-t-2 border-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" /> Earth-Axis & Phosphor Math
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 font-mono text-xs">
          {activeTab === 'code' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs">
                  Copy and paste directly into your Wokwi <b>sketch.ino</b> tab:
                </span>
                <button
                  onClick={() => copyToClipboard(sketchInoCode, 'sketch')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-sans text-xs font-medium transition-colors cursor-pointer"
                >
                  {copiedKey === 'sketch' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'sketch' ? 'Copied!' : 'Copy sketch.ino'}
                </button>
              </div>
              <pre className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-emerald-300 overflow-x-auto select-text leading-relaxed">
                {sketchInoCode}
              </pre>
            </div>
          )}

          {activeTab === 'wiring' && (
            <div className="space-y-6">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200 leading-relaxed font-sans">
                  <b>Critical Fix Explained:</b> The reason your display was completely blank in your previous attempt is because the red wires were wired to <b>VN</b> (GPIO 39), which is an <i>input-only analog pin</i> supplying 0 Volts. Connecting both VCC pins to <b>3V3</b> provides clean 3.3V power to both chips!
                </div>
              </div>

              <div className="border border-slate-800 rounded-lg overflow-hidden font-sans">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-300 border-b border-slate-700">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">ESP32 DevKit V1 Pin</th>
                      <th className="py-2.5 px-4 font-semibold">Module Connection</th>
                      <th className="py-2.5 px-4 font-semibold">Wire Color</th>
                      <th className="py-2.5 px-4 font-semibold">Function & Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    <tr className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-bold text-red-400">3V3 (Top-Left)</td>
                      <td className="py-2.5 px-4 font-semibold text-white">MPU6050 VCC & OLED VCC</td>
                      <td className="py-2.5 px-4"><span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-2 align-middle"></span>Red</td>
                      <td className="py-2.5 px-4">Powers both 3.3V I2C breakout boards.</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-bold text-slate-400">GND (Top-Right)</td>
                      <td className="py-2.5 px-4 font-semibold text-white">MPU6050 GND & OLED GND</td>
                      <td className="py-2.5 px-4"><span className="inline-block w-3 h-3 rounded-full bg-slate-800 border border-slate-600 mr-2 align-middle"></span>Black</td>
                      <td className="py-2.5 px-4">Common ground reference line.</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-bold text-emerald-400">GPIO 21 (Pin D21)</td>
                      <td className="py-2.5 px-4 font-semibold text-white">MPU6050 SDA & OLED SDA</td>
                      <td className="py-2.5 px-4"><span className="inline-block w-3 h-3 rounded-full bg-emerald-500 mr-2 align-middle"></span>Green</td>
                      <td className="py-2.5 px-4">I2C Serial Data Bus (Shared by both devices).</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-bold text-amber-400">GPIO 22 (Pin D22)</td>
                      <td className="py-2.5 px-4 font-semibold text-white">MPU6050 SCL & OLED SCL</td>
                      <td className="py-2.5 px-4"><span className="inline-block w-3 h-3 rounded-full bg-amber-400 mr-2 align-middle"></span>Yellow</td>
                      <td className="py-2.5 px-4">I2C Serial Clock Line (400kHz Fast Mode).</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-950 p-4 border border-slate-800 rounded-lg space-y-2 font-sans">
                <h4 className="font-semibold text-white text-xs">Required Libraries in Wokwi Library Manager:</h4>
                <ul className="list-disc list-inside text-slate-400 space-y-1 text-xs">
                  <li><b className="text-emerald-400">Adafruit SSD1306</b> (Monochrome OLED display driver)</li>
                  <li><b className="text-emerald-400">Adafruit GFX Library</b> (Primitives, lines, text, circles)</li>
                  <li><b className="text-emerald-400">Adafruit MPU6050</b> (Accelerometer and Gyroscope register interface)</li>
                  <li><b className="text-emerald-400">Adafruit Unified Sensor</b> (Standardized sensor events and units)</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'diagram' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs">
                  You can paste this into Wokwi's <b>diagram.json</b> tab for 1-click automated wiring:
                </span>
                <button
                  onClick={() => copyToClipboard(wokwiDiagramJson, 'diagram')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-sans text-xs font-medium transition-colors cursor-pointer"
                >
                  {copiedKey === 'diagram' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'diagram' ? 'Copied!' : 'Copy diagram.json'}
                </button>
              </div>
              <pre className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-emerald-300 overflow-x-auto select-text leading-relaxed">
                {wokwiDiagramJson}
              </pre>
            </div>
          )}

          {activeTab === 'math' && (
            <div className="space-y-4 font-sans text-xs text-slate-300 leading-relaxed">
              <h3 className="text-emerald-400 font-bold font-hud text-sm">
                Earth-Axis Inertial Measurement & Phosphor Decay Equations
              </h3>
              <p>
                In professional tactical radar and flight guidance systems, cathode-ray tube (CRT) P7 phosphor persistence and Earth-Centered coordinate frames work together to give pilots immediate spatial awareness:
              </p>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2 font-mono text-emerald-300">
                <div><b>1. Proper Acceleration Vector:</b></div>
                <div>a = [a_x, a_y, a_z]^T (measured in m/s^2)</div>
                <div className="text-slate-400 text-[11px]">When resting flat: a_x=0, a_y=0, a_z=+9.81 m/s^2 (reaction to Earth gravity)</div>
                
                <div className="pt-2"><b>2. Pitch Angle (&theta;):</b></div>
                <div>&theta; = atan2(a_y, a_z) * (180 / &pi;)</div>
                
                <div className="pt-2"><b>3. Roll Angle (&phi;):</b></div>
                <div>&phi; = atan2(-a_x, sqrt(a_y^2 + a_z^2)) * (180 / &pi;)</div>

                <div className="pt-2"><b>4. Compass Yaw Heading (&psi;):</b></div>
                <div>&psi;_t = &psi;_(t - &Delta;t) + &omega;_z * &Delta;t * (180 / &pi;)</div>
                <div className="text-slate-400 text-[11px]">Integrated over discrete sample interval &Delta;t with a 0.04 rad/s noise deadband.</div>

                <div className="pt-2"><b>5. Compass-Stabilized Radar Projection:</b></div>
                <div>&theta;_screen = (&theta;_earth_target - &psi;_device) mod 360&deg;</div>

                <div className="pt-2 text-cyan-400"><b>6. P7 Phosphor Afterglow Decay (Trailing Fade):</b></div>
                <div className="text-cyan-300">I(t) = I_0 * e^(-t / &tau;)</div>
                <div className="text-slate-400 text-[11px]">
                  When the sweep ray intersects target azimuth, the phosphor excites to maximum luminance I_0 = 1.0. As the sweep rotates away, the blip decays exponentially with afterglow half-life &tau; &approx; 1.5s, while historical ghost breadcrumbs form a trailing track history showing target speed and heading!
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-sans">
          <span>AeroRadar IMU System Engine</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-medium transition-colors cursor-pointer"
          >
            Close Blueprint
          </button>
        </div>
      </div>
    </div>
  );
};
