import React from 'react';
import { Play, Cpu, Volume2, VolumeX, ShieldAlert, Crosshair } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

interface TitleScreenProps {
  onStartGame: () => void;
  onOpenHardwareLab: () => void;
  onOpenBlueprint: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  onOpenHardwareLab,
  onOpenBlueprint,
  isMuted,
  onToggleMute,
}) => {
  return (
    <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-6 sm:p-10 select-none">
      {/* Top Bar */}
      <div className="flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 border border-slate-700/60 rounded text-xs text-slate-300">
          <ShieldAlert className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-white tracking-wide">TACTICAL INTERCEPTOR COMBAT</span>
          <span className="text-slate-500">|</span>
          <span className="text-emerald-400 font-mono">ESP32 + MPU6050 + SSD1306</span>
        </div>

        <button
          onClick={onToggleMute}
          className="p-2.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
          title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
        </button>
      </div>

      {/* Center Hero Lockup over 35% negative space */}
      <div className="my-auto max-w-2xl pointer-events-auto">
        {/* Bespoke inline SVG Title Lockup */}
        <div className="mb-4">
          <svg className="w-full max-w-xl h-24 sm:h-28" viewBox="0 0 540 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Radar concentric sweep graphic */}
            <circle cx="48" cy="50" r="38" stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.4" />
            <circle cx="48" cy="50" r="24" stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.6" />
            <circle cx="48" cy="50" r="10" stroke="#10b981" strokeWidth="1.5" />
            <line x1="10" y1="50" x2="86" y2="50" stroke="#10b981" strokeWidth="1" strokeOpacity="0.5" />
            <line x1="48" y1="12" x2="48" y2="88" stroke="#10b981" strokeWidth="1" strokeOpacity="0.5" />
            <line x1="48" y1="50" x2="74" y2="24" stroke="#34d399" strokeWidth="2" />
            <circle cx="68" cy="30" r="3" fill="#ffffff" />

            {/* Title Text */}
            <text x="105" y="46" fill="#f8fafc" fontSize="38" fontFamily="Chakra Petch, sans-serif" fontWeight="700" letterSpacing="3">
              AERORADAR 3D
            </text>
            <text x="106" y="74" fill="#34d399" fontSize="13" fontFamily="JetBrains Mono, monospace" fontWeight="600" letterSpacing="4">
              TACTICAL DOGFIGHT & CODE MATRIX
            </text>
          </svg>
        </div>

        <p className="text-sm sm:text-base text-slate-300 mb-8 max-w-lg leading-relaxed font-sans">
          Dogfight rogue drones in high-altitude 3D combat. Arm <b>Guided Radar Missiles</b> and <b>Twin Pulse Blasters</b>, guided by live <b>Earth-axis MPU6050 physics</b> and an active <b>translucent C++ code terminal matrix</b> in the cockpit backdrop.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => {
              soundEngine.playUiClick();
              onStartGame();
            }}
            className="flex items-center gap-2.5 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-hud text-sm sm:text-base rounded shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-slate-950" />
            START DOGFIGHT MISSION (SPACE / ENTER)
          </button>

          <button
            onClick={() => {
              soundEngine.playUiClick();
              onOpenHardwareLab();
            }}
            className="flex items-center gap-2 px-5 py-3.5 bg-slate-900/90 hover:bg-slate-800 text-slate-100 font-semibold font-hud text-xs sm:text-sm border border-slate-700/80 rounded transition-colors cursor-pointer"
          >
            <Cpu className="w-4 h-4 text-cyan-400" />
            INSPECT HARDWARE TWIN
          </button>

          <button
            onClick={() => {
              soundEngine.playUiClick();
              onOpenBlueprint();
            }}
            className="flex items-center gap-2 px-5 py-3.5 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold font-hud text-xs sm:text-sm border border-slate-700/80 rounded transition-colors cursor-pointer"
          >
            ARDUINO CODE & WOKWI WIRING
          </button>
        </div>
      </div>

      {/* Flat Single-Line Control Hint */}
      <div className="pointer-events-auto flex items-center justify-between border-t border-slate-800/80 pt-4 text-[11px] sm:text-xs text-slate-400 font-mono">
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-bold">CONTROLS:</span>
          <span>WASD Flight · Left Click/F Blasters · Right Click/Space Guided Missile · Shift Boost · Q/E Yaw · T Code Matrix · C Camera</span>
        </div>
        <div className="hidden sm:block text-slate-500">
          60 FPS Simulation Engine
        </div>
      </div>
    </div>
  );
};
