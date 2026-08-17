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
  BEAST_TYPES: [
    { name: 'Tiger', icon: '🐅', hpMult: 0.22, atkMult: 0.55 },
    { name: 'Wolf', icon: '🐺', hpMult: 0.16, atkMult: 0.45 },
    { name: 'Eagle', icon: '🦅', hpMult: 0.10, atkMult: 0.65 },
  ],

  /** Per-actor custom state, initialized once when the battle actor is created (see battle.js). */
  initActorState(actor) {
    actor.mech = {
      protectedAllyId: null,     // Paladin
      counteredThisTurn: false,  // Samurai / Duelist / Fencer
      reagents: { healing: 0, toxic: 0, swift: 0, purifying: 0 }, // legacy field, unused (kept only for save-compat)
      bottles: 10,                // Alchemist (0-10)
      duelTarget: null, duelStacks: 0, // Duelist
      activeTotems: { healing: false, spirit: false }, // Spirit Shaman - both can be active at once
      totemSlots: { healing: null, spirit: null },     // Spirit Shaman - {row, column} per active Totem
      skeletonsLost: 0,           // Necromancer - count of his own fallen Skeletons this battle
      turretId: null,              // Engineer - actor id of his current Turret/War Machine summon, if any
      isWarMachine: false,         // Engineer - whether the Turret is currently upgraded (AoE auto-fire)
      warMachineTurnsLeft: 0,      // Engineer - how many more of HIS turns the AoE fire mode lasts
      beastCycle: 0,               // Beastmaster - which beast type is next (0=Tiger,1=Wolf,2=Eagle)
      beastId: null,                // Beastmaster - actor id of her current living Beast, if any
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
    if (actor.character.id === 'engineer') this.autoShootTurret(actor, allActors, events);
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
    // Necromancer's Necrotic Power also strengthens with his own fallen Skeletons.
    if (deadActor.isSummon && deadActor.ownerId) {
      const owner = allActors.find(a => a.id === deadActor.ownerId);
      if (owner && owner.character.id === 'necromancer' && owner.mech) owner.mech.skeletonsLost += 1;
      // Engineer's Turret/War Machine destroyed - clear the reference so Auto Shoot stops trying.
      if (owner && owner.character.id === 'engineer' && owner.mech && owner.mech.turretId === deadActor.id) {
        owner.mech.turretId = null;
        owner.mech.isWarMachine = false;
      }
    }
  },

  // ---------------------------------------------------------------- ENGINEER ----
  /** Engineer's Auto Shoot passive: fires the Turret (single random target) or War Machine (whole
   *  row) at the start of Engineer's own turn - see the row-fallback rule below. Called once per
   *  Engineer turn from onTurnStart; the AoE window then ticks down by exactly one of Engineer's
   *  own turns per call. */
  autoShootTurret(engineer, allActors, events) {
    const turret = allActors.find(a => a.id === engineer.mech.turretId && !a.isDead);
    if (!turret) { engineer.mech.turretId = null; engineer.mech.isWarMachine = false; return; }
    this.fireTurret(engineer, turret, allActors, events, false);
    if (engineer.mech.isWarMachine) {
      engineer.mech.warMachineTurnsLeft -= 1;
      if (engineer.mech.warMachineTurnsLeft <= 0) {
        engineer.mech.isWarMachine = false; // Reverts to single-target auto-fire; the stat upgrade itself stays.
        events.push({ type: 'special', actor: engineer.id, text: `${turret.name} settles back into standard Turret fire mode.` });
      }
    }
  },

  /** Turret fires 1 random enemy in the Front Row (or Middle, or Back - first non-empty row).
   *  War Machine (isWarMachine true, or `forceAoe`) instead fires at EVERY enemy in that row. */
  fireTurret(engineer, turret, allActors, events, forceAoe) {
    if (!turret || turret.isDead) return;
    const isWarMachine = forceAoe || engineer.mech.isWarMachine;
    const enemies = allActors.filter(a => a.side !== engineer.side && !a.isDead);
    if (enemies.length === 0) return;
    let targetRow = null;
    for (const row of ['front', 'middle', 'back']) {
      if (enemies.some(e => e.position.row === row)) { targetRow = row; break; }
    }
    if (!targetRow) return;
    const rowEnemies = enemies.filter(e => e.position.row === targetRow);
    const label = turret.name;
    const shoot = (target) => {
      const { amount, isCrit } = CombatEngine.calculateDamage(turret, target, 1.0, { bypassProtection: true });
      const dealt = CombatEngine.applyDamage(turret, target, amount);
      events.push({ type: 'damage', actor: turret.id, target: target.id, amount: dealt, isCrit,
        text: `${label} fires at ${target.name} for ${dealt} damage.` });
      if (target.isDead) { events.push({ type: 'death', actor: target.id, text: `${target.name} has fallen!` }); CharacterMechanics.registerDeath(target, allActors); }
    };
    if (isWarMachine) {
      rowEnemies.forEach(shoot);
    } else {
      shoot(rowEnemies[Math.floor(Math.random() * rowEnemies.length)]);
    }
  },

  /** Deploys a real, independently targetable Turret (see battle.createSummon) - enemies can
   *  attack and destroy it directly; Engineer herself is untouched by hits aimed at the Turret. */
  deployTurret(engineer, ctx) {
    if (!ctx.battle) return null;
    const maxHp = Math.round(engineer.maxHp * 0.42);
    const attack = Math.round(CombatEngine.liveStat(engineer, 'attack') * 0.55);
    const turret = ctx.battle.createSummon(engineer, { name: 'Turret', icon: '🛠️', color: '#c9c94a', hp: maxHp, attack, attackType: 'physical' }, ctx.chosenSlot);
    if (turret) engineer.mech.turretId = turret.id;
    return turret;
  },

  /** Finds an open grid slot for a new summon on `owner`'s side of the 12-slot battlefield
   *  (combining living characters AND any other active summon already occupying a slot there) -
   *  see #4/#5 in the formation spec: every summon takes exactly one visible battle slot. */
  findSummonSlot(owner, allActors) {
    if (typeof TargetingEngine === 'undefined') return null;
    const occupied = allActors.filter(a => a.side === owner.side && !a.isDead).map(a => ({ row: a.position.row, column: a.position.column }));
    const otherSummons = this.getActiveSummons(allActors).filter(s => s.side === owner.side);
    const combined = [...occupied, ...otherSummons];
    return TargetingEngine.findOpenSlot(combined, owner.position ? owner.position.row : 'back');
  },

  /** Collects every currently-active PURELY VISUAL summon (Spirit Shaman's Totems) across all
   *  actors into one normalized list for rendering - see buildSummonSlot() in ui.js. Engineer's
   *  Turret/War Machine is NOT listed here anymore: it's a real actor in battle.actors now (see
   *  battle.createSummon), so it's already rendered through the normal actor-slot path. */
  getActiveSummons(allActors) {
    const summons = [];
    allActors.forEach((a) => {
      if (!a.mech || a.isDead) return;
      if (a.mech.activeTotems) {
        if (a.mech.activeTotems.healing && a.mech.totemSlots && a.mech.totemSlots.healing) {
          const s = a.mech.totemSlots.healing;
          summons.push({ id: `totem-healing-${a.id}`, ownerId: a.id, side: a.side, row: s.row, column: s.column,
            icon: '🌀', name: 'Healing Totem', hp: null, maxHp: null, color: '#6fc9d9' });
        }
        if (a.mech.activeTotems.spirit && a.mech.totemSlots && a.mech.totemSlots.spirit) {
          const s = a.mech.totemSlots.spirit;
          summons.push({ id: `totem-spirit-${a.id}`, ownerId: a.id, side: a.side, row: s.row, column: s.column,
            icon: '🌪️', name: 'Spirit Totem', hp: null, maxHp: null, color: '#c9a9e0' });
        }
      }
    });
    return summons;
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
  /** Inscribes `chosen` (a player-picked 'fire'|'guard'|'wind'), or falls back to a fixed
   *  Fire->Guard->Wind rotation for AI-controlled casters / anywhere no choice was made. */
  inscribeRune(actor, chosen) {
    const order = ['fire', 'guard', 'wind'];
    let next = chosen && order.includes(chosen) ? chosen : null;
    if (!next) {
      const last = actor.mech.runes.length > 0 ? actor.mech.runes[actor.mech.runes.length - 1] : null;
      next = order[(order.indexOf(last) + 1) % order.length];
    }
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
    const percent = (defender.character.reflectPercent || 0) + (boost ? 40 : 0);
    if (percent <= 0) return null;
    const cap = Math.round(defender.maxHp * 0.16); // maximum reflect damage per hit
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
        return this.fireCounter(defender, attacker, 1.75, 'Iaido');
      }
      if (parry) {
        StatusEngine.remove(defender, 'parry_stance');
        StatusEngine.apply(defender, 'counter_mark', 2, defender.id);
        return null; // Parry grants a buff for the NEXT attack rather than an instant counter
      }
      if (defender.defending) {
        return this.fireCounter(defender, attacker, 1.05, 'Bushido');
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
  /** A single unified bottle rack (max 10) replaces the old 4-type reagent system. */
  spendBottles(alchemist, amount) {
    if (alchemist.mech.bottles < amount) return false;
    alchemist.mech.bottles -= amount;
    return true;
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
  /** Only one totem aura may be active at a time - casting a new one clears the old (#Spirit Bond).
   *  The totem also claims a visible battle slot on the Shaman's side (freed automatically once
   *  replaced, since a new call here reassigns `totemSlot` before the old one is ever read again). */
  /** Both Totems can now be active at once (not mutually exclusive) - each claims its own grid
   *  slot and its own aura, and re-casting the SAME totem just refreshes its duration. */
  applyTotem(shaman, allies, totemKey, statusId, duration) {
    if (!shaman.mech.activeTotems) shaman.mech.activeTotems = {};
    if (!shaman.mech.totemSlots) shaman.mech.totemSlots = {};
    shaman.mech.activeTotems[totemKey] = true;
    if (!shaman.mech.totemSlots[totemKey]) {
      shaman.mech.totemSlots[totemKey] = this.findSummonSlot(shaman, allies);
    }
    allies.forEach(a => StatusEngine.apply(a, statusId, duration, shaman.id));
  },

  // ---------------------------------------------------------------- GRAVITY MAGE / PIRATE CAPTAIN ----
  /** Repositions an actor one row toward `direction` ('forward' = back->middle->front,
   *  'backward' = front->middle->back). No-op (safe) if already at the boundary - see #25. */
  /** Repositions an actor one row toward `direction` ('forward' = back->middle->front,
   *  'backward' = front->middle->back). No-op (safe) if already at the boundary - see #25.
   *  If `allActors` is provided, finds a genuinely open column in the destination row (the fixed
   *  12-slot grid caps each row at 4 - see #5) instead of blindly keeping the old column index,
   *  which could otherwise land two units on the exact same slot. */
  reposition(actor, direction, allActors) {
    if (!actor.position) return false;
    const order = ['back', 'middle', 'front'];
    const idx = order.indexOf(actor.position.row);
    if (idx === -1) return false;
    const newIdx = direction === 'forward' ? idx + 1 : idx - 1;
    if (newIdx < 0 || newIdx > 2) return false; // already at the boundary - stays put
    const newRow = order[newIdx];
    if (allActors) {
      const occupied = new Set(allActors.filter(a => a !== actor && !a.isDead && a.side === actor.side && a.position.row === newRow).map(a => a.position.column));
      let col = actor.position.column;
      if (occupied.has(col)) {
        col = 0;
        while (occupied.has(col) && col < 4) col++;
        if (col >= 4) return false; // destination row is completely full - can't move there
      }
      actor.position = { row: newRow, column: col };
    } else {
      actor.position = { row: newRow, column: actor.position.column };
    }
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
    const energyRestored = Math.min(55, 100 - target.energy);
    target.energy = Math.min(100, target.energy + 55);
    const debuffs = target.statuses.filter(s => STATUS_DEFS[s.id] && STATUS_DEFS[s.id].category === 'debuff').slice(0, 3);
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
      const fraction = actor.position && actor.position.row !== 'front' ? 0.5 : 0.4; // Time Flow row bonus
      CharacterMechanics.advanceReadiness(target, fraction);
      events.push({ type: 'special', actor: actor.id, target: target.id, text: `${target.name}'s next turn draws closer.` });
    },
    rewind(actor, skillDef, targets, events) {
      const target = targets[0];
      if (!target) return;
      const result = CharacterMechanics.rewind(target);
      events.push({ type: 'heal', actor: actor.id, target: target.id, amount: result.healed,
        text: `${actor.name} rewinds time for ${target.name}: +${result.healed} HP, +${result.energyRestored} Energy, ${result.cleansed} debuff(s) undone.` });
    },
    freezing_time(actor, skillDef, targets, events, ctx) {
      if (!ctx.battle) return;
      ctx.battle.globalFreeze = { side: actor.side === 'player' ? 'enemy' : 'player', turnsRemaining: 3 };
      events.push({ type: 'special', actor: actor.id, text: `${actor.name} freezes time itself - the enemy team cannot act for the next 3 turns!` });
    },

    // Shadow Priest -------------------------------------------------------------------------------
    shadow_heal(actor, skillDef, targets, events, ctx) {
      const target = targets[0];
      if (!target || target.isDead || target.id === actor.id) {
        events.push({ type: 'special', actor: actor.id, text: `${actor.name} cannot target herself with Shadow Heal.` });
        return;
      }
      // AI (or any caller without a player-chosen amount) defaults to a sensible fixed fraction.
      let amount = ctx.sacrificeAmount;
      if (!amount || amount <= 0) amount = Math.round(actor.maxHp * 0.18);
      amount = Math.max(1, Math.min(actor.hp - 1, amount));
      actor.hp -= amount;
      let healAmt = amount * 2;
      // Dark Blessing: extra healing effectiveness while her own HP is critically low.
      if (actor.hp / actor.maxHp < 0.4) healAmt = Math.round(healAmt * 1.15);
      const healed = CombatEngine.applyHeal(actor, target, healAmt);
      events.push({ type: 'heal', actor: actor.id, target: target.id, amount: healed,
        text: `${actor.name} sacrifices ${amount} HP - ${target.name} is healed for ${healed}.` });
    },
    life_taker(actor, skillDef, targets, events) {
      const target = targets[0];
      if (!target || target.isDead) return;
      let pct = 0.14;
      if (actor.hp / actor.maxHp < 0.4) pct *= 1.15; // Dark Blessing
      const healAmt = Math.round(target.maxHp * pct);
      const healed = CombatEngine.applyHeal(actor, actor, healAmt);
      events.push({ type: 'heal', actor: actor.id, target: actor.id, amount: healed,
        text: `${actor.name} siphons life from ${target.name} without harming them, healing for ${healed}.` });
    },
    soul_sacrifice(actor, skillDef, targets, events, ctx) {
      const target = targets[0];
      if (!target || target.isDead) return;
      let amount = ctx.sacrificeAmount;
      if (!amount || amount <= 0) amount = Math.round(actor.maxHp * 0.2);
      amount = Math.max(1, Math.min(actor.hp - 1, amount));
      actor.hp -= amount;
      target.hp = Math.max(0, target.hp - amount);
      if (target.hp <= 0) { target.isDead = true; }
      events.push({ type: 'damage', actor: actor.id, target: target.id, amount, isCrit: false,
        text: `${actor.name} sacrifices ${amount} HP - ${target.name} loses the same amount!` });
      if (target.isDead) { events.push({ type: 'death', actor: target.id, text: `${target.name} has fallen!` }); CharacterMechanics.registerDeath(target, ctx.allActors); }
    },

    // Necromancer -------------------------------------------------------------------------------
    summon_skeleton(actor, skillDef, targets, events, ctx) {
      if (!ctx.battle) return;
      const attack = Math.round(CombatEngine.liveStat(actor, 'attack') * 0.4);
      const skeleton = ctx.battle.createSummon(actor, { name: 'Skeleton', icon: '💀', color: '#c9c9c9', hp: 1, attack, attackType: 'physical' }, ctx.chosenSlot);
      if (skeleton) events.push({ type: 'special', actor: actor.id, text: `${actor.name} raises a Skeleton (1 HP)!` });
      else events.push({ type: 'special', actor: actor.id, text: `${actor.name} has no room left to raise another Skeleton.` });
    },
    skeleton_attack(actor, skillDef, targets, events, ctx) {
      const primary = targets[0];
      if (!primary || primary.isDead) return;
      const skeletons = ctx.battle ? ctx.battle.livingSummonsOf(actor.id) : [];
      skeletons.forEach((sk) => {
        if (primary.isDead) return;
        const { amount, isCrit } = CombatEngine.calculateDamage(sk, primary, 1.0, {});
        const dealt = CombatEngine.applyDamage(sk, primary, amount);
        events.push({ type: 'damage', actor: sk.id, target: primary.id, amount: dealt, isCrit,
          text: `${sk.name} claws at ${primary.name} for ${dealt} damage.` });
        if (primary.isDead) {
          events.push({ type: 'death', actor: primary.id, text: `${primary.name} has fallen!` });
          CharacterMechanics.registerDeath(primary, ctx.allActors);
        }
      });
    },

    // Beastmaster ---------------------------------------------------------------------------------
    summon_beast(actor, skillDef, targets, events, ctx) {
      if (!ctx.battle) return;
      // Replaceable: casting again removes whatever Beast she already had.
      if (actor.mech.beastId) {
        const old = ctx.allActors.find(a => a.id === actor.mech.beastId);
        if (old && !old.isDead) { old.isDead = true; old.hp = 0; }
      }
      const type = CharacterMechanics.BEAST_TYPES[actor.mech.beastCycle % 3];
      actor.mech.beastCycle += 1;
      const hp = Math.max(60, Math.round(actor.maxHp * type.hpMult));
      const attack = Math.round(CombatEngine.liveStat(actor, 'attack') * type.atkMult);
      const beast = ctx.battle.createSummon(actor, { name: type.name, icon: type.icon, color: '#a67c52', hp, attack, attackType: 'physical' }, ctx.chosenSlot);
      if (beast) {
        actor.mech.beastId = beast.id;
        events.push({ type: 'special', actor: actor.id, text: `${actor.name} summons a ${type.name}!` });
      } else {
        actor.mech.beastId = null;
        events.push({ type: 'special', actor: actor.id, text: `${actor.name} has no room to summon a Beast.` });
      }
    },
    command_beast(actor, skillDef, targets, events, ctx) {
      const target = targets[0];
      if (!target || target.isDead) return;
      const beast = ctx.allActors.find(a => a.id === actor.mech.beastId && !a.isDead);
      if (!beast) {
        events.push({ type: 'special', actor: actor.id, text: `${actor.name} has no Beast to command.` });
        return;
      }
      // She, her Beast, and two more animals all strike the same target together.
      const strikes = [{ source: actor, power: 0.55 }, { source: beast, power: 0.9 }, { source: beast, power: 0.5 }, { source: beast, power: 0.5 }];
      strikes.forEach(({ source, power }, i) => {
        if (target.isDead) return;
        const { amount, isCrit } = CombatEngine.calculateDamage(source, target, power, {});
        const dealt = CombatEngine.applyDamage(source, target, amount);
        const label = i === 0 ? `${actor.name} strikes` : i === 1 ? `${beast.name} pounces on` : 'A called animal strikes';
        events.push({ type: 'damage', actor: source.id, target: target.id, amount: dealt, isCrit,
          text: `${label} ${target.name} for ${dealt} damage.` });
        if (target.isDead) { events.push({ type: 'death', actor: target.id, text: `${target.name} has fallen!` }); CharacterMechanics.registerDeath(target, ctx.allActors); }
      });
    },
    primal_fury(actor, skillDef, targets, events, ctx) {
      const beast = ctx.allActors.find(a => a.id === actor.mech.beastId && !a.isDead);
      if (!beast) return;
      targets.forEach((t) => {
        if (t.isDead) return;
        const { amount, isCrit } = CombatEngine.calculateDamage(beast, t, 0.8, {});
        const dealt = CombatEngine.applyDamage(beast, t, amount);
        events.push({ type: 'damage', actor: beast.id, target: t.id, amount: dealt, isCrit,
          text: `${beast.name} joins the assault on ${t.name} for ${dealt} damage.` });
        if (t.isDead) { events.push({ type: 'death', actor: t.id, text: `${t.name} has fallen!` }); CharacterMechanics.registerDeath(t, ctx.allActors); }
      });
    },


    // Alchemist -------------------------------------------------------------------------------
    // (Bottle consumption for the basic attack / skills happens up-front in skills.js so the
    //  power scaling and gating apply to the same cast.)
    healing_potion(actor, skillDef, targets, events) {
      const target = targets[0];
      if (target && !target.isDead && StatusEngine.has(target, 'poison')) {
        StatusEngine.remove(target, 'poison');
        events.push({ type: 'cleanse', actor: actor.id, target: target.id, text: `${target.name}'s Poison is washed away.` });
      }
    },
    compounding_chemicals(actor, skillDef, targets, events) {
      const gained = 10 - actor.mech.bottles;
      actor.mech.bottles = 10;
      events.push({ type: 'special', actor: actor.id, text: `${actor.name} brews a fresh batch, gaining ${gained} bottles (10/10).` });
    },

    // Spirit Shaman -----------------------------------------------------------------------------
    healing_totem(actor, skillDef, targets, events, ctx) {
      const allies = ctx.allActors.filter(a => a.side === actor.side && !a.isDead);
      CharacterMechanics.applyTotem(actor, allies, 'healing', 'healing_totem_aura', 4);
      events.push({ type: 'special', actor: actor.id, text: `${actor.name} plants a Healing Totem for the team.` });
    },
    spirit_totem(actor, skillDef, targets, events, ctx) {
      const allies = ctx.allActors.filter(a => a.side === actor.side && !a.isDead);
      CharacterMechanics.applyTotem(actor, allies, 'spirit', 'spirit_totem_aura', 4);
      events.push({ type: 'special', actor: actor.id, text: `${actor.name} plants a Spirit Totem for the team.` });
    },

    // Pirate Captain / Gravity Mage: position manipulation --------------------------------------
    explosive_barrel(actor, skillDef, targets, events, ctx) {
      targets.forEach(t => {
        if (t.isDead) return;
        const moved = CharacterMechanics.reposition(t, 'backward', ctx.allActors);
        if (moved) events.push({ type: 'special', actor: actor.id, target: t.id, text: `${t.name} is knocked back to the ${t.position.row} row!` });
      });
    },
    gravity_pull(actor, skillDef, targets, events, ctx) {
      targets.forEach(t => {
        if (t.isDead) return;
        const moved = CharacterMechanics.reposition(t, 'forward', ctx.allActors);
        if (moved) events.push({ type: 'special', actor: actor.id, target: t.id, text: `${t.name} is pulled forward to the ${t.position.row} row!` });
      });
    },
    gravity_push(actor, skillDef, targets, events, ctx) {
      targets.forEach(t => {
        if (t.isDead) return;
        const moved = CharacterMechanics.reposition(t, 'backward', ctx.allActors);
        if (moved) events.push({ type: 'special', actor: actor.id, target: t.id, text: `${t.name} is shoved back to the ${t.position.row} row!` });
      });
    },
    singularity(actor, skillDef, targets, events, ctx) {
      const livingHits = targets.filter(t => !t.isDead);
      if (livingHits.length < 2) return;
      // Converge everyone caught into the Middle Row, unless they're already there.
      livingHits.forEach(t => {
        if (t.position.row === 'front') CharacterMechanics.reposition(t, 'backward', ctx.allActors);
        else if (t.position.row === 'back') CharacterMechanics.reposition(t, 'forward', ctx.allActors);
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
    deploy_turret_eng(actor, skillDef, targets, events, ctx) {
      const turret = CharacterMechanics.deployTurret(actor, ctx);
      if (turret) events.push({ type: 'special', actor: actor.id, text: `${actor.name} deploys a Turret - enemies can target it directly.` });
      else events.push({ type: 'special', actor: actor.id, text: `${actor.name} has no room to deploy a Turret.` });
    },
    repair(actor, skillDef, targets, events, ctx) {
      const turret = ctx.allActors.find(a => a.id === actor.mech.turretId && !a.isDead);
      if (!turret) {
        events.push({ type: 'special', actor: actor.id, text: `${actor.name} has no Turret to repair.` });
        return;
      }
      const restore = Math.round(turret.maxHp * 0.5);
      const healed = CombatEngine.applyHeal(actor, turret, restore);
      events.push({ type: 'heal', actor: actor.id, target: turret.id, amount: healed, text: `${actor.name} repairs ${turret.name} for ${healed} HP.` });
    },
    war_machine(actor, skillDef, targets, events, ctx) {
      let turret = ctx.allActors.find(a => a.id === actor.mech.turretId && !a.isDead);
      let justDeployed = false;
      if (!turret) {
        turret = CharacterMechanics.deployTurret(actor, ctx);
        justDeployed = true;
      }
      if (!turret) {
        events.push({ type: 'special', actor: actor.id, text: `${actor.name} has no room to deploy a War Machine.` });
        return;
      }
      // Upgrade: bigger HP pool (healed proportionally, never less than 70%) and bigger Attack -
      // this boost is permanent (a real upgrade), while the AoE fire pattern itself lasts 2 turns.
      const hpRatio = justDeployed ? 1 : turret.hp / turret.maxHp;
      turret.maxHp = Math.round(turret.maxHp * 1.7);
      turret.hp = Math.min(turret.maxHp, Math.round(turret.maxHp * Math.max(hpRatio, 0.7)));
      turret.stats.attack = Math.round(turret.stats.attack * 1.6);
      turret.character.base.attack = turret.stats.attack;
      turret.character.name = 'War Machine';
      turret.name = 'War Machine';
      actor.mech.isWarMachine = true;
      actor.mech.warMachineTurnsLeft = 2;
      events.push({ type: 'special', actor: actor.id, target: turret.id, text: `${justDeployed ? 'A freshly deployed Turret is' : "Engineer's Turret is"} upgraded into a War Machine!` });
      // Fires immediately on activation, same row-fallback rule as the passive.
      CharacterMechanics.fireTurret(actor, turret, ctx.allActors, events, true);
    },

    // Machinist ---------------------------------------------------------------------------------
    // (Turret Attack passive - joining her Basic Attack on the same target - is handled inline in
    //  skills.js right next to Beastmaster's Animal Bond, the closest existing analog.)
    deploy_turret_mech(actor, skillDef, targets, events, ctx) {
      const turret = CharacterMechanics.deployTurret(actor, ctx);
      if (turret) events.push({ type: 'special', actor: actor.id, text: `${actor.name} deploys a Turret - enemies can target it directly.` });
      else events.push({ type: 'special', actor: actor.id, text: `${actor.name} has no room to deploy a Turret.` });
    },
    throw_mines(actor, skillDef, targets, events, ctx) {
      const target = targets[0];
      if (!target || target.isDead) return;
      const turret = ctx.allActors.find(a => a.id === actor.mech.turretId && !a.isDead);
      if (!turret) return;
      const { amount, isCrit } = CombatEngine.calculateDamage(turret, target, 0.9, { bypassProtection: true });
      const dealt = CombatEngine.applyDamage(turret, target, amount);
      events.push({ type: 'damage', actor: turret.id, target: target.id, amount: dealt, isCrit,
        text: `${turret.name} joins the strike on ${target.name} for ${dealt} damage.` });
      if (target.isDead) { events.push({ type: 'death', actor: target.id, text: `${target.name} has fallen!` }); CharacterMechanics.registerDeath(target, ctx.allActors); }
    },
    mechanical_overload(actor, skillDef, targets, events, ctx) {
      const turret = ctx.allActors.find(a => a.id === actor.mech.turretId && !a.isDead);
      if (!turret) return;
      targets.forEach((t) => {
        if (t.isDead) return;
        const { amount, isCrit } = CombatEngine.calculateDamage(turret, t, 0.7, { bypassProtection: true });
        const dealt = CombatEngine.applyDamage(turret, t, amount);
        events.push({ type: 'damage', actor: turret.id, target: t.id, amount: dealt, isCrit,
          text: `${turret.name} unloads on ${t.name} for ${dealt} damage.` });
        if (t.isDead) { events.push({ type: 'death', actor: t.id, text: `${t.name} has fallen!` }); CharacterMechanics.registerDeath(t, ctx.allActors); }
      });
    },

    // Fencer -------------------------------------------------------------------------------------
    lunge(actor, skillDef, targets, events, ctx) {
      const moved = CharacterMechanics.reposition(actor, 'forward', ctx.allActors);
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
      allies.forEach(a => {
        StatusEngine.apply(a, 'war_drum_buff', 3, actor.id);
        StatusEngine.apply(a, 'regeneration', 3, actor.id);
        CombatEngine.gainEnergy(a, 8);
      });
      events.push({ type: 'buff', actor: actor.id, text: `${actor.name} beats the War Drum - the team quickens and mends!` });
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
      const reduction = Math.round(20 + (rage / 100) * 30); // 20%-50% damage reduction scaling with Rage
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
    blink(actor, skillDef, targets, events, ctx) {
      let moved = false;
      if (ctx.chosenSlot) {
        // Player-chosen destination - any open slot on her own side of the 12-slot grid.
        const occupied = ctx.allActors.some(a => a !== actor && !a.isDead && a.side === actor.side
          && a.position.row === ctx.chosenSlot.row && a.position.column === ctx.chosenSlot.column);
        if (!occupied) { actor.position = { row: ctx.chosenSlot.row, column: ctx.chosenSlot.column }; moved = true; }
      } else {
        // AI (or no choice made) falls back to a simple forward hop.
        moved = CharacterMechanics.reposition(actor, 'forward', ctx.allActors);
      }
      StatusEngine.apply(actor, 'void_step', 2, actor.id, 1);
      StatusEngine.apply(actor, 'speed_up', 2, actor.id);
      events.push({ type: 'special', actor: actor.id, text: moved ? `${actor.name} blinks to the ${actor.position.row} row, quickened by the void.` : `${actor.name} blinks in place, ready to strike.` });
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
    inscribe(actor, skillDef, targets, events, ctx) {
      const rune = CharacterMechanics.inscribeRune(actor, ctx.chosenRune);
      events.push({ type: 'special', actor: actor.id, text: `${actor.name} inscribes the ${rune.toUpperCase()} Rune. (${actor.mech.runes.length}/3 active)` });
    },
    rune_fusion(actor, skillDef, targets, events, ctx) {
      const target = targets[0];
      const result = CharacterMechanics.runeFusionResult(actor);
      if (!result) return; // fewer than 2 runes - the base damage from the 'damage' branch still lands
      // Consume the two most recent runes that produced this fusion.
      actor.mech.runes.splice(-2, 2);
      events.push({ type: 'special', actor: actor.id, text: `${actor.name} fuses her Runes into a ${result} effect!` });
      if (target && !target.isDead) {
        if (result === 'Burst') {
          const { amount, isCrit } = CombatEngine.calculateDamage(actor, target, 0.7, {});
          const dealt = CombatEngine.applyDamage(actor, target, amount);
          events.push({ type: 'damage', actor: actor.id, target: target.id, amount: dealt, isCrit, text: `Burst detonates on ${target.name} for ${dealt} extra damage!` });
          if (target.isDead) { events.push({ type: 'death', actor: target.id, text: `${target.name} has fallen!` }); CharacterMechanics.registerDeath(target, ctx.allActors); }
        } else if (result === 'Rapid') {
          const { amount, isCrit } = CombatEngine.calculateDamage(actor, target, 0.55, {});
          const dealt = CombatEngine.applyDamage(actor, target, amount);
          events.push({ type: 'damage', actor: actor.id, target: target.id, amount: dealt, isCrit, text: `A second Rapid bolt hits ${target.name} for ${dealt} more damage!` });
          if (target.isDead) { events.push({ type: 'death', actor: target.id, text: `${target.name} has fallen!` }); CharacterMechanics.registerDeath(target, ctx.allActors); }
        } else if (result === 'Barrier') {
          CombatEngine.applyShield(actor, Math.round(actor.maxHp * 0.16));
          events.push({ type: 'shield', actor: actor.id, target: actor.id, text: `${actor.name} raises a Barrier of Shield.` });
        } else if (result === 'Haste') {
          StatusEngine.apply(actor, 'speed_up', 2, actor.id);
          events.push({ type: 'buff', actor: actor.id, target: actor.id, text: `${actor.name} is hastened by the Wind.` });
        } else if (result === 'Fortress') {
          CombatEngine.applyShield(actor, Math.round(actor.maxHp * 0.26));
          events.push({ type: 'shield', actor: actor.id, target: actor.id, text: `${actor.name} becomes a Fortress of Shield.` });
        } else if (result === 'Mobility') {
          CharacterMechanics.reposition(actor, 'backward', ctx.allActors);
          events.push({ type: 'special', actor: actor.id, text: `${actor.name} repositions to the ${actor.position.row} row.` });
        }
      }
    },
    grand_rune(actor, skillDef, targets, events, ctx) {
      const runes = actor.mech.runes;
      const allies = ctx.allActors.filter(a => a.side === actor.side && !a.isDead);
      if (runes.includes('guard')) {
        allies.forEach(a => CombatEngine.applyShield(a, Math.round(a.maxHp * 0.18)));
        events.push({ type: 'shield', actor: actor.id, text: `${actor.name}'s Grand Rune shields the whole team!` });
      }
      if (runes.includes('wind')) {
        allies.forEach(a => StatusEngine.apply(a, 'speed_up', 3, actor.id));
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
      StatusEngine.apply(target, 'stun', 1, actor.id);
      events.push({ type: 'status', actor: actor.id, target: target.id, statusId: 'stun', text: `${target.name} is trampled and stunned!` });
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
      StatusEngine.apply(actor, 'attack_up', 2, actor.id);
      events.push({ type: 'buff', actor: actor.id, target: actor.id, text: `${actor.name} is emboldened, gaining Attack Up.` });
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
