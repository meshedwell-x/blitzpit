import { WeaponInstance } from '../../game/weapons/WeaponSystem';
import { GRENADES } from '../../game/weapons/GrenadeSystem';
import { GameState } from '../../game/core/GameEngine';
import { GameEngine } from '../../game/core/GameEngine';
import { SkinSystem } from '../../game/shop/SkinSystem';

export interface PlayingHUDProps {
  gameState: GameState;
  health: number;
  armor: number;
  weapon: WeaponInstance | null;
  weapons: (WeaponInstance | null)[];
  activeSlot: number;
  zoneInfo: { phase: number; timer: number; isShrinking: boolean; damage: number };
  killFeed: { killer: string; victim: string; weapon: string; time: number }[];
  grenadeType: string;
  grenadeCount: Record<string, number>;
  inVehicle: boolean;
  nearbyItem: string | null;
  nearbyVehicle: boolean;
  isMobile: boolean;
  damageDirection: number | null;
  flashAlpha: number;
  killBanner: string | null;
  hitMarkerActive: boolean;
  hitMarkerIsKill: boolean;
  playerHitFlash: boolean;
  wpPopup: string | null;
  waveAnnounce: number | null;
  streakLabel: string | null;
  killFlashActive: boolean;
  waveFlashActive: boolean;
  engineRef: React.RefObject<GameEngine | null>;
  skinSystem: React.RefObject<SkinSystem | null>;
  fmt: (s: number) => string;
}

