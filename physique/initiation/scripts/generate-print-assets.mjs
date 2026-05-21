import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CARD_DEFINITIONS, DECK_COMPOSITION } from '../../../internet/v2/public/assets/js/cards.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const printDir = resolve(repoRoot, 'physique/initiation/impression');
const sourceDir = resolve(printDir, 'sources');
const downloadDir = resolve(repoRoot, 'internet/v2/public/assets/downloads');
const pngZip = resolve(repoRoot, 'physique/initiation/cartes/stack_ou_pas_stack_cartes_png_quadratique.zip');
const rulesMarkdown = resolve(repoRoot, 'physique/initiation/regles/REGLES_INITIATION_QUADRATIQUE.md');
const rulesPdf = resolve(printDir, 'stack_ou_pas_stack_regles_initiation_quadratique.pdf');

const outputFiles = {
  J1: resolve(printDir, 'stack_ou_pas_stack_initiation_quadratique_J1_recto_verso.pdf'),
  J2: resolve(printDir, 'stack_ou_pas_stack_initiation_quadratique_J2_recto_verso.pdf'),
  ALL: resolve(printDir, 'stack_ou_pas_stack_initiation_quadratique_planches_recto_verso.pdf')
};

const htmlFiles = {
  J1: resolve(sourceDir, 'stack_ou_pas_stack_initiation_quadratique_J1_recto_verso.html'),
  J2: resolve(sourceDir, 'stack_ou_pas_stack_initiation_quadratique_J2_recto_verso.html'),
  ALL: resolve(sourceDir, 'stack_ou_pas_stack_initiation_quadratique_planches_recto_verso.html'),
  RULES: resolve(sourceDir, 'stack_ou_pas_stack_regles_initiation_quadratique.html')
};

const kitZip = resolve(downloadDir, 'stack-ou-pas-stack-kit-impression-physique.zip');
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});
const cardOrder = expandDeck();
const chrome = findChrome();

mkdirSync(sourceDir, { recursive: true });
mkdirSync(downloadDir, { recursive: true });

const j1 = buildDeckHtml('J1', 'Joueur Cyan', '#4ecdc4', cardOrder);
const j2 = buildDeckHtml('J2', 'Joueur Orange', '#ffd166', cardOrder);

writeFileSync(htmlFiles.J1, buildDocument('Stack ou pas Stack - J1', [j1]), 'utf8');
writeFileSync(htmlFiles.J2, buildDocument('Stack ou pas Stack - J2', [j2]), 'utf8');
writeFileSync(htmlFiles.ALL, buildDocument('Stack ou pas Stack - Planches', [j1, j2]), 'utf8');
writeFileSync(htmlFiles.RULES, buildRulesDocument(readFileSync(rulesMarkdown, 'utf8')), 'utf8');

for (const key of ['J1', 'J2', 'ALL']) {
  printPdf(htmlFiles[key], outputFiles[key]);
}
printPdf(htmlFiles.RULES, rulesPdf);

writeCardPngZip(pngZip, [
  { code: 'J1', label: 'Joueur Cyan', accent: '#4ecdc4', cards: cardOrder },
  { code: 'J2', label: 'Joueur Orange', accent: '#ffd166', cards: cardOrder }
]);

writeZip(kitZip, [
  resolve(printDir, 'stack_ou_pas_stack_initiation_quadratique_planches_recto_verso.pdf'),
  resolve(printDir, 'stack_ou_pas_stack_initiation_quadratique_J1_recto_verso.pdf'),
  resolve(printDir, 'stack_ou_pas_stack_initiation_quadratique_J2_recto_verso.pdf'),
  rulesPdf,
  resolve(printDir, 'plateau_compact_2xA4_v3b.pdf')
]);

console.log('Planches generees :');
console.log(`- ${relative(outputFiles.J1)}`);
console.log(`- ${relative(outputFiles.J2)}`);
console.log(`- ${relative(outputFiles.ALL)}`);
console.log(`- ${relative(rulesPdf)}`);
console.log(`- ${relative(pngZip)}`);
console.log(`- ${relative(kitZip)}`);

