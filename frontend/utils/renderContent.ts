function looksLikeHtml(text: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** Strip HTML (e.g. WordPress imports) down to readable plain text. */
export function htmlToPlainText(html: string): string {
  const withBreaks = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article)>/gi, '\n')
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<\/?(ul|ol|table|thead|tbody|tfoot)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '');

  return decodeEntities(withBreaks)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Simple markdown-ish renderer for CMS pages (headings, lists, tables, paragraphs). */
export function renderContentHtml(text: string) {
  // WP-imported pages store HTML; never show raw tags — convert to plain text first.
  const source = looksLikeHtml(text) ? htmlToPlainText(text) : text;
  const escaped = escapeHtml(source);

  const lines = escaped.split('\n');
  const html: string[] = [];
  let listItems: string[] = [];
  let tableRows: string[] = [];

  function flushList() {
    if (!listItems.length) return;
    html.push(
      `<ul class="list-disc ms-5 my-2 space-y-1 leading-7">${listItems.map((item) => `<li>${item}</li>`).join('')}</ul>`
    );
    listItems = [];
  }

  function parseCells(row: string) {
    return row
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());
  }

  function isSeparator(cells: string[]) {
    return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell.replace(/\s/g, '')));
  }

  function flushTable() {
    if (!tableRows.length) return;

    if (tableRows.length === 1) {
      html.push(`<p class="mb-2 leading-7">${tableRows[0]}</p>`);
      tableRows = [];
      return;
    }

    const parsed = tableRows.map(parseCells);
    const header = parsed[0] || [];
    const body = parsed.slice(1).filter((row) => !isSeparator(row));

    const head = header.map((cell) => `<th>${cell}</th>`).join('');
    const rows = body
      .map((row) => `<tr>${row.map((cell) => `<td>${cell || '—'}</td>`).join('')}</tr>`)
      .join('');

    html.push(
      `<div class="overflow-x-auto my-3"><table class="data-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`
    );
    tableRows = [];
  }

  function headingOrParagraph(line: string) {
    if (/^### /.test(line)) {
      html.push(`<h3 class="text-base font-bold mt-5 mb-2">${line.slice(4)}</h3>`);
      return;
    }
    if (/^## /.test(line)) {
      html.push(`<h2 class="text-lg font-bold mt-5 mb-2">${line.slice(3)}</h2>`);
      return;
    }
    if (/^# /.test(line)) {
      html.push(`<h1 class="text-xl font-bold mb-3">${line.slice(2)}</h1>`);
      return;
    }
    if (!line.trim()) return;
    html.push(`<p class="mb-2 leading-7">${line}</p>`);
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.includes('|', 1)) {
      flushList();
      tableRows.push(trimmed);
      continue;
    }

    flushTable();

    if (/^[-*] /.test(trimmed) || /^• /.test(trimmed)) {
      listItems.push(trimmed.replace(/^([-*] |• )/, ''));
      continue;
    }

    flushList();
    headingOrParagraph(line);
  }

  flushList();
  flushTable();
  return html.join('');
}
