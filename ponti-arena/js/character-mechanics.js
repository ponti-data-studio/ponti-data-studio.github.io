/**
 * PONTI ARENA - Character Mechanics (roster expansions: 21-30, 31-40, and 41-50)
 * Isolated handlers for the handful of genuinely custom behaviors introduced by the new
 * characters (damage redirection, counter-attacks, reagents, duel stacks, totems, turn-gauge
 * manipulation, decoy wards, position pulls, Ki/Rage/Footwork/Dragon Gauge/Soul resources, the
 * Engineer's Turret, Taunt, Contagion spread, Rune fusion, and reflection). Everything else about
 * these characters (basic stats, plain damage/heal/buff skills) flows through the existing
 * data-driven systems in characters.js/skills.js/combat.js exactly like the original 20.
 *
 * Every mechanic here has an explicit cap/duration/limit - see #29 Bug Prevention: no infinite
 * turns, counters, heals, shields, repositions, clones, rewinds, energy, Turrets, Taunts, Runes,
 * Souls, or reflections.
 */

const CharacterMechanics = {
  /** Per-actor custom state, initialized once when the battle actor is created (see battle.js). */
  initActorState(actor) {
    actor.mech = {
      protectedAllyId: null,     // Paladin
      counteredThisTurn: false,  // Samurai / Duelist / Fencer
      reagents: { healing: 0, toxic: 0, swift: 0, purifying: 0 }, // Alchemist
      duelTarget: null, duelStacks: 0, // Duelist
      activeTotem: null,         // Spirit Shaman ('healing' | 'spirit')
      ki: 0,                     // Monk (0-100)
      rage: 0,                   // Gladiator / Berserker Lord (0-100)
      turret: null,              // Engineer: { hp, maxHp, attack, duration, isWarMachine }
      stance: null,              // Bard ('battle_song' | 'war_drum')
      spreadCooldown: 0,         // Plague Doctor (Pandemic internal cooldown)
      dragonGauge: 0,            // Dragon Knight (0-100)
      attackedLastTurn: false,   // Battle Medic (Combat Heal bonus)
      runes: [],                 // Rune Master: up to 3 of 'fire' | 'guard' | 'wind'
      mounted: true,             // Beast Rider
      soul: 0,                   // Soul Reaper (0-5)
    };
    actor.hpHistory = []; // used by Chronomancer's Rewind (universal, cheap, capped at 6 entries)
  },

  /** Called once per actor at the start of THEIR OWN turn (after status ticks), from battle.js.
   *  Returns an array of log-worthy events (e.g. a Turret shot), or an empty array. */
  onTurnStart(actor, allActors) {
    actor.mech.counteredThisTurn = false;
    actor.mech.attackedLastTurn = false; // reset each turn; set true if Basic Attack is used this turn
    actor.hpHistory.push(actor.hp);
    if (actor.hpHistory.length > 6) actor.hpHistory.shift();

    const events = [];
    if (actor.isDead) return events;

    if (actor.character.id === 'paladin') this.refreshProtection(actor, allActors);
    if (actor.character.id === 'alchemist') this.generateReagent(actor);
    if (actor.character.id === 'engineer') this.tickTurret(actor, allActors, events);
    if (actor.mech.spreadCooldown > 0) actor.mech.spreadCooldown -= 1;
    return events;
  },

  /** Called whenever ANY enemy of `deadActor`'s side falls, from the main death-detection points
   *  in skills.js. Grants Soul Reaper(s) on the opposing side a Soul (bonus if the target was
   *  Soul Marked by that Reaper specifically). Capped at 5 - see #29 Bug Prevention. */
  registerDeath(deadActor, allActors) {
    const reapers = allActors.filter(a => a.character.id === 'soul_reaper' && a.side !== deadActor.side && !a.isDead);
    reapers.forEach(reaper => {
      let gain = 1;
      const mark = StatusEngine.get(deadActor, 'soul_mark_status');
      if (mark && mark.source === reaper.id) gain += 1;
      reaper.mech.soul = Math.min(5, reaper.mech.soul + gain);
    });
  },

  // ---------------------------------------------------------------- ENGINEER ----
  /** The Turret fires automatically at the start of its owner's turn, then counts down its duration. */
  tickTurret(engineer, allActors, events) {
    const turret = engineer.mech.turret;
    if (!turret) return;
    turret.duration -= 1;
    if (turret.duration <= 0) {
      engineer.mech.turret = null;
      events.push({ type: 'special', actor: engineer.id, text: `${engineer.name}'s ${turret.isWarMachine ? 'War Machine' : 'Turret'} runs out of power and shuts down.` });
      return;
    }
    const enemies = allActors.filter(a => a.side !== engineer.side && !a.isDead);
    if (enemies.length === 0) return;
    // Simple, transparent target choice: lowest current HP% (same info a player could reason about).
    const target = [...enemies].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
    const dealt = CombatEngine.applyDamage(engineer, target, Math.max(1, Math.round(turret.attack)));
    events.push({ type: 'damage', actor: engineer.id, target: target.id, amount: dealt, isCrit: false,
      text: `${engineer.name}'s ${turret.isWarMachine ? 'War Machine' : 'Turret'} fires at ${target.name} for ${dealt} damage.` });
    if (target.isDead) events.push({ type: 'death', actor: target.id, text: `${target.name} has fallen!` });
  },

  deployTurret(engineer) {
    const maxHp = Math.round(engineer.maxHp * 0.35);
    engineer.mech.turret = { hp: maxHp, maxHp, attack: Math.round(CombatEngine.liveStat(engineer, 'attack') * 0.5), duration: 4, isWarMachine: false };
  },

  // ---------------------------------------------------------------- RESOURCES (Ki / Rage / Dragon Gauge) ----
  gainKi(actor, amount) { if (actor.mech) actor.mech.ki = Math.min(100, actor.mech.ki + amount); },
  spendKi(actor, amount) { if (actor.mech) actor.mech.ki = Math.max(0, actor.mech.ki - amount); },
  gainRage(actor, amount) { if (actor.mech) actor.mech.rage = Math.min(100, actor.mech.rage + amount); },
  spendRage(actor, amount) { if (actor.mech) actor.mech.rage = Math.max(0, actor.mech.rage - amount); },
  gainDragonGauge(actor, amount) { if (actor.mech) actor.mech.dragonGauge = Math.min(100, actor.mech.dragonGauge + amount); },
  spendDragonGauge(actor, amount) { if (actor.mech) actor.mech.dragonGauge = Math.max(0, actor.mech.dragonGauge - amount); },

  // ---------------------------------------------------------------- RUNE MASTER ----
  RUNE_RECIPES: {
    'fire+fire': 'Burst', 'fire+wind': 'Rapid', 'fire+guard': 'Barrier',
    'wind+wind': 'Haste', 'guard+guard': 'Fortress', 'guard+wind': 'Mobility',
  },
  /** Adds the next Rune in a fixed Fire -> Guard -> Wind rotation (keeps skill UI simple - see #5/#31). */
  inscribeRune(actor) {
    const order = ['fire', 'guard', 'wind'];
    const last = actor.mech.runes.length > 0 ? actor.mech.runes[actor.mech.runes.length - 1] : null;
    const next = order[(order.indexOf(last) + 1) % order.length];
    actor.mech.runes.push(next);
    if (actor.mech.runes.length > 3) actor.mech.runes.shift(); // FIFO cap - never unbounded
    return next;
  },
  /** Looks up (and does not require consuming) the fusion result for the two most recent Runes. */
  runeFusionResult(actor) {
    const runes = actor.mech.runes;
    if (runes.length < 2) return null;
    const pair = [runes[runes.length - 2], runes[runes.length - 1]].sort();
    return this.RUNE_RECIPES[pair.join('+')] || null;
  },

  // ---------------------------------------------------------------- GLADIATOR: Taunt ----
  /** If `actor` is Taunted and the taunter is a legal target for this skill, force it. */
  applyTauntOverride(actor, skillDef, legalTargets, chosenTarget, allActors) {
    const taunt = StatusEngine.get(actor, 'taunt');
    if (!taunt) return chosenTarget;
    const taunter = allActors.find(a => a.id === taunt.source && !a.isDead);
    if (!taunter) return chosenTarget;
    const stillLegal = legalTargets.some(t => t.id === taunter.id);
    return stillLegal ? taunter : chosenTarget;
  },

  // ---------------------------------------------------------------- PLAGUE DOCTOR: Contagion ----
  /** Attempts to spread Poison/Disease from `source` to up to 2 other living enemies, gated by an
   *  internal cooldown so it can never chain-react indefinitely (see #25 Bug Prevention). */
  trySpreadDebuff(caster, source, allActors, events) {
    if (caster.mech.spreadCooldown > 0) return;
    const statusId = StatusEngine.has(source, 'poison') ? 'poison' : (StatusEngine.has(source, 'disease') ? 'disease' : null);
    if (!statusId) return;
    const others = allActors.filter(a => a.side !== caster.side && !a.isDead && a.id !== source.id);
    const spreadTo = others.sort(() => Math.random() - 0.5).slice(0, 2);
    spreadTo.forEach(t => {
      StatusEngine.apply(t, statusId, 2, caster.id);
      events.push({ type: 'status', actor: caster.id, target: t.id, statusId,
        text: `${STATUS_DEFS[statusId].name} spreads to ${t.name}!` });
    });
    caster.mech.spreadCooldown = 2; // can't spread again for 2 of the Plague Doctor's own turns
  },

  // ---------------------------------------------------------------- BARD: Stance ----
  setStance(bard, stance) { bard.mech.stance = stance; },

  // ---------------------------------------------------------------- PALADIN ----
  /** Guardian's Oath: auto-protects the lowest-HP% living ally (never the Paladin itself). */
  refreshProtection(paladin, allActors) {
    const allies = allActors.filter(a => a.side === paladin.side && !a.isDead && a.id !== paladin.id);
    allies.forEach(a => StatusEngine.remove(a, 'guardians_oath'));
    if (allies.length === 0) { paladin.mech.protectedAllyId = null; return; }
    const target = [...allies].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
    paladin.mech.protectedAllyId = target.id;
    StatusEngine.apply(target, 'guardians_oath', 2, paladin.id);
  },

  /** Row-based effectiveness of the redirection (#Paladin row synergy). */
  protectionEffectiveness(paladin) {
    if (!paladin.position) return 0.5;
    if (paladin.position.row === 'front') return 0.65;
    if (paladin.position.row === 'middle') return 0.5;
    return 0.3; // back row: still works, just weaker
  },

  /**
   * Intercepts incoming damage before it's applied. Returns { target, amount } - either the
   * original pair unchanged, or the Paladin substituted in for a capped, reduced portion.
   */
  interceptDamage(originalTarget, amount, allActors) {
    const oath = StatusEngine.get(originalTarget, 'guardians_oath');
    if (!oath || originalTarget.character.id === 'paladin') return { target: originalTarget, amount };
    const paladin = allActors.find(a => a.id === oath.source && !a.isDead);
    if (!paladin) return { target: originalTarget, amount };
    const effectiveness = this.protectionEffectiveness(paladin);
    const redirected = Math.round(amount * effectiveness);
    const cap = Math.round(paladin.maxHp * 0.25); // never more than 25% of Paladin's max HP in one hit
    const paladinShare = Math.min(redirected, cap);
    const remaining = amount - paladinShare;
    if (paladinShare <= 0) return { target: originalTarget, amount };
    // Apply the Paladin's share immediately (bypassing further redirection - he can't protect himself).
    const paladinLoss = Math.min(paladin.hp, StatusEngine.consumeShield(paladin, paladinShare));
    paladin.hp = Math.max(0, paladin.hp - paladinLoss);
    if (paladin.hp <= 0) paladin.isDead = true;
    return { target: originalTarget, amount: Math.max(0, remaining), redirectedTo: paladin, redirectedAmount: paladinShare };
  },

  // ---------------------------------------------------------------- COUNTERS (Samurai / Duelist) ----
  /**
   * Checks whether `defender` should fire a counter-attack against `attacker` after taking a hit.
   * Returns a damage event object or null. Guarded against double-counters per turn and against
   * counters ever chaining into further counters (isCounter flag on the resulting call site).
   */
  // ---------------------------------------------------------------- MIRROR KNIGHT: Reflection ----
  /**
   * Reflects a capped share of direct attack damage back at the attacker. `wasReflectDamage` must
   * be true for the ORIGINAL hit that triggered this if it was itself a reflection - in that case
   * we refuse to reflect again, which is the hard guarantee against infinite reflect loops (#16/#29).
   */
  tryReflect(defender, attacker, dealtAmount, wasReflectDamage) {
    if (wasReflectDamage || defender.character.id !== 'mirror_knight' || defender.isDead || attacker.isDead || dealtAmount <= 0) return null;
    const boost = StatusEngine.get(defender, 'mirror_boost');
    const percent = (defender.character.reflectPercent || 0) + (boost ? 30 : 0);
    if (percent <= 0) return null;
    const cap = Math.round(defender.maxHp * 0.12); // maximum reflect damage per hit
    const reflectAmount = Math.min(cap, Math.round(dealtAmount * (percent / 100)));
    if (reflectAmount <= 0) return null;
    const dealt = CombatEngine.applyDamage(defender, attacker, reflectAmount);
    return { type: 'damage', actor: defender.id, target: attacker.id, amount: dealt, isCrit: false, isReflectDamage: true,
      text: `${defender.name}'s Mirror Armor reflects ${dealt} damage back at ${attacker.name}!` };
  },

  tryCounter(defender, attacker, allActors) {
    if (defender.isDead || attacker.isDead || defender.mech.counteredThisTurn) return null;
    if (defender.character.id === 'samurai') {
      const iaido = StatusEngine.get(defender, 'iaido_stance');
      const parry = StatusEngine.get(defender, 'parry_stance');
      if (iaido) {
        StatusEngine.remove(defender, 'iaido_stance');
        return this.fireCounter(defender, attacker, 1.6, 'Iaido');
      }
      if (parry) {
        StatusEngine.remove(defender, 'parry_stance');
        StatusEngine.apply(defender, 'counter_mark', 2, defender.id);
        return null; // Parry grants a buff for the NEXT attack rather than an instant counter
      }
      if (defender.defending) {
        return this.fireCounter(defender, attacker, 0.9, 'Bushido');
      }
    }
    if (defender.character.id === 'duelist') {
      const riposte = StatusEngine.get(defender, 'counter_stance');
      const marked = StatusEngine.has(attacker, 'duel_mark');
      if (riposte && marked) {
        StatusEngine.remove(defender, 'counter_stance');
        return this.fireCounter(defender, attacker, 1.1, 'Riposte');
      }
    }
    if (defender.character.id === 'fencer') {
      const parry = StatusEngine.get(defender, 'parry_stance');
      if (parry) {
        StatusEngine.remove(defender, 'parry_stance');
        StatusEngine.apply(defender, 'footwork', 3, defender.id);
        return this.fireCounter(defender, attacker, 1.0, 'Riposte');
      }
    }
    return null;
  },

  fireCounter(defender, attacker, power, label) {
    defender.mech.counteredThisTurn = true;
    const { amount } = CombatEngine.calculateDamage(defender, attacker, power, { isCounter: true, bypassProtection: true });
    const dealt = CombatEngine.applyDamage(defender, attacker, amount);
    return { type: 'damage', actor: defender.id, target: attacker.id, amount: dealt, isCrit: false,
      text: `${defender.name} counters with ${label} for ${dealt} damage!` };
  },

  // ---------------------------------------------------------------- ALCHEMIST ----
  generateReagent(alchemist) {
    const types = ['healing', 'toxic', 'swift', 'purifying'];
    const r = alchemist.mech.reagents;
    const total = types.reduce((sum, t) => sum + r[t], 0);
    if (total >= 6) return; // overall cap so it can't stockpile forever
    const pick = types[Math.floor(Math.random() * types.length)];
    r[pick] = Math.min(3, r[pick] + 1);
  },

  consumeReagent(alchemist, type) {
    if (alchemist.mech.reagents[type] > 0) { alchemist.mech.reagents[type] -= 1; return true; }
    return false;
  },

  // ---------------------------------------------------------------- DUELIST ----
  registerDuelHit(duelist, target) {
    if (duelist.mech.duelTarget === target.id) {
      duelist.mech.duelStacks = Math.min(3, duelist.mech.duelStacks + 1);
    } else {
      duelist.mech.duelTarget = target.id;
      duelist.mech.duelStacks = 1;
    }
  },
  duelBonusPercent(duelist, target) {
    if (duelist.mech.duelTarget !== target.id) return 0;
    return duelist.mech.duelStacks * 10;
  },

  // ---------------------------------------------------------------- SPIRIT SHAMAN ----
  /** Only one totem aura may be active at a time - casting a new one clears the old (#Spirit Bond). */
  applyTotem(shaman, allies, totemKey, statusId, duration) {
    if (shaman.mech.activeTotem) {
      const prevStatusId = shaman.mech.activeTotem === 'healing' ? 'healing_totem_aura' : 'spirit_totem_aura';
      allies.forEach(a => StatusEngine.remove(a, prevStatusId));
    }
    shaman.mech.activeTotem = totemKey;
    allies.forEach(a => StatusEngine.apply(a, statusId, duration, shaman.id));
  },

  // ---------------------------------------------------------------- GRAVITY MAGE / PIRATE CAPTAIN ----
  /** Repositions an actor one row toward `direction` ('forward' = back->middle->front,
   *  'backward' = front->middle->back). No-op (safe) if already at the boundary - see #25. */
  reposition(actor, direction) {
    if (!actor.position) return false;
    const order = ['back', 'middle', 'front'];
    const idx = order.indexOf(actor.position.row);
    if (idx === -1) return false;
    const newIdx = direction === 'forward' ? idx + 1 : idx - 1;
    if (newIdx < 0 || newIdx > 2) return false; // already at the boundary - stays put
    actor.position = { row: order[newIdx], column: actor.position.column };
    return true;
  },

  // ---------------------------------------------------------------- CHRONOMANCER ----
  /** Nudges an ally's action bar forward without ever granting a guaranteed instant extra turn. */
  advanceReadiness(target, fraction) {
    target.readiness = Math.min(READY_THRESHOLD - 1, target.readiness + READY_THRESHOLD * fraction);
  },
  delayReadiness(target, fraction) {
    target.readiness = Math.max(0, target.readiness - READY_THRESHOLD * fraction);
  },

  /** Rewind: restores HP to the oldest tracked snapshot (up to ~3 of the target's own turns ago),
   *  restores a fixed chunk of Energy, and cleanses up to 2 debuffs. Never revives the dead. */
  rewind(target) {
    if (target.isDead) return { healed: 0, energyRestored: 0, cleansed: 0 };
    const snapshot = target.hpHistory.length > 0 ? target.hpHistory[0] : target.hp;
    const restoreTo = Math.max(target.hp, Math.min(target.maxHp, snapshot));
    const healed = Math.max(0, restoreTo - target.hp);
    target.hp = restoreTo;
    const energyRestored = Math.min(40, 100 - target.energy);
    target.energy = Math.min(100, target.energy + 40);
    const debuffs = target.statuses.filter(s => STATUS_DEFS[s.id] && STATUS_DEFS[s.id].category === 'debuff').slice(0, 2);
    debuffs.forEach(s => StatusEngine.remove(target, s.id));
    return { healed, energyRestored, cleansed: debuffs.length };
  },

  // ---------------------------------------------------------------- ILLUSIONIST ----
  /** Confusion (#Illusionist Skill 2): the afflicted actor may mis-target within the SAME legal
   *  target pool the AI already computed - never causes self-harm, never picks an illegal target. */
  maybeConfuseTarget(actor, legalTargets, chosenTarget) {
    if (!StatusEngine.has(actor, 'confusion')) return chosenTarget;
    if (legalTargets.length <= 1) return chosenTarget;
    if (Math.random() >= 0.3) return chosenTarget; // 30% chance to misfire, per turn
    const alternatives = legalTargets.filter(t => t.id !== chosenTarget.id);
    return alternatives[Math.floor(Math.random() * alternatives.length)] || chosenTarget;
  },

  // ---------------------------------------------------------------- POST-SKILL DISPATCH ----
  /** Called once after a skill's generic (damage/heal/buff/...) resolution completes.
   *  Handles the handful of effects that don't fit the generic type pipeline at all. */
  onSkillCast(actor, skillDef, targets, events, ctx) {
    const handler = this._handlers[skillDef.id];
    if (handler) handler.call(this, actor, skillDef, targets, events, ctx);
  },

  _handlers: {
    // Chronomancer -------------------------------------------------------------------------
    time_shift(actor, skillDef, targets, events) {
      const target = targets[0];
      if (!target || target.isDead) return;
      const fraction = actor.position && actor.position.row !== 'front' ? 0.4 : 0.3; // Time Flow row bonus
      CharacterMechanics.advanceReadiness(target, fraction);
      events.push({ type: 'special', actor: actor.id, target: target.id, text: `${target.name}'s next turn draws closer.` });
    },
    time_slow(actor, skillDef, targets, events) {
      const target = targets[0];
      if (!target || target.isDead) return;
      if (target.energy >= 100) {
        CharacterMechanics.delayReadiness(target, 0.25);
        events.push({ type: 'special', actor: actor.id, target: target.id, text: `${target.name}'s Ultimate-charged momentum is disrupted!` });
      }
    },
    rewind(actor, skillDef, targets, events) {
      const target = targets[0];
      if (!target) return;
      const result = CharacterMechanics.rewind(target);
      events.push({ type: 'heal', actor: actor.id, target: target.id, amount: result.healed,
        text: `${actor.name} rewinds time for ${target.name}: +${result.healed} HP, +${result.energyRestored} Energy, ${result.cleansed} debuff(s) undone.` });
    },

    // Illusionist ---------------------------------------------------------------------------
    // (Decoy and Confusion are pure status applications - already handled by applyStatuses.)

    // Alchemist -------------------------------------------------------------------------------
    // (Healing Potion / Toxic Flask reagent consumption happens up-front in SkillSystem.resolve
    //  so the power scaling applies to the same cast - see skills.js.)
    forbidden_mixture(actor, skillDef, targets, events, ctx) {
      const r = actor.mech.reagents;
      const allies = ctx.allActors.filter(a => a.side === actor.side && !a.isDead);
      const enemies = ctx.allActors.filter(a => a.side !== actor.side && !a.isDead);
      let used = false;
      if (r.healing > 0 && r.swift > 0) {
        r.healing--; r.swift--; used = true;
        const target = [...allies].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
        if (target) {
          const healed = CombatEngine.applyHeal(actor, target, target.maxHp * 0.3);
          StatusEngine.apply(target, 'speed_up', 2, actor.id);
          events.push({ type: 'heal', actor: actor.id, target: target.id, amount: healed, text: `${actor.name} mixes Healing + Swift: +${healed} HP and Speed Up for ${target.name}.` });
        }
      } else if (r.purifying > 0 && r.healing > 0) {
        r.purifying--; r.healing--; used = true;
        const target = [...allies].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
        if (target) {
          const healed = CombatEngine.applyHeal(actor, target, target.maxHp * 0.25);
          StatusEngine.removeAllDebuffs(target);
          events.push({ type: 'heal', actor: actor.id, target: target.id, amount: healed, text: `${actor.name} mixes Purifying + Healing: +${healed} HP and cleanses ${target.name}.` });
        }
      } else if (r.toxic > 0) {
        r.toxic--; used = true;
        const target = enemies[0];
        if (target) {
          const { amount } = CombatEngine.calculateDamage(actor, target, 1.1, {});
          const dealt = CombatEngine.applyDamage(actor, target, amount);
          StatusEngine.apply(target, 'poison', 3, actor.id);
          events.push({ type: 'damage', actor: actor.id, target: target.id, amount: dealt, text: `${actor.name} hurls a Toxic Mixture at ${target.name} for ${dealt} damage and heavy Poison.` });
          if (target.isDead) events.push({ type: 'death', actor: target.id, text: `${target.name} has fallen!` });
        }
      }
      if (!used) {
        // No reagents at all - a minor, guaranteed fallback so the Ultimate is never a dead button.
        const target = enemies[0];
        if (target) {
          const { amount } = CombatEngine.calculateDamage(actor, target, 0.6, {});
          const dealt = CombatEngine.applyDamage(actor, target, amount);
          events.push({ type: 'damage', actor: actor.id, target: target.id, amount: dealt, text: `${actor.name} improvises a weak mixture, dealing ${dealt} damage.` });
        }
      }
    },

    // Spirit Shaman -----------------------------------------------------------------------------
    healing_totem(actor, skillDef, targets, events, ctx) {
      const allies = ctx.allActors.filter(a => a.side === actor.side && !a.isDead);
      CharacterMechanics.applyTotem(actor, allies, 'healing', 'healing_totem_aura', 3);
      events.push({ type: 'special', actor: actor.id, text: `${actor.name} plants a Healing Totem for the team.` });
    },
    spirit_totem(actor, skillDef, targets, events, ctx) {
      const allies = ctx.allActors.filter(a => a.side === actor.side && !a.isDead);
      CharacterMechanics.applyTotem(actor, allies, 'spirit', 'spirit_totem_aura', 3);
      events.push({ type: 'special', actor: actor.id, text: `${actor.name} plants a Spirit Totem for the team.` });
    },

    // Pirate Captain / Gravity Mage: position manipulation --------------------------------------
    explosive_barrel(actor, skillDef, targets, events) {
      targets.forEach(t => {
        if (t.isDead) return;
        const moved = CharacterMechanics.reposition(t, 'backward');
        if (moved) events.push({ type: 'special', actor: actor.id, target: t.id, text: `${t.name} is knocked back to the ${t.position.row} row!` });
      });
    },
    gravity_pull(actor, skillDef, targets, events) {
      targets.forEach(t => {
        if (t.isDead) return;
        const moved = CharacterMechanics.reposition(t, 'forward');
        if (moved) events.push({ type: 'special', actor: actor.id, target: t.id, text: `${t.name} is pulled forward to the ${t.position.row} row!` });
      });
    },
    singularity(actor, skillDef, targets, events) {
      const livingHits = targets.filter(t => !t.isDead);
      if (livingHits.length < 2) return;
      // Converge everyone caught into the Middle Row, unless they're already there.
      livingHits.forEach(t => {
        if (t.position.row === 'front') CharacterMechanics.reposition(t, 'backward');
        else if (t.position.row === 'back') CharacterMechanics.reposition(t, 'forward');
      });
      events.push({ type: 'special', actor: actor.id, text: `The singularity drags ${livingHits.length} enemies together!` });
    },

    // Samurai: Final Cut risk/reward ------------------------------------------------------------
    final_cut(actor, skillDef, targets, events) {
      const target = targets[0];
      if (target && !target.isDead) {
        StatusEngine.apply(actor, 'defense_down', 1, actor.id);
        events.push({ type: 'debuff', actor: actor.id, target: actor.id, text: `${actor.name} overextended - Defense Down until his next turn.` });
      }
    },

    // ---- Roster expansion 2 (31-40) ----

    // Monk -----------------------------------------------------------------------------------
    meditation(actor, skillDef, targets, events) {
      CharacterMechanics.gainKi(actor, 25);
      events.push({ type: 'special', actor: actor.id, text: `${actor.name} meditates, recovering Ki.` });
    },
    sevenfold_strike(actor, skillDef, targets, events, ctx) {
      const target = targets[0];
      if (!target || target.isDead) return;
      const extraHits = Math.floor(actor.mech.ki / 25); // up to 4 bonus hits at max Ki
      for (let i = 0; i < extraHits; i++) {
        if (target.isDead) break;
        const { amount, isCrit } = CombatEngine.calculateDamage(actor, target, 0.4, { bypassProtection: true });
        const dealt = CombatEngine.applyDamage(actor, target, amount);
        events.push({ type: 'damage', actor: actor.id, target: target.id, amount: dealt, isCrit,
          text: `${actor.name}'s Sevenfold Strike lands another hit on ${target.name} for ${dealt} damage.` });
        if (target.isDead) events.push({ type: 'death', actor: target.id, text: `${target.name} has fallen!` });
      }
      CharacterMechanics.spendKi(actor, 100); // fully resets after the ultimate
    },

    // Engineer ---------------------------------------------------------------------------------
    deploy_turret_eng(actor, skillDef, targets, events) {
      CharacterMechanics.deployTurret(actor);
      events.push({ type: 'special', actor: actor.id, text: `${actor.name} deploys a Turret.` });
    },
    repair(actor, skillDef, targets, events) {
      if (actor.mech.turret) {
        const restore = Math.round(actor.mech.turret.maxHp * 0.5);
        actor.mech.turret.hp = Math.min(actor.mech.turret.maxHp, actor.mech.turret.hp + restore);
        events.push({ type: 'special', actor: actor.id, text: `${actor.name} repairs the Turret for ${restore} durability.` });
      } else {
        const target = targets[0];
        if (target && !target.isDead) {
          CombatEngine.applyShield(target, Math.round(target.maxHp * 0.22));
          events.push({ type: 'shield', actor: actor.id, target: target.id, text: `${actor.name} shields ${target.name}.` });
        }
      }
    },
    war_machine(actor, skillDef, targets, events, ctx) {
      const maxHp = Math.round(actor.maxHp * 0.55);
      const carryOver = actor.mech.turret ? Math.round(maxHp * 0.4) : 0;
      actor.mech.turret = { hp: Math.min(maxHp, maxHp * 0.6 + carryOver), maxHp, attack: Math.round(CombatEngine.liveStat(actor, 'attack') * 0.85), duration: 4, isWarMachine: true };
      events.push({ type: 'special', actor: actor.id, text: `${actor.name} deploys a War Machine!` });
      const enemies = ctx.allActors.filter(a => a.side !== actor.side && !a.isDead);
      enemies.forEach(e => {
        const { amount, isCrit } = CombatEngine.calculateDamage(actor, e, 0.55, { bypassProtection: true });
        const dealt = CombatEngine.applyDamage(actor, e, amount);
        events.push({ type: 'damage', actor: actor.id, target: e.id, amount: dealt, isCrit, text: `The War Machine's opening barrage hits ${e.name} for ${dealt} damage.` });
        if (e.isDead) events.push({ type: 'death', actor: e.id, text: `${e.name} has fallen!` });
      });
    },

    // Fencer -------------------------------------------------------------------------------------
    lunge(actor, skillDef, targets, events) {
      const moved = CharacterMechanics.reposition(actor, 'forward');
      if (moved) events.push({ type: 'special', actor: actor.id, text: `${actor.name} lunges forward to the ${actor.position.row} row.` });
    },
    thousand_thrusts(actor, skillDef, targets, events) {
      const target = targets[0];
      if (!target || target.isDead) return;
      const stacks = StatusEngine.get(actor, 'footwork');
      const extraHits = stacks ? stacks.stacks : 0;
      for (let i = 0; i < extraHits; i++) {
        if (target.isDead) break;
        const { amount, isCrit } = CombatEngine.calculateDamage(actor, target, 0.4, { bypassProtection: true });
        const dealt = CombatEngine.applyDamage(actor, target, amount);
        events.push({ type: 'damage', actor: actor.id, target: target.id, amount: dealt, isCrit,
          text: `${actor.name}'s blade finds ${target.name} again for ${dealt} damage.` });
        if (target.isDead) events.push({ type: 'death', actor: target.id, text: `${target.name} has fallen!` });
      }
      StatusEngine.remove(actor, 'footwork');
    },

    // Bard ---------------------------------------------------------------------------------------
    battle_song(actor, skillDef, targets, events, ctx) {
      CharacterMechanics.setStance(actor, 'battle_song');
      const allies = ctx.allActors.filter(a => a.side === actor.side && !a.isDead);
      allies.forEach(a => StatusEngine.apply(a, 'battle_song_buff', 3, actor.id));
      events.push({ type: 'buff', actor: actor.id, text: `${actor.name} strikes up a Battle Song - the team's Attack surges!` });
    },
    war_drum(actor, skillDef, targets, events, ctx) {
      CharacterMechanics.setStance(actor, 'war_drum');
      const allies = ctx.allActors.filter(a => a.side === actor.side && !a.isDead);
      allies.forEach(a => { StatusEngine.apply(a, 'war_drum_buff', 3, actor.id); CombatEngine.gainEnergy(a, 8); });
      events.push({ type: 'buff', actor: actor.id, text: `${actor.name} beats the War Drum - the team quickens!` });
    },
    grand_performance(actor, skillDef, targets, events, ctx) {
      const allies = ctx.allActors.filter(a => a.side === actor.side && !a.isDead);
      const enemies = ctx.allActors.filter(a => a.side !== actor.side && !a.isDead);
      if (actor.mech.stance === 'battle_song') {
        allies.forEach(a => StatusEngine.apply(a, 'battle_song_buff', 2, actor.id));
        events.push({ type: 'buff', actor: actor.id, text: `${actor.name}'s Grand Performance empowers the whole team's Attack!` });
      } else if (actor.mech.stance === 'war_drum') {
        allies.forEach(a => { StatusEngine.apply(a, 'war_drum_buff', 2, actor.id); CombatEngine.gainEnergy(a, 10); });
        events.push({ type: 'buff', actor: actor.id, text: `${actor.name}'s Grand Performance quickens the whole team!` });
      } else {
        enemies.forEach(e => StatusEngine.apply(e, 'lullaby_debuff', 2, actor.id));
        events.push({ type: 'debuff', actor: actor.id, text: `${actor.name} plays a Lullaby, weakening every enemy's Attack!` });
      }
    },

    // Gladiator ----------------------------------------------------------------------------------
    arena_champion(actor, skillDef, targets, events) {
      const rage = actor.mech.rage;
      const reduction = Math.round(15 + (rage / 100) * 25); // 15%-40% damage reduction scaling with Rage
      const rageStatus = StatusEngine.get(actor, 'rage_shield');
      if (rageStatus) rageStatus.magnitude = reduction;
      CharacterMechanics.spendRage(actor, 100);
      events.push({ type: 'buff', actor: actor.id, text: `${actor.name} unleashes his Rage, hardening his resolve (${reduction}% damage reduction)!` });
    },

    // Plague Doctor --------------------------------------------------------------------------------
    pandemic(actor, skillDef, targets, events, ctx) {
      const target = targets[0];
      if (!target || target.isDead) return;
      const poison = StatusEngine.get(target, 'poison');
      const disease = StatusEngine.get(target, 'disease');
      if (poison) poison.duration = Math.max(poison.duration, 2);
      if (disease) disease.duration = Math.max(disease.duration, 2);
      CharacterMechanics.trySpreadDebuff(actor, target, ctx.allActors, events);
    },

    // Void Walker -------------------------------------------------------------------------------
    blink(actor, skillDef, targets, events) {
      const moved = CharacterMechanics.reposition(actor, 'forward');
      StatusEngine.apply(actor, 'void_step', 2, actor.id, 1);
      events.push({ type: 'special', actor: actor.id, text: moved ? `${actor.name} blinks forward to the ${actor.position.row} row.` : `${actor.name} blinks in place, ready to strike.` });
    },
    void_strike(actor, skillDef, targets, events) {
      StatusEngine.apply(actor, 'void_step', 2, actor.id, 1);
    },
    void_collapse(actor, skillDef, targets, events) {
      StatusEngine.apply(actor, 'void_step', 2, actor.id, 1);
      events.push({ type: 'special', actor: actor.id, text: `${actor.name} blinks back out of the fray.` });
    },

    // ---- Roster expansion 3 (41-50) ----

    // Dragon Knight ------------------------------------------------------------------------------
    dragon_form(actor, skillDef, targets, events) {
      if (actor.mech.dragonGauge < 50) {
        events.push({ type: 'special', actor: actor.id, text: `${actor.name}'s Dragon Gauge is too low to fully transform - the Ultimate fizzles into a weaker burst.` });
        StatusEngine.remove(actor, 'dragon_form'); // don't grant the transformation buff without enough Gauge
        return;
      }
      CharacterMechanics.spendDragonGauge(actor, 100); // consumed immediately - prevents back-to-back transformations (#17/#29)
      events.push({ type: 'special', actor: actor.id, text: `${actor.name} transforms into DRAGON FORM!` });
    },

    // Shadow Priest --------------------------------------------------------------------------------
    // (Shadow Heal's HP cost and Soul Sacrifice's HP-scaling are handled inline in skills.js.)

    // Sniper -----------------------------------------------------------------------------------------
    // (Aim / Long Range / Headshot bonuses are handled inline in combat.js/skills.js.)

    // Rune Master --------------------------------------------------------------------------------------
    inscribe(actor, skillDef, targets, events) {
      const rune = CharacterMechanics.inscribeRune(actor);
      events.push({ type: 'special', actor: actor.id, text: `${actor.name} inscribes the ${rune.toUpperCase()} Rune. (${actor.mech.runes.length}/3 active)` });
    },
    rune_fusion(actor, skillDef, targets, events) {
      const result = CharacterMechanics.runeFusionResult(actor);
      if (result) events.push({ type: 'special', actor: actor.id, text: `${actor.name} fuses her Runes into a ${result} effect!` });
    },
    grand_rune(actor, skillDef, targets, events, ctx) {
      const runes = actor.mech.runes;
      const allies = ctx.allActors.filter(a => a.side === actor.side && !a.isDead);
      if (runes.includes('guard')) {
        allies.forEach(a => CombatEngine.applyShield(a, Math.round(a.maxHp * 0.12)));
        events.push({ type: 'shield', actor: actor.id, text: `${actor.name}'s Grand Rune shields the whole team!` });
      }
      if (runes.includes('wind')) {
        allies.forEach(a => StatusEngine.apply(a, 'speed_up', 2, actor.id));
        events.push({ type: 'buff', actor: actor.id, text: `${actor.name}'s Grand Rune quickens the whole team!` });
      }
      actor.mech.runes = []; // Runes are spent - see #15/#29 (no unbounded reuse of the same combo)
    },

    // Witch ------------------------------------------------------------------------------------------
    hex(actor, skillDef, targets, events) {
      const target = targets[0];
      if (!target || target.isDead) return;
      const pool = ['attack_down', 'defense_down', 'speed_down', 'healing_reduction', 'poison'];
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      const debuffCount = target.statuses.filter(s => STATUS_DEFS[s.id] && STATUS_DEFS[s.id].category === 'debuff').length;
      const witchcraftBonus = Math.min(3, debuffCount);
      StatusEngine.apply(target, chosen, 2 + witchcraftBonus, actor.id);
      events.push({ type: 'status', actor: actor.id, target: target.id, statusId: chosen, text: `${target.name} is afflicted by ${STATUS_DEFS[chosen].name}!` });
    },
    curse_transfer(actor, skillDef, targets, events, ctx) {
      const ally = targets[0];
      if (!ally) return;
      const debuff = ally.statuses.find(s => STATUS_DEFS[s.id] && STATUS_DEFS[s.id].category === 'debuff');
      if (!debuff) { events.push({ type: 'special', actor: actor.id, text: `${ally.name} has no debuff to transfer.` }); return; }
      const enemies = ctx.allActors.filter(a => a.side !== actor.side && !a.isDead);
      if (enemies.length === 0) return;
      const target = enemies[Math.floor(Math.random() * enemies.length)];
      StatusEngine.remove(ally, debuff.id);
      StatusEngine.apply(target, debuff.id, debuff.duration || 2, actor.id);
      events.push({ type: 'status', actor: actor.id, target: target.id, statusId: debuff.id,
        text: `${actor.name} rips ${STATUS_DEFS[debuff.id].name} from ${ally.name} and hurls it onto ${target.name}!` });
    },

    // Battle Medic -------------------------------------------------------------------------------------
    // (Combat Heal's attacked-last-turn bonus is handled inline in skills.js.)

    // Beast Rider -----------------------------------------------------------------------------------------
    charge(actor, skillDef, targets, events) {
      const target = targets[0];
      if (!target || target.isDead) return;
      const moved = CharacterMechanics.reposition(target, 'backward');
      if (moved) events.push({ type: 'special', actor: actor.id, target: target.id, text: `${target.name} is knocked back to the ${target.position.row} row!` });
    },
    dismount(actor, skillDef, targets, events) {
      actor.mech.mounted = false;
      events.push({ type: 'special', actor: actor.id, text: `${actor.name} dismounts, trading mobility for resilience.` });
    },

    // Berserker Lord ------------------------------------------------------------------------------------------
    blood_roar(actor, skillDef, targets, events) {
      if (actor.isDead) return;
      const cost = Math.min(actor.hp - 1, Math.round(actor.maxHp * 0.12));
      if (cost > 0) {
        actor.hp -= cost;
        events.push({ type: 'special', actor: actor.id, text: `${actor.name} sacrifices ${cost} HP in a Blood Roar.` });
      }
      CharacterMechanics.gainRage(actor, 30);
    },
    wrath_unleashed(actor, skillDef, targets, events) {
      CharacterMechanics.spendRage(actor, 70); // drops sharply afterward - prevents back-to-back nukes (#29)
      events.push({ type: 'special', actor: actor.id, text: `${actor.name}'s Rage subsides after unleashing his Wrath.` });
    },

    // Rune Master (Rune Bolt's Guard/Wind bonuses - Fire's damage bonus lives in combat.js) --------------------
    rune_bolt(actor, skillDef, targets, events) {
      if (!actor.mech || !actor.mech.runes.includes('guard')) return;
      CombatEngine.applyShield(actor, Math.round(actor.maxHp * 0.04));
      events.push({ type: 'shield', actor: actor.id, target: actor.id, text: `${actor.name}'s Guard Rune grants a sliver of Shield.` });
      if (actor.mech.runes.includes('wind')) {
        CharacterMechanics.advanceReadiness(actor, 0.08);
        events.push({ type: 'special', actor: actor.id, text: `${actor.name}'s Wind Rune quickens her next turn slightly.` });
      }
    },

    // Soul Reaper --------------------------------------------------------------------------------------------------
    reapers_domain(actor, skillDef, targets, events) {
      StatusEngine.apply(actor, 'attack_up', 2, actor.id);
      events.push({ type: 'buff', actor: actor.id, text: `${actor.name} opens a Soul Domain, gaining Attack Up.` });
    },
  },
};
