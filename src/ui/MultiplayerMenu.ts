import { Net, MAX_PLAYERS } from '../net/Net';

/**
 * The lobby: host a game and read out the code, or type someone else's in.
 *
 * If the broker can't be reached the screen says so plainly and offers to play
 * alone, rather than leaving the player staring at a spinner — that service is
 * outside our control and it does go down.
 */
export class MultiplayerMenu {
  private overlay: HTMLElement;
  private net: Net;

  /** Called once a session is live and the world should start */
  onStart: ((net: Net) => void) | null = null;
  /** Called when the player gives up and wants to play alone */
  onSolo: (() => void) | null = null;
  onBack: (() => void) | null = null;

  constructor(net: Net) {
    this.net = net;

    this.overlay = document.createElement('div');
    this.overlay.id = 'mp-menu';
    this.overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: linear-gradient(to bottom, #1a0e08 0%, #3e2723 50%, #1a0e08 100%);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 210;
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #DEB887;
    `;
    document.body.appendChild(this.overlay);
  }

  show(): void {
    this.overlay.style.display = 'flex';
    this.renderChoice();
  }

  hide(): void {
    this.overlay.style.display = 'none';
  }

  // ---------------- screens ----------------

  private renderChoice(): void {
    this.overlay.innerHTML = `
      <h2 style="color:#FFD700; font-size:38px; letter-spacing:3px; margin-bottom:6px;">MULTIPLAYER</h2>
      <p style="color:#8B7355; margin-bottom:34px;">Až ${MAX_PLAYERS} hráči ve stejném městě</p>
      <div style="display:flex; flex-direction:column; gap:14px; width:280px;">
        ${this.button('mp-host', 'Hostovat hru', true)}
        ${this.button('mp-join', 'Připojit se ke hře', false)}
        ${this.button('mp-back', 'Zpět', false)}
      </div>
      <p style="color:#5d4037; font-size:12px; margin-top:30px; max-width:420px; text-align:center; line-height:1.5;">
        Spojení jde napřímo mezi prohlížeči. K seznámení se používá veřejná
        služba, která občas nemusí odpovídat.
      </p>
    `;

    this.on('#mp-host', () => void this.startHosting());
    this.on('#mp-join', () => this.renderJoin());
    this.on('#mp-back', () => { this.hide(); this.onBack?.(); });
  }

  private async startHosting(): Promise<void> {
    this.renderStatus('Zakládám hru...');
    try {
      const code = await this.net.host(this.askName());
      this.renderHostWaiting(code);
    } catch (err) {
      this.renderError(err instanceof Error ? err.message : 'Nepodařilo se hru založit.');
    }
  }

  private renderHostWaiting(code: string): void {
    this.overlay.innerHTML = `
      <h2 style="color:#FFD700; font-size:30px; letter-spacing:2px; margin-bottom:26px;">TVŮJ KÓD</h2>
      <div style="
        font-size: clamp(40px, 9vw, 84px);
        font-weight: bold;
        letter-spacing: 12px;
        color: #ffe9b0;
        background: rgba(0,0,0,0.35);
        border: 3px solid #8B6508;
        border-radius: 10px;
        padding: 14px 26px 14px 38px;
      ">${code}</div>
      <p style="margin-top:22px; color:#8B7355; text-align:center; max-width:420px; line-height:1.6;">
        Řekni ten kód kamarádům — ať dají <b>Připojit se ke hře</b> a napíšou ho.<br>
        Hráči: <span id="mp-count">1</span> / ${MAX_PLAYERS}
      </p>
      <div style="display:flex; flex-direction:column; gap:14px; width:280px; margin-top:30px;">
        ${this.button('mp-start', 'Začít hrát', true)}
        ${this.button('mp-cancel', 'Zrušit', false)}
      </div>
    `;

    const countEl = this.overlay.querySelector('#mp-count')!;
    this.net.onPeerJoined = () => { countEl.textContent = String(this.net.playerCount); };
    this.net.onPeerLeft = () => { countEl.textContent = String(this.net.playerCount); };

    this.on('#mp-start', () => { this.hide(); this.onStart?.(this.net); });
    this.on('#mp-cancel', () => { this.net.disconnect(); this.renderChoice(); });
  }

  private renderJoin(): void {
    this.overlay.innerHTML = `
      <h2 style="color:#FFD700; font-size:30px; letter-spacing:2px; margin-bottom:22px;">PŘIPOJIT SE</h2>
      <p style="color:#8B7355; margin-bottom:16px;">Napiš šestimístný kód od hostitele</p>
      <input id="mp-code" inputmode="numeric" maxlength="6" placeholder="000000" style="
        font-size:44px; letter-spacing:10px; width:280px; text-align:center;
        padding:10px; background:rgba(0,0,0,0.4); color:#ffe9b0;
        border:3px solid #8B6508; border-radius:10px; outline:none;
      " />
      <div id="mp-msg" style="min-height:22px; margin-top:14px; color:#ef9a9a; font-size:14px;"></div>
      <div style="display:flex; flex-direction:column; gap:14px; width:280px; margin-top:16px;">
        ${this.button('mp-connect', 'Připojit', true)}
        ${this.button('mp-back2', 'Zpět', false)}
      </div>
    `;

    const input = this.overlay.querySelector('#mp-code') as HTMLInputElement;
    input.focus();
    input.addEventListener('keydown', (e) => {
      e.stopPropagation(); // don't let the game read these keys
      if (e.key === 'Enter') void this.tryJoin();
    });

    this.on('#mp-connect', () => void this.tryJoin());
    this.on('#mp-back2', () => this.renderChoice());
  }

  private async tryJoin(): Promise<void> {
    const input = this.overlay.querySelector('#mp-code') as HTMLInputElement;
    const msgEl = this.overlay.querySelector('#mp-msg') as HTMLElement;
    const code = input.value.trim();

    if (!/^\d{6}$/.test(code)) {
      msgEl.textContent = 'Kód musí mít přesně šest číslic.';
      return;
    }

    msgEl.style.color = '#DEB887';
    msgEl.textContent = 'Připojuji...';
    try {
      await this.net.join(code, this.askName());
      this.hide();
      this.onStart?.(this.net);
    } catch (err) {
      this.renderError(err instanceof Error ? err.message : 'Připojení se nepodařilo.');
    }
  }

  private renderStatus(text: string): void {
    this.overlay.innerHTML = `<p style="font-size:22px; color:#DEB887;">${text}</p>`;
  }

  private renderError(message: string): void {
    this.overlay.innerHTML = `
      <h2 style="color:#ef9a9a; font-size:26px; margin-bottom:14px;">Nepovedlo se</h2>
      <p style="color:#DEB887; max-width:460px; text-align:center; line-height:1.6;">${message}</p>
      <p style="color:#5d4037; font-size:13px; margin-top:10px; max-width:460px; text-align:center;">
        Služba, přes kterou se hráči hledají, není naše — když má výpadek, spojení nenavážeme.
      </p>
      <div style="display:flex; flex-direction:column; gap:14px; width:280px; margin-top:28px;">
        ${this.button('mp-retry', 'Zkusit znovu', false)}
        ${this.button('mp-solo', 'Hrát sám', true)}
      </div>
    `;
    this.on('#mp-retry', () => this.renderChoice());
    this.on('#mp-solo', () => { this.net.disconnect(); this.hide(); this.onSolo?.(); });
  }

  // ---------------- helpers ----------------

  /** Remembered between sessions so nobody has to retype it */
  private askName(): string {
    const stored = localStorage.getItem('wild-west-name');
    if (stored) return stored;
    const name = `Kovboj ${Math.floor(Math.random() * 90 + 10)}`;
    localStorage.setItem('wild-west-name', name);
    return name;
  }

  private button(id: string, label: string, primary: boolean): string {
    return `<button id="${id}" style="
      padding:13px; font-size:17px; font-weight:bold; cursor:pointer;
      letter-spacing:1px; border-radius:6px;
      background:${primary ? '#DAA520' : '#5d4037'};
      color:${primary ? '#1a0e08' : '#DEB887'};
      border:2px solid ${primary ? '#FFD700' : '#8B4513'};
    ">${label}</button>`;
  }

  private on(selector: string, handler: () => void): void {
    this.overlay.querySelector(selector)?.addEventListener('click', handler);
  }
}
