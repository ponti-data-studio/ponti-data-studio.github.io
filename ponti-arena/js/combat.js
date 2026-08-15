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
    if (rs && actor.position && actor.position.row === rs.row) {
      if (rs.stat === statKey) {
        value *= (1 + rs.percent / 100);
      } else if (rs.stat === 'defense' && (statKey === 'physicalDefense' || statKey === 'magicalDefense')) {
        // Generic "defense" row synergy (e.g. Knight/Guardian's Front Row bonus) boosts both
        // Physical and Magical Defense equally, rather than needing to pick one at data-entry time.
        value *= (1 + rs.percent / 100);
      }
    }
    // Dragon Knight's Dragon Form: a temporary transformation boost to Attack and both Defenses.
    if (StatusEngine.has(actor, 'dragon_form') && (statKey === 'attack' || statKey === 'physicalDefense' || statKey === 'magicalDefense')) {
      value *= 1.28;
    }
    // Beast Rider's Mounted Combat: bonus while still Mounted.
    const mb = actor.character.mountedBonus;
    if (mb && mb.stat === statKey && actor.mech && actor.mech.mounted) {
      value *= (1 + mb.percent / 100);
    }
    // Berserker Lord's Enrage: Attack scales up slightly with current Rage.
    if (statKey === 'attack' && actor.character.id === 'berserker_lord' && actor.mech) {
      value *= (1 + (actor.mech.rage / 100) * 0.25);
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
    let targetEvasion = (target.character.base && target.character.base.evasion) || 0;
    const footwork = StatusEngine.get(target, 'footwork');
    if (footwork) targetEvasion += footwork.stacks * (STATUS_DEFS.footwork.percent || 0);
    if (!estimate && !options.skipEvasion && targetEvasion > 0 && Math.random() * 100 < targetEvasion) {
      return { amount: 0, isCrit: false, evaded: true };
    }
    const atk = this.liveStat(attacker, 'attack');
    const defenseKey = attacker.character.attackType === 'magical' ? 'magicalDefense' : 'physicalDefense';
    const def = this.liveStat(target, defenseKey);
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
    // Demon Hunter's Hunter's Mark passive, and bonus vs Execution-eligible low HP.
    if (attacker.character.id === 'demon_hunter' && StatusEngine.has(target, 'hunter_mark')) raw *= 1.3;
    if (options.executionBonus && (target.hp / target.maxHp) <= 0.3) raw *= 1.6;
    // Fate Seal (Oracle): the sealed attacker's own next offensive action is weakened, once.
    if (!estimate && StatusEngine.has(attacker, 'fate_sealed')) {
      raw *= 0.7;
      StatusEngine.remove(attacker, 'fate_sealed');
    }
    // Champion's Grit (Gladiator ultimate): flat incoming-damage reduction while active.
    const rageShield = StatusEngine.get(target, 'rage_shield');
    if (rageShield && rageShield.magnitude) raw *= (1 - rageShield.magnitude / 100);
    // Frost Knight's Frost Bind / Absolute Zero - bonus vs already-Slowed targets.
    if (options.alreadySlowedBonus) raw *= 1.25;
    // Engineer's Turret: absorbs damage aimed at its owner before the owner's own HP (see #applyDamage).

    // ---- Roster expansion 3 (41-50) ----
    // Sniper's Long Range passive: bonus based on how far back the target is (and how far back she is).
    if (attacker.character.id === 'sniper' && attacker.position && target.position) {
      const depth = { front: 0, middle: 1, back: 2 };
      const distance = depth[attacker.position.row] + depth[target.position.row];
      raw *= (1 + distance * 0.06); // up to +24% at max Back-vs-Back range
    }
    // Sniper's Aim stance: big damage/crit boost on her next shot, consumed once, plus a small
    // self-vulnerability window (handled as incoming-damage bonus below).
    if (!estimate && attacker.character.id === 'sniper' && StatusEngine.has(attacker, 'aim_stance')) {
      raw *= 1.4;
      StatusEngine.remove(attacker, 'aim_stance');
    }
    if (options.headshotBonus && (target.hp / target.maxHp) <= 0.35) raw *= 1.5;
    // Sniper is more vulnerable to incoming attacks while lining up Aim.
    if (target.character.id === 'sniper' && StatusEngine.has(target, 'aim_stance')) raw *= 1.15;
    // Dragon Knight's Dragon Breath / Basic Attack - bonus with a high Dragon Gauge.
    if (attacker.character.id === 'dragon_knight' && attacker.mech && attacker.mech.dragonGauge >= 70) raw *= 1.2;
    // Berserker Lord's Raging Swing / Wrath Unleashed - bonus with high Rage.
    if (options.rageScaled && attacker.mech) raw *= (1 + (attacker.mech.rage / 100) * 0.35);
    if (options.wrathArmorBreak && attacker.mech && attacker.mech.rage >= 80) {
      raw *= 1.15; // the "briefly shatters Armor" bonus is expressed as extra damage this hit
    }
    // Soul Reaper's Soul Harvest: Basic Attack scales with current Soul count.
    if (attacker.character.id === 'soul_reaper' && options.skillId === 'soul_slash' && attacker.mech) {
      raw *= (1 + attacker.mech.soul * 0.12);
    }
    // Reaper's Cut: bonus damage based on the target's missing HP.
    if (options.missingHpExecute) {
      const missingPct = 1 - (target.hp / target.maxHp);
      raw *= (1 + missingPct * 0.6);
    }
    // Rune Master's Rune Bolt: Fire Rune adds flat damage.
    if (attacker.character.id === 'rune_master' && options.skillId === 'rune_bolt' && attacker.mech && attacker.mech.runes.includes('fire')) {
      raw *= 1.25;
    }
    // Mirror Knight's reflected damage never triggers a second reflection (handled by the caller
    // passing bypassProtection appropriately) - see CharacterMechanics.tryReflect for the actual guard.
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
    // Engineer's Turret: a durability pool that absorbs damage aimed at its owner before HP is
    // touched, exactly like a shield - this is how the Turret "gets destroyed" without needing a
    // separate targetable battle-object entity (keeps the turn/targeting engine untouched, see #15).
    let remaining = amount;
    if (target.mech && target.mech.turret && target.mech.turret.hp > 0) {
      const absorb = Math.min(target.mech.turret.hp, remaining);
      target.mech.turret.hp -= absorb;
      remaining -= absorb;
      if (target.mech.turret.hp <= 0) target.mech.turret = null;
    }
    const afterShield = StatusEngine.consumeShield(target, remaining);
    // Frost Knight's Ice Wall: whoever lands the hit that fully breaks it gets Slowed.
    if (target.character.id === 'frost_knight' && StatusEngine.totalShield(target) <= 0 && afterShield < remaining) {
      StatusEngine.apply(attacker, 'slow', 2, target.id);
    }
    const actualHpLoss = Math.min(target.hp, afterShield);
    target.hp = Math.max(0, target.hp - afterShield);
    if (target.hp <= 0) {
      // Death-prevention wards (Paladin's Divine Shield, Oracle's Alter Fate): consume once, survive at 1 HP.
      if (StatusEngine.has(target, 'divine_shield')) {
        StatusEngine.remove(target, 'divine_shield');
        target.hp = 1;
      } else if (StatusEngine.has(target, 'alter_fate')) {
        StatusEngine.remove(target, 'alter_fate');
        target.hp = 1;
      } else {
        target.isDead = true;
      }
    }
    if (!target.isDead) this.gainEnergy(target, 5);
    return actualHpLoss;
  },

  applyHeal(caster, target, amount) {
    if (target.isDead) return 0;
    let finalAmount = amount;
    if (caster.character.id === 'druid') finalAmount *= 1.15;
    if (StatusEngine.has(target, 'healing_reduction')) finalAmount *= 0.5;
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
