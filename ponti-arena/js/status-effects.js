/**
 * PONTI ARENA - Status Effect Engine
 * A single, centralized definition for every status effect in the game.
 * Battle actors carry an array of { id, duration, stacks, source } instances
 * built from these definitions. All resolution goes through StatusEngine.
 */

const STATUS_DEFS = {
  burn:            { name: 'Burn',            icon: '🔥', kind: 'dot',    stackable: true,  maxStacks: 3, tickPercent: 4,  category: 'debuff' },
  poison:          { name: 'Poison',          icon: '☣️', kind: 'dot',    stackable: true,  maxStacks: 5, tickPercent: 3,  category: 'debuff' },
  bleed:           { name: 'Bleed',           icon: '🩸', kind: 'dot',    stackable: true,  maxStacks: 3, tickPercent: 5,  category: 'debuff' },
  freeze:          { name: 'Freeze',          icon: '🧊', kind: 'cc',     stackable: false, maxStacks: 1, category: 'debuff', skipTurn: true },
  stun:            { name: 'Stun',            icon: '💫', kind: 'cc',     stackable: false, maxStacks: 1, category: 'debuff', skipTurn: true },
  slow:            { name: 'Slow',            icon: '🐌', kind: 'stat',   stackable: false, maxStacks: 1, category: 'debuff', stat: 'speed', percent: -25 },
  speed_down:      { name: 'Speed Down',      icon: '🐌', kind: 'stat',   stackable: false, maxStacks: 1, category: 'debuff', stat: 'speed', percent: -20 },
  silence:         { name: 'Silence',         icon: '🔇', kind: 'cc',     stackable: false, maxStacks: 1, category: 'debuff', silence: true },
  root:            { name: 'Root',            icon: '🌿', kind: 'cc',     stackable: false, maxStacks: 1, category: 'debuff', skipTurn: true },
  attack_up:       { name: 'Attack Up',       icon: '⬆️', kind: 'stat',   stackable: false, maxStacks: 1, category: 'buff', stat: 'attack', percent: 25 },
  attack_down:     { name: 'Attack Down',     icon: '⬇️', kind: 'stat',   stackable: false, maxStacks: 1, category: 'debuff', stat: 'attack', percent: -25 },
  defense_up:      { name: 'Defense Up',      icon: '🛡️', kind: 'stat',   stackable: false, maxStacks: 1, category: 'buff', stat: 'defense', percent: 35 },
  defense_down:    { name: 'Defense Down',    icon: '💢', kind: 'stat',   stackable: false, maxStacks: 1, category: 'debuff', stat: 'defense', percent: -25 },
  speed_up:        { name: 'Speed Up',        icon: '💨', kind: 'stat',   stackable: false, maxStacks: 1, category: 'buff', stat: 'speed', percent: 30 },
  regeneration:    { name: 'Regeneration',    icon: '💚', kind: 'hot',    stackable: false, maxStacks: 1, category: 'buff', tickPercent: 6 },
  shield:          { name: 'Shield',          icon: '🔷', kind: 'shield', stackable: true,  maxStacks: 3, category: 'buff' },
  mark:            { name: 'Mark',            icon: '🎯', kind: 'stat',   stackable: false, maxStacks: 1, category: 'debuff', incomingDamagePercent: 15 },
  curse:           { name: 'Curse',           icon: '🕸️', kind: 'stat',   stackable: false, maxStacks: 1, category: 'debuff', stat: 'attack', percent: -15 },
  beast_companion: { name: 'Beast Companion', icon: '🐾', kind: 'stat',   stackable: false, maxStacks: 1, category: 'buff', stat: 'attack', percent: 20 },
  counter_stance:  { name: 'Counter Stance',  icon: '⚔️', kind: 'special',stackable: false, maxStacks: 1, category: 'buff' },

  // ---- New statuses for the 30-character roster expansion ----
  guardians_oath:  { name: "Guardian's Oath", icon: '🤍', kind: 'special', stackable: false, maxStacks: 1, category: 'buff' },   // Paladin: protected ally
  divine_shield:   { name: 'Divine Shield',   icon: '✝️', kind: 'special', stackable: false, maxStacks: 1, category: 'buff' },   // Paladin ultimate: prevents one lethal hit
  iaido_stance:    { name: 'Iaido Stance',    icon: '⚡', kind: 'special', stackable: false, maxStacks: 1, category: 'buff' },   // Samurai: counter or bonus next hit
  iaido_ready:     { name: 'Iaido Ready',     icon: '🗡️', kind: 'special', stackable: false, maxStacks: 1, category: 'buff' },   // Samurai: bonus damage on next Basic Attack
  parry_stance:    { name: 'Parry Stance',    icon: '🛡️', kind: 'special', stackable: false, maxStacks: 1, category: 'buff' },   // Samurai: big reduction + counter mark on hit
  counter_mark:    { name: 'Counter Mark',    icon: '🎯', kind: 'stat',    stackable: false, maxStacks: 1, category: 'buff', stat: 'attack', percent: 20 }, // bonus on next attack
  blood_frenzy_def:{ name: 'Blood Frenzy',    icon: '🩸', kind: 'stat',    stackable: false, maxStacks: 1, category: 'debuff', stat: 'defense', percent: -20 },
  confusion:       { name: 'Confusion',       icon: '💫', kind: 'special', stackable: false, maxStacks: 1, category: 'debuff' }, // Illusionist: may mis-target
  decoy_ward:      { name: 'Decoy',           icon: '🪞', kind: 'ward',    stackable: false, maxStacks: 1, category: 'buff' },   // Illusionist: blocks N full hits
  illusion_veil:   { name: 'Illusion Veil',   icon: '✨', kind: 'special', stackable: false, maxStacks: 1, category: 'buff' },   // Illusionist ultimate: team evasion window
  duel_mark:       { name: 'Duel Mark',       icon: '⚔️', kind: 'special', stackable: false, maxStacks: 1, category: 'debuff' }, // Duelist: marked rival
  duel_bond_self:  { name: 'Dueling',         icon: '🤺', kind: 'special', stackable: false, maxStacks: 1, category: 'buff' },   // Duelist ultimate (caster side)
  duel_bond_enemy: { name: 'Duel Bound',      icon: '🤺', kind: 'special', stackable: false, maxStacks: 1, category: 'debuff' }, // Duelist ultimate (target side)
  wanted_mark:     { name: 'Wanted',          icon: '☠️', kind: 'special', stackable: false, maxStacks: 1, category: 'debuff' }, // Pirate Captain
  healing_totem_aura: { name: 'Healing Totem', icon: '🌀', kind: 'hot',    stackable: false, maxStacks: 1, category: 'buff', tickPercent: 5 },
  spirit_totem_aura:  { name: 'Spirit Totem',  icon: '🌪️', kind: 'stat',   stackable: false, maxStacks: 1, category: 'buff', stat: 'speed', percent: 15 },
  gravity_weight:  { name: 'Gravity Weight',  icon: '🌑', kind: 'stat',    stackable: false, maxStacks: 1, category: 'debuff', stat: 'speed', percent: -12 },
};

