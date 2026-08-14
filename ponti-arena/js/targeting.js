/**
 * PONTI ARENA - Targeting Engine
 * All row/position-aware target resolution lives here so neither the UI nor
 * the skill/battle logic need to know the details of row priority, back-row
 * protection eligibility, or adjacency. Battle actors carry:
 *   actor.position = { row: 'front' | 'middle' | 'back', column: 0-4 }
 */

const ROWS = ['front', 'middle', 'back'];

const TargetingEngine = {
  livingByRow(actors, side, row) {
    return actors.filter(a => a.side === side && !a.isDead && a.position && a.position.row === row);
  },

  livingSide(actors, side) {
    return actors.filter(a => a.side === side && !a.isDead);
  },

  /** Default Basic-Attack style priority: nearest non-empty row (Front -> Middle -> Back). */
  frontPriorityTargets(actors, side) {
    for (const row of ROWS) {
      const list = this.livingByRow(actors, side, row);
      if (list.length > 0) return list;
    }
    return [];
  },

  /** Which enemies/allies are legally clickable for a given skill's targetType. */
  getSelectableTargets(skillDef, casterSide, allActors) {
    const enemySide = casterSide === 'player' ? 'enemy' : 'player';
    switch (skillDef.targetType) {
      case 'single_enemy': return this.frontPriorityTargets(allActors, enemySide);
      case 'any_enemy': return this.livingSide(allActors, enemySide);
      case 'single_front': return this.livingByRow(allActors, enemySide, 'front');
      case 'single_middle': return this.livingByRow(allActors, enemySide, 'middle');
      case 'single_back': return this.livingByRow(allActors, enemySide, 'back');
      case 'adjacent_enemies': return this.livingSide(allActors, enemySide);
      case 'single_ally': return this.livingSide(allActors, casterSide);
      default: return this.livingSide(allActors, enemySide);
    }
  },

  /** For AoE-shaped targetTypes, resolve the full hit-list directly (no player pick needed). */
  resolveAoeTargets(skillDef, casterSide, allActors) {
    const enemySide = casterSide === 'player' ? 'enemy' : 'player';
    switch (skillDef.targetType) {
      case 'all_enemy': return this.livingSide(allActors, enemySide);
      case 'all_ally': return this.livingSide(allActors, casterSide);
      case 'front_row': return this.livingByRow(allActors, enemySide, 'front');
      case 'middle_row': return this.livingByRow(allActors, enemySide, 'middle');
      case 'back_row': return this.livingByRow(allActors, enemySide, 'back');
      default: return null; // signals "not an AoE type, caller should resolve manually"
    }
  },

  /** Sort order used to define "adjacency" across a side's living roster. */
  sortedSide(actors, side) {
    return this.livingSide(actors, side).slice().sort((a, b) => {
      const rowDiff = ROWS.indexOf(a.position.row) - ROWS.indexOf(b.position.row);
      if (rowDiff !== 0) return rowDiff;
      return a.position.column - b.position.column;
    });
  },

  adjacentTargets(chosenTarget, casterSide, allActors) {
    const enemySide = casterSide === 'player' ? 'enemy' : 'player';
    const list = this.sortedSide(allActors, enemySide);
    if (!chosenTarget) return list.slice(0, Math.min(3, list.length));
    const idx = list.findIndex(a => a.id === chosenTarget.id);
    if (idx === -1) return [chosenTarget];
    return [list[idx - 1], list[idx], list[idx + 1]].filter(Boolean);
  },

  /** Auto-pick a sensible target when the caller (AI, or a forced-target skill) supplies none. */
  defaultTarget(skillDef, casterSide, allActors, casterActor) {
    if (skillDef.targetType === 'self') return casterActor;
    if (skillDef.targetType === 'single_ally') {
      const allies = this.livingSide(allActors, casterSide);
      return allies.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0] || casterActor;
    }
    const selectable = this.getSelectableTargets(skillDef, casterSide, allActors);
    return selectable[0] || null;
  },

  /** Whether an attack of this targetType is considered a deliberate row-bypass (ignores Back Row protection). */
  bypassesProtection(targetType) {
    return ['single_front', 'single_middle', 'single_back', 'front_row', 'middle_row', 'back_row', 'any_enemy', 'adjacent_enemies'].includes(targetType);
  },

  /** Simple default formation: Tank/Bruiser-like roles up front, ranged/casters in the back. */
  autoArrangeRow(role) {
    if (['Tank', 'Bruiser'].includes(role)) return 'front';
    if (['Fighter', 'Assassin', 'Skirmisher', 'Hybrid'].includes(role)) return 'middle';
    return 'back'; // Mage, Ranged, Support, Summoner, Specialist, Control
  },

  buildAutoFormation(characterIds) {
    const buckets = { front: [], middle: [], back: [] };
    characterIds.forEach(id => {
      const character = getCharacterById(id) || (id === TRAINING_DUMMY.id ? TRAINING_DUMMY : null);
      const row = this.autoArrangeRow(character.role);
      buckets[row].push(id);
    });
    const formation = [];
    ROWS.forEach(row => buckets[row].forEach((id, col) => formation.push({ id, row, column: col })));
    return formation;
  },

  /** A handful of named AI formation templates (see config.js AI_FORMATION_TEMPLATES for role buckets). */
  buildFormationFromTemplate(characterIds, templateName) {
    const template = AI_FORMATION_TEMPLATES[templateName] || AI_FORMATION_TEMPLATES.balanced;
    const remaining = [...characterIds];
    const buckets = { front: [], middle: [], back: [] };
    ROWS.forEach(row => {
      const wanted = template[row] || [];
      wanted.forEach(role => {
        const idx = remaining.findIndex(id => {
          const c = getCharacterById(id);
          return c && c.role === role;
        });
        if (idx !== -1) buckets[row].push(remaining.splice(idx, 1)[0]);
      });
    });
    // Anything left over (role didn't match template) falls back to auto-arrange by role.
    remaining.forEach(id => {
      const character = getCharacterById(id);
      buckets[this.autoArrangeRow(character.role)].push(id);
    });
    const formation = [];
    ROWS.forEach(row => buckets[row].forEach((id, col) => formation.push({ id, row, column: col })));
    return formation;
  },
};
