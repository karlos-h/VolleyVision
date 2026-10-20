/**
 * Reads named keys from a .env-style file for the region-move scripts, so Claude
 * can run them without ever typing (or seeing) a secret: backup.ps1 does the
 * same in PowerShell. Pure on purpose (no fs, no process.env) so it is testable;
 * callers read the file and pass the text. Values are never logged.
 */

/** KEY=value lines: optional `export `, optional matching quotes, `#` comment lines, CRLF. */
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const m = raw.replace(/\r$/, '').match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

/**
 * For each `target: sourceKey` in `map`, sets env[target] from the file's sourceKey,
 * only when env[target] is unset/empty. Touches nothing but the targets.
 */
export function applyEnvFile(text: string, map: Record<string, string>, env: Record<string, string | undefined>): void {
  const file = parseEnvFile(text);
  for (const [target, key] of Object.entries(map)) {
    if (!env[target] && file[key]) env[target] = file[key];
  }
}
