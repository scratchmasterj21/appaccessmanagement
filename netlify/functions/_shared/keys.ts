/**
 * Same encoding as src/lib/firebaseKeys.ts so Blob keys are valid and consistent.
 */

const MAP: [string, string][] = [
  ['.', '__DOT__'],
  ['#', '__HASH__'],
  ['$', '__DOLLAR__'],
  ['/', '__SLASH__'],
  ['[', '__OB__'],
  [']', '__CB__'],
];

export function encodeKey(key: string): string {
  let s = key;
  for (const [char, placeholder] of MAP) {
    s = s.split(char).join(placeholder);
  }
  return s;
}

export function decodeKey(key: string): string {
  let s = key;
  for (const [char, placeholder] of MAP) {
    s = s.split(placeholder).join(char);
  }
  return s;
}
