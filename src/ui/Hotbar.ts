import { EventBus } from '../core/EventBus';

const SLOT_COUNT = 7;

/** Items that never go into the inventory */
const EXCLUDED_ITEMS = new Set(['save-elixir', 'werewolf-flyer']);

const ITEM_NAMES: Record<string, string> = {
  'gold-nugget': 'Zlatý nugget',
  'herb': 'Bylinka',
  'wood': 'Dřevo',
  'steak': 'Stejk',
  'beans': 'Fazole',
  'water': 'Voda',
  'whisky': 'Whisky',
  'ammo': 'Náboj',
  'knife': 'Nůž',
  'shotgun': 'Brokovnice',
  'magic-plant': 'Kouzelná rostlinka',
};

const FOOD_HUNGER: Record<string, number> = {
  'steak': 40,
  'beans': 25,
  'water': 15,
  'whisky': 10,
  'herb': 25,
};

interface SlotData {
  itemType: string | null;
  count: number;
}

/** Cache for rendered item icon data URLs */
const iconCache: Record<string, string> = {};

/** Draw a gold nugget icon on a canvas and return a data URL */
function drawGoldNuggetIcon(): string {
  const s = 48;
  const c = document.createElement('canvas');
  c.width = s; c.height = s;
  const ctx = c.getContext('2d')!;

  // Main rocky body
  ctx.save();
  ctx.translate(s / 2, s / 2 + 2);
  ctx.beginPath();
  // Irregular rocky outline
  const points = [
    [-16, -6], [-12, -11], [-4, -13], [4, -12], [12, -10],
    [17, -5], [18, 1], [15, 7], [10, 10], [2, 12],
    [-8, 11], [-15, 7], [-18, 2], [-17, -3],
  ];
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev[0] + curr[0]) / 2 + (Math.sin(i * 3) * 2);
    const cpy = (prev[1] + curr[1]) / 2 + (Math.cos(i * 2) * 2);
    ctx.quadraticCurveTo(cpx, cpy, curr[0], curr[1]);
  }
  ctx.closePath();

  // Gold gradient fill
  const grad = ctx.createRadialGradient(-3, -4, 2, 0, 0, 20);
  grad.addColorStop(0, '#ffe066');
  grad.addColorStop(0.3, '#ffd700');
  grad.addColorStop(0.6, '#daa520');
  grad.addColorStop(1, '#b8860b');
  ctx.fillStyle = grad;
  ctx.fill();

  // Dark edge outline
  ctx.strokeStyle = '#8b6914';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Crevice lines for rocky texture
  ctx.strokeStyle = 'rgba(120, 80, 20, 0.5)';
  ctx.lineWidth = 0.8;
  const crevices = [
    [[-6, -8], [2, -2], [8, -4]],
    [[-10, 2], [-2, 5], [6, 3]],
    [[0, -6], [-4, 2], [-8, 6]],
    [[8, -8], [10, 0], [6, 7]],
  ];
  for (const line of crevices) {
    ctx.beginPath();
    ctx.moveTo(line[0][0], line[0][1]);
    for (let i = 1; i < line.length; i++) {
      ctx.lineTo(line[i][0], line[i][1]);
    }
    ctx.stroke();
  }

  // Shiny highlights
  ctx.fillStyle = 'rgba(255, 240, 150, 0.6)';
  ctx.beginPath(); ctx.ellipse(-5, -6, 4, 2.5, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255, 245, 180, 0.4)';
  ctx.beginPath(); ctx.ellipse(6, -3, 3, 1.8, 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 200, 0.3)';
  ctx.beginPath(); ctx.ellipse(-2, 4, 2, 1.5, 0, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
  return c.toDataURL();
}

/** Draw a herb icon */
function drawHerbIcon(): string {
  const s = 48;
  const c = document.createElement('canvas');
  c.width = s; c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.translate(s / 2, s / 2 + 4);

  // Stem
  ctx.strokeStyle = '#2e7d32';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, 12); ctx.quadraticCurveTo(1, 0, 0, -8); ctx.stroke();

  // Leaves
  ctx.fillStyle = '#4caf50';
  for (const [angle, lx, ly] of [[-0.5, -5, -2], [0.4, 5, -4], [-0.3, -4, 4], [0.3, 6, 2]] as [number, number, number][]) {
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(angle);
    ctx.beginPath(); ctx.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Flower
  ctx.fillStyle = '#ffeb3b';
  ctx.beginPath(); ctx.arc(0, -10, 3.5, 0, Math.PI * 2); ctx.fill();

  return c.toDataURL();
}

