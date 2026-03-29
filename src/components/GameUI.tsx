'use client';

import { useEffect, useState, useRef } from 'react';
import { GameEngine, GameState } from '../game/core/GameEngine';
import { WeaponInstance } from '../game/weapons/WeaponSystem';
import { GRENADES } from '../game/weapons/GrenadeSystem';
import { SkinSystem } from '../game/shop/SkinSystem';
import { MobileControls } from './MobileControls';
import { InventoryPanel } from './InventoryPanel';
import { Minimap } from './Minimap';
import { ShopModal } from './ShopModal';

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
    damageDirection: null as number | null,
  });

  // Single state tick for low-frequency UI updates
  const [uiTick, setUiTick] = useState(0);

  // Event-driven states
  const [gameState, setGameState] = useState<GameState>(gameDataRef.current.gameState);
  const [isMobile, setIsMobile] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [muted, setMuted] = useState(false);
  const skinSystem = useRef<SkinSystem | null>(null);

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

  // Hit marker (X) on kill
  const [hitMarkerActive, setHitMarkerActive] = useState(false);
  const hitMarkerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Kill banner "Eliminated {name}"
  const [killBanner, setKillBanner] = useState<string | null>(null);
  const killBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Payment success notification
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // Handle Stripe payment success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const packId = params.get('pack_id');
    if (!sessionId || !packId) return;

    // Clean URL immediately
    window.history.replaceState({}, '', window.location.pathname);

    const verify = async () => {
      try {
        const res = await fetch(
          `https://blitzpit-api.meshedwell.workers.dev/api/verify?session_id=${encodeURIComponent(sessionId)}`
        );
        const data = await res.json() as { success: boolean; coins?: number; packId?: string };
        if (data.success) {
          // Wait for engine + skinSystem to init before granting coins
          const grantCoins = () => {
            if (!skinSystem.current) {
              setTimeout(grantCoins, 200);
              return;
            }
            if ((data.coins ?? 0) > 0) {
              skinSystem.current.addCoins(data.coins!);
            }
            if (packId === 'welcome') {
              skinSystem.current.buyWelcomePack();
            }
            setPaymentSuccess(`Payment successful! ${(data.coins ?? 0) > 0 ? `+${data.coins} BC` : 'Welcome Pack activated!'}`);
            setTimeout(() => setPaymentSuccess(null), 5000);
          };
          grantCoins();
        }
      } catch (err) {
        console.error('Payment verify failed:', err);
      }
    };
    verify();
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

      // Dead phase: clear transient UI
      if (s.phase === 'dead') {
        setKillBanner(null);
        setHitMarkerActive(false);
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
      skinSystem.current = engine.skinSystem;
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

        // Kill flash + hit marker + banner detection
        const newKills = engine.player.state.kills;
        if (newKills > lastKillsRef.current) {
          setKillFlashActive(true);
          setTimeout(() => setKillFlashActive(false), 100);

          // Hit marker (X) for 0.3s
          if (hitMarkerTimerRef.current) clearTimeout(hitMarkerTimerRef.current);
          setHitMarkerActive(true);
          hitMarkerTimerRef.current = setTimeout(() => setHitMarkerActive(false), 300);

          // Kill banner: find recently killed bot name from kill feed
          const feed = engine.botSystem.killFeed;
          const latestKill = feed.length > 0 ? feed[feed.length - 1] : null;
          const myNameForBanner = typeof localStorage !== 'undefined' ? localStorage.getItem('blitzpit_name') || 'You' : 'You';
          if (latestKill && (latestKill.killer === myNameForBanner || latestKill.killer === 'You')) {
            if (killBannerTimerRef.current) clearTimeout(killBannerTimerRef.current);
            setKillBanner(latestKill.victim);
            killBannerTimerRef.current = setTimeout(() => setKillBanner(null), 2000);
          }

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

        // Damage direction indicator
        if (engine.lastDamageFrom && Date.now() - engine.lastDamageTime < 1500) {
          const dx = engine.lastDamageFrom.x - engine.player.state.position.x;
          const dz = engine.lastDamageFrom.z - engine.player.state.position.z;
          const angle = Math.atan2(dx, dz) - engine.player.getYaw();
          d.damageDirection = angle;
        } else {
          d.damageDirection = null;
        }

        // Nearby items/vehicles check
        const pp = engine.player.state.position;
        let item: string | null = null;
        for (const i of engine.weaponSystem.items) {
          if (i.collected || i.position.distanceTo(pp) > 3) continue;
          if (i.type === 'weapon' && i.weaponId) item = `Pick up ${i.weaponId.toUpperCase()}`;
          else if (i.type === 'health') item = 'Pick up Health Pack';
          else if (i.type === 'ammo') item = 'Pick up Ammo';
          else if (i.type === 'armor') item = 'Pick up Armor';
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
      if (hitMarkerTimerRef.current) clearTimeout(hitMarkerTimerRef.current);
      if (killBannerTimerRef.current) clearTimeout(killBannerTimerRef.current);
      engine.destroy();
    };
  }, []);

  // Snapshot from ref for rendering (updated at 10fps)
  const d = gameDataRef.current;
  const { health, armor, weapon, weapons, activeSlot, zoneInfo, killFeed, grenadeType, grenadeCount, inVehicle, nearbyItem, nearbyVehicle, flashAlpha } = d;
  // damageDirection accessed via d.damageDirection below

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

      {/* PAYMENT SUCCESS NOTIFICATION */}
      {paymentSuccess && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-green-900/90 border border-green-400/60 px-5 py-2.5 rounded-lg text-center shadow-lg">
            <p className="text-green-300 text-sm font-bold font-mono">{paymentSuccess}</p>
          </div>
        </div>
      )}

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

      {/* BLITZ COINS + WILD POINTS HUD -- shifted left to not overlap SND button */}
      {gameState.phase === 'playing' && skinSystem.current && (
        <div className="absolute top-2 right-12 bg-black/50 px-2 py-1 rounded text-[10px] font-mono flex gap-2">
          <span className="text-yellow-400">{skinSystem.current.purchases.blitzCoins} BC</span>
          <span className="text-green-400">{skinSystem.current.purchases.blitzPoints} WP</span>
        </div>
      )}

      {/* TIME / BIOME / WEATHER HUD -- placed below minimap (top-10 + 120px height ~= top-40) */}
      {gameState.phase === 'playing' && (
        <div className="absolute top-40 left-2 bg-black/50 px-2 py-1 rounded text-[10px] font-mono space-y-0.5">
          <div className="text-gray-300">
            {(() => {
              const period = engineRef.current?.dayNightSystem.getTimePeriod() ?? 'noon';
              const periodNames: Record<string, string> = {
                deep_night: 'MIDNIGHT', dawn: 'DAWN', morning: 'MORNING',
                noon: 'NOON', afternoon: 'AFTERNOON', dusk: 'DUSK', night: 'NIGHT',
              };
              return `${engineRef.current?.dayNightSystem.getTimeString() ?? '12:00'} ${periodNames[period] ?? 'DAY'}`;
            })()}
          </div>
          <div className="text-gray-400">
            {engineRef.current?.biomeSystem.getBiome(
              engineRef.current?.player.state.position.x ?? 0,
              engineRef.current?.player.state.position.z ?? 0
            )?.toUpperCase() ?? 'URBAN'}
          </div>
          <div className="text-gray-400">
            {(() => {
              const weather = engineRef.current?.weatherSystem.currentWeather;
              return (
                <>
                  {weather?.toUpperCase() ?? 'CLEAR'}
                  {weather === 'fog' && <span className="text-blue-300 text-[8px]"> -50% detect</span>}
                  {weather === 'storm' && <span className="text-red-300 text-[8px]"> +30% spread</span>}
                  {weather === 'rain' && <span className="text-blue-300 text-[8px]"> +10% spread</span>}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* LIGHTNING FLASH */}
      {engineRef.current?.weatherSystem.lightningFlash && (
        <div className="absolute inset-0 pointer-events-none bg-white/30" />
      )}

      {/* CROSSHAIR */}
      {gameState.phase === 'playing' && !d.inVehicle && (() => {
        const spread = weapon?.def.spread ?? 0.04;
        const gap = Math.max(6, Math.round(spread * 200));
        const size = gap * 2 + 8;
        return (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative" style={{ width: size, height: size }}>
              <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 0, width: 2, height: gap, background: 'rgba(255,255,255,0.8)', boxShadow: '0 0 2px rgba(0,0,0,0.8)' }} />
              <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 0, width: 2, height: gap, background: 'rgba(255,255,255,0.8)', boxShadow: '0 0 2px rgba(0,0,0,0.8)' }} />
              <div className="absolute top-1/2 -translate-y-1/2" style={{ left: 0, width: gap, height: 2, background: 'rgba(255,255,255,0.8)', boxShadow: '0 0 2px rgba(0,0,0,0.8)' }} />
              <div className="absolute top-1/2 -translate-y-1/2" style={{ right: 0, width: gap, height: 2, background: 'rgba(255,255,255,0.8)', boxShadow: '0 0 2px rgba(0,0,0,0.8)' }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-red-500 border border-red-300/50" />
            </div>
          </div>
        );
      })()}

      {/* HIT MARKER (X) on kill */}
      {hitMarkerActive && gameState.phase === 'playing' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-red-500 font-black" style={{ fontSize: 28, lineHeight: 1, textShadow: '0 0 6px rgba(255,0,0,0.8)' }}>X</div>
        </div>
      )}

      {/* KILL BANNER */}
      {killBanner && gameState.phase === 'playing' && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-black/70 border border-red-500/60 px-4 py-1.5 rounded text-center">
            <span className="text-red-400 text-sm font-bold font-mono">Eliminated {killBanner}</span>
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

      {/* BOSS HP BAR */}
      {gameState.phase === 'playing' && engineRef.current?.bossSystem.getActiveBosses().map(boss => (
        <div key={boss.id} className="absolute top-16 left-1/2 -translate-x-1/2 w-64">
          <div className="text-center text-red-400 text-xs font-bold font-mono mb-0.5">
            {boss.name} (Phase {boss.phase})
          </div>
          <div className="w-full h-3 bg-gray-800 border border-red-600 rounded">
            <div className="h-full rounded transition-all"
              style={{
                width: `${(boss.health / boss.maxHealth) * 100}%`,
                backgroundColor: boss.phase === 3 ? '#9b59b6' : boss.phase === 2 ? '#e67e22' : '#e74c3c',
              }}
            />
          </div>
        </div>
      ))}

      {/* POI INDICATOR */}
      {gameState.phase === 'playing' && (() => {
        const poi = engineRef.current?.world.poiLocations?.find(p => {
          const dx = (engineRef.current?.player.state.position.x ?? 0) - p.x;
          const dz = (engineRef.current?.player.state.position.z ?? 0) - p.z;
          return Math.sqrt(dx * dx + dz * dz) < p.radius;
        });
        if (!poi) return null;
        const names: Record<string, string> = { military: 'MILITARY BASE', temple: 'ANCIENT TEMPLE', gas_station: 'GAS STATION' };
        const colors: Record<string, string> = { military: 'text-red-400', temple: 'text-yellow-400', gas_station: 'text-blue-400' };
        return (
          <div className="absolute top-20 left-1/2 -translate-x-1/2">
            <span className={`${colors[poi.type]} text-xs font-mono font-bold`}>{names[poi.type]}</span>
          </div>
        );
      })()}

      {/* KILL FEED -- positioned below the SND/CUB row to avoid overlap */}
      {killFeed.length > 0 && (
        <div className="absolute top-12 right-2 flex flex-col gap-0.5">
          {(() => {
            const myName = typeof localStorage !== 'undefined' ? localStorage.getItem('blitzpit_name') || 'You' : 'You';
            return killFeed.map((k, i) => {
              const isMyKill = k.killer === myName || k.killer === 'You';
              const isMyDeath = k.victim === myName || k.victim === 'You';
              return (
                <div key={`${k.time}_${i}`} className={`bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded text-[11px] font-mono flex gap-1.5 ${isMyKill ? 'border border-yellow-600/40' : ''}`}>
                  <span className={isMyKill ? 'text-yellow-300 font-bold' : 'text-white'}>{k.killer}</span>
                  <span className="text-gray-500">[{k.weapon}]</span>
                  <span className={isMyDeath ? 'text-red-400 font-bold' : 'text-gray-300'}>{k.victim}</span>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* BOTTOM LEFT - HP + ARMOR */}
      {['playing', 'dead'].includes(gameState.phase) && (
        <div className="absolute bottom-20 left-3 md:bottom-4 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-white text-[10px] font-mono w-5">HP</span>
            <div className="w-36 md:w-48 h-3.5 bg-black/70 border border-gray-600 rounded overflow-hidden">
              <div className="h-full transition-all duration-200" style={{
                width: `${health}%`,
                backgroundColor: health > 60 ? '#22c55e' : health > 30 ? '#eab308' : '#ef4444',
              }} />
            </div>
            <span className="text-white text-[10px] font-mono w-6">{Math.ceil(health)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-blue-300 text-[10px] font-mono w-5">AR</span>
            <div className="w-36 md:w-48 h-3 bg-black/70 border border-gray-600 rounded overflow-hidden">
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
                <div key={i} className={`px-3 py-1.5 border-2 rounded-lg text-[11px] font-mono transition-all ${
                  i === activeSlot
                    ? `${RARITY_COLORS[rarity]} ${RARITY_BG[rarity]} scale-105`
                    : 'border-gray-700 bg-black/60 text-gray-500'
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

      {/* WATER OVERLAY */}
      {engineRef.current?.player.state.isSwimming && gameState.phase === 'playing' && (
        <div className="absolute inset-0 pointer-events-none bg-blue-500/15" />
      )}

      {/* SWIMMING INDICATOR */}
      {engineRef.current?.player.state.isSwimming && gameState.phase === 'playing' && (
        <div className="absolute bottom-40 left-1/2 -translate-x-1/2 bg-blue-900/70 px-3 py-1 rounded text-blue-200 text-xs font-mono">
          SWIMMING -- Speed reduced | SPACE to surface
        </div>
      )}

      {/* DROWNING WARNING */}
      {(engineRef.current?.player.swimTimer ?? 0) > 10 && gameState.phase === 'playing' && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 bg-red-900/70 px-4 py-2 rounded animate-pulse">
          <span className="text-red-300 text-sm font-bold font-mono">DROWNING!</span>
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
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur px-5 py-2.5 rounded-lg border border-gray-600/50 flex gap-5 items-center">
          <span className="text-blue-300 text-xs font-mono font-bold">[E] Exit</span>
          <div className="text-center">
            <div className="text-white text-lg font-mono font-bold">
              {Math.round(Math.abs(engineRef.current?.vehicleSystem.playerVehicle?.speed ?? 0) * 3.6)}
            </div>
            <div className="text-gray-500 text-[8px] font-mono">KM/H</div>
          </div>
          <div className="w-16 h-2 bg-gray-800 rounded overflow-hidden">
            <div className="h-full rounded transition-all"
              style={{
                width: `${engineRef.current?.vehicleSystem.playerVehicle?.fuel ?? 0}%`,
                backgroundColor: (engineRef.current?.vehicleSystem.playerVehicle?.fuel ?? 0) < 20 ? '#ef4444' : '#3b82f6',
              }}
            />
          </div>
          <span className="text-green-400 text-sm font-mono font-bold">
            G{engineRef.current?.vehicleSystem.playerVehicle
              ? engineRef.current.vehicleSystem.getGear(engineRef.current.vehicleSystem.playerVehicle)
              : 0}
          </span>
        </div>
      )}

      {/* MINIMAP -- show during plane, dropping, and playing phases */}
      {(gameState.phase === 'playing' || gameState.phase === 'plane' || gameState.phase === 'dropping') && <Minimap engine={engineRef.current} />}

      {/* MOBILE CONTROLS */}
      {isMobile && gameState.phase === 'playing' && <MobileControls engine={engineRef.current} nearbyItem={nearbyItem} />}

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

      {/* ESC PAUSE OVERLAY */}
      {engineRef.current?.isPaused && gameState.phase === 'playing' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur z-50">
          <h2 className="text-4xl font-bold text-white mb-6">PAUSED</h2>
          <div className="flex flex-col gap-3 w-48">
            <button
              onClick={() => {
                engineRef.current?.resume();
                containerRef.current?.requestPointerLock();
              }}
              className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg active:scale-95"
            >
              RESUME
            </button>
            <button
              onClick={() => setShowShop(true)}
              className="px-6 py-3 bg-purple-600 text-white font-bold rounded-lg active:scale-95"
            >
              SHOP
            </button>
          </div>
        </div>
      )}

      {/* LOBBY */}
      {gameState.phase === 'lobby' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
          <h1 className="text-5xl md:text-7xl font-black mb-0 tracking-wider uppercase" style={{ fontFamily: "'Teko', sans-serif", color: '#e8e0d0', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
            BLITZ<span style={{ color: '#c93a3a' }}>PIT</span>
          </h1>
          <p className="text-xs md:text-sm mb-2 tracking-[0.3em] uppercase font-bold" style={{ fontFamily: "'Teko', sans-serif", color: '#8a7e6b' }}>INFINITE BATTLE ROYALE</p>
          <div className="text-xs font-mono mb-4" style={{ color: '#6b6356' }}>
            40 players waiting...
          </div>

          {/* Nickname input */}
          <div className="mb-3 mt-2">
            <input
              type="text"
              placeholder="ENTER CALLSIGN"
              maxLength={16}
              defaultValue={localStorage.getItem('blitzpit_name') || ''}
              onChange={(e) => localStorage.setItem('blitzpit_name', e.target.value)}
              className="px-4 py-2.5 text-center font-mono text-lg uppercase tracking-wider focus:outline-none w-64"
              style={{ background: '#1a1f16', border: '1px solid #4a4535', color: '#e8e0d0', fontFamily: "'Rajdhani', sans-serif" }}
            />
          </div>

          {/* Personal best */}
          {bestLeaderboardEntry && (
            <div className="mb-3 text-center">
              <span className="text-xs font-mono uppercase tracking-wider" style={{ color: '#6b6356' }}>PERSONAL BEST: </span>
              <span className="text-sm font-bold" style={{ color: '#d4a24e', fontFamily: "'Teko', sans-serif" }}>Wave {bestLeaderboardEntry.wave} | {bestLeaderboardEntry.kills} Kills</span>
            </div>
          )}

          <button
            onClick={() => engineRef.current?.startGame()}
            className="px-14 py-3 font-black text-xl uppercase tracking-widest transition-all active:scale-95"
            style={{ background: '#d4a24e', color: '#1a1f16', fontFamily: "'Teko', sans-serif", fontSize: '1.5rem', letterSpacing: '0.15em' }}
          >
            DEPLOY
          </button>
          <button
            onClick={() => setShowShop(true)}
            className="mt-2 px-8 py-2 font-bold text-sm uppercase tracking-wider transition-all active:scale-95"
            style={{ background: '#4a6741', color: '#e8e0d0', fontFamily: "'Teko', sans-serif", letterSpacing: '0.1em' }}
          >
            ARMORY
          </button>

          {skinSystem.current?.getActiveSkin() && (
            <div className="mt-2 text-center">
              <span className="text-xs font-mono uppercase" style={{ color: '#6b6356' }}>Loadout: </span>
              <span className="text-xs font-bold" style={{ color: '#d4a24e' }}>
                {skinSystem.current?.getActiveSkin()?.name}
              </span>
            </div>
          )}

          <div className="mt-5 text-[10px] font-mono space-y-0.5 text-center uppercase" style={{ color: '#4a4535' }}>
            <p>WASD Move | SHIFT Sprint | C Crouch/Slide | V Melee</p>
            <p>Click Shoot | RMB Aim | R Reload | F Pickup | SPACE Jump</p>
            <p>1/2 Weapons | T Grenade | E Vehicle | TAB Inventory</p>
          </div>
        </div>
      )}

      {/* PLANE */}
      {gameState.phase === 'plane' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="px-8 py-3" style={{ background: '#1a1f16/90', border: '1px solid #4a4535' }}>
            <p className="text-xl font-bold text-center uppercase tracking-widest" style={{ fontFamily: "'Teko', sans-serif", color: '#e8e0d0' }}>IN FLIGHT</p>
            <p className="text-sm font-mono text-center mt-1 uppercase" style={{ color: '#8a7e6b' }}>Press SPACE or tap to jump</p>
          </div>
          <button
            onClick={() => engineRef.current?.drop()}
            className="mt-3 px-10 py-3 font-bold text-lg uppercase tracking-wider active:scale-95 pointer-events-auto transition-all"
            style={{ background: '#c93a3a', color: '#e8e0d0', fontFamily: "'Teko', sans-serif", letterSpacing: '0.15em' }}
          >
            JUMP!
          </button>
        </div>
      )}

      {/* DROPPING */}
      {gameState.phase === 'dropping' && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 pointer-events-none w-56">
          <div className="bg-black/70 px-4 py-3 rounded border border-gray-600 font-mono text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400">ALT</span>
              <span className="text-white font-bold">
                {Math.max(0, Math.round(
                  (engineRef.current?.player.state.position.y ?? 0) -
                  (engineRef.current?.world.getHeightAt(
                    engineRef.current?.player.state.position.x ?? 0,
                    engineRef.current?.player.state.position.z ?? 0
                  ) ?? 0)
                ))}m
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">SPEED</span>
              <span className="text-cyan-400 font-bold">
                {engineRef.current?.dropSpeed ?? 55} m/s
              </span>
            </div>
            <div className="border-t border-gray-700 pt-1 text-gray-400 text-center">
              SPACE - Open Parachute
            </div>
            <div className="text-gray-400 text-center">WASD - Steer</div>
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
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          <h2 className="text-5xl font-black text-green-400 mb-3 animate-pulse drop-shadow-lg">
            WAVE {gameState.currentWave} CLEAR
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

      {/* REVIVE PROMPT */}
      {engineRef.current?.reviveOffered && (engineRef.current?.reviveTimer ?? 0) > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-40">
          <h2 className="text-4xl font-black text-red-500 mb-3 animate-pulse">ELIMINATED</h2>
          <div className="bg-gray-900/90 border border-gray-700 rounded-xl p-5 text-center mb-4">
            <p className="text-white font-mono text-2xl font-bold mb-1">
              {Math.ceil(engineRef.current?.reviveTimer ?? 0)}
            </p>
            <p className="text-gray-400 text-xs font-mono">seconds to revive</p>
          </div>
          <button
            onClick={() => engineRef.current?.revivePlayer()}
            disabled={!skinSystem.current || skinSystem.current.purchases.reviveTokens <= 0}
            className={`px-8 py-3 font-bold text-lg rounded active:scale-95 mb-2 ${
              skinSystem.current && skinSystem.current.purchases.reviveTokens > 0
                ? 'bg-green-500 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            REVIVE ({skinSystem.current?.purchases.reviveTokens ?? 0} tokens)
          </button>
          <p className="text-gray-400 text-xs font-mono">HP 50% | 2s invincible</p>
        </div>
      )}

      {/* GAME OVER -- Military */}
      {gameState.phase === 'dead' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-30"
          style={{ background: 'radial-gradient(ellipse at center, rgba(13,15,11,0.88) 0%, rgba(13,15,11,0.97) 100%)', backdropFilter: 'blur(6px)' }}>

          {/* GAME OVER Title */}
          <h2 className="text-6xl sm:text-8xl font-bold mb-0 tracking-[0.4em] text-[#c93a3a]"
            style={{
              fontFamily: "'Teko', sans-serif",
              filter: 'drop-shadow(0 0 20px rgba(201,58,58,0.4))',
            }}>
            GAME OVER
          </h2>
          <p className="text-[#6b7b6a] text-sm font-mono mb-5 tracking-[0.3em] uppercase">WAVE {gameState.currentWave}</p>

          {/* Final stats card -- military dark */}
          <div className="relative w-[420px] max-w-[92vw] mb-4 overflow-hidden bg-[#12150f] border border-[#c4a35a]/20"
            style={{ clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))' }}>
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#c93a3a]" />
            <div className="p-5">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 bg-[#1a1f16] border border-[#c93a3a]/20">
                  <div className="text-3xl font-bold text-[#c93a3a]" style={{ fontFamily: "'Teko', sans-serif" }}>{stats?.totalKills ?? gameState.kills}</div>
                  <div className="text-[#6b7b6a] text-[10px] font-mono tracking-wider mt-1">TOTAL KILLS</div>
                </div>
                <div className="p-3 bg-[#1a1f16] border border-[#4a6741]/20">
                  <div className="text-3xl font-bold text-[#4a6741]" style={{ fontFamily: "'Teko', sans-serif" }}>{gameState.currentWave}</div>
                  <div className="text-[#6b7b6a] text-[10px] font-mono tracking-wider mt-1">WAVES SURVIVED</div>
                </div>
                <div className="p-3 bg-[#1a1f16] border border-[#c4a35a]/20">
                  <div className="text-2xl font-bold text-[#c4a35a]" style={{ fontFamily: "'Teko', sans-serif" }}>{fmt(stats?.survivalTime ?? gameState.gameTime)}</div>
                  <div className="text-[#6b7b6a] text-[10px] font-mono tracking-wider mt-1">SURVIVAL TIME</div>
                </div>
                <div className="p-3 bg-[#1a1f16] border border-[#d4a24e]/20">
                  <div className="text-2xl font-bold text-[#d4a24e]" style={{ fontFamily: "'Teko', sans-serif" }}>{stats?.bestKillStreak ?? gameState.bestKillStreak}</div>
                  <div className="text-[#6b7b6a] text-[10px] font-mono tracking-wider mt-1">BEST STREAK</div>
                </div>
              </div>
              {/* Rank */}
              <div className="mt-4 text-center pt-3 border-t border-[#c4a35a]/10">
                <div className="text-[#6b7b6a] text-[10px] font-mono tracking-wider uppercase">RANK</div>
                <div className="text-2xl font-bold mt-1 text-[#d4a24e]" style={{ fontFamily: "'Teko', sans-serif" }}>{rank}</div>
              </div>
            </div>
          </div>

          {/* Leaderboard top 5 -- military card */}
          <div className="w-[360px] max-w-[90vw] mb-4 overflow-hidden bg-[#12150f] border border-[#c4a35a]/15">
            <div className="p-4">
              <h3 className="text-[#c4a35a] font-bold text-sm mb-3 text-center tracking-[0.25em] uppercase" style={{ fontFamily: "'Teko', sans-serif" }}>ALL-TIME LEADERBOARD</h3>
              {leaderboard.slice(0, 5).map((entry, i) => {
                const rankColors = ['#d4a24e', '#c4a35a', '#8a7a4a', '#6b7b6a', '#555'];
                return (
                  <div key={i} className="flex items-center justify-between text-xs font-mono py-1.5 px-2 mb-0.5 border-b border-[#c4a35a]/05">
                    <span className="font-bold text-sm w-6 text-center" style={{ color: rankColors[i] }}>
                      #{i + 1}
                    </span>
                    <span className="text-[#c4a35a] flex-1 ml-2 truncate">{entry.name}</span>
                    <span className="font-bold ml-2 text-[#4a6741]">W{entry.wave}</span>
                    <span className="font-bold ml-2 text-[#c93a3a]">{entry.kills}K</span>
                  </div>
                );
              })}
              {leaderboard.length === 0 && (
                <p className="text-[#6b7b6a] text-xs text-center font-mono py-2">No records yet</p>
              )}
            </div>
          </div>

          {/* Welcome Pack Banner -- military amber */}
          {skinSystem.current && !skinSystem.current.purchases.welcomePurchased && (
            <div className="w-[360px] max-w-[90vw] mb-4 overflow-hidden bg-[#12150f] border-2 border-[#d4a24e]/40"
              style={{
                clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(212,162,78,0.04) 20px, rgba(212,162,78,0.04) 21px)',
              }}>
              <div className="p-4 text-center">
                <div className="font-bold text-lg tracking-wider text-[#d4a24e] uppercase" style={{ fontFamily: "'Teko', sans-serif" }}>WELCOME PACK -- &#8377;9</div>
                <div className="text-[#6b7b6a] text-xs mt-1">500 BC + VIP Badge + Random Skin</div>
                <button onClick={() => {
                  skinSystem.current!.buyWelcomePack();
                  setShowShop(false);
                }} className="mt-3 px-6 py-2 bg-[#d4a24e] text-black font-bold text-sm active:scale-95 transition-all uppercase tracking-wider hover:bg-[#c4a35a]"
                  style={{ fontFamily: "'Teko', sans-serif" }}>
                  REQUISITION &#8377;9
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3 w-[360px] max-w-[90vw]">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 py-3.5 bg-[#d4a24e] text-black font-bold text-xl active:scale-95 transition-all tracking-[0.2em] uppercase hover:bg-[#c4a35a]"
              style={{ fontFamily: "'Teko', sans-serif" }}
            >
              PLAY AGAIN
            </button>
            <button
              onClick={() => setShowShop(true)}
              className="px-6 py-3.5 bg-[#4a6741] text-white font-bold text-xl active:scale-95 transition-all tracking-[0.2em] uppercase hover:bg-[#5a7751]"
              style={{ fontFamily: "'Teko', sans-serif" }}
            >
              SHOP
            </button>
          </div>
        </div>
      )}

      {/* SHOP MODAL */}
      {showShop && skinSystem.current && (
        <ShopModal
          skinSystem={skinSystem.current}
          onClose={() => setShowShop(false)}
          onSkinChange={() => {
            if (engineRef.current && skinSystem.current) {
              skinSystem.current.applySkinToMesh(engineRef.current.player.mesh);
            }
          }}
        />
      )}

      {/* DAMAGE DIRECTION INDICATOR */}
      {d.damageDirection !== null && gameState.phase === 'playing' && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-16 h-16 rounded-full"
            style={{
              left: `${50 + Math.sin(d.damageDirection) * 40}%`,
              top: `${50 - Math.cos(d.damageDirection) * 40}%`,
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle, rgba(255,0,0,0.6) 0%, transparent 70%)',
            }}
          />
        </div>
      )}

      {/* ZONE OUTSIDE VIGNETTE -- blue edge when outside safe zone */}
      {gameState.phase === 'playing' && engineRef.current &&
        !engineRef.current.zoneSystem.isInsideZone(engineRef.current.player.state.position) && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,68,255,0.35) 100%)',
        }} />
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
