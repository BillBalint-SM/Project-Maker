import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireFromWeb = createRequire(path.join(repositoryRoot, 'apps', 'web', 'package.json'));
const ts = requireFromWeb('typescript');
const outputPath = path.join(repositoryRoot, 'docs', 'evidence', 'project-work-hub-ui-copy.md');

const inventory = [
  ['Alkalmazáskeret', 'Navigáció', 'Áttekintő'],
  ['Alkalmazáskeret', 'Navigáció', 'Új projekt'],
  ['Alkalmazáskeret', 'Navigáció', 'Folyamatban lévő ügyek'],
  ['Alkalmazáskeret', 'Navigáció', 'Utánkövetések'],
  ['Alkalmazáskeret', 'Navigáció', 'Markdown beállítások'],
  ['Alkalmazáskeret', 'Navigáció', 'Kérdésbank beállítások'],
  ['Alkalmazáskeret', 'Állapot és művelet', '{darab} új ügyfélválasz · Feldolgozás megnyitása'],
  ['Áttekintő', 'Cím', 'Áttekintő'],
  ['Áttekintő', 'Bevezető', 'Az aktív projektek és a következő feladatok áttekintése.'],
  ['Áttekintő', 'Elsődleges művelet', 'Folyamatban lévő ügyek'],
  ['Áttekintő', 'Másodlagos művelet', 'Új projekt'],
  ['Áttekintő', 'Betöltés', 'A projektek betöltése…'],
  ['Áttekintő', 'Hiba és helyreállítás', 'A projektek nem tölthetők be · Projektlista újratöltése'],
  ['Áttekintő', 'Üres állapot', 'Még nincs projekt · Új projekt létrehozása'],
  ['Áttekintő', 'Kártyamező', 'Következő lépés felelőse'],
  ['Áttekintő', 'Kártyamező', 'Következő lépés'],
  ['Áttekintő', 'Ügyfélpostafiók', 'Utolsó sikeres frissítés · Nem társított üzenetek · Üzenetek frissítése'],
  ['Új projekt', 'Cím', 'Új projekt'],
  ['Új projekt', 'Bevezető', 'Add meg az alapadatokat, majd indítsd el a projektfelmérést.'],
  ['Új projekt', 'Mező', 'Projekt neve'],
  ['Új projekt', 'Mező', 'Belső PO/PM neve'],
  ['Új projekt', 'Mező', 'Ügyfél kapcsolattartó neve'],
  ['Új projekt', 'Mező', 'Ügyfél kapcsolattartó e-mail-címe'],
  ['Új projekt', 'Elsődleges művelet', 'Mentés és tovább a felméréshez'],
  ['Új projekt', 'Másodlagos művelet', 'Piszkozat mentése és kilépés'],
  ['Új projekt', 'Kilépés', 'Mégse'],
  ['Folyamatban lévő ügyek', 'Cím', 'Folyamatban lévő ügyek'],
  ['Folyamatban lévő ügyek', 'Visszatérés', 'Vissza az Áttekintőre'],
  ['Folyamatban lévő ügyek', 'Szűrő', 'Projektnév · Sürgősség · Felkészültség'],
  ['Folyamatban lévő ügyek', 'Művelet', 'Lista frissítése · Szűrők törlése'],
  ['Folyamatban lévő ügyek', 'Betöltés', 'A folyamatban lévő ügyek betöltése…'],
  ['Folyamatban lévő ügyek', 'Hiba és helyreállítás', 'A folyamatban lévő ügyek nem tölthetők be · Lista újratöltése'],
  ['Folyamatban lévő ügyek', 'Elavult állapot', 'A lista elavult lehet · Sikertelen lekérés újrapróbálása'],
  ['Folyamatban lévő ügyek', 'Szűrt üres állapot', 'Nincs találat · Szűrők törlése'],
  ['Folyamatban lévő ügyek', 'Üres állapot', 'Nincs aktív projekt · Új projekt létrehozása'],
  ['Utánkövetések', 'Cím', 'Utánkövetések'],
  ['Utánkövetések', 'Bevezető', 'A nyitott tisztázási tételek az összes aktív projektből, határidő szerint rendezve.'],
  ['Utánkövetések', 'Betöltés', 'Az utánkövetések betöltése folyamatban van…'],
  ['Utánkövetések', 'Hiba és helyreállítás', 'Az utánkövetések most nem tölthetők be · Utánkövetések újratöltése'],
  ['Utánkövetések', 'Üres állapot', 'Nincs nyitott utánkövetés · Áttekintő megnyitása'],
  ['Utánkövetések', 'Listaelem', 'Projekt · Kategória · Felelős · Határidő · Következő lépés'],
  ['Utánkövetések', 'Elsődleges művelet', 'Utánkövetés megnyitása'],
  ['Projektkörnyezet', 'Navigáció', 'Projektállapot'],
  ['Projektkörnyezet', 'Navigáció', 'Felmérés'],
  ['Projektkörnyezet', 'Navigáció', 'Felkészültség'],
  ['Projektkörnyezet', 'Navigáció', 'Döntési értékelés'],
  ['Projektkörnyezet', 'Navigáció', 'Markdown terv'],
  ['Projektkörnyezet', 'Navigáció', 'Projektbeállítások'],
  ['Projektkörnyezet', 'Visszatérés', 'Vissza az Áttekintőre / a folyamatban lévő ügyekhez / az utánkövetésekhez'],
  ['Projektállapot', 'Cím', 'Projektállapot'],
  ['Projektállapot', 'Kártya', 'Projektkoordináció'],
  ['Projektállapot', 'Mező', 'Következő lépés felelőse · Következő lépés · Határidő'],
  ['Projektállapot', 'Művelet', 'Koordináció szerkesztése · Koordináció mentése'],
  ['Projektállapot', 'Kártya', 'Ügyféllevelezés · Ügyféllevelezés kezelése'],
  ['Projektállapot', 'Kártya', 'Legutóbbi aktivitás'],
  ['Projektállapot', 'Hiba és helyreállítás', 'Projektállapot újratöltése · Aktivitás újratöltése'],
  ['Felmérés', 'Cím', 'Felmérés'],
  ['Felmérés', 'Bevezető', 'Válaszd ki az aktív kérdéseket, fogadd el a kérdéssémát, majd folytasd a kezdő felmérési kört.'],
  ['Felmérés', 'Betöltés', 'A felmérési kérdések betöltése folyamatban van…'],
  ['Felmérés', 'Hiba és helyreállítás', 'A felmérési oldal nem tölthető be · Felmérési oldal újratöltése'],
  ['Felmérés', 'Séma', 'Projekt kérdésséma · Kérdésséma elfogadása és felmérés indítása'],
  ['Felmérés', 'Kör', 'Kezdő felmérési kör · Folyamatban · Felmérési kör lezárva'],
  ['Felmérés', 'Mentési állapot', 'Mentés folyamatban · Mentve · A mentés nem sikerült'],
  ['Felmérés', 'Elsődleges művelet', 'Felmérés lezárása és továbblépés'],
  ['Felmérés', 'Másodlagos művelet', 'Lezárás és ügyfélcsomag előnézete'],
  ['Felmérési összefoglaló', 'Cím', 'Ügyfélnek küldött felmérési összefoglalók'],
  ['Felmérési összefoglaló', 'Mező', 'Feladó · Címzett · Tárgy · Módosítás összefoglalása'],
  ['Felmérési összefoglaló', 'Művelet', 'Előnézet és küldés · Küldés az ügyfélnek'],
  ['Felmérési összefoglaló', 'Hiba és helyreállítás', 'A levelezőrendszer elutasította az átadást · Összefoglaló újraküldése'],
  ['Felmérési összefoglaló', 'Bizonytalan eredmény', 'Ellenőrzés után újrapróbálás'],
  ['Felkészültség', 'Cím', 'Felkészültség'],
  ['Felkészültség', 'Összegzés', 'Felmérés kitöltöttsége · Felkészültség'],
  ['Felkészültség', 'Tartalom', 'Értékelési tényezők · Rendezendő hiányok'],
  ['Felkészültség', 'Hiba és helyreállítás', 'Felkészültségi értékelés újratöltése'],
  ['Felkészültség', 'Üres állapot', 'Még nincs kezdő felmérés'],
  ['Felkészültség', 'Tisztázás', 'Tisztázási utánkövetések · Új tisztázási tétel'],
  ['Felkészültség', 'Tisztázási művelet', 'Módosítások mentése · Tétel lezárása · Forráshivatkozás törlése'],
  ['Döntési értékelés', 'Cím', 'Döntési értékelés'],
  ['Döntési értékelés', 'Betöltés', 'A döntési értékelés betöltése folyamatban van…'],
  ['Döntési értékelés', 'Hiba és helyreállítás', 'Döntési értékelés újratöltése'],
  ['Döntési értékelés', 'Elsődleges művelet', 'Értékelés mentése'],
  ['Markdown terv', 'Cím', 'Markdown terv'],
  ['Markdown terv', 'Betöltés', 'Markdown-revíziók betöltése…'],
  ['Markdown terv', 'Hiba és helyreállítás', 'A Markdown-revíziók nem tölthetők be · Revíziók újratöltése'],
  ['Markdown terv', 'Mező', 'Publikált sablon · Létrehozás oka · Mérföldkő'],
  ['Markdown terv', 'Elsődleges művelet', 'Markdown-revízió generálása'],
  ['Markdown terv', 'Üres állapot', 'Még nincs Markdown-revízió'],
  ['Markdown terv', 'Részletek', 'Revíziótörténet · Revízió részletei · Tartalmi előnézet · Markdown letöltése'],
  ['Projektbeállítások', 'Cím', 'Projektbeállítások'],
  ['Projektbeállítások', 'Szakasz', 'Projekt alapadatai'],
  ['Projektbeállítások', 'Művelet', 'Alapadatok mentése'],
  ['Projektbeállítások', 'Szakasz', 'Automatikus ügyfél-utánkövetés'],
  ['Projektbeállítások', 'Művelet', 'Utánkövetési beállítások mentése'],
  ['Projektbeállítások', 'Szakasz', 'Projekt életciklusa'],
  ['Projektbeállítások', 'Művelet', 'Életciklus-állapot mentése'],
  ['Projektbeállítások', 'Veszélyzóna', 'Projekt visszaállítása · Projekt archiválása · Projekt végleges törlése'],
  ['Projektbeállítások', 'Hiba és helyreállítás', 'A projektbeállítások nem tölthetők be · Projektbeállítások újratöltése'],
  ['Ügyféllevelezés', 'Cím', 'Ügyféllevelezés'],
  ['Ügyféllevelezés', 'Összegzés', '{darab} feldolgozatlan ügyfélválasz'],
  ['Ügyféllevelezés', 'Művelet', 'Átnéztem · Feldolgozás megkezdése · Lezárás'],
  ['Ügyféllevelezés', 'Mező', 'Kézi besorolás'],
  ['Ügyféllevelezés', 'Betöltés', 'Az ügyféllevelezés betöltése folyamatban van…'],
  ['Ügyféllevelezés', 'Hiba és helyreállítás', 'Az ügyféllevelezés most nem tölthető be · Ügyféllevelezés újratöltése'],
  ['Ügyféllevelezés', 'Üres állapot', 'Még nincs ügyfélválasz · Felmérési összefoglaló előkészítése'],
  ['Ügyfél-emlékeztető', 'Cím', 'Ügyfél-emlékeztető'],
  ['Ügyfél-emlékeztető', 'Mező', 'Üzenet az ügyfélnek · Kapcsolódó nyitott tisztázási tétel · Feladó'],
  ['Ügyfél-emlékeztető', 'Művelet', 'Piszkozat mentése · Pontos előnézet · Küldés az ügyfélnek'],
  ['Ügyfél-emlékeztető', 'Kézbesítési állapot', 'Még nem történt küldés · Sikeresen elküldve · Sikertelen küldés'],
  ['Ügyfél-emlékeztető', 'Hiba és helyreállítás', 'Ügyfél-emlékeztető újratöltése · Küldés újrapróbálása'],
  ['Nem társított ügyfélüzenetek', 'Cím', 'Nem társított ügyfélüzenetek'],
  ['Nem társított ügyfélüzenetek', 'Mező', 'Ügyféllevelezés'],
  ['Nem társított ügyfélüzenetek', 'Művelet', 'Üzenet társítása · Nem releváns'],
  ['Nem társított ügyfélüzenetek', 'Üres állapot', 'Nincs feldolgozandó, nem társított üzenet.'],
  ['Nem társított ügyfélüzenetek', 'Hiba és helyreállítás', 'Üzenetek újratöltése'],
  ['Markdown beállítások', 'Cím', 'Markdown beállítások'],
  ['Markdown beállítások', 'Művelet', 'Új sablon · Piszkozat mentése · Előnézet · Publikálás'],
  ['Markdown beállítások', 'Hiba és helyreállítás', 'A sablonok nem tölthetők be · Sablonok újratöltése'],
  ['Kérdésbank beállítások', 'Cím', 'Kérdésbank beállítások'],
  ['Kérdésbank beállítások', 'Mező', 'Kérdésazonosító · Témakör · Kérdés · Típus · Sorrend'],
  ['Kérdésbank beállítások', 'Művelet', 'Új alapkérdés · Alapkérdés létrehozása · Módosítások mentése'],
  ['Kérdésbank beállítások', 'Üres állapot', 'Még nincs alapkérdés'],
  ['Kérdésbank beállítások', 'Hiba és helyreállítás', 'A kérdésbank nem tölthető be · Kérdésbank újratöltése'],
];

