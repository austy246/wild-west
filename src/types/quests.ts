export type QuestType = 'delivery' | 'collection' | 'combat';
export type QuestStatus = 'available' | 'active' | 'completed';

export interface QuestObjective {
  type: 'deliver' | 'collect' | 'kill';
  /** Target identifier: NPC id, item id, or enemy type */
  target: string;
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
