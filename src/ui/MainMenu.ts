import { SaveManager } from '../core/SaveManager';

export class MainMenu {
  private overlay: HTMLElement;
  onNewGame: (() => void) | null = null;
  onContinue: (() => void) | null = null;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'main-menu';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: linear-gradient(to bottom, #1a0e08 0%, #3e2723 50%, #1a0e08 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 200;
      font-family: 'Segoe UI', Arial, sans-serif;
    `;

    this.render();
    document.body.appendChild(this.overlay);
  }

  private render(): void {
    const hasSave = SaveManager.hasSave();

    this.overlay.innerHTML = `
      <h1 style="
        color: #FFD700;
        font-size: 56px;
        text-shadow: 3px 3px 8px rgba(0,0,0,0.8), 0 0 20px rgba(218,165,32,0.3);
        margin-bottom: 8px;
        letter-spacing: 4px;
      ">WILD WEST</h1>
      <p style="color: #8B7355; font-size: 16px; margin-bottom: 48px; letter-spacing: 2px;">
        Dobrodružství na Divokém západě
      </p>
      <div style="display:flex; flex-direction:column; gap:14px; width:240px;">
        ${hasSave ? `
          <button id="btn-continue" style="
            padding:14px; font-size:18px; font-weight:bold;
            background:#DAA520; color:#1a0e08; border:2px solid #FFD700;
            border-radius:6px; cursor:pointer; letter-spacing:1px;
            transition: background 0.2s;
          ">Pokračovat</button>
        ` : ''}
        <button id="btn-new-game" style="
          padding:14px; font-size:18px; font-weight:bold;
          background:#5d4037; color:#DEB887; border:2px solid #8B4513;
          border-radius:6px; cursor:pointer; letter-spacing:1px;
          transition: background 0.2s;
        ">Nová hra</button>
      </div>
      <div style="
        position:absolute; bottom:24px;
        color:#5d4037; font-size:12px;
      ">
        Ovládání: WASD pohyb | Myš útok | Pravé tlačítko interakce | 1-4 zbraně | E vstup do budov | Esc pauza
      </div>
    `;

    this.overlay.querySelector('#btn-new-game')?.addEventListener('click', () => {
      SaveManager.deleteSave();
      this.hide();
      this.onNewGame?.();
    });

    this.overlay.querySelector('#btn-continue')?.addEventListener('click', () => {
      this.hide();
      this.onContinue?.();
    });
  }

  hide(): void {
    this.overlay.style.display = 'none';
  }

  show(): void {
    this.render();
    this.overlay.style.display = 'flex';
  }
}
