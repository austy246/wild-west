// Tiny synthesized sound effects using the Web Audio API (no asset files).

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    return ctx;
  } catch {
    return null;
  }
}

/** Downward "falling" whoosh. */
export function playFall(): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(420, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 1.4);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.25, now + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1200, now);
  filter.frequency.exponentialRampToValueAtTime(200, now + 1.4);

  osc.connect(filter).connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 1.7);
}

/** Short scratchy "match strike" followed by a soft flare. */
export function playMatchStrike(): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;

  // Scratch: a short burst of band-passed noise
  const dur = 0.22;
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    // Rising then falling scratchy envelope
    const t = i / data.length;
    const env = Math.sin(t * Math.PI) * (0.5 + 0.5 * Math.sin(t * 60));
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const noise = ac.createBufferSource();
  noise.buffer = buffer;

  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2600;
  bp.Q.value = 0.8;

  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.35, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  noise.connect(bp).connect(noiseGain).connect(ac.destination);
  noise.start(now);

  // Soft flare "whoomph" as it catches
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, now + 0.18);
  osc.frequency.exponentialRampToValueAtTime(90, now + 0.7);
  const flare = ac.createGain();
  flare.gain.setValueAtTime(0.0001, now + 0.18);
  flare.gain.exponentialRampToValueAtTime(0.18, now + 0.28);
  flare.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
  osc.connect(flare).connect(ac.destination);
  osc.start(now + 0.18);
  osc.stop(now + 0.95);
}
