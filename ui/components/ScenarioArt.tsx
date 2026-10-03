import { Random } from '../../sim-core/prng';
import type { Scenario } from '../../sim-core/types';

export function ScenarioArt({ scenario, large = false }: { scenario: Scenario; large?: boolean }) {
  const random = new Random(scenario.seed);
  const night = scenario.environment.time_of_day === 'night';
  const hills = Array.from({ length: 20 }, (_, i) => {
    const y = 55 + i * 7;
    return `M-30 ${y + 50}Q45 ${y - 30} 100 ${y}T225 ${y - 35}T410 ${y + 15}`;
  });
  const positions = Array.from({ length: Math.min(8, scenario.actors.reduce((sum, a) => sum + a.count, 0)) }, () => ({ x: random.int(70, 325), y: random.int(25, 135) }));
  return <div className={`scenario-art ${large ? 'large' : ''}`}><svg viewBox="0 0 380 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="380" height="180" fill={night ? '#19241f' : '#263022'} />
    {hills.map((d, i) => <path key={i} d={d} fill="none" stroke={night ? '#597453' : '#748562'} opacity={i % 4 === 0 ? 0.28 : 0.13} strokeWidth={i % 4 === 0 ? 1 : 0.6} />)}
    <path d="M0 155 85 98 144 112 249 65 380 79" stroke="#acaa7722" fill="none" strokeWidth="6" />
    {[32, 62, 94, 127].map(r => <circle key={r} cx="190" cy="94" r={r} fill="none" stroke="#b1bc8c" strokeOpacity={r === 94 ? 0.3 : 0.14} strokeWidth=".7" strokeDasharray={r === 127 ? '2 5' : ''} />)}
    <path d="M190 0v180M0 94h380" stroke="#b5bd8d" strokeOpacity=".12" strokeWidth=".5" />
    <path d="m190 94 116-64A125 125 0 0 0 256-13Z" fill="#dabb7912" />
    <path d="M190 88 197 98H183Z" stroke="#e7bb76" fill="#e7bb7633" />
    {positions.map((p, i) => <g key={i}><path d={`M${p.x - 10} ${p.y + 17}l10-17`} stroke="#d4ba7c" strokeWidth=".7" strokeDasharray="2 3" opacity=".4" /><path d={`m${p.x} ${p.y - 4} 4 4-4 4-4-4Z`} fill="#f0c38533" stroke={i % 3 === 0 ? '#8bc9cb' : '#deb779'} strokeWidth="1" /><circle cx={p.x} cy={p.y} r="9" stroke="#c5ba8433" fill="none" /></g>)}
    {night && <><circle cx="338" cy="25" r="7" fill="#d3cda1" opacity=".7" /><circle cx="341" cy="22" r="7" fill="#19241f" /></>}
    {scenario.environment.terrain === 'urban' && Array.from({ length: 18 }, (_, i) => <rect key={i} x={12 + i % 6 * 13} y={110 + Math.floor(i / 6) * 12} width="8" height="6" fill="#abb38a11" stroke="#acb68b44" strokeWidth=".5" />)}
    <text x="14" y="20" fontFamily="monospace" fontSize="6" fill="#b0bd9c" letterSpacing="1.5">SIMULATED TERRAIN / {scenario.environment.terrain.toUpperCase()}</text>
    <text x="366" y="167" textAnchor="end" fontFamily="monospace" fontSize="6" fill="#a5b491">{String(scenario.seed)}</text>
  </svg></div>;
}
