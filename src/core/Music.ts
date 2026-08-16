/**
 * Background score and ambience.
 *
 * The music is synthesized in the browser rather than streamed from a file, so
 * the game ships with a soundtrack without bundling anyone's recording. It's a
 * slow modal piece — open fifths under a plucked melody, which is what gives it
 * the medieval colour — and it shifts to a darker, slower, sparser variant at
 * night without going full horror.
 *
 * If you'd rather use your own recordings, drop them in as
 *   public/audio/music/day.mp3
 *   public/audio/music/night.mp3
 * and they're used instead of the synth automatically. Only use tracks you
 * have the right to use — anything ripped from YouTube isn't that.
 */

export type Mood = 'day' | 'night';

const STORAGE_KEY = 'wild-west-audio';

/** A natural-minor scale in semitones — the modal sound the score is built on */
const SCALE = [0, 2, 3, 5, 7, 8, 10, 12];

interface MoodSettings {
  /** Seconds per beat */
  beat: number;
  /** Root note frequency */
  root: number;
  /** Melody note volume */
  melodyGain: number;
  /** Drone volume */
  droneGain: number;
  /** Low-pass cutoff — the main "brightness" control */
  cutoff: number;
  /** Chance per beat that a melody note sounds at all */
  density: number;
  /** How long plucked notes ring */
  decay: number;
}

const MOODS: Record<Mood, MoodSettings> = {
  day: {
    beat: 0.62,
    root: 220, // A3
    melodyGain: 0.09,
    droneGain: 0.05,
    cutoff: 2600,
    density: 0.72,
    decay: 1.5,
  },
  night: {
    beat: 0.95,
    root: 146.83, // D3 — a fourth lower, darker but still warm
    melodyGain: 0.075,
    droneGain: 0.07,
    cutoff: 1050,
    density: 0.42,
    decay: 3.2,
  },
};

/** How far ahead notes are scheduled, in seconds */
const LOOKAHEAD = 0.6;
const TICK_MS = 120;

export class MusicDirector {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private droneGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private timer: number | null = null;
  private nextNoteAt = 0;
  private step = 0;
  private nextAmbienceAt = 0;

  private mood: Mood = 'day';
  private started = false;
  private enabled = true;

  /** File-based override, when the player supplies their own tracks */
  private trackEl: HTMLAudioElement | null = null;
  private tracks: Partial<Record<Mood, string>> = {};

  get isEnabled(): boolean {
    return this.enabled;
  }

  constructor() {
    this.enabled = localStorage.getItem(STORAGE_KEY) !== 'off';
  }

  /**
   * Must be called from a user gesture (the menu click), otherwise the browser
   * refuses to start audio.
   */
  start(): void {
    if (this.started) return;
    this.started = true;

    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
    } catch {
      return;
    }
    if (!this.ctx) return;

    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 1 : 0;
    this.master.connect(this.ctx.destination);

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = MOODS[this.mood].cutoff;
    this.filter.Q.value = 0.6;
    this.filter.connect(this.master);

    this.buildNoiseBuffer();
    this.startDrone();

