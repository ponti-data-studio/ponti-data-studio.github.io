# Ponti Arena

A fair, offline-playable, installable **5v5 turn-based strategy RPG** for the browser.
No pay-to-win, no ads, no accounts, no backend. Strategy beats grinding.

**Made by Ponti Data ID**

## Features

- Turn-Based Strategy RPG — Speed-based turn order, manual targeting, cooldowns, Energy/Ultimate system
- **3-row tactical formations** — freely place your 5 characters into Front / Middle / Back; position is an optional strategic advantage, never a mandatory class restriction
- 5v5 Battles with **50** fully data-driven characters, each with a distinct kit (not just re-skinned numbers)
- AI opponents with 4 real difficulty levels (Easy / Normal / Hard / Extreme) — no stat cheating, ever — and 3 formation strategies (Balanced / Aggressive / Ranged) that Extreme AI picks to counter your own formation
- Fully offline after first load, installable as a PWA on Android, iOS, Windows, macOS, and Linux
- Fully responsive to **both Portrait and Landscape** on smartphones - the battle arena re-flows between a left/right layout (landscape) and a stacked top/bottom layout (portrait), always fitting on one screen with zero scrolling
- Character Mastery, Campaign (5 stages), Achievements, and Quick Battle / Practice / Character Test modes
- No Shop, no ads, no premium currency, no loot boxes — see "Fair by Design" below

## The Extended Roster (21-30)

Ten additional characters with genuinely unique mechanics - not just re-skinned damage numbers.
Their custom logic lives in `js/character-mechanics.js` so it never bleeds into the core battle
engine (see "Data-Driven Implementation" below).

| Character | Role | Signature Mechanic |
|---|---|---|
| Paladin | Tank | Automatically protects the lowest-HP ally each turn, redirecting a capped share of damage to himself; his Ultimate can prevent one lethal hit. |
| Samurai | Fighter | Counters attackers if struck while Defending, in his Iaido stance, or after a successful Parry. |
| Vampire | Assassin | Converts a capped share of every hit into HP (Blood Feast). |
| Chronomancer | Support | Manipulates the turn-order gauge directly - speeds up an ally, slows an enemy, and her Ultimate restores an ally to an earlier HP/Energy snapshot. |
| Illusionist | Mage | Personal evasion chance, a Decoy that fully blocks two hits, and a Confusion debuff that can make an enemy mis-target. |
| Alchemist | Support | Generates random Reagents over time and consumes them for stronger Heals/Poisons; her Ultimate combines whatever she has on hand. |
| Duelist | Assassin | Gains stacking bonus damage (up to 3x) against the same target - resets if she switches targets. |
| Pirate Captain | Ranged | Marks a target as Wanted for bonus damage, and can knock enemies back a row with Explosive Barrel. |
| Spirit Shaman | Mage | Casts one of two mutually-exclusive team-wide Totem auras (only one active at a time). |
| Gravity Mage | Mage | Physically pulls enemies between Front/Middle/Back rows, including a multi-target pull on her Ultimate. |

All ten fully support 3-row formation, targeting, Advanced AI (Expert/Master score-aware of their
mechanics - e.g. Chronomancer and active Totems get bonus Threat), Character Mastery, and the
image-fallback asset system exactly like the original 20.

## The Extended Roster II (31-40)

A second wave of ten characters, each answering a different question: "why would I pick this one?"
Just like the 21-30 batch, all custom logic is isolated in `js/character-mechanics.js` and never
touches the core battle engine.

