import { useMemo } from 'react';
import { ArrowRight, BrainCircuit } from 'lucide-react';
import type { SessionRecord } from '../../sim-core/types';
import { analyzeSession } from '../../sim-core/threat/analysis';
import { formatTime } from '../copy';

/**
 * Evidence-based AI debrief. Every line is derived from the recorded event
 * log, the authoritative score report, or the threat model's view of a
 * replayed tick. When evidence is unavailable the section says so.
 */
export function AiAnalysis({
  record,
  history,
  onPractice,
}: {
  record: SessionRecord;
  history: SessionRecord[];
  onPractice: () => void;
}) {
  const analysis = useMemo(() => analyzeSession(record, history), [record, history]);

  return (
    <section className="panel ai-analysis" aria-label="AI performance analysis">
      <div className="panel-header">
        <div className="panel-title">
          <BrainCircuit size={16} />
          <h2>AI performance analysis</h2>
        </div>
        <span className="tag cyan">EVIDENCE-BASED · ADVISORY</span>
      </div>
      <div className="panel-content">
        <div className="ai-overall">
          <span>OVERALL</span>
          <strong>{analysis.overall}</strong>
        </div>
        {analysis.opportunity === null ? (
          <div className="empty-inline">
            <p>No training opportunity detected in this session.</p>
            <span>
              The authoritative scorer recorded no mistakes to analyze. Increase difficulty
              to give the analysis something to work with.
            </span>
          </div>
        ) : (
          <>
            <div className="ai-row">
              <span>DETECTED TRAINING OPPORTUNITY</span>
              <strong>{analysis.opportunity}</strong>
            </div>
            <div className="ai-row">
              <span>WHAT HAPPENED</span>
              <p>{analysis.whatHappened}</p>
            </div>
            {analysis.evidence.length > 0 && (
              <div className="ai-row">
                <span>RELEVANT EVIDENCE</span>
                <ul>
                  {analysis.evidence.map(line => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.modelView && (
              <div className="ai-row">
                <span>WHAT THE MODEL SAW THEN</span>
                <p>
                  At {formatTime((analysis.mistakeTick ?? 0) / 4)} the on-device model estimated{' '}
                  <strong>{analysis.modelView.predictedClass.replace(/_/g, ' ')}</strong> at{' '}
                  {Math.round(analysis.modelView.confidence * 100)}% ({analysis.modelView.band}{' '}
                  uncertainty)
                  {analysis.modelView.topEvidence
                    .map(e => `${e.name} ${e.value >= 0 ? '+' : ''}${e.value.toFixed(2)}`)
                    .join(' · ')}
                  .
                </p>
              </div>
            )}
            {analysis.lesson && (
              <div className="ai-row">
                <span>AI LESSON</span>
                <p>{analysis.lesson}</p>
              </div>
            )}
            <button className="button secondary full-width" onClick={onPractice}>
              Practice {analysis.suggestedFocus?.replace(/_/g, ' ') ?? 'the weakness'} next{' '}
              <ArrowRight size={14} />
            </button>
          </>
        )}
        <p className="fine-print">
          Derived from recorded events and the authoritative score — never from ground
          truth shortcuts. The model view reconstructs what the advisory model estimated
          at that tick; it did not and cannot influence the score.
        </p>
      </div>
    </section>
  );
}
