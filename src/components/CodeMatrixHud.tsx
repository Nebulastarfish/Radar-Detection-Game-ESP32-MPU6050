import React, { useEffect, useState, useMemo } from 'react';
import { GameState } from '../game/threeScene';
import { TelemetryData } from '../game/oled/oledRenderer';

interface CodeMatrixHudProps {
  gameState: GameState;
  telemetry: TelemetryData;
  opacityLevel: number; // 0, 0.2, 0.45, 0.75
  lastCombatAction: string; // 'blaster' | 'missile' | 'lock' | 'hit' | 'idle'
}

export const CodeMatrixHud: React.FC<CodeMatrixHudProps> = ({
  gameState,
  telemetry,
  opacityLevel,
  lastCombatAction,
}) => {
  const [frameCounter, setFrameCounter] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameCounter((prev) => (prev + 1) % 10000);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  if (opacityLevel <= 0) return null;

  // Format real-time reactive C++ code stream
  const activeCodeLines = useMemo(() => {
    const t = telemetry.t.toFixed(2);
    const ax = telemetry.ax.toFixed(2);
    const ay = telemetry.ay.toFixed(2);
    const az = telemetry.az.toFixed(2);
    const pit = Math.round(telemetry.pitch);
    const rol = Math.round(telemetry.roll);
    const yaw = Math.round(telemetry.yaw);

    const lines = [
      `// ESP32-WROOM-32 IMU RADAR FIRMWARE (REV 4.2)`,
      `#include <Wire.h>`,
      `#include <Adafruit_SSD1306.h>`,
      `#include <Adafruit_MPU6050.h>`,
      ``,
      `void loop() {`,
      `  unsigned long t_now = ${t}s; float dt = 0.016s;`,
      `  // 1. Read proper body acceleration [MPU6050_ACCEL_XOUT]`,
      `  accel.x = ${ax >= '0' ? '+' : ''}${ax}; accel.y = ${ay >= '0' ? '+' : ''}${ay}; accel.z = ${az >= '0' ? '+' : ''}${az}; // m/s^2`,
      `  // 2. Compute Earth Gravity Vectors`,
      `  pitch = atan2(${ay}, ${az}) * 57.29578; // -> ${pit}°`,
      `  roll  = atan2(-${ax}, sqrt(${ay}^2 + ${az}^2)) * 57.29578; // -> ${rol}°`,
      `  // 3. Integrate Gyroscope Z-rate for Heading`,
      `  yaw += (${(telemetry.gz * 57.3).toFixed(1)}) * dt; // -> ${yaw}°`,
      ``,
      `  // 4. Tactical Radar Scan Matrix (128x64 OLED)`,
      `  sweep_angle = fmod(sweep_angle + 240.0 * dt, 360.0);`,
      `  for (int i=0; i<NUM_CONTACTS; i++) {`,
      `    float rel_bearing = fmod(target[i].earth_bearing - ${yaw} + 360, 360);`,
      `    if (abs(sweep_angle - rel_bearing) < 12.0) {`,
      `      target_phosphor[i] = 1.0; // P7 PEAK EXCITATION`,
      `      display.fillCircle(tgt_x, tgt_y, 3, WHITE);`,
      `    }`,
      `  }`,
    ];

    if (lastCombatAction === 'missile') {
      lines.push(
        `  // >>> INTERRUPT: MISSILE_LAUNCH_GUIDANCE_ACTIVE <<<`,
        `  seeker.proportional_nav(lock_tgt_id="${gameState.lockedTargetId || 'AUTO'}", gain=3.5);`
      );
    } else if (lastCombatAction === 'blaster') {
      lines.push(
        `  // >>> HARDPOINT_PULSE_PLASMA_DISCHARGE <<<`,
        `  digitalWrite(GPIO_PLASMA_PIN, HIGH); bolt_speed = 240.0;`
      );
    } else if (lastCombatAction === 'lock') {
      lines.push(
        `  // [!] RADAR_LOCK_ACQUIRED: BEARING_MATCH_VERIFIED`,
        `  radar_lock_progress = ${gameState.lockProgress}%; lock_target="${gameState.lockedTargetId}";`
      );
    }

    return lines;
  }, [telemetry, gameState, lastCombatAction, frameCounter]);

  return (
    <div
      className="absolute inset-y-0 left-4 sm:left-8 w-72 sm:w-96 pointer-events-none select-none z-10 flex flex-col justify-center font-mono text-[9px] sm:text-[10px] leading-relaxed transition-opacity duration-300"
      style={{ opacity: opacityLevel }}
    >
      <div className="bg-slate-950/70 border border-emerald-500/20 rounded-lg p-3 backdrop-blur-[0px] shadow-2xl overflow-hidden text-emerald-400">
        <div className="flex items-center justify-between pb-1 mb-2 border-b border-emerald-500/30 text-[9px] text-emerald-500/80">
          <span>// C++ KINEMATIC FIRMWARE BACKDROP</span>
          <span className="tabular-nums">CYCLE: #{frameCounter}</span>
        </div>

        <div className="space-y-0.5">
          {activeCodeLines.map((line, idx) => {
            const isHighlight =
              line.includes('INTERRUPT') ||
              line.includes('P7 PEAK') ||
              line.includes('RADAR_LOCK_ACQUIRED') ||
              line.includes('HARDPOINT');
            const isComment = line.trim().startsWith('//');

            return (
              <div
                key={idx}
                className={`truncate ${
                  isHighlight
                    ? 'text-cyan-300 font-bold bg-cyan-950/40 px-1 rounded'
                    : isComment
                    ? 'text-emerald-600/80'
                    : 'text-emerald-400/90'
                }`}
              >
                {line}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
