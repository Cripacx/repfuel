import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown.js';

describe('renderMarkdown', () => {
  it('escapes raw HTML — no model output reaches the DOM as markup', () => {
    expect(renderMarkdown('<script>alert(1)</script>')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    );
    expect(renderMarkdown('a <img src=x onerror=x> b')).toContain('&lt;img');
  });

  it('renders bold, italic and inline code', () => {
    expect(renderMarkdown('**Warum Ganzkörper statt Push/Pull/Beine o.ä.:**')).toBe(
      '<p><strong>Warum Ganzkörper statt Push/Pull/Beine o.ä.:</strong></p>',
    );
    expect(renderMarkdown('ein *wichtiger* Punkt')).toBe('<p>ein <em>wichtiger</em> Punkt</p>');
    expect(renderMarkdown('nutze `pnpm test` lokal')).toBe(
      '<p>nutze <code>pnpm test</code> lokal</p>',
    );
  });

  it('does not format bold/italic inside inline code', () => {
    expect(renderMarkdown('`**kein fett**`')).toBe('<p><code>**kein fett**</code></p>');
  });

  it('renders bullet and ordered lists', () => {
    expect(renderMarkdown('- Kniebeugen\n- Bankdrücken')).toBe(
      '<ul><li>Kniebeugen</li><li>Bankdrücken</li></ul>',
    );
    expect(renderMarkdown('1. Aufwärmen\n2. Arbeitssätze')).toBe(
      '<ol><li>Aufwärmen</li><li>Arbeitssätze</li></ol>',
    );
  });

  it('renders small headings and paragraphs with line breaks', () => {
    expect(renderMarkdown('### Tag A')).toBe('<h5>Tag A</h5>');
    expect(renderMarkdown('# Plan')).toBe('<h3>Plan</h3>');
    expect(renderMarkdown('Zeile 1\nZeile 2\n\nAbsatz 2')).toBe(
      '<p>Zeile 1<br />Zeile 2</p><p>Absatz 2</p>',
    );
  });

  it('renders fenced code blocks and closes them at stream end', () => {
    expect(renderMarkdown('```\nconst a = 1;\n```')).toBe('<pre><code>const a = 1;</code></pre>');
    expect(renderMarkdown('```\nunvollständig')).toBe('<pre><code>unvollständig</code></pre>');
  });

  it('renders only http(s) links, with rel=noopener', () => {
    expect(renderMarkdown('[Docs](https://example.com/a?b=1)')).toBe(
      '<p><a href="https://example.com/a?b=1" target="_blank" rel="noopener noreferrer">Docs</a></p>',
    );
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('<a ');
  });

  it('renders horizontal rules', () => {
    expect(renderMarkdown('oben\n\n---\n\nunten')).toBe('<p>oben</p><hr /><p>unten</p>');
  });
});
