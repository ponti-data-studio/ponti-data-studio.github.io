/**
 * PONTI ARENA - Storage System
 * Robust LocalStorage wrapper. Never throws, never crashes the game.
 * Falls back to an in-memory default state if data is missing or corrupt.
 */

const STORAGE_KEY = 'ponti_arena_save_v1';

function defaultSaveData() {
  return {
    version: 1,
    level: 1,
    xp: 0,
    wins: 0,
    losses: 0,
    totalBattles: 0,
    mastery: {},          // { characterId: masteryPoints }
    unlockedCharacters: CHARACTERS.map(c => c.id), // all unlocked for MVP fairness
    campaignProgress: 0,   // highest cleared stage index
    achievements: [],      // list of unlocked achievement ids
    ultimatesUsed: 0,
    onboardingSeen: false,
    settings: {
      masterVolume: 70,
      musicVolume: 50,
      sfxVolume: 70,
      muted: false,
      graphics: 'medium',
      damageNumbers: true,
      battleAnimation: true,
      screenShake: true,
      reducedMotion: false,
      language: 'id',
      aiDebug: false,
    },
    lastTeam: [],
  };
}

const Storage = {
  _memoryFallback: null,

  load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const fresh = defaultSaveData();
        this.save(fresh);
        return fresh;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !('version' in parsed)) {
        throw new Error('corrupt save shape');
      }
      // Merge with defaults to guarantee every expected key exists (forward-compat safe)
      const merged = { ...defaultSaveData(), ...parsed };
      merged.settings = { ...defaultSaveData().settings, ...(parsed.settings || {}) };
      return merged;
    } catch (err) {
      console.warn('[Storage] Save data missing or corrupt, using defaults.', err);
      const fresh = defaultSaveData();
      this.save(fresh);
      return fresh;
    }
  },

  save(data) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      this._memoryFallback = null;
      return true;
    } catch (err) {
      console.warn('[Storage] Failed to persist to LocalStorage, using memory fallback.', err);
      this._memoryFallback = data;
      return false;
    }
  },

  reset() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) { /* ignore */ }
    const fresh = defaultSaveData();
    this.save(fresh);
    return fresh;
  },
};
