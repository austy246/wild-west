import { QuestDef, QuestObjective, QuestStatus } from '../types/quests';
import { QUESTS } from './QuestDatabase';
import { EventBus } from '../core/EventBus';

interface ActiveQuest {
  def: QuestDef;
  objectives: QuestObjective[];
}

export class QuestManager {
  private activeQuests: ActiveQuest[] = [];
  private completedQuestIds = new Set<string>();

  constructor() {
    // Listen for relevant game events
    EventBus.on('combat:kill', (data: { enemyType: string }) => {
      this.updateObjectives('kill', data.enemyType, 1);
    });

    EventBus.on('item:collected', (data: { itemType: string }) => {
      this.updateObjectives('collect', data.itemType, 1);
    });
  }

  /** Get quests available from a specific NPC */
  getAvailableQuests(npcId: string): QuestDef[] {
    return QUESTS.filter((q) => {
      if (q.giverId !== npcId) return false;
      // Already active?
      if (this.activeQuests.some((a) => a.def.id === q.id)) return false;
      // Already completed and not repeatable?
      if (this.completedQuestIds.has(q.id) && !q.isRepeatable) return false;
      return true;
    });
  }

  /** Accept a quest */
  accept(questId: string): boolean {
    const def = QUESTS.find((q) => q.id === questId);
    if (!def) return false;
    if (this.activeQuests.some((a) => a.def.id === questId)) return false;

    // Deep-clone objectives so each instance tracks separately
    const objectives = def.objectives.map((o) => ({ ...o, current: 0 }));
    this.activeQuests.push({ def, objectives });

    EventBus.emit('quest:accepted', { questId: def.id, name: def.name });
    return true;
  }

  /** Check if a delivery quest can be turned in to a specific NPC */
  getDeliveryReady(npcId: string): ActiveQuest | null {
    return this.activeQuests.find((aq) => {
      return aq.def.type === 'delivery' &&
        aq.objectives.some((o) => o.type === 'deliver' && o.target === npcId && o.current < o.amount);
    }) ?? null;
  }

  /** Complete a delivery objective to a specific NPC */
  completeDelivery(npcId: string): void {
    const aq = this.getDeliveryReady(npcId);
    if (!aq) return;
    for (const obj of aq.objectives) {
      if (obj.type === 'deliver' && obj.target === npcId) {
        obj.current = obj.amount;
      }
    }
    this.checkCompletion(aq);
  }

  /** Update objectives matching type and target */
  private updateObjectives(type: string, target: string, amount: number): void {
    for (const aq of this.activeQuests) {
      for (const obj of aq.objectives) {
        if (obj.type === type && obj.target === target && obj.current < obj.amount) {
          obj.current = Math.min(obj.current + amount, obj.amount);
          EventBus.emit('quest:progress', {
            questId: aq.def.id,
            objective: obj.description,
            current: obj.current,
            amount: obj.amount,
          });
        }
      }
      this.checkCompletion(aq);
    }
  }

  /** Check if all objectives are done, and if so, complete the quest */
  private checkCompletion(aq: ActiveQuest): void {
    const allDone = aq.objectives.every((o) => o.current >= o.amount);
    if (!allDone) return;

    // Remove from active
    this.activeQuests = this.activeQuests.filter((a) => a !== aq);
    this.completedQuestIds.add(aq.def.id);

    EventBus.emit('quest:completed', {
      questId: aq.def.id,
      name: aq.def.name,
      reward: aq.def.reward,
    });
    EventBus.emit('economy:earn', { amount: aq.def.reward.lilky });
  }

  /** Get all currently active quests (for UI display) */
  getActiveQuests(): ActiveQuest[] {
    return this.activeQuests;
  }

  /** Serializable state for saving */
  toSaveData(): { active: { id: string; objectives: { current: number }[] }[]; completed: string[] } {
    return {
      active: this.activeQuests.map((aq) => ({
        id: aq.def.id,
        objectives: aq.objectives.map((o) => ({ current: o.current })),
      })),
      completed: [...this.completedQuestIds],
    };
  }

  /** Restore from save data */
  loadSaveData(data: { active: { id: string; objectives: { current: number }[] }[]; completed: string[] }): void {
    this.completedQuestIds = new Set(data.completed);
    this.activeQuests = [];
    for (const saved of data.active) {
      const def = QUESTS.find((q) => q.id === saved.id);
      if (!def) continue;
      const objectives = def.objectives.map((o, i) => ({
        ...o,
        current: saved.objectives[i]?.current ?? 0,
      }));
      this.activeQuests.push({ def, objectives });
    }
  }
}
