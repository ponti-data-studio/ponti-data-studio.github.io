/**
 * PONTI ARENA - App Controller
 * Owns navigation between screens and drives BattleEngine turn-by-turn,
 * translating engine events into UI calls. This is the only file that knows
 * about "what screen are we on" - battle.js and combat.js stay UI-agnostic.
 */

const App = {
  save: null,
  deferredInstallPrompt: null,

  // transient session state
  mode: null,               // 'quick' | 'practice' | 'campaign' | 'test'
  buildTeam: [],             // character ids being assembled in team builder
  buildFormation: [],        // [{id, row, column}] player's chosen formation for the current battle
  formationSelectedId: null, // pool chip currently selected, awaiting a row tap
  formationNextStep: null,   // callback invoked when the player confirms their formation
  difficulty: 'normal',
  arenaId: 'medieval-castle',
  campaignStageIndex: 0,
  battle: null,
  pendingItem: null,         // item id awaiting a target
  awaitingPlayerResolve: null, // resolves the player's turn promise
  battleBusy: false,
  battleRunToken: 0,
  selectedCharacterId: null,

  init() {
    this.save = Storage.load();
    AudioSystem.init(this.save.settings);
    this.applySettingsToForm();
    this.wireNav();
    this.wireOnboarding();
    this.wireTeamBuilder();
    this.wireFormationScreen();
    this.wireBattleScreen();
    this.wireSettings();
    this.wireResult();
    this.wirePWA();
    this.registerServiceWorker();

    document.body.addEventListener('click', () => AudioSystem.resume(), { once: true });

    if (!this.save.onboardingSeen) {
      UI.showScreen('screen-onboarding');
    } else {
      UI.showScreen('screen-main-menu');
    }
    AudioSystem.startMusic();
  },

  // ---------------------------------------------------------------- NAV ----
  wireNav() {
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        AudioSystem.playUIClick();
        this.navigate(btn.dataset.nav);
      });
    });
  },

  navigate(target) {
    if (target === 'main-menu') { UI.showScreen('screen-main-menu'); return; }
    if (target === 'quick-battle') { this.startModeSetup('quick'); return; }
    if (target === 'practice') { this.startModeSetup('practice'); return; }
    if (target === 'campaign') { this.openCampaign(); return; }
    if (target === 'characters') { this.openCharacterTest(); return; }
    if (target === 'achievements') { this.openAchievements(); return; }
    if (target === 'settings') { UI.showScreen('screen-settings'); return; }
  },

  // ------------------------------------------------------------ ONBOARD ----
  wireOnboarding() {
    UI.el('btn-start-tutorial').addEventListener('click', () => {
      this.save.onboardingSeen = true; Storage.save(this.save);
      this.mode = 'quick';
      this.buildTeam = ['knight', 'archer', 'wizard', 'assassin', 'cleric'];
      this.difficulty = 'easy';
      this.arenaId = 'medieval-castle';
      this.launchBattle(this.buildTeam, ['knight', 'archer', 'wizard', 'ranger', 'cleric']);
    });
    UI.el('btn-skip-tutorial').addEventListener('click', () => {
      this.save.onboardingSeen = true; Storage.save(this.save);
      UI.showScreen('screen-main-menu');
    });
  },

  // -------------------------------------------------------- MODE SETUP ----
  startModeSetup(mode) {
    this.mode = mode;
    this.buildTeam = [...(this.save.lastTeam || [])].filter(id => getCharacterById(id)).slice(0, 5);
    this.openTeamBuilder();
  },

  openCampaign() {
    const container = UI.el('campaign-stage-list');
    container.innerHTML = '';
    CAMPAIGN_STAGES.forEach((stage, i) => {
      const locked = i > this.save.campaignProgress;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'stage-card' + (locked ? ' locked' : '');
      card.innerHTML = `
        <div class="stage-number">Stage ${stage.stage}</div>
        <div class="stage-name">${stage.name}</div>
        <div class="stage-meta">Difficulty: ${stage.difficulty} &middot; Reward: ${stage.rewardXP} XP</div>
        ${locked ? '<div class="stage-lock">🔒 Locked</div>' : ''}
      `;
      if (!locked) {
        card.addEventListener('click', () => {
          AudioSystem.playUIClick();
          this.mode = 'campaign';
          this.campaignStageIndex = i;
          this.buildTeam = [...(this.save.lastTeam || [])].filter(id => getCharacterById(id)).slice(0, 5);
          this.difficulty = stage.difficulty;
          this.arenaId = stage.arena;
          this.openTeamBuilder(true);
        });
      }
      container.appendChild(card);
    });
    UI.showScreen('screen-campaign');
  },

  openAchievements() {
    const container = UI.el('achievements-list');
    container.innerHTML = '';
    ACHIEVEMENT_DEFS.forEach(a => {
      const unlocked = this.save.achievements.includes(a.id);
      const card = document.createElement('div');
      card.className = 'achievement-card' + (unlocked ? ' unlocked' : '');
      card.innerHTML = `<div class="ach-icon">${unlocked ? '🏆' : '🔒'}</div><div><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div></div>`;
      container.appendChild(card);
    });
    UI.showScreen('screen-achievements');
  },

  openCharacterTest() {
    this.mode = 'test';
    this.rosterClassFilter = null;
    this.renderRosterScreen();
    UI.showScreen('screen-roster');
  },

  renderRosterScreen() {
    UI.renderClassFilter(UI.el('roster-class-filter'), this.rosterClassFilter, (role) => {
      this.rosterClassFilter = role;
      this.renderRosterScreen();
    });
    const grid = UI.el('roster-grid');
    grid.innerHTML = '';
    const list = this.rosterClassFilter ? CHARACTERS.filter(c => c.role === this.rosterClassFilter) : CHARACTERS;
    list.forEach(c => {
      const mastery = this.save.mastery[c.id] || 0;
      const card = UI.buildCharacterCard(c, { mastery: Math.floor(mastery / 100) });
      card.addEventListener('click', () => {
        AudioSystem.playUIClick();
        this.showCharacterDetailModal(c, true);
      });
      grid.appendChild(card);
    });
  },

  showCharacterDetailModal(character, offerTest) {
    const modal = UI.el('char-detail-modal');
    const body = UI.el('char-detail-body');
    body.innerHTML = '';
    body.appendChild(UI.buildCharacterDetail(character));
    UI.el('btn-test-character').style.display = offerTest ? 'block' : 'none';
    UI.el('btn-test-character').onclick = () => {
      modal.classList.remove('open');
      this.launchBattle([character.id], [TRAINING_DUMMY.id], true);
    };
    modal.classList.add('open');
  },

  // ---------------------------------------------------------- TEAM UI ----
  wireTeamBuilder() {
    UI.el('char-detail-close').addEventListener('click', () => UI.el('char-detail-modal').classList.remove('open'));
    UI.el('btn-team-continue').addEventListener('click', () => {
      if (this.buildTeam.length < 5) { UI.toast('Select 5 characters to continue.', 'warn'); return; }
      this.save.lastTeam = [...this.buildTeam];
      Storage.save(this.save);
      if (this.mode === 'practice') {
        // Practice skips manual formation for speed - auto-arranged, vs a Training Squad.
        this.arenaId = 'medieval-castle';
        this.launchBattle(this.buildTeam, TargetingEngine.buildAutoFormation([TRAINING_DUMMY.id, TRAINING_DUMMY.id, TRAINING_DUMMY.id, TRAINING_DUMMY.id, TRAINING_DUMMY.id]));
        return;
      }
      if (this.mode === 'campaign') {
        this.openFormationScreen(() => {
          const stage = CAMPAIGN_STAGES[this.campaignStageIndex];
          this.arenaId = stage.arena;
          const strategy = AISystem.chooseFormationStrategy(stage.difficulty, this.buildFormation);
          const enemyFormation = TargetingEngine.buildFormationFromTemplate(stage.enemyTeam, strategy);
          this.launchBattle(this.buildFormation, enemyFormation);
        });
      } else {
        this.openFormationScreen(() => this.openDifficultySelect());
      }
    });
    UI.el('btn-team-back').addEventListener('click', () => {
      if (this.mode === 'campaign') UI.showScreen('screen-campaign');
      else UI.showScreen('screen-main-menu');
    });
  },

  openTeamBuilder(skipModeHeader) {
    this.builderClassFilter = null;
    const title = UI.el('team-builder-title');
    title.textContent = this.mode === 'campaign' ? `Campaign Team - Stage ${CAMPAIGN_STAGES[this.campaignStageIndex].stage}`
      : this.mode === 'practice' ? 'Practice Team' : 'Quick Battle Team';

    this.renderBuilderGrid();
    this.refreshTeamBuilder();
    UI.showScreen('screen-team-builder');
  },

  renderBuilderGrid() {
    UI.renderClassFilter(UI.el('builder-class-filter'), this.builderClassFilter, (role) => {
      this.builderClassFilter = role;
      this.renderBuilderGrid();
    });
    const grid = UI.el('builder-roster-grid');
    grid.innerHTML = '';
    const list = this.builderClassFilter ? CHARACTERS.filter(c => c.role === this.builderClassFilter) : CHARACTERS;
    list.forEach(c => {
      const card = UI.buildCharacterCard(c, { selected: this.buildTeam.includes(c.id) });
      card.addEventListener('click', () => {
        AudioSystem.playUIClick();
        const idx = this.buildTeam.indexOf(c.id);
        if (idx >= 0) {
          this.buildTeam.splice(idx, 1);
        } else {
          if (this.buildTeam.length >= 5) { UI.toast('Team is full (5/5). Remove a character first.', 'warn'); return; }
          if (this.buildTeam.includes(c.id)) { UI.toast('Character already in team.', 'warn'); return; }
          this.buildTeam.push(c.id);
        }
        this.refreshTeamBuilder();
      });
      grid.appendChild(card);
    });
  },

  refreshTeamBuilder() {
    document.querySelectorAll('#builder-roster-grid .char-card').forEach(card => {
      card.classList.toggle('selected', this.buildTeam.includes(card.dataset.characterId));
    });
    UI.renderTeamSlots(UI.el('team-preview-slots'), this.buildTeam, (i) => {
      this.buildTeam.splice(i, 1);
      this.refreshTeamBuilder();
    });
    const warnBox = UI.el('team-warnings');
    const warnings = UI.teamWarnings(this.buildTeam);
    warnBox.innerHTML = warnings.map(w => `<div class="team-warning">⚠ ${w}</div>`).join('');
    UI.el('btn-team-continue').disabled = this.buildTeam.length < 5;
    UI.el('team-count').textContent = `${this.buildTeam.length}/5`;
  },

  // ------------------------------------------------------ FORMATION EDITOR ----
  wireFormationScreen() {
    UI.el('btn-formation-back').addEventListener('click', () => UI.showScreen('screen-team-builder'));
    UI.el('btn-auto-arrange').addEventListener('click', () => {
      AudioSystem.playUIClick();
      this.buildFormation = TargetingEngine.buildAutoFormation(this.buildTeam);
      this.formationSelectedId = null;
      this.refreshFormationEditor();
    });
    UI.el('btn-formation-continue').addEventListener('click', () => {
      if (this.buildFormation.length < this.buildTeam.length) { UI.toast('Place all 5 characters into a row first.', 'warn'); return; }
      AudioSystem.playUIClick();
      const next = this.formationNextStep;
      this.formationNextStep = null;
      if (next) next();
    });
  },

  openFormationScreen(nextStep) {
    this.formationNextStep = nextStep;
    this.formationSelectedId = null;
    // Default to a sensible auto-arranged formation; the player can freely rearrange from there.
    this.buildFormation = TargetingEngine.buildAutoFormation(this.buildTeam);
    this.refreshFormationEditor();
    UI.showScreen('screen-formation');
  },

  refreshFormationEditor() {
    const poolIds = this.buildTeam.filter(id => !this.buildFormation.some(p => p.id === id));
    UI.renderFormationEditor(this.buildFormation, poolIds, {
      selectedId: this.formationSelectedId,
      onChipClick: (id, row) => {
        AudioSystem.playUIClick();
        if (this.formationSelectedId === id) {
          // Tapping the already-selected chip again: if it's placed, treat it as "remove";
          // if it's still in the pool, just deselect.
          if (row) this.buildFormation = this.buildFormation.filter(p => p.id !== id);
          this.formationSelectedId = null;
        } else if (this.formationSelectedId) {
          // Something else is already selected and we tapped a different chip.
          if (row) {
            // Target is already placed - swap the two directly, no need to unplace first.
            this.swapFormationSlots(this.formationSelectedId, id);
            return; // swapFormationSlots already refreshes and clears the selection
          }
          // Target is still in the pool - just move the selection to it instead.
          this.formationSelectedId = id;
        } else {
          // Nothing selected yet - select this chip (whether from the pool or already placed).
          this.formationSelectedId = id;
        }
        this.refreshFormationEditor();
      },
      onRowClick: (row) => {
        if (!this.formationSelectedId) return;
        this.placeInRow(this.formationSelectedId, row);
      },
      onRowDrop: (id, row) => this.placeInRow(id, row),
      onSwap: (draggedId, targetId) => this.swapFormationSlots(draggedId, targetId),
    });
    UI.el('btn-formation-continue').disabled = this.buildFormation.length < this.buildTeam.length;
  },

  /** Dropping one chip directly onto another: swaps their row+column if both are placed, or
   *  "replaces" the target with a pool character (the target goes back to the pool) otherwise. */
  swapFormationSlots(draggedId, targetId) {
    AudioSystem.playUIClick();
    const draggedEntry = this.buildFormation.find(p => p.id === draggedId);
    const targetEntry = this.buildFormation.find(p => p.id === targetId);
    if (!targetEntry) return;
    if (draggedEntry) {
      const tmpRow = draggedEntry.row, tmpCol = draggedEntry.column;
      draggedEntry.row = targetEntry.row; draggedEntry.column = targetEntry.column;
      targetEntry.row = tmpRow; targetEntry.column = tmpCol;
    } else {
      // Dragged from the pool: the target's slot is taken over, target returns to the pool.
      const { row, column } = targetEntry;
      this.buildFormation = this.buildFormation.filter(p => p.id !== targetId);
      this.buildFormation.push({ id: draggedId, row, column });
    }
    this.formationSelectedId = null;
    this.refreshFormationEditor();
  },

  placeInRow(id, row) {
    AudioSystem.playUIClick();
    this.buildFormation = this.buildFormation.filter(p => p.id !== id);
    const column = this.buildFormation.filter(p => p.row === row).length;
    this.buildFormation.push({ id, row, column });
    this.formationSelectedId = null;
    this.refreshFormationEditor();
  },

  /** Moves an already-placed character directly to the row above (-1) or below (+1) - Back<->Middle<->Front -
   *  without needing to unplace it back to the pool first. Appended at the end of the target row. */
  moveCharacterRow(id, delta) {
    const ROW_ORDER = ['front', 'middle', 'back'];
    const entry = this.buildFormation.find(p => p.id === id);
    if (!entry) return;
    const currentIndex = ROW_ORDER.indexOf(entry.row);
    const newIndex = currentIndex + delta;
    if (newIndex < 0 || newIndex >= ROW_ORDER.length) return; // already at the boundary
    AudioSystem.playUIClick();
    const newRow = ROW_ORDER[newIndex];
    this.buildFormation = this.buildFormation.filter(p => p.id !== id);
    const column = this.buildFormation.filter(p => p.row === newRow).length;
    this.buildFormation.push({ id, row: newRow, column });
    this.refreshFormationEditor();
  },

  /** Swaps an already-placed character with its left (-1) or right (+1) neighbor within the same row. */
  moveCharacterColumn(id, delta) {
    const entry = this.buildFormation.find(p => p.id === id);
    if (!entry) return;
    const rowMembers = this.buildFormation.filter(p => p.row === entry.row).sort((a, b) => a.column - b.column);
    const index = rowMembers.findIndex(p => p.id === id);
    const swapIndex = index + delta;
    if (swapIndex < 0 || swapIndex >= rowMembers.length) return; // already at the edge of the row
    AudioSystem.playUIClick();
    const neighbor = rowMembers[swapIndex];
    const tmpColumn = entry.column;
    entry.column = neighbor.column;
    neighbor.column = tmpColumn;
    this.refreshFormationEditor();
  },

  openDifficultySelect() {
    UI.showScreen('screen-difficulty');
    document.querySelectorAll('.difficulty-card').forEach(card => {
      card.onclick = () => {
        AudioSystem.playUIClick();
        this.difficulty = card.dataset.difficulty;
        this.openArenaSelect();
      };
    });
  },

  openArenaSelect() {
    const grid = UI.el('arena-grid');
    grid.innerHTML = '';
    ARENAS.forEach(arena => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'arena-card';
      card.style.background = `linear-gradient(160deg, ${arena.gradient[0]}, ${arena.gradient[1]})`;
      card.innerHTML = `<span>${arena.name}</span>`;
      card.addEventListener('click', () => {
        AudioSystem.playUIClick();
        this.arenaId = arena.id;
        const pool = CHARACTERS.map(c => c.id).filter(id => !this.buildTeam.includes(id));
        // Master AI doesn't pick its team at random - it drafts the strongest available combination.
        const enemyTeam = this.difficulty === 'master'
          ? AISystem.draftPowerfulTeam(pool)
          : pool.sort(() => Math.random() - 0.5).slice(0, 5);
        const strategy = AISystem.chooseFormationStrategy(this.difficulty, this.buildFormation);
        const enemyFormation = TargetingEngine.buildFormationFromTemplate(enemyTeam, strategy);
        this.launchBattle(this.buildFormation, enemyFormation);
      });
      grid.appendChild(card);
    });
    UI.showScreen('screen-arena');
  },

  // ------------------------------------------------------------ BATTLE ----
  launchBattle(playerIds, enemyIds, isCharacterTest) {
    this.battle = new BattleEngine(playerIds, enemyIds, isCharacterTest ? 'normal' : this.difficulty, this.arenaId);
    this.battle.isCharacterTest = !!isCharacterTest;
    const arena = ARENAS.find(a => a.id === this.arenaId) || ARENAS[0];
    UI.el('battle-arena').style.background = `linear-gradient(160deg, ${arena.gradient[0]}, ${arena.gradient[1]})`;
    UI.el('battle-log').innerHTML = '';
    UI.el('difficulty-badge').textContent = isCharacterTest ? 'Character Test' : this.difficulty.toUpperCase();
    UI.showScreen('screen-battle');
    this.battleRunToken += 1;
    this.runBattleLoop(this.battleRunToken);
  },

  wireBattleScreen() {
    UI.el('btn-forfeit').addEventListener('click', () => {
      if (confirm('Forfeit this battle and return to the main menu?')) {
        this.battleRunToken += 1; // invalidate current loop
        UI.showScreen('screen-main-menu');
      }
    });
  },

  delay(ms) { return new Promise(res => setTimeout(res, ms)); },

  async runBattleLoop(token) {
    const battle = this.battle;
    while (battle.status === 'active') {
      if (token !== this.battleRunToken) return; // battle was abandoned
      const begin = battle.beginTurn();
      if (token !== this.battleRunToken) return;
      await this.playEvents(begin.events);
      this.renderBattleFrame(null);
      if (begin.result) { this.endBattle(begin.result); return; }
      if (!begin.actor) { await this.delay(200); continue; }

      if (begin.skipped) { await this.delay(500); continue; }

      if (begin.actor.side === 'enemy') {
        this.renderBattleFrame(begin.actor.id);
        await this.delay(650);
        if (token !== this.battleRunToken) return;
        const res = battle.runEnemyTurn();
        await this.playEvents(res.events);
        this.renderBattleFrame(null);
        if (res.result) { this.endBattle(res.result); return; }
      } else {
        await this.playerTurn(begin.actor);
        if (token !== this.battleRunToken) return;
        if (battle.status !== 'active') { this.endBattle(battle.status); return; }
      }
    }
  },

  playerTurn(actor) {
    return new Promise(resolve => {
      this.pendingItem = null;
      this.renderBattleFrame(actor.id);
      const actions = this.battle.getUsableActions(actor.id);
      UI.renderActionMenu(UI.el('action-menu'), actions, (action) => this.onActionPicked(action, resolve));
      UI.el('action-menu-hint').textContent = `${actor.name}'s turn - choose an action.`;
    });
  },

  onActionPicked(action, resolveTurn) {
    AudioSystem.playUIClick();
    const actor = this.battle.currentActor;
    if (action.key === 'item') { this.openItemPicker(resolveTurn); return; }
    if (action.key === 'defend') { this.finishPlayerAction('defend', null, resolveTurn); return; }

    const targetType = action.def.targetType;
    if (['self', 'all_enemy', 'all_ally', 'front_row', 'middle_row', 'back_row'].includes(targetType)) {
      this.finishPlayerAction(action.key, actor.id, resolveTurn);
      return;
    }
    // Row-restricted single-target skill (single_enemy/single_front/middle/back/any_enemy/single_ally/adjacent_enemies)
    const legalTargets = TargetingEngine.getSelectableTargets(action.def, actor.side, this.battle.actors);
    if (legalTargets.length === 0) {
      UI.toast(`No valid target for ${action.def.name} right now.`, 'warn');
      const actions = this.battle.getUsableActions(actor.id);
      UI.renderActionMenu(UI.el('action-menu'), actions, (a2) => this.onActionPicked(a2, resolveTurn));
      return;
    }
    const targetSide = targetType === 'single_ally' ? 'player' : 'enemy';
    UI.el('action-menu-hint').textContent = `Select a target for ${action.def.name}.`;
    this.enterTargetingMode(targetSide, (targetId) => this.finishPlayerAction(action.key, targetId, resolveTurn), action.def);
  },

  openItemPicker(resolveTurn) {
    // Items are self-applied to the acting character (keeps targeting simple and unambiguous).
    const modal = UI.el('item-modal');
    const list = UI.el('item-list');
    list.innerHTML = '';
    Object.values(ITEM_DEFS).forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'item-option';
      btn.disabled = this.battle.itemsRemaining <= 0;
      btn.innerHTML = `<b>${item.name}</b><span>${item.desc}</span>`;
      btn.addEventListener('click', () => {
        modal.classList.remove('open');
        this.finishPlayerAction('item', item.id, resolveTurn);
      });
      list.appendChild(btn);
    });
    UI.el('item-remaining').textContent = `Items remaining this battle: ${this.battle.itemsRemaining}`;
    modal.classList.add('open');
    UI.el('item-modal-close').onclick = () => { modal.classList.remove('open'); resolveTurn ? null : null; };
  },

  enterTargetingMode(side, onPick, skillDef) {
    // Determine the legal target set from the targeting engine (row priority / backline rules)
    // so the UI can highlight valid targets and dim invalid ones rather than allowing anything.
    const targetableIds = new Set(
      TargetingEngine.getSelectableTargets(skillDef, this.battle.currentActor.side, this.battle.actors).map(a => a.id)
    );
    UI.renderFormation(this.battle.actors, {
      activeId: this.battle.currentActor.id,
      targetableIds,
      onSelectTarget: (id) => {
        this.exitTargetingMode();
        onPick(id);
      },
    });
  },

  exitTargetingMode() {
    this.renderBattleFrame(this.battle.currentActor ? this.battle.currentActor.id : null);
  },

  finishPlayerAction(actionKey, targetId, resolveTurn) {
    // For actionKey === 'item', targetId carries the chosen item id (see openItemPicker).
    UI.el('action-menu').innerHTML = '';
    UI.el('action-menu-hint').textContent = '';
    (async () => {
      const result = this.battle.submitPlayerAction(actionKey, targetId);
      if (actionKey === 'ultimate') { this.save.ultimatesUsed = (this.save.ultimatesUsed || 0) + 1; }
      await this.playEvents(result.events);
      this.renderBattleFrame(null);
      resolveTurn();
    })();
  },

  async playEvents(events) {
    for (const e of events) {
      if (!e) continue;
      if (e.type === 'damage') {
        AudioSystem.playAttack(); if (e.isCrit) AudioSystem.playCritical(); if (this.save.settings.screenShake) UI.shakeScreen(true);
        this.lungeActor(e.actor);
      }
      if (e.type === 'heal' || e.type === 'hot') AudioSystem.playHeal();
      if (e.type === 'evade') AudioSystem.playUIClick();
      if (e.type === 'status' || e.type === 'debuff' || e.type === 'buff') AudioSystem.playStatus();
      if (e.type === 'death') AudioSystem.playDeath();
      if (e.text) UI.appendBattleLog(UI.el('battle-log'), e.text, e.type);
      if (e.type === 'damage' || e.type === 'heal') {
        const hostSlot = document.querySelector(`[data-actor-id="${e.target}"] .battle-slot-info`);
        if (hostSlot && this.save.settings.damageNumbers) {
          UI.floatText(hostSlot, e.type === 'damage' ? `-${e.amount}${e.isCrit ? '!' : ''}` : `+${e.amount}`, e.type === 'damage' ? 'dmg' : 'heal');
        }
      }
      if (e.type === 'evade') {
        const hostSlot = document.querySelector(`[data-actor-id="${e.target}"] .battle-slot-info`);
        if (hostSlot) UI.floatText(hostSlot, 'EVADE', 'evade');
      }
      this.quickRenderBars();
      await this.delay(this.save.settings.battleAnimation ? 420 : 60);
    }
  },

  /** Brief directional nudge toward the battlefield center - Ally lunges right, Enemy lunges left (#179). */
  lungeActor(actorId) {
    if (!this.save.settings.battleAnimation || !actorId) return;
    const actor = this.battle && this.battle.getActor(actorId);
    if (!actor) return;
    const slot = document.querySelector(`[data-actor-id="${actorId}"]`);
    if (!slot) return;
    const cls = actor.side === 'player' ? 'lunge-right' : 'lunge-left';
    slot.classList.remove('lunge-right', 'lunge-left');
    void slot.offsetWidth;
    slot.classList.add(cls);
  },

  quickRenderBars() {
    if (!this.battle) return;
    this.battle.actors.forEach(actor => {
      const slot = document.querySelector(`[data-actor-id="${actor.id}"]`);
      if (!slot) return;
      const hpFill = slot.querySelector('.hp-bar .bar-fill');
      const hpLabel = slot.querySelector('.hp-bar .bar-label');
      const enFill = slot.querySelector('.energy-bar .bar-fill');
      if (hpFill) hpFill.style.width = `${Math.max(0, Math.round((actor.hp / actor.maxHp) * 100))}%`;
      if (hpLabel) hpLabel.textContent = `${Math.max(0, Math.round(actor.hp))}/${actor.maxHp}`;
      if (enFill) enFill.style.width = `${Math.round(actor.energy)}%`;
      if (actor.isDead) slot.classList.add('dead');
    });
  },

  renderBattleFrame(activeId) {
    if (!this.battle) return;
    UI.renderFormation(this.battle.actors, { activeId });
    UI.renderTimeline(UI.el('turn-timeline'), this.battle.getTimelinePreview(6), activeId);
  },

  endBattle(result) {
    AudioSystem.stopMusic();
    const battle = this.battle;
    const victory = result === 'victory';
    this.save.totalBattles += 1;
    if (victory) this.save.wins += 1; else this.save.losses += 1;
    this.save.ultimatesUsed = this.save.ultimatesUsed || 0;

    // Mastery: +25 per battle for every player character used, regardless of outcome
    battle.actors.filter(a => a.side === 'player').forEach(a => {
      const cid = a.character.id;
      this.save.mastery[cid] = (this.save.mastery[cid] || 0) + (victory ? 25 : 12);
    });

    let xpGain = victory ? 60 : 20;
    if (this.mode === 'campaign' && victory) {
      const stage = CAMPAIGN_STAGES[this.campaignStageIndex];
      xpGain += stage.rewardXP;
      if (this.campaignStageIndex === this.save.campaignProgress) {
        this.save.campaignProgress = Math.min(CAMPAIGN_STAGES.length, this.campaignStageIndex + 1);
      }
      if (this.campaignStageIndex === CAMPAIGN_STAGES.length - 1) this.unlockAchievement('defeat_boss');
    }
    this.save.xp += xpGain;
    while (this.save.xp >= this.save.level * 150) { this.save.xp -= this.save.level * 150; this.save.level += 1; }

    if (victory && this.save.wins === 1) this.unlockAchievement('first_victory');
    if (victory && this.save.wins === 10) this.unlockAchievement('ten_victories');
    if (victory && this.save.wins === 50) this.unlockAchievement('fifty_victories');
    if (victory && battle.actors.filter(a => a.side === 'player' && a.isDead).length === 0) {
      this.unlockAchievement('perfect_victory'); this.unlockAchievement('no_losses');
    }
    if ((this.save.mastery['knight'] || 0) >= 1000) this.unlockAchievement('master_knight');
    if ((this.save.mastery['wizard'] || 0) >= 1000) this.unlockAchievement('master_wizard');
    if (this.save.ultimatesUsed >= 10) this.unlockAchievement('ten_ultimates');

    Storage.save(this.save);
    AudioSystem[victory ? 'playVictory' : 'playDefeat']();

    UI.el('result-title').textContent = victory ? 'VICTORY' : 'DEFEAT';
    UI.el('result-title').className = victory ? 'victory' : 'defeat';
    UI.el('result-stats').innerHTML = `
      <div><span>Damage Dealt</span><b>${battle.stats.damageDealt}</b></div>
      <div><span>Damage Received</span><b>${battle.stats.damageReceived}</b></div>
      <div><span>Healing Done</span><b>${battle.stats.healing}</b></div>
      <div><span>Critical Hits</span><b>${battle.stats.criticals}</b></div>
      <div><span>Skills Used</span><b>${battle.stats.skillsUsed}</b></div>
      <div><span>Turns Taken</span><b>${battle.stats.turns}</b></div>
      <div><span>XP Gained</span><b>+${xpGain}</b></div>
    `;
    UI.showScreen('screen-result');
  },

  wireResult() {
    UI.el('btn-rematch').addEventListener('click', () => {
      const playerFormation = this.battle.actors.filter(a => a.side === 'player').map(a => ({ id: a.character.id, row: a.position.row, column: a.position.column }));
      const enemyFormation = this.battle.actors.filter(a => a.side === 'enemy').map(a => ({ id: a.character.id, row: a.position.row, column: a.position.column }));
      this.launchBattle(playerFormation, enemyFormation, this.battle.isCharacterTest);
    });
    UI.el('btn-change-team').addEventListener('click', () => {
      if (this.mode === 'campaign') this.openCampaign();
      else this.openTeamBuilder();
    });
    UI.el('btn-result-menu').addEventListener('click', () => UI.showScreen('screen-main-menu'));
  },

  unlockAchievement(id) {
    if (!this.save.achievements.includes(id)) {
      this.save.achievements.push(id);
      UI.toast(`Achievement unlocked: ${ACHIEVEMENT_DEFS.find(a => a.id === id).name}`, 'success');
    }
  },

  // ---------------------------------------------------------- SETTINGS ----
  applySettingsToForm() {
    const s = this.save.settings;
    UI.el('setting-master').value = s.masterVolume;
    UI.el('setting-music').value = s.musicVolume;
    UI.el('setting-sfx').value = s.sfxVolume;
    UI.el('setting-mute').checked = s.muted;
    UI.el('setting-graphics').value = s.graphics;
    UI.el('setting-damage-numbers').checked = s.damageNumbers;
    UI.el('setting-animation').checked = s.battleAnimation;
    UI.el('setting-shake').checked = s.screenShake;
    UI.el('setting-reduced-motion').checked = s.reducedMotion;
    UI.el('setting-ai-debug').checked = s.aiDebug;
    AISystem.debugEnabled = !!s.aiDebug;
    document.body.classList.toggle('reduced-motion', s.reducedMotion);
  },

  wireSettings() {
    const ids = ['setting-master', 'setting-music', 'setting-sfx', 'setting-mute', 'setting-graphics',
      'setting-damage-numbers', 'setting-animation', 'setting-shake', 'setting-reduced-motion', 'setting-ai-debug'];
    ids.forEach(id => {
      UI.el(id).addEventListener('input', () => this.saveSettingsFromForm());
      UI.el(id).addEventListener('change', () => this.saveSettingsFromForm());
    });
    UI.el('btn-reset-progress').addEventListener('click', () => {
      if (confirm('This will erase all progress, mastery and achievements. Continue?')) {
        this.save = Storage.reset();
        this.applySettingsToForm();
        UI.toast('Progress reset.', 'info');
      }
    });
  },

  saveSettingsFromForm() {
    const s = this.save.settings;
    s.masterVolume = Number(UI.el('setting-master').value);
    s.musicVolume = Number(UI.el('setting-music').value);
    s.sfxVolume = Number(UI.el('setting-sfx').value);
    s.muted = UI.el('setting-mute').checked;
    s.graphics = UI.el('setting-graphics').value;
    s.damageNumbers = UI.el('setting-damage-numbers').checked;
    s.battleAnimation = UI.el('setting-animation').checked;
    s.screenShake = UI.el('setting-shake').checked;
    s.reducedMotion = UI.el('setting-reduced-motion').checked;
    s.aiDebug = UI.el('setting-ai-debug').checked;
    AISystem.debugEnabled = !!s.aiDebug;
    document.body.classList.toggle('reduced-motion', s.reducedMotion);
    AudioSystem.updateSettings(s);
    Storage.save(this.save);
  },

  // --------------------------------------------------------------- PWA ----
  wirePWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      UI.el('btn-install').style.display = 'inline-flex';
    });
    UI.el('btn-install').addEventListener('click', async () => {
      if (this.deferredInstallPrompt) {
        this.deferredInstallPrompt.prompt();
        await this.deferredInstallPrompt.userChoice;
        this.deferredInstallPrompt = null;
        UI.el('btn-install').style.display = 'none';
      } else {
        UI.el('install-help-modal').classList.add('open');
      }
    });
    UI.el('install-help-close').addEventListener('click', () => UI.el('install-help-modal').classList.remove('open'));
    window.addEventListener('appinstalled', () => { UI.el('btn-install').style.display = 'none'; });
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      UI.el('btn-install').style.display = 'none';
    }
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(err => {
          console.warn('[PWA] Service worker registration failed (game still playable):', err);
        });
      });
    }
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
