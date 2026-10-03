/**
 * Synthesized UI earcons for missable, time-critical training moments.
 *
 * Offline-first: Web Audio oscillators only. No audio files, no network
 * requests, no dependencies — `external_services` stays 0.
 *
 * Sound is a redundant cue, never the sole signal: every cued moment also
 * has a visual treatment. Silent by default (`drishti.sound-enabled` opt-in
 * in Preferences) and force-silenced in assessment mode by callers.
 */

export type CueName =
  | 'damage'       // asset impact — lose condition
  | 'newTrack'     // track became visible to the trainee
  | 'rejected'     // response rejected
  | 'rejectedRoe'  // response rejected as an ROE violation (escalated)
  | 'adverse'      // resolution with friendly harm or collateral damage
  | 'sensorLost'   // sensor channel degraded or offline
  | 'integrity';   // AAR replay checksum mismatch

const STORAGE_KEY = 'drishti.sound-enabled';

export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSoundEnabled(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Storage unavailable (private mode quota) — stay silent.
  }
}

interface Tone {
  freq: number;
  /** seconds after cue start */
  at: number;
  /** seconds of audible decay */
  dur: number;
  type?: OscillatorType;
  gain?: number;
}

interface Cue {
  /** minimum ms between plays of this cue */
  throttleMs: number;
  tones: Tone[];
}

// Short, quiet, non-musical: alert blips, not a soundtrack.
const CUES: Record<CueName, Cue> = {
  damage: {
    throttleMs: 1500,
    tones: [
      { freq: 110, at: 0, dur: 0.28, type: 'square', gain: 0.1 },
      { freq: 82, at: 0.05, dur: 0.32, type: 'square', gain: 0.09 },
    ],
  },
  newTrack: {
    throttleMs: 2000,
    tones: [{ freq: 880, at: 0, dur: 0.09, type: 'sine', gain: 0.06 }],
  },
  rejected: {
    throttleMs: 800,
    tones: [
      { freq: 220, at: 0, dur: 0.07, type: 'square', gain: 0.06 },
      { freq: 220, at: 0.1, dur: 0.07, type: 'square', gain: 0.06 },
    ],
  },
  rejectedRoe: {
    throttleMs: 800,
    tones: [
      { freq: 196, at: 0, dur: 0.09, type: 'square', gain: 0.07 },
      { freq: 147, at: 0.12, dur: 0.14, type: 'square', gain: 0.07 },
    ],
  },
  adverse: {
    throttleMs: 1500,
    tones: [
      { freq: 330, at: 0, dur: 0.12, type: 'triangle', gain: 0.09 },
      { freq: 247, at: 0.14, dur: 0.2, type: 'triangle', gain: 0.09 },
    ],
  },
  sensorLost: {
    throttleMs: 2500,
    tones: [
      { freq: 660, at: 0, dur: 0.1, type: 'sine', gain: 0.06 },
      { freq: 520, at: 0.12, dur: 0.14, type: 'sine', gain: 0.06 },
    ],
  },
  integrity: {
    throttleMs: 0,
    tones: [
      { freq: 494, at: 0, dur: 0.12, type: 'triangle', gain: 0.08 },
      { freq: 370, at: 0.14, dur: 0.2, type: 'triangle', gain: 0.08 },
    ],
  },
};

const lastPlayed: Record<CueName, number> = {
  damage: 0,
  newTrack: 0,
  rejected: 0,
  rejectedRoe: 0,
  adverse: 0,
  sensorLost: 0,
  integrity: 0,
};

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!isSoundEnabled() || typeof window === 'undefined') return null;
  const Constructor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Constructor) return null;
  try {
    if (!context) context = new Constructor();
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

/** Call from user-gesture handlers so the context is unlocked before cues fire. */
export function unlockAudio(): void {
  audio();
}

/** Suspend synthesis (e.g. tab hidden). Resumes lazily on next cue. */
export function suspendAudio(): void {
  try {
    if (context && context.state === 'running') void context.suspend();
  } catch {
    // Audio unavailable — cues stay silent.
  }
}

export function playCue(name: CueName): void {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - lastPlayed[name] < CUES[name].throttleMs) return;
  const ctx = audio();
  if (!ctx) return;
  lastPlayed[name] = now;
  const start = ctx.currentTime;
  for (const tone of CUES[name].tones) {
    try {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = tone.type ?? 'sine';
      oscillator.frequency.value = tone.freq;
      const peak = tone.gain ?? 0.07;
      gain.gain.setValueAtTime(0.0001, start + tone.at);
      gain.gain.exponentialRampToValueAtTime(peak, start + tone.at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.at + tone.dur);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start + tone.at);
      oscillator.stop(start + tone.at + tone.dur + 0.05);
    } catch {
      // A single failed tone must never break the training loop.
      continue;
    }
  }
}
