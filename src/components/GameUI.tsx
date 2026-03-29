'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { GameEngine, GameState } from '../game/core/GameEngine';
import { WeaponInstance } from '../game/weapons/WeaponSystem';
import { GRENADES } from '../game/weapons/GrenadeSystem';

const RARITY_COLORS: Record<string, string> = {
  common: 'text-gray-300 border-gray-500',
  uncommon: 'text-green-300 border-green-500',
  rare: 'text-blue-300 border-blue-500',
  epic: 'text-purple-300 border-purple-500',
};

const RARITY_BG: Record<string, string> = {
  common: 'bg-gray-700/60',
  uncommon: 'bg-green-900/40',
  rare: 'bg-blue-900/40',
  epic: 'bg-purple-900/40',
};

export default function GameUI() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastUIUpdate = useRef(0);

  // Refs for per-frame data (no render trigger)
  const gameDataRef = useRef({
    health: 100,
    armor: 0,
    weapon: null as WeaponInstance | null,
    weapons: [null, null] as (WeaponInstance | null)[],
    activeSlot: 0,
    zoneInfo: { phase: 1, timer: 60, isShrinking: false, damage: 1 },
    killFeed: [] as { killer: string; victim: string; weapon: string; time: number }[],
    grenadeType: 'frag',
    grenadeCount: {} as Record<string, number>,
    inVehicle: false,
    nearbyItem: null as string | null,
    nearbyVehicle: false,
    flashAlpha: 0,
    gameState: { phase: 'lobby', playersAlive: 40, kills: 0, gameTime: 0, currentWave: 1, totalKills: 0, killStreak: 0, bestKillStreak: 0 } as GameState,
  });

  // Single state tick for low-frequency UI updates
  const [uiTick, setUiTick] = useState(0);

  // Event-driven states
  const [gameState, setGameState] = useState<GameState>(gameDataRef.current.gameState);
  const [isMobile, setIsMobile] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [muted, setMuted] = useState(false);

  // Kill streak notification
  const [streakLabel, setStreakLabel] = useState<string | null>(null);
  const streakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStreakLabelRef = useRef<string | null>(null);
  const lastStreakValueRef = useRef(0);

  // Edge flash states for kill / wave start
  const [killFlashActive, setKillFlashActive] = useState(false);
  const [waveFlashActive, setWaveFlashActive] = useState(false);
  const lastKillsRef = useRef(0);
  const lastPhaseRef = useRef<GameState['phase']>('lobby');

  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const engine = new GameEngine(containerRef.current);
    engineRef.current = engine;

    engine.onStateChange = (s) => {
      setGameState({ ...s });
      gameDataRef.current.gameState = { ...s };

      // Wave start flash
      if (s.phase === 'playing' && lastPhaseRef.current === 'wave_transition') {
        setWaveFlashActive(true);
        setTimeout(() => setWaveFlashActive(false), 400);
      }
      lastPhaseRef.current = s.phase;
    };

    const handleKey = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      if (e.code === 'Space' && engine.gameState.phase === 'plane') engine.drop();
      else if (e.code === 'Space' && engine.gameState.phase === 'dropping') engine.openParachute();
      if (e.code === 'Tab') { e.preventDefault(); setShowInventory(v => !v); }
      if (e.code === 'KeyM') {
        engine.soundManager.toggleMute();
        setMuted(engine.soundManager.isMuted());
      }
    };
    document.addEventListener('keydown', handleKey);

    engine.init().then(() => {
      const loop = () => {
        engine.update();

        // Per-frame ref updates (no render trigger)
        const d = gameDataRef.current;
        d.health = engine.player.state.health;
        d.armor = engine.player.state.armor;
        d.weapon = engine.weaponSystem.getActiveWeapon();
        d.weapons = [...engine.weaponSystem.weapons];
        d.activeSlot = engine.weaponSystem.activeSlot;
        d.zoneInfo = engine.zoneSystem.getPhaseInfo();
        d.killFeed = engine.botSystem.killFeed.slice(-5);
        d.grenadeType = engine.grenadeSystem.selectedGrenade;
        d.grenadeCount = { ...engine.grenadeSystem.inventory };
        d.inVehicle = engine.vehicleSystem.isPlayerInVehicle();
        d.flashAlpha = Math.max(0, engine.flashTimer);
        d.gameState = { ...engine.gameState };

        // Kill flash detection
        const newKills = engine.player.state.kills;
        if (newKills > lastKillsRef.current) {
          setKillFlashActive(true);
          setTimeout(() => setKillFlashActive(false), 100);
          lastKillsRef.current = newKills;
        }

        // Kill streak label detection
        const streak = engine.scoreboardSystem.stats.currentKillStreak;
        if (streak !== lastStreakValueRef.current) {
          lastStreakValueRef.current = streak;
          const label = engine.scoreboardSystem.getKillStreakLabel(streak);
          if (label && label !== lastStreakLabelRef.current) {
            lastStreakLabelRef.current = label;
            setStreakLabel(label);
            if (streakTimerRef.current) clearTimeout(streakTimerRef.current);
            streakTimerRef.current = setTimeout(() => {
              setStreakLabel(null);
              lastStreakLabelRef.current = null;
            }, 2500);
          }
        }

        // Nearby items/vehicles check
        const pp = engine.player.state.position;
        let item: string | null = null;
        for (const i of engine.weaponSystem.items) {
          if (i.collected || i.position.distanceTo(pp) > 3) continue;
          if (i.type === 'weapon' && i.weaponId) item = `Pick up ${i.weaponId.toUpperCase()}`;
          else if (i.type === 'health') item = 'Pick up Health Pack';
          else if (i.type === 'ammo') item = 'Pick up Ammo';
          break;
        }
        d.nearbyItem = item;

        let vNear = false;
        for (const v of engine.vehicleSystem.vehicles) {
          if (!v.isOccupied && v.health > 0 && v.position.distanceTo(pp) < 4) { vNear = true; break; }
        }
        d.nearbyVehicle = vNear;

        // 10fps UI update: single setState
        const now = performance.now();
        if (now - lastUIUpdate.current > 100) {
          lastUIUpdate.current = now;
          setUiTick(t => t + 1);
        }

        animFrameRef.current = requestAnimationFrame(loop);
      };
      animFrameRef.current = requestAnimationFrame(loop);
    });

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      document.removeEventListener('keydown', handleKey);
      if (streakTimerRef.current) clearTimeout(streakTimerRef.current);
      engine.destroy();
    };
  }, []);

  // Snapshot from ref for rendering (updated at 10fps)
  const d = gameDataRef.current;
  const { health, armor, weapon, weapons, activeSlot, zoneInfo, killFeed, grenadeType, grenadeCount, inVehicle, nearbyItem, nearbyVehicle, flashAlpha } = d;

  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  // Wave transition data
  // waveInfo available via engineRef.current?.waveManager.getWaveInfo(gameState.playersAlive)
  const stats = engineRef.current?.scoreboardSystem.stats;
  const rank = engineRef.current?.scoreboardSystem.getRank(gameState.currentWave, gameState.totalKills) ?? 'ROOKIE';
  const leaderboard = engineRef.current?.scoreboardSystem.getLeaderboard() ?? [];
  const bestLeaderboardEntry = leaderboard.length > 0 ? leaderboard[0] : null;

  // Suppress unused variable warning for uiTick (it drives re-renders)
  void uiTick;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black select-none touch-none">
      <div ref={containerRef} className="w-full h-full" />

      {/* SOUND TOGGLE */}
      <button
        onClick={() => {
          engineRef.current?.soundManager.toggleMute();
          setMuted(m => !m);
        }}
        className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded flex items-center justify-center text-xs text-white border border-gray-600 hover:bg-black/80 z-10"
      >
        {muted ? 'OFF' : 'SND'}
      </button>

      {/* CROSSHAIR */}
      {gameState.phase === 'playing' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-8 h-8">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-2.5 bg-white/70" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-2.5 bg-white/70" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-0.5 bg-white/70" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-0.5 bg-white/70" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-red-500/50" />
          </div>
        </div>
      )}

      {/* TOP HUD */}
      {['playing', 'dropping', 'plane'].includes(gameState.phase) && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-4">
          <div className="bg-black/70 px-4 py-1.5 rounded flex items-center gap-4 text-xs font-mono">
            {/* Wave indicator */}
            {gameState.phase === 'playing' && (
              <>
                <div className="text-center">
                  <div className="text-cyan-400 text-base font-bold animate-pulse">
                    W{gameState.currentWave}
                  </div>
                  <div className="text-gray-400 text-[9px]">WAVE</div>
                </div>
                <div className="w-px h-6 bg-gray-600" />
              </>
            )}
            <div className="text-center">
              <div className="text-white text-base font-bold">{gameState.playersAlive}</div>
              <div className="text-gray-400 text-[9px]">ALIVE</div>
            </div>
            <div className="w-px h-6 bg-gray-600" />
            <div className="text-center">
              <div className="text-yellow-400 text-base font-bold">{gameState.kills}</div>
              <div className="text-gray-400 text-[9px]">KILLS</div>
            </div>
            <div className="w-px h-6 bg-gray-600" />
            <div className="text-center">
              <div className={`text-base font-bold ${zoneInfo.isShrinking ? 'text-red-400 animate-pulse' : 'text-blue-400'}`}>
                {fmt(zoneInfo.timer)}
              </div>
              <div className="text-gray-400 text-[9px]">ZONE {zoneInfo.phase}</div>
            </div>
          </div>
        </div>
      )}

      {/* KILL FEED */}
      {killFeed.length > 0 && (
        <div className="absolute top-12 right-10 flex flex-col gap-0.5">
          {killFeed.map((k, i) => (
            <div key={`${k.time}_${i}`} className="bg-black/60 px-2 py-0.5 rounded text-[10px] font-mono flex gap-1">
              <span className={k.killer === 'You' ? 'text-yellow-400' : 'text-white'}>{k.killer}</span>
              <span className="text-gray-500">[{k.weapon}]</span>
              <span className={k.victim === 'You' ? 'text-red-400' : 'text-gray-300'}>{k.victim}</span>
            </div>
          ))}
        </div>
      )}

      {/* BOTTOM LEFT - HP + ARMOR */}
      {['playing', 'dead'].includes(gameState.phase) && (
        <div className="absolute bottom-20 left-3 md:bottom-4 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-white text-[10px] font-mono w-5">HP</span>
            <div className="w-32 md:w-44 h-3 bg-black/60 border border-gray-600 rounded-sm overflow-hidden">
              <div className="h-full transition-all duration-200" style={{
                width: `${health}%`,
                backgroundColor: health > 60 ? '#22c55e' : health > 30 ? '#eab308' : '#ef4444',
              }} />
            </div>
            <span className="text-white text-[10px] font-mono w-6">{Math.ceil(health)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-blue-300 text-[10px] font-mono w-5">AR</span>
            <div className="w-32 md:w-44 h-2.5 bg-black/60 border border-gray-600 rounded-sm overflow-hidden">
              <div className="h-full bg-blue-500 transition-all duration-200" style={{ width: `${armor}%` }} />
            </div>
            <span className="text-blue-300 text-[10px] font-mono w-6">{Math.ceil(armor)}</span>
          </div>
        </div>
      )}

      {/* BOTTOM RIGHT - WEAPONS */}
      {gameState.phase === 'playing' && (
        <div className="absolute bottom-20 right-3 md:bottom-4 flex flex-col items-end gap-1">
          <div className="flex gap-1">
            {weapons.map((w, i) => {
              const rarity = w?.def.rarity ?? 'common';
              return (
                <div key={i} className={`px-2 py-1 border rounded text-[10px] font-mono ${
                  i === activeSlot
                    ? `${RARITY_COLORS[rarity]} ${RARITY_BG[rarity]} border-2`
                    : 'border-gray-600 bg-black/50 text-gray-400'
                }`}>
                  <div className="text-[8px] text-gray-500">{i + 1}</div>
                  {w ? w.def.name : 'Empty'}
                </div>
              );
            })}
          </div>
          {weapon && (
            <div className="flex items-center gap-2 px-2 py-0.5 bg-black/70 rounded">
              {weapon.isReloading ? (
                <span className="text-yellow-400 text-xs font-mono animate-pulse">RELOADING</span>
              ) : (
                <>
                  <span className="text-white text-xl font-mono font-bold">{weapon.currentAmmo}</span>
                  <span className="text-gray-400 text-xs font-mono">/ {weapon.reserveAmmo}</span>
                </>
              )}
            </div>
          )}
          {/* Grenade indicator */}
          <div className="flex items-center gap-1 px-2 py-0.5 bg-black/60 rounded text-[10px] font-mono">
            <span className="text-green-400">{GRENADES[grenadeType]?.name || 'Frag'}</span>
            <span className="text-gray-400">x{grenadeCount[grenadeType] || 0}</span>
            <span className="text-gray-500 ml-1">RMB throw</span>
          </div>
        </div>
      )}

      {/* NEARBY PROMPTS */}
      {nearbyItem && gameState.phase === 'playing' && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 bg-black/70 px-3 py-1.5 rounded border border-yellow-500/50">
          <span className="text-yellow-300 text-xs font-mono">[F] {nearbyItem}</span>
        </div>
      )}
      {nearbyVehicle && !inVehicle && gameState.phase === 'playing' && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 bg-black/70 px-3 py-1.5 rounded border border-blue-500/50">
          <span className="text-blue-300 text-xs font-mono">[E] Enter Vehicle</span>
        </div>
      )}
      {inVehicle && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 bg-black/70 px-3 py-1.5 rounded border border-blue-500/50">
          <span className="text-blue-300 text-xs font-mono">[E] Exit Vehicle | WASD Drive</span>
        </div>
      )}

      {/* MINIMAP */}
      {gameState.phase === 'playing' && <Minimap engine={engineRef.current} />}

      {/* MOBILE CONTROLS */}
      {isMobile && gameState.phase === 'playing' && <MobileControls engine={engineRef.current} />}

      {/* INVENTORY (TAB) */}
      {showInventory && gameState.phase === 'playing' && (
        <InventoryPanel
          engine={engineRef.current}
          weapons={weapons}
          activeSlot={activeSlot}
          grenadeCount={grenadeCount}
          gameState={gameState}
          onClose={() => setShowInventory(false)}
        />
      )}

      {/* KILL STREAK NOTIFICATION */}
      {streakLabel && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 animate-bounce pointer-events-none">
          <div className="text-4xl md:text-5xl font-black text-yellow-400 drop-shadow-lg text-center tracking-wider">
            {streakLabel}
          </div>
        </div>
      )}

      {/* LOBBY */}
      {gameState.phase === 'lobby' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
          <h1 className="text-5xl md:text-7xl font-black text-white mb-0 tracking-tighter">
            VOXEL<span className="text-yellow-400">GROUND</span>
          </h1>
          <p className="text-gray-400 text-sm md:text-lg mb-1 font-mono">Infinite Survival Battle Royale</p>

          {/* Personal best */}
          {bestLeaderboardEntry && (
            <div className="mb-4 text-center">
              <span className="text-gray-500 text-xs font-mono">PERSONAL BEST: </span>
              <span className="text-yellow-400 text-sm font-bold">Wave {bestLeaderboardEntry.wave} | {bestLeaderboardEntry.kills} Kills</span>
            </div>
          )}

          <button
            onClick={() => engineRef.current?.startGame()}
            className="px-10 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-lg rounded transition-all active:scale-95"
          >
            START GAME
          </button>

          <div className="mt-6 text-gray-500 text-[11px] font-mono space-y-0.5 text-center">
            <p>WASD Move | SHIFT Sprint | C Crouch | SPACE Jump</p>
            <p>Mouse Aim | Click Shoot | R Reload | F Pickup</p>
            <p>1/2 Weapons | T Grenade Type | Q Drop | E Vehicle</p>
            <p>TAB Inventory | M Mute | RMB Throw Grenade</p>
          </div>
        </div>
      )}

      {/* PLANE */}
      {gameState.phase === 'plane' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="bg-black/70 px-6 py-3 rounded">
            <p className="text-white text-xl font-mono font-bold text-center">IN FLIGHT</p>
            <p className="text-gray-300 text-sm font-mono text-center mt-1">Press SPACE or tap to jump</p>
          </div>
          <button
            onClick={() => engineRef.current?.drop()}
            className="mt-3 px-8 py-3 bg-red-500 active:bg-red-400 text-white font-bold text-lg rounded pointer-events-auto"
          >
            JUMP!
          </button>
        </div>
      )}

      {/* DROPPING */}
      {gameState.phase === 'dropping' && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-black/50 px-4 py-2 rounded">
            <p className="text-white text-lg font-mono text-center">DROPPING</p>
            <p className="text-gray-400 text-xs font-mono text-center">Tap / SPACE for parachute</p>
          </div>
          <button
            onClick={() => engineRef.current?.openParachute()}
            className="mt-2 w-full px-6 py-2 bg-orange-500 active:bg-orange-400 text-white font-bold rounded pointer-events-auto"
          >
            PARACHUTE
          </button>
        </div>
      )}

      {/* WAVE TRANSITION */}
      {gameState.phase === 'wave_transition' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
          <h2 className="text-4xl font-black text-green-400 mb-2 animate-pulse">
            WAVE {gameState.currentWave} COMPLETE
          </h2>
          <p className="text-white text-lg font-mono">{gameState.totalKills} Total Kills</p>
          <p className="text-gray-400 font-mono mb-4">Rank: {rank}</p>
          <div className="bg-gray-800/80 rounded-lg p-4 mb-4 text-center">
            <p className="text-yellow-400 text-2xl font-bold">
              NEXT WAVE IN {Math.ceil(engineRef.current?.waveManager.transitionTimer ?? 0)}s
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Wave {gameState.currentWave + 1}: {engineRef.current?.waveManager.getWaveConfig(gameState.currentWave + 1).botCount ?? '?'} enemies
            </p>
          </div>
        </div>
      )}

      {/* GAME OVER */}
      {gameState.phase === 'dead' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
          <h2 className="text-5xl font-black text-red-500 mb-1">GAME OVER</h2>
          <p className="text-gray-300 text-lg font-mono mb-4">Wave {gameState.currentWave}</p>

          {/* Final stats card */}
          <div className="bg-gray-900 border border-gray-600 rounded-lg p-6 w-80 max-w-[90vw] mb-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="text-3xl font-bold text-yellow-400">{stats?.totalKills ?? gameState.kills}</div>
                <div className="text-gray-500 text-xs font-mono">TOTAL KILLS</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-400">{gameState.currentWave}</div>
                <div className="text-gray-500 text-xs font-mono">WAVES SURVIVED</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400">{fmt(stats?.survivalTime ?? gameState.gameTime)}</div>
                <div className="text-gray-500 text-xs font-mono">SURVIVAL TIME</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-400">{stats?.bestKillStreak ?? gameState.bestKillStreak}</div>
                <div className="text-gray-500 text-xs font-mono">BEST STREAK</div>
              </div>
            </div>

            {/* Rank */}
            <div className="mt-4 text-center border-t border-gray-700 pt-3">
              <div className="text-gray-400 text-xs">RANK</div>
              <div className="text-2xl font-black text-purple-400">{rank}</div>
            </div>
          </div>

          {/* Leaderboard top 5 */}
          <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-4 w-80 max-w-[90vw] mb-4">
            <h3 className="text-white font-bold text-sm mb-2 text-center">ALL-TIME LEADERBOARD</h3>
            {leaderboard.slice(0, 5).map((entry, i) => (
              <div key={i} className="flex justify-between text-xs font-mono py-0.5 border-b border-gray-800">
                <span className="text-gray-400">#{i + 1}</span>
                <span className="text-white">{entry.name}</span>
                <span className="text-yellow-400">W{entry.wave}</span>
                <span className="text-gray-300">{entry.kills}K</span>
              </div>
            ))}
            {leaderboard.length === 0 && (
              <p className="text-gray-600 text-xs text-center font-mono">No records yet</p>
            )}
          </div>

          <button
            onClick={() => window.location.reload()}
            className="px-10 py-3 bg-yellow-500 text-black font-bold text-lg rounded active:scale-95"
          >
            PLAY AGAIN
          </button>
        </div>
      )}

      {/* DAMAGE VIGNETTE - enhanced */}
      {health < 60 && ['playing', 'dead'].includes(gameState.phase) && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse at center, transparent 30%, rgba(255,0,0,${Math.min(0.75, (60 - health) / 70)}) 100%)`,
        }} />
      )}

      {/* FLASH EFFECT (grenade) */}
      {flashAlpha > 0 && (
        <div className="absolute inset-0 pointer-events-none bg-white" style={{ opacity: Math.min(1, flashAlpha) }} />
      )}

      {/* KILL EDGE FLASH - yellow */}
      {killFlashActive && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at center, transparent 60%, rgba(234,179,8,0.35) 100%)',
        }} />
      )}

      {/* WAVE START EDGE FLASH - blue */}
      {waveFlashActive && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(59,130,246,0.4) 100%)',
        }} />
      )}
    </div>
  );
}

// ============ MOBILE CONTROLS ============
function MobileControls({ engine }: { engine: GameEngine | null }) {
  const joyRef = useRef<HTMLDivElement>(null);
  const aimRef = useRef<HTMLDivElement>(null);
  const joyTouchId = useRef<number | null>(null);
  const aimTouchId = useRef<number | null>(null);
  const joyStart = useRef({ x: 0, y: 0 });
  const lastAimPos = useRef({ x: 0, y: 0 });
  const [joyDelta, setJoyDelta] = useState({ x: 0, y: 0 });

  const handleJoyStart = useCallback((e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    joyTouchId.current = t.identifier;
    joyStart.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleJoyMove = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joyTouchId.current) {
        const dx = (t.clientX - joyStart.current.x) / 50;
        const dy = (t.clientY - joyStart.current.y) / 50;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = len > 1 ? dx / len : dx;
        const ny = len > 1 ? dy / len : dy;
        setJoyDelta({ x: nx, y: ny });
        engine?.movePlayer(nx, ny);
      }
    }
  }, [engine]);

  const handleJoyEnd = useCallback(() => {
    joyTouchId.current = null;
    setJoyDelta({ x: 0, y: 0 });
    engine?.movePlayer(0, 0);
  }, [engine]);

  const handleAimStart = useCallback((e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    aimTouchId.current = t.identifier;
    lastAimPos.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleAimMove = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === aimTouchId.current) {
        const dx = t.clientX - lastAimPos.current.x;
        const dy = t.clientY - lastAimPos.current.y;
        lastAimPos.current = { x: t.clientX, y: t.clientY };
        engine?.rotateCamera(dx, dy);
      }
    }
  }, [engine]);

  const handleAimEnd = useCallback(() => {
    aimTouchId.current = null;
  }, []);

  return (
    <>
      {/* LEFT - Movement Joystick */}
      <div
        ref={joyRef}
        className="absolute bottom-8 left-8 w-32 h-32 rounded-full bg-white/10 border-2 border-white/30"
        onTouchStart={handleJoyStart}
        onTouchMove={handleJoyMove}
        onTouchEnd={handleJoyEnd}
      >
        <div
          className="absolute w-12 h-12 rounded-full bg-white/40 border border-white/60 -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${50 + joyDelta.x * 35}%`,
            top: `${50 + joyDelta.y * 35}%`,
          }}
        />
      </div>

      {/* RIGHT - Aim zone (drag to look) */}
      <div
        ref={aimRef}
        className="absolute bottom-0 right-0 w-1/2 h-2/3 opacity-0"
        onTouchStart={handleAimStart}
        onTouchMove={handleAimMove}
        onTouchEnd={handleAimEnd}
      />

      {/* FIRE button */}
      <button
        className="absolute right-6 bottom-28 w-20 h-20 rounded-full bg-red-500/80 border-2 border-red-300 flex items-center justify-center active:bg-red-400"
        onTouchStart={() => engine?.fireWeapon()}
        onTouchEnd={() => engine?.stopFire()}
      >
        <span className="text-white font-bold text-sm">FIRE</span>
      </button>

      {/* AIM/SCOPE button */}
      <button
        className="absolute right-28 bottom-28 w-14 h-14 rounded-full bg-white/20 border border-white/40 flex items-center justify-center active:bg-white/30"
        onTouchStart={() => {}}
      >
        <span className="text-white text-xs font-mono">AIM</span>
      </button>

      {/* JUMP */}
      <button
        className="absolute right-6 bottom-52 w-14 h-14 rounded-full bg-white/20 border border-white/40 flex items-center justify-center active:bg-white/30"
        onTouchStart={() => engine?.player.triggerJump()}
      >
        <span className="text-white text-[10px] font-mono">JUMP</span>
      </button>

      {/* CROUCH */}
      <button
        className="absolute right-24 bottom-52 w-14 h-14 rounded-full bg-white/20 border border-white/40 flex items-center justify-center active:bg-white/30"
        onTouchStart={() => engine?.player.toggleCrouch()}
      >
        <span className="text-white text-[10px] font-mono">CRCH</span>
      </button>

      {/* RELOAD */}
      <button
        className="absolute right-6 bottom-[280px] w-12 h-12 rounded-full bg-white/15 border border-white/30 flex items-center justify-center active:bg-white/25"
        onTouchStart={() => {
          const ev = new KeyboardEvent('keydown', { code: 'KeyR' });
          document.dispatchEvent(ev);
        }}
      >
        <span className="text-white text-[9px] font-mono">RLD</span>
      </button>

      {/* PICKUP (F) */}
      <button
        className="absolute left-1/2 -translate-x-1/2 bottom-44 px-4 py-2 bg-yellow-500/80 rounded active:bg-yellow-400"
        onTouchStart={() => {
          const ev = new KeyboardEvent('keydown', { code: 'KeyF' });
          document.dispatchEvent(ev);
        }}
      >
        <span className="text-black text-xs font-bold">PICK UP</span>
      </button>

      {/* GRENADE */}
      <button
        className="absolute left-8 bottom-44 w-12 h-12 rounded-full bg-green-700/60 border border-green-400/50 flex items-center justify-center active:bg-green-600"
        onTouchStart={() => engine?.throwGrenadeAction()}
      >
        <span className="text-white text-[9px] font-mono">GRN</span>
      </button>

      {/* GRENADE TYPE SWITCH (T) */}
      <button
        className="absolute left-24 bottom-44 w-12 h-12 rounded-full bg-orange-700/60 border border-orange-400/50 flex items-center justify-center active:bg-orange-600"
        onTouchStart={() => {
          const ev = new KeyboardEvent('keydown', { code: 'KeyT' });
          document.dispatchEvent(ev);
        }}
      >
        <span className="text-white text-[9px] font-mono">SWT</span>
      </button>

      {/* VEHICLE */}
      <button
        className="absolute left-40 bottom-44 w-12 h-12 rounded-full bg-blue-700/60 border border-blue-400/50 flex items-center justify-center active:bg-blue-600"
        onTouchStart={() => {
          const ev = new KeyboardEvent('keydown', { code: 'KeyE' });
          document.dispatchEvent(ev);
        }}
      >
        <span className="text-white text-[9px] font-mono">VHC</span>
      </button>

      {/* SPRINT (hold) */}
      <button
        className="absolute left-8 bottom-[175px] w-10 h-10 rounded bg-white/15 border border-white/30 flex items-center justify-center"
        onTouchStart={() => engine?.player.setSprint(true)}
        onTouchEnd={() => engine?.player.setSprint(false)}
      >
        <span className="text-white text-[8px] font-mono">RUN</span>
      </button>
    </>
  );
}

