// src/utils/matching.js
//
// Les noms saisis ("Atl. Madrid", "Paris SG", "Naples"...) ne correspondent
// pas aux noms API-Football. Règles :
//   1. On n'auto-sélectionne JAMAIS "le premier résultat de l'API".
//   2. On écarte les équipes féminines, de jeunes et réserves.
//   3. Si on connaît le pays attendu du club (TEAM_HINTS), on écarte les
//      homonymes d'autres pays (ex : "Naples" USA vs Napoli Italie).
//   4. Une équipe n'est proposée en confirmation unique que s'il ne reste
//      qu'UN candidat net. Sinon l'utilisatrice choisit dans la liste.

export function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Nom saisi (normalisé) -> nom probable côté API-Football.
const ALIAS_EXPANSIONS = {
  psg: 'paris saint germain',
  'paris sg': 'paris saint germain',
  om: 'marseille',
  ol: 'lyon',
  'atl madrid': 'atletico madrid',
  'atletico de madrid': 'atletico madrid',
  'inter de milan': 'inter',
  'inter milan': 'inter',
  'inter milano': 'inter',
  internazionale: 'inter',
  'as rome': 'as roma',
  rome: 'as roma',
  naples: 'napoli',
  'ssc napoli': 'napoli',
  milan: 'ac milan',
  bayern: 'bayern munich',
  'bayern munchen': 'bayern munich',
  dortmund: 'borussia dortmund',
  'sporting de lisbonne': 'sporting cp',
  sporting: 'sporting cp',
  'benfica de lisbonne': 'benfica',
  'man city': 'manchester city',
  'man united': 'manchester united',
  barca: 'barcelona',
  'fc barcelone': 'barcelona',
  leverkusen: 'bayer leverkusen',
  leipzig: 'rb leipzig',
};

// Pays attendu (en anglais, comme dans API-Football) pour les clubs connus.
const TEAM_HINTS = {
  napoli: 'Italy',
  inter: 'Italy',
  'ac milan': 'Italy',
  juventus: 'Italy',
  'as roma': 'Italy',
  lazio: 'Italy',
  'bayern munich': 'Germany',
  'borussia dortmund': 'Germany',
  'bayer leverkusen': 'Germany',
  'rb leipzig': 'Germany',
  'atletico madrid': 'Spain',
  'real madrid': 'Spain',
  barcelona: 'Spain',
  arsenal: 'England',
  'manchester city': 'England',
  'manchester united': 'England',
  liverpool: 'England',
  chelsea: 'England',
  'paris saint germain': 'France',
  marseille: 'France',
  lyon: 'France',
  monaco: 'France',
  lens: 'France',
  'sporting cp': 'Portugal',
  benfica: 'Portugal',
  porto: 'Portugal',
};

// ID API-Football connus pour être incorrects -> recherche de remplacement.
// (25485 = "Naples" USA, signalé par l'utilisatrice ; le bon club est
// Napoli, Italie, ID 492.)
export const FORCED_ID_FIXES = {
  25485: { search: 'Napoli', expectedId: 492, country: 'Italy' },
};

export function expandAlias(name) {
  const n = normalize(name);
  return ALIAS_EXPANSIONS[n] || n;
}

export function expectedCountry(name) {
  return TEAM_HINTS[expandAlias(name)] || null;
}

// Termes à interroger côté API : le nom saisi et, s'il diffère, son alias.
export function searchTerms(name) {
  const raw = String(name || '').trim();
  const expanded = expandAlias(raw);
  const terms = [raw];
  if (expanded && expanded !== normalize(raw)) terms.push(expanded);
  return terms.filter((t) => t.length >= 3);
}

// --- Exclusion des équipes féminines / jeunes / réserves ---
const WOMEN_WORDS = ['women', 'woman', 'ladies', 'femenino', 'femenil', 'feminino', 'femminile', 'feminine', 'frauen', 'donne', 'dames'];
const YOUTH_PATTERN = /\bu-?(1[0-9]|2[0-3])\b/;
const YOUTH_WORDS = ['youth', 'juvenil', 'giovanili', 'jugend', 'jeunes', 'junior', 'juniors', 'primavera'];
const RESERVE_WORDS = ['reserve', 'reserves', 'reservas', 'amateur', 'zweite'];

export function isExcludedName(teamName) {
  const norm = normalize(teamName);
  const tokens = norm.split(' ');
  const last = tokens[tokens.length - 1];
  if (WOMEN_WORDS.some((w) => norm.includes(w))) return true;
  if (tokens.length > 1 && last === 'w') return true; // "Bayern Munich W"
  if (YOUTH_PATTERN.test(norm) || YOUTH_WORDS.some((w) => norm.includes(w))) return true;
  if (RESERVE_WORDS.some((w) => norm.includes(w))) return true;
  if (tokens.length > 1 && ['b', 'ii', 'iii'].includes(last)) return true;
  return false;
}

// Retire le suffixe "W"/"Women" d'un nom déjà enregistré pour le rechercher.
export function cleanTeamName(name) {
  return String(name || '')
    .replace(/\s*\(?\b(women|woman|w)\b\)?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Une équipe déjà enregistrée est "suspecte" si son nom est féminin/jeune/
// réserve, si son ID est dans la liste des erreurs connues, ou si son pays
// ne correspond pas au pays attendu pour ce club.
export function isSuspiciousTeam(team) {
  if (FORCED_ID_FIXES[team.id]) return true;
  if (isExcludedName(team.name)) return true;
  const hint = expectedCountry(cleanTeamName(team.name));
  if (hint && team.country && normalize(hint) !== normalize(team.country)) return true;
  return false;
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  const x = normalize(a);
  const y = normalize(b);
  if (!x.length && !y.length) return 1;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.9;
  const maxLen = Math.max(x.length, y.length);
  return maxLen === 0 ? 0 : 1 - levenshtein(x, y) / maxLen;
}

// candidates : résultats bruts de l'API ({ team: { id, name, country, logo } }).
// Renvoie { status: 'found' | 'ambiguous' | 'not_found', best, alternatives }.
export function matchTeam(inputName, candidates) {
  const expanded = expandAlias(inputName);

  // 1) équipes féminines / jeunes / réserves écartées
  let pool = candidates.filter((c) => !isExcludedName(c.team.name));
  if (pool.length === 0) return { status: 'not_found', best: null, alternatives: [] };

  // 2) pays attendu : on écarte les homonymes d'autres pays (si au moins un
  // candidat du bon pays existe, sinon on garde tout et l'utilisatrice choisit)
  const hint = TEAM_HINTS[expanded];
  if (hint) {
    const sameCountry = pool.filter((c) => normalize(c.team.country) === normalize(hint));
    if (sameCountry.length > 0) pool = sameCountry;
  }

  const scored = pool
    .map((c) => ({
      candidate: c,
      score: Math.max(similarity(inputName, c.team.name), similarity(expanded, c.team.name)),
    }))
    .sort((a, b) => b.score - a.score);

  const [best, ...rest] = scored;
  const contenders = scored.filter((s) => s.score >= Math.max(best.score - 0.08, 0.6));

  // Un seul candidat net ET (si le pays est connu) du bon pays -> proposé.
  if (contenders.length === 1 && best.score >= 0.8) {
    return { status: 'found', best: best.candidate, score: best.score, alternatives: rest.slice(0, 4).map((r) => r.candidate) };
  }

  return {
    status: 'ambiguous',
    best: best.candidate,
    score: best.score,
    alternatives: scored.slice(0, 6).map((r) => r.candidate),
  };
}
