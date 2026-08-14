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

const ITEM_DEFS = {
  small_potion:  { id: 'small_potion', name: 'Small Potion', desc: 'Restores 25% max HP.', healPercent: 25 },
  large_potion:  { id: 'large_potion', name: 'Large Potion', desc: 'Restores 55% max HP.', healPercent: 55 },
  energy_potion: { id: 'energy_potion', name: 'Energy Potion', desc: 'Restores 40 Energy.', energy: 40 },
  antidote:      { id: 'antidote', name: 'Antidote', desc: 'Removes all debuffs.', cleanse: true },
};
const ITEM_USES_PER_BATTLE = 3; // shared pool per team, prevents item spam

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
    this.itemsRemaining = ITEM_USES_PER_BATTLE;
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
        defense: character.base.defense,
        speed: character.base.speed,
        critRate: character.base.critRate,
        critDamage: character.base.critDmg,
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
  fallenCount() { return this.actors.filter(a => a.isDead).length; }

  _pushLog(text) { this.log.push({ turn: this.stats.turns, text }); }

  lowestDefenseEnemyIdFor(actor) {
    const enemies = this.actors.filter(a => a.side !== actor.side && !a.isDead);
    if (enemies.length === 0) return null;
    return [...enemies].sort((a, b) => CombatEngine.liveStat(a, 'defense') - CombatEngine.liveStat(b, 'defense'))[0].id;
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

    CharacterMechanics.onTurnStart(actor, this.actors);

    const events = [];
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
    return [
      { key: 'basicAttack', def: c.basicAttack, ready: true },
      { key: 'skill1', def: c.skill1, ready: actor.cooldowns.skill1 <= 0 },
      { key: 'skill2', def: c.skill2, ready: actor.cooldowns.skill2 <= 0 },
      { key: 'ultimate', def: c.ultimate, ready: actor.energy >= 100 },
      { key: 'defend', def: DEFEND_ACTION, ready: true },
    ];
  }

  /** Resolve a chosen action for the current actor (player or programmatically for AI). */
  _resolveAction(actor, actionKey, targetId) {
    const events = [];
    const target = targetId ? this.getActor(targetId) : null;

    if (actionKey === 'defend') {
      actor.defending = true;
      CombatEngine.gainEnergy(actor, DEFEND_ACTION.energyGain);
      const t = `${actor.name} takes a defensive stance.`;
      this._pushLog(t); events.push({ type: 'defend', actor: actor.id, text: t });
      StatusEngine.tickEndOfTurn(actor);
      return events;
    }

    if (actionKey === 'item') {
      return this._resolveItem(actor, targetId, events);
    }

    const skillDef = actor.character[actionKey];
    if (!skillDef) return events;

    if (actionKey === 'ultimate' && actor.energy < 100) return events; // guard: cannot use, not enough energy
    if ((actionKey === 'skill1' || actionKey === 'skill2') && actor.cooldowns[actionKey] > 0) return events;

    const ctx = {
      allActors: this.actors,
      fallenCount: this.fallenCount(),
      lowestDefenseId: this.lowestDefenseEnemyIdFor(actor),
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
    const item = ITEM_DEFS[itemId];
    if (!item || this.itemsRemaining <= 0) return events;
    this.itemsRemaining -= 1;
    if (item.healPercent) {
      const amt = Math.round(actor.maxHp * (item.healPercent / 100));
      const healed = CombatEngine.applyHeal(actor, actor, amt);
      const t = `${actor.name} uses ${item.name}, healing ${healed} HP.`;
      this._pushLog(t); events.push({ type: 'heal', actor: actor.id, target: actor.id, amount: healed, text: t });
      this.stats.healing += healed;
    }
    if (item.energy) {
      CombatEngine.gainEnergy(actor, item.energy);
      const t = `${actor.name} uses ${item.name}, restoring ${item.energy} Energy.`;
      this._pushLog(t); events.push({ type: 'energy', actor: actor.id, text: t });
    }
    if (item.cleanse) {
      StatusEngine.removeAllDebuffs(actor);
      const t = `${actor.name} uses ${item.name}, removing all debuffs.`;
      this._pushLog(t); events.push({ type: 'cleanse', actor: actor.id, text: t });
    }
    StatusEngine.tickEndOfTurn(actor);
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