| Character | Role | Signature Mechanic |
|---|---|---|
| Monk | Fighter | Builds Ki (max 100) from landing hits; Palm Burst spends it for a harder strike, and Sevenfold Strike unleashes bonus hits scaled by current Ki. |
| Demon Hunter | Assassin | Applies Hunter's Mark for bonus damage, can snipe past the Front Row with Piercing Shot, and her Ultimate executes low-HP targets. |
| Engineer | Ranged | Deploys a Turret with its own durability pool that auto-fires each turn and absorbs incoming damage like a shield until destroyed or expired. |
| Fencer | Fighter | Gains stacking Footwork (up to 3) from attacking or dodging, each stack adding Evasion; Riposte punishes anyone who strikes her while it's active. |
| Oracle | Support | Buffs an ally's next turn, seals an enemy's next hit to be weaker, and her Ultimate wards an ally against one lethal blow. |
| Bard | Support | Switches between Battle Song (team Attack Up) and War Drum (team Speed/Energy) stances; her Ultimate's effect depends on which is active - or plays a team-wide Lullaby debuff on enemies if neither is. |
| Gladiator | Tank | Builds Rage from dealing and taking damage, can Taunt the enemy Front Row (AI is mechanically forced to consider attacking him back), and spends Rage for a scaling damage-reduction Ultimate. |
| Frost Knight | Tank | Gains a stacking Ice Armor Defense buff whenever he's hit; breaking his Ice Wall shield Slows the attacker, and Frost Bind escalates an already-Slowed target into a brief Freeze. |
| Plague Doctor | Mage | Poisons/Diseases targets that can spread to nearby enemies (rate-limited so it can never chain infinitely), and his Ultimate stacks DoT with Healing Reduction and Attack Down. |
| Void Walker | Assassin | Blinks between rows and strikes the Back Row directly; every teleport grants a ward that blocks the next incoming hit. |

## The Extended Roster III (41-50)

A third wave of ten characters rounding out the roster at 50. Same rule as always: every new
mechanic lives in `js/character-mechanics.js`, isolated from the core battle engine.

| Character | Role | Signature Mechanic |
|---|---|---|
| Dragon Knight | Tank | Builds a Dragon Gauge from combat, then his Ultimate transforms him into Dragon Form (boosted Attack/Defense) for an extended duration - the Gauge is spent immediately on activation so he can't transform back-to-back. |
| Shadow Priest | Support | Pays part of her Heal and team-buff Ultimate's cost with her own HP (hard-floored at 1 - she can never kill herself with it), and gets noticeably stronger the more danger she's personally in. |
| Sniper | Ranged | Deals more damage the further back both she and her target are; her Aim stance consumes itself for a huge damage/crit boost on the next shot, and Piercing Bullet snipes the Back Row directly. |
| Berserker Lord | Fighter | A dedicated Rage resource (distinct from the original Berserker's HP-based scaling) that fuels an HP-sacrificing Rage burst and a Rage-spending finisher. |
| Rune Master | Mage | Inscribes up to 3 Runes (Fire/Guard/Wind) in rotation and fuses them via fixed recipes for bonus effects; her Ultimate reads whatever Runes are active, then clears them. |
| Witch | Mage | Hexes enemies with a fairly-randomized debuff that gets stronger against already-debuffed targets, and can rip a debuff off an ally and hurl it onto an enemy instead. |
| Battle Medic | Support | A combat healer who heals more if she attacked on her previous turn, with bonus effectiveness on critically low-HP allies. |
| Beast Rider | Fighter | Gains a Speed bonus while Mounted; Dismount is a one-way trade of that mobility for a lasting Defense boost. |
| Mirror Knight | Tank | Reflects a capped share of direct-attack damage back at attackers - reflected damage is flagged so it can never itself trigger another reflection, guaranteeing no infinite loop. |
| Soul Reaper | Assassin | Gains a Soul (capped at 5) whenever any enemy falls, snowballing his Basic Attack's damage as the fight goes on. |

## Advanced AI

Every AI tier uses the exact same character stats, cooldowns, and Energy rules as the player —
difficulty comes entirely from decision quality, never from hidden bonuses (see `combat.js` /
`ai.js` / `ai-scoring.js`, all of which only read data a player could also see).

- **Easy / Normal / Hard** — heuristic decision trees: role awareness, HP-based heal priority,
  status/backline-aware target priority (see `js/ai.js`).
- **Expert / Master** — a full Action Scoring Pipeline (`js/ai-scoring.js`): every legal
  (action, target) combination is scored using Target Threat (Attack/Speed/role/Ultimate-readiness,
  plus a turn-order lookahead bonus for targets about to act), Kill Confirmation, Overkill Avoidance,
  simple Combo Detection (bonus for finishing off crowd-controlled targets), and per-role weighting
  (Assassins value kills/threat more, Tanks value protection more, Mages get an AoE bonus, Supports
  weight survival highest). Ultimates are penalized when they'd be wasted on a marginal single hit
  and rewarded when they secure a kill or hit multiple targets.
- **Master** additionally applies a simple Risk Assessment pass: if the AI is critically low on HP
  and its best-scoring action doesn't secure a kill, it compares against Defending and may choose to
  play safe instead.
- **Master also drafts its own team.** In Quick Battle, every other difficulty picks its 5 enemies
  at random from whatever characters you didn't take. Master instead runs a transparent power draft
  (`AISystem.draftPowerfulTeam` in `js/ai.js`): it scores every remaining character on raw stats plus
  a bonus for high-impact kit traits (AoE Ultimates, backline access, built-in sustain, row synergy),
  guarantees at least one frontline anchor (Tank) and one Support for survivability, then
  fills the rest with whatever scores highest overall - so Master's opponents are a genuinely strong,
  not-random lineup rather than a coin-flip team. (Campaign enemy teams are unaffected - those stay
  hand-designed per stage regardless of difficulty.)
- Both tiers use **controlled randomness** (Expert picks its 2nd-best option ~10% of the time,
  Master ~5%) so they never feel like a perfectly identical script every battle.
- Enable **Settings → AI Decision Log (Developer)** to see each Expert/Master decision (target,
  action, and score breakdown) printed into the Battle Log and browser console — useful for tuning,
  off by default so it never leaks to normal players.

## The 6 Official Classes

Every character belongs to **exactly one** of six official classes - never a hybrid label like
"Fighter/Tank". A character's secondary gameplay flavor (e.g. Battle Medic being a *combat*
healer, or Shadow Priest being a *sacrifice* support) shows up in their description and kit, not
in their class.

