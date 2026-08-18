/**
 * PONTI ARENA - Battle Engine
 * The single source of truth for an in-progress battle. Framework/DOM-free
 * so it can later be driven by a network layer without rewrites (see
 * "Future Multiplayer Ready" - battle logic never touches the DOM).
 *
 * UI drives it via:
 *   const battle = new BattleEngine(playerIds, enemyIds, difficulty, arenaId);
 *   battle.beginTurn()                 -> { actor, skipped, events }
 *   battle.getUsableActions(actorId)   -> [{ key, def, ready }]
 *   battle.submitPlayerAction(key, targetId) -> { events, result }
 *   battle.runEnemyTurn()              -> { events, result }
 *   battle.getTimelinePreview(n)
 */

class BattleEngine {
  /**
   * @param {(string[]|{id,row,column}[])} playerFormation  Either a plain array of character ids
   *   (auto-arranged into a default formation) or an explicit array of {id, row, column} placements
   *   as produced by the Formation screen / TargetingEngine.buildAutoFormation / buildFormationFromTemplate.
   * @param {(string[]|{id,row,column}[])} enemyFormation    Same shape, for the enemy side.
   */
  constructor(playerFormation, enemyFormation, difficulty = 'normal', arenaId = 'medieval-castle') {
    this.difficulty = difficulty;
    this.arenaId = arenaId;
    this.log = [];
    this.stats = { damageDealt: 0, damageReceived: 0, healing: 0, criticals: 0, skillsUsed: 0, turns: 0 };
    this._lastFatigueTurn = 0;
    this.globalFreeze = null; // Chronomancer's Freezing Time: { side, turnsRemaining }
    this.status = 'active'; // active | victory | defeat
    const playerPlacements = this._normalizeFormation(playerFormation);
    const enemyPlacements = this._normalizeFormation(enemyFormation);
    this.actors = [
      ...playerPlacements.map((p, i) => this._createActor(p.id, 'player', i, p)),
      ...enemyPlacements.map((p, i) => this._createActor(p.id, 'enemy', i, p)),
    ];
    this.turnManager = new TurnManager(this.actors);
    this.currentActor = null;
    this.actionQueueBusy = false;
  }

  /** Accepts either plain id arrays (auto-arranged) or explicit {id,row,column} placement arrays. */
  _normalizeFormation(formation) {
    if (!formation || formation.length === 0) return [];
    if (typeof formation[0] === 'string') {
      return TargetingEngine.buildAutoFormation(formation);
    }
    return formation;
  }

  _createActor(characterId, side, index, placement) {
    const character = getCharacterById(characterId) || (characterId === TRAINING_DUMMY.id ? TRAINING_DUMMY : null);
    if (!character) throw new Error(`Unknown character id: ${characterId}`);
    const maxHp = character.base.hp;
    const actor = {
      id: `${side}-${character.id}-${index}`,
      name: character.name,
      character,
      side,
      position: { row: (placement && placement.row) || 'middle', column: (placement && placement.column) || 0 },
      stats: {
        attack: character.base.attack,
        physicalDefense: character.base.physicalDefense,
        magicalDefense: character.base.magicalDefense,
        speed: character.base.speed,
        critRate: character.base.critRate,
        critDamage: character.base.critDmg,
        evasion: character.base.evasion || 0,
      },
      hp: maxHp,
      maxHp,
      energy: 0,
      isDead: false,
      defending: false,
      statuses: [],
      cooldowns: { skill1: 0, skill2: 0 },
      firstCastUsed: { skill1: false, skill2: false }, // Machinist passive
      arcaneStacks: 0,
      staticCharge: 0,
      usedFirstShot: false,
      readiness: 0,
    };
    CharacterMechanics.initActorState(actor);
    return actor;
  }

  getActor(id) { return this.actors.find(a => a.id === id); }
  livingPlayer() { return this.actors.filter(a => a.side === 'player' && !a.isDead); }
  livingEnemy() { return this.actors.filter(a => a.side === 'enemy' && !a.isDead); }
  fallenCount() { return this.actors.filter(a => a.isDead && !a.isSummon).length; }

