import { KillFeedEntry } from '../types/index';

export class KillTracker {
  killFeed: KillFeedEntry[] = [];
  private maxFeedSize = 20;

  recordKill(killer: string, victim: string, weapon: string): void {
    this.killFeed.push({
      killer,
      victim,
      weapon,
      time: Date.now(),
    });
    if (this.killFeed.length > this.maxFeedSize) {
      this.killFeed.shift();
    }
  }

  getRecentFeed(count: number = 5): KillFeedEntry[] {
    return this.killFeed.slice(-count);
  }
}