function expandDeck() {
  const cards = [];
  for (const [key, count] of DECK_COMPOSITION) {
    const card = CARD_DEFINITIONS[key];
    if (!card) throw new Error(`Carte inconnue dans DECK_COMPOSITION : ${key}`);
    for (let i = 1; i <= count; i += 1) {
      cards.push({ ...card, copy: i });
    }
  }
  return cards;
}

function buildDeckHtml(code, label, accent, cards) {
  const pages = chunk(cards, 9);
  return pages.flatMap((pageCards, pageIndex) => [
    renderPage({
      code,
      label,
      accent,
      side: 'recto',
      pageIndex,
      cards: pageCards.map((card) => renderCardFace(code, accent, card))
    }),
    renderPage({
      code,
      label,
      accent,
      side: 'verso',
      pageIndex,
      cards: pageCards.map((card) => renderCardBack(label, accent, card.type))
    })
  ]).join('\n');
}

function renderPage({ code, label, accent, side, pageIndex, cards }) {
  return `
    <section class="sheet" style="--accent:${accent}">
      <div class="sheet-title">${escapeHtml(label)} - ${side.toUpperCase()} ${pageIndex + 1} - ${code}</div>
      <div class="grid">
        ${cards.join('\n')}
      </div>
    </section>`;
}

function renderCardFace(playerCode, accent, card) {
  const typeClass = typeToClass(card.type);
  const textClass = card.description.length > 260 ? 'text-xlong' : card.description.length > 190 ? 'text-long' : '';
  const rule = card.type === 'Fonction'
    ? `${card.mode === 'fixe' ? 'Empiler' : "Empiler jusqu'a"} ${card.maxR} - valeur ${card.value}`
    : `Cout ${card.cost}`;
  return `
    <article class="card ${typeClass} ${textClass}" style="--accent:${accent}">
      <header class="card-header">
        <span>${escapeHtml(card.type)}</span>
        <strong>Cout ${card.cost}</strong>
      </header>
      <h2>${escapeHtml(card.name)}</h2>
      <div class="rule">${escapeHtml(rule)}</div>
      <p>${formatDescription(card.description)}</p>
      <footer>${playerCode} - ${escapeHtml(card.name)} ${card.copy > 1 ? card.copy : ''}</footer>
    </article>`;
}

function renderCardBack(label, accent, type) {
  return `
    <article class="card back ${typeToClass(type)}" style="--accent:${accent}">
      <div class="back-frame">
        <div class="back-mark">STACK</div>
        <div class="back-sub">OU PAS STACK</div>
        <div class="back-type">${escapeHtml(type === 'Fonction' ? 'Pioche Fonctions' : 'Pioche Systeme')}</div>
        <div class="back-player">${escapeHtml(label)}</div>
      </div>
    </article>`;
}

