import { QuestDef } from '../types/quests';

export const QUESTS: QuestDef[] = [
  // --- Delivery quests ---
  {
    id: 'deliver-letter',
    name: 'Naléhavý dopis',
    description: 'Šerif potřebuje doručit dopis kováři. Prý je to urgentní!',
    type: 'delivery',
    giverId: 'sheriff',
    objectives: [
      { type: 'deliver', target: 'blacksmith', description: 'Doruč dopis Kováři Magnusovi', amount: 1, current: 0 },
    ],
    reward: { lilky: 50 },
    isRepeatable: true,
  },
  {
    id: 'deliver-whiskey',
    name: 'Zásilka whiskey',
    description: 'Barman potřebuje doručit bednu whiskey do hotelu.',
    type: 'delivery',
    giverId: 'bartender',
    objectives: [
      { type: 'deliver', target: 'townsfolk1', description: 'Dones whiskey Farmáři Billovi', amount: 1, current: 0 },
    ],
    reward: { lilky: 40 },
    isRepeatable: true,
  },
  {
    id: 'deliver-horseshoe',
    name: 'Nová podkova',
    description: 'Kovář vyrobil podkovu. Odnes ji do stájí.',
    type: 'delivery',
    giverId: 'blacksmith',
    objectives: [
      { type: 'deliver', target: 'townsfolk3', description: 'Dones podkovu Starému Tomovi', amount: 1, current: 0 },
    ],
    reward: { lilky: 35 },
    isRepeatable: true,
  },
  // --- Collection quests ---
  {
    id: 'collect-nuggets',
    name: 'Zlatá horečka',
    description: 'Mary slyšela o zlatých nugetech rozházených kolem města. Najdi jich 5!',
    type: 'collection',
    giverId: 'townsfolk2',
    objectives: [
      { type: 'collect', target: 'gold-nugget', description: 'Najdi zlaté nugety (0/5)', amount: 5, current: 0 },
    ],
    reward: { lilky: 80 },
    isRepeatable: false,
  },
  {
    id: 'collect-herbs',
    name: 'Léčivé byliny',
    description: 'Starý Tom potřebuje byliny na svůj lektvar. Najdi 3 trsy bylin.',
    type: 'collection',
    giverId: 'townsfolk3',
    objectives: [
      { type: 'collect', target: 'herb', description: 'Najdi léčivé byliny (0/3)', amount: 3, current: 0 },
    ],
    reward: { lilky: 45 },
    isRepeatable: true,
  },
  {
    id: 'collect-wood',
    name: 'Dřevo na opravu',
    description: 'Obchodník Pete potřebuje dřevo na opravu svého krámu.',
    type: 'collection',
    giverId: 'shopkeeper',
    objectives: [
      { type: 'collect', target: 'wood', description: 'Sesbírej kusy dřeva (0/4)', amount: 4, current: 0 },
    ],
    reward: { lilky: 55 },
    isRepeatable: true,
  },
  // --- Combat quests ---
  {
    id: 'kill-bandits-1',
    name: 'Vyčisti okolí',
    description: 'Šerif potřebuje pomoct! Zlikviduj 3 bandity za městem.',
    type: 'combat',
    giverId: 'sheriff',
    objectives: [
      { type: 'kill', target: 'bandit', description: 'Zabij bandity (0/3)', amount: 3, current: 0 },
    ],
    reward: { lilky: 100 },
    isRepeatable: true,
  },
  {
    id: 'kill-bandits-2',
    name: 'Bandita kapitán',
    description: 'U staré šachty se ukrývá banditský kapitán s posádkou. Zlikviduj je všechny!',
    type: 'combat',
    giverId: 'sheriff',
    objectives: [
      { type: 'kill', target: 'bandit', description: 'Zabij bandity (0/5)', amount: 5, current: 0 },
    ],
    reward: { lilky: 150 },
    isRepeatable: true,
  },
  {
    id: 'protect-town',
    name: 'Ochrana města',
    description: 'Farmář Bill viděl bandity blížit se k městu. Zastav je!',
    type: 'combat',
    giverId: 'townsfolk1',
    objectives: [
      { type: 'kill', target: 'bandit', description: 'Zabij bandity (0/2)', amount: 2, current: 0 },
    ],
    reward: { lilky: 70 },
    isRepeatable: true,
  },
];
