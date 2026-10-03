// src/utils/matching.js
//
// Les noms saisis par l'utilisatrice ("Atl. Madrid", "Paris SG"...) ne
// correspondent pas forcément au nom officiel côté API-Football
// ("Atletico Madrid", "Paris Saint Germain"...). On calcule un score de
// similarité entre le nom saisi et chaque résultat renvoyé par l'API,
// pour proposer automatiquement le meilleur candidat sans jamais
// prendre "le premier résultat" à l'aveugle.

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // accents
    .replace(/[^a-z0-9 ]/g, ' ') // ponctuation
    .replace(/\s+/g, ' ')
    .trim();
}

// Alias courants observés côté utilisateurs francophones -> fragments
// qui aident le score à converger vers le bon club.
const ALIAS_EXPANSIONS = {
  psg: 'paris saint germain',
  'paris sg': 'paris saint germain',
  om: 'marseille',
  ol: 'lyon',
  'atl madrid': 'atletico madrid',
  'atl. madrid': 'atletico madrid',
  'inter de milan': 'inter',
  'as rome': 'as roma',
  bayern: 'bayern munich',
  dortmund: 'borussia dortmund',
};

function expandAlias(normalized) {
  return ALIAS_EXPANSIONS[normalized] || normalized;
}

// Distance de Levenshtein simple, suffisante pour des noms courts.
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
  const normA = normalize(a);
  const normB = normalize(b);
  if (!normA.length && !normB.length) return 1;
  if (normA === normB) return 1;
  if (normA.includes(normB) || normB.includes(normA)) return 0.9;
  const dist = levenshtein(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  return maxLen === 0 ? 0 : 1 - dist / maxLen;
}

// candidates: résultats bruts de l'API (chacun avec .team.name, .team.id, .team.country)
// Renvoie une liste triée { candidate, score } décroissante, et une
// confiance ("high" | "low" | "none").
export function matchTeam(inputName, candidates) {
  const expanded = expandAlias(normalize(inputName));

  const scored = candidates
    .map((c) => ({
      candidate: c,
      score: Math.max(similarity(inputName, c.team.name), similarity(expanded, c.team.name)),
    }))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { status: 'not_found', best: null, alternatives: [] };
  }

  const [best, ...rest] = scored;

  if (best.score >= 0.82) {
    return { status: 'found', best: best.candidate, score: best.score, alternatives: rest.slice(0, 4).map((r) => r.candidate) };
  }

  return {
    status: 'ambiguous',
    best: best.candidate,
    score: best.score,
    alternatives: scored.slice(0, 5).map((r) => r.candidate),
  };
}