const sourceInventory = await collectSourceInventory();
const completeInventory = deduplicateInventory([
  ...inventory.map((entry) => [...entry, 'Kanonikus szerződés']),
  ...sourceInventory,
]);

for (const [, , copy, source] of completeInventory) {
  if (isInterpolatedTechnicalPath(copy)) {
    throw new Error(`Technical path leaked into the UI-copy inventory: ${copy} (${source})`);
  }
}

const requiredContexts = [
  'Navigáció',
  'Cím',
  'Betöltés',
  'Hiba és helyreállítás',
  'Üres állapot',
  'Elsődleges művelet',
  'Mező',
];

for (const context of requiredContexts) {
  if (!completeInventory.some(([, candidate]) => candidate === context)) {
    throw new Error(`Missing required UI-copy context: ${context}`);
  }
}

const markdown = [
  '# Project Work Hub – UI-szövegleltár',
  '',
  '> Generált fájl. Módosítás: `scripts/generate-ui-copy-inventory.mjs`, majd `pnpm generate:ui-copy`.',
  '',
  'Ez a leltár a munkavállalói felületen megjelenő kanonikus navigációs neveket, címeket, állapotokat, műveleteket, mezőket, súgókat és helyreállítási szövegeket gyűjti össze. A kézzel karbantartott kanonikus szerződés mellett a generátor a teljes alkalmazássablon statikus szövegeit és a TypeScriptből származó magyar futásidejű visszajelzéseket is felsorolja. A kapcsos zárójel dinamikus üzleti adatot jelöl. A technikai azonosítók és a felhasználó által megadott projektadatok nem copy-elemek.',
  '',
  '| Képernyő | Kontextus | Javasolt kanonikus szöveg | Forrás |',
  '| --- | --- | --- | --- |',
  ...completeInventory.map(([screen, context, copy, source]) =>
    `| ${escapeCell(screen)} | ${escapeCell(context)} | ${escapeCell(copy)} | ${escapeCell(source)} |`,
  ),
  '',
  `Összesen: **${completeInventory.length}** leltárelem.`,
  '',
].join('\n');