  /**
   * Creates a lightweight, REAL, targetable summon actor (Necromancer's Skeleton, Beastmaster's
   * Beast) - unlike the Turret/Totem's purely-visual representation, these join `this.actors`
   * directly so they're automatically valid targets for both sides through the exact same
   * targeting/combat/death code every character already uses. They never take an independent
   * turn (see TurnManager.livingActors) and never count toward victory/defeat on their own (see
   * TurnManager.checkVictoryDefeat) - they only act when their owner's skill explicitly triggers
   * them (see e.g. CharacterMechanics for Skeleton Attack / Command Beast).
   */
  createSummon(owner, { name, icon, color, hp, attack, attackType }, forcedSlot) {
    const slot = forcedSlot || CharacterMechanics.findSummonSlot(owner, this.actors);
    if (!slot) return null; // battlefield is completely full (12/12) - no room to summon
    this._summonSeq = (this._summonSeq || 0) + 1;
    const fakeCharacter = {
      id: `summon-${owner.id}-${this._summonSeq}`, name, icon, color: color || '#8a8a8a',
      role: 'Summon', attackType: attackType || 'physical',
      base: { hp, attack, physicalDefense: 15, magicalDefense: 15, speed: 0, critRate: 0, critDmg: 150, evasion: 0 },
    };
    const actor = {
      id: fakeCharacter.id, name, character: fakeCharacter, side: owner.side,
      position: { row: slot.row, column: slot.column },
      stats: { attack, physicalDefense: 15, magicalDefense: 15, speed: 0, critRate: 0, critDamage: 150, evasion: 0 },
      hp, maxHp: hp, energy: 0, isDead: false, defending: false, statuses: [],
      cooldowns: { skill1: 0, skill2: 0 }, firstCastUsed: { skill1: false, skill2: false },
      arcaneStacks: 0, staticCharge: 0, usedFirstShot: false, readiness: 0,
      isSummon: true, ownerId: owner.id,
    };
    CharacterMechanics.initActorState(actor);
    this.actors.push(actor);
    return actor;
  }

  /** Every summon currently owned by `owner` and still alive. */
  livingSummonsOf(ownerId) {
    return this.actors.filter(a => a.isSummon && a.ownerId === ownerId && !a.isDead);
  }

  _pushLog(text) { this.log.push({ turn: this.stats.turns, text }); }

  /** Escalating fatigue damage once a battle has run unusually long - guarantees resolution
   *  without ever feeling like a sudden, unfair wipe (grows slowly, applies to everyone equally).
   *  Called at most once every ~10 individual turns (roughly one full round), never per-actor. */
  _applySuddenDeath() {
    const events = [];
    const roundsOvertime = Math.floor((this.stats.turns - 120) / 10);
    const percent = Math.min(15, 2 + roundsOvertime * 2); // 2% climbing to a 15% cap per round
    if (roundsOvertime <= 1) {
      const t = 'The battle drags on... both sides start taking Fatigue damage each round.';
      this._pushLog(t); events.push({ type: 'special', text: t });
    }
    this.actors.forEach((a) => {
      if (a.isDead) return;
      const amount = Math.max(1, Math.round(a.maxHp * (percent / 100)));
      a.hp = Math.max(0, a.hp - amount);
      if (a.hp <= 0) {
        a.isDead = true;
        events.push({ type: 'death', actor: a.id, text: `${a.name} succumbs to Fatigue!` });
      }
    });
    return events;
  }

  lowestDefenseEnemyIdFor(actor) {
    const enemies = this.actors.filter(a => a.side !== actor.side && !a.isDead);
    if (enemies.length === 0) return null;
    // Relevant defense depends on the actor's own Attack Type - a magical attacker cares about
    // who has the lowest Magical Defense, not Physical.
    const defenseKey = actor.character.attackType === 'magical' ? 'magicalDefense' : 'physicalDefense';
    return [...enemies].sort((a, b) => CombatEngine.liveStat(a, defenseKey) - CombatEngine.liveStat(b, defenseKey))[0].id;
  }

