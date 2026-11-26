export const isPrPath = (pathname: string) => /^\/[^/]+\/[^/]+\/pull\/\d+/.test(pathname);

export function prSlug(pathname: string): string {
  const m = pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : 'pr';
}

export function repoOf(pathname: string): string {
  const m = pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/\d+/);
  return m ? `${m[1]}/${m[2]}` : '';
}

export function prKey(pathname: string): string {
  const m = pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  return m ? `${m[1]}/${m[2]}#${m[3]}` : '';
}
