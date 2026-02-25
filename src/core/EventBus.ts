type Listener = (...args: any[]) => void;

class EventBusClass {
  private listeners = new Map<string, Set<Listener>>();

  on(event: string, listener: Listener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: string, listener: Listener): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((listener) => {
      listener(...args);
    });
  }
}

export const EventBus = new EventBusClass();
