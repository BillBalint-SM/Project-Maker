/**
 * Export port — the hexagon's serialization seam. Deliberately minimal:
 * `viewModel` is `unknown` because the concrete export view-model shape is
 * Phase 4's concern — only the port's contract contour is established here.
 *
 * Domain-purity rule: this file must never import from rxdb/dexie/react or
 * any adapters/features module.
 */
export interface ExportPort {
  serialize(viewModel: unknown, format: "markdown" | "pdf" | "excel"): Promise<Blob>;
}
