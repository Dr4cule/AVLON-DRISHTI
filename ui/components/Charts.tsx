import { useId } from 'react';

export function ScoreRing({ value, size = 120, label = 'OVERALL SCORE' }: { value: number; size?: number; label?: string }) {
  const circumference = 2 * Math.PI * 48;
  return <div className="score-ring" style={{ width: size, height: size }}><svg viewBox="0 0 120 120" aria-label={`Score ${value} out of 100`} role="img"><circle cx="60" cy="60" r="48" fill="none" stroke="#3a4730" strokeWidth="5" /><circle cx="60" cy="60" r="48" fill="none" stroke={value >= 75 ? '#b6ca98' : '#e9ad65'} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${circumference * value / 100} ${circumference}`} transform="rotate(-90 60 60)" /><text x="60" y="62" textAnchor="middle" fill="#e5ebda" fontFamily="Inter Variable,sans-serif" fontSize="32" fontWeight="450">{value}</text><text x="60" y="77" textAnchor="middle" fill="#9ead8e" fontFamily="IBM Plex Mono,monospace" fontSize="6.5">{label}</text></svg></div>;
}

export function TrendChart({ values, labels = [], max = 100, color = '#b3c992', height = 190, suffix = '' }: { values: number[]; labels?: string[]; max?: number; color?: string; height?: number; suffix?: string }) {
  const id = useId().replaceAll(':', '');
  const width = 620, chartHeight = 150, left = 34, right = 16, top = 12;
  const coordinates = values.map((v, i) => [left + i / Math.max(1, values.length - 1) * (width - left - right), top + (1 - Math.min(v, max) / max) * chartHeight]);
  const line = coordinates.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
  return <svg className="trend-chart" viewBox={`0 0 ${width} 190`} style={{ height }} role="img" aria-label={`Trend: ${values.length ? values.map(v => `${Math.round(v)}${suffix}`).join(', ') : 'No sessions yet'}`}>
    <defs><linearGradient id={`fill-${id}`} x2="0" y2="1"><stop stopColor={color} stopOpacity=".17" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
    {[0, .25, .5, .75, 1].map(t => <g key={t}><line x1={left} x2={width - right} y1={top + t * chartHeight} y2={top + t * chartHeight} stroke="#3a482f" strokeDasharray="3 6" strokeWidth=".7" /><text x="23" y={top + t * chartHeight + 3} textAnchor="end" fill="#839774" fontSize="8" fontFamily="monospace">{Math.round(max * (1 - t))}</text></g>)}
    {coordinates.length > 1 && <path d={`${line}L${coordinates.at(-1)![0]},${top + chartHeight}L${left},${top + chartHeight}Z`} fill={`url(#fill-${id})`} />}
    <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    {coordinates.map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="4" fill="#1b2419" stroke={color} strokeWidth="1.5" /><text x={x} y={y - 10} textAnchor="middle" fill={color} fontSize="9" fontFamily="monospace">{Math.round(values[i])}{suffix}</text>{(values.length <= 8 || i === 0 || i === values.length - 1) && <text x={x} y="181" textAnchor={i === 0 ? 'start' : i === values.length - 1 ? 'end' : 'middle'} fill="#8a9b7b" fontSize="8" fontFamily="monospace">{labels[i] ?? `RUN ${i + 1}`}</text>}</g>)}
    {!values.length && <text x="310" y="85" textAnchor="middle" fill="#8ea37b" fontSize="11">Complete an exercise to build your trend.</text>}
  </svg>;
}

export function ConfusionMatrix({ matrix }: { matrix: number[][] }) {
  const labels = ['Hostile', 'Friendly', 'Benign', 'Unknown'];
  const maximum = Math.max(1, ...matrix.flat());
  return <div className="confusion table-scroll"><table><caption className="confusion-caption">TRAINEE CLASSIFICATION →</caption><thead><tr><th scope="col">Truth ↓</th>{labels.map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{matrix.map((row, i) => <tr key={i}><th scope="row">{labels[i]}</th>{row.map((value, j) => <td key={j} className={i === j ? 'correct' : value ? 'incorrect' : ''} style={{ background: value ? i === j ? `rgba(170,191,133,${.09 + value / maximum * .26})` : `rgba(228,132,106,${.1 + value / maximum * .16})` : undefined }}>{value}</td>)}</tr>)}</tbody></table><p>Correct identifications fall on the diagonal. Unknowns remain visible.</p></div>;
}