if (process.argv.includes('--check')) {
  const current = await readFile(outputPath, 'utf8').catch(() => '');
  if (current !== markdown) {
    console.error('A UI-szövegleltár elavult. Futtasd: pnpm generate:ui-copy');
    process.exitCode = 1;
  }
} else {
  await writeFile(outputPath, markdown, 'utf8');
  console.log(`UI-szövegleltár frissítve: ${path.relative(repositoryRoot, outputPath)}`);
}

function escapeCell(value) {
  return value.replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

async function collectSourceInventory() {
  const applicationRoot = path.join(repositoryRoot, 'apps', 'web', 'src', 'app');
  const sourceFiles = await walkFiles(applicationRoot);
  const entries = [];

  for (const absolutePath of sourceFiles) {
    const relativePath = path.relative(repositoryRoot, absolutePath).replaceAll('\\', '/');
    if (isTechnicalConfigurationSource(relativePath)) continue;
    const screen = screenFor(relativePath);
    const content = await readFile(absolutePath, 'utf8');

    if (absolutePath.endsWith('.html')) {
      entries.push(...extractTemplateCopy(content, screen, relativePath));
      continue;
    }

    if (!absolutePath.endsWith('.ts') || absolutePath.endsWith('.spec.ts')) {
      continue;
    }

    entries.push(...extractTypeScriptCopy(content, screen, relativePath));
  }

  return entries;
}

async function walkFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(absolutePath));
    } else if (entry.name.endsWith('.html') || entry.name.endsWith('.ts')) {
      files.push(absolutePath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right, 'hu'));
}