// ============ INVENTORY PANEL ============
function InventoryPanel({ engine, weapons, activeSlot, grenadeCount, gameState, onClose }: {
  engine: GameEngine | null;
  weapons: (WeaponInstance | null)[];
  activeSlot: number;
  grenadeCount: Record<string, number>;
  gameState: GameState;
  onClose: () => void;
}) {
  const rank = engine?.scoreboardSystem.getRank(gameState.currentWave, gameState.totalKills) ?? 'ROOKIE';
  const stats = engine?.scoreboardSystem.stats;

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-600 rounded-lg p-4 w-80 max-w-[90vw]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-white font-bold">INVENTORY</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">X</button>
        </div>

        {/* Wave + stats */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="bg-gray-800 p-2 rounded text-center">
            <div className="text-cyan-400 text-lg font-bold">{gameState.currentWave}</div>
            <div className="text-gray-500 text-[10px] font-mono">WAVE</div>
          </div>
          <div className="bg-gray-800 p-2 rounded text-center">
            <div className="text-yellow-400 text-lg font-bold">{stats?.totalKills ?? gameState.kills}</div>
            <div className="text-gray-500 text-[10px] font-mono">TOTAL KILLS</div>
          </div>
          <div className="bg-gray-800 p-2 rounded text-center">
            <div className="text-orange-400 text-lg font-bold">{stats?.currentKillStreak ?? gameState.killStreak}</div>
            <div className="text-gray-500 text-[10px] font-mono">STREAK</div>
          </div>
          <div className="bg-gray-800 p-2 rounded text-center">
            <div className="text-purple-400 text-sm font-bold">{rank}</div>
            <div className="text-gray-500 text-[10px] font-mono">RANK</div>
          </div>
        </div>

        {/* Weapons */}
        <div className="mb-3">
          <p className="text-gray-400 text-xs mb-1 font-mono">WEAPONS</p>
          {weapons.map((w, i) => {
            const rarity = w?.def.rarity ?? 'common';
            return (
              <div key={i} className={`flex justify-between items-center p-2 mb-1 rounded ${
                i === activeSlot ? `${RARITY_BG[rarity]} border ${RARITY_COLORS[rarity]}` : 'bg-gray-800'
              }`}>
                <span className={`text-sm ${i === activeSlot ? RARITY_COLORS[rarity].split(' ')[0] : 'text-white'}`}>
                  {w ? w.def.name : `Slot ${i + 1} (Empty)`}
                </span>
                {w && (
                  <span className="text-gray-400 text-xs">
                    {w.currentAmmo}/{w.def.magazineSize} | {w.reserveAmmo}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Grenades */}
        <div className="mb-3">
          <p className="text-gray-400 text-xs mb-1 font-mono">THROWABLES</p>
          <div className="flex gap-2">
            {Object.entries(GRENADES).map(([id, def]) => (
              <div key={id} className="bg-gray-800 p-2 rounded flex-1 text-center">
                <div className="text-white text-xs">{def.name}</div>
                <div className="text-yellow-400 text-lg font-bold">{grenadeCount[id] || 0}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <p className="text-gray-400 text-xs mb-1 font-mono">STATUS</p>
          <div className="bg-gray-800 p-2 rounded text-xs text-gray-300 space-y-0.5">
            <p>HP: {Math.ceil(engine?.player.state.health || 0)} | Armor: {Math.ceil(engine?.player.state.armor || 0)}</p>
            <p>Kills: {engine?.player.state.kills || 0} | Best Streak: {stats?.bestKillStreak ?? 0}</p>
          </div>
        </div>

        <p className="text-gray-500 text-[10px] mt-2 text-center font-mono">TAB to close</p>
      </div>
    </div>
  );
}

// ============ MINIMAP ============
function Minimap({ engine }: { engine: GameEngine | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!engine || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = 150;
    canvas.width = size;
    canvas.height = size;

    let rafId: number;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, size, size);

      const scale = size / 400;
      const ox = size / 2;
      const oz = size / 2;

      // Zone
      const zr = engine.zoneSystem.currentRadius * scale;
      const cx = engine.zoneSystem.center.x * scale + ox;
      const cy = engine.zoneSystem.center.y * scale + oz;

      ctx.save();
      ctx.fillStyle = 'rgba(0,50,200,0.25)';
      ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx, cy, zr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = '#0066ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, zr, 0, Math.PI * 2);
      ctx.stroke();

      // Vehicles (blue squares)
      for (const v of engine.vehicleSystem.vehicles) {
        if (v.health <= 0) continue;
        const vx = v.position.x * scale + ox;
        const vz = v.position.z * scale + oz;
        ctx.fillStyle = v.isOccupied ? '#4488ff' : '#2266aa';
        ctx.fillRect(vx - 2, vz - 2, 4, 4);
      }

      // Nearby bots (red)
      const pp = engine.player.state.position;
      for (const bot of engine.botSystem.bots) {
        if (bot.isDead) continue;
        const dist = Math.sqrt((bot.position.x - pp.x) ** 2 + (bot.position.z - pp.z) ** 2);
        if (dist < 60) {
          const bx = bot.position.x * scale + ox;
          const bz = bot.position.z * scale + oz;
          ctx.fillStyle = '#ff4444';
          ctx.beginPath();
          ctx.arc(bx, bz, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Player (white)
      const px = pp.x * scale + ox;
      const pz = pp.z * scale + oz;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, pz, 3, 0, Math.PI * 2);
      ctx.fill();

      const dir = engine.player.getForwardDirection();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, pz);
      ctx.lineTo(px + dir.x * 8, pz + dir.z * 8);
      ctx.stroke();

      ctx.strokeStyle = '#555';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(0, 0, size, size);

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [engine]);

  return (
    <div className="absolute top-10 left-2">
      <canvas ref={canvasRef} className="rounded border border-gray-700" style={{ width: 120, height: 120 }} />
    </div>
  );
}
