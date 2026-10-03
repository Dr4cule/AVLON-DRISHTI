import { Random } from '../../sim-core/prng';
import type { MapContact, Scenario } from '../../sim-core/types';

export const CONTACT_COLORS = { unknown: '#e7bb75', hostile: '#f07e6e', friendly: '#76c6d0', benign: '#a9b8a7' };
export interface MapTransform { cx: number; cy: number; scale: number }
export function mapTransform(width: number, height: number, zoom: number): MapTransform {
  return { cx: width * 0.5, cy: height * 0.5, scale: Math.min(width, height) / 9000 * zoom };
}

export function paintTerrain(ctx: CanvasRenderingContext2D, width: number, height: number, seed: number, terrain: Scenario['environment']['terrain'], zoom: number, contours = true): void {
  const random = new Random(seed);
  const { cx, cy, scale } = mapTransform(width, height, zoom);
  ctx.fillStyle = '#141e1c'; ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(cx, cy, 30, cx, cy, width * 0.75);
  glow.addColorStop(0, '#253026'); glow.addColorStop(0.55, '#1a2721'); glow.addColorStop(1, '#111b1a');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);

  // The map is generated locally. These are fictional contours, roads, and buildings.
  if (contours) {
    for (let hill = 0; hill < 15; hill++) {
      const hx = random.between(-0.1, 1.1) * width, hy = random.between(-0.1, 1.1) * height;
      const stretch = random.between(0.7, 2.2), phase = random.between(0, 6.28);
      for (let ring = 1; ring < 18; ring++) {
        const radius = ring * (terrain === 'mountain' ? 10 : 13) * zoom;
        ctx.beginPath();
        for (let j = 0; j <= 90; j++) {
          const angle = j / 90 * Math.PI * 2;
          const ripple = 1 + Math.sin(angle * 3 + phase) * 0.17 + Math.sin(angle * 5 + phase * 2) * 0.08;
          const x = hx + Math.cos(angle) * radius * stretch * ripple;
          const y = hy + Math.sin(angle) * radius * 0.7 * ripple;
          if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = ring % 5 === 0 ? 'rgba(144,162,124,0.12)' : 'rgba(139,157,124,0.058)';
        ctx.lineWidth = ring % 5 === 0 ? 1 : 0.65; ctx.stroke();
      }
    }
    // River and service road.
    ctx.beginPath(); ctx.moveTo(width * 0.02, -20);
    ctx.bezierCurveTo(width * 0.45, height * 0.15, width * 0.07, height * 0.4, width * 0.2, height * 0.62);
    ctx.bezierCurveTo(width * 0.3, height * 0.85, width * 0.04, height * 0.95, width * 0.1, height + 20);
    ctx.strokeStyle = '#182b2b'; ctx.lineWidth = 15; ctx.stroke();
    ctx.strokeStyle = '#2a3d38'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, height * 0.82);
    ctx.bezierCurveTo(width * 0.32, height * 0.75, width * 0.49, height * 0.36, width * 1.05, height * 0.33);
    ctx.strokeStyle = 'rgba(159,154,115,0.12)'; ctx.lineWidth = 7; ctx.stroke();
    ctx.strokeStyle = 'rgba(162,158,126,0.27)'; ctx.lineWidth = 1; ctx.setLineDash([4, 7]); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < (terrain === 'urban' ? 85 : 25); i++) {
      const x = width * 0.66 + random.between(-65, 170) * zoom;
      const y = height * 0.69 + random.between(-55, 70) * zoom;
      const bw = random.between(6, 20) * zoom, bh = random.between(5, 14) * zoom;
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.18);
      ctx.fillStyle = 'rgba(135,147,116,0.09)'; ctx.fillRect(0, 0, bw, bh);
      ctx.strokeStyle = 'rgba(149,156,127,0.19)'; ctx.lineWidth = 0.6; ctx.strokeRect(0, 0, bw, bh); ctx.restore();
    }
  }

  const step = 1000 * scale;
  ctx.strokeStyle = 'rgba(173,185,158,0.08)'; ctx.lineWidth = 0.5;
  for (let x = cx % step; x < width; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
  for (let y = cy % step; y < height; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  ctx.font = '9px "IBM Plex Mono", monospace'; ctx.fillStyle = '#718071';
  for (let i = -4; i <= 4; i++) { ctx.fillText(String(i + 5).padStart(2, '0'), cx + i * step + 5, 16); }

  ctx.save(); ctx.translate(cx, cy);
  for (const radius of [1000, 2000, 3000, 4000]) {
    ctx.beginPath(); ctx.arc(0, 0, radius * scale, 0, Math.PI * 2);
    ctx.strokeStyle = radius === 4000 ? 'rgba(188,197,162,0.18)' : 'rgba(170,184,150,0.12)';
    ctx.setLineDash(radius === 4000 ? [3, 6] : []); ctx.lineWidth = 0.8; ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#65765f'; ctx.fillText(`${radius / 1000}.0k`, radius * scale * 0.7 + 5, -radius * scale * 0.7);
  }
  for (let deg = 0; deg < 360; deg += 5) {
    const r = 4000 * scale, a = deg * Math.PI / 180;
    ctx.beginPath(); ctx.moveTo(Math.sin(a) * r, -Math.cos(a) * r);
    ctx.lineTo(Math.sin(a) * (r + (deg % 30 === 0 ? 7 : 3)), -Math.cos(a) * (r + (deg % 30 === 0 ? 7 : 3)));
    ctx.strokeStyle = 'rgba(161,179,145,0.25)'; ctx.stroke();
    if (deg % 90 === 0) { ctx.fillStyle = '#96a18b'; ctx.textAlign = 'center'; ctx.fillText(['N', 'E', 'S', 'W'][deg / 90], Math.sin(a) * (r + 20), -Math.cos(a) * (r + 17) + 3); }
  }
  ctx.restore();
  ctx.textAlign = 'left'; ctx.font = '9px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#74826d'; ctx.fillText('RIDGELINE 04', width * 0.13, height * 0.27);
  ctx.fillText(terrain === 'urban' ? 'CIVILIAN SECTOR' : 'EAST SETTLEMENT', width * 0.71, height * 0.88);
}

export function paintOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, contacts: MapContact[], assets: Scenario['assets'], selected: string | null, zoom: number, phase: number, sweep: boolean): void {
  const { cx, cy, scale } = mapTransform(width, height, zoom);
  if (sweep) {
    const angle = phase / 8000 * Math.PI * 2;
    ctx.save(); ctx.translate(cx, cy);
    const sector = ctx.createConicGradient(angle - 0.7, 0, 0);
    sector.addColorStop(0, 'rgba(211,183,104,0)'); sector.addColorStop(0.10, 'rgba(211,183,104,0.04)');
    sector.addColorStop(0.111, 'rgba(211,183,104,0.12)'); sector.addColorStop(0.112, 'rgba(211,183,104,0)'); sector.addColorStop(1, 'rgba(211,183,104,0)');
    ctx.fillStyle = sector; ctx.beginPath(); ctx.arc(0, 0, 4000 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(angle) * 4000 * scale, Math.sin(angle) * 4000 * scale);
    ctx.strokeStyle = 'rgba(217,188,114,0.15)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
  }
  for (const asset of assets) {
    const x = cx + asset.pos[0] * scale, y = cy + asset.pos[1] * scale;
    ctx.beginPath(); ctx.arc(x, y, 850 * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(221,173,91,0.03)'; ctx.fill();
    ctx.strokeStyle = 'rgba(221,173,91,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([4, 5]); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x + 9, y - 5); ctx.lineTo(x + 7, y + 6); ctx.lineTo(x, y + 11); ctx.lineTo(x - 7, y + 6); ctx.lineTo(x - 9, y - 5); ctx.closePath();
    ctx.fillStyle = '#b99c64'; ctx.fill(); ctx.strokeStyle = '#ead19d'; ctx.stroke();
    ctx.fillStyle = '#19271e'; ctx.fillRect(x - 2, y - 3, 4, 8); ctx.fillRect(x - 4, y - 1, 8, 3);
    ctx.font = '9px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#cab98c'; ctx.fillText('PROTECTED ASSET', x, y + 29); ctx.textAlign = 'left';
  }
  for (const contact of contacts) {
    const x = cx + contact.x * scale, y = cy + contact.y * scale;
    if (x < -20 || y < -20 || x > width + 20 || y > height + 20) continue;
    const color = CONTACT_COLORS[contact.classification];
    ctx.save(); ctx.globalAlpha = contact.resolved ? 0.3 : contact.stale ? 0.45 : 1;
    if (contact.trail.length > 1) {
      ctx.beginPath(); contact.trail.forEach((p, i) => i === 0 ? ctx.moveTo(cx + p.x * scale, cy + p.y * scale) : ctx.lineTo(cx + p.x * scale, cy + p.y * scale));
      ctx.strokeStyle = color; ctx.globalAlpha *= 0.4; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = contact.resolved ? 0.3 : 1;
    }
    if (selected === contact.id) {
      const pulse = 17 + Math.sin(phase / 450) * 2;
      ctx.beginPath(); ctx.arc(x, y, pulse, 0, Math.PI * 2); ctx.strokeStyle = `${color}66`; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = 1.5;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.beginPath(); ctx.moveTo(x + sx * 20, y + sy * 12); ctx.lineTo(x + sx * 20, y + sy * 20); ctx.lineTo(x + sx * 12, y + sy * 20); ctx.stroke();
      }
    }
    ctx.beginPath();
    if (contact.classification === 'friendly') ctx.rect(x - 5, y - 5, 10, 10);
    else if (contact.classification === 'benign') ctx.arc(x, y, 5, 0, Math.PI * 2);
    else if (contact.classification === 'hostile') { ctx.moveTo(x, y - 7); ctx.lineTo(x + 6, y + 5); ctx.lineTo(x - 6, y + 5); ctx.closePath(); }
    else { ctx.moveTo(x, y - 6); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 5, y); ctx.closePath(); }
    ctx.fillStyle = `${color}30`; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = color; ctx.fillRect(x - 1, y - 1, 2, 2);
    ctx.font = '10px "IBM Plex Mono", monospace'; ctx.fillText(contact.label, x + 12, y - 4);
    ctx.font = '8px "IBM Plex Mono", monospace'; ctx.fillStyle = '#9ba894'; ctx.fillText(contact.resolved ? 'RESOLVED' : `${Math.round(contact.confidence * 100)}% · ${contact.stale ? 'STALE' : 'FUSED'}`, x + 12, y + 9);
    ctx.restore();
  }
}
