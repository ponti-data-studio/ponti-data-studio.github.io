/**
 * PONTI ARENA - Skill Resolution System
 * Data-driven: reads a skill definition (see characters.js) and resolves it
 * against the correct targets using CombatEngine + StatusEngine.
 * Returns a structured result array the Action Queue / UI can play back.
 */

const SkillSystem = {
  /**
   * @param {object} actor      the acting battle-actor
   * @param {object} skillDef   skill definition object (basicAttack/skill1/skill2/ultimate)
   * @param {object[]} allTargets  candidate targets already resolved by targetType (see below)
   * @param {object} ctx        { allActors, fallenCount }
   */
  resolve(actor, skillDef, chosenTarget, ctx) {
    const events = [];

    // Monk: Palm Burst costs 15 Ki for full power, or runs at reduced power without it.
    if (skillDef.id === 'palm_burst') {
      if (actor.mech.ki >= 15) {
        CharacterMechanics.spendKi(actor, 15);
      } else {
        skillDef = { ...skillDef, power: skillDef.power * 0.6 };
        events.push({ type: 'special', actor: actor.id, text: `${actor.name} doesn't have enough Ki - Palm Burst lands with less force.` });
      }
    }

    // Alchemist: every action spends bottles from her 10-bottle rack. Basic Attack still fires at
    // reduced power if she's empty-handed; Skill 1/2 are hard-gated (see getUsableActions in
    // battle.js, which greys the button out below 3 bottles) so this is a defensive fallback only.
    if (skillDef.id === 'alchemy_bolt') {
      if (CharacterMechanics.spendBottles(actor, 1)) {
        // full power
      } else {
        skillDef = { ...skillDef, power: skillDef.power * 0.55 };
        events.push({ type: 'special', actor: actor.id, text: `${actor.name} is out of bottles - the throw is weak.` });
      }
    }
    if (['healing_potion', 'explosive_strike'].includes(skillDef.id)) {
      if (!CharacterMechanics.spendBottles(actor, 3)) {
        events.push({ type: 'special', actor: actor.id, text: `${actor.name} doesn't have enough bottles (needs 3).` });
        return events;
      }
    }
    // Alchemist's Volatile Mixtures: bonus damage while flush with bottles.
    if (actor.character.id === 'alchemist' && actor.mech.bottles >= 7 && skillDef.type === 'damage') {
      skillDef = { ...skillDef, power: skillDef.power * 1.15 };
    }

    const targets = this.resolveTargets(actor, skillDef, chosenTarget, ctx.allActors);

    // Wizard passive: track consecutive skill casts for Arcane Mastery
    if (actor.character.id === 'wizard') {
      if (skillDef.type !== 'defend' && skillDef.id !== actor.character.basicAttack.id) {
        actor.arcaneStacks = Math.min(3, (actor.arcaneStacks || 0) + 1);
      } else {
        actor.arcaneStacks = 0;
      }
    }

    if (skillDef.type === 'damage') {
      for (const target of targets) {
        if (target.isDead) continue;
        const options = {
          isSkill: skillDef.id !== actor.character.basicAttack.id,
          fallenCount: ctx.fallenCount,
          bonusVsPoison: actor.character.id === 'ranger' && skillDef.id === actor.character.basicAttack.id,
          isLowestDefenseTarget: ctx.lowestDefenseId === target.id,
          guaranteedCrit: actor.character.id === 'gunslinger' && !actor.usedFirstShot && skillDef.id === actor.character.basicAttack.id,
          staticChargeBonus: actor.character.id === 'stormcaller' && (actor.staticCharge || 0) >= 3 && skillDef.id === actor.character.basicAttack.id,
          bypassProtection: TargetingEngine.bypassesProtection(skillDef.targetType),
          judgmentBonus: skillDef.id === 'judgment',
          finalCutBonus: skillDef.id === 'final_cut',
          executionBonus: skillDef.id === 'execution',
          alreadySlowedBonus: skillDef.id === 'absolute_zero_fk' && StatusEngine.has(target, 'slow'),
          skillId: skillDef.id,
          headshotBonus: skillDef.id === 'headshot',
          rageScaled: ['raging_swing', 'wrath_unleashed', 'blood_roar'].includes(skillDef.id),
          wrathArmorBreak: skillDef.id === 'wrath_unleashed',
          missingHpExecute: skillDef.id === 'reapers_cut',
          critChanceFloor: skillDef.id === 'dark_mass' ? 40 : undefined,
        };        if (options.guaranteedCrit) actor.usedFirstShot = true;
        const { amount, isCrit, evaded } = CombatEngine.calculateDamage(actor, target, skillDef.power, options);
        if (evaded) {
          events.push({ type: 'evade', actor: actor.id, target: target.id, text: `${target.name} evaded the attack!` });
          if (target.character.id === 'fencer') StatusEngine.apply(target, 'footwork', 3, target.id);
          continue;
        }

        // Illusionist's Decoy: fully blocks a hit instead of absorbing HP.
        if (StatusEngine.consumeWard(target)) {
          events.push({ type: 'ward', actor: actor.id, target: target.id, text: `${target.name}'s Decoy absorbs the hit completely!` });
          if (!StatusEngine.has(target, 'decoy_ward')) {
            CombatEngine.gainEnergy(target, 20);
            events.push({ type: 'energy', actor: target.id, text: `${target.name}'s Decoy shatters, refunding Energy.` });
          }
          continue;
        }

        // Paladin's Guardian's Oath: redirects a capped share of this hit to the Paladin first.
        const redirect = CharacterMechanics.interceptDamage(target, amount, ctx.allActors);
        if (redirect.redirectedTo) {
          events.push({ type: 'redirect', actor: redirect.redirectedTo.id, target: target.id, amount: redirect.redirectedAmount,
            text: `${redirect.redirectedTo.name} intercepts ${redirect.redirectedAmount} damage meant for ${target.name}!` });
          if (redirect.redirectedTo.isDead) { events.push({ type: 'death', actor: redirect.redirectedTo.id, text: `${redirect.redirectedTo.name} has fallen!` }); CharacterMechanics.registerDeath(redirect.redirectedTo, ctx.allActors); }
        }

        const dealt = CombatEngine.applyDamage(actor, target, redirect.amount);
        events.push({ type: 'damage', actor: actor.id, target: target.id, amount: dealt, isCrit,
          text: `${actor.name} used ${skillDef.name} on ${target.name} for ${dealt} damage${isCrit ? ' (CRITICAL!)' : ''}.` });

        // Stormcaller static charge tracking
        if (actor.character.id === 'stormcaller') {
          actor.staticCharge = ((actor.staticCharge || 0) + 1) % 3;
        }
        // Drain (life steal) skills
        if (skillDef.drainPercent) {
          const healed = CombatEngine.applyHeal(actor, actor, dealt * (skillDef.drainPercent / 100));
          if (healed > 0) events.push({ type: 'heal', actor: actor.id, target: actor.id, amount: healed, text: `${actor.name} drains ${healed} HP.` });
        }
        // Blood Knight / Warlock passive lifesteal
        if (actor.character.id === 'blood-knight' && skillDef.id === actor.character.basicAttack.id) {
          const healed = CombatEngine.applyHeal(actor, actor, dealt * 0.20);
          if (healed > 0) events.push({ type: 'heal', actor: actor.id, target: actor.id, amount: healed, text: `${actor.name} heals ${healed} HP from Bloodlust.` });
        }
        if (actor.character.id === 'warlock' && options.isSkill) {
          const healed = CombatEngine.applyHeal(actor, actor, dealt * 0.15);
          if (healed > 0) events.push({ type: 'heal', actor: actor.id, target: actor.id, amount: healed, text: `${actor.name} heals ${healed} HP from Dark Pact.` });
        }
        // Vampire's Blood Feast: generic capped lifesteal on every hit.
        if (actor.character.lifestealPercent) {
          const cap = actor.maxHp * ((actor.character.lifestealCapPercentMaxHp || 10) / 100);
          const healAmt = Math.min(dealt * (actor.character.lifestealPercent / 100), cap);
          const healed = CombatEngine.applyHeal(actor, actor, healAmt);
          if (healed > 0) events.push({ type: 'heal', actor: actor.id, target: actor.id, amount: healed, text: `${actor.name} feasts for ${healed} HP.` });
        }
        // Duelist's Challenger: track consecutive hits on the same rival.
        if (actor.character.id === 'duelist' && actor.mech) {
          CharacterMechanics.registerDuelHit(actor, target);
        }
        // Monk's Inner Ki: gained from landing any damaging action.
        if (actor.character.id === 'monk') CharacterMechanics.gainKi(actor, options.isSkill ? 15 : 10);
        // Gladiator's Crowd Favorite: gained from both dealing and taking damage.
        if (actor.character.id === 'gladiator') CharacterMechanics.gainRage(actor, 10);
        if (target.character.id === 'gladiator' && !target.isDead) CharacterMechanics.gainRage(target, 8);
        // Frost Knight's Ice Armor: gains a stacking Defense buff whenever he takes damage.
        if (target.character.id === 'frost_knight' && !target.isDead) StatusEngine.apply(target, 'ice_stack', 4, target.id);
        // Fencer's Footwork: gained on landing an attack (self-buff, not applied to the target).
        if (actor.character.id === 'fencer') StatusEngine.apply(actor, 'footwork', 3, actor.id);
        // Dragon Knight's Dragon Blood: gained from both dealing and taking damage.
        if (actor.character.id === 'dragon_knight') CharacterMechanics.gainDragonGauge(actor, 8);
        if (target.character.id === 'dragon_knight' && !target.isDead) CharacterMechanics.gainDragonGauge(target, 10);
        // Berserker Lord's Enrage: gained from both dealing and taking damage.
        if (actor.character.id === 'berserker_lord') CharacterMechanics.gainRage(actor, 8);
        if (target.character.id === 'berserker_lord' && !target.isDead) CharacterMechanics.gainRage(target, 6);
        // Battle Medic's Emergency Protocol tracker: remembers she attacked, for Combat Heal's bonus.
        if (actor.character.id === 'battle_medic' && skillDef.id === actor.character.basicAttack.id) actor.mech.attackedLastTurn = true;
        // Beastmaster's Animal Bond: her active Beast strikes the same target at the same time
        // whenever her Basic Attack lands (Skill 2 / Ultimate already involve the Beast directly).
        if (actor.character.id === 'beastmaster' && skillDef.id === 'hunter_strike' && actor.mech.beastId && !target.isDead) {
          const beast = ctx.allActors.find(a => a.id === actor.mech.beastId && !a.isDead);
          if (beast) {
            const { amount: bAmt, isCrit: bCrit } = CombatEngine.calculateDamage(beast, target, 0.7, {});
            const bDealt = CombatEngine.applyDamage(beast, target, bAmt);
            events.push({ type: 'damage', actor: beast.id, target: target.id, amount: bDealt, isCrit: bCrit,
              text: `${beast.name} strikes ${target.name} alongside her for ${bDealt} damage.` });
            if (target.isDead) { events.push({ type: 'death', actor: target.id, text: `${target.name} has fallen!` }); CharacterMechanics.registerDeath(target, ctx.allActors); }
          }
        }

        this.applyStatuses(actor, target, skillDef, events);

        // Plague Doctor's Contagion: Basic Attack / Poison Flask can proc a spread on their own.
        if (['infected_strike', 'poison_flask'].includes(skillDef.id) && !target.isDead) {
          CharacterMechanics.trySpreadDebuff(actor, target, ctx.allActors, events);
        }

        if (target.isDead) {
          events.push({ type: 'death', actor: target.id, text: `${target.name} has fallen!` });
          CharacterMechanics.registerDeath(target, ctx.allActors);
        }

        // Mirror Knight's Mirror Armor: reflects a capped share of this hit back at the attacker.
        const reflectEvent = CharacterMechanics.tryReflect(target, actor, dealt, false);
        if (reflectEvent) {
          events.push(reflectEvent);
          if (actor.isDead) { events.push({ type: 'death', actor: actor.id, text: `${actor.name} has fallen!` }); CharacterMechanics.registerDeath(actor, ctx.allActors); }
        }

        // Counter-attack check (Samurai's Bushido/Iaido/Parry, Duelist's Riposte).
        const counterEvent = CharacterMechanics.tryCounter(target, actor, ctx.allActors);
        if (counterEvent) {
          events.push(counterEvent);
          if (actor.isDead) { events.push({ type: 'death', actor: actor.id, text: `${actor.name} has fallen!` }); CharacterMechanics.registerDeath(actor, ctx.allActors); }
        }

        CombatEngine.gainEnergy(actor, 0); // energy from own action handled by caller
      }
    } else if (skillDef.type === 'heal') {
      for (const target of targets) {
        if (target.isDead) continue;
        let healAmt = Math.round(CombatEngine.liveStat(actor, 'attack') * skillDef.power);
        // Battle Medic's Combat Heal: bonus if she attacked on her previous turn.
        if (skillDef.id === 'combat_heal' && actor.mech && actor.mech.attackedLastTurn) healAmt = Math.round(healAmt * 1.15);
        // Battle Medic's Emergency Protocol: bonus healing on a critically low-HP ally.
        if (actor.character.id === 'battle_medic' && (target.hp / target.maxHp) < 0.3) healAmt = Math.round(healAmt * 1.12);
        // Mass Trauma Care: the more HP an ally is missing, the more they recover (capped).
        if (skillDef.id === 'mass_trauma_care') {
          const missingPct = 1 - (target.hp / target.maxHp);
          healAmt = Math.round(healAmt * (1 + Math.min(0.6, missingPct)));
        }
        const healed = CombatEngine.applyHeal(actor, target, healAmt);
        events.push({ type: 'heal', actor: actor.id, target: target.id, amount: healed,
          text: `${actor.name} used ${skillDef.name} on ${target.name}, healing ${healed} HP.` });
        this.applyStatuses(actor, target, skillDef, events);
      }
    } else if (skillDef.type === 'shield') {
      for (const target of targets) {
        if (target.isDead) continue;
        const shieldAmt = Math.round(target.maxHp * skillDef.power * 0.3 + CombatEngine.liveStat(actor, 'attack') * skillDef.power);
        CombatEngine.applyShield(target, shieldAmt);
        events.push({ type: 'shield', actor: actor.id, target: target.id, amount: shieldAmt,
          text: `${actor.name} used ${skillDef.name}, shielding ${target.name} for ${shieldAmt}.` });
      }
    } else if (skillDef.type === 'buff') {
      for (const target of targets) {
        if (target.isDead) continue;
        this.applyStatuses(actor, target, skillDef, events);
        events.push({ type: 'buff', actor: actor.id, target: target.id,
          text: `${actor.name} used ${skillDef.name} on ${target.name}.` });
      }
    } else if (skillDef.type === 'debuff') {
      for (const target of targets) {
        if (target.isDead) continue;
        const wasAlreadySlowedDebuff = ['frost_bind', 'absolute_zero_fk'].includes(skillDef.id) && StatusEngine.has(target, 'slow');
        if (skillDef.power > 0) {
          const { amount, isCrit, evaded } = CombatEngine.calculateDamage(actor, target, skillDef.power, { bypassProtection: TargetingEngine.bypassesProtection(skillDef.targetType), alreadySlowedBonus: wasAlreadySlowedDebuff });
          if (evaded) {
            events.push({ type: 'evade', actor: actor.id, target: target.id, text: `${target.name} evaded the attack!` });
            if (target.character.id === 'fencer') StatusEngine.apply(target, 'footwork', 3, target.id);
            continue;
          }
          if (StatusEngine.consumeWard(target)) {
            events.push({ type: 'ward', actor: actor.id, target: target.id, text: `${target.name}'s Decoy absorbs the hit completely!` });
            continue;
          }
          const redirect = CharacterMechanics.interceptDamage(target, amount, ctx.allActors);
          if (redirect.redirectedTo) {
            events.push({ type: 'redirect', actor: redirect.redirectedTo.id, target: target.id, amount: redirect.redirectedAmount,
              text: `${redirect.redirectedTo.name} intercepts ${redirect.redirectedAmount} damage meant for ${target.name}!` });
          }
          const dealt = CombatEngine.applyDamage(actor, target, redirect.amount);
          events.push({ type: 'damage', actor: actor.id, target: target.id, amount: dealt, isCrit,
            text: `${actor.name} used ${skillDef.name} on ${target.name} for ${dealt} damage.` });
          if (target.isDead) { events.push({ type: 'death', actor: target.id, text: `${target.name} has fallen!` }); CharacterMechanics.registerDeath(target, ctx.allActors); }
          if (target.character.id === 'frost_knight' && !target.isDead) StatusEngine.apply(target, 'ice_stack', 4, target.id);
          const reflectEventD = CharacterMechanics.tryReflect(target, actor, dealt, false);
          if (reflectEventD) {
            events.push(reflectEventD);
            if (actor.isDead) { events.push({ type: 'death', actor: actor.id, text: `${actor.name} has fallen!` }); CharacterMechanics.registerDeath(actor, ctx.allActors); }
          }
        }
        this.applyStatuses(actor, target, skillDef, events);
        // Frost Knight's Frost Bind: escalates an already-Slowed target straight to a brief Freeze.
        if (skillDef.id === 'frost_bind' && wasAlreadySlowedDebuff && !target.isDead) {
          StatusEngine.apply(target, 'freeze', 1, actor.id);
          events.push({ type: 'status', actor: actor.id, target: target.id, statusId: 'freeze', text: `${target.name} is frozen solid!` });
        }
        events.push({ type: 'debuff', actor: actor.id, target: target.id,
          text: `${target.name} is afflicted by ${skillDef.name}.` });
      }
    } else if (skillDef.type === 'special') {
      for (const target of targets) {
        if (skillDef.cleanse) {
          StatusEngine.removeAllDebuffs(target);
          events.push({ type: 'cleanse', actor: actor.id, target: target.id, text: `${actor.name} purifies ${target.name}, removing all debuffs.` });
        }
      }
    }

    // Isolated per-character extras that don't fit the generic type pipeline (position pulls,
    // turn-gauge manipulation, reagents, totems, rewind...). See character-mechanics.js.
    CharacterMechanics.onSkillCast(actor, skillDef, targets, events, ctx);

    return events;
  },

  applyStatuses(actor, target, skillDef, events) {
    if (!skillDef.statuses) return;
    for (const s of skillDef.statuses) {
      let chance = s.chance;
      if (actor.character.id === 'frost-mage') chance = Math.min(100, chance + 15);
      if (Math.random() * 100 < chance) {
        const def = STATUS_DEFS[s.id];
        const magnitude = def.kind === 'ward' ? 2 : undefined; // Decoy: blocks 2 full hits
        StatusEngine.apply(target, s.id, s.duration, actor.id, magnitude);
        events.push({ type: 'status', actor: actor.id, target: target.id, statusId: s.id,
          text: `${target.name} is affected by ${def.name}.` });
      }
    }
  },

  /** Resolve a skill's targetType + player-chosen target into a concrete actor list. Row-aware. */
  resolveTargets(actor, skillDef, chosenTarget, allActors) {
    if (skillDef.targetType === 'self') return [actor];

    const aoe = TargetingEngine.resolveAoeTargets(skillDef, actor.side, allActors);
    if (aoe) return aoe;

    if (skillDef.targetType === 'adjacent_enemies') {
      return TargetingEngine.adjacentTargets(chosenTarget, actor.side, allActors);
    }

    if (chosenTarget && !chosenTarget.isDead) return [chosenTarget];
    const fallback = TargetingEngine.defaultTarget(skillDef, actor.side, allActors, actor);
    return fallback ? [fallback] : [];
  },
};
