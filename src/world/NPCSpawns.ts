import { NPCDef } from '../entities/NPC';

/** All NPC definitions — positioned relative to the village layout */
export const NPC_DEFS: NPCDef[] = [
  {
    id: 'sheriff',
    name: 'Šerif Buck',
    color: 0x1565c0,  // blue uniform
    hatColor: 0x222222,
    x: 8, z: -10,
    patrolRadius: 3,
    dialog: 'Howdy, příteli! Tady ve městě to není bezpečné. Banditi se potulují za městem.',
  },
  {
    id: 'shopkeeper',
    name: 'Obchodník Pete',
    color: 0x558b2f,  // green apron
    hatColor: 0x8d6e63,
    x: 9, z: 10,
    patrolRadius: 2,
    dialog: 'Vítej v mém obchodě! Mám nejlepší zboží v celém kraji.',
  },
  {
    id: 'bartender',
    name: 'Barman Joe',
    color: 0xf5f5f5,  // white shirt
    hatColor: 0x3e2723,
    x: 8, z: 22,
    patrolRadius: 0, // stationary
    dialog: 'Co to bude? Whiskey, nebo máš chuť na práci? Mám pár úkolů...',
  },
  {
    id: 'blacksmith',
    name: 'Kovář Magnus',
    color: 0x424242,  // dark shirt
    hatColor: 0x5d4037,
    x: -8, z: -22,
    patrolRadius: 2,
    dialog: 'Potřebuješ nabrousit zbraně? Nebo něco opravit? Jsem tvůj muž.',
  },
  {
    id: 'townsfolk1',
    name: 'Farmář Bill',
    color: 0xc49a6c,  // tan shirt
    hatColor: 0xf5deb3,
    x: -5, z: 5,
    patrolRadius: 8,
    dialog: 'Krásný den, co? Jen aby ti banditi nedělali potíže...',
  },
  {
    id: 'townsfolk2',
    name: 'Mary',
    color: 0xad1457,  // red dress
    hatColor: 0xf8bbd0,
    x: 5, z: -3,
    patrolRadius: 6,
    dialog: 'Slyšela jsem, že u staré studny se něco leskne. Možná zlato?',
  },
  {
    id: 'townsfolk3',
    name: 'Starý Tom',
    color: 0x6d4c41,  // brown coat
    hatColor: 0x4e342e,
    x: -3, z: 18,
    patrolRadius: 5,
    dialog: 'Za mých mladých let tu banditi nebyli. Teď se to tu hemží...',
  },
];
