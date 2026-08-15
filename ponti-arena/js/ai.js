/**
 * PONTI ARENA - AI System
 * AI uses the exact same stats, cooldowns and energy rules as the player.
 * No hidden bonuses to HP/attack/defense/speed at any difficulty - only the
 * *decision quality* changes between Easy / Normal / Hard / Extreme.
 */

const AISystem = {
  /** Developer-only: when true, Expert/Master decisions are logged with their score breakdown. */
  debugEnabled: false,

  /**
   * Decide an action for `actor`. Returns { skillDef, target } or null.
   * @param {object} context  optional: { timelinePreview } for turn-order-aware tiers.
   */
  decide(actor, allActors, difficulty, context) {
    const enemies = allActors.filter(a => a.side !== actor.side && !a.isDead);
    const allies = allActors.filter(a => a.side === actor.side && !a.isDead);
    if (enemies.length === 0) return null;

    const usable = this.usableActions(actor);
    if (usable.length === 0) return null;

    let decision;
    if (difficulty === 'easy') decision = this.decideEasy(actor, usable, enemies, allies, allActors);
    else if (difficulty === 'normal') decision = this.decideNormal(actor, usable, enemies, allies, allActors);
    else if (difficulty === 'hard') decision = this.decideHard(actor, usable, enemies, allies, allActors);
    else decision = this.decideScored(actor, usable, allActors, difficulty, context); // Expert / Master (#134-142)

    // Gladiator's Taunt: if this actor is Taunted and the taunter is a legal target for the chosen
    // skill, every difficulty tier is forced to consider them (matches how a player would reason
    // about it - Taunt is a mechanical pull, not a hidden AI-only rule).
    if (decision && decision.target && decision.skillDef) {
      const legal = TargetingEngine.getSelectableTargets(decision.skillDef, actor.side, allActors);
      decision.target = CharacterMechanics.applyTauntOverride(actor, decision.skillDef, legal, decision.target, allActors);
    }
    return decision;
  },

  usableActions(actor) {
    const c = actor.character;
    const list = [{ key: 'basicAttack', def: c.basicAttack }];
    if (actor.cooldowns.skill1 <= 0) list.push({ key: 'skill1', def: c.skill1 });
    if (actor.cooldowns.skill2 <= 0) list.push({ key: 'skill2', def: c.skill2 });
    if (actor.energy >= 100) list.push({ key: 'ultimate', def: c.ultimate });
    return list;
  },

  pickTargetFor(skillDef, enemies, allies, actor, allActors) {
    if (skillDef.targetType === 'single_ally' || skillDef.targetType === 'all_ally' || skillDef.targetType === 'self') {
      if (skillDef.type === 'heal' || skillDef.type === 'special') {
        const lowest = [...allies].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
        return lowest || actor;
      }
      return actor;
    }
    // Row-aware: only actors this skill is legally allowed to hit (respects Front->Middle->Back
    // priority for undirected attacks, or the explicit row for backline-piercing skills).
    const legal = TargetingEngine.getSelectableTargets(skillDef, actor.side, allActors || [...enemies, ...allies, actor]);
    const pool = legal.length > 0 ? legal : enemies;
    return [...pool].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
  },

  // EASY: mostly random, rarely uses skills optimally, but still respects legal targeting rows
  decideEasy(actor, usable, enemies, allies, allActors) {
    const pool = Math.random() < 0.7 ? usable.filter(u => u.key === 'basicAttack') : usable;
    const choice = pool[Math.floor(Math.random() * pool.length)] || usable[0];
    let target;
    if (choice.def.targetType.includes('enemy')) {
      const legal = TargetingEngine.getSelectableTargets(choice.def, actor.side, allActors);
      target = legal[Math.floor(Math.random() * legal.length)] || enemies[0];
    } else {
      target = this.pickTargetFor(choice.def, enemies, allies, actor, allActors);
    }
    return { skillDef: choice.def, actionKey: choice.key, target };
  },

  // NORMAL: understands role basics - healers heal, damage dealers attack lowest HP within legal targets
  decideNormal(actor, usable, enemies, allies, allActors) {
    if (actor.character.role === 'Support') {
      const hurtAlly = allies.find(a => a.hp / a.maxHp < 0.6);
      const healSkill = usable.find(u => u.def.type === 'heal');
      if (hurtAlly && healSkill) return { skillDef: healSkill.def, actionKey: healSkill.key, target: hurtAlly };
    }
    const best = this.bestDamageOption(usable);
    const target = this.pickTargetFor(best.def, enemies, allies, actor, allActors);
    return { skillDef: best.def, actionKey: best.key, target };
  },

  // HARD: reads status, exploits weakness/row, respects target priority (understands backline threats)
  decideHard(actor, usable, enemies, allies, allActors) {
    if (actor.character.role === 'Support') {
      const critical = allies.find(a => a.hp / a.maxHp < 0.35);
      const hurtAlly = allies.find(a => a.hp / a.maxHp < 0.65);
      const healSkill = usable.find(u => u.def.type === 'heal');
      const cleanseSkill = usable.find(u => u.def.cleanse);
      const debuffedAlly = allies.find(a => a.statuses.some(s => STATUS_DEFS[s.id].category === 'debuff'));
      if (critical && healSkill) return { skillDef: healSkill.def, actionKey: healSkill.key, target: critical };
      if (debuffedAlly && cleanseSkill) return { skillDef: cleanseSkill.def, actionKey: cleanseSkill.key, target: debuffedAlly };
      if (hurtAlly && healSkill) return { skillDef: healSkill.def, actionKey: healSkill.key, target: hurtAlly };
    }
    const best = this.bestDamageOption(usable);
    const legal = TargetingEngine.getSelectableTargets(best.def, actor.side, allActors);
    const pool = legal.length > 0 ? legal : enemies;
    // Execute low-HP priority targets within legal reach
    const executable = pool.find(e => e.hp / e.maxHp < 0.15);
    if (executable) return { skillDef: best.def, actionKey: best.key, target: executable };
    // Prioritize squishy high-value targets (Mage/Support/Ranged) if this skill can legally reach them
    const priority = [...pool].sort((a, b) => {
      const weight = e => (['Mage', 'Support', 'Ranged', 'Summoner'].includes(e.character.role) ? 0 : 1);
      return weight(a) - weight(b) || (a.hp / a.maxHp) - (b.hp / b.maxHp);
    })[0];
    return { skillDef: best.def, actionKey: best.key, target: priority };
  },

  // EXPERT / MASTER: full Action Scoring Pipeline (#134) - every legal (action, target) pair gets a
  // score from AIScoring, incorporating threat, kill confirmation, overkill avoidance, combo detection,
  // and role weighting. Master additionally uses turn-order lookahead (via `context.timelinePreview`)
  // and a simple risk check that can override an offensive pick with Defend when critically low HP.
  decideScored(actor, usable, allActors, difficulty, context) {
    const candidates = [];
    usable.forEach(u => {
      if (u.key === 'defend') {
        candidates.push({ ...u, chosenTarget: actor, result: AIScoring.scoreCandidate(actor, 'defend', DEFEND_ACTION, null, allActors, context) });
        return;
      }
      const skillDef = u.def;
      const needsExplicitTarget = ['single_enemy', 'single_front', 'single_middle', 'single_back', 'any_enemy', 'single_ally', 'adjacent_enemies'].includes(skillDef.targetType);
      if (needsExplicitTarget) {
        const legal = TargetingEngine.getSelectableTargets(skillDef, actor.side, allActors);
        legal.forEach(t => candidates.push({ ...u, chosenTarget: t, result: AIScoring.scoreCandidate(actor, u.key, skillDef, t, allActors, context) }));
      } else {
        // AoE / self / all_ally / row-wide types - target choice doesn't matter for resolution.
        candidates.push({ ...u, chosenTarget: actor, result: AIScoring.scoreCandidate(actor, u.key, skillDef, actor, allActors, context) });
      }
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.result.score - a.result.score);

    // Controlled randomness (#169): Master is nearly deterministic but never 100%; Expert a bit looser.
    const topPickChance = difficulty === 'master' ? 0.95 : 0.90;
    let chosen = candidates[0];
    if (candidates.length > 1 && Math.random() > topPickChance) chosen = candidates[1];

    if (difficulty === 'master') {
      chosen = this.applyMasterRiskCheck(actor, chosen, candidates);
    }

    if (this.debugEnabled) {
      const targetLabel = chosen.chosenTarget && chosen.chosenTarget !== actor ? chosen.chosenTarget.name : 'self/team';
      console.log(`[AI ${difficulty.toUpperCase()}] ${actor.name} -> ${chosen.key} on ${targetLabel} | score=${chosen.result.score.toFixed(1)} | ${chosen.result.reasons.join('; ')}`);
    }

    const finalTarget = (chosen.chosenTarget && chosen.chosenTarget !== actor) ? chosen.chosenTarget : (chosen.result.targets[0] || actor);
    return {
      skillDef: chosen.def, actionKey: chosen.key, target: finalTarget,
      debugReason: chosen.result.reasons.join('; '), debugScore: chosen.result.score,
    };
  },

  /** Risk Assessment (#143/#144/#167): at critically low HP with no kill secured, weigh Defend fairly. */
  applyMasterRiskCheck(actor, chosen, candidates) {
    const hpPct = actor.hp / actor.maxHp;
    if (hpPct < 0.25 && (!chosen.result.killCount || chosen.result.killCount === 0) && chosen.key !== 'defend') {
      const defendCandidate = candidates.find(c => c.key === 'defend');
      if (defendCandidate && defendCandidate.result.score > chosen.result.score * 0.6) {
        return defendCandidate;
      }
    }
    return chosen;
  },

  /** Picks a named formation template for the enemy team (see config.js AI_FORMATION_TEMPLATES). */
  chooseFormationStrategy(difficulty, playerFormation) {
    if (difficulty === 'easy') return 'balanced';
    if (difficulty === 'normal') return Math.random() < 0.5 ? 'balanced' : 'aggressive';
    if (difficulty === 'hard') return Math.random() < 0.5 ? 'aggressive' : 'ranged';
    // Expert / Master: analyze the player's own formation and try to counter it (#154/#155).
    if (playerFormation) {
      const backCount = playerFormation.filter(p => p.row === 'back').length;
      const frontCount = playerFormation.filter(p => p.row === 'front').length;
      if (backCount >= 3) return 'aggressive'; // player is backline-heavy -> rush them
      if (frontCount >= 3) return 'ranged';    // player is frontline-heavy -> poke from range
    }
    return Math.random() < 0.5 ? 'aggressive' : 'ranged';
  },

  // -------------------------------------------------------------- TEAM DRAFTING (Master AI) ----
  /**
   * A single character's overall combat power for team-drafting purposes - a rough, transparent
   * estimate any player could eyeball themselves from the stat block plus a bonus for mechanical
   * depth (sustain, execute, AoE ultimates, backline access). Not the same thing as in-battle
   * Threat Score (see ai-scoring.js), which reacts to live battle state instead of raw kit strength.
   */
  characterPowerScore(character) {
    const b = character.base;
    let score = b.attack * 0.45 + b.hp * 0.045 + (b.physicalDefense + b.magicalDefense) * 0.09 + b.speed * 0.22 + b.critRate * 0.6 + (b.critDmg - 150) * 0.15;
    // Mechanical depth bonuses - a rough proxy for how much extra value the kit brings.
    if (character.ultimate && ['all_enemy', 'adjacent_enemies', 'front_row', 'middle_row', 'back_row'].includes(character.ultimate.targetType)) score += 18; // AoE ultimate
    if (character.backlineBonus || ['single_back', 'back_row'].includes((character.skill1 || {}).targetType) || ['single_back', 'back_row'].includes((character.skill2 || {}).targetType)) score += 12; // backline access
    if (character.lifestealPercent || (character.skill1 && character.skill1.drainPercent) || (character.skill2 && character.skill2.drainPercent)) score += 10; // built-in sustain
    if (character.rowSynergy) score += 6; // extra positional payoff
    if (character.base && character.base.evasion >= 12) score += 6;
    return score;
  },

  /** Buckets a role into a coarse archetype used only for team-draft coverage, not gameplay. */
  draftArchetype(role) {
    if (['Tank', 'Bruiser'].includes(role)) return 'frontline';
    if (['Support'].includes(role)) return 'sustain';
    return 'damage';
  },

  /**
   * Master AI drafts the strongest available 5-character team from `pool` (character ids), rather
   * than picking randomly: guarantees at least one frontline and one sustain/support pick, then
   * fills the remaining slots with the highest power-scoring characters left, so the team is both
   * individually strong and not an all-glass-cannon or all-tank lineup. Never picks a character
   * outside `pool` (already-used ids are expected to be filtered out by the caller).
   */
  draftPowerfulTeam(pool) {
    const candidates = pool.map(id => getCharacterById(id)).filter(Boolean)
      .map(c => ({ character: c, power: this.characterPowerScore(c), archetype: this.draftArchetype(c.role) }))
      .sort((a, b) => b.power - a.power);

    const picked = [];
    const takeBest = (predicate) => {
      const idx = candidates.findIndex(c => predicate(c) && !picked.includes(c));
      if (idx !== -1) { picked.push(candidates[idx]); return true; }
      return false;
    };

    takeBest(c => c.archetype === 'frontline'); // guarantee a tank/bruiser anchor
    takeBest(c => c.archetype === 'sustain');    // guarantee a support/healer

    // Fill the remaining slots with the highest raw power available, regardless of archetype -
    // this is what makes it "the most powerful combination" rather than just a balanced one.
    for (const c of candidates) {
      if (picked.length >= 5) break;
      if (!picked.includes(c)) picked.push(c);
    }

    return picked.slice(0, 5).map(c => c.character.id);
  },

  bestDamageOption(usable) {
    const ult = usable.find(u => u.key === 'ultimate');
    if (ult && ult.def.type !== 'buff') return ult;
    const skills = usable.filter(u => u.key !== 'basicAttack' && u.def.type !== 'heal' && u.def.type !== 'special');
    if (skills.length > 0) {
      return skills.sort((a, b) => (b.def.power || 0) - (a.def.power || 0))[0];
    }
    return usable.find(u => u.key === 'basicAttack') || usable[0];
  },
};