/** Draw a wood icon */
function drawWoodIcon(): string {
  const s = 48;
  const c = document.createElement('canvas');
  c.width = s; c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.translate(s / 2, s / 2);

  // Log body
  ctx.fillStyle = '#8d6e63';
  ctx.beginPath();
  ctx.roundRect(-12, -8, 24, 16, 3);
  ctx.fill();
  ctx.strokeStyle = '#5d4037';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Wood grain lines
  ctx.strokeStyle = 'rgba(93, 64, 55, 0.4)';
  ctx.lineWidth = 0.8;
  for (const y of [-4, 0, 4]) {
    ctx.beginPath(); ctx.moveTo(-10, y); ctx.lineTo(10, y); ctx.stroke();
  }

  // Cross section circle (end of log)
  ctx.fillStyle = '#a1887f';
  ctx.beginPath(); ctx.ellipse(-12, 0, 5, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#5d4037';
  ctx.stroke();
  // Rings
  ctx.strokeStyle = 'rgba(93, 64, 55, 0.3)';
  ctx.beginPath(); ctx.ellipse(-12, 0, 3, 5, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-12, 0, 1.5, 2.5, 0, 0, Math.PI * 2); ctx.stroke();

  return c.toDataURL();
}

function drawFoodIcon(emoji: string): string {
  const s = 48;
  const c = document.createElement('canvas');
  c.width = s; c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.font = '32px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, s / 2, s / 2);
  return c.toDataURL();
}

function drawShotgunIcon(): string {
  const s = 48;
  const c = document.createElement('canvas');
  c.width = s; c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.save();
  ctx.translate(s / 2, s / 2);
  ctx.rotate(-0.4);
  // Barrel (double barrel)
  ctx.fillStyle = '#555';
  ctx.fillRect(-20, -4, 28, 3);
  ctx.fillRect(-20, 1, 28, 3);
  // Stock
  ctx.fillStyle = '#6b3a1a';
  ctx.beginPath();
  ctx.moveTo(8, -5);
  ctx.lineTo(22, -8);
  ctx.lineTo(24, 8);
  ctx.lineTo(8, 5);
  ctx.closePath();
  ctx.fill();
  // Trigger guard
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(6, 6, 4, 0, Math.PI);
  ctx.stroke();
  // Trigger
  ctx.fillStyle = '#444';
  ctx.fillRect(5, 5, 2, 4);
  // Barrel end
  ctx.fillStyle = '#333';
  ctx.fillRect(-22, -5, 3, 10);
  ctx.restore();
  return c.toDataURL();
}

/** Draw Wazovský's glowing magic plant */
function drawMagicPlantIcon(): string {
  const s = 48;
  const c = document.createElement('canvas');
  c.width = s; c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.translate(s / 2, s / 2 + 6);

  // Glow behind the plant
  const glow = ctx.createRadialGradient(0, -4, 1, 0, -4, 20);
  glow.addColorStop(0, 'rgba(140, 255, 90, 0.55)');
  glow.addColorStop(1, 'rgba(140, 255, 90, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, -4, 20, 0, Math.PI * 2); ctx.fill();

  // Stem
  ctx.strokeStyle = '#2e7d32';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, 14); ctx.quadraticCurveTo(-2, 2, 0, -10); ctx.stroke();

  // Serrated leaf fans
  ctx.fillStyle = '#55dd44';
  for (const [angle, lx, ly, len] of [
    [-0.9, -7, -3, 9], [0.9, 7, -3, 9],
    [-0.4, -6, 4, 7], [0.4, 6, 4, 7],
    [0, 0, -13, 8],
  ] as [number, number, number, number][]) {
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(angle);
    ctx.beginPath(); ctx.ellipse(0, 0, len, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Bright bud
  ctx.fillStyle = '#bfff3a';
  ctx.beginPath(); ctx.arc(0, -12, 3, 0, Math.PI * 2); ctx.fill();

  return c.toDataURL();
}

function getItemIcon(itemType: string): string {
  if (!iconCache[itemType]) {
    switch (itemType) {
      case 'gold-nugget': iconCache[itemType] = drawGoldNuggetIcon(); break;
      case 'herb': iconCache[itemType] = drawHerbIcon(); break;
      case 'wood': iconCache[itemType] = drawWoodIcon(); break;
      case 'steak': iconCache[itemType] = drawFoodIcon('🥩'); break;
      case 'beans': iconCache[itemType] = drawFoodIcon('🫘'); break;
      case 'water': iconCache[itemType] = drawFoodIcon('💧'); break;
      case 'whisky': iconCache[itemType] = drawFoodIcon('🥃'); break;
      case 'ammo': iconCache[itemType] = drawFoodIcon('💥'); break;
      case 'knife': iconCache[itemType] = drawFoodIcon('🔪'); break;
      case 'shotgun': iconCache[itemType] = drawShotgunIcon(); break;
      case 'magic-plant': iconCache[itemType] = drawMagicPlantIcon(); break;
      default: iconCache[itemType] = '';
    }
  }
  return iconCache[itemType];
}

/**
 * Minecraft-style hotbar with 7 inventory slots.
 * Items are added when collected in the world.
 */
export class Hotbar {
  private selectedSlot = 0;
  private slots: HTMLElement[];
  private inventory: SlotData[] = [];
  private isFullHp: () => boolean;

  constructor(isFullHp: () => boolean) {
    this.isFullHp = isFullHp;
    this.slots = Array.from(document.querySelectorAll('.hotbar-slot'));

    for (let i = 0; i < SLOT_COUNT; i++) {
      this.inventory.push({ itemType: null, count: 0 });
    }

    // Keyboard selection (1–7)
    window.addEventListener('keydown', (e) => {
      const num = parseInt(e.key);
      if (num >= 1 && num <= SLOT_COUNT) {
        this.select(num - 1);
      }
    });

    // Click selection
    for (let i = 0; i < this.slots.length; i++) {
      this.slots[i].style.pointerEvents = 'auto';
      this.slots[i].addEventListener('click', () => this.select(i));
    }

    // Mouse wheel to cycle slots
    window.addEventListener('wheel', (e) => {
      if (e.deltaY > 0) {
        this.select((this.selectedSlot + 1) % SLOT_COUNT);
      } else if (e.deltaY < 0) {
        this.select((this.selectedSlot + SLOT_COUNT - 1) % SLOT_COUNT);
      }
    });

    // Listen for item pickups
    EventBus.on('item:collected', (data: { itemType: string }) => {
      this.onItemCollected(data.itemType);
    });
  }

  private onItemCollected(itemType: string): void {
    if (EXCLUDED_ITEMS.has(itemType)) return;
    this.addItem(itemType);
  }

  private select(index: number): void {
    this.slots[this.selectedSlot]?.classList.remove('selected');
    this.selectedSlot = index;
    this.slots[this.selectedSlot]?.classList.add('selected');
    this.updateWeaponIndicator();
  }

  private updateWeaponIndicator(): void {
    const el = document.getElementById('weapon-name');
    if (!el) return;
    const item = this.inventory[this.selectedSlot]?.itemType;
    el.textContent = item ? (ITEM_NAMES[item] ?? item) : 'Prázdné';
  }

  addItem(itemType: string): void {
    for (let i = 0; i < SLOT_COUNT; i++) {
      if (this.inventory[i].itemType === itemType) {
        this.inventory[i].count++;
        this.renderSlot(i);
        if (i === this.selectedSlot) this.updateWeaponIndicator();
        return;
      }
    }
    for (let i = 0; i < SLOT_COUNT; i++) {
      if (this.inventory[i].itemType === null) {
        this.inventory[i].itemType = itemType;
        this.inventory[i].count = 1;
        this.renderSlot(i);
        if (i === this.selectedSlot) this.updateWeaponIndicator();
        return;
      }
    }
  }

  /** Remove every stack of an item type (e.g. the plants handed to Wazovský). */
  removeAllOf(itemType: string): number {
    let removed = 0;
    for (let i = 0; i < SLOT_COUNT; i++) {
      if (this.inventory[i].itemType === itemType) {
        removed += this.inventory[i].count;
        this.inventory[i].itemType = null;
        this.inventory[i].count = 0;
        this.renderSlot(i);
      }
    }
    if (removed > 0) this.updateWeaponIndicator();
    return removed;
  }

  private renderSlot(index: number): void {
    const slot = this.slots[index];
    if (!slot) return;
    const data = this.inventory[index];
    const itemEl = slot.querySelector('.hotbar-item') as HTMLElement;
    const countEl = slot.querySelector('.hotbar-count') as HTMLElement;

    if (data.itemType && data.count > 0) {
      const iconUrl = getItemIcon(data.itemType);
      if (iconUrl) {
        itemEl.textContent = '';
        itemEl.style.backgroundImage = `url(${iconUrl})`;
        itemEl.style.backgroundSize = 'contain';
        itemEl.style.backgroundRepeat = 'no-repeat';
        itemEl.style.backgroundPosition = 'center';
      } else {
        itemEl.textContent = '?';
        itemEl.style.backgroundImage = '';
      }
      countEl.textContent = data.count > 1 ? String(data.count) : '';
    } else {
      itemEl.textContent = '';
      itemEl.style.backgroundImage = '';
      countEl.textContent = '';
    }
  }

  getSelectedSlot(): number {
    return this.selectedSlot;
  }

  getSelectedItem(): string | null {
    return this.inventory[this.selectedSlot]?.itemType ?? null;
  }

  isSelectedFood(): boolean {
    const item = this.getSelectedItem();
    return item !== null && (item in FOOD_HUNGER || item === 'ammo') && item !== 'shotgun';
  }

  /** Try to consume selected food item. Returns { hunger, name } or null. */
  consumeSelected(): { hunger: number; name: string } | null {
    const data = this.inventory[this.selectedSlot];
    if (!data || !data.itemType || data.count <= 0) return null;
    const hungerVal = FOOD_HUNGER[data.itemType];
    if (!hungerVal) return null;
    const name = ITEM_NAMES[data.itemType] ?? data.itemType;
    data.count--;
    if (data.count <= 0) {
      data.itemType = null;
      data.count = 0;
    }
    this.renderSlot(this.selectedSlot);
    this.updateWeaponIndicator();
    return { hunger: hungerVal, name };
  }
}
