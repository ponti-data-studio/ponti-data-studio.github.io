/**
 * PONTI ARENA - AI Scoring Pipeline (Expert / Master tiers)
 * Implements the "Action Scoring System" and "Target Threat System": every
 * legal (action, target) combination is scored using only information a
 * player could also see (character data, formation, battle state, status
 * effects, turn order preview) - see #132, AI must never read hidden state
 * or receive stat bonuses. Difficulty comes entirely from decision quality.
 */

const AIScoring = {
  /** How dangerous a potential target currently is - the "Target Threat System" (#136). */
  threatScore(target, context) {
    let score = 0;
    score += CombatEngine.liveStat(target, 'attack') * 0.08;
    score += CombatEngine.liveStat(target, 'speed') * 0.15;
    score += target.energy >= 100 ? 35 : target.energy * 0.15; // Ultimate ready = big threat
    const role = target.character.role;
    if (role === 'Support') score += 25;           // healers keep the enemy team alive
    if (['Mage', 'Ranged', 'Assassin'].includes(role)) score += 15; // burst/backline threats
    if (target.character.ultimate && target.character.ultimate.targetType === 'all_enemy') score += 10;
    // New-roster mechanic awareness (#17/#18): turn manipulation and totems are strategically dangerous
    // even when their raw stats look unassuming.
    if (target.character.id === 'chronomancer') score += 18; // turn-order manipulation is a priority target
    if (target.character.id === 'spirit_shaman' && target.mech && target.mech.activeTotem) score += 10;
    if (target.character.id === 'vampire') score += 8; // sustain threat compounds over a long fight
    if (target.character.id === 'gravity_mage') score += 6; // formation-breaker
    // Roster expansion 2 (31-40) mechanic awareness (#17/#18)
    if (target.character.id === 'engineer' && target.mech && target.mech.turret) score += 14; // active Turret is a real DPS threat
    if (target.character.id === 'demon_hunter') score += 8; // execute threat against low-HP allies
    if (target.character.id === 'void_walker') score += 10; // backline assassination threat
    if (target.character.id === 'gladiator' && target.mech && target.mech.rage >= 70) score += 10; // near Arena Champion
    if (target.character.id === 'frost_knight' && target.statuses.some(s => s.id === 'ice_stack' && s.stacks >= 4)) score += 6; // hard to crack soon
    if (target.character.id === 'plague_doctor') score += 8; // debuff/spread pressure compounds
    // Roster expansion 3 (41-50) mechanic awareness (#19/#20)
    if (target.character.id === 'dragon_knight' && target.mech && target.mech.dragonGauge >= 70) score += 14; // Dragon Form imminent
    if (target.character.id === 'shadow_priest') score += 10; // sacrifice-fueled team buffs are dangerous
    if (target.character.id === 'sniper' && StatusEngine.has(target, 'aim_stance')) score += 12; // about to fire a huge shot
    if (target.character.id === 'berserker_lord' && target.mech && target.mech.rage >= 70) score += 10;
    if (target.character.id === 'rune_master' && target.mech && target.mech.runes.length >= 2) score += 8; // combo ready
    if (target.character.id === 'witch') score += 6; // compounding debuffs
    if (target.character.id === 'soul_reaper' && target.mech && target.mech.soul >= 3) score += 12; // snowballing hard

    // Turn-order lookahead (#140/#141): about to act soon with a near-ready Ultimate = spike priority.
    if (context && context.timelinePreview) {
      const idx = context.timelinePreview.findIndex(t => t.id === target.id);
      if (idx !== -1 && idx <= 2 && target.energy >= 70) score += 20;
    }
    return score;
  },

  roleWeights(actor) {
    const role = actor.character.role;
    return {
      killWeight: role === 'Assassin' ? 1.4 : 1.0,
      threatWeight: role === 'Assassin' ? 1.3 : 1.0,
      survivalWeight: role === 'Support' ? 1.6 : (role === 'Tank' ? 1.3 : 1.0),
      aoeWeight: role === 'Mage' ? 1.3 : 1.0,
      protectionWeight: role === 'Tank' ? 1.4 : 1.0,
    };
  },

  /** Resolves the actual hit-list for a candidate without mutating any battle state. */
  hitListFor(actor, skillDef, chosenTarget, allActors) {
    return SkillSystem.resolveTargets(actor, skillDef, chosenTarget, allActors);
  },

  scoreCandidate(actor, actionKey, skillDef, chosenTarget, allActors, context) {
    const weights = this.roleWeights(actor);
    const reasons = [];

    if (actionKey === 'defend') {
      const hpPct = actor.hp / actor.maxHp;
      const survivalBonus = (1 - hpPct) * 40 * weights.survivalWeight;
      reasons.push(`survival ${survivalBonus.toFixed(0)}`);
      return { score: survivalBonus + 5, reasons, targets: [actor], killCount: 0 };
    }

    if (skillDef.type === 'heal') {
      const targets = this.hitListFor(actor, skillDef, chosenTarget, allActors);
      let healScore = 0;
      targets.forEach(t => {
        const missingPct = 1 - t.hp / t.maxHp;
        const healAmt = CombatEngine.liveStat(actor, 'attack') * skillDef.power;
        const overheal = Math.max(0, healAmt - (t.maxHp - t.hp));
        const efficiency = Math.max(0.1, 1 - overheal / Math.max(1, healAmt)); // avoid overheal waste (#146)
        let value = missingPct * 60 * efficiency;
        if (t.character.role === 'Support') value *= 1.2; // the only healer is precious (#145)
        if (t.energy >= 80) value *= 1.15; // protect someone about to Ultimate
        healScore += value;
      });
      reasons.push(`heal value ${healScore.toFixed(0)}`);
      return { score: healScore * weights.survivalWeight, reasons, targets, killCount: 0 };
    }

    if (skillDef.type === 'shield') {
      const targets = this.hitListFor(actor, skillDef, chosenTarget, allActors);
      const val = targets.length * 18 * weights.protectionWeight;
      reasons.push(`shield utility ${val.toFixed(0)}`);
      return { score: val, reasons, targets, killCount: 0 };
    }

    if (skillDef.type === 'buff') {
      const targets = this.hitListFor(actor, skillDef, chosenTarget, allActors);
      const val = 14 * targets.length;
      reasons.push(`buff utility ${val.toFixed(0)}`);
      return { score: val, reasons, targets, killCount: 0 };
    }

    if (skillDef.type === 'special') {
      const targets = this.hitListFor(actor, skillDef, chosenTarget, allActors);
      let val = 0;
      targets.forEach(t => {
        const hasDebuff = t.statuses.some(s => STATUS_DEFS[s.id].category === 'debuff');
        val += hasDebuff ? 30 : 2; // don't Purify when there's nothing to cleanse (#150)
      });
      reasons.push(`cleanse value ${val.toFixed(0)}`);
      return { score: val, reasons, targets, killCount: 0 };
    }

    // Damage-shaped actions (damage / debuff-with-damage)
    const targets = this.hitListFor(actor, skillDef, chosenTarget, allActors);
    if (targets.length === 0) return { score: -9999, reasons: ['no legal target'], targets: [], killCount: 0 };

    let dmgScore = 0, killBonus = 0, overkillPenalty = 0, comboBonus = 0, threatSum = 0, killCount = 0;
    const bypassProtection = TargetingEngine.bypassesProtection(skillDef.targetType);
    targets.forEach(t => {
      const est = CombatEngine.calculateDamage(actor, t, skillDef.power, {
        estimate: true, bypassProtection, isSkill: actionKey !== 'basicAttack',
        fallenCount: allActors.filter(a => a.isDead).length,
      });
      const expected = est.amount;
      dmgScore += expected;
      if (expected >= t.hp) { killBonus += 55 * weights.killWeight; killCount++; } // Kill Confirmation (#138)
      if (expected > t.hp) overkillPenalty += (expected - t.hp) * 0.15;            // Overkill Avoidance (#139)
      const hasCC = t.statuses.some(s => ['stun', 'freeze', 'root'].includes(s.id));
      if (hasCC) comboBonus += expected * 0.15;                                    // simple Combo Detection (#152)
      // Mirror Knight's reflection makes big direct hits punish the attacker - Expert/Master AI
      // should lean toward alternatives (DoT/debuffs) rather than dumping a huge attack into it.
      if (t.character.id === 'mirror_knight' && (StatusEngine.has(t, 'mirror_boost') || t.character.reflectPercent)) {
        overkillPenalty += expected * 0.12;
      }
      threatSum += this.threatScore(t, context) * weights.threatWeight;
    });

    let score = dmgScore * 0.5 + killBonus + comboBonus - overkillPenalty + threatSum * 0.4;
    if (targets.length > 1) score *= weights.aoeWeight; // Mage AoE efficiency bonus (#149)

    if (actionKey === 'ultimate') {
      const primaryMax = targets[0] ? targets[0].maxHp : 0;
      if (killCount === 0 && targets.length <= 1 && dmgScore < primaryMax * 0.3) {
        score -= 45; // don't burn a marginal Ultimate (#151, #163)
        reasons.push('ultimate looks wasteful - penalized');
      } else if (killCount > 0 || targets.length >= 2) {
        score += 20 + killCount * 15;
        reasons.push('ultimate secures a kill / hits multiple - bonus');
      }
    }

    reasons.push(`dmg=${dmgScore.toFixed(0)} kills=${killCount} threat=${threatSum.toFixed(0)} overkill=${overkillPenalty.toFixed(0)}`);
    return { score, reasons, targets, killCount };
  },
};
