/**
 * PONTI ARENA - Combat Engine
 * Pure logic: calculates and applies damage/heal/energy/status.
 * Never touches the DOM. Emits structured events consumed by ui.js via battle.js.
 */

const CombatEngine = {
  /** Live (buffed/debuffed) stat value for an actor, including formation-row synergy. */
  liveStat(actor, statKey) {
    const base = actor.stats[statKey];
    const mult = StatusEngine.statMultiplier(actor, statKey);
    let value = base * mult;
    if (statKey === 'attack' && actor.character.id === 'berserker') {
      const hpPct = actor.hp / actor.maxHp;
      const bonus = Math.min(0.40, (1 - hpPct) * 0.5);
      value *= (1 + bonus);
    }
    const rs = actor.character.rowSynergy;
    if (rs && rs.stat === statKey && actor.position && actor.position.row === rs.row) {
      value *= (1 + rs.percent / 100);
    }
    return Math.max(1, Math.round(value));
  },

  /** Row protection: Back Row is harder to hit with generic/undirected attacks (not immunity - see #104). */
  rowProtectionMultiplier(target, bypassProtection) {
    if (bypassProtection || !target.position) return 1;
    if (target.position.row === 'middle') return 0.93;
    if (target.position.row === 'back') return 0.85;
    return 1;
  },

  liveCritRate(actor) {
    let cr = actor.stats.critRate;
    const rs = actor.character.rowSynergy;
    if (rs && rs.stat === 'critRate' && actor.position && actor.position.row === rs.row) cr += rs.percent;
    return cr;
  },
  liveCritDmg(actor) { return actor.stats.critDamage; },

  /** Core damage formula. Returns { amount, isCrit, evaded }.
   *  options.estimate: true -> deterministic EXPECTED VALUE (no RNG) for AI scoring/lookahead.
   *  Never used to actually apply damage - only to let the AI compare candidate actions fairly,
   *  using exactly the same formula and data the player could reason about (see #132).
   */
  calculateDamage(attacker, target, power, options = {}) {
    const estimate = !!options.estimate;
    if (!estimate && !options.skipEvasion && target.character.evasionPercent && Math.random() * 100 < target.character.evasionPercent) {
      return { amount: 0, isCrit: false, evaded: true };
    }
    const atk = this.liveStat(attacker, 'attack');
    const def = this.liveStat(target, 'defense');
    let raw = (atk * power * 100) / (100 + def);
    raw = Math.max(raw, atk * power * 0.15); // damage floor so it never trends to 0

    // Passive: Killing Instinct (Assassin) - bonus vs low HP targets
    if (attacker.character.id === 'assassin' && (target.hp / target.maxHp) < 0.30) {
      raw *= 1.35;
    }
    // Backline Bonus (e.g. Assassin's Shadow Hunter) - bonus vs a target standing in the Back Row.
    if (attacker.character.backlineBonus && target.position && target.position.row === 'back') {
      raw *= (1 + attacker.character.backlineBonus.percent / 100);
    }
    // Duelist's Challenger stacks - bonus damage against the same rival, consecutively.
    if (attacker.character.id === 'duelist' && attacker.mech) {
      const bonus = CharacterMechanics.duelBonusPercent(attacker, target);
      if (bonus > 0) raw *= (1 + bonus / 100);
    }
    // Pirate Captain's Wanted passive - bonus vs a Wanted Mark target.
    if (attacker.character.id === 'pirate_captain' && StatusEngine.has(target, 'wanted_mark')) {
      raw *= 1.3;
    }
    // Paladin's Judgment - bonus vs any debuffed target, extra vs 2+ debuffs (handled inline by caller flag).
    if (options.judgmentBonus) {
      const debuffCount = target.statuses.filter(s => STATUS_DEFS[s.id] && STATUS_DEFS[s.id].category === 'debuff').length;
      if (debuffCount >= 1) raw *= 1.3;
    }
    // Samurai's Final Cut - bonus vs low HP or Marked targets.
    if (options.finalCutBonus) {
      if ((target.hp / target.maxHp) < 0.3) raw *= 1.25;
      if (StatusEngine.has(target, 'duel_mark') || StatusEngine.has(target, 'mark')) raw *= 1.2;
    }
    // Passive: Eagle Eye (Archer) crit bump handled in crit roll below
    // Passive: Ignition (Pyromancer) - bonus vs burning targets
    if (attacker.character.id === 'pyromancer' && StatusEngine.has(target, 'burn')) {
      raw *= 1.20;
    }
    // Passive: Hunter Instinct (Ranger) basic attack bonus vs poisoned handled by caller flag
    if (options.bonusVsPoison && StatusEngine.has(target, 'poison')) {
      raw *= 1.20;
    }
    // Passive: Aerial Mastery (Sky Lancer) vs lowest defense enemy flagged by caller
    if (options.isLowestDefenseTarget && attacker.character.id === 'sky-lancer') {
      raw *= 1.15;
    }
    // Wizard Arcane Mastery stacks (consecutive skill casts)
    if (attacker.character.id === 'wizard' && options.isSkill) {
      const stacks = attacker.arcaneStacks || 0;
      raw *= (1 + stacks * 0.10);
    }
    // Necromancer Necrotic Power - scales with fallen units on the field
    if (attacker.character.id === 'necromancer' && options.fallenCount) {
      raw *= (1 + options.fallenCount * 0.05);
    }
    // Stormcaller Static Charge bonus flagged by caller
    if (options.staticChargeBonus) raw *= 1.5;

    // Mark debuff on target increases incoming damage
    raw *= StatusEngine.incomingDamageMultiplier(target);
    // Formation protection: Back/Middle Row are harder to hit with undirected attacks (not immunity).
    raw *= this.rowProtectionMultiplier(target, options.bypassProtection);

    let isCrit = false;
    let critChance = this.liveCritRate(attacker);
    if (attacker.character.id === 'archer' && (target.hp / target.maxHp) > 0.5) {
      critChance += 15;
    }
    if (options.guaranteedCrit) critChance = 100;
    if (estimate) {
      // Expected value: blend crit and non-crit outcomes by probability instead of rolling.
      const critMult = this.liveCritDmg(attacker) / 100;
      const p = Math.min(1, critChance / 100);
      raw *= (1 - p) * 1 + p * critMult;
    } else if (Math.random() * 100 < critChance) {
      isCrit = true;
      raw *= (this.liveCritDmg(attacker) / 100);
    }

    // Defend stance reduction
    if (target.defending) {
      raw *= (1 - DEFEND_ACTION.damageReduction / 100);
    }

    const amount = Math.max(1, Math.round(raw));
    return { amount, isCrit, evaded: false };
  },

  applyDamage(attacker, target, amount) {
    const afterShield = StatusEngine.consumeShield(target, amount);
    const actualHpLoss = Math.min(target.hp, afterShield);
    target.hp = Math.max(0, target.hp - afterShield);
    if (target.hp <= 0) target.isDead = true;
    // Taking damage grants energy
    if (!target.isDead) this.gainEnergy(target, 5);
    return actualHpLoss;
  },

  applyHeal(caster, target, amount) {
    if (target.isDead) return 0;
    let finalAmount = amount;
    if (caster.character.id === 'druid') finalAmount *= 1.15;
    const rs = caster.character.rowSynergy;
    if (rs && rs.stat === 'healPower' && caster.position && caster.position.row === rs.row) {
      finalAmount *= (1 + rs.percent / 100);
    }
    finalAmount = Math.round(finalAmount);
    const healed = Math.min(finalAmount, target.maxHp - target.hp);
    target.hp = Math.min(target.maxHp, target.hp + finalAmount);
    return Math.max(0, healed);
  },

  applyShield(target, amount) {
    StatusEngine.apply(target, 'shield', 2, null, Math.round(amount));
  },

  gainEnergy(actor, amount) {
    if (actor.isDead) return;
    actor.energy = Math.min(100, actor.energy + Math.max(0, amount));
  },

  spendEnergy(actor, amount) {
    actor.energy = Math.max(0, actor.energy - amount);
  },

  canUltimate(actor) {
    return actor.energy >= 100 && !actor.isDead;
  },
};
