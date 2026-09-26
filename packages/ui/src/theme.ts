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
  display: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.5 },
  /** big scan outcome verdict */
  verdict: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.3 },
  /** participant name on a receipt */
  name: { fontSize: 21, fontWeight: '700' as const },
  /** section headers */
  title: { fontSize: 19, fontWeight: '700' as const },
  /** primary body copy */
  body: { fontSize: 16, fontWeight: '400' as const },
  /** labels above inputs, captions */
  label: { fontSize: 13, fontWeight: '700' as const, letterSpacing: 1.4, textTransform: 'uppercase' as const },
  /** alt codes, refs, UIDs, timestamps */
  mono: { fontSize: 17, fontWeight: '600' as const, letterSpacing: 3, fontFamily: 'ui-monospace' },
} as const;

export const layout = {
  /** 24pt page gutter — thumb-safe both sides */
  gutter: 24,
  /** hairline rule thickness */
  hair: 1,
  /** minimum tap target — iOS HIG / Material both ask for ~48-56 */
  touch: 56,
  /** card padding */
  pad: 16,
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