| Class | Icon | Archetype | Weakness |
|---|---|---|---|
| **Tank** 🛡️ | Shield | Frontline defender - highest HP, highest total Defense, protection/shield/taunt | Lower damage, lower Speed, low Evasion |
| **Fighter** ⚔️ | Sword | Close-range all-rounder, between Tank and Assassin in both survivability and burst | No standout Defense or burst - a generalist |
| **Assassin** 🗡️ | Dagger | High-priority-target killer - burst, Speed, Evasion, execute, some backline access | Low HP/Defense, punished hard if the kill fails |
| **Ranged** 🏹 | Bow | Long-range physical consistency - accuracy and sustained damage over burst | Fragile, weak if forced into unfavorable range |
| **Mage** ✨ | Staff | Magical damage and control - AoE, debuffs, elemental/special mechanics | Low Physical Defense, vulnerable to Assassins |
| **Support** ➕ | Cross | Team utility - healing, buffs, cleanse, sustain (not always a pure healer) | Low damage, a high-priority target itself |

Class filters (in Character Selection and the Character Collection) only ever show these 6, plus
"All". Character cards show their class as a small colored badge in the top-right corner.

## Damage Types & Class Balance

Every character has **two separate Defense stats** - Physical Defense and Magical Defense - and an
Attack Type (Physical or Magical) that determines which of the *target's* two defenses their Basic
Attack, Skills, and Ultimate are checked against. A Wizard's Fireball is checked against the
target's Magical Defense; a Knight's Sword Slash is checked against Physical Defense. This is
shown on every Character Detail screen (P.DEF / M.DEF / a Physical or Magical badge).

Every character also has an **Evasion** stat (a flat chance to fully evade an incoming hit),
scaled by class - Assassins dodge the most, Tanks/Supports the least, with a few thematic
exceptions (Illusionist, Void Walker, Ninja, Fencer, and Witch get extra Evasion because it's core
to their kit). A successful dodge shows a floating "EVADE" indicator over the defender.

