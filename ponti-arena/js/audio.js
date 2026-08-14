/**
 * PONTI ARENA - Audio System
 * Uses the Web Audio API to synthesize all sound effects and a simple ambient
 * music loop, so the game never depends on external audio assets. If the
 * AudioContext fails to initialize (unsupported browser, autoplay lock),
 * every call becomes a safe no-op - audio failure never crashes the game.
 */

const AudioSystem = {
  ctx: null,
  musicNodes: null,
  settings: { masterVolume: 70, musicVolume: 50, sfxVolume: 70, muted: false },

  init(settings) {
    if (settings) this.settings = settings;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    } catch (err) {
      console.warn('[Audio] Unavailable:', err);
      this.ctx = null;
    }
  },

  resume() {
    try { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) { /* noop */ }
  },

  updateSettings(settings) { this.settings = settings; },

  _gain(volumeKey) {
    if (this.settings.muted) return 0;
    const master = this.settings.masterVolume / 100;
    const sub = this.settings[volumeKey] / 100;
    return Math.max(0, Math.min(1, master * sub));
  },

  _tone(freq, duration, type = 'sine', volumeKey = 'sfxVolume', gainScale = 0.25, delay = 0) {
    if (!this.ctx) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      const g = this._gain(volumeKey) * gainScale;
      gainNode.gain.setValueAtTime(0.0001, t0);
      gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, g), t0 + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(gainNode).connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.05);
    } catch (err) { /* audio failure is never fatal */ }
  },

  playUIClick() { this._tone(520, 0.08, 'square', 'sfxVolume', 0.15); },
  playAttack() { this._tone(180, 0.12, 'sawtooth', 'sfxVolume', 0.25); this._tone(90, 0.15, 'square', 'sfxVolume', 0.15, 0.03); },
  playSkill() { this._tone(420, 0.15, 'triangle', 'sfxVolume', 0.22); this._tone(640, 0.18, 'sine', 'sfxVolume', 0.18, 0.05); },
  playUltimate() {
    [260, 390, 520, 780].forEach((f, i) => this._tone(f, 0.35, 'sawtooth', 'sfxVolume', 0.2, i * 0.06));
  },
  playHeal() { this._tone(660, 0.2, 'sine', 'sfxVolume', 0.18); this._tone(880, 0.25, 'sine', 'sfxVolume', 0.14, 0.08); },
  playCritical() { this._tone(1000, 0.1, 'square', 'sfxVolume', 0.2); this._tone(1300, 0.12, 'square', 'sfxVolume', 0.15, 0.05); },
  playVictory() { [440, 554, 659, 880].forEach((f, i) => this._tone(f, 0.4, 'triangle', 'sfxVolume', 0.2, i * 0.12)); },
  playDefeat() { [330, 294, 262, 220].forEach((f, i) => this._tone(f, 0.5, 'sawtooth', 'sfxVolume', 0.18, i * 0.15)); },
  playDeath() { this._tone(160, 0.3, 'sawtooth', 'sfxVolume', 0.2); },
  playStatus() { this._tone(300, 0.1, 'triangle', 'sfxVolume', 0.15); },

  startMusic() {
    if (!this.ctx || this.musicNodes) return;
    try {
      const notes = [220, 261.6, 329.6, 246.9];
      let index = 0;
      const gainNode = this.ctx.createGain();
      gainNode.gain.value = 0.0001;
      gainNode.connect(this.ctx.destination);
      const play = () => {
        if (!this.ctx || !this.musicNodes) return;
        const g = this._gain('musicVolume') * 0.06;
        gainNode.gain.setTargetAtTime(Math.max(0.0001, g), this.ctx.currentTime, 0.5);
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = notes[index % notes.length];
        osc.connect(gainNode);
        osc.start();
        osc.stop(this.ctx.currentTime + 1.8);
        index++;
      };
      play();
      const interval = setInterval(play, 2000);
      this.musicNodes = { gainNode, interval };
    } catch (err) { this.musicNodes = null; }
  },

  stopMusic() {
    if (this.musicNodes) {
      try { clearInterval(this.musicNodes.interval); } catch (e) { /* noop */ }
      this.musicNodes = null;
    }
  },
};
