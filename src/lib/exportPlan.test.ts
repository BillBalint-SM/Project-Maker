import { describe, expect, it } from "vitest";
import { buildProjectExportPlan, buildProjectsExportPlan } from "./exportPlan";
import { makeProject } from "../test/builders";

describe("export plan", () => {
  it("builds executive sections shared by PDF and Excel renderers", () => {
    const plan = buildProjectExportPlan(makeProject(), "executive");

    expect(plan.title).toBe("Alpha projekt");
    expect(plan.sections.map((section) => section.title)).toEqual([
      "Projekt összefoglaló",
      "Decision Cockpit",
      "Hiányzó információk",
      "Felelősök",
      "Üzleti összefoglaló",
      "Döntési blokk"
    ]);
  });

  it("uses preset-specific detail sections without duplicating summary rows", () => {
    const project = makeProject();

    expect(buildProjectExportPlan(project, "gaps").sections.map((section) => section.title)).toEqual([
      "Projekt összefoglaló",
      "Decision Cockpit",
      "Hiányzó információk",
      "Nyitott kérdések / follow-up"
    ]);

    expect(buildProjectExportPlan(project, "full").sections.map((section) => section.title)).toContain(
      "Checklist"
    );
  });

  it("creates workbook-oriented summary and detail column plans", () => {
    const plan = buildProjectsExportPlan([makeProject()], "executive");

    expect(plan.summaryRows[0]).toContain("Projekt neve");
    expect(plan.summaryRows[1][0]).toBe("Alpha projekt");
    expect(plan.summaryColumns.length).toBeGreaterThan(5);
    expect(plan.detailColumns.length).toBeGreaterThan(5);
  });
});
