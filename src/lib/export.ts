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
type WorkbookSheet = {
  name: string;
  rows: unknown[][];
  columns: Array<{ wch: number }>;
};

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

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index: number) {
  let current = index;
  let name = "";

  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }

  return name;
}

function cellReference(rowIndex: number, columnIndex: number) {
  return `${columnName(columnIndex)}${rowIndex}`;
}

function sheetXml(rows: unknown[][], columns: Array<{ wch: number }>) {
  const columnXml = columns
    .map(
      (column, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${column.wch}" customWidth="1"/>`
    )
    .join("");
  const rowXml = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, columnIndex) => {
          const reference = cellReference(rowIndex + 1, columnIndex + 1);
          if (typeof cell === "number" && Number.isFinite(cell)) {
            return `<c r="${reference}"><v>${cell}</v></c>`;
          }

          const text = cell === null || cell === undefined ? "" : String(cell);
          return `<c r="${reference}" t="inlineStr"><is><t>${xmlEscape(text)}</t></is></c>`;
        })
        .join("");

      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    `<cols>${columnXml}</cols>`,
    `<sheetData>${rowXml}</sheetData>`,
    "</worksheet>"
  ].join("");
}

function workbookXml(sheetNames: string[]) {
  const sheets = sheetNames
    .map(
      (name, index) =>
        `<sheet name="${xmlEscape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    )
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    `<sheets>${sheets}</sheets>`,
    "</workbook>"
  ].join("");
}

function workbookRelationshipsXml(sheetCount: number) {
  const relationships = Array.from({ length: sheetCount }, (_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  ).join("");

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    relationships,
    "</Relationships>"
  ].join("");
}

function contentTypesXml(sheetCount: number) {
  const sheets = Array.from({ length: sheetCount }, (_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join("");

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
    sheets,
    "</Types>"
  ].join("");
}

function rootRelationshipsXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>',
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>',
    "</Relationships>"
  ].join("");
}

function stylesXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>',
    '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>',
    '<borders count="1"><border/></borders>',
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
    '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>',
    "</styleSheet>"
  ].join("");
}

function corePropertiesXml(createdAt: string) {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    "<dc:creator>Project Maker</dc:creator>",
    "<cp:lastModifiedBy>Project Maker</cp:lastModifiedBy>",
    `<dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created>`,
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:modified>`,
    "</cp:coreProperties>"
  ].join("");
}

function appPropertiesXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">',
    "<Application>Project Maker</Application>",
    "</Properties>"
  ].join("");
}

async function buildWorkbookBlob(sheets: WorkbookSheet[]) {
  const { strToU8, zipSync } = await import("fflate");
  const createdAt = new Date().toISOString();
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(contentTypesXml(sheets.length)),
    "_rels/.rels": strToU8(rootRelationshipsXml()),
    "docProps/app.xml": strToU8(appPropertiesXml()),
    "docProps/core.xml": strToU8(corePropertiesXml(createdAt)),
    "xl/_rels/workbook.xml.rels": strToU8(workbookRelationshipsXml(sheets.length)),
    "xl/styles.xml": strToU8(stylesXml()),
    "xl/workbook.xml": strToU8(workbookXml(sheets.map((sheet) => sheet.name)))
  };

  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(
      sheetXml(sheet.rows, sheet.columns)
    );
  });

  return new Blob([zipSync(files, { level: 6 })], { type: excelMimeType });
}

export async function buildProjectsExcelBlob(
  projects: Project[],
  preset: ExportPreset = "executive"
) {
  const exportPlan = buildProjectsExportPlan(projects, preset);
  const sheets: WorkbookSheet[] = [
    {
      name: "Összesítő",
      rows: exportPlan.summaryRows,
      columns: exportPlan.summaryColumns
    }
  ];
  const usedSheetNames = new Set(["Összesítő"]);

  exportPlan.projects.forEach((projectPlan, index) => {
    sheets.push({
      name: uniqueSheetName(projectPlan.title, index, usedSheetNames),
      rows: projectSheetRows(projectPlan),
      columns: exportPlan.detailColumns
    });
  });

  return buildWorkbookBlob(sheets);
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
