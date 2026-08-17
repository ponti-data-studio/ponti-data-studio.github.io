# Adding Music, Skill Animations, and Sound Effects to Ponti Arena

Ponti Arena ships fully playable with **zero external audio/animation files** - music and every
sound effect are synthesized at runtime with the Web Audio API (`js/audio.js`), and every skill
uses lightweight CSS animations (screen shake, floating damage numbers, lunge, status icons).
Everything below is **optional** - the game never breaks or shows a broken asset if you skip it.

---

## 1. Adding Music (Menu + Battle)

The game currently generates a simple ambient loop in code (`AudioSystem.startMusic()`). To use
real music tracks instead:

1. Prepare two audio files:
   - `assets/audio/menu-theme.mp3` - plays on the Main Menu, Character Collection, Formation, etc.
   - `assets/audio/battle-theme.mp3` - plays during Battle.
2. Recommended format: **MP3** (widest browser support) or **OGG**. Keep files reasonably small
   (under ~3-4 MB) so the PWA offline cache and mobile data usage stay light. A loopable track
   30-90 seconds long works well.
3. Open `js/audio.js` and replace the body of `startMusic()`:

   ```js
   startMusic(track = 'menu-theme') {
     this.stopMusic();
     try {
       const el = new Audio(`assets/audio/${track}.mp3`);
       el.loop = true;
       el.volume = this._gain('musicVolume');
       el.play().catch(() => {}); // autoplay can be blocked until the user interacts once
       this.musicNodes = { element: el };
     } catch (err) {
       console.warn('[Audio] Music failed to load - continuing without it.', err);
     }
   },

   stopMusic() {
     if (this.musicNodes && this.musicNodes.element) {
       this.musicNodes.element.pause();
     }
     this.musicNodes = null;
   },
   ```

4. Switch tracks when entering/leaving Battle. In `js/app.js`:
   - In `launchBattle()`, call `AudioSystem.startMusic('battle-theme')`.
   - In `endBattle()` (or when returning to the Main Menu), call `AudioSystem.startMusic('menu-theme')`.
5. Add both files to the Service Worker's precache list in `service-worker.js` (`APP_SHELL` array)
   so they're available offline after the first load:

   ```js
   './assets/audio/menu-theme.mp3',
   './assets/audio/battle-theme.mp3',
   ```

6. If a file is missing, the `try/catch` above means the game **keeps playing silently** instead
   of crashing - never remove that guard.

---

## 2. Adding Per-Character Skill Animations

Every skill already gets a *generic* animation for free: attacker lunge, screen shake on hits,
floating damage/heal/evade numbers, and status icons (see `css/battle.css` and
`App.playEvents()` in `js/app.js`). To give a **specific character's specific skill** a custom
animation on top of that:

1. Decide what you want to trigger on: a character id (e.g. `'wizard'`) and/or a skill id (e.g.
   `'meteor'`) - both are available on every battle event (`event.actor`, and the skill id is on
   `battle.currentActor`'s chosen action, or you can match by the event's `text`/`type`).
2. Add a CSS animation in `css/battle.css`, for example a glow pulse for Wizard's Meteor:

   ```css
   @keyframes meteor-impact {
     0%   { box-shadow: 0 0 0 rgba(255,120,40,0); }
     30%  { box-shadow: 0 0 40px 12px rgba(255,120,40,0.8); }
     100% { box-shadow: 0 0 0 rgba(255,120,40,0); }
   }
   .battle-slot.fx-meteor-impact { animation: meteor-impact 0.6s ease; }
   ```

3. In `js/app.js`, inside `playEvents(events)`, add a check alongside the existing damage/heal/evade
   handling:

   ```js
   if (e.type === 'damage' && e.actor && App.battle) {
     const attacker = App.battle.getActor(e.actor);
     if (attacker && attacker.character.id === 'wizard') {
       const targetSlot = document.querySelector(`[data-actor-id="${e.target}"]`);
       if (targetSlot) {
         targetSlot.classList.remove('fx-meteor-impact');
         void targetSlot.offsetWidth; // restart the animation if it's already mid-play
         targetSlot.classList.add('fx-meteor-impact');
       }
     }
   }
   ```

4. If you'd rather use **sprite-sheet or Lottie-style animations** instead of CSS, load them the
   same way as character art (see the main `README.md`'s "Adding Character Images" section) and
   swap the `.char-avatar` content briefly during the animation, then restore it - always behind a
   `try/catch` and a safe fallback (e.g. just the existing CSS shake) so a missing animation asset
   never blocks the skill from resolving.

---

## 3. Adding Sound Effects Per Skill

By default every damage/heal/status/crit/death event plays one of a handful of *generic*
synthesized tones (see `AudioSystem.playAttack()`, `playSkill()`, `playHeal()`, etc. in
`js/audio.js`, wired up in `App.playEvents()`). To give an **individual skill** its own sound:

1. Prepare a short sound file (WAV/MP3/OGG, ideally under a few hundred KB) and place it at, for
   example, `assets/audio/skills/meteor.mp3`. Use the skill's `id` field from `characters.js` as
   the filename for consistency (e.g. Wizard's Meteor has `id: 'meteor'` → `meteor.mp3`).
2. Add a small player function to `js/audio.js`:

   ```js
   playSkillClip(skillId) {
     if (this.settings.muted) return;
     try {
       const el = new Audio(`assets/audio/skills/${skillId}.mp3`);
       el.volume = this._gain('sfxVolume');
       el.play().catch(() => {});
     } catch (err) { /* missing/failed clip is never fatal - just skip it */ }
   },
   ```

3. In `js/app.js`'s `playEvents(events)`, before (or instead of) the generic `AudioSystem.playSkill()`
   call, check for a per-skill override:

   ```js
   const SKILL_SFX = new Set(['meteor', 'headshot', 'dragon_form']); // add skill ids you have clips for
   // ... inside the damage/skill event handling:
   if (e.skillId && SKILL_SFX.has(e.skillId)) {
     AudioSystem.playSkillClip(e.skillId);
   } else {
     AudioSystem.playSkill(); // existing generic fallback
   }
   ```

   (If the event doesn't already carry a `skillId`, you can pass it through from
   `SkillSystem.resolve()` in `js/skills.js`, where every event is built - just add
   `skillId: skillDef.id` to the event objects you want to hook.)
4. Add every clip you use to `service-worker.js`'s `APP_SHELL` list so it's cached for offline play.
5. Missing clips must never break the game: always wrap `new Audio(...)` calls in the same
   `try/catch` + `.catch(() => {})` pattern shown above so a 404 or unsupported format is silently
   ignored and gameplay continues.

---

## General Rules for All Optional Assets

- **Never required.** The game must stay 100% playable with an empty `assets/audio/` folder,
  exactly like it stays playable with an empty `assets/characters/` folder.
- **Always wrapped in `try/catch`** (or `.catch()` on the returned Promise) - a missing or corrupt
  file must never throw, never block a turn, and never crash the app.
- **Add new files to `service-worker.js`'s `APP_SHELL` array** so offline mode keeps working after
  you add them - the precache logic already skips any URL that fails to fetch, so listing a file
  you haven't added yet is harmless too.
- **No paid/external CDN assets.** Everything must be a local file under `assets/` so the game
  stays installable and fully offline, consistent with the rest of the project.
