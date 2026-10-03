import { useEffect, useRef, useState } from 'react';
import { Expand, Layers2, LocateFixed, Minus, Plus } from 'lucide-react';
import type { MapContact, Scenario } from '../../sim-core/types';
import { mapTransform, paintOverlay, paintTerrain } from './render';

interface Props {
  scenario: Scenario; contacts: MapContact[]; selected?: string | null;
  onSelect?: (id: string) => void; truth?: boolean; lowResource?: boolean; sweep?: boolean;
  compact?: boolean; onPlace?: (x: number, y: number) => void;
}
export function RadarMap(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const current = useRef(props); current.current = props;
  const [zoom, setZoom] = useState(1);
  const [contours, setContours] = useState(true);
  const [size, setSize] = useState({ width: 800, height: 440 });
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(host); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.width || !size.height) return;
    const context = canvas.getContext('2d'); if (!context) return;
    const ratio = Math.min(window.devicePixelRatio || 1, props.lowResource ? 1 : 2);
    canvas.width = Math.round(size.width * ratio); canvas.height = Math.round(size.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const base = document.createElement('canvas'); base.width = canvas.width; base.height = canvas.height;
    const baseContext = base.getContext('2d')!; baseContext.scale(ratio, ratio);
    paintTerrain(baseContext, size.width, size.height, props.scenario.seed, props.scenario.environment.terrain, zoom, contours);
    let frame = 0, last = 0;
    // Static frame for reduced-motion users: no sweep/pulse animation, same tactical picture.
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      if ((current.current.lowResource || calm) && time - last < 100) return;
      last = time;
      context.clearRect(0, 0, size.width, size.height);
      context.drawImage(base, 0, 0, size.width, size.height);
      const still = current.current.lowResource || calm;
      paintOverlay(context, size.width, size.height, current.current.contacts, current.current.scenario.assets, current.current.selected ?? null, zoom, still ? 0 : time, current.current.sweep !== false && !current.current.truth && !still);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [size, zoom, contours, props.scenario.seed, props.scenario.environment.terrain, props.lowResource]);

  const clickMap = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const { cx, cy, scale } = mapTransform(rect.width, rect.height, zoom);
    const x = (event.clientX - rect.left - cx) / scale, y = (event.clientY - rect.top - cy) / scale;
    if (props.onPlace) { props.onPlace(x, y); return; }
    const nearest = [...props.contacts].sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    if (nearest && Math.hypot(nearest.x - x, nearest.y - y) * scale < 35) props.onSelect?.(nearest.id);
  };
  return <div ref={hostRef} className={`radar-map ${props.compact ? 'compact' : ''}`}>
    <canvas ref={canvasRef} onClick={clickMap} aria-label={`${props.truth ? 'Ground truth' : 'Sensor'} map of fictional training sector. Contacts can also be selected in the track list.`} role="img" />
    <div className="map-location"><span className="map-cross">+</span><div>SECTOR 07<span>FICTIONAL TRAINING GRID</span></div></div>
    <div className={`map-view-badge ${props.truth ? 'truth' : ''}`}><span className="dot" />{props.truth ? 'GROUND TRUTH' : 'SENSOR PICTURE'}</div>
    {!props.compact && <div className="map-tools">
      <button className="icon-button" title="Zoom in" aria-label="Zoom in" disabled={zoom >= 2} onClick={() => setZoom(v => Math.min(2, v + 0.25))}><Plus size={16} /></button>
      <button className="icon-button" title="Zoom out" aria-label="Zoom out" disabled={zoom <= 0.75} onClick={() => setZoom(v => Math.max(0.75, v - 0.25))}><Minus size={16} /></button>
      <span />
      <button className="icon-button" title="Reset map" aria-label="Reset map" onClick={() => setZoom(1)}><LocateFixed size={16} /></button>
      <button className={`icon-button ${contours ? 'active' : ''}`} title="Toggle terrain contours" aria-label="Toggle terrain contours" onClick={() => setContours(v => !v)}><Layers2 size={16} /></button>
      <button className="icon-button" title="Expand map" aria-label="Expand map" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void hostRef.current?.requestFullscreen?.(); }}><Expand size={15} /></button>
    </div>}
    <div className="map-legend"><span><i className="legend-shape diamond" />Unknown</span><span><i className="legend-shape triangle" />Hostile</span><span><i className="legend-shape square" />Friendly</span><span><i className="legend-shape circle" />Benign</span></div>
    <div className="map-scale"><span />1,000 simulation units</div>
  </div>;
}
