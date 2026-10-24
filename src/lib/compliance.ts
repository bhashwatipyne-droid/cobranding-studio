/**
 * SEBI wording check (FR-09). Warns only — never blocks editing or export.
 * Terms ported 1:1 from the approved prototype list.
 */
export const complianceSynonyms: Record<string, string[]> = {
  guaranteed: ["targeted", "potential"],
  guarantee: ["aim for", "target"],
  guarantees: ["aims for", "targets"],
  assured: ["expected", "anticipated"],
  assurance: ["expectation"],
  safe: ["relatively stable", "lower-risk"],
  safest: ["among the more stable"],
  "risk-free": ["market-linked"],
  riskfree: ["market-linked"],
  "zero risk": ["managed risk"],
  "no risk": ["managed risk"],
  best: ["leading", "preferred"],
  "best in class": ["among the top-performing"],
  "no.1": ["a leading"],
  "number 1": ["a leading"],
  "top rated": ["well-regarded"],
  double: ["grow", "increase"],
  triple: ["significantly grow"],
  multiply: ["grow"],
  highest: ["competitive", "among the highest"],
  "sure shot": ["potential"],
  "sure-shot": ["potential"],
  certain: ["likely", "expected"],
  definitely: ["may"],
  always: ["historically"],
  "never loses": ["has historically been resilient"],
  "never fails": ["has a consistent track record"],
  "fixed returns": ["indicative returns"],
  "assured returns": ["targeted returns"],
  "guaranteed returns": ["potential returns"],
  "guaranteed profit": ["potential gains"],
  "high returns": ["competitive returns"],
  "quick returns": ["returns over time"],
  "instant profit": ["potential gains over time"],
  "wealth guaranteed": ["wealth potential"],
  "100% safe": ["relatively stable"],
  "100% secure": ["well-managed"],
  "no loss": ["managed downside"],
  "risk free investment": ["market-linked investment"],
  "outperform every year": ["has aimed to perform competitively"],
};

export interface FlagSpan {
  a: number;
  b: number;
  term: string;
  raw: string;
}

const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Finds the stretches of text to flag. Kept phrases reserve their characters first,
 * and terms are matched longest-first so "safe" inside "100% safe" doesn't double-flag.
 * Whole-word matching avoids false positives like "best" in "bestow".
 */
export function computeFlagSpans(text: string, kept: string[] = []): FlagSpan[] {
  const taken = new Array<boolean>(text.length).fill(false);
  const reserve = (term: string) => {
    const re = new RegExp(esc(term), "ig");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      for (let i = m.index; i < m.index + m[0].length; i++) taken[i] = true;
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  };
  kept.forEach(reserve);

  const spans: FlagSpan[] = [];
  Object.keys(complianceSynonyms)
    .sort((a, b) => b.length - a.length)
    .forEach((term) => {
      const re = new RegExp(`(?<![\\w])${esc(term)}(?![\\w])`, "ig");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const a = m.index;
        const b = a + m[0].length;
        let free = true;
        for (let i = a; i < b; i++) if (taken[i]) { free = false; break; }
        if (free) {
          for (let i = a; i < b; i++) taken[i] = true;
          spans.push({ a, b, term, raw: m[0] });
        }
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    });
  return spans.sort((x, y) => x.a - y.a);
}

/** Replace a flagged term, preserving a leading capital where the original had one. */
export function replaceTerm(text: string, term: string, suggestion: string): string {
  const re = new RegExp(`(?<![\\w])${esc(term)}(?![\\w])`, "ig");
  return text.replace(re, (m) => (m[0] === m[0].toUpperCase() && /[a-z]/i.test(m[0]) ? suggestion[0].toUpperCase() + suggestion.slice(1) : suggestion));
}
