'use client';

import { useEffect, useState, useRef } from 'react';
import { GameEngine, GameState } from '../game/core/GameEngine';
import { WeaponInstance } from '../game/weapons/WeaponSystem';
import { SkinSystem } from '../game/shop/SkinSystem';
import { MobileControls } from './MobileControls';
import { InventoryPanel } from './InventoryPanel';
import { Minimap } from './Minimap';
import { ShopModal } from './ShopModal';
import { PlayingHUD } from './ui/PlayingHUD';
import { LobbyScreen } from './ui/LobbyScreen';
import { GameOverScreen } from './ui/GameOverScreen';
import { PlaneOverlay, DroppingOverlay, WaveTransitionOverlay, RevivePrompt, PauseOverlay } from './ui/PhaseOverlays';


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

  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

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
          <div className="px-5 py-2.5 text-center border" style={{ background: 'rgba(74,103,65,0.9)', borderColor: '#4a6741' }}>
            <p className="text-sm font-bold font-mono uppercase tracking-wider" style={{ color: '#e8e0d0' }}>{paymentSuccess}</p>
          </div>
        </div>
      )}

      {/* SOUND TOGGLE */}
      <button
        onClick={() => {
          engineRef.current?.soundManager.toggleMute();
          setMuted(m => !m);
        }}
        className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center text-xs font-bold border hover:opacity-80 z-10"
        style={{ background: '#1a1f16', borderColor: '#4a4535', color: muted ? '#c93a3a' : '#d4a24e', fontFamily: "'Teko', sans-serif", letterSpacing: '0.05em' }}
      >
        {muted ? 'OFF' : 'SND'}
      </button>

      {/* PLAYING HUD -- all in-game HUD elements */}
      <PlayingHUD
        gameState={gameState}
        health={health}
        armor={armor}
        weapon={weapon}
        weapons={weapons}
        activeSlot={activeSlot}
        zoneInfo={zoneInfo}
        killFeed={killFeed}
        grenadeType={grenadeType}
        grenadeCount={grenadeCount}
        inVehicle={inVehicle}
        nearbyItem={nearbyItem}
        nearbyVehicle={nearbyVehicle}
        isMobile={isMobile}
        damageDirection={d.damageDirection}
        flashAlpha={flashAlpha}
        killBanner={killBanner}
        hitMarkerActive={hitMarkerActive}
        streakLabel={streakLabel}
        killFlashActive={killFlashActive}
        waveFlashActive={waveFlashActive}
        engineRef={engineRef}
        skinSystem={skinSystem}
        fmt={fmt}
      />

      {/* MINIMAP */}
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

      {/* ESC PAUSE OVERLAY */}
      {engineRef.current?.isPaused && gameState.phase === 'playing' && (
        <PauseOverlay engineRef={engineRef} containerRef={containerRef} onShowShop={() => setShowShop(true)} />
      )}

      {/* LOBBY */}
      {gameState.phase === 'lobby' && (
        <LobbyScreen engineRef={engineRef} skinSystem={skinSystem} bestLeaderboardEntry={bestLeaderboardEntry} onShowShop={() => setShowShop(true)} />
      )}

      {/* PLANE */}
      {gameState.phase === 'plane' && <PlaneOverlay engineRef={engineRef} />}

      {/* DROPPING */}
      {gameState.phase === 'dropping' && <DroppingOverlay engineRef={engineRef} />}

      {/* WAVE TRANSITION */}
      {gameState.phase === 'wave_transition' && <WaveTransitionOverlay gameState={gameState} engineRef={engineRef} rank={rank} />}

      {/* REVIVE PROMPT */}
      {engineRef.current?.reviveOffered && (engineRef.current?.reviveTimer ?? 0) > 0 && (
        <RevivePrompt engineRef={engineRef} skinSystem={skinSystem} />
      )}

      {/* GAME OVER */}
      {gameState.phase === 'dead' && (
        <GameOverScreen
          gameState={gameState}
          stats={stats}
          rank={rank}
          leaderboard={leaderboard}
          skinSystem={skinSystem}
          fmt={fmt}
          onShowShop={() => setShowShop(true)}
        />
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
    </div>
  );
}
