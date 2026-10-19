import React from 'react';
import { Play, RotateCcw, Award, BookOpen, Cpu, Skull } from 'lucide-react';
import { GameState } from '../game/threeScene';
import { TelemetryData } from '../game/oled/oledRenderer';
import { soundEngine } from '../audio/soundEngine';

interface PauseVictoryModalProps {
  gameState: GameState;
  telemetry: TelemetryData;
  onResume: () => void;
  onRestart: () => void;
  onOpenBlueprint: () => void;
  onInspectHardware: () => void;
}

export const PauseVictoryModal: React.FC<PauseVictoryModalProps> = ({
  gameState,
  telemetry,
  onResume,
  onRestart,
  onOpenBlueprint,
  onInspectHardware,
}) => {
  if (!gameState.isPaused && gameState.gameStatus !== 'victory' && gameState.gameStatus !== 'gameover') {
    return null;
  }

  const isVictory = gameState.gameStatus === 'victory';
  const isGameOver = gameState.gameStatus === 'gameover';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/85 select-none">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-xl p-6 shadow-2xl text-slate-100 flex flex-col items-center text-center">
        {isVictory ? (
          <>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 mb-3">
              <Award className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold font-hud text-emerald-400 mb-1">
              MISSION ACCOMPLISHED!
            </h2>
            <p className="text-xs text-slate-300 mb-5 font-sans">
              All rogue aerial threats intercepted, scanned, and neutralized across all sectors!
            </p>
          </>
        ) : isGameOver ? (
          <>
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-full text-red-400 mb-3">
              <Skull className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold font-hud text-red-400 mb-1">
              HULL BREACH - AIRCRAFT DESTROYED
            </h2>
            <p className="text-xs text-slate-300 mb-5 font-sans">
              Enemy fire overwhelmed deflector shields and breached tactical fuselage.
            </p>
          </>
        ) : (
          <>
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-400 mb-3">
              <Cpu className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold font-hud text-white mb-1">
              SIMULATION PAUSED
            </h2>
            <p className="text-xs text-slate-400 mb-5 font-sans">
              Earth-axis inertial telemetry and radar tracking currently frozen.
            </p>
          </>
        )}

        {/* Telemetry Stats Card */}
        <div className="w-full bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 mb-5 font-mono text-xs text-left space-y-1.5">
          <div className="flex justify-between text-slate-400">
            <span>Mission Time (t):</span>
            <b className="text-white">{telemetry.t.toFixed(1)}s</b>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Final Score:</span>
            <b className="text-emerald-400 font-hud">{gameState.score}</b>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Targets Destroyed:</span>
            <b className="text-red-400">{gameState.targetsDestroyed}</b>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Targets Scanned:</span>
            <b className="text-cyan-400">{gameState.targetsScanned}</b>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Last Heading (Yaw):</span>
            <b className="text-white">{Math.round(telemetry.yaw)}&deg;</b>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-2.5">
          {!isVictory && !isGameOver && (
            <button
              onClick={() => {
                soundEngine.playUiClick();
                onResume();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-hud text-sm rounded shadow transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              RESUME SIMULATION (ESC)
            </button>
          )}

          <button
            onClick={() => {
              soundEngine.playUiClick();
              onRestart();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold font-hud text-xs rounded border border-slate-700 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            {isVictory ? 'PLAY AGAIN' : isGameOver ? 'RETRY MISSION' : 'RESTART FLIGHT'}
          </button>

          <button
            onClick={() => {
              soundEngine.playUiClick();
              onInspectHardware();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold font-hud text-xs rounded border border-cyan-500/30 transition-colors cursor-pointer"
          >
            <Cpu className="w-4 h-4" />
            INSPECT ESP32 + MPU6050 HARDWARE TWIN
          </button>

          <button
            onClick={() => {
              soundEngine.playUiClick();
              onOpenBlueprint();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold font-hud text-xs rounded border border-slate-700 transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            VIEW ARDUINO & WOKWI BLUEPRINT
          </button>
        </div>
      </div>
    </div>
  );
};
