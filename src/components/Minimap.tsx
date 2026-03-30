'use client';
import { useRef, useEffect } from 'react';
import { GameEngine } from '../game/core/GameEngine';
import { WORLD_SIZE } from '../game/core/constants';

export function Minimap({ engine }: { engine: GameEngine | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!engine || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = 200;
    canvas.width = size;
    canvas.height = size;

    let rafId: number;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      // Darker but slightly lighter base for better contrast
      ctx.fillStyle = 'rgba(20,24,16,0.95)';
      ctx.fillRect(0, 0, size, size);

      // Subtle grid overlay for military map feel
      ctx.strokeStyle = 'rgba(196,163,90,0.08)';
      ctx.lineWidth = 0.5;
      for (let g = 0; g < size; g += 25) {
        ctx.beginPath();
        ctx.moveTo(g, 0);
        ctx.lineTo(g, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, g);
        ctx.lineTo(size, g);
        ctx.stroke();
      }

      const scale = size / WORLD_SIZE;
      const ox = size / 2;
      const oz = size / 2;

      // Buildings (khaki rects — brighter for visibility)
      ctx.fillStyle = 'rgba(196,163,90,0.6)';
      for (const b of engine.world.getBuildings()) {
        const bx = b.x * scale + ox;
        const bz = b.z * scale + oz;
        ctx.fillRect(bx, bz, b.width * scale, b.depth * scale);
      }

      // POI markers (larger for mobile touch)
      if (engine.world.poiLocations) {
        for (const poi of engine.world.poiLocations) {
          const px = poi.x * scale + ox;
          const pz = poi.z * scale + oz;
          if (poi.type === 'military') {
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(px - 4, pz - 4, 8, 8);
            ctx.strokeStyle = 'rgba(255,68,68,0.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(px - 4, pz - 4, 8, 8);
          } else if (poi.type === 'temple') {
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.moveTo(px, pz - 5);
            ctx.lineTo(px + 4, pz + 3);
            ctx.lineTo(px - 4, pz + 3);
            ctx.closePath();
            ctx.fill();
          } else if (poi.type === 'gas_station') {
            ctx.fillStyle = '#00bbff';
            ctx.fillRect(px - 3, pz - 3, 6, 6);
          }
        }
      }

      // Zone — blue tinted outside, clear inside
      const zr = engine.zoneSystem.currentRadius * scale;
      const cx = engine.zoneSystem.center.x * scale + ox;
      const cy = engine.zoneSystem.center.y * scale + oz;

      ctx.save();
      ctx.fillStyle = 'rgba(0,60,220,0.30)';
      ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx, cy, zr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Zone circle stroke — bright amber, thick
      ctx.strokeStyle = '#d4a24e';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, zr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Vehicles (colored squares by occupant)
      for (const v of engine.vehicleSystem.vehicles) {
        if (v.health <= 0) continue;
        const vx = v.position.x * scale + ox;
        const vz = v.position.z * scale + oz;
        // Bot-occupied = red, player-occupied = green, empty = blue
        ctx.fillStyle =
          v.isOccupied && v.occupantId !== 'player' ? '#ff4444' :
          v.isOccupied ? '#44ff44' : '#2266aa';
        ctx.fillRect(vx - 3, vz - 3, 6, 6);
      }

      // Nearby bots (red — larger dots)
      const pp = engine.player.state.position;
      for (const bot of engine.botSystem.bots) {
        if (bot.isDead) continue;
        const dist = Math.sqrt((bot.position.x - pp.x) ** 2 + (bot.position.z - pp.z) ** 2);
        if (dist < 150) {
          const bx = bot.position.x * scale + ox;
          const bz = bot.position.z * scale + oz;
          ctx.fillStyle = '#ff4444';
          ctx.beginPath();
          ctx.arc(bx, bz, 2.5, 0, Math.PI * 2);
          ctx.fill();
          // Glow ring for close enemies
          if (dist < 50) {
            ctx.strokeStyle = 'rgba(255,68,68,0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(bx, bz, 4, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      // Animals (green dots, orange if aggressive)
      if (engine.animalSystem) {
        for (const animal of engine.animalSystem.animals) {
          if (animal.state === 'dead') continue;
          const dist = Math.sqrt((animal.position.x - pp.x) ** 2 + (animal.position.z - pp.z) ** 2);
          if (dist < 200) {
            const ax = animal.position.x * scale + ox;
            const az = animal.position.z * scale + oz;
            ctx.fillStyle = animal.aggressive ? '#ff7722' : '#22cc55';
            ctx.beginPath();
            ctx.arc(ax, az, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Player (bright white, larger)
      const px = pp.x * scale + ox;
      const pz = pp.z * scale + oz;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, pz, 4, 0, Math.PI * 2);
      ctx.fill();
      // Player glow
      ctx.strokeStyle = 'rgba(212,162,78,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, pz, 6, 0, Math.PI * 2);
      ctx.stroke();

      // Direction line
      const dir = engine.player.getForwardDirection();
      ctx.strokeStyle = '#d4a24e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, pz);
      ctx.lineTo(px + dir.x * 12, pz + dir.z * 12);
      ctx.stroke();

      // Outer border — double-line military style
      ctx.strokeStyle = '#d4a24e';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, size - 2, size - 2);
      ctx.strokeStyle = 'rgba(74,69,53,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(4, 4, size - 8, size - 8);

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [engine]);

  return (
    <div className="absolute top-10 left-2 z-10">
      <canvas
        ref={canvasRef}
        className="w-[110px] h-[110px] md:w-[170px] md:h-[170px]"
        style={{
          border: '2px solid #d4a24e',
          boxShadow: '0 0 8px rgba(0,0,0,0.6), inset 0 0 4px rgba(0,0,0,0.4)',
        }}
      />
      {/* Compass label */}
      <div
        className="absolute -top-0.5 left-1/2 -translate-x-1/2 px-1 text-[7px] font-bold tracking-widest"
        style={{ color: '#d4a24e', fontFamily: "'Teko', sans-serif", background: 'rgba(20,24,16,0.9)' }}
      >
        N
      </div>
    </div>
  );
}
