/**
 * PONTI ARENA - Class Balance System
 * A single source of truth for how strong every character of a given class should be, so no
 * class is systematically stronger than another (e.g. "all Tanks share the same overall power
 * budget"). This runs once, right after characters.js loads, and normalizes every character's
 * base stats before anything else (combat.js, the AI, the UI) ever reads them.
 *
 * ONLY 6 OFFICIAL CLASSES EXIST: Tank, Fighter, Assassin, Ranged, Mage, Support. Each class sets
 * a general archetype/power budget - it does NOT force every character in that class to have
 * identical numbers. Two Tanks can have very different Physical/Magical Defense splits (one leans
 * armored, the other leans magic-resistant) while still adding up to the same total Tank-level
 * defense budget - see `DEFENSE_LEAN` below. Individual character identity comes from their kit
 * (passive/skills/Ultimate), not from breaking their class's power budget.
 *
 * This also introduces the Physical/Magical damage split:
 *   - Every character has TWO defense stats: physicalDefense and magicalDefense.
 *   - Every character has an attackType ('physical' | 'magical') that determines which of the
 *     target's two defenses their Basic Attack and Skills are checked against (see combat.js).
 *   - Every character has an evasion stat (chance to fully evade an incoming hit), scaled by class.
 *
 * To retune the game later, edit the tables below - never the individual character blocks.
 */

// Per-class stat template (the power budget every character of that class shares).
// `defenseTotal` is split into physicalDefense/magicalDefense using `physicalRatio` as the
// DEFAULT lean, which individual characters can then deviate from via DEFENSE_LEAN below while
// keeping the same total (see #2 "TWO TANKS" example in the class spec).
const CLASS_BALANCE_TEMPLATE = {
  Tank:     { hp: 1250, attack: 96,  speed: 73,  defenseTotal: 236, critRate: 6,  critDmg: 150, evasion: 4,  physicalRatio: 0.55 },
  Fighter:  { hp: 1030, attack: 144, speed: 100, defenseTotal: 158, critRate: 13, critDmg: 162, evasion: 9,  physicalRatio: 0.60 },
  Assassin: { hp: 790,  attack: 135, speed: 105, defenseTotal: 110, critRate: 18, critDmg: 170, evasion: 10, physicalRatio: 0.58 },
  Ranged:   { hp: 870,  attack: 134, speed: 101, defenseTotal: 134, critRate: 17, critDmg: 162, evasion: 11, physicalRatio: 0.55 },
  Mage:     { hp: 830,  attack: 136, speed: 92,  defenseTotal: 122, critRate: 10, critDmg: 158, evasion: 7,  physicalRatio: 0.38 },
  Support:  { hp: 860,  attack: 86,  speed: 93,  defenseTotal: 128, critRate: 8,  critDmg: 150, evasion: 4,  physicalRatio: 0.42 },
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

// Thematic exceptions to the flat per-class evasion baseline (characters whose kit is specifically
// about evasion/deception/mobility get a bit more, without breaking the class power budget elsewhere).
const EVASION_OVERRIDES = {
  illusionist: 14,  // Mirror Image is her entire identity
  witch: 9,         // slightly more slippery than a typical Mage
  fencer: 13,       // Footwork is an evasion-stacking kit on top of the Fighter baseline
  void_walker: 15,  // teleport-assassin, above the Assassin baseline
  ninja: 17,        // already an evasion-flavored Assassin
};

// Per-character Defense LEAN: how far this character's Physical/Magical Defense split deviates
// from their class's default `physicalRatio`, keeping the SAME total defense budget either way.
// Positive = leans more Physical (armored); Negative = leans more Magical (warded). This is what
// makes "Tank A: high Physical DEF / low Magical DEF" and "Tank B: the reverse" both valid Tanks.
const DEFENSE_LEAN = {
  // Tanks
  knight: 0.10, guardian: 0.05, paladin: -0.08, gladiator: 0.14, frost_knight: 0.02,
  dragon_knight: 0.06, 'blood-knight': 0.08, mirror_knight: -0.05,
  // Fighters
  berserker: 0.08, 'sky-lancer': -0.04, samurai: 0.05, monk: -0.06, fencer: -0.10,
  berserker_lord: 0.10, beast_rider: 0.02,
  // Assassins
  assassin: 0.04, ninja: -0.06, vampire: 0.08, duelist: 0.02, demon_hunter: -0.04,
  void_walker: -0.10, soul_reaper: 0.00,
  // Ranged
  archer: 0.02, ranger: -0.05, gunslinger: 0.06, machinist: 0.10, pirate_captain: 0.04,
  engineer: -0.02, sniper: -0.08, beastmaster: 0.08,
  // Mages
  wizard: 0.00, warlock: -0.05, 'frost-mage': 0.02, pyromancer: -0.03, stormcaller: 0.04,
  necromancer: -0.06, illusionist: -0.10,
  gravity_mage: -0.02, plague_doctor: 0.03, rune_master: 0.06, witch: -0.08,
  // Supports
  cleric: -0.06, druid: 0.05, chronomancer: -0.10, alchemist: 0.02, oracle: -0.08,
  bard: 0.00, shadow_priest: -0.04, battle_medic: 0.08, spirit_shaman: 0.05,
};

function applyClassBalance(characters) {
  characters.forEach((character) => {
    const template = CLASS_BALANCE_TEMPLATE[character.role] || CLASS_BALANCE_TEMPLATE.Support;
    const attackType = ATTACK_TYPE_MAP[character.id] || 'physical';
    const evasion = EVASION_OVERRIDES[character.id] !== undefined ? EVASION_OVERRIDES[character.id] : template.evasion;
    const lean = DEFENSE_LEAN[character.id] || 0;
    const ratio = Math.max(0.15, Math.min(0.85, template.physicalRatio + lean));

    character.attackType = attackType;
    character.base.hp = template.hp;
    character.base.attack = template.attack;
    character.base.speed = template.speed;
    character.base.critRate = template.critRate;
    character.base.critDmg = template.critDmg;
    character.base.evasion = evasion;
    character.base.physicalDefense = Math.round(template.defenseTotal * ratio);
    character.base.magicalDefense = Math.round(template.defenseTotal * (1 - ratio));
    delete character.base.defense; // replaced by the physical/magical split above
  });
}

applyClassBalance(CHARACTERS);

// The Training Dummy isn't part of the roster (never selectable, never shown in Character
// Collection), so it's balanced by hand here instead of going through a class template - it just
// needs to be a stable, weak sparring target.
TRAINING_DUMMY.attackType = 'physical';
TRAINING_DUMMY.base.physicalDefense = 55;
TRAINING_DUMMY.base.magicalDefense = 55;
TRAINING_DUMMY.base.evasion = 0;
delete TRAINING_DUMMY.base.defense;
