/**
 * A full-screen caption between story beats — "O 40 HODIN POZDĚJI" and the
 * like. Holds the screen for a moment so a jump in time lands as a deliberate
 * cut rather than the world silently changing behind the player's back.
 */
export class TitleCard {
  private el: HTMLElement;
  private textEl: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'title-card';
    this.el.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 65;
      display: none;
      align-items: center;
      justify-content: center;
      background: #000;
      opacity: 0;
      transition: opacity 0.8s ease;
      pointer-events: none;
    `;

    this.textEl = document.createElement('div');
    this.textEl.style.cssText = `
      color: #e8dcc0;
      font-family: 'Georgia', 'Segoe UI', serif;
      font-size: clamp(24px, 5vw, 60px);
      font-weight: bold;
      letter-spacing: 6px;
      text-align: center;
      padding: 0 6vw;
      text-shadow: 0 4px 24px rgba(0,0,0,0.9);
    `;
    this.el.appendChild(this.textEl);
    document.body.appendChild(this.el);
  }

  /** Fade in, hold, fade out. Resolves once the screen is clear again. */
  async show(text: string, holdMs = 2600): Promise<void> {
    this.textEl.textContent = text;
    this.el.style.display = 'flex';
    // Let the browser paint the hidden state before starting the transition
    await this.frame();
    this.el.style.opacity = '1';
    await this.wait(800 + holdMs);
    this.el.style.opacity = '0';
    await this.wait(800);
    this.el.style.display = 'none';
  }

  private frame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
