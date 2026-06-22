import type { ExportPreset, Project } from "../data/types";
import {
  buildProjectsExportPlan,
  valueOrDash,
  type ExportCell,
  type ExportSection,
  type ProjectExportPlan
} from "./exportPlan";

type PdfDocumentDefinition = Record<string, unknown>;

type PdfFonts = {
  vfs?: Record<string, string>;
  pdfMake?: {
    vfs?: Record<string, string>;
  };
};

type JsPdf = import("jspdf").jsPDF;
type AutoTable = (doc: JsPdf, options: PdfDocumentDefinition) => void;

const pdfMimeType = "application/pdf";
const excelMimeType =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function loadPdfGenerator() {
  const [jsPdfModule, autoTableModule, pdfFontsModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("pdfmake/build/vfs_fonts")
  ]);
  const fonts = pdfFontsModule.default as PdfFonts;
  const vfs = fonts.vfs ?? fonts.pdfMake?.vfs ?? (fonts as unknown as Record<string, string>);

  return {
    JsPdf: jsPdfModule.jsPDF,
    autoTable: autoTableModule.default as AutoTable,
    vfs
  };
}

function isTauriRuntime() {
  return Boolean(
    typeof window !== "undefined" &&
      ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function fileSafeSlug(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "export"
  );
}

function timestampForFileName() {
  const now = new Date();
  const padded = (value: number) => String(value).padStart(2, "0");

  return [
    now.getFullYear(),
    padded(now.getMonth() + 1),
    padded(now.getDate()),
    padded(now.getHours()),
    padded(now.getMinutes())
  ].join("");
}

const exportPresetSlugs: Record<ExportPreset, string> = {
  executive: "vezetoi",
  full: "teljes",
  gaps: "hianylista"
};

export function makeExportFileName(
  projects: Project[],
  extension: "pdf" | "xlsx",
  preset: ExportPreset = "executive"
) {
  const base =
    projects.length === 1
      ? fileSafeSlug(projects[0].name)
      : `project-maker-${projects.length}-projekt`;

  return `${base}-${exportPresetSlugs[preset]}-${timestampForFileName()}.${extension}`;
}

function registerPdfFonts(doc: JsPdf, vfs: Record<string, string>) {
  const fontCapableDoc = doc as JsPdf & {
    addFileToVFS: (fileName: string, fileContent: string) => void;
    addFont: (fileName: string, fontName: string, fontStyle: string) => void;
  };

  if (vfs["Roboto-Regular.ttf"]) {
    fontCapableDoc.addFileToVFS("Roboto-Regular.ttf", vfs["Roboto-Regular.ttf"]);
    fontCapableDoc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  }

  if (vfs["Roboto-Medium.ttf"]) {
    fontCapableDoc.addFileToVFS("Roboto-Medium.ttf", vfs["Roboto-Medium.ttf"]);
    fontCapableDoc.addFont("Roboto-Medium.ttf", "Roboto", "bold");
  }

  doc.setFont("Roboto", "normal");
}

function pdfPageHeight(doc: JsPdf) {
  return doc.internal.pageSize.getHeight();
}

function ensurePdfSpace(doc: JsPdf, y: number, requiredHeight = 90) {
  if (y + requiredHeight <= pdfPageHeight(doc) - 34) {
    return y;
  }

  doc.addPage();
  return 32;
}

function lastAutoTableY(doc: JsPdf, fallbackY: number) {
  const tableAwareDoc = doc as JsPdf & {
    lastAutoTable?: {
      finalY?: number;
    };
  };

  return tableAwareDoc.lastAutoTable?.finalY ?? fallbackY;
}

function addPdfSectionTitle(doc: JsPdf, title: string, y: number) {
  const nextY = ensurePdfSpace(doc, y, 36);
  doc.setFont("Roboto", "bold");
  doc.setFontSize(10);
  doc.setTextColor(23, 32, 51);
  doc.text(title, 24, nextY);
  doc.setFont("Roboto", "normal");

  return nextY + 8;
}

function addPdfKeyValueTable(
  doc: JsPdf,
  autoTable: AutoTable,
  title: string,
  rows: Array<[string, string]>,
  y: number
) {
  const startY = addPdfSectionTitle(doc, title, y);
  autoTable(doc, {
    startY,
    body: rows.map(([label, value]) => [label, valueOrDash(value)]),
    margin: { left: 24, right: 24 },
    styles: {
      font: "Roboto",
      fontSize: 8,
      cellPadding: 4,
      overflow: "linebreak",
      valign: "top"
    },
    columnStyles: {
      0: {
        cellWidth: 165,
        fontStyle: "bold",
        textColor: [56, 70, 90]
      }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    theme: "grid"
  });

  return lastAutoTableY(doc, startY) + 14;
}

function addPdfDataTable(
  doc: JsPdf,
  autoTable: AutoTable,
  title: string,
  head: string[],
  body: ExportCell[][],
  y: number,
  columnStyles: PdfDocumentDefinition = {}
) {
  const startY = addPdfSectionTitle(doc, title, y);
  autoTable(doc, {
    startY,
    head: [head],
    body:
      body.length > 0
        ? body.map((row) => row.map(valueOrDash))
        : [head.map((_, index) => (index === 0 ? "Nincs adat" : ""))],
    margin: { left: 24, right: 24 },
    styles: {
      font: "Roboto",
      fontSize: 5.8,
      cellPadding: 3,
      minCellWidth: 5,
      overflow: "linebreak",
      valign: "top"
    },
    headStyles: {
      fillColor: [237, 248, 247],
      textColor: [23, 32, 51],
      fontStyle: "bold"
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles,
    theme: "grid"
  });

  return lastAutoTableY(doc, startY) + 14;
}

function writePdfSection(
  doc: JsPdf,
  autoTable: AutoTable,
  section: ExportSection,
  y: number
) {
  if (section.type === "keyValue") {
    return addPdfKeyValueTable(doc, autoTable, section.title, section.rows, y);
  }

  return addPdfDataTable(doc, autoTable, section.title, section.head, section.body, y);
}

function writeProjectPdf(
  doc: JsPdf,
  autoTable: AutoTable,
  projectPlan: ProjectExportPlan
) {
  let y = 34;

  doc.setFont("Roboto", "bold");
  doc.setFontSize(16);
  doc.setTextColor(23, 32, 51);
  doc.text(valueOrDash(projectPlan.title), 24, y);
  doc.setFont("Roboto", "normal");
  y += 16;

  projectPlan.sections.forEach((section) => {
    y = writePdfSection(doc, autoTable, section, y);
  });
}

function addPdfFooter(doc: JsPdf) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = pdfPageHeight(doc);

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("Roboto", "normal");
    doc.setFontSize(7);
    doc.setTextColor(90, 102, 118);
    doc.text("Project Maker export", 24, pageHeight - 18);
    doc.text(`${page} / ${pageCount}`, pageWidth - 24, pageHeight - 18, {
      align: "right"
    });
  }
}

export async function buildProjectsPdfBlob(
  projects: Project[],
  preset: ExportPreset = "executive"
) {
  const exportPlan = buildProjectsExportPlan(projects, preset);
  const { JsPdf, autoTable, vfs } = await loadPdfGenerator();
  const doc = new JsPdf({
    orientation: "landscape",
    unit: "pt",
    format: "a4"
  });

  registerPdfFonts(doc, vfs);
  doc.setProperties({
    title:
      projects.length === 1
        ? `Project Maker - ${projects[0].name}`
        : `Project Maker export - ${projects.length} projekt`
  });

  exportPlan.projects.forEach((projectPlan, index) => {
    if (index > 0) doc.addPage();
    writeProjectPdf(doc, autoTable, projectPlan);
  });

  addPdfFooter(doc);

  return new Blob([doc.output("arraybuffer")], { type: pdfMimeType });
}

function appendSection(sheetRows: unknown[][], title: string, rows: unknown[][]) {
  sheetRows.push([], [title], ...rows);
}

function sectionSheetRows(section: ExportSection): ExportCell[][] {
  if (section.type === "keyValue") {
    return section.rows;
  }

  return [section.head, ...section.body];
}

function projectSheetRows(projectPlan: ProjectExportPlan) {
  const rows: unknown[][] = [[projectPlan.title], []];

  projectPlan.sections.forEach((section) => {
    appendSection(rows, section.title, sectionSheetRows(section));
  });

  return rows;
}

function uniqueSheetName(title: string, index: number, usedNames: Set<string>) {
  const base = compactText(title) || `Projekt ${index + 1}`;
  let candidate = base.slice(0, 31);
  let suffix = 1;

  while (usedNames.has(candidate)) {
    const marker = ` ${suffix}`;
    candidate = `${base.slice(0, 31 - marker.length)}${marker}`;
    suffix += 1;
  }

  usedNames.add(candidate);
  return candidate;
}

export async function buildProjectsExcelBlob(
  projects: Project[],
  preset: ExportPreset = "executive"
) {
  const exportPlan = buildProjectsExportPlan(projects, preset);
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet(exportPlan.summaryRows);
  summary["!cols"] = exportPlan.summaryColumns;
  XLSX.utils.book_append_sheet(workbook, summary, "Összesítő");

  const usedSheetNames = new Set(["Összesítő"]);
  exportPlan.projects.forEach((projectPlan, index) => {
    const sheet = XLSX.utils.aoa_to_sheet(projectSheetRows(projectPlan));
    sheet["!cols"] = exportPlan.detailColumns;
    XLSX.utils.book_append_sheet(
      workbook,
      sheet,
      uniqueSheetName(projectPlan.title, index, usedSheetNames)
    );
  });

  const workbookData = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([workbookData], { type: excelMimeType });
}

export async function saveExportBlob(blob: Blob, fileName: string) {
  if (isTauriRuntime()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
    return invoke<string>("save_export_file", { fileName, bytes });
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return fileName;
}

export const exportMimeTypes = {
  pdf: pdfMimeType,
  excel: excelMimeType
};
