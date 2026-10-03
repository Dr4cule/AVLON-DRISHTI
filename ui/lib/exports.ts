import type { SessionRecord } from '../../sim-core/types';

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadJson(name: string, data: unknown) { downloadFile(name, JSON.stringify(data, null, 2), 'application/json'); }
export function csvCell(value: unknown): string {
  // Keep spreadsheet exports textual, including formula-leading display names.
  let text = String(value ?? ''); if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function exportSessions(sessions: SessionRecord[], filename = 'avlon-drishti-sessions.csv') {
  const columns = ['session', 'user', 'scenario', 'date', 'mode', 'synthetic', 'provisional', 'score', 'detection', 'classification', 'decision', 'outcome', 'reasoning', 'detection_seconds', 'replay_checksum'];
  const rows = sessions.map(s => [s.id, s.user_id, s.scenario.title, s.started_at, s.mode, s.synthetic, s.report.provisional, s.report.total, s.report.metrics.detection, s.report.metrics.classification, s.report.metrics.decision, s.report.metrics.outcome, s.report.metrics.reasoning, s.report.detection_mean_s, s.report.event_hash]);
  downloadFile(filename, [columns, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
}
