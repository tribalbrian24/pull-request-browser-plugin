import type { CapturedComment, CapturedThread } from './types';

export const FENCE = '`'.repeat(3);

export const stripOriginallyPosted = (text: string) =>
  text
    .replace(/^[ \t]*(?:>[ \t]*)*[_*]*[ \t]*Originally posted by\b.*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const SKIP = 'button, svg, clipboard-copy, .zeroclipboard-container, .js-reactions-container, .timeline-comment-actions';

export function htmlToMarkdown(root: Element): string {
  const walk = (node: Node): string => {
    if (node.nodeType === 3) return (node.textContent ?? '').replace(/\s+/g, ' ');
    if (node.nodeType !== 1) return '';
    const el = node as Element;
    if (el.matches(SKIP)) return '';
    const kids = () => Array.from(el.childNodes).map(walk).join('');
    const tag = el.tagName.toLowerCase();
    switch (tag) {
      case 'pre':
        return `\n\n${FENCE}\n${(el.textContent ?? '').replace(/\n$/, '')}\n${FENCE}\n\n`;
      case 'code':
        return `\`${el.textContent ?? ''}\``;
      case 'a':
        return `[${kids().trim()}](${el.getAttribute('href') ?? ''})`;
      case 'strong':
      case 'b':
        return `**${kids().trim()}**`;
      case 'em':
      case 'i':
        return `*${kids().trim()}*`;
      case 'br':
        return '\n';
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        return `\n\n${'#'.repeat(Number(tag[1]))} ${kids().trim()}\n\n`;
      case 'blockquote':
        return `\n\n${kids().trim().split('\n').map(l => `> ${l}`).join('\n')}\n\n`;
      case 'ul':
      case 'ol': {
        let i = 0;
        const items = Array.from(el.children)
          .filter(c => c.tagName === 'LI')
          .map(li => `${tag === 'ol' ? `${++i}.` : '-'} ${walk(li).trim().replace(/\n/g, '\n  ')}`);
        return `\n\n${items.join('\n')}\n\n`;
      }
      case 'details':
        return `\n\n${kids().trim()}\n\n`;
      case 'summary':
        return `\n\n**${kids().trim()}**\n\n`;
      case 'p':
      case 'div':
      case 'li':
      case 'table':
      case 'tr':
        return `\n\n${kids().trim()}\n\n`;
      default:
        return kids();
    }
  };
  return walk(root).replace(/\n{3,}/g, '\n\n').trim();
}

export interface RenderOpts {
  labelFor?: (c: CapturedComment) => boolean;
}

export function renderThread(t: CapturedThread, opts: RenderOpts = {}): string {
  const labelFor = opts.labelFor ?? (() => true);
  const first = t.comments[0];
  const reviewName = first && (first.agent && labelFor(first) ? first.agent : first.author);
  const header =
    t.kind === 'review'
      ? `# Review summary${reviewName ? ` — ${reviewName}` : ''}${t.when ? `, ${t.when}` : ''}`
      : `# \`${t.path}${t.range ? `:${t.range}` : ''}\``;
  const multi = t.comments.length > 1;
  const body = t.comments
    .map(c => {
      const text = c.text ? stripOriginallyPosted(c.text) : `(failed to copy comment: ${c.reason})`;
      const tag = c.status && c.status !== 'unchanged' ? `(${c.status})` : '';
      const labelled = !!c.agent && labelFor(c);
      const name = [labelled ? c.agent : c.author, tag].filter(Boolean).join(' ');
      const prefixed = !!name && (t.kind === 'review' ? !!tag : multi || labelled || !!tag);
      return prefixed ? `**${name}:**\n\n${text}` : text;
    })
    .join('\n\n---\n\n');
  let block = `${header}\n\n${body}`;
  if (t.suggestionLines.length) block += `\n\n${FENCE}\n${t.suggestionLines.join('\n')}\n${FENCE}`;
  return block;
}

export const renderMarkdown = (threads: CapturedThread[], opts: RenderOpts = {}) =>
  threads.map(t => renderThread(t, opts)).join('\n\n');
