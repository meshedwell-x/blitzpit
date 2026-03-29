import { useRef, useState, useCallback } from 'react';
import { GameEngine } from '../game/core/GameEngine';

export function MobileControls({ engine, nearbyItem }: { engine: GameEngine | null; nearbyItem: string | null }) {
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

      {/* PICKUP (F) - only shown when nearby item exists */}
      {nearbyItem && (
        <button
          className="absolute left-1/2 -translate-x-1/2 bottom-44 px-4 py-2 bg-yellow-500/80 rounded active:bg-yellow-400"
          onTouchStart={() => {
            const ev = new KeyboardEvent('keydown', { code: 'KeyF' });
            document.dispatchEvent(ev);
          }}
        >
          <span className="text-black text-xs font-bold">PICK UP</span>
        </button>
      )}

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
