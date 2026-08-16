export type QuestType = 'delivery' | 'collection' | 'combat';
export type QuestStatus = 'available' | 'active' | 'completed';

export interface QuestObjective {
  type: 'deliver' | 'collect' | 'kill' | 'reach';
  /** Target identifier: NPC id, item id, enemy type, or location id */
  target: string;
  /**
   * Alternative targets that also count, for objectives like "any 3 foods"
   * where several different items satisfy the same requirement.
   */
  anyOf?: string[];
  /** Human-readable description */
  description: string;
  amount: number;
  current: number;
}

export interface QuestDef {
  id: string;
  name: string;
  description: string;
  type: QuestType;
  /** NPC id who gives this quest */
  giverId: string;
  objectives: QuestObjective[];
  reward: {
    lilky: number;
  };
  isRepeatable: boolean;
}
