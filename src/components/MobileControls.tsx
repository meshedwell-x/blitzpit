'use client';
import { useRef, useState, useCallback } from 'react';
import { GameEngine } from '../game/core/GameEngine';

export function MobileControls({ engine, nearbyItem, onToggleInventory }: { engine: GameEngine | null; nearbyItem: string | null; onToggleInventory?: () => void }) {
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

  /* ── shared button style helpers ── */
  const teko = "'Teko', sans-serif";
  const btnBase = 'flex items-center justify-center active:scale-95 transition-transform';

  // Safe-area-aware left/right offsets for landscape notch
  const safeLeft = 'max(1rem, calc(1rem + env(safe-area-inset-left)))';
  const safeRight = 'max(1rem, calc(1rem + env(safe-area-inset-right)))';
  const safeRightAim = 'max(5.5rem, calc(5.5rem + env(safe-area-inset-right)))';
  const safeRightSecond = 'max(5rem, calc(5rem + env(safe-area-inset-right)))';

  return (
    <>
      {/* BAG — inventory button, top-left next to minimap */}
      <button
        className="absolute top-2 z-20 w-8 h-8 flex items-center justify-center rounded"
        style={{
          left: 'max(90px, calc(90px + env(safe-area-inset-left)))',
          background: 'rgba(0,0,0,0.6)',
          border: '1px solid rgba(138,126,107,0.5)',
          fontFamily: "'Teko', sans-serif",
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          if (onToggleInventory) {
            onToggleInventory();
          } else {
            const ev = new KeyboardEvent('keydown', { code: 'Tab', bubbles: true });
            document.dispatchEvent(ev);
          }
        }}
      >
        <span className="text-white text-[9px] font-mono">BAG</span>
      </button>

      {/* ═══ LEFT — Movement Joystick ═══
          Position: bottom-6, safe-left. 120x120.
          Safe area insets applied for notch/home bar in landscape mode.
          Clear of minimap (top-10 left-2, ~100px tall on mobile).
          Clear of grenade row (bottom-[168px]).
      */}
      <div
        ref={joyRef}
        className={`absolute bottom-6 w-[120px] h-[120px] rounded-sm ${btnBase}`}
        style={{
          left: safeLeft,
          background: 'rgba(74,103,65,0.18)',
          border: '2px solid rgba(212,162,78,0.35)',
          boxShadow: 'inset 0 0 12px rgba(0,0,0,0.3)',
        }}
        onTouchStart={handleJoyStart}
        onTouchMove={handleJoyMove}
        onTouchEnd={handleJoyEnd}
      >
        {/* Joystick thumb */}
        <div
          className="absolute w-12 h-12 rounded-sm -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${50 + joyDelta.x * 35}%`,
            top: `${50 + joyDelta.y * 35}%`,
            background: 'rgba(212,162,78,0.45)',
            border: '1.5px solid rgba(212,162,78,0.7)',
            boxShadow: '0 0 6px rgba(212,162,78,0.3)',
          }}
        />
        {/* Center crosshair lines */}
        <div className="absolute w-px h-full left-1/2 -translate-x-1/2" style={{ background: 'rgba(212,162,78,0.12)' }} />
        <div className="absolute h-px w-full top-1/2 -translate-y-1/2" style={{ background: 'rgba(212,162,78,0.12)' }} />
      </div>

      {/* SPRINT (hold) — above joystick
          bottom-[136px]: joystick top = bottom-6 + 120px = bottom-[126px] → sprint clears at bottom-[136px]+44px=bottom-[180px] OK.
          Actually joystick base: bottom-6=24px, height 120px → top edge at 144px from bottom.
          Sprint: bottom-[148px] h-[44px] → occupies 148..192px from bottom. Clears joystick.
      */}
      <button
        className={`absolute bottom-[148px] w-[56px] h-[44px] rounded-sm ${btnBase}`}
        style={{
          left: safeLeft,
          background: 'rgba(74,103,65,0.35)',
          border: '1px solid rgba(196,163,90,0.4)',
          fontFamily: teko,
        }}
        onTouchStart={() => engine?.player.setSprint(true)}
        onTouchEnd={() => engine?.player.setSprint(false)}
      >
        <span className="text-[11px] font-bold tracking-wider" style={{ color: '#c4a35a' }}>RUN</span>
      </button>

      {/* GRN — above sprint, left side
          bottom-[200px]: above sprint (192px top) with 8px gap.
      */}
      <button
        className={`absolute bottom-[200px] w-[56px] h-[48px] rounded-sm ${btnBase}`}
        style={{
          left: safeLeft,
          background: 'rgba(74,103,65,0.4)',
          border: '1px solid rgba(74,103,65,0.6)',
          fontFamily: teko,
        }}
        onTouchStart={() => engine?.throwGrenadeAction()}
      >
        <span className="text-[10px] font-bold tracking-wide" style={{ color: '#8fbc5a' }}>GRN</span>
      </button>

      {/* ═══ RIGHT — Aim zone (invisible drag area) ═══
          Covers right half, bottom 60%. Does NOT block buttons (buttons have higher z). */}
      <div
        ref={aimRef}
        className="absolute bottom-0 right-0 w-1/2 h-[60%] opacity-0 z-0"
        onTouchStart={handleAimStart}
        onTouchMove={handleAimMove}
        onTouchEnd={handleAimEnd}
      />

      {/* ═══ RIGHT — FIRE button ═══
          Primary action. 72x72 (>44px touch target). bottom-8, safe-right.
          Safe area inset for notch/home bar in landscape.
      */}
      <button
        className={`absolute bottom-8 w-[72px] h-[72px] rounded-sm z-10 ${btnBase}`}
        style={{
          right: safeRight,
          background: 'rgba(201,58,58,0.7)',
          border: '2px solid rgba(201,58,58,0.9)',
          boxShadow: '0 0 10px rgba(201,58,58,0.3), inset 0 0 8px rgba(0,0,0,0.3)',
          fontFamily: teko,
        }}
        onTouchStart={() => engine?.fireWeapon()}
        onTouchEnd={() => engine?.stopFire()}
      >
        <span className="text-[15px] font-bold tracking-widest" style={{ color: '#e8e0d0' }}>FIRE</span>
      </button>

      {/* AIM/SCOPE — left of FIRE */}
      <button
        className={`absolute bottom-8 w-[56px] h-[56px] rounded-sm z-10 ${btnBase}`}
        style={{
          right: safeRightAim,
          background: 'rgba(74,103,65,0.35)',
          border: '1.5px solid rgba(196,163,90,0.5)',
          fontFamily: teko,
        }}
        onTouchStart={() => {}}
      >
        <span className="text-[12px] font-bold tracking-wider" style={{ color: '#c4a35a' }}>AIM</span>
      </button>

      {/* ═══ RIGHT UPPER — JUMP, CROUCH, RELOAD, SWAP ═══
          Layout (screen height ~400px in landscape):
          FIRE:  bottom-8  (32px)  → occupies 32..104px from bottom
          JUMP:  bottom-[112px]    → occupies 112..160px from bottom (8px gap above FIRE)
          CRCH:  bottom-[112px]    → same row as JUMP, left of JUMP
          RLD:   bottom-[168px]    → occupies 168..212px from bottom (8px gap above JUMP)
          SWAP:  bottom-[168px]    → same row as RLD, left of RLD
          No overlap guaranteed.
      */}
      <button
        className={`absolute bottom-[112px] w-[56px] h-[48px] rounded-sm z-10 ${btnBase}`}
        style={{
          right: safeRight,
          background: 'rgba(74,103,65,0.3)',
          border: '1px solid rgba(196,163,90,0.4)',
          fontFamily: teko,
        }}
        onTouchStart={() => engine?.player.triggerJump()}
      >
        <span className="text-[11px] font-bold tracking-wider" style={{ color: '#d4a24e' }}>JUMP</span>
      </button>

      <button
        className={`absolute bottom-[112px] w-[56px] h-[48px] rounded-sm z-10 ${btnBase}`}
        style={{
          right: safeRightSecond,
          background: 'rgba(74,103,65,0.3)',
          border: '1px solid rgba(196,163,90,0.4)',
          fontFamily: teko,
        }}
        onTouchStart={() => engine?.player.toggleCrouch()}
      >
        <span className="text-[11px] font-bold tracking-wider" style={{ color: '#d4a24e' }}>CRCH</span>
      </button>

      <button
        className={`absolute bottom-[168px] w-[56px] h-[44px] rounded-sm z-10 ${btnBase}`}
        style={{
          right: safeRight,
          background: 'rgba(212,162,78,0.2)',
          border: '1px solid rgba(212,162,78,0.45)',
          fontFamily: teko,
        }}
        onTouchStart={() => {
          const ev = new KeyboardEvent('keydown', { code: 'KeyR' });
          document.dispatchEvent(ev);
        }}
      >
        <span className="text-[11px] font-bold tracking-wider" style={{ color: '#d4a24e' }}>RLD</span>
      </button>

      {/* Weapon slot switch — left of RELOAD */}
      <button
        className={`absolute bottom-[168px] w-[56px] h-[44px] rounded-sm z-10 ${btnBase}`}
        style={{
          right: safeRightSecond,
          background: 'rgba(138,126,107,0.2)',
          border: '1px solid rgba(138,126,107,0.4)',
          fontFamily: teko,
        }}
        onTouchStart={() => {
          if (!engine) return;
          engine.weaponSystem.activeSlot = engine.weaponSystem.activeSlot === 0 ? 1 : 0;
        }}
      >
        <span className="text-[10px] font-bold tracking-wider" style={{ color: '#8a7e6b' }}>SWAP</span>
      </button>

      {/* ═══ PICKUP — center bottom, above controls ═══ */}
      {nearbyItem && (
        <button
          className={`absolute left-1/2 -translate-x-1/2 bottom-[200px] px-4 py-2 rounded-sm z-20 ${btnBase}`}
          style={{
            background: 'rgba(212,162,78,0.75)',
            border: '1.5px solid #d4a24e',
            fontFamily: teko,
          }}
          onTouchStart={() => {
            const ev = new KeyboardEvent('keydown', { code: 'KeyF' });
            document.dispatchEvent(ev);
          }}
        >
          <span className="text-[12px] font-bold tracking-wider" style={{ color: '#1a1f16' }}>PICK UP</span>
        </button>
      )}
    </>
  );
}
