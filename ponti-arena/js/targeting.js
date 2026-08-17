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
    if (role === 'Tank') return 'front';
    if (['Fighter', 'Assassin'].includes(role)) return 'middle';
    return 'back'; // Mage, Ranged, Support
  },

  /** The battle grid is a fixed 12 slots per side: 4 Front + 4 Middle + 4 Back - one unit
   *  (character or summon) per slot, never stacked. See #5 in the formation spec. */
  MAX_PER_ROW: 4,

  /** Finds the first open slot for a preferred row, cascading to the other rows (nearest first)
   *  if the preferred row is already full. Returns null only if the whole 12-slot side is full. */
  findOpenSlot(formation, preferredRow) {
    const order = preferredRow === 'front' ? ['front', 'middle', 'back']
      : preferredRow === 'back' ? ['back', 'middle', 'front']
      : ['middle', 'front', 'back'];
    for (const row of order) {
      const taken = new Set(formation.filter(p => p.row === row).map(p => p.column));
      for (let col = 0; col < this.MAX_PER_ROW; col++) {
        if (!taken.has(col)) return { row, column: col };
      }
    }
    return null; // all 12 slots full
  },

  buildAutoFormation(characterIds) {
    const formation = [];
    characterIds.forEach(id => {
      const character = getCharacterById(id) || (id === TRAINING_DUMMY.id ? TRAINING_DUMMY : null);
      const preferred = this.autoArrangeRow(character.role);
      const slot = this.findOpenSlot(formation, preferred);
      if (slot) formation.push({ id, row: slot.row, column: slot.column });
    });
    return formation;
  },

  /** A handful of named AI formation templates (see config.js AI_FORMATION_TEMPLATES for role buckets). */
  buildFormationFromTemplate(characterIds, templateName) {
    const template = AI_FORMATION_TEMPLATES[templateName] || AI_FORMATION_TEMPLATES.balanced;
    const remaining = [...characterIds];
    const formation = [];
    const placeIn = (id, preferredRow) => {
      const slot = this.findOpenSlot(formation, preferredRow);
      if (slot) formation.push({ id, row: slot.row, column: slot.column });
    };
    ROWS.forEach(row => {
      const wanted = template[row] || [];
      wanted.forEach(role => {
        const idx = remaining.findIndex(id => {
          const c = getCharacterById(id);
          return c && c.role === role;
        });
        if (idx !== -1) placeIn(remaining.splice(idx, 1)[0], row);
      });
    });
    // Anything left over (role didn't match template) falls back to auto-arrange by role.
    remaining.forEach(id => {
      const character = getCharacterById(id);
      placeIn(id, this.autoArrangeRow(character.role));
    });
    return formation;
  },
};