function extractTemplateCopy(template, screen, source) {
  const entries = [];
  const attributePattern = /<([\w-]+)\b[^>]*?\b(label|placeholder|aria-label|title)="([^"\n]+)"[^>]*>/g;
  const textPattern = />([^<]+)</g;

  for (const match of template.matchAll(attributePattern)) {
    const [, tag, attribute, rawCopy] = match;
    const copy = normalizeCopy(rawCopy);
    if (!copy || isBindingExpression(copy)) continue;
    entries.push([screen, attributeContext(tag, attribute), copy, source]);
  }

  for (const match of template.matchAll(textPattern)) {
    const copy = normalizeCopy(match[1]);
    if (!copy || isTemplateControlFlow(copy)) continue;
    const openingTag = nearestOpeningTag(template, match.index ?? 0);
    entries.push([screen, textContext(openingTag), copy, source]);
  }

  return entries;
}

function extractTypeScriptCopy(content, screen, source) {
  const sourceFile = ts.createSourceFile(source, content, ts.ScriptTarget.Latest, true);
  const entries = [];

  function visit(node) {
    if (isInlineTemplate(node)) {
      entries.push(...extractTemplateCopy(node.initializer.text, screen, source));
      return;
    }

    if (hasAngularStyleMetadataAncestor(node)) return;

    if (isTopLevelStringConcatenation(node)) {
      const rawCopy = renderStringConcatenation(node);
      if (
        isUserFacingText(rawCopy) &&
        !hasInternalErrorConstructorAncestor(node) &&
        !isTechnicalSelector(rawCopy) &&
        !isFormattingLiteral(rawCopy)
      ) {
        const copy = normalizeCopy(rawCopy);
        entries.push([
          screen,
          typeScriptContext(node),
          copy,
          `${source}:${sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1}`,
        ]);
        return;
      }
    }

    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      isUserFacingTypeScriptLiteral(node)
    ) {
      entries.push([
        screen,
        typeScriptContext(node),
        normalizeCopy(node.text),
        `${source}:${sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1}`,
      ]);
    } else if (ts.isTemplateExpression(node)) {
      const copy = normalizeCopy(renderTemplateExpression(node));
      if (
        isUserFacingText(copy) &&
        !hasInternalErrorConstructorAncestor(node) &&
        !isTechnicalSelector(copy) &&
        !isFormattingLiteral(copy)
      ) {
        entries.push([
          screen,
          typeScriptContext(node),
          copy,
          `${source}:${sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1}`,
        ]);
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return entries;
}

function isInlineTemplate(node) {
  return ts.isPropertyAssignment(node) &&
    node.name.getText() === 'template' &&
    (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer));
}

function hasAngularStyleMetadataAncestor(node) {
  const styleMetadataNames = new Set(['styleUrl', 'styleUrls', 'styles']);
  let current = node.parent;
  while (current && !ts.isSourceFile(current)) {
    if (
      ts.isPropertyAssignment(current) &&
      styleMetadataNames.has(current.name.getText())
    ) return true;
    current = current.parent;
  }
  return false;
}

function isTechnicalConfigurationSource(source) {
  return /(?:^|\/)[^/]+\.(?:config|theme)\.ts$/.test(source);
}

function isTopLevelStringConcatenation(node) {
  if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.PlusToken) {
    return false;
  }
  return !(
    ts.isBinaryExpression(node.parent) &&
    node.parent.operatorToken.kind === ts.SyntaxKind.PlusToken
  );
}

