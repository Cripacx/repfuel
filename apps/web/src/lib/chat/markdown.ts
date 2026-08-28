/**
 * Markdown-Subset-Renderer für Coach-Antworten. Bewusst ohne Library: der
 * Eingabetext wird zuerst vollständig HTML-escaped, erst danach entstehen
 * eigene Tags — es kann also nie Roh-HTML aus dem Modell in die Seite gelangen.
 *
 * Unterstützt: Absätze, Zeilenumbrüche, **fett**, *kursiv*, `Code`,
 * ```Codeblöcke```, #–### Überschriften, -/*-Listen, 1.-Listen, --- Trenner
 * und [Text](https://…)-Links. Alles andere bleibt Klartext.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Platzhalter für Code-Spans, damit Fett/Kursiv nicht in Code hineinformatieren. */
const CODE_TOKEN = '\u0000';

function renderInline(raw: string): string {
  const codeSpans: string[] = [];
  const withTokens = raw.replace(/`([^`\n]+)`/g, (_match, code: string) => {
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return `${CODE_TOKEN}${codeSpans.length - 1}${CODE_TOKEN}`;
  });

  let text = escapeHtml(withTokens);
  text = text.replace(
    /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_match, label: string, url: string) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`,
  );
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>');

  return text.replace(
    new RegExp(`${CODE_TOKEN}(\\d+)${CODE_TOKEN}`, 'g'),
    (_match, index: string) => codeSpans[Number(index)] ?? '',
  );
}

export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let paragraph: string[] = [];
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let code: string[] | null = null;

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    html.push(`<p>${paragraph.map(renderInline).join('<br />')}</p>`);
    paragraph = [];
  };
  const flushList = (): void => {
    if (!list) return;
    html.push(`<${list.type}>${list.items.map((item) => `<li>${item}</li>`).join('')}</${list.type}>`);
    list = null;
  };
  const pushListItem = (type: 'ul' | 'ol', item: string): void => {
    flushParagraph();
    if (list && list.type !== type) flushList();
    list ??= { type, items: [] };
    list.items.push(renderInline(item));
  };

  for (const line of lines) {
    if (code) {
      if (line.trim().startsWith('```')) {
        html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        code = null;
      } else {
        code.push(line);
      }
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      flushParagraph();
      flushList();
      code = [];
      continue;
    }
    if (trimmed === '') {
      flushParagraph();
      flushList();
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      flushParagraph();
      flushList();
      html.push('<hr />');
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      // Chat-Bubble: Überschriften bleiben klein — # wird zu h3, ### zu h5.
      const level = heading[1]!.length + 2;
      html.push(`<h${level}>${renderInline(heading[2]!)}</h${level}>`);
      continue;
    }

    const bullet = /^[-*•]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      pushListItem('ul', bullet[1]!);
      continue;
    }
    const ordered = /^\d{1,3}[.)]\s+(.*)$/.exec(trimmed);
    if (ordered) {
      pushListItem('ol', ordered[1]!);
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  // Offene Blöcke am Ende (auch mitten im Stream) sauber schließen.
  if (code) html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  flushParagraph();
  flushList();

  return html.join('');
}
