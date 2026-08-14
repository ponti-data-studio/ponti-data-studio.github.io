/**
 * PONTI ARENA - Character Mechanics (roster expansion: 21-30)
 * Isolated handlers for the handful of genuinely custom behaviors introduced by the new
 * characters (damage redirection, counter-attacks, reagents, duel stacks, totems, turn-gauge
 * manipulation, decoy wards, position pulls). Everything else about these characters (basic
 * stats, plain damage/heal/buff skills) flows through the existing data-driven systems in
 * characters.js/skills.js/combat.js exactly like the original 20.
 *
 * Every mechanic here has an explicit cap/duration/limit - see #25 Bug Prevention: no infinite
 * turns, counters, heals, shields, repositions, clones, rewinds, or energy.
 */

const CharacterMechanics = {
  /** Per-actor custom state, initialized once when the battle actor is created (see battle.js). */
  initActorState(actor) {
    actor.mech = {
      protectedAllyId: null,     // Paladin
      counteredThisTurn: false,  // Samurai / Duelist
      reagents: { healing: 0, toxic: 0, swift: 0, purifying: 0 }, // Alchemist
      duelTarget: null, duelStacks: 0, // Duelist
      activeTotem: null,         // Spirit Shaman ('healing' | 'spirit')
    };
    actor.hpHistory = []; // used by Chronomancer's Rewind (universal, cheap, capped at 6 entries)
  },

  /** Called once per actor at the start of THEIR OWN turn (after status ticks), from battle.js. */
  onTurnStart(actor, allActors) {
    actor.mech.counteredThisTurn = false;
    actor.hpHistory.push(actor.hp);
    if (actor.hpHistory.length > 6) actor.hpHistory.shift();

    if (actor.isDead) return;

    if (actor.character.id === 'paladin') this.refreshProtection(actor, allActors);
    if (actor.character.id === 'alchemist') this.generateReagent(actor);
  },

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
  },
};