function renderStringConcatenation(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return renderStringConcatenation(node.left) + renderStringConcatenation(node.right);
  }
  return '{dynamic}';
}

function renderTemplateExpression(node) {
  return node.templateSpans.reduce(
    (rendered, span) => `${rendered}{dynamic}${span.literal.text}`,
    node.head.text,
  );
}

function isUserFacingTypeScriptLiteral(node) {
  if (!isUserFacingText(node.text) || isModuleSpecifier(node) || isObjectKey(node)) return false;
  if (
    hasConsoleCallAncestor(node) ||
    hasInternalErrorConstructorAncestor(node) ||
    isTechnicalSelector(node.text) ||
    isFormattingLiteral(node.text)
  ) return false;
  return true;
}

function isUserFacingText(value) {
  const normalized = value.trim();
  if (!/\p{L}/u.test(normalized) || /^[A-Z0-9_:-]+$/.test(normalized)) {
    return false;
  }
  return (
    /\s/u.test(normalized) ||
    /[.!?…]/u.test(normalized) ||
    /^\p{Lu}/u.test(normalized) ||
    /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/.test(normalized)
  );
}

function isModuleSpecifier(node) {
  return (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent)) &&
    node.parent.moduleSpecifier === node;
}

function isObjectKey(node) {
  return (ts.isPropertyAssignment(node.parent) || ts.isPropertyDeclaration(node.parent)) &&
    node.parent.name === node;
}

