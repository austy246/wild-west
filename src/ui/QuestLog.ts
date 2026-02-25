import { QuestManager } from '../quest/QuestManager';
import { EventBus } from '../core/EventBus';

export class QuestLog {
  private container: HTMLElement;
  private questManager: QuestManager;

  constructor(questManager: QuestManager) {
    this.questManager = questManager;

    this.container = document.createElement('div');
    this.container.id = 'quest-log';
    this.container.style.cssText = `
      position: fixed;
      top: 56px;
      left: 16px;
      width: 220px;
      background: rgba(0, 0, 0, 0.6);
      border: 2px solid #8B4513;
      border-radius: 6px;
      padding: 10px;
      color: #DEB887;
      font-size: 13px;
      z-index: 10;
      pointer-events: none;
      max-height: 300px;
      overflow-y: auto;
    `;
    document.body.appendChild(this.container);

    // Update on quest events
    EventBus.on('quest:accepted', () => this.render());
    EventBus.on('quest:progress', () => this.render());
    EventBus.on('quest:completed', () => this.render());

    this.render();
  }

  render(): void {
    const quests = this.questManager.getActiveQuests();

    if (quests.length === 0) {
      this.container.innerHTML = `
        <div style="color:#8B7355; font-style:italic; font-size:12px;">
          Žádné aktivní úkoly
        </div>
      `;
      return;
    }

    let html = '<div style="font-weight:bold; color:#FFD700; margin-bottom:6px; border-bottom:1px solid #5d4037; padding-bottom:4px;">Úkoly</div>';

    for (const aq of quests) {
      html += `<div style="margin-bottom:8px;">`;
      html += `<div style="font-weight:bold; font-size:12px;">${aq.def.name}</div>`;
      for (const obj of aq.objectives) {
        const pct = Math.round((obj.current / obj.amount) * 100);
        const color = obj.current >= obj.amount ? '#4CAF50' : '#DEB887';
        html += `<div style="font-size:11px; color:${color}; margin-left:6px;">
          ${obj.description.replace(/\(\d+\/\d+\)/, `(${obj.current}/${obj.amount})`)}
          <div style="background:#3e2723; height:4px; border-radius:2px; margin-top:2px;">
            <div style="background:${color}; width:${pct}%; height:100%; border-radius:2px;"></div>
          </div>
        </div>`;
      }
      html += `</div>`;
    }

    this.container.innerHTML = html;
  }
}
