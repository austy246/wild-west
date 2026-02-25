import { Wallet } from './Wallet';
import { ShopItem, SHOP_ITEMS } from './ShopItems';
import { EventBus } from '../core/EventBus';

export class Shop {
  private wallet: Wallet;
  private purchasedIds = new Set<string>();

  constructor(wallet: Wallet) {
    this.wallet = wallet;
  }

  getItems(): (ShopItem & { owned: boolean; canAfford: boolean })[] {
    return SHOP_ITEMS.map((item) => ({
      ...item,
      owned: this.purchasedIds.has(item.id),
      canAfford: this.wallet.canAfford(item.price),
    }));
  }

  buy(itemId: string): boolean {
    const item = SHOP_ITEMS.find((i) => i.id === itemId);
    if (!item) return false;
    if (this.purchasedIds.has(itemId)) return false;
    if (!this.wallet.spend(item.price)) return false;

    this.purchasedIds.add(itemId);
    EventBus.emit('shop:purchased', { item });
    return true;
  }

  isOwned(itemId: string): boolean {
    return this.purchasedIds.has(itemId);
  }

  toSaveData(): string[] {
    return [...this.purchasedIds];
  }

  loadSaveData(ids: string[]): void {
    this.purchasedIds = new Set(ids);
  }
}