function hasConsoleCallAncestor(node) {
  let current = node.parent;
  while (current && !ts.isStatement(current)) {
    if (
      ts.isCallExpression(current) &&
      ts.isPropertyAccessExpression(current.expression) &&
      current.expression.expression.getText() === 'console'
    ) return true;
    current = current.parent;
  }
  return false;
}

function hasInternalErrorConstructorAncestor(node) {
  const internalErrorConstructors = new Set([
    'AggregateError',
    'DOMException',
    'Error',
    'RangeError',
    'ReferenceError',
    'SyntaxError',
    'TypeError',
    'URIError',
  ]);
  let current = node.parent;
  while (current && !ts.isStatement(current)) {
    if (
      ts.isNewExpression(current) &&
      internalErrorConstructors.has(current.expression.getText())
    ) return true;
    current = current.parent;
  }
  return false;
}

function isTechnicalSelector(value) {
  const normalized = value.trim();
  return normalized.startsWith('/') || normalized.startsWith('[') ||
    normalized.startsWith('#') || normalized.startsWith('.') ||
    /^(?:data|https?|mailto):/i.test(normalized) ||
    isInterpolatedTechnicalPath(normalized) ||
    (/^[a-z0-9-]+$/.test(normalized) && normalized.includes('-'));
}

function isInterpolatedTechnicalPath(value) {
  return /^(?:\{(?:érték|dynamic)\}|[a-z0-9._~-]+)(?:\/(?:\{(?:érték|dynamic)\}|[a-z0-9._~-]+))+\/?$/i.test(value.trim());
}

function isFormattingLiteral(value) {
  const normalized = value.trim().replace(/^`|`$/g, '');
  return /^(?:y{2,4}|M{1,4}|d{1,4}|H{1,2}|m{1,2}|s{1,2})(?:[\s./:-]+(?:y{2,4}|M{1,4}|d{1,4}|H{1,2}|m{1,2}|s{1,2}))*\.?$/.test(normalized) ||
    /^(?:application|audio|font|image|text|video)\/[a-z0-9.+-]+$/i.test(normalized);
}

