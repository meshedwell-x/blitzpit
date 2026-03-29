'use client';
import { useRef, useEffect } from 'react';
import { GameEngine } from '../game/core/GameEngine';

export function Minimap({ engine }: { engine: GameEngine | null }) {
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
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, size, size);

      const scale = size / 800;
      const ox = size / 2;
      const oz = size / 2;

      // Buildings (gray rects)
      ctx.fillStyle = 'rgba(120,120,120,0.5)';
      for (const b of engine.world.getBuildings()) {
        const bx = b.x * scale + ox;
        const bz = b.z * scale + oz;
        ctx.fillRect(bx, bz, b.width * scale, b.depth * scale);
      }

      // POI markers
      if (engine.world.poiLocations) {
        for (const poi of engine.world.poiLocations) {
          const px = poi.x * scale + ox;
          const pz = poi.z * scale + oz;
          if (poi.type === 'military') {
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(px - 3, pz - 3, 6, 6);
          } else if (poi.type === 'temple') {
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.moveTo(px, pz - 4);
            ctx.lineTo(px + 3, pz + 2);
            ctx.lineTo(px - 3, pz + 2);
            ctx.closePath();
            ctx.fill();
          } else if (poi.type === 'gas_station') {
            ctx.fillStyle = '#00aaff';
            ctx.fillRect(px - 2, pz - 2, 4, 4);
          }
        }
      }

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

      // Animals (green dots, orange if aggressive)
      if (engine.animalSystem) {
        for (const animal of engine.animalSystem.animals) {
          if (animal.state === 'dead') continue;
          const dist = Math.sqrt((animal.position.x - pp.x) ** 2 + (animal.position.z - pp.z) ** 2);
          if (dist < 80) {
            const ax = animal.position.x * scale + ox;
            const az = animal.position.z * scale + oz;
            ctx.fillStyle = animal.aggressive ? '#ff6600' : '#00cc44';
            ctx.beginPath();
            ctx.arc(ax, az, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
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
      <canvas ref={canvasRef} className="rounded-lg border border-gray-600/50 shadow-lg" style={{ width: 130, height: 130 }} />
    </div>
  );
}