const StatusEngine = {
  /** Apply (or refresh/stack) a status instance onto a target actor. */
  apply(target, statusId, duration, sourceId, magnitude) {
    const def = STATUS_DEFS[statusId];
    if (!def || target.isDead) return;
    let existing = target.statuses.find(s => s.id === statusId);
    if (existing) {
      if (def.stackable) {
        existing.stacks = Math.min(def.maxStacks, existing.stacks + 1);
      }
      existing.duration = Math.max(existing.duration, duration || 1);
      if (magnitude !== undefined) existing.magnitude = magnitude;
    } else {
      target.statuses.push({
        id: statusId,
        duration: Math.max(1, duration || 1),
        stacks: 1,
        source: sourceId || null,
        magnitude: magnitude,
      });
    }
  },

  remove(target, statusId) {
    target.statuses = target.statuses.filter(s => s.id !== statusId);
  },

  removeAllDebuffs(target) {
    target.statuses = target.statuses.filter(s => {
      const def = STATUS_DEFS[s.id];
      return !def || def.category !== 'debuff';
    });
  },

  has(target, statusId) {
    return target.statuses.some(s => s.id === statusId);
  },

  get(target, statusId) {
    return target.statuses.find(s => s.id === statusId) || null;
  },

  /** Whether this actor's turn should be entirely skipped this round. */
  shouldSkipTurn(target) {
    return target.statuses.some(s => STATUS_DEFS[s.id] && STATUS_DEFS[s.id].skipTurn);
  },

  isSilenced(target) {
    return target.statuses.some(s => STATUS_DEFS[s.id] && STATUS_DEFS[s.id].silence);
  },

  /** Aggregate a live stat multiplier (1.0 = no change) for a given base stat. */
  statMultiplier(target, statKey) {
    let mult = 1.0;
    for (const s of target.statuses) {
      const def = STATUS_DEFS[s.id];
      if (def && def.kind === 'stat' && def.stat === statKey) {
        mult += (def.percent / 100);
      }
    }
    return Math.max(0.1, mult);
  },

  incomingDamageMultiplier(target) {
    let mult = 1.0;
    for (const s of target.statuses) {
      const def = STATUS_DEFS[s.id];
      if (def && def.incomingDamagePercent) mult += def.incomingDamagePercent / 100;
    }
    return mult;
  },

  totalShield(target) {
    let total = 0;
    for (const s of target.statuses) {
      const def = STATUS_DEFS[s.id];
      if (def && def.kind === 'shield') total += (s.magnitude || 0);
    }
    return total;
  },

  /** Consume shield amount, returns remaining unabsorbed damage. */
  consumeShield(target, incomingDamage) {
    let remaining = incomingDamage;
    for (const s of target.statuses) {
      if (remaining <= 0) break;
      const def = STATUS_DEFS[s.id];
      if (def && def.kind === 'shield' && s.magnitude > 0) {
        const absorb = Math.min(s.magnitude, remaining);
        s.magnitude -= absorb;
        remaining -= absorb;
      }
    }
    target.statuses = target.statuses.filter(s => {
      const def = STATUS_DEFS[s.id];
      return !(def && def.kind === 'shield' && s.magnitude <= 0);
    });
    return remaining;
  },

  /** Ward (e.g. Illusionist's Decoy): blocks a fixed number of FULL hits rather than absorbing HP.
   *  Returns true if a hit was fully blocked (consuming one charge), false if there was no ward. */
  consumeWard(target) {
    const ward = target.statuses.find(s => STATUS_DEFS[s.id] && STATUS_DEFS[s.id].kind === 'ward');
    if (!ward || (ward.magnitude || 0) <= 0) return false;
    ward.magnitude -= 1;
    if (ward.magnitude <= 0) this.remove(target, ward.id);
    return true;
  },

  /** Resolve start-of-turn ticking effects (DoT / HoT). Returns log entries. */
  tickStartOfTurn(target) {
    const logs = [];
    if (target.isDead) return logs;
    for (const s of [...target.statuses]) {
      if (target.isDead) break; // a DoT earlier in this same loop may have just killed them - stop.
      const def = STATUS_DEFS[s.id];
      if (!def) continue;
      if (def.kind === 'dot') {
        const amount = Math.max(1, Math.round(target.maxHp * (def.tickPercent / 100) * s.stacks));
        target.hp = Math.max(0, target.hp - amount);
        logs.push({ type: 'dot', text: `${target.name} takes ${amount} damage from ${def.name}.` });
        if (target.hp <= 0) target.isDead = true;
      } else if (def.kind === 'hot') {
        const amount = Math.max(1, Math.round(target.maxHp * (def.tickPercent / 100)));
        const healed = Math.min(amount, target.maxHp - target.hp);
        target.hp = Math.min(target.maxHp, target.hp + amount);
        if (healed > 0) logs.push({ type: 'hot', text: `${target.name} regenerates ${healed} HP.` });
      }
    }
    return logs;
  },

  /** Reduce all status durations by 1 at end of turn; strip expired ones. */
  tickEndOfTurn(target) {
    const expired = [];
    target.statuses.forEach(s => { s.duration -= 1; });
    target.statuses = target.statuses.filter(s => {
      if (s.duration <= 0) { expired.push(s.id); return false; }
      return true;
    });
    return expired;
  },
};