    this.nextNoteAt = this.ctx.currentTime + 0.15;
    this.nextAmbienceAt = this.ctx.currentTime + 8;
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);

    void this.lookForCustomTracks();
  }

  /** Switch between the daytime and night-time variants. */
  setMood(mood: Mood): void {
    if (this.mood === mood) return;
    this.mood = mood;

    if (this.ctx && this.filter) {
      // Slide the brightness across rather than snapping — a hard cut is
      // audible as a click and gives away the seam
      const now = this.ctx.currentTime;
      this.filter.frequency.cancelScheduledValues(now);
      this.filter.frequency.setValueAtTime(this.filter.frequency.value, now);
      this.filter.frequency.linearRampToValueAtTime(MOODS[mood].cutoff, now + 3);
    }
    if (this.droneGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.droneGain.gain.linearRampToValueAtTime(MOODS[mood].droneGain, now + 3);
    }

    this.playCustomTrack();
  }

  /** Mute or unmute everything. Remembered between sessions. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(on ? 1 : 0, now + 0.3);
    }
    if (this.trackEl) {
      if (on) void this.trackEl.play().catch(() => { /* blocked */ });
      else this.trackEl.pause();
    }
  }

  toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  // ---------------- Scheduling ----------------

  private schedule(): void {
    if (!this.ctx || this.trackEl) return; // custom track takes over entirely
    const settings = MOODS[this.mood];

    while (this.nextNoteAt < this.ctx.currentTime + LOOKAHEAD) {
      this.scheduleStep(this.nextNoteAt, settings);
      this.nextNoteAt += settings.beat;
      this.step++;
    }

    if (this.ctx.currentTime > this.nextAmbienceAt) {
      this.scheduleAmbience();
    }
  }

  /** One beat: a melody note, sometimes a harmony a fifth below. */
  private scheduleStep(at: number, s: MoodSettings): void {
    // A slow rise and fall through the scale rather than random notes, so it
    // reads as a melody instead of noodling
    const phrase = [0, 2, 4, 3, 5, 4, 2, 1, 0, 2, 3, 5, 6, 5, 3, 2];
    const degree = phrase[this.step % phrase.length];
    const octave = this.step % 32 >= 16 ? 12 : 0;

    if (Math.random() > s.density) return;

    const freq = s.root * Math.pow(2, (SCALE[degree] + octave) / 12);
    this.pluck(at, freq, s.melodyGain, s.decay);

    // On the strong beats, add the fifth underneath for the open medieval sound
    if (this.step % 4 === 0) {
      this.pluck(at, (freq * 3) / 4, s.melodyGain * 0.55, s.decay * 1.2);
    }
  }

  /** A single plucked note. */
  private pluck(at: number, freq: number, gain: number, decay: number): void {
    if (!this.ctx || !this.filter) return;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;

    // A touch of detune, and a second quieter sine for body
    const body = this.ctx.createOscillator();
    body.type = 'sine';
    body.frequency.value = freq * 2.002;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, at + decay);

    const bodyEnv = this.ctx.createGain();
    bodyEnv.gain.setValueAtTime(0.0001, at);
    bodyEnv.gain.exponentialRampToValueAtTime(gain * 0.25, at + 0.015);
    bodyEnv.gain.exponentialRampToValueAtTime(0.0001, at + decay * 0.5);

    osc.connect(env).connect(this.filter);
    body.connect(bodyEnv).connect(this.filter);

    osc.start(at);
    body.start(at);
    osc.stop(at + decay + 0.05);
    body.stop(at + decay + 0.05);
  }

  /** Continuous low fifth under everything. */
  private startDrone(): void {
    if (!this.ctx || !this.filter) return;
    const s = MOODS[this.mood];

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = s.droneGain;
    this.droneGain.connect(this.filter);

    for (const mult of [0.5, 0.75]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = s.root * mult;
      const g = this.ctx.createGain();
      g.gain.value = 0.35;
      osc.connect(g).connect(this.droneGain);
      osc.start();

      // Slow drift so the drone breathes instead of sitting dead still
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.07 + Math.random() * 0.05;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.8;
      lfo.connect(lfoGain).connect(osc.detune);
      lfo.start();
    }
  }

  // ---------------- Ambience ----------------

  private buildNoiseBuffer(): void {
    if (!this.ctx) return;
    const length = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
  }

  /** Wind by day; wind plus the occasional distant howl by night. */
  private scheduleAmbience(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.mood === 'night' && Math.random() < 0.45) {
      this.howl(now + 0.5);
      this.nextAmbienceAt = now + 18 + Math.random() * 22;
    } else {
      this.wind(now + 0.2);
      this.nextAmbienceAt = now + 11 + Math.random() * 14;
    }
  }

  private wind(at: number): void {
    if (!this.ctx || !this.noiseBuffer || !this.master) return;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 420;
    band.Q.value = 0.9;

    const dur = 4 + Math.random() * 3;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(this.mood === 'night' ? 0.05 : 0.035, at + dur * 0.4);
    env.gain.linearRampToValueAtTime(0.0001, at + dur);

    // Sweep the band so it sounds like a gust passing, not static hiss
    band.frequency.setValueAtTime(300, at);
    band.frequency.linearRampToValueAtTime(700, at + dur * 0.5);
    band.frequency.linearRampToValueAtTime(280, at + dur);

    src.connect(band).connect(env).connect(this.master);
    src.start(at);
    src.stop(at + dur + 0.1);
  }

  /** Far-off wolf — the werewolf isn't here yet, but something is out there. */
  private howl(at: number): void {
    if (!this.ctx || !this.master) return;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, at);
    osc.frequency.linearRampToValueAtTime(310, at + 0.6);
    osc.frequency.setValueAtTime(310, at + 1.5);
    osc.frequency.linearRampToValueAtTime(150, at + 2.6);

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(0.055, at + 0.4);
    env.gain.setValueAtTime(0.055, at + 1.6);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 2.8);

    osc.connect(lp).connect(env).connect(this.master);
    osc.start(at);
    osc.stop(at + 3);
  }

  // ---------------- Optional custom tracks ----------------

  /**
   * If the player dropped their own mp3s into public/audio/music, use those and
   * shut the synth up.
   */
  private async lookForCustomTracks(): Promise<void> {
    const base = import.meta.env.BASE_URL;
    for (const mood of ['day', 'night'] as Mood[]) {
      const url = `${base}audio/music/${mood}.mp3`;
      try {
        const res = await fetch(url, { method: 'HEAD' });
        // A dev server may answer 200 with the index.html fallback, so check
        // that what came back actually claims to be audio
        const type = res.headers.get('content-type') ?? '';
        if (res.ok && type.includes('audio')) this.tracks[mood] = url;
      } catch {
        /* not there — synth it is */
      }
    }
    if (Object.keys(this.tracks).length > 0) this.playCustomTrack();
  }

  private playCustomTrack(): void {
    const url = this.tracks[this.mood];
    if (!url) return;

    if (!this.trackEl) {
      this.trackEl = new Audio();
      this.trackEl.loop = true;
      this.trackEl.volume = 0.5;
    }
    if (this.trackEl.src.endsWith(url)) return;

    this.trackEl.src = url;
    if (this.enabled) void this.trackEl.play().catch(() => { /* autoplay blocked */ });

    // Silence the synth side so the two don't fight
    if (this.master && this.ctx) {
      this.master.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 1);
    }
  }
}