function typeScriptContext(node) {
  let current = node.parent;
  while (current && !ts.isSourceFile(current)) {
    const name = current.name?.getText?.()?.toLowerCase?.() ?? '';
    if (name.includes('error') || name.includes('fail') || name === 'nextstep') return 'Hiba és helyreállítás';
    if (name.includes('success') || name.includes('feedback')) return 'Siker';
    if (name.includes('label') || name.includes('title')) return 'Címke';
    current = current.parent;
  }
  return 'Futásidejű UI-szöveg';
}

function normalizeCopy(value) {
  return value
    .replace(/\{\{[^}]+\}\}/g, '§DINAMIKUS_ÉRTÉK§')
    .replace(/\{érték\}/g, '§DINAMIKUS_ÉRTÉK§')
    .replace(/\{dynamic\}/g, '§DINAMIKUS_ÉRTÉK§')
    .replace(/@(?:else\s+if|if|for|switch|case|default|else)\b[^{]*\{/g, ' ')
    .replace(/[{}]/g, ' ')
    .replaceAll('§DINAMIKUS_ÉRTÉK§', '{érték}')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBindingExpression(value) {
  return value.startsWith('[') || value.includes('() =>') || value.includes('?.');
}

function isTemplateControlFlow(value) {
  return !/[A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]/.test(value) || value === '{érték}' ||
    value.startsWith('@if') || value.startsWith('@else') ||
    value.startsWith('@for') || value.startsWith('@switch') || value.startsWith('@case') ||
    value.startsWith('@default') || value.startsWith('<!--');
}

function nearestOpeningTag(template, offset) {
  const prefix = template.slice(0, offset + 1);
  const matches = [...prefix.matchAll(/<([\w-]+)(?:\s[^>]*)?>/g)];
  return matches.at(-1)?.[1]?.toLowerCase() ?? '';
}

function attributeContext(tag, attribute) {
  if (attribute === 'aria-label') return 'Akadálymentes név';
  if (attribute === 'placeholder') return 'Mezősúgó';
  if (attribute === 'title') return 'Cím';
  return tag === 'p-button' || tag === 'button' ? 'Művelet' : 'Címke';
}

function textContext(tag) {
  if (/^h[1-6]$/.test(tag) || tag === 'title') return 'Cím';
  if (tag === 'label' || tag === 'legend') return 'Mező';
  if (tag === 'button' || tag === 'a' || tag === 'p-button') return 'Művelet';
  if (tag === 'small') return 'Súgó';
  return 'Látható szöveg';
}

function screenFor(source) {
  const mappings = [
    ['app.component', 'Alkalmazáskeret'],
    ['project-list', 'Áttekintő'],
    ['project-create', 'Új projekt'],
    ['active-project-queue', 'Folyamatban lévő ügyek'],
    ['open-discovery-follow-ups', 'Utánkövetések'],
    ['projects/discovery-follow-ups', 'Felkészültség'],
    ['project-context', 'Projektkörnyezet'],
    ['project-status', 'Projektállapot'],
    ['interview-handoff', 'Felmérési összefoglaló'],
    ['interview.page', 'Felmérés'],
    ['readiness', 'Felkészültség'],
    ['decision-review', 'Döntési értékelés'],
    ['markdown/markdown', 'Markdown terv'],
    ['project-settings', 'Projektbeállítások'],
    ['customer-correspondences', 'Ügyféllevelezés'],
    ['customer-replies', 'Ügyféllevelezés'],
    ['customer-follow-up', 'Ügyfél-emlékeztető'],
    ['customer-mail-triage', 'Nem társított ügyfélüzenetek'],
    ['markdown-template', 'Markdown beállítások'],
    ['question-bank', 'Kérdésbank beállítások'],
  ];
  return mappings.find(([needle]) => source.includes(needle))?.[1] ?? 'Megosztott felületi szöveg';
}

function deduplicateInventory(entries) {
  const seen = new Set();
  return entries.filter(([screen, context, copy]) => {
    const key = `${screen}\u0000${context}\u0000${copy}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
