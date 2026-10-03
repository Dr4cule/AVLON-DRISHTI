import { useMemo } from 'react';
import { BrainCircuit } from 'lucide-react';
import { extractFeatures } from '../../sim-core/threat/features';
import { predict, uncertaintyBand } from '../../sim-core/threat/model';
import type { Scenario, Track } from '../../sim-core/types';
import { humanize } from '../copy';

const CLASS_LABELS: Record<string, string> = {
  bird: 'Bird',
  balloon: 'Balloon',
  friendly_uav: 'Friendly UAV',
  unknown_uav: 'Unknown UAV',
  hostile_like_uav: 'Hostile-like UAV',
  clutter: 'Sensor artifact',
};

const SENSOR_LABELS: Record<string, string> = {
  radar_confidence: 'RADAR',
  ir_confidence: 'IR',
  acoustic_confidence: 'ACOUSTIC',
  rf_confidence: 'RF',
};

/**
 * Advisory threat assessment. Computed locally from trainee-visible evidence,
 * never scored, never authoritative. The trainee always makes the final call.
 */
export function ThreatAssessment({
  track,
  scenario,
  tick,
}: {
  track?: Track;
  scenario: Scenario;
  tick: number;
}) {
  const assessment = useMemo(() => {
    if (!track) return null;
    try {
      const features = extractFeatures(track, scenario, tick);
      return { features, result: predict(features) };
    } catch {
      return null;
    }
  }, [track, scenario, tick]);

  if (!track || !assessment) return null;
  const { result } = assessment;
  const band = uncertaintyBand(result.uncertainty);
  const agreement = Math.round((assessment.features[10] ?? 0) * 100);
  const evidence = (Object.entries(result.evidence) as [string, number][])
    .filter(([name]) => name in SENSOR_LABELS)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="threat-assessment" aria-label="AI threat assessment (advisory)">
      <div className="threat-heading">
        <BrainCircuit size={14} />
        <span>AI THREAT ASSESSMENT · ADVISORY</span>
        <span className={`tag ${band === 'LOW' ? '' : band === 'MEDIUM' ? 'amber' : 'red'}`}>
          UNCERTAINTY {band}
        </span>
      </div>
      <div className="threat-primary">
        <div>
          <span className="eyebrow">PRIMARY HYPOTHESIS</span>
          <strong>{CLASS_LABELS[result.predictedClass] ?? humanize(result.predictedClass)}</strong>
        </div>
        <div className="threat-confidence">
          <strong>{Math.round(result.confidence * 100)}%</strong>
          <span>CONFIDENCE</span>
        </div>
        <div className="threat-confidence">
          <strong>{agreement}%</strong>
          <span>SENSOR AGREEMENT</span>
        </div>
      </div>
      <div className="threat-evidence">
        {evidence.map(([name, value]) => (
          <div key={name}>
            <span>{SENSOR_LABELS[name]}</span>
            <div>
              <i
                className={value < 0 ? 'negative' : ''}
                style={{ width: `${Math.min(100, Math.abs(value) * 100)}%` }}
              />
            </div>
            <strong>
              {value >= 0 ? '+' : ''}
              {value.toFixed(2)}
            </strong>
          </div>
        ))}
      </div>
      <p className="threat-disclaimer">
        Advisory estimate from a tiny on-device model trained on synthetic data. It does not
        score you and cannot see ground truth. <strong>HUMAN DECIDES.</strong>
      </p>
    </div>
  );
}
