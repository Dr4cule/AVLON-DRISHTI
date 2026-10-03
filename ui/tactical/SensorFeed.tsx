import type { SensorKind, Track } from '../../sim-core/types';
import { hashText } from '../../sim-core/prng';

export function SensorFeed({ track, sensor, tick, available }: { track?: Track; sensor: SensorKind; tick: number; available: boolean }) {
  const reading = track?.sensors[sensor];
  const fresh = reading && tick - reading.tick < 20;
  const identified = reading?.identified_type;
  const offset = parseInt(hashText(track?.id ?? 'empty'), 16) % 40 - 20;
  const phase = tick / 7;
  return <div className={`sensor-feed ${sensor === 'ir' ? 'thermal' : ''}`}>
    <svg viewBox="0 0 320 145" role="img" aria-label={`Synthetic ${sensor.toUpperCase()} cue${identified ? `: ${identified.replaceAll('_', ' ')}` : ': identity unconfirmed'}`}>
      <defs><linearGradient id="sensor-bg" x2="0" y2="1"><stop stopColor={sensor === 'ir' ? '#283127' : '#24382e'} /><stop offset="1" stopColor="#0f1b14" /></linearGradient><pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0h4" stroke="#020c06" strokeOpacity=".2" /></pattern><filter id="sensor-glow"><feGaussianBlur stdDeviation="2" /></filter></defs>
      <rect width="320" height="145" fill="url(#sensor-bg)" />
      <path d="M0 102 28 72 50 85 84 51 119 94 148 80 194 111 229 66 261 83 287 68 320 91V145H0Z" fill="#334432" opacity=".45" />
      <path d="M0 130 39 114 78 119 110 98 145 110 189 104 228 125 283 110 320 116V145H0Z" fill="#111c12" />
      {available && reading && <g transform={`translate(${160 + offset},65)`} opacity={fresh ? 1 : 0.3}>
        {sensor === 'rf' || sensor === 'acoustic' ? <path d={Array.from({ length: 120 }, (_, i) => `${i ? 'L' : 'M'}${i * 2 - 120},${Math.sin(i * 0.37 + phase) * Math.sin(i / 13) * 20}`).join(' ')} fill="none" stroke="#bace96" strokeWidth="1.3" /> : identified === 'bird_flock' ? <g fill="none" stroke="#d2e1bf" strokeWidth="2"><path d="m-25 1 7-5 7 5m6-8 6-5 7 5m6 14 6-5 8 5" /></g> : identified === 'balloon' || identified === 'kite' ? <><ellipse cy="-3" rx="8" ry="11" fill="#c8d0b6" /><path d="M0 8q-4 14 3 23" stroke="#a4b990" fill="none" /></> : identified ? <g stroke="#dce9c9" fill="#dce9c9"><ellipse rx="14" ry="5" opacity=".25" filter="url(#sensor-glow)" /><path d="M-20-5h11l9 6 9-6h11M-20 7h11l9-6 9 6h11" fill="none" strokeWidth="2" /><rect x="-5" y="-4" width="10" height="9" rx="2" /><path d="M-26-5h12M14-5h12M-26 7h12M14 7h12" strokeWidth="1.2" /></g> : <ellipse rx="7" ry="4" fill="#cad4b4" filter="url(#sensor-glow)" />}
        <path d="M-37-19v-8h9M28-27h9v8M37 19v8h-9M-28 27h-9v-8" fill="none" stroke="#c1d5a0" strokeOpacity=".7" strokeWidth=".8" />
      </g>}
      <rect width="320" height="145" fill="url(#scanlines)" />
      <path d="M160 15v9M160 120v9M18 72h9M293 72h9" stroke="#b5c69a" strokeOpacity=".5" strokeWidth=".7" />
      <text x="12" y="16" fill="#bccb9f" fontSize="7" fontFamily="monospace">{sensor.toUpperCase()} · SYNTHETIC CUE</text>
      <text x="307" y="16" textAnchor="end" fill="#bccb9f" fontSize="7" fontFamily="monospace">{fresh ? 'TRACKING' : 'NO FRESH CUE'}</text>
      <text x="12" y="133" fill="#acbb92" fontSize="7" fontFamily="monospace">{track?.label ?? 'SELECT A CONTACT'}</text>
      <text x="307" y="133" textAnchor="end" fill="#acbb92" fontSize="7" fontFamily="monospace">{reading ? `${Math.round(reading.confidence * 100)}% OBSERVATION` : 'AWAITING EVIDENCE'}</text>
    </svg>
    {(!available || !track) && <div className="sensor-empty">{!available ? 'Channel unavailable in this exercise' : 'Select a contact to inspect'}</div>}
  </div>;
}
