/**
 * PONTI ARENA - UI Renderer
 * Pure(ish) DOM rendering functions. Reads state passed in by app.js and
 * writes to the DOM. Never mutates game/battle state directly - clicks are
 * wired to callbacks supplied by app.js.
 */

const UI = {
  el(id) { return document.getElementById(id); },

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = this.el(id);
    if (target) target.classList.add('active');
    window.scrollTo(0, 0);
  },

  toast(message, kind = 'info') {
    const container = this.el('toast-container');
    if (!container) return;
    const div = document.createElement('div');
    div.className = `toast toast-${kind}`;
    div.textContent = message;
    container.appendChild(div);
    setTimeout(() => div.classList.add('show'), 10);
    setTimeout(() => { div.classList.remove('show'); setTimeout(() => div.remove(), 300); }, 3200);
  },

  // ---------- Character Card (roster / selection) ----------
  // ---------- Class Filter ----------
  renderClassFilter(container, activeRole, onSelectRole) {
    container.innerHTML = '';
    const allChip = document.createElement('button');
    allChip.type = 'button';
    allChip.className = 'class-filter-chip' + (!activeRole ? ' active' : '');
    allChip.textContent = 'All';
    allChip.addEventListener('click', () => onSelectRole(null));
    container.appendChild(allChip);
    ROLE_ORDER.forEach(role => {
      const meta = ROLE_META[role] || { color: '#c9a227' };
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'class-filter-chip' + (activeRole === role ? ' active' : '');
      chip.style.setProperty('--role-color', meta.color);
      chip.textContent = role;
      chip.addEventListener('click', () => onSelectRole(role));
      container.appendChild(chip);
    });
  },

  buildCharacterCard(character, { selected = false, disabled = false, mastery = 0 } = {}) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `char-card role-${character.role.toLowerCase()}` + (selected ? ' selected' : '') + (disabled ? ' disabled' : '');
    card.dataset.characterId = character.id;
    card.dataset.role = character.role;
    card.setAttribute('aria-label', `${character.name}, ${character.role}`);
    const roleMeta = ROLE_META[character.role] || { abbr: character.role.slice(0, 3).toUpperCase(), color: '#c9a227' };
    card.innerHTML = `
      <div class="char-card-avatar-slot"></div>
      <div class="char-card-class-badge" style="--role-color:${roleMeta.color}" title="${character.role}">${roleMeta.abbr}</div>
      <div class="char-card-name">${character.name}</div>
      ${mastery > 0 ? `<div class="char-card-mastery">M${mastery}</div>` : ''}
    `;
    card.querySelector('.char-card-avatar-slot').appendChild(AssetManager.buildAvatarElement(character, '', true));
    return card;
  },

  buildCharacterDetail(character) {
    const wrap = document.createElement('div');
    wrap.className = 'char-detail';
    wrap.innerHTML = `
      <div class="char-detail-header">
        <div class="char-detail-avatar"></div>
        <div>
          <h3>${character.name}</h3>
          <span class="char-detail-role role-${character.role.toLowerCase()}">${character.role}</span>
          <span class="char-detail-atktype atktype-${character.attackType}">${character.attackType === 'magical' ? 'Magical' : 'Physical'}</span>
          <span class="char-detail-diff">Difficulty: ${character.difficulty}</span>
        </div>
      </div>
      <p class="char-detail-desc">${character.description}</p>
      <div class="char-detail-stats">
        <div><span>HP</span><b>${character.base.hp}</b></div>
        <div><span>ATK</span><b>${character.base.attack}</b></div>
        <div><span>SPD</span><b>${character.base.speed}</b></div>
        <div><span>P.DEF</span><b>${character.base.physicalDefense}</b></div>
        <div><span>M.DEF</span><b>${character.base.magicalDefense}</b></div>
        <div><span>EVASION%</span><b>${character.base.evasion}</b></div>
        <div><span>CRIT%</span><b>${character.base.critRate}</b></div>
        <div><span>CRIT DMG%</span><b>${character.base.critDmg}</b></div>
      </div>
      <div class="char-detail-sw">
        <div class="strengths"><h4>Strengths</h4><ul>${character.strengths.map(s => `<li>${s}</li>`).join('')}</ul></div>
        <div class="weaknesses"><h4>Weaknesses</h4><ul>${character.weaknesses.map(w => `<li>${w}</li>`).join('')}</ul></div>
      </div>
      <div class="char-detail-skills">
        <div class="skill-row"><b>Passive — ${character.passive.name}</b><p>${character.passive.desc}</p></div>
        <div class="skill-row"><b>Basic — ${character.basicAttack.name}</b><p>Deals damage, no cooldown.</p></div>
        <div class="skill-row"><b>Skill 1 — ${character.skill1.name}</b><p>${character.skill1.desc || ''} (CD ${character.skill1.cooldown})</p></div>
        <div class="skill-row"><b>Skill 2 — ${character.skill2.name}</b><p>${character.skill2.desc || ''} (CD ${character.skill2.cooldown})</p></div>
        <div class="skill-row ultimate"><b>Ultimate — ${character.ultimate.name}</b><p>${character.ultimate.desc || ''} (100 Energy)</p></div>
      </div>
    `;
    wrap.querySelector('.char-detail-avatar').appendChild(AssetManager.buildAvatarElement(character));
    return wrap;
  },

  // ---------- Team Preview ----------
  renderTeamSlots(container, team, onRemove) {
    container.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const slot = document.createElement('div');
      slot.className = 'team-slot' + (team[i] ? ' filled' : ' empty');
      if (team[i]) {
        const character = getCharacterById(team[i]);
        slot.appendChild(AssetManager.buildAvatarElement(character, 'small'));
        const label = document.createElement('div');
        label.className = 'team-slot-name';
        label.textContent = character.name;
        slot.appendChild(label);
        slot.addEventListener('click', () => onRemove(i));
        slot.title = 'Tap to remove';
      } else {
        slot.innerHTML = `<span class="team-slot-plus">+</span>`;
      }
      container.appendChild(slot);
    }
  },

  teamWarnings(team) {
    const warnings = [];
    if (team.length < 5) return warnings;
    const chars = team.map(getCharacterById);
    const roles = chars.map(c => c.role);
    if (!roles.some(r => r === 'Support')) warnings.push('Your team has no healer.');
    const rangedCount = roles.filter(r => r === 'Ranged').length;
    if (rangedCount >= 4) warnings.push(`Your team has ${rangedCount} ranged characters.`);
    if (!roles.some(r => r === 'Tank')) warnings.push('Your team has no Tank.');
    const allLowHp = chars.every(c => c.base.hp < 950);
    if (allLowHp) warnings.push('Your team is very fragile - consider adding a durable character.');
    return warnings;
  },

  // ---------- Formation Editor ----------
  buildFormationChip(characterId, { selected = false, draggable = true, placed = false } = {}) {
    const character = getCharacterById(characterId);
    const chip = document.createElement('div');
    chip.className = 'formation-chip' + (selected ? ' selected' : '') + (placed ? ' placed' : '');
    chip.dataset.characterId = characterId;
    chip.draggable = draggable;
    chip.innerHTML = `<div class="char-avatar small"></div><span class="formation-chip-name">${character.name}</span>`;
    chip.querySelector('.char-avatar').appendChild(AssetManager.buildAvatarElement(character, 'small'));
    return chip;
  },

  renderFormationEditor(formation, poolIds, { selectedId, onChipClick, onRowClick, onDragStart, onRowDrop, onSwap } = {}) {
    const pool = this.el('formation-pool');
    pool.innerHTML = '';
    poolIds.forEach(id => {
      const chip = this.buildFormationChip(id, { selected: selectedId === id });
      chip.addEventListener('click', () => onChipClick(id));
      chip.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', id); onDragStart && onDragStart(id); });
      pool.appendChild(chip);
    });

    const ROW_ORDER = ['front', 'middle', 'back'];
    const MAX_PER_ROW = (typeof TargetingEngine !== 'undefined' && TargetingEngine.MAX_PER_ROW) || 4;
    ROW_ORDER.forEach((row) => {
      const container = this.el(`formation-row-${row}`);
      container.innerHTML = '';
      container.classList.add('fixed-slots');
      const rowMembers = formation.filter(p => p.row === row).sort((a, b) => a.column - b.column);
      const countEl = this.el(`row-count-${row}`);
      if (countEl) countEl.textContent = `${rowMembers.length}/${MAX_PER_ROW}`;
      const byColumn = new Map(rowMembers.map(p => [p.column, p]));

      for (let col = 0; col < MAX_PER_ROW; col++) {
        const entry = byColumn.get(col);
        if (entry) {
          const chip = this.buildFormationChip(entry.id, { placed: true, selected: selectedId === entry.id });
          chip.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', entry.id); onDragStart && onDragStart(entry.id); });
          chip.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); chip.classList.add('drop-hover'); });
          chip.addEventListener('dragleave', () => chip.classList.remove('drop-hover'));
          chip.addEventListener('drop', (e) => {
            e.preventDefault(); e.stopPropagation();
            chip.classList.remove('drop-hover');
            const draggedId = e.dataTransfer.getData('text/plain');
            if (draggedId && draggedId !== entry.id) onSwap(draggedId, entry.id);
          });
          // Touch-friendly fallback (no mouse): tap to select, tap another chip to swap.
          chip.addEventListener('click', (e) => { e.stopPropagation(); onChipClick(entry.id, row); });
          container.appendChild(chip);
        } else {
          // Empty slot placeholder - always visible (never stacked, exactly one unit per slot),
          // and itself a drop target / tap target for placing the selected character here.
          const empty = document.createElement('div');
          empty.className = 'formation-slot-empty';
          empty.dataset.row = row; empty.dataset.column = String(col);
          empty.ondragover = (e) => { e.preventDefault(); empty.classList.add('drop-hover'); };
          empty.ondragleave = () => empty.classList.remove('drop-hover');
          empty.ondrop = (e) => {
            e.preventDefault();
            empty.classList.remove('drop-hover');
            const id = e.dataTransfer.getData('text/plain');
            if (id) onRowDrop(id, row, col);
          };
          empty.addEventListener('click', (e) => { e.stopPropagation(); if (selectedId) onRowClick(row, col); });
          container.appendChild(empty);
        }
      }
    });
  },

  // ---------- Battle UI (3-row formation, Ally=Left / Enemy=Right) ----------
  /** Returns a small resource display descriptor for characters with a special battle resource
   *  (Ki, Rage, Dragon Gauge, Runes, Soul, Mounted state, active Stance, active Turret/Totem), or
   *  null for characters without one. Used to render the resource readout on their battle slot. */
  getResourceDisplay(actor) {
    const id = actor.character.id;
    const mech = actor.mech;
    if (!mech) return null;
    if (id === 'monk') return { label: 'KI', text: `${mech.ki}/100`, pct: mech.ki, cls: 'res-ki' };
    if (id === 'gladiator' || id === 'berserker_lord') return { label: 'RAGE', text: `${mech.rage}/100`, pct: mech.rage, cls: 'res-rage' };
    if (id === 'dragon_knight') return { label: 'GAUGE', text: `${mech.dragonGauge}/100`, pct: mech.dragonGauge, cls: 'res-dragon' };
    if (id === 'soul_reaper') return { label: 'SOUL', text: `${mech.soul}/5`, pct: mech.soul * 20, cls: 'res-soul' };
    if (id === 'rune_master') {
      const icons = { fire: '🔥', guard: '🛡️', wind: '🌬️' };
      const runeText = mech.runes.length > 0 ? mech.runes.map(r => icons[r] || r).join(' ') : '—';
      return { label: 'RUNES', text: runeText, pct: (mech.runes.length / 3) * 100, cls: 'res-rune', textOnly: true };
    }
    if (id === 'beast_rider') return { label: 'STATE', text: mech.mounted ? 'Mounted' : 'Dismounted', pct: mech.mounted ? 100 : 30, cls: 'res-mount', textOnly: true };
    if (id === 'bard') return { label: 'STANCE', text: mech.stance ? (mech.stance === 'battle_song' ? 'Battle Song' : 'War Drum') : 'None', pct: mech.stance ? 100 : 0, cls: 'res-stance', textOnly: true };
    if (id === 'alchemist') return { label: 'BOTTLES', text: `${mech.bottles}/10`, pct: (mech.bottles / 10) * 100, cls: 'res-reagent' };
    if (id === 'necromancer') return { label: 'SKELETONS LOST', text: `${mech.skeletonsLost}`, pct: Math.min(100, mech.skeletonsLost * 20), cls: 'res-soul', textOnly: true };
    if (id === 'beastmaster') return { label: 'BEAST', text: mech.beastId ? 'Active' : 'None', pct: mech.beastId ? 100 : 0, cls: 'res-totem', textOnly: true };
    if (id === 'spirit_shaman') {
      const active = mech.activeTotems || {};
      const names = [active.healing ? 'Healing' : null, active.spirit ? 'Spirit' : null].filter(Boolean);
      return { label: 'TOTEMS', text: names.length ? names.join(' + ') : 'None', pct: names.length * 50, cls: 'res-totem', textOnly: true };
    }
    if (id === 'engineer' && mech.turret) return { label: mech.turret.isWarMachine ? 'WAR MACHINE' : 'TURRET', text: `${mech.turret.hp}/${mech.turret.maxHp}`, pct: (mech.turret.hp / mech.turret.maxHp) * 100, cls: 'res-turret' };
    if (id === 'fencer') {
      const fw = actor.statuses.find(s => s.id === 'footwork');
      return { label: 'FOOTWORK', text: `${fw ? fw.stacks : 0}/3`, pct: fw ? (fw.stacks / 3) * 100 : 0, cls: 'res-footwork' };
    }
    if (id === 'duelist' && mech.duelStacks > 0) return { label: 'DUEL', text: `x${mech.duelStacks}`, pct: (mech.duelStacks / 3) * 100, cls: 'res-duel' };
    return null;
  },

  buildBattleSlot(actor, opts) {
    const isValidTarget = opts.targetableIds ? opts.targetableIds.has(actor.id) : false;
    const inTargetingMode = !!opts.targetableIds;
    const slot = document.createElement('div');
    slot.className = 'battle-slot'
      + (actor.isDead ? ' dead' : '')
      + (opts.activeId === actor.id ? ' active-turn' : '')
      + (isValidTarget ? ' targetable' : '')
      + (inTargetingMode && !isValidTarget && !actor.isDead ? ' invalid-target' : '')
      + (opts.selectedTargetId === actor.id ? ' selected-target' : '');
    slot.dataset.actorId = actor.id;

    const hpPct = Math.max(0, Math.round((actor.hp / actor.maxHp) * 100));
    const energyPct = Math.round(actor.energy);
    const shieldAmt = StatusEngine.totalShield(actor);
    const resource = actor.isDead ? null : this.getResourceDisplay(actor);

    slot.innerHTML = `
      <div class="battle-slot-avatar"></div>
      <div class="battle-slot-info">
        <div class="battle-slot-name">${actor.name}</div>
        <div class="bar hp-bar"><div class="bar-fill" style="width:${hpPct}%"></div><span class="bar-label">${Math.max(0, Math.round(actor.hp))}/${actor.maxHp}</span></div>
        <div class="bar energy-bar"><div class="bar-fill" style="width:${energyPct}%"></div></div>
        ${resource ? `<div class="resource-badge ${resource.cls}" title="${resource.label}">${resource.textOnly ? resource.text : `${resource.label} ${resource.text}`}</div>` : ''}
        ${shieldAmt > 0 ? `<div class="shield-badge">🔷 ${shieldAmt}</div>` : ''}
        <div class="status-icons">${actor.statuses.map(s => `<span class="status-icon" title="${STATUS_DEFS[s.id].name}">${STATUS_DEFS[s.id].icon}</span>`).join('')}</div>
      </div>
    `;
    slot.querySelector('.battle-slot-avatar').appendChild(AssetManager.buildAvatarElement(actor.character, 'small'));
    slot.title = `${actor.name} — ${actor.position.row[0].toUpperCase()}${actor.position.row.slice(1)} Row`;
    if (isValidTarget && opts.onSelectTarget) {
      slot.addEventListener('click', () => opts.onSelectTarget(actor.id));
    }
    return slot;
  },

  /**
   * Renders every living/dead actor into its row+side container:
   * #battle-ally-front / #battle-ally-middle / #battle-ally-back
   * #battle-enemy-front / #battle-enemy-middle / #battle-enemy-back
   * opts.targetableIds: optional Set<actorId> - when present, targeting mode is active and only
   * those ids are clickable; everything else is dimmed as an invalid target.
   */
  renderFormation(allActors, opts = {}) {
    const ROWS_LOCAL = ['front', 'middle', 'back'];
    const MAX_PER_ROW = (typeof TargetingEngine !== 'undefined' && TargetingEngine.MAX_PER_ROW) || 4;
    const allSummons = opts.summons || [];
    ROWS_LOCAL.forEach(row => {
      const allyContainer = this.el(`battle-ally-${row}`);
      const enemyContainer = this.el(`battle-enemy-${row}`);
      if (allyContainer) { allyContainer.innerHTML = ''; allyContainer.classList.add('fixed-slots'); }
      if (enemyContainer) { enemyContainer.innerHTML = ''; enemyContainer.classList.add('fixed-slots'); }

      ['player', 'enemy'].forEach(side => {
        const container = side === 'player' ? allyContainer : enemyContainer;
        if (!container) return;
        const actorsHere = allActors.filter(a => a.side === side && a.position.row === row).sort((a, b) => a.position.column - b.position.column);
        const summonsHere = allSummons.filter(s => s.side === side && s.row === row);
        const byColumn = new Map();
        actorsHere.forEach(a => byColumn.set(a.position.column, { kind: 'actor', data: a }));
        summonsHere.forEach(s => byColumn.set(s.column, { kind: 'summon', data: s }));
        for (let col = 0; col < MAX_PER_ROW; col++) {
          const entry = byColumn.get(col);
          if (entry && entry.kind === 'actor') {
            container.appendChild(this.buildBattleSlot(entry.data, opts));
          } else if (entry && entry.kind === 'summon') {
            container.appendChild(this.buildSummonSlot(entry.data));
          } else {
            const empty = document.createElement('div');
            empty.className = 'battle-slot-empty';
            if (opts.slotPickMode && side === 'player') {
              empty.classList.add('slot-pickable');
              empty.addEventListener('click', () => opts.onSlotPick({ row, column: col }));
            }
            container.appendChild(empty);
          }
        }
      });
    });
  },

  /** A Turret or Totem's visible battle-grid occupant - lighter than a full character slot (no
   *  Energy bar, no status icons, no targeting - see #4 in the formation spec: summons are shown,
   *  but stay a non-targetable visual representation of the existing durability/aura mechanic). */
  buildSummonSlot(summon) {
    const slot = document.createElement('div');
    slot.className = 'battle-slot summon-slot';
    slot.style.setProperty('--summon-color', summon.color || '#c9a227');
    const hpRow = summon.maxHp
      ? `<div class="bar hp-bar"><div class="bar-fill" style="width:${Math.round((summon.hp / summon.maxHp) * 100)}%"></div><span class="bar-label">${Math.max(0, Math.round(summon.hp))}/${summon.maxHp}</span></div>`
      : `<div class="summon-perpetual">Active</div>`;
    slot.innerHTML = `
      <div class="battle-slot-avatar summon-icon">${summon.icon}</div>
      <div class="battle-slot-info">
        <div class="battle-slot-name">${summon.name}</div>
        ${hpRow}
      </div>
    `;
    return slot;
  },

  renderTimeline(container, preview, activeId) {
    container.innerHTML = '';
    preview.forEach((entry, i) => {
      const chip = document.createElement('div');
      chip.className = 'timeline-chip' + (i === 0 ? ' next-up' : '');
      chip.style.setProperty('--chip-color', entry.color || '#c9a227');
      chip.innerHTML = `<span>${entry.icon || '❔'}</span>`;
      chip.title = entry.name;
      container.appendChild(chip);
    });
  },

  // Characters whose Passive has a clear, checkable on/off condition (HP threshold, stance, a
  // status being present, etc). Characters not listed here still show the Passive button and its
  // description, just without an ACTIVE/INACTIVE badge, since their passive is continuous rather
  // than a discrete toggle (e.g. flat stat bonuses, always-on lifesteal).
  PASSIVE_ACTIVE_CHECK: {
    knight: (a) => a.hp / a.maxHp < 0.4,
    'blood-knight': (a) => true,
    samurai: (a) => a.defending === true || StatusEngine.has(a, 'iaido_stance') || StatusEngine.has(a, 'parry_stance'),
    shadow_priest: (a) => a.hp / a.maxHp < 0.45,
    frost_knight: (a) => StatusEngine.has(a, 'ice_stack'),
    mirror_knight: (a) => true,
    fencer: (a) => StatusEngine.has(a, 'footwork'),
    gladiator: (a) => a.mech && a.mech.rage > 0,
    berserker_lord: (a) => a.mech && a.mech.rage > 0,
    dragon_knight: (a) => StatusEngine.has(a, 'dragon_form') || (a.mech && a.mech.dragonGauge > 0),
    monk: (a) => a.mech && a.mech.ki > 0,
    soul_reaper: (a) => a.mech && a.mech.soul > 0,
    engineer: (a) => a.mech && !!a.mech.turret,
    beast_rider: (a) => a.mech && a.mech.mounted,
    demon_hunter: (a) => false, // Hunter's Mark is applied to enemies, not self-triggered
    void_walker: (a) => StatusEngine.has(a, 'void_step'),
    ninja: (a) => true,
    assassin: (a) => true,
    archer: (a) => true,
    vampire: (a) => true,
    duelist: (a) => a.mech && a.mech.duelStacks > 0,
    plague_doctor: (a) => a.mech && a.mech.spreadCooldown === 0,
    witch: (a) => true,
    alchemist: (a) => a.mech && a.mech.bottles >= 7,
  },

  /** Returns true/false if this character's Passive has a known active/inactive condition right
   *  now, or null if their passive is continuous (no discrete on/off to show). */
  getPassiveActiveState(actor) {
    const check = this.PASSIVE_ACTIVE_CHECK[actor.character.id];
    if (!check) return null;
    try { return !!check(actor); } catch (err) { return null; }
  },

  renderActionMenu(container, actions, onPick, actor) {
    container.innerHTML = '';
    const labels = { basicAttack: 'Basic', skill1: 'Skill 1', skill2: 'Skill 2', ultimate: 'Ultimate', defend: 'Defend' };
    actions.forEach(a => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `action-btn action-${a.key}` + (!a.ready ? ' locked' : '');
      btn.innerHTML = `
        <span class="action-btn-label">${labels[a.key]}</span>
        <span class="action-btn-sub">${a.def.name}</span>
        ${!a.ready ? `<span class="action-btn-lock">${a.key === 'ultimate' ? 'Need Energy' : 'On Cooldown'}</span>` : ''}
      `;
      btn.disabled = !a.ready;
      const description = a.def.desc || (a.key === 'defend' ? 'Reduces incoming damage this turn and generates a little Energy.' : 'A basic attack - no cooldown.');
      const held = this.attachHoldDescription(btn, description);
      btn.addEventListener('click', () => { if (held.value) return; onPick(a); });
      container.appendChild(btn);
    });

    // Passive info button - purely informational (does not consume the turn). Hold to read the
    // full description like any other skill; tapping shows an ACTIVE/INACTIVE badge when this
    // character's passive has a clear on/off condition.
    if (actor && actor.character.passive) {
      const passiveBtn = document.createElement('button');
      passiveBtn.type = 'button';
      passiveBtn.className = 'action-btn action-passive';
      const state = this.getPassiveActiveState(actor);
      const badge = state === true ? '<span class="passive-state active">ACTIVE</span>'
        : state === false ? '<span class="passive-state inactive">INACTIVE</span>' : '';
      passiveBtn.innerHTML = `<span class="action-btn-label">Passive</span><span class="action-btn-sub">${actor.character.passive.name}</span>${badge}`;
      const passiveHeld = this.attachHoldDescription(passiveBtn, actor.character.passive.desc);
      passiveBtn.addEventListener('click', () => { if (passiveHeld.value) return; /* informational only - never consumes the turn */ });
      container.appendChild(passiveBtn);
    }
  },

  /** Shows a tooltip with `text` after the element is held (mouse or touch) past a short delay,
   *  and suppresses the click that follows so holding-to-read never also triggers the action.
   *  Returns a mutable `{ value: boolean }` the caller checks in its own click handler. */
  attachHoldDescription(el, text) {
    const heldRef = { value: false };
    if (!text) return heldRef;
    let timer = null;
    let tooltip = null;
    const showTooltip = () => {
      heldRef.value = true;
      tooltip = document.createElement('div');
      tooltip.className = 'skill-hold-tooltip';
      tooltip.textContent = text;
      document.body.appendChild(tooltip);
      const rect = el.getBoundingClientRect();
      const left = Math.min(window.innerWidth - tooltip.offsetWidth - 8, Math.max(8, rect.left + rect.width / 2 - tooltip.offsetWidth / 2));
      let top = rect.top - tooltip.offsetHeight - 10;
      if (top < 4) top = rect.bottom + 10;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      requestAnimationFrame(() => tooltip && tooltip.classList.add('show'));
    };
    const hideTooltip = () => { if (tooltip) { tooltip.remove(); tooltip = null; } };
    const start = (e) => { clearTimeout(timer); timer = setTimeout(showTooltip, 420); };
    const cancel = () => {
      clearTimeout(timer);
      hideTooltip();
      if (heldRef.value) setTimeout(() => { heldRef.value = false; }, 50); // let the click handler see it first
    };
    el.addEventListener('mousedown', start);
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('mouseup', cancel);
    el.addEventListener('mouseleave', cancel);
    el.addEventListener('touchend', cancel);
    el.addEventListener('touchcancel', cancel);
    return heldRef;
  },

  appendBattleLog(container, text, type = '') {
    const line = document.createElement('div');
    line.className = `log-line log-${type}`;
    line.textContent = text;
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
  },

  floatText(hostEl, text, kind) {
    if (!hostEl) return;
    const f = document.createElement('div');
    f.className = `float-text float-${kind}`;
    f.textContent = text;
    hostEl.appendChild(f);
    setTimeout(() => f.remove(), 1100);
  },

  shakeScreen(enabled) {
    if (!enabled) return;
    const arena = this.el('battle-arena');
    if (!arena) return;
    arena.classList.remove('shake');
    void arena.offsetWidth;
    arena.classList.add('shake');
  },
};
