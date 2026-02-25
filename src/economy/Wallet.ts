import { EventBus } from '../core/EventBus';

export class Wallet {
  private _lilky = 0;
  private hudElement: HTMLElement | null;

  get lilky(): number {
    return this._lilky;
  }

  constructor() {
    this.hudElement = document.getElementById('lilky-amount');
    this.updateHUD();

    EventBus.on('economy:earn', (data: { amount: number }) => {
      this.add(data.amount);
    });
    EventBus.on('economy:spend', (data: { amount: number }) => {
      this.spend(data.amount);
    });
  }

  add(amount: number): void {
    this._lilky += amount;
    this.updateHUD();
  }

  spend(amount: number): boolean {
    if (this._lilky < amount) return false;
    this._lilky -= amount;
    this.updateHUD();
    return true;
  }

  canAfford(amount: number): boolean {
    return this._lilky >= amount;
  }

  private updateHUD(): void {
    if (this.hudElement) {
      this.hudElement.textContent = String(this._lilky);
    }
  }

  toSaveData(): number {
    return this._lilky;
  }

  loadSaveData(lilky: number): void {
    this._lilky = lilky;
    this.updateHUD();
  }
}
