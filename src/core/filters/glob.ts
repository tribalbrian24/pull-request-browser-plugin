const escapeRe = (s: string) => s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');

function findClose(s: string, start: number, open: string, close: string): number {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '\\') i++;
    else if (s[i] === open) depth++;
    else if (s[i] === close && --depth === 0) return i;
  }
  return -1;
}

export function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let depth = 0;
  let inClass = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') {
      cur += c + (s[i + 1] ?? '');
      i++;
      continue;
    }
    if (inClass) {
      cur += c;
      if (c === ']') inClass = false;
      continue;
    }
    if (c === '[') inClass = true;
    else if (c === '{' || c === '(') depth++;
    else if (c === '}' || c === ')') depth = Math.max(0, depth - 1);
    if (c === sep && depth === 0 && !inClass) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function translate(g: string): string {
  let out = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '\\') {
      out += escapeRe(g[i + 1] ?? '\\');
      i++;
      continue;
    }
    if ('?+*@!'.includes(c) && g[i + 1] === '(') {
      const end = findClose(g, i + 1, '(', ')');
      if (end > 0) {
        const alts = splitTop(g.slice(i + 2, end), '|').map(translate).join('|');
        out += c === '!' ? `(?:(?!(?:${alts})(?:/|$))[^/]*)` : `(?:${alts})${c === '@' ? '' : c}`;
        i = end;
        continue;
      }
    }
    if (c === '*') {
      if (g[i + 1] === '*') {
        const segStart = i === 0 || g[i - 1] === '/';
        if (segStart && g[i + 2] === '/') {
          out += '(?:.*/)?';
          i += 2;
        } else if (segStart && i + 2 >= g.length) {
          out += '.*';
          i += 1;
        } else {
          out += '[^/]*';
          i += 1;
        }
      } else {
        out += '[^/]*';
      }
      continue;
    }
    if (c === '?') {
      out += '[^/]';
      continue;
    }
    if (c === '[') {
      const end = g.indexOf(']', i + 2);
      if (end > 0) {
        let cls = g.slice(i + 1, end);
        if (cls[0] === '!') cls = `^${cls.slice(1)}`;
        out += `[${cls.replace(/\\/g, '\\\\')}]`;
        i = end;
        continue;
      }
      out += '\\[';
      continue;
    }
    if (c === '{') {
      const end = findClose(g, i, '{', '}');
      if (end > 0) {
        const alts = splitTop(g.slice(i + 1, end), ',');
        if (alts.length > 1) {
          out += `(?:${alts.map(translate).join('|')})`;
          i = end;
          continue;
        }
      }
      out += '\\{';
      continue;
    }
    out += escapeRe(c);
  }
  return out;
}

/** gitignore-style, but case-insensitive (so .PNG and .png both match): no slash => any depth; leading / anchors; trailing / = directory contents. */
export function globToRegExp(glob: string): RegExp {
  let g = glob.trim();
  const anchored = g.startsWith('/');
  if (anchored) g = g.slice(1);
  const dirOnly = g.endsWith('/');
  if (dirOnly) g = g.slice(0, -1);
  const prefix = !anchored && !g.includes('/') ? '(?:.*/)?' : '';
  const suffix = dirOnly ? '/.*' : '(?:/.*)?';
  return new RegExp(`^${prefix}${translate(g)}${suffix}$`, 'i');
}

const cache = new Map<string, RegExp | null>();

/** `re:<regex>` patterns are tested against "/<path>" (Jest tests absolute paths). */
export function matchPattern(pattern: string, relPath: string): boolean {
  if (!pattern) return false;
  const isRe = pattern.startsWith('re:');
  let re = cache.get(pattern);
  if (re === undefined) {
    try {
      re = isRe ? new RegExp(pattern.slice(3)) : globToRegExp(pattern);
    } catch {
      re = null;
    }
    cache.set(pattern, re);
  }
  return re ? re.test(isRe ? `/${relPath}` : relPath) : false;
}

/** One pattern per line; commas also split, except inside {} () [] and in re: lines. # starts a comment line. */
export function parsePatterns(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = /^!?re:/.test(line) ? [line] : splitTop(line, ',');
    for (const p of parts) {
      const t = p.trim();
      if (t) out.push(t);
    }
  }
  return out;
}
