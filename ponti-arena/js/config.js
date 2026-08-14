/**
 * PONTI ARENA - Static Configuration
 * Arenas, campaign stages, achievements. Data-driven so content can grow
 * without touching engine code.
 */

const ARENAS = [
  { id: 'medieval-castle', name: 'Medieval Castle', gradient: ['#2b2440', '#4a3b63'] },
  { id: 'mystic-forest', name: 'Mystic Forest', gradient: ['#152a20', '#2f5c3f'] },
  { id: 'desert-ruins', name: 'Desert Ruins', gradient: ['#3a2c18', '#77572b'] },
  { id: 'frozen-temple', name: 'Frozen Temple', gradient: ['#152836', '#345f78'] },
  { id: 'volcano', name: 'Volcano', gradient: ['#2c1414', '#6b2020'] },
];

const CAMPAIGN_STAGES = [
  { stage: 1, name: 'Forest Encounter', arena: 'mystic-forest', difficulty: 'easy',
    enemyTeam: ['ranger', 'druid', 'beastmaster', 'ranger', 'cleric'], rewardXP: 100 },
  { stage: 2, name: 'Bandit Camp', arena: 'desert-ruins', difficulty: 'normal',
    enemyTeam: ['berserker', 'gunslinger', 'ninja', 'warlock', 'cleric'], rewardXP: 140 },
  { stage: 3, name: 'Dark Ruins', arena: 'desert-ruins', difficulty: 'normal',
    enemyTeam: ['necromancer', 'warlock', 'blood-knight', 'assassin', 'druid'], rewardXP: 190 },
  { stage: 4, name: 'Frozen Fortress', arena: 'frozen-temple', difficulty: 'hard',
    enemyTeam: ['guardian', 'frost-mage', 'sky-lancer', 'stormcaller', 'cleric'], rewardXP: 240 },
  { stage: 5, name: 'Boss Battle: The Machinist Legion', arena: 'volcano', difficulty: 'expert',
    enemyTeam: ['guardian', 'machinist', 'pyromancer', 'stormcaller', 'blood-knight'], rewardXP: 350 },
];

// Named formation templates the AI can draw from (see targeting.js buildFormationFromTemplate).
// Roles listed per row are a *preference order* - any character whose role isn't present in any
// row bucket automatically falls back to a sensible default row for its role.
const AI_FORMATION_TEMPLATES = {
  balanced: {
    front: ['Tank', 'Tank', 'Bruiser'],
    middle: ['Fighter', 'Hybrid', 'Skirmisher'],
    back: ['Support', 'Mage', 'Ranged', 'Summoner', 'Control', 'Specialist'],
  },
  aggressive: {
    front: ['Fighter', 'Assassin', 'Bruiser'],
    middle: ['Assassin', 'Skirmisher', 'Fighter'],
    back: ['Ranged', 'Mage'],
  },
  ranged: {
    front: ['Tank'],
    middle: ['Mage', 'Control', 'Specialist'],
    back: ['Ranged', 'Support', 'Mage', 'Summoner'],
  },
};

const ACHIEVEMENT_DEFS = [
  { id: 'first_victory', name: 'First Victory', desc: 'Win your first battle.' },
  { id: 'ten_victories', name: '10 Victories', desc: 'Win 10 battles.' },
  { id: 'fifty_victories', name: '50 Victories', desc: 'Win 50 battles.' },
  { id: 'master_knight', name: 'Master Knight', desc: 'Reach Mastery 10 with Knight.' },
  { id: 'master_wizard', name: 'Master Wizard', desc: 'Reach Mastery 10 with Wizard.' },
  { id: 'perfect_victory', name: 'Perfect Victory', desc: 'Win a battle without losing a single character.' },
  { id: 'no_losses', name: 'Win Without Losing a Character', desc: 'Same as Perfect Victory - flawless team.' },
  { id: 'defeat_boss', name: 'Defeat a Boss', desc: 'Clear the Campaign boss stage.' },
  { id: 'ten_ultimates', name: 'Use 10 Ultimates', desc: 'Use your Ultimate ability 10 times total.' },
];
