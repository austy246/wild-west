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
  // --- Wazovský story chain (added programmatically, not offered by NPCs) ---
  {
    id: 'wazovsky-supplies',
    name: 'Wazovského zásoby',
    description: 'Wazovskému došly zásoby. Zajdi za kostel a nasbírej mu novou trávu.',
    type: 'collection',
    giverId: 'wazovsky-story', // no NPC has this id → never auto-offered
    objectives: [
      { type: 'reach', target: 'behind-church', description: 'Zajdi za kostel', amount: 1, current: 0 },
      { type: 'collect', target: 'magic-plant', description: 'Nasbírej kouzelné rostlinky (0/5)', amount: 5, current: 0 },
    ],
    reward: { lilky: 0 },
    isRepeatable: false,
  },
  {
    id: 'wazovsky-delivery',
    name: 'Dones trávu Wazovskému',
    description: 'Dones nasbírané kouzelné rostlinky panu Wazovskému na kupku sena.',
    type: 'delivery',
    giverId: 'wazovsky-story',
    objectives: [
      { type: 'deliver', target: 'wazovsky', description: 'Dones rostlinku Wazovskému', amount: 1, current: 0 },
    ],
    reward: { lilky: 800 },
    isRepeatable: false,
  },
  {
    id: 'mary-pendant',
    name: 'Mary ti musí něco říct',
    description: 'Wazovský tě posílá za Mary. Prý ti musí něco důležitého říct.',
    type: 'delivery',
    giverId: 'wazovsky-story',
    objectives: [
      { type: 'deliver', target: 'townsfolk2', description: 'Zajdi za Mary', amount: 1, current: 0 },
    ],
    reward: { lilky: 0 },
    isRepeatable: false,
  },
  {
    id: 'sleep-at-wazovsky',
    name: 'Vyspi se',
    description: 'Je noc a všichni už spí. Taky by ses mohl vyspat — zajdi za Wazovským na kupku sena.',
    type: 'delivery',
    giverId: 'wazovsky-story',
    objectives: [
      { type: 'deliver', target: 'wazovsky', description: 'Vyspi se u Wazovského', amount: 1, current: 0 },
    ],
    reward: { lilky: 0 },
    isRepeatable: false,
  },
  {
    id: 'werewolf-flyer',
    name: 'Co to bylo za povyk?',
    description: 'Z vozu rozházeli po cestě letáky. Zvedni jeden a přečti si ho.',
    type: 'collection',
    giverId: 'wazovsky-story',
    objectives: [
      { type: 'collect', target: 'werewolf-flyer', description: 'Zvedni leták', amount: 1, current: 0 },
    ],
    reward: { lilky: 0 },
    isRepeatable: false,
  },
  {
    id: 'buy-supplies',
    name: 'Nakup zásoby',
    description:
      'V noci tu bude vlkodlak a ty nechceš vybíhat ven o hladu. Kup si v obchodě aspoň 3 vody a 3 jídla.',
    type: 'collection',
    giverId: 'wazovsky-story',
    objectives: [
      {
        type: 'collect', target: 'water',
        description: 'Nakup vodu (0/3)', amount: 3, current: 0,
      },
      {
        type: 'collect', target: 'steak', anyOf: ['beans', 'herb'],
        description: 'Nakup jídlo (0/3)', amount: 3, current: 0,
      },
    ],
    reward: { lilky: 0 },
    isRepeatable: false,
  },
  {
    id: 'hide-in-cellar',
    name: 'Schovej se ve sklepě',
    description: 'Všichni se schovávají ve sklepě za kostelem. Běž tam za nimi, než padne noc.',
    type: 'collection',
    giverId: 'wazovsky-story',
    objectives: [
      { type: 'reach', target: 'church-cellar', description: 'Schovej se ve sklepě za kostelem', amount: 1, current: 0 },
    ],
    reward: { lilky: 0 },
    isRepeatable: false,
  },
  {
    id: 'ride-north',
    name: 'Jeď na sever',
    description: 'Z města nezbylo nic. Nasedni na koně a jeď na sever — kompas ti ukáže směr.',
    type: 'collection',
    giverId: 'wazovsky-story',
    objectives: [
      { type: 'reach', target: 'north-cabin', description: 'Dojeď k domku na severu', amount: 1, current: 0 },
    ],
    reward: { lilky: 0 },
    isRepeatable: false,
  },
];
