/**
 * PONTI ARENA - Turn Manager
 * Speed-based "action bar" turn order. Every actor accumulates readiness
 * proportional to Speed each tick; whoever fills first acts next.
 * This guarantees faster characters act more often without ever allowing
 * two actions to resolve simultaneously or a dead character to be queued.
 * No DOM access happens here - purely scheduling logic.
 */

const READY_THRESHOLD = 1000;

class TurnManager {
  constructor(allActors) {
    this.actors = allActors;
    this.actors.forEach(a => { a.readiness = 0; });
  }

  livingActors() {
    return this.actors.filter(a => !a.isDead);
  }

  /** Advance the action bar until exactly one actor is ready; return that actor. */
  getNextActor() {
    const living = this.livingActors();
    if (living.length === 0) return null;
    // Safety guard against infinite loop: cap iterations.
    let iterations = 0;
    while (iterations < 100000) {
      iterations++;
      for (const a of living) {
        const spd = CombatEngine.liveStat(a, 'speed');
        a.readiness += Math.max(1, spd);
      }
      const ready = living.filter(a => a.readiness >= READY_THRESHOLD);
      if (ready.length > 0) {
        ready.sort((a, b) => b.readiness - a.readiness);
        const chosen = ready[0];
        chosen.readiness -= READY_THRESHOLD;
        return chosen;
      }
    }
    return living[0]; // fallback, should never hit
  }

  /** Build a preview of the next N actors to act, without mutating real readiness. */
  previewTimeline(n) {
    const living = this.livingActors();
    if (living.length === 0) return [];
    const sim = living.map(a => ({ id: a.id, name: a.name, icon: a.character.icon, color: a.character.color,
      readiness: a.readiness, speed: CombatEngine.liveStat(a, 'speed') }));
    const order = [];
    let guard = 0;
    while (order.length < n && guard < 5000) {
      guard++;
      sim.forEach(a => { a.readiness += Math.max(1, a.speed); });
      const ready = sim.filter(a => a.readiness >= READY_THRESHOLD);
      if (ready.length > 0) {
        ready.sort((a, b) => b.readiness - a.readiness);
        const chosen = ready[0];
        chosen.readiness -= READY_THRESHOLD;
        order.push({ id: chosen.id, name: chosen.name, icon: chosen.icon, color: chosen.color });
      }
    }
    return order;
  }

  checkVictoryDefeat() {
    const playerAlive = this.actors.some(a => a.side === 'player' && !a.isDead);
    const enemyAlive = this.actors.some(a => a.side === 'enemy' && !a.isDead);
    if (!enemyAlive) return 'victory';
    if (!playerAlive) return 'defeat';
    return null;
  }
}