**Class balance is centralized in `js/balance.js`**, not scattered across 50 character blocks -
but a class template is a shared *power budget*, not identical numbers. Every character in a class
draws the same HP/Attack/Speed/Crit/total-Defense/Evasion budget, while each character's own
`DEFENSE_LEAN` shifts how that Defense budget splits between Physical and Magical (e.g. Paladin
leans Magical-resistant, Gladiator leans Physical-resistant - both are still full-strength Tanks).
To retune the game later, edit the tables in `js/balance.js` - never the individual character
blocks in `characters.js`.

A **Sudden Death** safety net (`js/battle.js`) also guarantees every battle eventually resolves:
if a fight runs unusually long (past 120 individual turns - far beyond a normal battle), gradually
escalating Fatigue damage kicks in once per round for everyone equally, so two extremely
defensive/sustain-heavy teams can never stalemate forever.

Hold down any Basic Attack/Skill/Ultimate/Defend/Item button in battle (mouse or touch) to see its
full description in a tooltip - releasing after a hold never accidentally triggers the action.

## Formations & Positioning

Ally slots render on the **left**, enemy slots on the **right** in Landscape (or **bottom**/**top**
in Portrait), both split into three bands: **Front**, **Middle**, **Back**. You place your own 5
characters — there is no forced "Tank front / DPS middle / Healer back" rule.

- **Front Row** is the default target for Basic Attacks and most generic skills, and suits
  Tanks/Fighters who want to soak hits.
- **Back Row** gets a damage-reduction "protection" bonus against undirected attacks — not
  immunity. Several characters have skills (`single_back`, `back_row`, etc.) specifically designed
  to punch through and threaten your backline, so healers and mages are never 100% safe.
- A handful of characters get an explicit **row synergy** bonus for standing in their preferred row
  (e.g. Knight/Guardian gain bonus Defense in the Front Row; Archer gains bonus Crit and Cleric
  gains bonus Healing in the Back Row) — shown on their Character Detail screen.
- On the **Formation** screen (shown after picking your 5 characters for Quick Battle or Campaign),
  tap a character then tap Front/Middle/Back to place them, tap a placed character to send them back
  to the pool, or use **Auto Arrange** for a sensible default. Desktop also supports drag-and-drop.
- Practice and Character Test skip the formation step and auto-arrange for speed.

### Portrait vs Landscape

The Battle screen adapts to whichever way the phone is held, and always fits in one screen with no
scrolling:

- **Landscape**: Ally reads Back → Middle → Front (left to right) facing Enemy's Front → Middle →
  Back, so both team's Front Rows meet at a "VS" divider in the center.
- **Portrait**: the same idea rotated 90° — Enemy is stacked Back (top) → Middle → Front, then the
  "VS" divider, then Ally Front → Middle → Back (bottom), so the two Front Rows still meet in the
  middle of the screen.

Every other screen (menus, Character Selection, Formation editor, Settings, Results) uses an
ordinary responsive layout and scrolls normally in either orientation.

## Fair by Design

- All 50 characters are unlocked from the start — there is nothing to buy.
- Progression (level, mastery, achievements) only unlocks cosmetics/badges, never stat advantages.
- The AI plays with the exact same stats, cooldowns, and Energy rules as the player at every difficulty.

## Requirements

Any modern browser: Chrome, Edge, Firefox, or Safari (desktop or mobile) released in the last ~3 years.
No installation of Node.js, npm, or any build tool is required to play — this is a static site.

## Running the Game

The game is plain HTML/CSS/JavaScript with no build step. However, **Service Worker, PWA install, and
offline caching all require the page to be served over HTTP(S)** — opening `index.html` directly via
`file://` will run the game, but PWA install and offline mode will not work correctly under `file://`.

From the `ponti-arena` folder, start any static file server, for example:

```bash
python -m http.server 8000
```

Then open:

```
http://localhost:8000
```

No Python? Any of these work identically:

```bash
npx serve .
# or
php -S localhost:8000
```

## Adding Character Images

Character artwork is **entirely optional**. The game ships with generated icon/emoji visuals for every
character and is 100% playable with an empty `assets/characters/` folder.

To add real artwork:

1. Open the folder: `assets/characters/`
2. Prepare your image (see recommendations below).
3. Save it using the character's exact filename (see table below).
4. Refresh the game.

If the file is found, the game automatically uses it. If not, it automatically falls back to the
generated icon — you never need to touch any game code.

```
assets/
  characters/
    knight.png
    archer.png
    wizard.png
    ...
```

### Character → Filename Table

| Character    | Filename          |
| ------------ | ------------------ |
| Knight       | knight.png         |
| Archer       | archer.png         |
| Wizard       | wizard.png         |
| Assassin     | assassin.png       |
| Berserker    | berserker.png      |
| Cleric       | cleric.png         |
| Ranger       | ranger.png         |
| Warlock      | warlock.png        |
| Ninja        | ninja.png          |
| Frost Mage   | frost-mage.png     |
| Pyromancer   | pyromancer.png     |
| Stormcaller  | stormcaller.png    |
| Gunslinger   | gunslinger.png     |
| Beastmaster  | beastmaster.png    |
| Guardian     | guardian.png       |
| Blood Knight | blood-knight.png   |
| Sky Lancer   | sky-lancer.png     |
| Necromancer  | necromancer.png    |
| Druid        | druid.png          |
| Machinist    | machinist.png      |
| Paladin      | paladin.png         |
| Samurai      | samurai.png         |
| Vampire      | vampire.png         |
| Chronomancer | chronomancer.png    |
| Illusionist  | illusionist.png     |
| Alchemist    | alchemist.png       |
| Duelist      | duelist.png         |
| Pirate Captain | pirate-captain.png |
| Spirit Shaman | spirit-shaman.png  |
| Gravity Mage | gravity-mage.png    |
| Monk         | monk.png            |
| Demon Hunter | demon-hunter.png    |
| Engineer     | engineer.png        |
| Fencer       | fencer.png          |
| Oracle       | oracle.png          |
| Bard         | bard.png            |
| Gladiator    | gladiator.png       |
| Frost Knight | frost-knight.png    |
| Plague Doctor | plague-doctor.png  |
| Void Walker  | void-walker.png     |
| Dragon Knight | dragon-knight.png  |
| Shadow Priest | shadow-priest.png  |
| Sniper       | sniper.png          |
| Berserker Lord | berserker-lord.png |
| Rune Master  | rune-master.png     |
| Witch        | witch.png           |
| Battle Medic | battle-medic.png    |
| Beast Rider  | beast-rider.png     |
| Mirror Knight | mirror-knight.png  |
| Soul Reaper  | soul-reaper.png     |

### Image Recommendations

- Format: PNG or WebP (JPG also supported)
- Resolution: 512×512 or 1024×1024
- Aspect ratio: 1:1 (square)
- Background: transparent preferred
- Framing: character centered, facing forward or 3/4 view, clearly readable at small sizes
- Avoid: very dark images, landscape crops, large watermarks, or busy backgrounds

### Custom Character Art with an AI Image Generator

If you want to generate artwork, a generic prompt shape that works well with most image tools:

> "[Character name], [role] in a fantasy RPG art style, centered, square composition, transparent
> background, no text, no watermark, clearly visible at small thumbnail size."

This project has no dependency on any specific AI image generator — use whichever tool you like.

## Adding a New Character

1. Add a new object to the `CHARACTERS` array in `js/characters.js` (copy an existing entry as a template).
2. Fill in `base` stats, `passive`, `basicAttack`, `skill1`, `skill2`, and `ultimate`.
3. (Optional) Add `assets/characters/<new-character-id>.png` — a fallback icon renders automatically if omitted.
4. Refresh the app — the character now appears in Character Selection, Quick Battle, Practice, and Campaign pools automatically. No battle engine, AI, or UI code needs to change.
5. Test the character in **Characters → Test in Battle** against the Training Dummy.
6. Test the character inside a full 5v5 Quick Battle.
7. Watch how the AI plays the character (put it on the enemy team in Quick Battle) to confirm it behaves sensibly.

## Project Structure

```
/index.html
/manifest.json
/service-worker.js
/css
  style.css        - design tokens, reset, buttons, modals, toasts
  menu.css          - main menu, team builder, campaign, settings, results
  character.css     - character cards, avatars, detail panel
  battle.css        - battle arena, turn timeline, action menu
  responsive.css     - breakpoints and touch-target rules
/js
  config.js          - arenas, campaign stages, achievement definitions
  characters.js       - the 20-character roster (data-driven)
  status-effects.js   - centralized status effect engine (Burn, Stun, Shield, ...)
  combat.js           - damage/heal/energy formulas, formation row bonuses & back-row protection
  targeting.js         - row-aware targeting engine (front/middle/back priority, backline skills, AI formation templates)
  balance.js            - single source of truth for per-class base stats, Physical/Magical Defense split, and Evasion
  ai-scoring.js          - Expert/Master AI: threat scoring, kill confirmation, overkill avoidance, combo/role weighting
  character-mechanics.js   - isolated custom mechanics for both roster expansions (redirect, counters, reagents, totems, position pulls, turn manipulation, rewind, Ki/Rage/Footwork resources, Turret, Taunt, Contagion spread)
  skills.js              - resolves a skill definition against its targets
  turn-manager.js      - speed-based turn order / action bar
  ai.js                - AI decision-making (4 difficulty tiers)
  battle.js             - the battle engine that ties the above together
  storage.js             - robust LocalStorage wrapper with safe fallback
  audio.js                - Web Audio API synthesized SFX/music (no audio files needed)
  assets.js                - character image fallback chain (photo -> SVG/CSS icon -> emoji)
  ui.js                     - DOM rendering functions
  app.js                     - screen navigation + battle loop orchestration
/assets
  /characters   - optional character photos (see table above)
  /images       - optional extra art
  /audio        - unused by default (audio is synthesized); reserved for future real SFX/music files
/icons          - PWA icons (192, 512, maskable 512, apple-touch, favicon)
```

## How the Fallback Asset System Works

Every character visual goes through `AssetManager.buildAvatarElement()` in `js/assets.js`:

1. Try to load `assets/characters/<id>.png`.
2. If it 404s, the `<img>`'s `onerror` handler swaps it for a generated SVG/CSS icon themed by the
   character's role, weapon, and accent color.
3. That fallback icon is treated as an official part of the game's visual design — not an error state.

Character Selection, the Battle screen, the Turn Timeline, the Result screen, and Character Mastery all
use this same code path, so none of them can ever show a broken image icon.

## Offline & PWA Notes

- After the first successful load (served via HTTP, not `file://`), `service-worker.js` caches the full
  app shell so the game keeps working with no network connection.
- Tap **Install Game** on the Main Menu. If your browser supports the native install prompt
  (`beforeinstallprprompt`), it installs directly. Otherwise the game shows manual install steps for
  Chrome/Edge, Android, iOS Safari, and macOS Safari.
- A missing/failed Service Worker registration never blocks gameplay — the game runs fine even if PWA
  features are unsupported in your browser.

## Development Notes

- No frameworks: plain HTML5, CSS3, and vanilla JavaScript. No build step, no bundler, no external runtime
  dependency of any kind — everything runs directly in the browser.
- Battle logic (`combat.js`, `skills.js`, `status-effects.js`, `turn-manager.js`, `ai.js`, `battle.js`)
  never touches the DOM, so it can be reused behind a future multiplayer transport (WebSocket/WebRTC)
  without a rewrite.
- All character/skill/status/campaign/arena content is configuration-driven — adding content should never
  require touching engine code.
