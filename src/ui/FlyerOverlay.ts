/**
 * The full-screen warning the player reads off the leaflet.
 *
 * Deliberately loud and blocking — this is the beat where the story turns, so
 * it takes over the screen instead of appearing as another corner notification.
 */
export class FlyerOverlay {
  private el: HTMLElement;
  private onClosed: (() => void) | null = null;
  private open = false;

  get isOpen(): boolean {
    return this.open;
  }

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'flyer-overlay';
    this.el.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 60;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(8, 5, 2, 0.88);
      cursor: pointer;
    `;
    this.el.innerHTML = `
      <div style="
        max-width: 90vw;
        padding: 5vh 6vw;
        background: repeating-linear-gradient(0deg, #efe4c8, #efe4c8 3px, #e9dcbd 3px, #e9dcbd 6px);
        border: 3px solid #6b5636;
        box-shadow: 0 20px 60px rgba(0,0,0,0.8);
        transform: rotate(-1.2deg);
        text-align: center;
        font-family: 'Georgia', 'Segoe UI', serif;
        color: #241a10;
      ">
        <div style="font-size: clamp(12px, 1.6vw, 18px); letter-spacing: 5px; margin-bottom: 2vh;">
          VAROVÁNÍ ‚ ‚ ‚ VAROVÁNÍ
        </div>
        <div style="font-size: clamp(30px, 7vw, 86px); font-weight: bold; line-height: 1.05; letter-spacing: 2px;">
          BLÍŽÍ SE<br />VLKODLAK
        </div>
        <div style="
          margin-top: 3vh;
          font-size: clamp(16px, 3vw, 34px);
          font-weight: bold;
          border-top: 2px solid #6b5636;
          border-bottom: 2px solid #6b5636;
          padding: 1.5vh 0;
        ">
          DNESKA V NOCI TU UŽ BUDE
        </div>
        <div style="margin-top: 3vh; font-size: clamp(11px, 1.4vw, 16px); opacity: 0.65;">
          klikni pro zavření
        </div>
      </div>
    `;
    this.el.addEventListener('click', () => this.close());
    document.body.appendChild(this.el);
  }

  show(onClosed: () => void): void {
    this.onClosed = onClosed;
    this.open = true;
    this.el.style.display = 'flex';
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.el.style.display = 'none';
    const cb = this.onClosed;
    this.onClosed = null;
    cb?.();
  }
}
