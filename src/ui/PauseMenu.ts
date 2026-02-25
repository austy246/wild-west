export class PauseMenu {
  private overlay: HTMLElement;
  private _isPaused = false;

  onResume: (() => void) | null = null;
  onSave: (() => void) | null = null;
  onQuit: (() => void) | null = null;

  get isPaused(): boolean {
    return this._isPaused;
  }

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'pause-menu';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 150;
      font-family: 'Segoe UI', Arial, sans-serif;
    `;

    this.overlay.innerHTML = `
      <h2 style="color: #FFD700; font-size: 36px; margin-bottom: 32px; text-shadow: 2px 2px 6px rgba(0,0,0,0.8);">
        PAUZA
      </h2>
      <div style="display:flex; flex-direction:column; gap:12px; width:200px;">
        <button id="pause-resume" style="
          padding:12px; font-size:16px; font-weight:bold;
          background:#5d4037; color:#DEB887; border:2px solid #8B4513;
          border-radius:6px; cursor:pointer;
        ">Pokračovat</button>
        <button id="pause-save" style="
          padding:12px; font-size:16px; font-weight:bold;
          background:#5d4037; color:#DEB887; border:2px solid #8B4513;
          border-radius:6px; cursor:pointer;
        ">Uložit hru</button>
        <button id="pause-quit" style="
          padding:12px; font-size:16px; font-weight:bold;
          background:#8b0000; color:#DEB887; border:2px solid #cd5c5c;
          border-radius:6px; cursor:pointer;
        ">Ukončit</button>
      </div>
    `;

    document.body.appendChild(this.overlay);

    this.overlay.querySelector('#pause-resume')?.addEventListener('click', () => {
      this.resume();
    });
    this.overlay.querySelector('#pause-save')?.addEventListener('click', () => {
      this.onSave?.();
    });
    this.overlay.querySelector('#pause-quit')?.addEventListener('click', () => {
      this.onQuit?.();
    });

    // Escape key toggles pause
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this._isPaused) {
          this.resume();
        } else {
          this.pause();
        }
      }
    });
  }

  pause(): void {
    this._isPaused = true;
    this.overlay.style.display = 'flex';
  }

  resume(): void {
    this._isPaused = false;
    this.overlay.style.display = 'none';
    this.onResume?.();
  }
}
