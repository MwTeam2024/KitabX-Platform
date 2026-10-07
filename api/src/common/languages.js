/**
 * Book language, as three different spellings in the same table: Google Books
 * stores a 2-letter code ("en"), Open Library a 3-letter one ("eng"), and the
 * manual-add form a full name ("English"). Everything user-facing (the
 * language filter, the add-book dropdown) works on the full name, so this is
 * the one place that turns any of them into it.
 */

export const OTHERS = 'Others';

/** Always offered, in this order, even before any book in that language exists. */
export const DEFAULT_LANGUAGES = [
  'Hindi', 'English', 'Bengali', 'Marathi', 'Telugu', 'Tamil', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi',
];

// name -> every code a source might have stored for it (lowercase).
const ALIASES = {
  English: ['en', 'eng'],
  Hindi: ['hi', 'hin'],
  Bengali: ['bn', 'ben'],
  Marathi: ['mr', 'mar'],
  Telugu: ['te', 'tel'],
  Tamil: ['ta', 'tam'],
  Gujarati: ['gu', 'guj'],
  Kannada: ['kn', 'kan'],
  Malayalam: ['ml', 'mal'],
  Punjabi: ['pa', 'pan'],
  Urdu: ['ur', 'urd'],
  Sanskrit: ['sa', 'san'],
};

const NAME_BY_CODE = new Map(
  Object.entries(ALIASES).flatMap(([name, codes]) => codes.map((c) => [c, name])),
);

let displayNames;
function intlName(code) {
  try {
    displayNames ||= new Intl.DisplayNames(['en'], { type: 'language' });
    const name = displayNames.of(code);
    // DisplayNames echoes the input back when it doesn't know the code.
    return name && name.toLowerCase() !== code.toLowerCase() ? name : null;
  } catch {
    return null;
  }
}

/** "en" / "eng" / "English" / "english" -> "English". null when it can't tell. */
export function languageName(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (key === OTHERS.toLowerCase()) return OTHERS;
  if (NAME_BY_CODE.has(key)) return NAME_BY_CODE.get(key);
  const known = Object.keys(ALIASES).find((n) => n.toLowerCase() === key);
  if (known) return known;
  // Locale-tagged codes like "en-US" collapse to their base language.
  const base = key.split(/[-_]/)[0];
  if (base !== key) return languageName(base);
  if (/^[a-z]{2,3}$/.test(key)) return intlName(key);
  // A full name we have no alias for (e.g. "French") is kept as written.
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
