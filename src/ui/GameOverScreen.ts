import { SaveManager } from '../core/SaveManager';

export class GameOverScreen {
  private overlay: HTMLElement;
  private _isShown = false;

  onRestart: (() => void) | null = null;
  onContinue: (() => void) | null = null;
  onMainMenu: (() => void) | null = null;

  get isShown(): boolean {
    return this._isShown;
  }

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'game-over-screen';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.85);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 180;
      font-family: 'Segoe UI', Arial, sans-serif;
    `;

    document.body.appendChild(this.overlay);
  }

  show(): void {
    this._isShown = true;
    const hasSave = SaveManager.hasSave();

    this.overlay.innerHTML = `
      <h1 style="
        color: #8b0000;
        font-size: 64px;
        text-shadow: 3px 3px 10px rgba(139,0,0,0.6), 0 0 30px rgba(139,0,0,0.3);
        margin-bottom: 12px;
        letter-spacing: 6px;
      ">KONEC HRY</h1>
      <p style="color: #8B7355; font-size: 16px; margin-bottom: 48px; letter-spacing: 2px;">
        Tvůj příběh zde končí...
      </p>
      <div style="display:flex; flex-direction:column; gap:14px; width:260px;">
        ${hasSave ? `
          <button id="gameover-continue" style="
            padding:14px; font-size:18px; font-weight:bold;
            background:#DAA520; color:#1a0e08; border:2px solid #FFD700;
            border-radius:6px; cursor:pointer; letter-spacing:1px;
            transition: background 0.2s;
          ">Pokračovat</button>
        ` : ''}
        <button id="gameover-restart" style="
          padding:14px; font-size:18px; font-weight:bold;
          background:#5d4037; color:#DEB887; border:2px solid #8B4513;
          border-radius:6px; cursor:pointer; letter-spacing:1px;
          transition: background 0.2s;
        ">Restartovat</button>
        <button id="gameover-menu" style="
          padding:14px; font-size:18px; font-weight:bold;
          background:#5d4037; color:#DEB887; border:2px solid #8B4513;
          border-radius:6px; cursor:pointer; letter-spacing:1px;
          transition: background 0.2s;
        ">Zpět do herní nabídky</button>
      </div>
    `;

    this.overlay.querySelector('#gameover-continue')?.addEventListener('click', () => {
      this.hide();
      this.onContinue?.();
    });
    this.overlay.querySelector('#gameover-restart')?.addEventListener('click', () => {
      this.hide();
      this.onRestart?.();
    });
    this.overlay.querySelector('#gameover-menu')?.addEventListener('click', () => {
      this.hide();
      this.onMainMenu?.();
    });

    this.overlay.style.display = 'flex';
  }

  hide(): void {
    this._isShown = false;
    this.overlay.style.display = 'none';
  }
}
