const SAVE_KEY = 'wild-west-save';
const SAVE_VERSION = 1;

export interface SaveData {
  version: number;
  timestamp: number;
  player: {
    x: number;
    y: number;
    z: number;
    hp: number;
    maxHp: number;
  };
  wallet: number;
  quests: {
    active: { id: string; objectives: { current: number }[] }[];
    completed: string[];
  };
  shop: string[];
  unlockedWeapons: string[];
  currentWeapon: string;
  collectedItems: string[];
}

export class SaveManager {
  /** Save game state to localStorage */
  static save(data: SaveData): boolean {
    try {
      data.version = SAVE_VERSION;
      data.timestamp = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch {
      console.error('Failed to save game');
      return false;
    }
  }

  /** Load game state from localStorage */
  static load(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as SaveData;
      if (data.version !== SAVE_VERSION) {
        console.warn('Save version mismatch, starting fresh');
        return null;
      }
      return data;
    } catch {
      console.error('Failed to load save');
      return null;
    }
  }

  /** Check if a save exists */
  static hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  /** Delete save data */
  static deleteSave(): void {
    localStorage.removeItem(SAVE_KEY);
  }
}
