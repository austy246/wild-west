export type ItemCategory = 'weapon' | 'cosmetic' | 'upgrade';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  price: number;
  /** For weapons, the weapon type to unlock */
  weaponType?: string;
  /** For upgrades, the stat to boost */
  upgradeType?: 'maxHp' | 'speed' | 'damage';
  upgradeValue?: number;
}

export const SHOP_ITEMS: ShopItem[] = [
  // Weapons
  {
    id: 'lasso',
    name: 'Laso',
    description: 'Omráčí nepřátele na 2 sekundy. Dosah 4m.',
    category: 'weapon',
    price: 80,
    weaponType: 'lasso',
  },
  {
    id: 'revolver',
    name: 'Revolver',
    description: 'Klasická šestiraná. 25 poškození, 6 nábojů.',
    category: 'weapon',
    price: 150,
    weaponType: 'revolver',
  },
  {
    id: 'rifle',
    name: 'Puška',
    description: 'Silná jednoranka. 40 poškození, velký dosah.',
    category: 'weapon',
    price: 250,
    weaponType: 'rifle',
  },
  // Upgrades
  {
    id: 'hp-boost',
    name: 'Odolnost',
    description: '+25 maximální HP',
    category: 'upgrade',
    price: 100,
    upgradeType: 'maxHp',
    upgradeValue: 25,
  },
  {
    id: 'speed-boost',
    name: 'Rychlé boty',
    description: '+15% rychlost pohybu',
    category: 'upgrade',
    price: 120,
    upgradeType: 'speed',
    upgradeValue: 15,
  },
  {
    id: 'damage-boost',
    name: 'Ostrá munice',
    description: '+20% poškození zbraní',
    category: 'upgrade',
    price: 180,
    upgradeType: 'damage',
    upgradeValue: 20,
  },
  // Cosmetics
  {
    id: 'hat-gold',
    name: 'Zlatý klobouk',
    description: 'Luxusní zlatý kovbojský klobouk.',
    category: 'cosmetic',
    price: 200,
  },
  {
    id: 'hat-white',
    name: 'Bílý klobouk',
    description: 'Elegantní bílý klobouk dobrého kovboje.',
    category: 'cosmetic',
    price: 75,
  },
  {
    id: 'coat-red',
    name: 'Červený kabát',
    description: 'Výrazný červený kabát.',
    category: 'cosmetic',
    price: 90,
  },
];
