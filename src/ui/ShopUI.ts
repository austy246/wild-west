import { Shop } from '../economy/Shop';
import { EventBus } from '../core/EventBus';

export class ShopUI {
  private overlay: HTMLElement;
  private shop: Shop;
  private _isOpen = false;

  get isOpen(): boolean {
    return this._isOpen;
  }

  constructor(shop: Shop) {
    this.shop = shop;

    this.overlay = document.createElement('div');
    this.overlay.id = 'shop-ui';
    this.overlay.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 600px;
      max-width: 95vw;
      max-height: 80vh;
      background: linear-gradient(to bottom, #3e2723, #1a0e08);
      border: 3px solid #DAA520;
      border-radius: 12px;
      padding: 20px;
      z-index: 60;
      display: none;
      overflow-y: auto;
      color: #DEB887;
      font-family: 'Segoe UI', Arial, sans-serif;
      box-shadow: 0 6px 30px rgba(0,0,0,0.8);
    `;
    document.body.appendChild(this.overlay);
  }

  open(): void {
    this._isOpen = true;
    this.render();
    this.overlay.style.display = 'block';
  }

  close(): void {
    this._isOpen = false;
    this.overlay.style.display = 'none';
  }

  private render(): void {
    const items = this.shop.getItems();

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:2px solid #5d4037; padding-bottom:10px;">
        <h2 style="margin:0; color:#FFD700; font-size:22px;">Obchod</h2>
        <button id="shop-close-btn" style="
          background:#5d4037; color:#DEB887; border:2px solid #8B4513;
          border-radius:4px; padding:4px 14px; cursor:pointer; font-weight:bold; font-size:14px;
          pointer-events:auto;
        ">Zavřít (Esc)</button>
      </div>
    `;

    // Group by category
    const categories: [string, string][] = [
      ['weapon', 'Zbraně'],
      ['upgrade', 'Vylepšení'],
      ['cosmetic', 'Kosmetika'],
    ];

    for (const [cat, label] of categories) {
      const catItems = items.filter((i) => i.category === cat);
      if (catItems.length === 0) continue;

      html += `<h3 style="color:#DAA520; margin:12px 0 8px; font-size:16px;">${label}</h3>`;
      html += `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:10px;">`;

      for (const item of catItems) {
        const owned = item.owned;
        const canAfford = item.canAfford;
        const btnDisabled = owned || !canAfford;
        const btnText = owned ? 'Vlastníš' : `${item.price} lilků`;
        const opacity = btnDisabled && !owned ? '0.5' : '1';
        const btnColor = owned ? '#4CAF50' : canAfford ? '#DAA520' : '#666';

        html += `
          <div style="background:rgba(0,0,0,0.3); border:1px solid #5d4037; border-radius:6px; padding:10px; opacity:${opacity};">
            <div style="font-weight:bold; font-size:14px; color:#FFD700;">${item.name}</div>
            <div style="font-size:11px; margin:4px 0 8px; color:#b8a080; min-height:30px;">${item.description}</div>
            <button
              class="shop-buy-btn"
              data-item-id="${item.id}"
              ${btnDisabled ? 'disabled' : ''}
              style="
                width:100%; padding:5px; background:${btnColor}; color:#fff;
                border:1px solid #8B4513; border-radius:3px; font-size:12px;
                font-weight:bold; cursor:${btnDisabled ? 'default' : 'pointer'};
                pointer-events:auto;
              "
            >${btnText}</button>
          </div>
        `;
      }

      html += `</div>`;
    }

    this.overlay.innerHTML = html;

    // Bind events
    this.overlay.querySelector('#shop-close-btn')?.addEventListener('click', () => this.close());
    this.overlay.querySelectorAll('.shop-buy-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.itemId!;
        if (this.shop.buy(id)) {
          this.render(); // re-render to update state
        }
      });
    });
  }
}
