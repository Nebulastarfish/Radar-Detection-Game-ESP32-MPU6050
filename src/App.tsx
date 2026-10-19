import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ThreeSceneManager, GameState } from './game/threeScene';
import { TelemetryData } from './game/oled/oledRenderer';
import { TitleScreen } from './components/TitleScreen';
import { HudOverlay } from './components/HudOverlay';
import { CodeMatrixHud } from './components/CodeMatrixHud';
import { EngineeringModal } from './components/EngineeringModal';
import { PauseVictoryModal } from './components/PauseVictoryModal';
import { WorkbenchControls } from './components/WorkbenchControls';
import { soundEngine } from './audio/soundEngine';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<ThreeSceneManager | null>(null);

  // React state synced from the 60fps WebGL simulation
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    targetsScanned: 0,
    targetsDestroyed: 0,
    totalWaveTargets: 5,
    wave: 1,
    currentObjective: 'Wave 1: Neutralize or Scan Rogue Aerial Contacts via Radar Lock',
    lockProgress: 0,
    lockedTargetId: null,
    radarRangeMeters: 1000,
    cameraMode: 'chase',
    isPaused: false,
    gameStatus: 'title',
    playerHealth: 100,
    playerShield: 100,
    missileCount: 4,
    missileReloadProgress: 0,
    blasterHeat: 0,
    lastCombatAction: 'idle',
    codeMatrixOpacity: 0.35,
  });

  const [telemetry, setTelemetry] = useState<TelemetryData>({
    t: 0,
    ax: 0,
    ay: 0,
    az: 9.81,
    gx: 0,
    gy: 0,
    gz: 0,
    pitch: 0,
    roll: 0,
    yaw: 0,
    temp: 24.5,
    lockOn: false,
  });

  const [isBlueprintOpen, setIsBlueprintOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Workbench mode tilt slider states
  const [benchPitch, setBenchPitch] = useState(0);
  const [benchRoll, setBenchRoll] = useState(0);
  const [benchYaw, setBenchYaw] = useState(0);

  // Initialize Three.js scene once
  useEffect(() => {
    if (!canvasMountRef.current) return;

    const manager = new ThreeSceneManager(canvasMountRef.current);
    sceneManagerRef.current = manager;

    // Synced callback with throttle
    let lastHudUpdate = 0;
    manager.onStateUpdate = (state, telem) => {
      const now = performance.now();
      if (now - lastHudUpdate > 33) { // ~30 fps React state updates are plenty for readouts
        lastHudUpdate = now;
        setGameState({ ...state });
        setTelemetry({ ...telem });
      }
    };

    return () => {
      manager.destroy();
      sceneManagerRef.current = null;
    };
  }, []);

  // Keyboard shortcut for starting from Title screen with Space/Enter
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameState.gameStatus === 'title' && (e.code === 'Space' || e.code === 'Enter')) {
        handleStartGame();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState.gameStatus]);

  const handleStartGame = useCallback(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.startGame();
      sceneManagerRef.current.setCameraMode('chase');
    }
  }, []);

  const handleOpenHardwareLab = useCallback(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setCameraMode('hardware');
      setBenchPitch(0);
      setBenchRoll(0);
      setBenchYaw(0);
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  }, []);

  const handleSetCameraMode = useCallback((mode: GameState['cameraMode']) => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setCameraMode(mode);
    }
  }, []);

  const handleSetRadarRange = useCallback((range: number) => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.gameState.radarRangeMeters = range;
    }
  }, []);

  const handleTriggerRadarPing = useCallback(() => {
    soundEngine.playRadarPing(1100, 1.2);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.spawnRadarPingEcho(sceneManagerRef.current.imuEngine.position);
    }
  }, []);

  const handleFireBlaster = useCallback(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.triggerBlasterFire();
    }
  }, []);

  const handleFireMissile = useCallback(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.triggerMissileFire();
    }
  }, []);

  const handleCycleCodeMatrix = useCallback(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.cycleCodeMatrixOpacity();
    }
  }, []);

  // Workbench slider handlers
  const handleBenchPitchChange = useCallback((val: number) => {
    setBenchPitch(val);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.imuEngine.benchPitch = val;
    }
  }, []);

  const handleBenchRollChange = useCallback((val: number) => {
    setBenchRoll(val);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.imuEngine.benchRoll = val;
    }
  }, []);

  const handleBenchYawChange = useCallback((val: number) => {
    setBenchYaw(val);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.imuEngine.benchYaw = val;
    }
  }, []);

  const handleBenchReset = useCallback(() => {
    setBenchPitch(0);
    setBenchRoll(0);
    setBenchYaw(0);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.imuEngine.benchPitch = 0;
      sceneManagerRef.current.imuEngine.benchRoll = 0;
      sceneManagerRef.current.imuEngine.benchYaw = 0;
    }
  }, []);

  const handleBenchShock = useCallback(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.imuEngine.accelX += (Math.random() - 0.5) * 18.0;
      sceneManagerRef.current.imuEngine.accelY += (Math.random() - 0.5) * 18.0;
      sceneManagerRef.current.imuEngine.accelZ += 24.0;
      soundEngine.playLockOnAlert();
    }
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* 3D WebGL Canvas isolated mount */}
      <div ref={canvasMountRef} className="absolute inset-0 z-0" />

      {/* Live Translucent C++ Code Terminal Matrix in Cockpit HUD */}
      {gameState.gameStatus !== 'title' && (
        <CodeMatrixHud
          gameState={gameState}
          telemetry={telemetry}
          opacityLevel={gameState.codeMatrixOpacity}
          lastCombatAction={gameState.lastCombatAction}
        />
      )}

      {/* Title Screen */}
      {gameState.gameStatus === 'title' && (
        <TitleScreen
          onStartGame={handleStartGame}
          onOpenHardwareLab={handleOpenHardwareLab}
          onOpenBlueprint={() => setIsBlueprintOpen(true)}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* In-Game HUD (active during flight and combat) */}
      {gameState.gameStatus !== 'title' && (
        <HudOverlay
          gameState={gameState}
          telemetry={telemetry}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onSetCameraMode={handleSetCameraMode}
          onSetRadarRange={handleSetRadarRange}
          onOpenBlueprint={() => setIsBlueprintOpen(true)}
          onTriggerRadarPing={handleTriggerRadarPing}
          onFireBlaster={handleFireBlaster}
          onFireMissile={handleFireMissile}
          onCycleCodeMatrix={handleCycleCodeMatrix}
        />
      )}

      {/* Workbench Controls (active in 'hardware' camera mode) */}
      {gameState.cameraMode === 'hardware' && (
        <WorkbenchControls
          telemetry={telemetry}
          pitch={benchPitch}
          roll={benchRoll}
          yaw={benchYaw}
          onPitchChange={handleBenchPitchChange}
          onRollChange={handleBenchRollChange}
          onYawChange={handleBenchYawChange}
          onReset={handleBenchReset}
          onShock={handleBenchShock}
        />
      )}

      {/* Pause & Victory / Game Over Modals */}
      <PauseVictoryModal
        gameState={gameState}
        telemetry={telemetry}
        onResume={() => {
          if (sceneManagerRef.current) {
            sceneManagerRef.current.togglePause();
          }
        }}
        onRestart={handleStartGame}
        onOpenBlueprint={() => setIsBlueprintOpen(true)}
        onInspectHardware={handleOpenHardwareLab}
      />

      {/* Arduino & Wokwi Engineering Blueprint Modal */}
      <EngineeringModal
        isOpen={isBlueprintOpen}
        onClose={() => setIsBlueprintOpen(false)}
      />
    </div>
  );
}
