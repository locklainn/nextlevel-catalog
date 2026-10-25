// GENERATED from goalsetters src/app/nlcommon/definitions/library-identity.ts — the
// app's own matcher, so `validate` predicts what the app will do. Re-copy it when
// that file changes; do not edit here.
const ARTICLES = /* @__PURE__ */ new Set(["the", "a", "an"]);
const STOP = /* @__PURE__ */ new Set(["the", "a", "an", "of", "and", "in", "on", "at", "to", "for", "from", "with", "by"]);
const ROMAN = /^(ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx)$/;
const INSTALLMENT_WORDS = /* @__PURE__ */ new Set(["part", "chapter", "vol", "volume", "episode", "season", "book"]);
const GENERIC_COLLECTION = /* @__PURE__ */ new Set([
  "movie",
  "movies",
  "film",
  "films",
  "every",
  "all",
  "complete",
  "collection",
  "list",
  "series",
  "saga",
  "franchise",
  "my",
  "best",
  "top",
  "essential",
  "essentials"
]);
function fold(s) {
  return (s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\bmt\b\.?/g, "mount").replace(/&/g, " and ");
}
function tokensOf(s) {
  const t = s.split(/[^a-z0-9]+/).filter(Boolean);
  return t.length > 1 && ARTICLES.has(t[0]) ? t.slice(1) : t;
}
function titleKey(title) {
  let t = fold(title).trim();
  let year;
  const m = t.match(/\s*\((\d{4})\)\s*$/);
  if (m) {
    year = +m[1];
    t = t.slice(0, m.index).trim();
  }
  const tokens = tokensOf(t);
  const colon = t.indexOf(":");
  return {
    core: tokens.join(" "),
    tokens,
    year,
    head: colon > 0 ? tokensOf(t.slice(0, colon)).join(" ") : tokens.join(" "),
    hasSubtitle: colon > 0
  };
}
function isInstallmentToken(tok) {
  return /^\d+$/.test(tok) || ROMAN.test(tok) || INSTALLMENT_WORDS.has(tok);
}
function jaccard(a, b) {
  let shared = 0;
  a.forEach((x) => {
    if (b.has(x)) shared++;
  });
  const union = a.size + b.size - shared;
  return { j: union ? shared / union : 0, shared };
}
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}
const verdict = (v, score, reason) => ({ verdict: v, score, reason });
function compareTitles(a, b) {
  const A = titleKey(a), B = titleKey(b);
  if (!A.core || !B.core) return verdict("different", 0, "empty title");
  if (A.core === B.core) {
    if (A.year && B.year) return A.year === B.year ? verdict("same", 1, "same title and year") : verdict("different", 0, "different years");
    if (A.year || B.year) return verdict("candidate", 0.9, "same title; one has no year");
    return verdict("same", 1, "same title");
  }
  if (A.year && B.year && A.year !== B.year) return verdict("different", 0, "different years");
  const sa = new Set(A.tokens), sb = new Set(B.tokens);
  const diff = [...A.tokens.filter((x2) => !sb.has(x2)), ...B.tokens.filter((x2) => !sa.has(x2))];
  if (diff.some(isInstallmentToken)) return verdict("different", 0, "a numbered installment");
  if (A.hasSubtitle && A.head === B.core || B.hasSubtitle && B.head === A.core) {
    return verdict("different", 0, "a subtitled installment");
  }
  const [short, long] = A.tokens.length <= B.tokens.length ? [A, B] : [B, A];
  if (short.tokens.every((x2, k) => long.tokens[k] === x2)) return verdict("different", 0, "a later installment");
  const content = (t) => new Set(t.filter((x2) => !STOP.has(x2) && !isInstallmentToken(x2)));
  const cs = content(short.tokens), cl = content(long.tokens);
  const { j } = jaccard(cs, cl);
  let contained = cs.size > 0;
  cs.forEach((x2) => {
    if (!cl.has(x2)) contained = false;
  });
  if (contained && j >= 0.5) return verdict("candidate", j, "one title contains the other");
  if (j >= 0.75) return verdict("candidate", j, "titles overlap");
  const x = A.tokens.join(" "), y = B.tokens.join(" ");
  if (A.tokens.length === B.tokens.length && Math.min(x.length, y.length) >= 8 && x.slice(-1) === y.slice(-1) && editDistance(x, y) === 1) {
    return verdict("candidate", 0.6, "spelled almost the same");
  }
  return verdict("different", 0, "");
}
function singular(tok) {
  let t = tok;
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) t = t.slice(0, -1);
  if (t.endsWith("ie")) t = t.slice(0, -2) + "y";
  else if (/(ch|sh|x|ss)e$/.test(t)) t = t.slice(0, -1);
  return t;
}
function compareTypeTitles(a, b) {
  const A = tokensOf(fold(a)).map(singular), B = tokensOf(fold(b)).map(singular);
  if (!A.length || !B.length) return verdict("different", 0, "empty");
  if (A.join(" ") === B.join(" ")) return verdict("same", 1, "same type");
  const { j } = jaccard(new Set(A.filter((x) => !STOP.has(x))), new Set(B.filter((x) => !STOP.has(x))));
  return j >= 0.5 ? verdict("candidate", j, "type names overlap") : verdict("different", 0, "");
}
function compareCollections(a, b, sharedMembers = 0) {
  const A = titleKey(a.title), B = titleKey(b.title);
  if (A.core && A.core === B.core) return verdict("same", 1, "same title");
  const ca = new Set(A.tokens.filter((x) => !STOP.has(x) && !GENERIC_COLLECTION.has(x)));
  const cb = new Set(B.tokens.filter((x) => !STOP.has(x) && !GENERIC_COLLECTION.has(x)));
  const { j } = jaccard(ca, cb);
  const overlap = sharedMembers / Math.max(1, a.size || 0, b.size || 0);
  if (sharedMembers >= 3 && overlap >= 0.5) {
    return verdict("candidate", Math.max(overlap, j), `${sharedMembers} of the same members`);
  }
  if (ca.size && cb.size && j >= 0.5) return verdict("candidate", j, "titles overlap");
  return verdict("different", 0, "");
}
const DID_VERBS = /* @__PURE__ */ new Set([
  "watched",
  "watch",
  "rewatched",
  "rewatch",
  "finished",
  "finish",
  "read",
  "reread",
  "played",
  "play",
  "beat",
  "completed",
  "complete",
  "climbed",
  "climb",
  "hiked",
  "hike",
  "summited",
  "tried",
  "try",
  "drank",
  "visited",
  "visit",
  "saw",
  "ran",
  "attended",
  "listened",
  "heard"
]);
const AFTER_NAME = /* @__PURE__ */ new Set(["with", "at", "on", "in", "again", "tonight", "today", "for", "w"]);
function taskNamesThing(taskTitle, name) {
  const N = titleKey(name);
  if (N.core.replace(/ /g, "").length < 3) return false;
  let t = tokensOf(fold(taskTitle).replace(/\s*\(\d{4}\)\s*$/, ""));
  if (t.length > 1 && DID_VERBS.has(t[0])) t = t.slice(1);
  if (t[0] === "to" && t.length > 1) t = t.slice(1);
  if (t.length > 1 && ARTICLES.has(t[0])) t = t.slice(1);
  const n = N.tokens;
  for (let i = 0; i + n.length <= t.length; i++) {
    if (n.some((tok, k) => t[i + k] !== tok)) continue;
    const next = t[i + n.length];
    if (next && isInstallmentToken(next)) continue;
    if (n.length >= 2) return true;
    if (i === 0 && (!next || AFTER_NAME.has(next))) return true;
  }
  return false;
}
export {
  compareCollections,
  compareTitles,
  compareTypeTitles,
  isInstallmentToken,
  taskNamesThing,
  titleKey
};
