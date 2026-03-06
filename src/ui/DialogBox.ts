import { NPC } from '../entities/NPC';
import { EventBus } from '../core/EventBus';

/** Syllable-based mumble voice using Web Audio API formant synthesis */
class MumbleVoice {
  private audioCtx: AudioContext | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private activeNodes: { osc: OscillatorNode; gain: GainNode }[] = [];

  stop(): void {
    if (this.stopTimer) clearTimeout(this.stopTimer);
    for (const n of this.activeNodes) {
      try { n.gain.gain.setValueAtTime(0, n.osc.context.currentTime); n.osc.stop(); } catch { /* */ }
    }
    this.activeNodes = [];
  }

  speak(text: string, female: boolean): void {
    this.stop();
    if (!this.audioCtx) this.audioCtx = new AudioContext();
    const ctx = this.audioCtx;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    // Base pitch range — female higher
    const basePitch = female ? 220 : 110;
    const pitchRange = female ? 80 : 40;

    // Create syllables from text length
    const syllables = Math.min(text.length, 60);
    const syllableDur = 0.07;
    const pauseChance = 0.15;

    let t = now + 0.05;

    // Formant filters for vocal quality
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.18;
    masterGain.connect(ctx.destination);

    for (let i = 0; i < syllables; i++) {
      if (Math.random() < pauseChance) {
        t += 0.08 + Math.random() * 0.1;
        continue;
      }

      const pitch = basePitch + Math.sin(i * 0.5) * pitchRange * 0.5 + (Math.random() - 0.5) * pitchRange;
      const dur = syllableDur + Math.random() * 0.04;

      // Main voice oscillator
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(pitch, t);
      osc.frequency.linearRampToValueAtTime(pitch * (0.95 + Math.random() * 0.1), t + dur);

      // Envelope
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.6 + Math.random() * 0.4, t + dur * 0.15);
      env.gain.setValueAtTime(0.5 + Math.random() * 0.3, t + dur * 0.5);
      env.gain.linearRampToValueAtTime(0, t + dur);

      // Formant 1 (vowel-like)
      const f1 = ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.value = female ? (600 + Math.random() * 400) : (400 + Math.random() * 300);
      f1.Q.value = 5 + Math.random() * 5;

      // Formant 2 (consonant-like)
      const f2 = ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.frequency.value = female ? (1800 + Math.random() * 800) : (1200 + Math.random() * 600);
      f2.Q.value = 3 + Math.random() * 4;

      osc.connect(f1).connect(env).connect(masterGain);
      osc.connect(f2).connect(env);
      osc.start(t);
      osc.stop(t + dur + 0.01);

      this.activeNodes.push({ osc, gain: env });

      t += dur + 0.01 + Math.random() * 0.02;
    }

    // Auto-stop after speech
    const totalDur = (t - now) * 1000 + 200;
    this.stopTimer = setTimeout(() => {
      this.activeNodes = [];
    }, totalDur);
  }
}

export class DialogBox {
  private overlay: HTMLElement;
  private nameEl: HTMLElement;
  private textEl: HTMLElement;
  private buttonsEl: HTMLElement;

  private currentNPC: NPC | null = null;
  private mumble = new MumbleVoice();

  get isOpen(): boolean {
    return this.currentNPC !== null;
  }

  constructor() {
    // Create dialog overlay
    this.overlay = document.createElement('div');
    this.overlay.id = 'dialog-box';
    this.overlay.style.cssText = `
      position: fixed;
      bottom: 120px;
      left: 50%;
      transform: translateX(-50%);
      width: 500px;
      max-width: 90vw;
      background: linear-gradient(to bottom, #3e2723, #2c1a0f);
      border: 3px solid #8B4513;
      border-radius: 10px;
      padding: 16px 24px;
      z-index: 30;
      display: none;
      color: #DEB887;
      font-family: 'Segoe UI', Arial, sans-serif;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6);
    `;

    this.nameEl = document.createElement('div');
    this.nameEl.style.cssText = `
      font-size: 20px;
      font-weight: bold;
      color: #FFD700;
      margin-bottom: 8px;
      border-bottom: 1px solid #5d4037;
      padding-bottom: 6px;
    `;
    this.overlay.appendChild(this.nameEl);

    this.textEl = document.createElement('div');
    this.textEl.style.cssText = `
      font-size: 15px;
      line-height: 1.5;
      margin-bottom: 14px;
      min-height: 40px;
    `;
    this.overlay.appendChild(this.textEl);

    this.buttonsEl = document.createElement('div');
    this.buttonsEl.style.cssText = `
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    `;
    this.overlay.appendChild(this.buttonsEl);

    document.body.appendChild(this.overlay);
  }

  /** Show dialog with custom text and action buttons */
  show(npc: NPC, text: string, buttons: { label: string; action: () => void }[]): void {
    this.currentNPC = npc;
    npc.startTalk();

    this.nameEl.textContent = npc.def.name;
    this.textEl.textContent = text;
    this.buttonsEl.innerHTML = '';

    // Play mumble voice
    this.mumble.speak(text, npc.def.gender === 'female');

    for (const btn of buttons) {
      const el = document.createElement('button');
      el.textContent = btn.label;
      el.style.cssText = `
        padding: 6px 18px;
        background: #5d4037;
        color: #DEB887;
        border: 2px solid #8B4513;
        border-radius: 4px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        pointer-events: auto;
        transition: background 0.2s;
      `;
      el.addEventListener('mouseenter', () => { el.style.background = '#795548'; });
      el.addEventListener('mouseleave', () => { el.style.background = '#5d4037'; });
      el.addEventListener('click', () => {
        btn.action();
      });
      this.buttonsEl.appendChild(el);
    }

    this.overlay.style.display = 'block';
  }

  /** Show simple dialog with just a Close button */
  showSimple(npc: NPC, text: string): void {
    this.show(npc, text, [
      { label: 'Zavřít', action: () => this.close() },
    ]);
  }

  close(): void {
    this.mumble.stop();
    if (this.currentNPC) {
      this.currentNPC.endTalk();
      EventBus.emit('dialog:closed', { npcId: this.currentNPC.def.id });
    }
    this.currentNPC = null;
    this.overlay.style.display = 'none';
  }
}
