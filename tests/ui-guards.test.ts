import { describe, expect, it } from 'vitest';
import { markerTone, sumConfusion } from '../ui/aar/AfterActionReview';
import { nextContactId } from '../ui/instructor/InstructorStudio';

describe('UI display guards (pure helpers)', () => {
  it('marks accepted-but-wrong ordered responses as mistakes on the timeline', () => {
    expect(markerTone({ type: 'ResponseRejected', payload: {} })).toBe('bad');
    expect(markerTone({ type: 'TrackClassified', payload: { correct: false } })).toBe('bad');
    expect(markerTone({ type: 'TrackClassified', payload: { correct: true } })).toBe('good');
    expect(markerTone({ type: 'ResponseOrdered', payload: { appropriate: false, reasoning_correct: true, timely: true } })).toBe('bad');
    expect(markerTone({ type: 'ResponseOrdered', payload: { appropriate: true, reasoning_correct: false, timely: true } })).toBe('bad');
    expect(markerTone({ type: 'ResponseOrdered', payload: { appropriate: true, reasoning_correct: true, timely: false } })).toBe('bad');
    expect(markerTone({ type: 'ResponseOrdered', payload: { appropriate: true, reasoning_correct: true, timely: true } })).toBe('good');
    expect(markerTone({ type: 'TrackAcknowledged', payload: {} })).toBe('good');
  });
  it('sums confusion only over valid matrices, skipping corrupt reports', () => {
    const good = { report: { confusion_matrix: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]] } };
    const short = { report: { confusion_matrix: [[1, 0]] } };
    const missing = { report: {} as never };
    const out = sumConfusion([good, short, missing]);
    expect(out).toEqual([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]]);
  });
  it('never reuses a contact ID after deletion in the studio', () => {
    expect(nextContactId(['C1', 'C2', 'C3'])).toBe('C4');
    expect(nextContactId(['C1', 'C3'])).toBe('C4');
    expect(nextContactId([])).toBe('C1');
    expect(nextContactId(['C2', 'custom'])).toBe('C3');
  });
});
