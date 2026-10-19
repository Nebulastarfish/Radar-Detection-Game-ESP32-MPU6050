import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Radio,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Shield,
  Heart,
  Zap,
  Rocket,
  Code2,
} from 'lucide-react';
import { GameState } from '../game/threeScene';
import { TelemetryData } from '../game/oled/oledRenderer';
import { soundEngine } from '../audio/soundEngine';

interface HudOverlayProps {
  gameState: GameState;
  telemetry: TelemetryData;
  isMuted: boolean;
  onToggleMute: () => void;
  onSetCameraMode: (mode: GameState['cameraMode']) => void;
  onSetRadarRange: (range: number) => void;
  onOpenBlueprint: () => void;
  onTriggerRadarPing: () => void;
  onFireBlaster: () => void;
  onFireMissile: () => void;
  onCycleCodeMatrix: () => void;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  gameState,
  telemetry,
  isMuted,
  onToggleMute,
  onSetCameraMode,
  onSetRadarRange,
  onOpenBlueprint,
  onTriggerRadarPing,
  onFireBlaster,
  onFireMissile,
  onCycleCodeMatrix,
}) => {
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);

  const shieldPercent = Math.max(0, Math.min(100, gameState.playerShield));
  const healthPercent = Math.max(0, Math.min(100, gameState.playerHealth));
  const isLocked = gameState.lockProgress >= 100;

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden z-20 flex flex-col justify-between p-4 sm:p-6 font-mono text-slate-100">
      {/* ========================================================== */}
      {/* TOP PERIMETER: TELEMETRY & TARGET RETICLE & COMBAT STATS */}
      {/* ========================================================== */}
      <div className="flex items-start justify-between w-full">
        {/* Top-Left: Live Earth-Axis Telemetry Cluster */}
        <div className="pointer-events-auto bg-slate-900/90 border border-slate-700/80 rounded-lg p-3 w-56 text-xs shadow-xl">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px] text-slate-400">
            <span className="font-bold text-emerald-400 font-hud tracking-wider">MPU6050 TELEMETRY</span>
            <span className="tabular-nums text-slate-300">t: {telemetry.t.toFixed(1)}s</span>
          </div>

          <div className="grid grid-cols-3 gap-1 mb-2 text-center text-[11px]">
            <div className="bg-slate-950/80 p-1 rounded border border-slate-800/80">
              <div className="text-[9px] text-slate-500 font-bold">X (SURGE)</div>
              <div className="text-emerald-400 font-bold tabular-nums">{telemetry.ax.toFixed(1)}</div>
            </div>
            <div className="bg-slate-950/80 p-1 rounded border border-slate-800/80">
              <div className="text-[9px] text-slate-500 font-bold">Y (SWAY)</div>
              <div className="text-emerald-400 font-bold tabular-nums">{telemetry.ay.toFixed(1)}</div>
            </div>
            <div className="bg-slate-950/80 p-1 rounded border border-slate-800/80">
              <div className="text-[9px] text-slate-500 font-bold">Z (GRAV)</div>
              <div className="text-emerald-400 font-bold tabular-nums">{telemetry.az.toFixed(1)}</div>
            </div>
          </div>

          <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-800/60 text-slate-300">
            <div>Pit: <b className="text-white tabular-nums">{Math.round(telemetry.pitch)}&deg;</b></div>
            <div>Rol: <b className="text-white tabular-nums">{Math.round(telemetry.roll)}&deg;</b></div>
            <div>Yaw: <b className="text-cyan-400 tabular-nums">{Math.round(telemetry.yaw)}&deg;</b></div>
          </div>
        </div>

        {/* Top-Center: Tactical Lock-On Reticle */}
        <div className="flex flex-col items-center">
          {gameState.lockedTargetId ? (
            <div
              className={`bg-slate-900/95 border rounded-lg px-4 py-2 shadow-2xl flex flex-col items-center gap-1.5 ${
                isLocked ? 'border-red-500 shadow-red-500/20' : 'border-amber-500 shadow-amber-500/10'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-bold font-hud tracking-wider">
                <Crosshair className={`w-4 h-4 ${isLocked ? 'text-red-400 animate-pulse' : 'text-amber-400'}`} />
                <span className={isLocked ? 'text-red-400' : 'text-amber-400'}>
                  {isLocked ? `RADAR LOCK ACQUIRED: ${gameState.lockedTargetId}` : `TRACKING: ${gameState.lockedTargetId}`}
                </span>
              </div>
              <div className="w-48 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-700">
                <div
                  className={`h-full transition-all duration-75 ${isLocked ? 'bg-red-500' : 'bg-amber-400'}`}
                  style={{ width: `${gameState.lockProgress}%` }}
                ></div>
              </div>
              <div className="text-[10px] text-slate-300">
                {isLocked ? (
                  <span className="text-red-300 font-bold">FIRE MISSILE (RIGHT CLICK / SPACE)</span>
                ) : (
                  <span>HOLD CONE ON TARGET TO LOCK ({gameState.lockProgress}%)</span>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/80 border border-slate-700/60 rounded px-3.5 py-1.5 text-xs text-slate-300 flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span>RADAR SCANNING // WAVE {gameState.wave}</span>
            </div>
          )}
        </div>

        {/* Top-Right: Objective & Vitals Cluster */}
        <div className="pointer-events-auto flex items-start gap-2">
          {/* Ship Vitals: Shield & Hull */}
          <div className="bg-slate-900/90 border border-slate-700/80 rounded-lg p-2.5 w-44 text-xs shadow-xl space-y-2">
            <div>
              <div className="flex items-center justify-between text-[10px] text-cyan-300 mb-0.5">
                <span className="flex items-center gap-1 font-bold">
                  <Shield className="w-3 h-3" /> SHIELD
                </span>
                <span className="tabular-nums font-bold">{Math.round(shieldPercent)}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-cyan-500/30">
                <div
                  className="h-full bg-cyan-400 transition-all duration-150"
                  style={{ width: `${shieldPercent}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] text-emerald-300 mb-0.5">
                <span className="flex items-center gap-1 font-bold">
                  <Heart className="w-3 h-3" /> HULL
                </span>
                <span className="tabular-nums font-bold">{Math.round(healthPercent)}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-emerald-500/30">
                <div
                  className={`h-full transition-all duration-150 ${
                    healthPercent < 30 ? 'bg-red-500 animate-pulse' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${healthPercent}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Score & Objectives */}
          <div className="bg-slate-900/90 border border-slate-700/80 rounded-lg px-3 py-2 text-xs shadow-xl flex items-center gap-3">
            <div>
              <div className="text-[9px] text-slate-400 font-bold">SCORE</div>
              <div className="text-white font-bold tabular-nums font-hud text-sm">
                {gameState.score}
              </div>
            </div>
            <div className="border-l border-slate-800 pl-2.5">
              <div className="text-[9px] text-slate-400 font-bold">DESTROYED</div>
              <div className="text-red-400 font-bold tabular-nums">
                {gameState.targetsDestroyed}
              </div>
            </div>
          </div>

          <button
            onClick={onToggleMute}
            className="p-2.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-slate-300 hover:text-white transition-colors"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* ========================================================== */}
      {/* COCKPIT HUD RETICLE (Active in Cockpit camera mode) */}
      {/* ========================================================== */}
      {gameState.cameraMode === 'cockpit' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-80 h-80 border border-emerald-500/20 rounded-full flex items-center justify-center">
            {/* Crosshair lines */}
            <div className="w-20 h-0.5 bg-emerald-400/60"></div>
            <div className="h-20 w-0.5 bg-emerald-400/60 absolute"></div>
            {/* Center dot */}
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute"></div>

            {/* Artificial Horizon */}
            <div
              className="absolute w-48 h-0.5 bg-emerald-400/40"
              style={{
                transform: `rotate(${-telemetry.roll}deg) translateY(${telemetry.pitch * 1.5}px)`,
              }}
            ></div>

            {/* Dynamic Target Lead Indicator */}
            {isLocked && (
              <div className="absolute w-12 h-12 border-2 border-red-500 rounded-sm animate-ping opacity-60"></div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* BOTTOM CENTER: WEAPONS TACTICAL DOCK & CONTROLS */}
      {/* ========================================================== */}
      <div className="pointer-events-auto self-center flex flex-col items-center">
        {/* Collapse / Expand Toggle Button */}
        <button
          onClick={() => {
            soundEngine.playUiClick();
            setIsDockCollapsed(!isDockCollapsed);
          }}
          className="px-3 py-1 bg-slate-900/90 hover:bg-slate-800 border-t border-x border-slate-700/80 rounded-t-lg text-[10px] text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          {isDockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{isDockCollapsed ? 'Show Combat Dock (H)' : 'Hide Dock (H)'}</span>
        </button>

        {/* Horizontal Control Dock */}
        {!isDockCollapsed && (
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-4 py-2 bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl max-w-full text-xs">
            {/* Weapon 1: Pulse Blaster */}
            <button
              onClick={onFireBlaster}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/80 border border-cyan-500/30 hover:border-cyan-400 rounded-lg text-cyan-300 transition-colors cursor-pointer"
              title="Fire Twin Plasma Blasters (Left Click / F)"
            >
              <Zap className="w-4 h-4 text-cyan-400" />
              <div className="text-left">
                <div className="text-[9px] text-slate-400">BLASTER (F)</div>
                <div className="text-[11px] font-bold text-white">READY</div>
              </div>
            </button>

            {/* Weapon 2: Guided Seeker Missiles */}
            <button
              onClick={onFireMissile}
              disabled={gameState.missileCount <= 0}
              className={`flex items-center gap-2 px-3 py-1.5 bg-slate-950/80 border rounded-lg transition-colors cursor-pointer ${
                gameState.missileCount > 0
                  ? 'border-amber-500/40 hover:border-amber-400 text-amber-300'
                  : 'border-slate-800 opacity-50 cursor-not-allowed text-slate-500'
              }`}
              title="Launch Guided Radar Missile (Right Click / Space)"
            >
              <Rocket className="w-4 h-4 text-amber-400" />
              <div className="text-left">
                <div className="text-[9px] text-slate-400">MISSILE (SPACE)</div>
                <div className="text-[11px] font-bold text-white flex items-center gap-1">
                  <span>{gameState.missileCount}/4</span>
                  {gameState.missileCount < 4 && (
                    <span className="text-[9px] text-amber-400">({gameState.missileReloadProgress}%)</span>
                  )}
                </div>
              </div>
            </button>

            {/* Code Matrix Opacity Toggle (T) */}
            <button
              onClick={onCycleCodeMatrix}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold rounded-lg border border-emerald-500/30 transition-colors cursor-pointer"
              title="Toggle Live Translucent C++ Code Terminal Matrix (T)"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Code Matrix ({Math.round(gameState.codeMatrixOpacity * 100)}%)</span>
            </button>

            {/* Camera View Mode Pills */}
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800/80">
              <button
                onClick={() => onSetCameraMode('chase')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                  gameState.cameraMode === 'chase' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                Chase 3D
              </button>
              <button
                onClick={() => onSetCameraMode('cockpit')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                  gameState.cameraMode === 'cockpit' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                Cockpit HUD
              </button>
              <button
                onClick={() => onSetCameraMode('hardware')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                  gameState.cameraMode === 'hardware' ? 'bg-cyan-500 text-slate-950' : 'text-cyan-300 hover:text-white'
                }`}
              >
                ESP32 Twin
              </button>
            </div>

            {/* Radar Range Selector */}
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800/80">
              {[500, 1000].map((rng) => (
                <button
                  key={rng}
                  onClick={() => {
                    soundEngine.playUiClick();
                    onSetRadarRange(rng);
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                    gameState.radarRangeMeters === rng
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {rng}m
                </button>
              ))}
            </div>

            {/* Engineering Modal Trigger */}
            <button
              onClick={() => {
                soundEngine.playUiClick();
                onOpenBlueprint();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow transition-colors cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Arduino Code</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