export function PlayingHUD({
  gameState, health, armor, weapon, weapons, activeSlot,
  zoneInfo, killFeed, grenadeType, grenadeCount, inVehicle,
  nearbyItem, nearbyVehicle, isMobile, damageDirection, flashAlpha,
  killBanner, hitMarkerActive, hitMarkerIsKill, playerHitFlash,
  wpPopup, waveAnnounce, streakLabel, killFlashActive, waveFlashActive,
  engineRef, skinSystem, fmt,
}: PlayingHUDProps) {
  return (
    <>
      {/* BLITZ COINS + WILD POINTS HUD -- hidden on mobile to save space */}
      {gameState.phase === 'playing' && skinSystem.current && (
        <div className="hidden md:flex absolute top-2 right-12 px-2 py-1 text-[10px] font-mono gap-2 border" style={{ background: '#1a1f16', borderColor: '#4a4535' }}>
          <span style={{ color: '#d4a24e', fontFamily: "'Teko', sans-serif", fontSize: '12px' }}>{skinSystem.current.purchases.blitzCoins} BC</span>
          <span style={{ color: '#4a6741', fontFamily: "'Teko', sans-serif", fontSize: '12px' }}>{skinSystem.current.purchases.blitzPoints} WP</span>
        </div>
      )}

      {/* TIME / BIOME / WEATHER HUD -- below minimap (mobile: minimap bottom ~110px, so top-[116px]) */}
      {gameState.phase === 'playing' && (
        <div className="absolute top-[116px] md:top-40 left-2 px-1.5 py-0.5 md:px-2 md:py-1 text-[8px] md:text-[10px] font-mono space-y-0.5 border rounded-sm" style={{ background: 'rgba(26,31,22,0.8)', borderColor: '#4a4535' }}>
          <div style={{ color: '#c4a35a' }}>
            {(() => {
              const period = engineRef.current?.dayNightSystem.getTimePeriod() ?? 'noon';
              const periodNames: Record<string, string> = {
                deep_night: 'MIDNIGHT', dawn: 'DAWN', morning: 'MORNING',
                noon: 'NOON', afternoon: 'AFTERNOON', dusk: 'DUSK', night: 'NIGHT',
              };
              return `${engineRef.current?.dayNightSystem.getTimeString() ?? '12:00'} ${periodNames[period] ?? 'DAY'}`;
            })()}
          </div>
          <div style={{ color: '#8a7e6b' }}>
            {engineRef.current?.biomeSystem.getBiome(
              engineRef.current?.player.state.position.x ?? 0,
              engineRef.current?.player.state.position.z ?? 0
            )?.toUpperCase() ?? 'URBAN'}
          </div>
          <div style={{ color: '#8a7e6b' }}>
            {(() => {
              const weather = engineRef.current?.weatherSystem.currentWeather;
              return (
                <>
                  {weather?.toUpperCase() ?? 'CLEAR'}
                  {weather === 'fog' && <span className="text-[8px]" style={{ color: '#c4a35a' }}> -50% detect</span>}
                  {weather === 'storm' && <span className="text-[8px]" style={{ color: '#c93a3a' }}> +30% spread</span>}
                  {weather === 'rain' && <span className="text-[8px]" style={{ color: '#c4a35a' }}> +10% spread</span>}
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
      {gameState.phase === 'playing' && !inVehicle && (() => {
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

      {/* HIT MARKER: X on kill, + on regular hit */}
      {hitMarkerActive && gameState.phase === 'playing' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {hitMarkerIsKill ? (
            <div className="text-red-500 font-black" style={{ fontSize: 28, lineHeight: 1, textShadow: '0 0 6px rgba(255,0,0,0.8)' }}>X</div>
          ) : (
            <div className="text-white font-bold opacity-80" style={{ fontSize: 20, lineHeight: 1 }}>+</div>
          )}
        </div>
      )}

      {/* PLAYER HIT RED FLASH */}
      {playerHitFlash && (
        <div className="absolute inset-0 pointer-events-none bg-red-500/20" />
      )}

      {/* WP POPUP on kill -- top-[35%] to avoid drowning at top-[40%] */}
      {wpPopup && gameState.phase === 'playing' && (
        <div className="absolute top-[35%] left-1/2 -translate-x-1/2 pointer-events-none animate-bounce">
          <span className="text-green-400 text-sm md:text-lg font-bold font-mono">{wpPopup} | Kill #{gameState.kills}</span>
        </div>
      )}

      {/* WAVE ANNOUNCE */}
      {waveAnnounce !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className="text-white font-black opacity-80 animate-pulse uppercase tracking-widest" style={{ fontSize: 60, fontFamily: "'Teko', sans-serif" }}>
            WAVE {waveAnnounce}
          </div>
        </div>
      )}

      {/* ZONE CLOSING SOON WARNING */}
      {zoneInfo.timer < 10 && !zoneInfo.isShrinking && gameState.phase === 'playing' && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 animate-pulse z-20 pointer-events-none">
          <span className="text-sm font-bold font-mono uppercase tracking-widest" style={{ color: '#c93a3a', textShadow: '0 0 8px rgba(201,58,58,0.8)' }}>
            ZONE CLOSING IN {Math.ceil(zoneInfo.timer)}s
          </span>
        </div>
      )}

      {/* KILL BANNER */}
      {killBanner && gameState.phase === 'playing' && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="px-3 py-1 md:px-4 md:py-1.5 text-center max-w-[85vw]" style={{ background: 'rgba(26,31,22,0.85)', borderLeft: '3px solid #c93a3a' }}>
            <span className="text-xs md:text-sm font-bold uppercase tracking-wider truncate" style={{ color: '#c93a3a', fontFamily: "'Teko', sans-serif" }}>ELIMINATED {killBanner}</span>
          </div>
        </div>
      )}

      {/* TOP HUD */}
      {['playing', 'dropping', 'plane'].includes(gameState.phase) && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center max-w-[95vw]">
          <div className="px-1.5 py-0.5 md:px-4 md:py-1.5 flex items-center gap-1.5 md:gap-4 text-xs font-mono border" style={{ background: 'rgba(26,31,22,0.80)', borderColor: '#4a4535' }}>
            {/* Wave indicator */}
            {gameState.phase === 'playing' && (
              <>
                <div className="text-center">
                  <div className="text-[10px] md:text-base font-bold animate-pulse" style={{ color: '#d4a24e', fontFamily: "'Teko', sans-serif" }}>
                    W{gameState.currentWave}
                  </div>
                  <div className="text-[7px] md:text-[9px] uppercase tracking-wider" style={{ color: '#8a7e6b' }}>WAVE</div>
                </div>
                <div className="w-px h-4 md:h-6" style={{ background: '#4a4535' }} />
              </>
            )}
            <div className="text-center">
              <div className="text-[10px] md:text-base font-bold" style={{ color: '#e8e0d0', fontFamily: "'Teko', sans-serif" }}>{gameState.playersAlive}</div>
              <div className="text-[7px] md:text-[9px] uppercase tracking-wider" style={{ color: '#8a7e6b' }}>ALIVE</div>
            </div>
            <div className="w-px h-4 md:h-6" style={{ background: '#4a4535' }} />
            <div className="text-center">
              <div className="text-[10px] md:text-base font-bold" style={{ color: '#d4a24e', fontFamily: "'Teko', sans-serif" }}>{gameState.kills}</div>
              <div className="text-[7px] md:text-[9px] uppercase tracking-wider" style={{ color: '#8a7e6b' }}>KILLS</div>
            </div>
            <div className="w-px h-4 md:h-6" style={{ background: '#4a4535' }} />
            <div className="text-center">
              <div className={`text-[10px] md:text-base font-bold ${zoneInfo.isShrinking ? 'animate-pulse' : ''}`} style={{ color: zoneInfo.isShrinking ? '#c93a3a' : '#c4a35a', fontFamily: "'Teko', sans-serif" }}>
                {fmt(zoneInfo.timer)}
              </div>
              <div className="text-[7px] md:text-[9px] uppercase tracking-wider" style={{ color: '#8a7e6b' }}>ZONE {zoneInfo.phase}</div>
            </div>
          </div>
        </div>
      )}

      {/* BOSS HP BAR -- mobile: top-[48px] clears top HUD (~40px tall), PC: top-16 */}
      {gameState.phase === 'playing' && engineRef.current?.bossSystem.getActiveBosses().map(boss => (
        <div key={boss.id} className="absolute top-[48px] md:top-16 left-1/2 -translate-x-1/2 w-44 md:w-64">
          <div className="text-center text-[10px] md:text-xs font-bold font-mono mb-0.5 uppercase tracking-wider" style={{ color: '#c93a3a', fontFamily: "'Teko', sans-serif", fontSize: '12px' }}>
            {boss.name} (P{boss.phase})
          </div>
          <div className="w-full h-2.5 md:h-3 border" style={{ background: '#1a1f16', borderColor: '#c93a3a' }}>
            <div className="h-full transition-all"
              style={{
                width: `${(boss.health / boss.maxHealth) * 100}%`,
                backgroundColor: boss.phase === 3 ? '#c93a3a' : boss.phase === 2 ? '#d4a24e' : '#c93a3a',
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
        const poiColors: Record<string, string> = { military: '#c93a3a', temple: '#d4a24e', gas_station: '#c4a35a' };
        return (
          <div className="absolute top-[76px] md:top-20 left-1/2 -translate-x-1/2">
            <span className="text-[10px] md:text-xs font-mono font-bold uppercase tracking-wider" style={{ color: poiColors[poi.type] ?? '#c4a35a', fontFamily: "'Teko', sans-serif" }}>{names[poi.type]}</span>
          </div>
        );
      })()}

      {/* KILL FEED -- mobile: top-[48px] to clear top HUD, right-1 narrower margin */}
      {killFeed.length > 0 && (
        <div className="absolute top-[48px] md:top-14 right-1 md:right-2 flex flex-col gap-0.5 z-5">
          {(() => {
            const myName = typeof localStorage !== 'undefined' ? localStorage.getItem('blitzpit_name') || 'You' : 'You';
            const feedSlice = isMobile ? killFeed.slice(-3) : killFeed;
            return feedSlice.map((k, i) => {
              const isMyKill = k.killer === myName || k.killer === 'You';
              const isMyDeath = k.victim === myName || k.victim === 'You';
              return (
                <div key={`${k.time}_${i}`} className="px-1.5 py-0.5 md:px-2.5 md:py-1 text-[9px] md:text-[11px] font-mono flex gap-1 md:gap-1.5 max-w-[45vw] md:max-w-none" style={{ background: isMyKill ? 'rgba(74,103,65,0.5)' : 'rgba(26,31,22,0.7)', borderLeft: isMyKill ? '2px solid #d4a24e' : '2px solid #4a4535' }}>
                  <span className="font-bold truncate" style={{ color: isMyKill ? '#d4a24e' : '#c4a35a' }}>{k.killer}</span>
                  <span className="hidden md:inline" style={{ color: '#8a7e6b' }}>[{k.weapon}]</span>
                  <span className="font-bold truncate" style={{ color: isMyDeath ? '#c93a3a' : '#e8e0d0' }}>{k.victim}</span>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* BOTTOM - HP + ARMOR
          Mobile: centered at bottom-1 (compact, below weapon info at bottom-8)
          PC: left-3 bottom-4
      */}
      {['playing', 'dead'].includes(gameState.phase) && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 md:bottom-4 md:left-3 md:translate-x-0 flex flex-col gap-0.5 md:gap-1 z-10">
          <div className="flex items-center gap-1">
            <span className="text-[9px] md:text-[10px] font-bold w-4 md:w-5" style={{ color: '#c4a35a', fontFamily: "'Teko', sans-serif" }}>HP</span>
            <div className="w-20 md:w-48 h-2.5 md:h-3.5 overflow-hidden rounded-sm" style={{ background: 'rgba(26,31,22,0.8)', border: '1px solid #4a4535' }}>
              <div className="h-full transition-all duration-200" style={{
                width: `${health}%`,
                backgroundColor: health > 60 ? '#4a6741' : health > 30 ? '#d4a24e' : '#c93a3a',
              }} />
            </div>
            <span className="text-[10px] font-bold w-6" style={{ color: '#d4a24e', fontFamily: "'Teko', sans-serif", fontSize: '13px' }}>{Math.ceil(health)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] md:text-[10px] font-bold w-4 md:w-5" style={{ color: '#8a7e6b', fontFamily: "'Teko', sans-serif" }}>AR</span>
            <div className="w-20 md:w-48 h-2 md:h-3 overflow-hidden rounded-sm" style={{ background: 'rgba(26,31,22,0.8)', border: '1px solid #4a4535' }}>
              <div className="h-full transition-all duration-200" style={{ width: `${armor}%`, backgroundColor: '#c4a35a' }} />
            </div>
            <span className="text-[10px] font-bold w-6" style={{ color: '#c4a35a', fontFamily: "'Teko', sans-serif", fontSize: '13px' }}>{Math.ceil(armor)}</span>
          </div>
        </div>
      )}

      {/* BOTTOM - WEAPONS
          Mobile: centered, above HP bar (bottom-10), compact 1-line
          PC: bottom-4 right-3, full display
      */}
      {gameState.phase === 'playing' && (
        <>
          {/* Mobile weapon info: 1 line, centered, above HP bar (HP ~30px tall at bottom-1 = ~34px, so weapon at bottom-[36px]) */}
          <div className="md:hidden absolute bottom-[36px] left-1/2 -translate-x-1/2 z-10">
            <div className="flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-mono rounded-sm" style={{ background: 'rgba(26,31,22,0.85)', border: '1px solid #4a4535' }}>
              <span className="font-bold" style={{ color: '#d4a24e', fontFamily: "'Teko', sans-serif" }}>
                {weapon?.def.name ?? 'Empty'}
              </span>
              {weapon && (
                <span style={{ color: '#8a7e6b' }}>
                  {weapon.isReloading ? 'RELOADING...' : `${weapon.currentAmmo}/${weapon.reserveAmmo}`}
                </span>
              )}
            </div>
          </div>

          {/* PC weapon info: full display bottom-right */}
          <div className="hidden md:flex absolute bottom-4 right-3 flex-col items-end gap-1 z-10">
            <div className="flex gap-1">
              {weapons.map((w, i) => {
                return (
                  <div key={i} className="px-3 py-1.5 border text-[11px] font-mono transition-all" style={{
                    background: i === activeSlot ? 'rgba(74,103,65,0.5)' : '#1a1f16',
                    borderColor: i === activeSlot ? '#d4a24e' : '#4a4535',
                    color: i === activeSlot ? '#d4a24e' : '#8a7e6b',
                    transform: i === activeSlot ? 'scale(1.05)' : 'scale(1)',
                  }}>
                    <div className="text-[8px]" style={{ color: '#8a7e6b' }}>{i + 1}</div>
                    {w ? w.def.name : 'Empty'}
                  </div>
                );
              })}
            </div>
            {weapon && (
              <div className="flex items-center gap-2 px-2 py-0.5" style={{ background: 'rgba(26,31,22,0.85)' }}>
                {weapon.isReloading ? (
                  <span className="text-xs font-mono animate-pulse uppercase tracking-wider" style={{ color: '#d4a24e' }}>RELOADING</span>
                ) : (
                  <>
                    <span className="text-xl font-bold" style={{ color: '#d4a24e', fontFamily: "'Teko', sans-serif" }}>{weapon.currentAmmo}</span>
                    <span className="text-xs font-mono" style={{ color: '#8a7e6b' }}>/ {weapon.reserveAmmo}</span>
                  </>
                )}
              </div>
            )}
            {/* Grenade indicator -- PC only */}
            <div className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono" style={{ background: 'rgba(26,31,22,0.7)' }}>
              <span style={{ color: '#4a6741' }}>{GRENADES[grenadeType]?.name || 'Frag'}</span>
              <span style={{ color: '#8a7e6b' }}>x{grenadeCount[grenadeType] || 0}</span>
              <span className="ml-1" style={{ color: '#4a4535' }}>RMB throw</span>
            </div>
          </div>
        </>
      )}

      {/* WATER OVERLAY */}
      {engineRef.current?.player.state.isSwimming && gameState.phase === 'playing' && (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(30,80,180,0.18)' }} />
      )}

      {/* SWIMMING INDICATOR */}
      {engineRef.current?.player.state.isSwimming && gameState.phase === 'playing' && (
        <div className="absolute bottom-20 md:bottom-40 left-1/2 -translate-x-1/2 px-2 py-0.5 md:px-3 md:py-1 text-[9px] md:text-xs font-mono border rounded-sm z-20" style={{ background: 'rgba(26,31,22,0.85)', borderColor: '#4a6741', color: '#c4a35a' }}>
          <span className="md:hidden">SWIMMING | SPACE up</span>
          <span className="hidden md:inline">SWIMMING -- Speed reduced | SPACE to surface</span>
        </div>
      )}

      {/* DROWNING WARNING -- top-[40%] to avoid overlap with kill banner at top-1/3 */}
      {(engineRef.current?.player.swimTimer ?? 0) > 10 && gameState.phase === 'playing' && (
        <div className="absolute top-[40%] left-1/2 -translate-x-1/2 px-3 py-1 md:px-4 md:py-2 animate-pulse z-20" style={{ background: 'rgba(201,58,58,0.3)', border: '1px solid #c93a3a' }}>
          <span className="text-xs md:text-sm font-bold uppercase tracking-wider" style={{ color: '#c93a3a', fontFamily: "'Teko', sans-serif" }}>DROWNING!</span>
        </div>
      )}

      {/* NEARBY PROMPTS */}
      {nearbyItem && gameState.phase === 'playing' && !isMobile && (
        <div className="absolute bottom-[45%] left-1/2 -translate-x-1/2 z-20 animate-bounce">
          <div className="px-4 py-2 rounded-lg text-center border-2" style={{ background: 'rgba(212,162,78,0.92)', borderColor: '#d4a24e', boxShadow: '0 0 16px rgba(212,162,78,0.6)' }}>
            <span className="text-base font-bold font-mono uppercase" style={{ color: '#1a1f16', fontFamily: "'Teko', sans-serif", fontSize: '18px' }}>[F] {nearbyItem}</span>
          </div>
        </div>
      )}
      {nearbyVehicle && !inVehicle && gameState.phase === 'playing' && !isMobile && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 px-3 py-1.5 border rounded-sm" style={{ background: 'rgba(26,31,22,0.85)', borderColor: '#4a6741' }}>
          <span className="text-xs font-mono uppercase" style={{ color: '#c4a35a' }}>[E] Enter Vehicle</span>
        </div>
      )}
      {inVehicle && (
        <div className="absolute bottom-20 md:bottom-28 left-1/2 -translate-x-1/2 px-3 py-1.5 md:px-5 md:py-2.5 border rounded-sm flex gap-3 md:gap-5 items-center z-20" style={{ background: 'rgba(26,31,22,0.90)', borderColor: '#4a4535' }}>
          <span className="text-[10px] md:text-xs font-mono font-bold" style={{ color: '#c4a35a' }}>[E] Exit</span>
          <div className="text-center">
            <div className="text-sm md:text-lg font-bold" style={{ color: '#d4a24e', fontFamily: "'Teko', sans-serif" }}>
              {Math.round(Math.abs(engineRef.current?.vehicleSystem.playerVehicle?.speed ?? 0) * 3.6)}
            </div>
            <div className="text-[7px] md:text-[8px] font-mono uppercase tracking-wider" style={{ color: '#8a7e6b' }}>KM/H</div>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-10 md:w-16 h-1.5 md:h-2 overflow-hidden" style={{ background: '#4a4535' }}>
              <div className="h-full transition-all"
                style={{
                  width: `${engineRef.current?.vehicleSystem.playerVehicle?.fuel ?? 0}%`,
                  backgroundColor: (engineRef.current?.vehicleSystem.playerVehicle?.fuel ?? 0) < 20 ? '#c93a3a' : '#4a6741',
                }}
              />
            </div>
            {(engineRef.current?.vehicleSystem.playerVehicle?.fuel ?? 100) < 20 && (
              <span className="text-[9px] font-bold font-mono animate-pulse" style={{ color: '#c93a3a' }}>LOW FUEL</span>
            )}
          </div>
          <span className="text-xs md:text-sm font-bold" style={{ color: '#d4a24e', fontFamily: "'Teko', sans-serif" }}>
            G{engineRef.current?.vehicleSystem.playerVehicle
              ? engineRef.current.vehicleSystem.getGear(engineRef.current.vehicleSystem.playerVehicle)
              : 0}
          </span>
          {engineRef.current?.vehicleSystem.playerVehicle?.type === 'helicopter' && (
            <span className="text-cyan-400 text-xs font-mono">
              ALT {Math.round(engineRef.current.vehicleSystem.playerVehicle.position.y)}m
            </span>
          )}
        </div>
      )}

      {/* KILL STREAK NOTIFICATION -- top-[20%] to clear boss HP and avoid kill banner overlap */}
      {streakLabel && (
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 animate-bounce pointer-events-none z-20">
          <div className="text-xl md:text-5xl font-black text-center tracking-[0.2em] uppercase" style={{ color: '#d4a24e', fontFamily: "'Teko', sans-serif", filter: 'drop-shadow(0 0 12px rgba(212,162,78,0.5))' }}>
            {streakLabel}
          </div>
        </div>
      )}

      {/* DAMAGE DIRECTION INDICATOR */}
      {damageDirection !== null && gameState.phase === 'playing' && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-16 h-16 rounded-full"
            style={{
              left: `${50 + Math.sin(damageDirection) * 40}%`,
              top: `${50 - Math.cos(damageDirection) * 40}%`,
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle, rgba(255,0,0,0.6) 0%, transparent 70%)',
            }}
          />
        </div>
      )}

      {/* ZONE OUTSIDE VIGNETTE */}
      {gameState.phase === 'playing' && engineRef.current &&
        !engineRef.current.zoneSystem.isInsideZone(engineRef.current.player.state.position) && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,68,255,0.35) 100%)',
        }} />
      )}

      {/* DAMAGE VIGNETTE */}
      {health < 60 && ['playing', 'dead'].includes(gameState.phase) && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse at center, transparent 30%, rgba(255,0,0,${Math.min(0.75, (60 - health) / 70)}) 100%)`,
        }} />
      )}

      {/* FLASH EFFECT (grenade) */}
      {flashAlpha > 0 && (
        <div className="absolute inset-0 pointer-events-none bg-white" style={{ opacity: Math.min(1, flashAlpha) }} />
      )}

      {/* KILL EDGE FLASH */}
      {killFlashActive && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at center, transparent 60%, rgba(234,179,8,0.35) 100%)',
        }} />
      )}

      {/* WAVE START EDGE FLASH */}
      {waveFlashActive && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(59,130,246,0.4) 100%)',
        }} />
      )}
    </>
  );
}
