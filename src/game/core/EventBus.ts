import { GameEventType } from '../types/events';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventHandler = (data: any) => void;

export class EventBus {
  private listeners = new Map<GameEventType, Set<EventHandler>>();

  on(type: GameEventType, handler: EventHandler): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    const set = this.listeners.get(type)!;
    set.add(handler);
    return () => set.delete(handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit(type: GameEventType, data?: any): void {
    const set = this.listeners.get(type);
    if (set) set.forEach((h) => h(data));
  }

  clear(): void {
    this.listeners.clear();
  }
}
