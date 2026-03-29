export class InputManager {
  keys: Set<string> = new Set();
  mouseButtons: Set<number> = new Set();
  private listeners: (() => void)[] = [];

  init(): void {
    const onKeyDown = (e: KeyboardEvent) => this.keys.add(e.code);
    const onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
    const onMouseDown = (e: MouseEvent) => this.mouseButtons.add(e.button);
    const onMouseUp = (e: MouseEvent) => this.mouseButtons.delete(e.button);

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);

    this.listeners.push(
      () => document.removeEventListener('keydown', onKeyDown),
      () => document.removeEventListener('keyup', onKeyUp),
      () => document.removeEventListener('mousedown', onMouseDown),
      () => document.removeEventListener('mouseup', onMouseUp),
    );
  }

  isKeyDown(code: string): boolean { return this.keys.has(code); }
  isMouseDown(button: number): boolean { return this.mouseButtons.has(button); }

  destroy(): void {
    for (const cleanup of this.listeners) cleanup();
    this.listeners = [];
  }
}
