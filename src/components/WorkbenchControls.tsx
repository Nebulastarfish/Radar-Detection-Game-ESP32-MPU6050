import React from 'react';
import { RotateCcw, Activity, Compass, Zap } from 'lucide-react';
import { TelemetryData } from '../game/oled/oledRenderer';
import { soundEngine } from '../audio/soundEngine';

interface WorkbenchControlsProps {
  telemetry: TelemetryData;
  pitch: number;
  roll: number;
  yaw: number;
  onPitchChange: (v: number) => void;
  onRollChange: (v: number) => void;
  onYawChange: (v: number) => void;
  onReset: () => void;
  onShock: () => void;
}

export const WorkbenchControls: React.FC<WorkbenchControlsProps> = ({
  telemetry,
  pitch,
  roll,
  yaw,
  onPitchChange,
  onRollChange,
  onYawChange,
  onReset,
  onShock,
}) => {
  return (
    <div className="absolute top-16 right-4 z-20 w-80 bg-slate-900/95 border border-slate-700/80 rounded-xl p-4 shadow-2xl text-slate-100 font-mono text-xs select-none">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
          <span className="font-bold font-hud text-sm text-emerald-400">HARDWARE BENCH LAB</span>
        </div>
        <button
          onClick={() => {
            soundEngine.playUiClick();
            onReset();
          }}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
          title="Reset to Level"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-[11px] text-slate-400 mb-3 leading-relaxed font-sans">
        Rotate and tilt the virtual ESP32 + MPU6050 board. Notice how the OLED display calculates gravity vectors and compass-stabilized targets in real time!
      </p>

      {/* Sliders */}
      <div className="space-y-3.5">
        <div>
          <div className="flex justify-between mb-1 text-[11px]">
            <span className="text-slate-300">Pitch Tilt (&theta; X-Axis)</span>
            <span className="text-emerald-400 font-bold">{Math.round(pitch)}&deg;</span>
          </div>
          <input
            type="range"
            min="-90"
            max="90"
            value={pitch}
            onChange={(e) => onPitchChange(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between mb-1 text-[11px]">
            <span className="text-slate-300">Roll Tilt (&phi; Y-Axis)</span>
            <span className="text-emerald-400 font-bold">{Math.round(roll)}&deg;</span>
          </div>
          <input
            type="range"
            min="-90"
            max="90"
            value={roll}
            onChange={(e) => onRollChange(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between mb-1 text-[11px]">
            <span className="text-slate-300">Yaw Gyro Heading (&psi; Z-Axis)</span>
            <span className="text-cyan-400 font-bold">{Math.round(yaw)}&deg;</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            value={yaw}
            onChange={(e) => onYawChange(parseFloat(e.target.value))}
            className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Quick Action Button */}
      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2">
        <button
          onClick={() => {
            soundEngine.playUiClick();
            onShock();
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 rounded font-semibold text-[11px] transition-colors"
        >
          <Zap className="w-3.5 h-3.5" />
          Test Impact Shock
        </button>
      </div>

      {/* Live Computed Proper Acceleration Readout */}
      <div className="mt-3 p-2.5 bg-slate-950/80 border border-slate-800/80 rounded space-y-1 text-[11px]">
        <div className="text-slate-400 font-bold text-[10px] tracking-wider uppercase">Live MPU6050 Acceleration:</div>
        <div className="flex justify-between text-slate-300">
          <span>Ax: <b className="text-white">{telemetry.ax.toFixed(2)}</b> m/s&sup2;</span>
          <span>Ay: <b className="text-white">{telemetry.ay.toFixed(2)}</b> m/s&sup2;</span>
          <span>Az: <b className="text-white">{telemetry.az.toFixed(2)}</b> m/s&sup2;</span>
        </div>
      </div>
    </div>
  );
};