  /** Advances the timeline to the next actor and resolves start-of-turn effects. */
  beginTurn() {
    const winCheck = this.turnManager.checkVictoryDefeat();
    if (winCheck) { this.status = winCheck; return { actor: null, skipped: false, events: [], result: winCheck }; }

    const actor = this.turnManager.getNextActor();
    if (!actor) return { actor: null, skipped: false, events: [], result: null };
    this.currentActor = actor;
    this.stats.turns += 1;
    actor.defending = false;

    if (actor.cooldowns.skill1 > 0) actor.cooldowns.skill1 -= 1;
    if (actor.cooldowns.skill2 > 0) actor.cooldowns.skill2 -= 1;

    const mechEvents = CharacterMechanics.onTurnStart(actor, this.actors);

    const events = [];
    if (mechEvents && mechEvents.length) {
      mechEvents.forEach(e => { this._pushLog(e.text); events.push(e); });
      // A Turret shot may have just killed its target - re-check victory/defeat before proceeding.
      const midCheck = this.turnManager.checkVictoryDefeat();
      if (midCheck) { this.status = midCheck; return { actor, skipped: false, events, result: midCheck }; }
    }

    // Sudden Death: two very defensive/sustain-heavy teams can occasionally out-heal each other
    // indefinitely. Past a generous turn count, apply gradually escalating fatigue damage to
    // every living actor (once per full round, not every individual turn) so every battle is
    // guaranteed to resolve - never a true stalemate/softlock.
    if (this.stats.turns > 120 && this.stats.turns - this._lastFatigueTurn >= 10) {
      this._lastFatigueTurn = this.stats.turns;
      const fatigueEvents = this._applySuddenDeath();
      fatigueEvents.forEach(e => { this._pushLog(e.text); events.push(e); });
      const fatigueCheck = this.turnManager.checkVictoryDefeat();
      if (fatigueCheck) { this.status = fatigueCheck; return { actor, skipped: false, events, result: fatigueCheck }; }
    }

    const dotEvents = StatusEngine.tickStartOfTurn(actor);
    dotEvents.forEach(e => { this._pushLog(e.text); events.push(e); });

    // Cleric passive: small team regeneration at start of each ally turn
    if (actor.side === 'player') {
      const cleric = this.actors.find(a => a.character.id === 'cleric' && a.side === actor.side && !a.isDead);
      if (cleric && !actor.isDead && actor.id !== cleric.id) {
        const amt = Math.round(actor.maxHp * 0.02);
        const healed = CombatEngine.applyHeal(cleric, actor, amt);
        if (healed > 0) { const t = `${actor.name} regenerates ${healed} HP from Holy Aura.`; this._pushLog(t); events.push({ type: 'hot', text: t }); }
      }
    }

    const winCheck2 = this.turnManager.checkVictoryDefeat();
    if (winCheck2) { this.status = winCheck2; return { actor, skipped: false, events, result: winCheck2 }; }

    if (actor.isDead) {
      return this.beginTurn(); // this actor died to DoT before acting; move on
    }

    // Chronomancer's Freezing Time: counts down once per INDIVIDUAL turn (ally or enemy alike),
    // not per status-holder's own turn like a normal CC - see #1 in the skill revision spec.
    if (this.globalFreeze && this.globalFreeze.turnsRemaining > 0) {
      const frozenNow = actor.side === this.globalFreeze.side;
      this.globalFreeze.turnsRemaining -= 1;
      if (this.globalFreeze.turnsRemaining <= 0) this.globalFreeze = null;
      if (frozenNow) {
        const t = `${actor.name} is frozen in time and cannot act!`;
        this._pushLog(t); events.push({ type: 'skip', text: t });
        StatusEngine.tickEndOfTurn(actor);
        return { actor, skipped: true, events, result: null };
      }
    }

    if (StatusEngine.shouldSkipTurn(actor)) {
      const t = `${actor.name} cannot act this turn.`;
      this._pushLog(t); events.push({ type: 'skip', text: t });
      StatusEngine.tickEndOfTurn(actor);
      return { actor, skipped: true, events, result: null };
    }

    return { actor, skipped: false, events, result: null };
  }

  getUsableActions(actorId) {
    const actor = this.getActor(actorId);
    if (!actor) return [];
    const c = actor.character;
    // Alchemist's Skill 1/2 have no cooldown - they're gated purely by her bottle rack instead.
    const alchemistGate = (key) => c.id !== 'alchemist' ? true : actor.mech.bottles >= 3;
    // Engineer's War Machine targets a Turret she's already deployed - no point offering it
    // (and wasting 100 Energy) if there's nothing there to upgrade.
    const ultimateReady = actor.energy >= 100 && (c.ultimate.id !== 'war_machine' || !!actor.mech.turretId);
    return [
      { key: 'basicAttack', def: c.basicAttack, ready: true },
      { key: 'skill1', def: c.skill1, ready: actor.cooldowns.skill1 <= 0 && alchemistGate('skill1') },
      { key: 'skill2', def: c.skill2, ready: actor.cooldowns.skill2 <= 0 && alchemistGate('skill2') },
      { key: 'ultimate', def: c.ultimate, ready: ultimateReady },
      { key: 'defend', def: DEFEND_ACTION, ready: true },
    ];
  }

