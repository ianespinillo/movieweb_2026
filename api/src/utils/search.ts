import { Request } from 'express';

const MAX_QUERY_LENGTH = 100;

/**
 * Reads and normalizes the `q` query param. Returns null when it is missing or blank.
 */
export function readSearchTerm(req: Request): string | null {
  const raw = req.query['q'];
  if (typeof raw !== 'string') return null;

  const q = raw.trim().slice(0, MAX_QUERY_LENGTH);
  return q.length > 0 ? q : null;
}

// Each plain letter with the accented versions it should also match.
const ACCENT_VARIANTS: Record<string, string> = {
  a: 'aáàâäãåāăą', e: 'eéèêëēėęě', i: 'iíìîïīį', o: 'oóòôöõøōő', u: 'uúùûüūůű',
  n: 'nñńň', c: 'cçćč', s: 'sšśş', z: 'zžźż', y: 'yýÿ', d: 'dđď', l: 'lł', r: 'rř', t: 'tť', g: 'gğ',
};
// Letters that do not decompose into base letter + accent
const STANDALONE: Record<string, string> = { 'ø': 'o', 'đ': 'd', 'ł': 'l' };

/**
 * Builds the regular expression for `column ~* $1`: contains the term, ignoring case and
 * accents, so "darin" and "darín" both find "Darín". Everything the user typed that is not a
 * letter or a digit is escaped, so searching "100%" or "a.b" matches those literal characters.
 *
 * The accents are expanded in the pattern (d[aá...]r[ií...]n) instead of removing them from
 * the column, which would mean rewriting all ~105k names on every search.
 */
export function searchRegex(term: string): string {
  const plain = term.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

  return [...plain]
    .map((char) => {
      const variants = ACCENT_VARIANTS[STANDALONE[char] ?? char];
      if (variants) return `[${variants}]`;
      return /[\p{L}\p{N}\s]/u.test(char) ? char : `\\${char}`;
    })
    .join('');
}
