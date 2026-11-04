// Fate balance check: Key rolls over whole runs, by mode and play style.
//
// The rates, Fate, pity, Omni, Chaos and Key reserve numbers all come from the
// tracker's config and data through scripts/balance/inputs.ts, so the same
// seeds give the same runs until a rule or the content changes. The model of
// how a player plays (when content happens, how much of it they do) is an
// estimate; the report's "How the runs are played" note lists what it leaves out.

// ── helpers ──────────────────────────────────────────────────────────────
const XP = [0, 0];
{ let pts = 0; for (let l = 1; l < 99; l++) { pts += Math.floor(l + 300 * 2 ** (l / 7)); XP[l + 1] = Math.floor(pts / 4); } }
const xpFrac = (l) => XP[l] / XP[99];
const mulberry = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = (rng, weights) => { const tot = Object.values(weights).reduce((a, b) => a + b, 0); let r = rng() * tot; for (const [k, w] of Object.entries(weights)) { r -= w; if (r < 0) return k; } return Object.keys(weights)[0]; };
const between = (rng, a, b) => a + rng() * (b - a);
const shuffle = (rng, list) => list.map(x => [rng(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);

// Slayer masters by Slayer level, and the average XP a task gives there (estimates).
const SLAYER_PHASES = [
  { to: 20, xp: 600, mix: { turael: 1 } },
  { to: 35, xp: 2500, mix: { mazchna: 1 } },
  { to: 50, xp: 6000, mix: { vannaka: 1 } },
  { to: 70, xp: 12000, mix: { chaeldar: 1 } },
  { to: 85, xp: 18000, mix: { konar: 1, nieve: 1 } },
  { to: 99, xp: 25000, mix: { duradel: 0.75, boss: 0.15, krystilia: 0.1 } },
];
const slayerTasksTo99 = (rng) => {
  const out = []; let from = 1;
  for (const ph of SLAYER_PHASES) {
    const n = Math.round((XP[ph.to] - XP[from]) / ph.xp);
    for (let i = 0; i < n; i++) out.push({ p: (XP[from] + (XP[ph.to] - XP[from]) * (i + rng()) / n) / XP[99], master: pick(rng, ph.mix) });
    from = ph.to;
  }
  return out;
};
const slayerMasterAt = (rng, p) => { for (const ph of SLAYER_PHASES) if (p <= xpFrac(ph.to)) return pick(rng, ph.mix); return pick(rng, SLAYER_PHASES.at(-1).mix); };
const clueTierAt = (rng, p) => pick(rng, p < 0.15
  ? { beginner: 30, easy: 40, medium: 30 }
  : p < 0.5 ? { easy: 20, medium: 35, hard: 35, elite: 10 } : { medium: 15, hard: 40, elite: 35, master: 10 });

// When in a run each kind of content happens, as a share of the way to maxed.
const QUEST_WINDOW = { 'Quest (Novice)': [0, 0.08], 'Quest (Intermediate)': [0, 0.18], 'Quest (Experienced)': [0.02, 0.3], 'Quest (Master)': [0.05, 0.45], 'Quest (Grandmaster)': [0.1, 0.6] };
const DIARY_WINDOW = { 'Diary (Easy)': [0, 0.15], 'Diary (Medium)': [0.02, 0.3], 'Diary (Hard)': [0.08, 0.55], 'Diary (Elite)': [0.25, 0.9] };
const CA_WINDOW = { Easy: [0.02, 0.3], Medium: [0.05, 0.45], Hard: [0.1, 0.6], Elite: [0.2, 0.85], Master: [0.4, 1], Grandmaster: [0.6, 1] };

// ── play styles (how much of each repeatable activity a player logs) ─────
export const PROFILES = {
  bare: { label: 'Bare: quests, diaries and levels only', ca: {}, clog: 0, clues: 0, slayer: false, minigames: 0, minigameHours: 0, bosses: 0, pets: 0 },
  lean: { label: 'Lean: light extras', ca: { Easy: 1, Medium: 1 }, clog: 300, clues: 150, slayer: true, minigames: 8, minigameHours: 1, bosses: 20, pets: 3 },
  main: { label: 'Main: CAs to Hard, more bossing', ca: { Easy: 1, Medium: 1, Hard: 1, Elite: 0.5 }, clog: 800, clues: 400, slayer: true, minigames: 15, minigameHours: 2, bosses: 45, pets: 10 },
  completionist: { label: 'Completionist: every CA, 1,700 log slots', ca: { Easy: 1, Medium: 1, Hard: 1, Elite: 1, Master: 1, Grandmaster: 1 }, clog: 1700, clues: 1200, slayer: true, minigames: Infinity, minigameHours: 4, bosses: Infinity, pets: 40 },
};

// ── one run ──────────────────────────────────────────────────────────────
export function run(inputs, { mode, profile, ritual = 'none', seed }) {
  const { rules: R, content: C } = inputs;
  const rng = mulberry(seed);
  const P = PROFILES[profile];
  if (!P) throw new Error(`No play style "${profile}"`);
  const chunked = mode === 'chunked';
  const S = C.unlocks[mode];
  const pityAt = R.pity[mode] ?? Infinity;
  const omniBase = R.omniBase[mode];
  const chunkShare = chunked ? C.chunks / S : 0;

  const ev = [];
  // Level-ups. Hitpoints (free) starts at 10, every other skill at 1.
  for (let s = 0; s < C.skills; s++) for (let L = s === 0 ? 11 : 2; L <= 99; L++) ev.push({ p: xpFrac(L) * between(rng, 0.85, 1.15), k: 'level', L });
  for (const [d, n] of Object.entries(C.quests)) for (let i = 0; i < n; i++) ev.push({ p: between(rng, ...QUEST_WINDOW[d]), k: 'roll', src: R.quest[d], g: 'quests' });
  for (const [d, n] of Object.entries(C.diaryTasks)) for (let i = 0; i < n; i++) ev.push({ p: between(rng, ...DIARY_WINDOW[d]), k: 'roll', src: R.diary[d], g: 'diaries' });
  for (const [t, n] of Object.entries(C.caTasks)) for (let i = 0; i < Math.round(n * (P.ca[t] ?? 0)); i++) ev.push({ p: between(rng, ...CA_WINDOW[t]), k: 'roll', src: R.ca[t], g: 'combat achievements' });
  for (let i = 0; i < Math.min(P.clog, C.clogSlots); i++) ev.push({ p: between(rng, 0.01, 1), k: 'roll', src: R.clog, g: 'collection log' });
  for (let i = 0; i < P.clues; i++) { const p = between(rng, 0.01, 1); ev.push({ p, k: 'clue', tier: clueTierAt(rng, p) }); }
  if (P.slayer) for (const t of slayerTasksTo99(rng)) ev.push({ p: t.p, k: 'roll', src: R.slayer[t.master], g: 'slayer' });
  // Bosses and minigames hold a few Keys each and then stop.
  for (const tier of shuffle(rng, C.bosses).slice(0, P.bosses)) ev.push({ p: between(rng, 0.05, 0.9), k: 'boss', tier });
  for (const mg of shuffle(rng, C.minigames).slice(0, P.minigames)) ev.push({ p: between(rng, 0.01, 0.9), k: 'minigame', mg });
  for (let i = 0; i < Math.min(P.pets, C.pets); i++) ev.push({ p: between(rng, 0.1, 1), k: 'pet' });
  ev.sort((a, b) => a.p - b.p);

  let fate = 0, unlocked = 0, keysBank = 0, clueKeys = 0, exploreOwed = 0;
  const st = { rolls: 0, farmRolls: 0, keysWon: 0, pity: 0, chaos: 0, omni: 0, missStreak: 0, maxMiss: 0, rollsAt100: null, keysFrom: {} };
  const credit = (g, n) => { st.keysFrom[g] = (st.keysFrom[g] ?? 0) + n; };
  const spend = (n, g) => {
    credit(g, n); keysBank += n;
    while (keysBank > 0 && unlocked < S) {
      keysBank--; unlocked++;
      if (chunkShare && rng() < chunkShare) exploreOwed += R.chunkExplore.rolls;
    }
    if (unlocked >= S && st.rollsAt100 === null) st.rollsAt100 = st.rolls;
  };
  spend(R.startingKeys, 'starting keys');
  const afterRoll = () => { if (ritual === 'chaos') while (fate >= 25) { fate -= 25; st.chaos++; spend(1, 'chaos ritual'); } };

  // One Key roll. Returns Keys won (pity Keys not counted).
  const roll = (rate, failFate, omniFloor, g) => {
    st.rolls++;
    if (rng() * 100 < rate) {
      st.keysWon++; fate = 0; st.missStreak = 0;
      spend(1, g);
      if (rng() * 100 < Math.max(omniBase, omniFloor ?? 0)) { st.omni++; spend(1, 'omni'); }
      afterRoll();
      return 1;
    }
    st.missStreak++; st.maxMiss = Math.max(st.maxMiss, st.missStreak);
    fate += failFate;
    if (fate >= pityAt) { fate -= pityAt; st.pity++; spend(1, 'pity'); }
    afterRoll();
    return 0;
  };
  const rollSrc = (src, g) => roll(src.rate, src.fate, src.omni, g);
  const explore = () => { while (exploreOwed > 0 && unlocked < S) { exploreOwed--; rollSrc(R.chunkExplore, 'chunk exploring'); } };
  const clue = (tier) => {
    const src = R.clue[tier];
    const rate = chunked ? src.rate : Math.max(src.rate, R.clueMinimums[clueKeys] ?? 0);
    clueKeys += roll(rate, src.fate, src.omni, 'clues');
  };
  const boss = (tier) => {
    const sched = R.bossStash[tier], src = R.boss[tier];
    // A player keeps killing until the boss's reserve is spent.
    let got = 0, guard = 0;
    while (got < sched.length && guard++ < 5000) got += roll(sched[got], src.fate, src.omni, 'bosses');
  };
  const minigame = (mg) => {
    const runs = Math.min(400, Math.ceil(P.minigameHours * 60 / mg.minutes));
    let got = 0;
    for (let i = 0; i < runs && got < mg.rates.length; i++) {
      const rate = mg.rates[got];
      got += roll(rate, rate >= R.minigameMissFateMinRate ? R.minigame.fate : 0, R.minigame.omni, 'minigames');
    }
  };
  // Farm Slayer when the run is short of unlocks for what comes next.
  const farmOnce = (p) => { st.farmRolls++; rollSrc(R.slayer[slayerMasterAt(rng, p)], 'farmed slayer'); };

  for (const e of ev) {
    explore();
    const need = Math.min(S, Math.ceil(Math.min(1, e.p) * S));
    let guard = 0; while (unlocked < need && guard++ < 100000) { farmOnce(e.p); explore(); }
    if (e.k === 'level') {
      roll(R.levelChance[e.L], R.levelFate[e.L], 0, 'levels');
      const ch = (R.chaosMilestones.includes(e.L) ? 1 : 0) + (rng() * 100 < R.levelChaosChance ? 1 : 0);
      if (ch) { st.chaos += ch; spend(ch, 'chaos (levels)'); }
    } else if (e.k === 'roll') rollSrc(e.src, e.g);
    else if (e.k === 'clue') clue(e.tier);
    else if (e.k === 'boss') boss(e.tier);
    else if (e.k === 'minigame') minigame(e.mg);
    else if (e.k === 'pet') spend(1, 'pets');
  }
  let guard = 0; while (unlocked < S && guard++ < 200000) { farmOnce(1); explore(); }
  return { S, unlockedEnd: unlocked, ...st };
}

// ── many runs ────────────────────────────────────────────────────────────
const at = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
const spread = (values) => {
  const a = [...values].sort((x, y) => x - y);
  return { p10: at(a, 0.1), med: at(a, 0.5), p90: at(a, 0.9) };
};

export function simulate(inputs, scenario, runs) {
  const rs = Array.from({ length: runs }, (_, i) => run(inputs, { ...scenario, seed: i + 1 }));
  const groups = [...new Set(rs.flatMap(r => Object.keys(r.keysFrom)))];
  const total = rs.reduce((n, r) => n + Object.values(r.keysFrom).reduce((a, b) => a + b, 0), 0);
  return {
    unlocks: rs[0].S,
    finished: Math.round(100 * rs.filter(r => r.rollsAt100 !== null).length / runs),
    rollsAt100: spread(rs.map(r => r.rollsAt100 ?? r.rolls)),
    rolls: spread(rs.map(r => r.rolls)),
    farmRolls: spread(rs.map(r => r.farmRolls)),
    keysWon: spread(rs.map(r => r.keysWon)),
    pity: spread(rs.map(r => r.pity)),
    chaos: spread(rs.map(r => r.chaos)),
    omni: spread(rs.map(r => r.omni)),
    maxMiss: spread(rs.map(r => r.maxMiss)),
    miss200: Math.round(100 * rs.filter(r => r.maxMiss >= 200).length / runs),
    keysFrom: Object.fromEntries(groups
      .map(g => [g, Math.round(1000 * rs.reduce((n, r) => n + (r.keysFrom[g] ?? 0), 0) / total) / 10])
      .sort((a, b) => b[1] - a[1])),
  };
}

export const SCENARIOS = [
  { mode: 'vanilla', profile: 'bare' },
  { mode: 'vanilla', profile: 'lean' },
  { mode: 'vanilla', profile: 'main' },
  { mode: 'vanilla', profile: 'completionist' },
  { mode: 'vanilla', profile: 'main', ritual: 'chaos' },
  { mode: 'chunked', profile: 'main' },
  { mode: 'chunked', profile: 'completionist' },
];

export const scenarioName = (s) => `${s.mode}/${s.profile}${s.ritual && s.ritual !== 'none' ? `/${s.ritual}` : ''}`;