  /** Resolve a chosen action for the current actor (player or programmatically for AI). */
  _resolveAction(actor, actionKey, targetId) {
    const events = [];

    // Special targetId encodings for interactive skills:
    //  - "slot:row:column" (Engineer/Necromancer/Beastmaster placing a new summon)
    //  - "actualTargetId|amount" (Shadow Priest's player-chosen HP-sacrifice amount)
    let chosenSlot = null;
    let sacrificeAmount = null;
    let chosenRune = null;
    if (typeof targetId === 'string' && targetId.startsWith('slot:')) {
      const [, row, column] = targetId.split(':');
      chosenSlot = { row, column: parseInt(column, 10) };
      targetId = null;
    } else if (typeof targetId === 'string' && targetId.startsWith('rune:')) {
      chosenRune = targetId.split(':')[1];
      targetId = null;
    } else if (typeof targetId === 'string' && targetId.includes('|')) {
      const [realId, amt] = targetId.split('|');
      targetId = realId;
      sacrificeAmount = parseInt(amt, 10);
    }
    const target = targetId ? this.getActor(targetId) : null;

    if (actionKey === 'defend') {
      actor.defending = true;
      CombatEngine.gainEnergy(actor, DEFEND_ACTION.energyGain);
      const t = `${actor.name} takes a defensive stance.`;
      this._pushLog(t); events.push({ type: 'defend', actor: actor.id, text: t });
      StatusEngine.tickEndOfTurn(actor);
      return events;
    }

    const skillDef = actor.character[actionKey];
    if (!skillDef) return events;

    if (actionKey === 'ultimate' && actor.energy < 100) return events; // guard: cannot use, not enough energy
    if ((actionKey === 'skill1' || actionKey === 'skill2') && actor.cooldowns[actionKey] > 0) return events;

    const ctx = {
      allActors: this.actors,
      fallenCount: this.fallenCount(),
      lowestDefenseId: this.lowestDefenseEnemyIdFor(actor),
      battle: this,
      chosenSlot,
      sacrificeAmount,
      chosenRune,
    };
    const result = SkillSystem.resolve(actor, skillDef, target, ctx);
    result.forEach(e => {
      events.push(e);
      this._pushLog(e.text);
      if (e.type === 'damage') { this.stats.damageDealt += e.amount; if (actor.side === 'enemy') this.stats.damageReceived += e.amount; if (e.isCrit) this.stats.criticals += 1; }
      if (e.type === 'heal') this.stats.healing += e.amount;
    });

    if (actionKey !== 'basicAttack') this.stats.skillsUsed += 1;

    // Energy handling
    if (actionKey === 'ultimate') {
      CombatEngine.spendEnergy(actor, 100);
    } else {
      const gain = skillDef.energyGain || 10;
      CombatEngine.gainEnergy(actor, gain);
    }

    // Machinist passive: first use of a skill this battle costs no cooldown
    if ((actionKey === 'skill1' || actionKey === 'skill2')) {
      let cd = skillDef.cooldown || 0;
      if (actor.character.id === 'machinist' && !actor.firstCastUsed[actionKey]) {
        cd = 0;
        actor.firstCastUsed[actionKey] = true;
      }
      actor.cooldowns[actionKey] = cd;
    }

    StatusEngine.tickEndOfTurn(actor);
    return events;
  }

  _resolveItem(actor, itemId, events) {
    // Items were removed from the game (replaced by the Passive info button in the action menu) -
    // this stub only remains so any stray legacy call is a safe no-op rather than a crash.
    return events;
  }

  submitPlayerAction(actionKey, targetId) {
    if (!this.currentActor || this.currentActor.side !== 'player') return { events: [], result: null };
    const events = this._resolveAction(this.currentActor, actionKey, targetId);
    const result = this.turnManager.checkVictoryDefeat();
    if (result) this.status = result;
    return { events, result };
  }

  runEnemyTurn() {
    const actor = this.currentActor;
    if (!actor || actor.side !== 'enemy') return { events: [], result: null };
    const context = { timelinePreview: this.getTimelinePreview(6) };
    const decision = AISystem.decide(actor, this.actors, this.difficulty, context);
    if (!decision) {
      const events = this._resolveAction(actor, 'defend', null);
      const result = this.turnManager.checkVictoryDefeat();
      if (result) this.status = result;
      return { events, result };
    }
    const debugEvents = [];
    if (AISystem.debugEnabled && decision.debugReason) {
      const t = `[AI] ${actor.name}: ${decision.actionKey} -> ${decision.target ? decision.target.name : 'team'} (score ${decision.debugScore.toFixed(1)}: ${decision.debugReason})`;
      this._pushLog(t);
      debugEvents.push({ type: 'ai-debug', text: t });
    }

    // Confusion (Illusionist): may swap in a different, still-legal target at the last moment.
    if (decision.target && StatusEngine.has(actor, 'confusion')) {
      const legalTargets = TargetingEngine.getSelectableTargets(decision.skillDef, actor.side, this.actors);
      const swapped = CharacterMechanics.maybeConfuseTarget(actor, legalTargets, decision.target);
      if (swapped.id !== decision.target.id) {
        this._pushLog(`${actor.name} is Confused and targets ${swapped.name} instead!`);
        debugEvents.push({ type: 'status', text: `${actor.name} is Confused and targets ${swapped.name} instead!` });
        decision.target = swapped;
      }
    }

    const events = this._resolveAction(actor, decision.actionKey, decision.target ? decision.target.id : null);
    const result = this.turnManager.checkVictoryDefeat();
    if (result) this.status = result;
    return { events: [...debugEvents, ...events], result };
  }

  getTimelinePreview(n = 6) { return this.turnManager.previewTimeline(n); }
}
