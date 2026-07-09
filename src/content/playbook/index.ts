import { general } from "./general";
import type { Playbook } from "./types";

/**
 * Playbook catalog. Deliberately shaped as an extensible
 * `Record<string, Playbook>` even though only "general" exists today (D-01)
 * — a future playbook is added here without touching consumers that look up
 * by id.
 */
export const playbooks: Record<string, Playbook> = {
  general
};
