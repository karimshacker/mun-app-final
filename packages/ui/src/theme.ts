/**
 * MIANU-SM IV design system — "secret agent" monochrome.
 *
 * Rules of the house:
 *  - Black, white, and greys only. Information is carried by type weight,
 *    rules, and position — never by colour. The single exception is the
 *    DENIED state, which inverts (white on black) so a rejected scan reads
 *    instantly in a noisy doorway.
 *  - One accent: a single hairline rule (1px ink) frames everything.
 *  - Type is monospaced where it is data (codes, refs, UIDs, times) and
 *    grotesque sans where it is human language.
 *  - All CTAs are high-contrast, large-touch (min 56pt), bottom-anchored so
 *    the thumb reaches them while holding a stack of badges.
 *
 * Scale note (v2): the first revision was sized for arm's-length kiosk use
 * and read zoomed-in in hand. The scale is now handheld-first: display 24,
 * inputs 19, body 15 — still chunky enough for a doorway glance, but
 * everything fits a 6.1" phone without scrolling.
 */

export const ink = {
  /** pure white page */
  paper: '#FFFFFF',
  /** body type, primary */
  ink: '#0A0A0A',
  /** secondary type, captions — neutral grey, no blue cast */
  ash: '#6E6E6E',
  /** hairline rules and borders */
  rule: '#0A0A0A',
  /** disabled / quiet fills */
  smoke: '#EDEDED',
  /** mid grey for subdued surfaces */
  fog: '#D5D5D5',
  /** inverse of ink — used for the denied state */
  inverse: '#FFFFFF',
} as const;

export type Ink = typeof ink[keyof typeof ink];

/** Type scale. Every size is used deliberately; nothing in between. */
export const type = {
  /** station title at top of a scan screen */
  display: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.4 },
  /** big scan outcome verdict */
  verdict: { fontSize: 21, fontWeight: '800' as const, letterSpacing: -0.2 },
  /** participant name on a receipt */
  name: { fontSize: 18, fontWeight: '700' as const },
  /** section headers */
  title: { fontSize: 17, fontWeight: '700' as const },
  /** primary body copy */
  body: { fontSize: 15, fontWeight: '400' as const },
  /** labels above inputs, captions */
  label: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  /** alt codes, refs, UIDs, timestamps */
  mono: { fontSize: 15, fontWeight: '600' as const, letterSpacing: 2, fontFamily: 'ui-monospace' },
} as const;

export const layout = {
  /** 20pt page gutter — thumb-safe both sides */
  gutter: 20,
  /** hairline rule thickness */
  hair: 1,
  /** minimum tap target — iOS HIG / Material both ask for ~48-56 */
  touch: 56,
  /** card padding */
  pad: 14,
} as const;

export const radii = {
  /** sharp corners: the whole system is angular, no pills */
  none: 0,
  /** the one softening used, on inputs only */
  soft: 4,
} as const;

/**
 * The scan verdicts split into three classes. Colour stays out of it; the
 * classes differ by weight, inversion, and rules instead.
 */
export type VerdictTone = 'go' | 'hold' | 'deny';
