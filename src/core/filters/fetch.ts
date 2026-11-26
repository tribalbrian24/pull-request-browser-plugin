export const isSafeRepoPath = (path: string) =>
  path.length > 0 &&
  path.length <= 200 &&
  !path.startsWith('/') &&
  !path.includes('\\') &&
  !Array.from(path).some(c => c.charCodeAt(0) < 32) &&
  !path.split('/').some(seg => seg === '..' || seg === '');

export function rawUrl(origin: string, repo: string, ref: string, path: string): string {
  const enc = (s: string) => s.split('/').map(encodeURIComponent).join('/');
  return `${origin}/${repo}/raw/${enc(ref)}/${enc(path)}`;
}
