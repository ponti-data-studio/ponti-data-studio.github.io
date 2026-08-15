/**
 * PONTI ARENA - Class Balance System
 * A single source of truth for how strong every character of a given class/role should be, so
 * "all Tanks are equally strong, all Mages are equally strong" instead of 50 characters' numbers
 * drifting apart across five separate content batches. This runs once, right after characters.js
 * loads, and normalizes every character's base stats to their class template before anything else
 * (combat.js, the AI, the UI) ever reads them.
 *
 * This also introduces the Physical/Magical damage split:
 *   - Every character now has TWO defense stats: physicalDefense and magicalDefense.
 *   - Every character has an attackType ('physical' | 'magical') that determines which of the
 *     target's two defenses their Basic Attack and Skills are checked against (see combat.js).
 *   - Every character has an evasion stat (chance to fully evade an incoming hit), scaled by role.
 *
 * To retune the game later, edit the tables below - never the individual character blocks.
 */

// Per-role stat template. `defenseTotal` is split into physicalDefense/magicalDefense using
// `physicalRatio` (how much of the total leans physical vs magical).
const CLASS_BALANCE_TEMPLATE = {
  Tank:       { hp: 1250, attack: 96,  speed: 73,  defenseTotal: 236, critRate: 6,  critDmg: 150, evasion: 4,  physicalRatio: 0.55 },
  Bruiser:    { hp: 1100, attack: 148, speed: 96,  defenseTotal: 172, critRate: 13, critDmg: 162, evasion: 10, physicalRatio: 0.60 },
  Fighter:    { hp: 1040, attack: 148, speed: 101, defenseTotal: 164, critRate: 14, critDmg: 165, evasion: 10, physicalRatio: 0.62 },
  Skirmisher: { hp: 900,  attack: 140, speed: 112, defenseTotal: 145, critRate: 16, critDmg: 168, evasion: 10, physicalRatio: 0.58 },
  Assassin:   { hp: 820,  attack: 155, speed: 109, defenseTotal: 120, critRate: 20, critDmg: 175, evasion: 16, physicalRatio: 0.60 },
  Ranged:     { hp: 870,  attack: 145, speed: 102, defenseTotal: 134, critRate: 18, critDmg: 165, evasion: 13, physicalRatio: 0.55 },
  Mage:       { hp: 830,  attack: 136, speed: 92,  defenseTotal: 122, critRate: 10, critDmg: 158, evasion: 7,  physicalRatio: 0.35 },
  Control:    { hp: 820,  attack: 125, speed: 93,  defenseTotal: 122, critRate: 10, critDmg: 155, evasion: 7,  physicalRatio: 0.38 },
  Support:    { hp: 860,  attack: 86,  speed: 93,  defenseTotal: 128, critRate: 8,  critDmg: 150, evasion: 4,  physicalRatio: 0.42 },
  Summoner:   { hp: 950,  attack: 110, speed: 92,  defenseTotal: 154, critRate: 9,  critDmg: 152, evasion: 4,  physicalRatio: 0.45 },
  Specialist: { hp: 900,  attack: 110, speed: 90,  defenseTotal: 148, critRate: 12, critDmg: 158, evasion: 8,  physicalRatio: 0.50 },
};

// Which of the two defenses a character's Basic Attack / Skills / Ultimate are checked against.
const ATTACK_TYPE_MAP = {
  // Physical attackers
  knight: 'physical', archer: 'physical', assassin: 'physical', berserker: 'physical',
  ranger: 'physical', ninja: 'physical', gunslinger: 'physical', beastmaster: 'physical',
  guardian: 'physical', 'blood-knight': 'physical', 'sky-lancer': 'physical', machinist: 'physical',
  paladin: 'physical', samurai: 'physical', vampire: 'physical', duelist: 'physical',
  pirate_captain: 'physical', monk: 'physical', demon_hunter: 'physical', engineer: 'physical',
  fencer: 'physical', gladiator: 'physical', frost_knight: 'physical', dragon_knight: 'physical',
  sniper: 'physical', berserker_lord: 'physical', beast_rider: 'physical', mirror_knight: 'physical',
  soul_reaper: 'physical', battle_medic: 'physical',
  // Magical attackers
  wizard: 'magical', warlock: 'magical', 'frost-mage': 'magical', pyromancer: 'magical',
  stormcaller: 'magical', necromancer: 'magical', cleric: 'magical', druid: 'magical',
  chronomancer: 'magical', illusionist: 'magical', alchemist: 'magical', spirit_shaman: 'magical',
  gravity_mage: 'magical', oracle: 'magical', bard: 'magical', plague_doctor: 'magical',
  void_walker: 'magical', shadow_priest: 'magical', rune_master: 'magical', witch: 'magical',
};

// Thematic exceptions to the flat per-class evasion baseline ("beberapa Mage/Control bisa Medium
// atau High" - characters whose kit is specifically about evasion/deception/mobility).
const EVASION_OVERRIDES = {
  illusionist: 14,  // Mirror Image is her entire identity
  witch: 9,         // slightly more slippery than a typical Control
  fencer: 13,       // Footwork is an evasion-stacking kit on top of the Fighter baseline
  void_walker: 18,  // teleport-assassin, above the Assassin baseline
  ninja: 18,        // already an evasion-flavored Assassin
};

function applyClassBalance(characters) {
  characters.forEach((character) => {
    const template = CLASS_BALANCE_TEMPLATE[character.role] || CLASS_BALANCE_TEMPLATE.Specialist;
    const attackType = ATTACK_TYPE_MAP[character.id] || 'physical';
    const evasion = EVASION_OVERRIDES[character.id] !== undefined ? EVASION_OVERRIDES[character.id] : template.evasion;

    character.attackType = attackType;
    character.base.hp = template.hp;
    character.base.attack = template.attack;
    character.base.speed = template.speed;
    character.base.critRate = template.critRate;
    character.base.critDmg = template.critDmg;
    character.base.evasion = evasion;
    character.base.physicalDefense = Math.round(template.defenseTotal * template.physicalRatio);
    character.base.magicalDefense = Math.round(template.defenseTotal * (1 - template.physicalRatio));
    delete character.base.defense; // replaced by the physical/magical split above
  });
}

applyClassBalance(CHARACTERS);

// The Training Dummy isn't part of the roster (never selectable), so it's balanced by hand here
// instead of going through the class template - it just needs to be a stable, weak sparring target.
TRAINING_DUMMY.attackType = 'physical';
TRAINING_DUMMY.base.physicalDefense = 55;
TRAINING_DUMMY.base.magicalDefense = 55;
TRAINING_DUMMY.base.evasion = 0;
delete TRAINING_DUMMY.base.defense;
