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
  buildCharacterCard(character, { selected = false, disabled = false, mastery = 0 } = {}) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `char-card role-${character.role.toLowerCase()}` + (selected ? ' selected' : '') + (disabled ? ' disabled' : '');
    card.dataset.characterId = character.id;
    card.setAttribute('aria-label', `${character.name}, ${character.role}`);
    card.innerHTML = `
      <div class="char-card-avatar-slot"></div>
      <div class="char-card-name">${character.name}</div>
      <div class="char-card-role">${character.role}</div>
      <div class="char-card-diff diff-${character.difficulty.toLowerCase()}">${character.difficulty}</div>
      ${mastery > 0 ? `<div class="char-card-mastery">M${mastery}</div>` : ''}
    `;
    card.querySelector('.char-card-avatar-slot').appendChild(AssetManager.buildAvatarElement(character));
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
          <span class="char-detail-diff">Difficulty: ${character.difficulty}</span>
        </div>
      </div>
      <p class="char-detail-desc">${character.description}</p>
      <div class="char-detail-stats">
        <div><span>HP</span><b>${character.base.hp}</b></div>
        <div><span>ATK</span><b>${character.base.attack}</b></div>
        <div><span>DEF</span><b>${character.base.defense}</b></div>
        <div><span>SPD</span><b>${character.base.speed}</b></div>
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
    const rangedLike = ['Ranged', 'Skirmisher'].filter(r => roles.filter(x => x === r).length).length;
    const rangedCount = roles.filter(r => r === 'Ranged').length;
    if (rangedCount >= 4) warnings.push(`Your team has ${rangedCount} ranged characters.`);
    if (!roles.some(r => r === 'Tank')) warnings.push('Your team has no Tank.');
    const allLowHp = chars.every(c => c.base.hp < 950);
    if (allLowHp) warnings.push('Your team is very fragile - consider adding a durable character.');
    return warnings;
  },

  // ---------- Formation Editor ----------
  buildFormationChip(characterId, { selected = false, draggable = true, arrows = null } = {}) {
    const character = getCharacterById(characterId);
    const chip = document.createElement('div');
    chip.className = 'formation-chip' + (selected ? ' selected' : '') + (arrows ? ' placed' : '');
    chip.dataset.characterId = characterId;
    chip.draggable = draggable;

    if (arrows) {
      chip.innerHTML = `
        <button type="button" class="chip-arrow chip-arrow-up" aria-label="Move up a row" ${arrows.canUp ? '' : 'disabled'}>▲</button>
        <div class="chip-middle-row">
          <button type="button" class="chip-arrow chip-arrow-left" aria-label="Move left" ${arrows.canLeft ? '' : 'disabled'}>◀</button>
          <div class="chip-portrait">
            <div class="char-avatar small"></div>
            <span class="formation-chip-name">${character.name}</span>
          </div>
          <button type="button" class="chip-arrow chip-arrow-right" aria-label="Move right" ${arrows.canRight ? '' : 'disabled'}>▶</button>
        </div>
        <button type="button" class="chip-arrow chip-arrow-down" aria-label="Move down a row" ${arrows.canDown ? '' : 'disabled'}>▼</button>
      `;
      chip.querySelector('.char-avatar').appendChild(AssetManager.buildAvatarElement(character, 'small'));
      chip.querySelector('.chip-arrow-up').addEventListener('click', (e) => { e.stopPropagation(); arrows.onUp(); });
      chip.querySelector('.chip-arrow-down').addEventListener('click', (e) => { e.stopPropagation(); arrows.onDown(); });
      chip.querySelector('.chip-arrow-left').addEventListener('click', (e) => { e.stopPropagation(); arrows.onLeft(); });
      chip.querySelector('.chip-arrow-right').addEventListener('click', (e) => { e.stopPropagation(); arrows.onRight(); });
      chip.querySelector('.chip-portrait').addEventListener('click', (e) => { e.stopPropagation(); arrows.onRemove(); });
    } else {
      chip.innerHTML = `<div class="char-avatar small"></div><span class="formation-chip-name">${character.name}</span>`;
      chip.querySelector('.char-avatar').appendChild(AssetManager.buildAvatarElement(character, 'small'));
    }
    return chip;
  },

  renderFormationEditor(formation, poolIds, { selectedId, onChipClick, onRowClick, onDragStart, onRowDrop, onMoveRow, onMoveColumn, onSwap } = {}) {
    const pool = this.el('formation-pool');
    pool.innerHTML = '';
    poolIds.forEach(id => {
      const chip = this.buildFormationChip(id, { selected: selectedId === id });
      chip.addEventListener('click', () => onChipClick(id));
      chip.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', id); onDragStart && onDragStart(id); });
      pool.appendChild(chip);
    });

    const ROW_ORDER = ['front', 'middle', 'back'];
    ROW_ORDER.forEach((row, rowIndex) => {
      const container = this.el(`formation-row-${row}`);
      container.innerHTML = '';
      container.ondragover = (e) => { e.preventDefault(); container.classList.add('drop-hover'); };
      container.ondragleave = () => container.classList.remove('drop-hover');
      container.ondrop = (e) => {
        e.preventDefault();
        container.classList.remove('drop-hover');
        const id = e.dataTransfer.getData('text/plain');
        if (id) onRowDrop(id, row);
      };
      container.addEventListener('click', (e) => {
        if (e.target === container) onRowClick(row);
      });
      const rowMembers = formation.filter(p => p.row === row).sort((a, b) => a.column - b.column);
      rowMembers.forEach((p, colIndex) => {
        const chip = this.buildFormationChip(p.id, {
          arrows: {
            canUp: rowIndex > 0,
            canDown: rowIndex < ROW_ORDER.length - 1,
            canLeft: colIndex > 0,
            canRight: colIndex < rowMembers.length - 1,
            onUp: () => onMoveRow(p.id, -1),
            onDown: () => onMoveRow(p.id, 1),
            onLeft: () => onMoveColumn(p.id, -1),
            onRight: () => onMoveColumn(p.id, 1),
            onRemove: () => onChipClick(p.id, row),
          },
        });
        // Drag-and-drop also works for already-placed chips - dropping on another row moves it
        // there directly (no need to remove it back to the pool first), and dropping it onto
        // another placed chip swaps the two, covering left/right and up/down rearrangement.
        chip.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', p.id); onDragStart && onDragStart(p.id); });
        chip.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); chip.classList.add('drop-hover'); });
        chip.addEventListener('dragleave', () => chip.classList.remove('drop-hover'));
        chip.addEventListener('drop', (e) => {
          e.preventDefault(); e.stopPropagation();
          chip.classList.remove('drop-hover');
          const draggedId = e.dataTransfer.getData('text/plain');
          if (draggedId && draggedId !== p.id) onSwap(draggedId, p.id);
        });
        container.appendChild(chip);
      });
      container.addEventListener('click', () => { if (selectedId) onRowClick(row); });
    });
  },

  // ---------- Battle UI (3-row formation, Ally=Left / Enemy=Right) ----------
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

    slot.innerHTML = `
      <div class="battle-slot-avatar"></div>
      <div class="battle-slot-info">
        <div class="battle-slot-name">${actor.name}</div>
        <div class="bar hp-bar"><div class="bar-fill" style="width:${hpPct}%"></div><span class="bar-label">${Math.max(0, Math.round(actor.hp))}/${actor.maxHp}</span></div>
        <div class="bar energy-bar"><div class="bar-fill" style="width:${energyPct}%"></div></div>
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
    ROWS_LOCAL.forEach(row => {
      const allyContainer = this.el(`battle-ally-${row}`);
      const enemyContainer = this.el(`battle-enemy-${row}`);
      if (allyContainer) allyContainer.innerHTML = '';
      if (enemyContainer) enemyContainer.innerHTML = '';
      const allyActors = allActors.filter(a => a.side === 'player' && a.position.row === row).sort((a, b) => a.position.column - b.position.column);
      const enemyActors = allActors.filter(a => a.side === 'enemy' && a.position.row === row).sort((a, b) => a.position.column - b.position.column);
      allyActors.forEach(actor => allyContainer && allyContainer.appendChild(this.buildBattleSlot(actor, opts)));
      enemyActors.forEach(actor => enemyContainer && enemyContainer.appendChild(this.buildBattleSlot(actor, opts)));
    });
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

  renderActionMenu(container, actions, onPick) {
    container.innerHTML = '';
    const labels = { basicAttack: 'Basic', skill1: 'Skill 1', skill2: 'Skill 2', ultimate: 'Ultimate', defend: 'Defend' };
    actions.forEach(a => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `action-btn action-${a.key}` + (!a.ready ? ' locked' : '');
      const cdText = (a.key === 'skill1' || a.key === 'skill2');
      btn.innerHTML = `
        <span class="action-btn-label">${labels[a.key]}</span>
        <span class="action-btn-sub">${a.def.name}</span>
        ${!a.ready ? `<span class="action-btn-lock">${a.key === 'ultimate' ? 'Need Energy' : 'On Cooldown'}</span>` : ''}
      `;
      btn.disabled = !a.ready;
      btn.addEventListener('click', () => onPick(a));
      container.appendChild(btn);
    });
    const itemBtn = document.createElement('button');
    itemBtn.type = 'button';
    itemBtn.className = 'action-btn action-item';
    itemBtn.innerHTML = `<span class="action-btn-label">Item</span><span class="action-btn-sub">Use consumable</span>`;
    itemBtn.addEventListener('click', () => onPick({ key: 'item', def: null, ready: true }));
    container.appendChild(itemBtn);
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
