import { signal } from '@angular/core';

/** Local command state: duplicate clicks wait, unrelated work does not. */
export class ProjectCommandPending {
  private readonly commands = signal<ReadonlySet<string>>(new Set());

  begin(command: string): boolean {
    if (this.commands().has(command)) return false;
    this.commands.update((current) => new Set(current).add(command));
    return true;
  }

  end(command: string): void {
    this.commands.update((current) => {
      const next = new Set(current);
      next.delete(command);
      return next;
    });
  }

  isPending(command: string): boolean {
    return this.commands().has(command);
  }
}