function buildDocument(title, bodies) {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #10140f; color: #f7f2e9; font-family: Arial, Helvetica, sans-serif; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet {
      width: 194mm;
      height: 281mm;
      padding: 0;
      break-after: page;
      page-break-after: always;
      background: #10140f;
      position: relative;
    }
    .sheet-title {
      height: 8mm;
      color: #c9d4c7;
      font-size: 8pt;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 63mm);
      grid-auto-rows: 88mm;
      gap: 2mm 2mm;
    }
    .card {
      width: 63mm;
      height: 88mm;
      border: .55mm solid color-mix(in srgb, var(--accent), #f7f2e9 36%);
      border-radius: 4mm;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.02)),
        #1b201b;
      color: #f7f2e9;
      padding: 4mm;
      display: flex;
      flex-direction: column;
      gap: 2.2mm;
      box-shadow: inset 0 0 0 .25mm rgba(255,255,255,.14);
      position: relative;
    }
    .card::before {
      content: "";
      position: absolute;
      inset: 1.8mm;
      border: .25mm dashed rgba(255,255,255,.12);
      border-radius: 3mm;
      pointer-events: none;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 2mm;
      color: #f7f2e9;
      font-size: 7.6pt;
      text-transform: uppercase;
      letter-spacing: .04em;
      position: relative;
      z-index: 1;
    }
    .card-header span,
    .card-header strong {
      border: .3mm solid color-mix(in srgb, var(--accent), #ffffff 32%);
      border-radius: 99px;
      padding: 1.1mm 1.7mm;
      background: color-mix(in srgb, var(--accent), #1b201b 76%);
      white-space: nowrap;
    }
    h2 {
      margin: 0;
      font-size: 15pt;
      line-height: 1.05;
      color: #ffffff;
      position: relative;
      z-index: 1;
    }
    .rule {
      border: .35mm solid color-mix(in srgb, var(--accent), #ffffff 22%);
      border-radius: 2.2mm;
      padding: 1.7mm;
      background: color-mix(in srgb, var(--accent), #ffffff 82%);
      color: #20221e;
      font-size: 9.4pt;
      font-weight: 700;
      line-height: 1.14;
      position: relative;
      z-index: 1;
    }
    p {
      margin: 0;
      color: #e7e2d8;
      font-size: 9.25pt;
      line-height: 1.19;
      position: relative;
      z-index: 1;
      overflow-wrap: anywhere;
    }
    .text-long p {
      font-size: 8.1pt;
      line-height: 1.12;
    }
    .text-xlong p {
      font-size: 7pt;
      line-height: 1.08;
    }
    .text-xlong h2 {
      font-size: 13.4pt;
    }
    .text-xlong .rule {
      font-size: 8.4pt;
      padding: 1.35mm;
    }
    footer {
      margin-top: auto;
      color: rgba(247,242,233,.68);
      font-size: 6.8pt;
      text-transform: uppercase;
      letter-spacing: .04em;
      position: relative;
      z-index: 1;
    }
    .command { --type:#7ee787; }
    .interrupt { --type:#ff7b72; }
    .hardware { --type:#ffd166; }
    .function { --type:#4ecdc4; }
    .card.command, .card.interrupt, .card.hardware, .card.function {
      border-color: color-mix(in srgb, var(--type), #ffffff 18%);
    }
    .back {
      padding: 5mm;
      align-items: stretch;
      justify-content: stretch;
      background:
        radial-gradient(circle at 18% 16%, color-mix(in srgb, var(--accent), transparent 55%), transparent 24%),
        radial-gradient(circle at 82% 82%, color-mix(in srgb, var(--type), transparent 58%), transparent 28%),
        linear-gradient(135deg, #121812, #252a22);
    }
    .back-frame {
      flex: 1;
      border: .5mm solid rgba(255,255,255,.24);
      border-radius: 3mm;
      display: grid;
      place-items: center;
      text-align: center;
      padding: 6mm 4mm;
      background:
        repeating-linear-gradient(45deg, rgba(255,255,255,.06) 0 1.5mm, transparent 1.5mm 3mm);
      position: relative;
      z-index: 1;
    }
    .back-mark {
      font-size: 24pt;
      font-weight: 900;
      letter-spacing: .08em;
      color: #ffffff;
      text-shadow: 0 0 8px color-mix(in srgb, var(--accent), transparent 30%);
    }
    .back-sub {
      margin-top: -16mm;
      font-size: 9pt;
      letter-spacing: .16em;
      color: #d9eadf;
    }
    .back-type {
      align-self: end;
      font-size: 10pt;
      font-weight: 800;
      color: #f7f2e9;
    }
    .back-player {
      font-size: 8pt;
      color: rgba(247,242,233,.7);
    }
  </style>
</head>
<body>
${bodies.join('\n')}
</body>
</html>`;
}

function buildRulesDocument(markdown) {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Stack ou pas Stack - Règles initiation quadratique</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #1f261f;
      background: #ffffff;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10.6pt;
      line-height: 1.34;
    }
    h1 {
      margin: 0 0 8mm;
      color: #10201e;
      font-size: 22pt;
      line-height: 1.05;
    }
    h2 {
      margin: 8mm 0 3mm;
      color: #17433e;
      font-size: 15pt;
      break-after: avoid;
    }
    h3 {
      margin: 5mm 0 2mm;
      color: #2f514d;
      font-size: 12pt;
      break-after: avoid;
    }
    p, ul, ol {
      margin: 0 0 3mm;
    }
    ul, ol {
      padding-left: 6mm;
    }
    li {
      margin: 0 0 1.4mm;
    }
    code {
      font-family: Consolas, monospace;
      background: #eef4f2;
      padding: .2mm 1mm;
      border-radius: 1mm;
    }
    strong {
      color: #122f2b;
    }
  </style>
</head>
<body>
${markdownToHtml(markdown)}
</body>
</html>`;
}

function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let list = null;

  const closeList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      closeList();
      html.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`);
      continue;
    }
    const bullet = /^-\s+(.+)$/.exec(trimmed);
    if (bullet) {
      if (list !== 'ul') {
        closeList();
        list = 'ul';
        html.push('<ul>');
      }
      html.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      continue;
    }
    const ordered = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (ordered) {
      if (list !== 'ol') {
        closeList();
        list = 'ol';
        html.push('<ol>');
      }
      html.push(`<li>${inlineMarkdown(ordered[1])}</li>`);
      continue;
    }
    closeList();
    html.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  }
  closeList();
  return html.join('\n');
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

function printPdf(htmlPath, pdfPath) {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`,
    pathToFileURL(htmlPath).href
  ];
  const result = spawnSync(chrome, args, { stdio: 'pipe', encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Chrome n'a pas pu generer ${pdfPath}\n${result.stderr || result.stdout}`);
  }
}

function writeCardPngZip(zipPath, decks) {
  const tempDir = mkdtempSync(resolve(tmpdir(), 'sops-cartes-'));
  const entries = [];
  try {
    for (const deck of decks) {
      const cards = orderCardsForPng(deck.cards);
      cards.forEach((card, index) => {
        const filename = `${deck.code}_${String(index + 1).padStart(2, '0')}_${card.type === 'Fonction' ? 'fonctions' : 'systeme'}_${slugify(card.name)}_${card.copy}.png`;
        const htmlPath = resolve(tempDir, `${filename}.html`);
        const pngPath = resolve(tempDir, filename);
        writeFileSync(htmlPath, buildPngDocument(`${deck.code} - ${card.name}`, deck, card), 'utf8');
        printPng(htmlPath, pngPath);
        entries.push({ name: `png_cartes/${filename}`, path: pngPath });
      });
    }
    writeZip(zipPath, entries);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function orderCardsForPng(cards) {
  return [...cards].sort((a, b) => {
    const typeRank = (a.type === 'Fonction' ? 0 : 1) - (b.type === 'Fonction' ? 0 : 1);
    return typeRank || a.name.localeCompare(b.name, 'fr') || a.copy - b.copy;
  });
}

function buildPngDocument(title, deck, card) {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      width: 600px;
      height: 840px;
      overflow: hidden;
      background: #10140f;
      color: #f7f2e9;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .card {
      width: 600px;
      height: 840px;
      border: 6px solid color-mix(in srgb, var(--accent), #f7f2e9 36%);
      border-radius: 36px;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.02)),
        #1b201b;
      color: #f7f2e9;
      padding: 36px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      box-shadow: inset 0 0 0 2px rgba(255,255,255,.14);
      position: relative;
    }
    .card::before {
      content: "";
      position: absolute;
      inset: 16px;
      border: 2px dashed rgba(255,255,255,.12);
      border-radius: 28px;
      pointer-events: none;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      color: #f7f2e9;
      font-size: 22px;
      text-transform: uppercase;
      letter-spacing: .04em;
      position: relative;
      z-index: 1;
    }
    .card-header span,
    .card-header strong {
      border: 2px solid color-mix(in srgb, var(--accent), #ffffff 32%);
      border-radius: 999px;
      padding: 10px 16px;
      background: color-mix(in srgb, var(--accent), #1b201b 76%);
      white-space: nowrap;
    }
    h2 {
      margin: 0;
      font-size: 54px;
      line-height: 1.05;
      color: #ffffff;
      position: relative;
      z-index: 1;
    }
    .rule {
      border: 2px solid color-mix(in srgb, var(--accent), #ffffff 22%);
      border-radius: 20px;
      padding: 16px;
      background: color-mix(in srgb, var(--accent), #ffffff 82%);
      color: #20221e;
      font-size: 34px;
      font-weight: 700;
      line-height: 1.14;
      position: relative;
      z-index: 1;
    }
    p {
      margin: 0;
      color: #e7e2d8;
      font-size: 32px;
      line-height: 1.16;
      position: relative;
      z-index: 1;
      overflow-wrap: anywhere;
    }
    .text-long p {
      font-size: 26px;
      line-height: 1.1;
    }
    .text-xlong p {
      font-size: 22px;
      line-height: 1.08;
    }
    .text-xlong h2 {
      font-size: 48px;
    }
    .text-xlong .rule {
      font-size: 30px;
      padding: 12px;
    }
    footer {
      margin-top: auto;
      color: rgba(247,242,233,.68);
      font-size: 20px;
      text-transform: uppercase;
      letter-spacing: .04em;
      position: relative;
      z-index: 1;
    }
    .command { --type:#7ee787; }
    .interrupt { --type:#ff7b72; }
    .hardware { --type:#ffd166; }
    .function { --type:#4ecdc4; }
    .card.command, .card.interrupt, .card.hardware, .card.function {
      border-color: color-mix(in srgb, var(--type), #ffffff 18%);
    }
  </style>
</head>
<body>
${renderCardFace(deck.code, deck.accent, card)}
</body>
</html>`;
}

function printPng(htmlPath, pngPath) {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--window-size=600,840',
    `--screenshot=${pngPath}`,
    pathToFileURL(htmlPath).href
  ];
  const result = spawnSync(chrome, args, { stdio: 'pipe', encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Chrome n'a pas pu generer ${pngPath}\n${result.stderr || result.stdout}`);
  }
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'google-chrome',
    'chrome',
    'chromium',
    'msedge'
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.includes('/') || candidate.includes('\\')) {
      if (existsSync(candidate)) return candidate;
      continue;
    }
    const probe = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
    if (probe.status === 0) return candidate;
  }
  throw new Error('Chrome, Edge ou Chromium est requis pour generer les PDF.');
}

function writeZip(zipPath, paths) {
  const files = paths
    .map((entry) => typeof entry === 'string'
      ? { name: relative(entry).replace(/\\/g, '/'), path: entry }
      : entry)
    .filter((entry) => existsSync(entry.path))
    .map((entry) => ({
      name: entry.name.replace(/\\/g, '/'),
      data: readFileSync(entry.path)
    }));
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const crc = crc32(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    chunks.push(local, name, file.data);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(0, 10);
    dir.writeUInt16LE(0, 12);
    dir.writeUInt16LE(0, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(file.data.length, 20);
    dir.writeUInt32LE(file.data.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, name);
    offset += local.length + name.length + file.data.length;
  }

  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  writeFileSync(zipPath, Buffer.concat([...chunks, ...central, end]));
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function formatDescription(text) {
  return escapeHtml(text).replaceAll('. ', '.<br>');
}

function typeToClass(type) {
  if (type === 'Fonction') return 'function';
  if (type === 'Commande') return 'command';
  if (type === 'Interrupt') return 'interrupt';
  if (type === 'Hardware') return 'hardware';
  return '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function chunk(values, size) {
  const result = [];
  for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size));
  return result;
}

function relative(path) {
  return path.replace(`${repoRoot}\\`, '').replace(`${repoRoot}/`, '');
}
