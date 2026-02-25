import { NPC } from '../entities/NPC';
import { EventBus } from '../core/EventBus';

export class DialogBox {
  private overlay: HTMLElement;
  private nameEl: HTMLElement;
  private textEl: HTMLElement;
  private buttonsEl: HTMLElement;

  private currentNPC: NPC | null = null;

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
    if (this.currentNPC) {
      this.currentNPC.endTalk();
      EventBus.emit('dialog:closed', { npcId: this.currentNPC.def.id });
    }
    this.currentNPC = null;
    this.overlay.style.display = 'none';
  }
}
