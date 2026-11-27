import { makeRng } from './schulte';

// ----------------------------------------------------------- tuning ----
export const CHAMBERS = 6;
export const MAX_ROUNDS = 12;
export const LOAD_MS = 10000; // fill the cylinder (it is then closed and spun)
export const MIN_LOAD_MS = 1500; // even if everybody has spun, the loading lasts at least this long
export const AIM_MS = 30000; // decide who to shoot
export const REVEAL_LEAD_MS = 1600; // before the first shot
export const SHOT_MS = 3200; // for each shot
export const SHOT_RESULT_AT = 1800; // ... the result lands this long after the shot starts
export const REVEAL_TAIL_MS = 3400; // after the last shot (who is out, the next round)

export type Aim = string; // 'self' or the uid of another player

export const bulletsFor = (round: number) => Math.min(CHAMBERS, Math.ceil(round / 2));

export const popcount = (n: number) => {
  let c = 0;
  for (let x = n; x > 0; x >>= 1) c += x & 1;
  return c;
};

// ------------------------------------------------------------ state ----
export type Phase = 'load' | 'aim' | 'reveal' | 'over';
export type Outcome = 'click' | 'shielded' | 'suicide' | 'hit' | 'blocked' | 'idle';

export type Shot = {
  uid: string;
  aim: Aim; // 'self' or the target's uid
  live: boolean;
  auto: boolean; // the player did not decide in time: defenseless, the gun did not fire ('idle')
  outcome: Outcome;
};

export type Reveal = {
  round: number;
  bullets: number;
  shots: Shot[]; // in the order they are shown
  dead: string[];
  survivors: string[];
};

export type State = {
  ver: number; // goes up on every change (the host saves when it changes)
  rev: number; // goes up on every round / phase (moves are made for one rev)
  seed: string;
  order: string[];
  gone: string[]; // players who forfeited the game
  alive: string[];
  round: number;
  bullets: number; // live bullets of this round
  phase: Phase;
  spun: string[]; // who has loaded, closed and spun the cylinder (not WHICH chambers)
  aimed: string[]; // who has chosen a target so far (not whom)
  reveal: Reveal | null;
  winner: string | null;
  lastLeft: string | null;
  endsAt: number; // when the running timer ends, in the HOST's clock (0 = none)
  pickFrom: number; // when this round started, in the HOST's clock
  remainingMs: number; // filled in when the state is saved, so every phone can count down
  // PHONE OF THE LOBBY HOST ONLY (empty in a saved state, see publicState).
  masks: Record<string, number>; // the loaded chambers, as bits 0-5
  spins: Record<string, number>; // the chamber under the hammer after the spin
  aims: Record<string, Aim>;
  aimAt: Record<string, number>; // the newest aim move already applied, per player
};

export type Move =
  | { kind: 'load'; uid: string; rev: number; mask: number; at: number }
  | { kind: 'aim'; uid: string; rev: number; target: Aim; at: number };

export const publicState = (s: State): State => ({ ...s, masks: {}, spins: {}, aims: {}, aimAt: {} });

function edit(s: State): State {
  const c: State = JSON.parse(JSON.stringify(s));
  c.ver = s.ver + 1;
  return c;
}

function shuffled<T>(list: T[], rand: () => number): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// `n` random chambers loaded, as bits.
export function autoMask(n: number, rand: () => number): number {
  return shuffled([0, 1, 2, 3, 4, 5], rand)
    .slice(0, n)
    .reduce((m, i) => m | (1 << i), 0);
}

function startRound(s: State, now: number, rand: () => number) {
  s.phase = 'load';
  s.bullets = bulletsFor(s.round);
  s.spun = [];
  s.aimed = [];
  s.masks = {};
  s.aims = {};
  s.aimAt = {};
  s.spins = Object.fromEntries(s.alive.map((id) => [id, Math.floor(rand() * CHAMBERS)]));
  s.reveal = null;
  s.pickFrom = now;
  s.endsAt = now + LOAD_MS;
  s.rev += 1;
}

// The loading is over: whoever has not spun gets random chambers loaded and a spin; then everybody aims.
function startAim(s: State, now: number, rand: () => number) {
  for (const id of s.alive) {
    if (s.masks[id] === undefined) {
      s.masks[id] = autoMask(s.bullets, rand);
      s.spun.push(id);
    }
  }
  s.phase = 'aim';
  s.pickFrom = now;
  s.endsAt = now + AIM_MS;
  s.rev += 1;
}

export function newGame(order: string[], seed: string, now: number, rand: () => number = Math.random): State {
  const s: State = {
    ver: 1,
    rev: 0,
    seed,
    order: order.slice(),
    gone: [],
    alive: order.slice(),
    round: 1,
    bullets: 1,
    phase: 'load',
    spun: [],
    aimed: [],
    reveal: null,
    winner: null,
    lastLeft: null,
    endsAt: 0,
    pickFrom: now,
    remainingMs: 0,
    masks: {},
    spins: {},
    aims: {},
    aimAt: {},
  };
  startRound(s, now, rand);
  s.remainingMs = LOAD_MS;
  return s;
}

// ------------------------------------------------------------ moves ----
export function apply(state: State, move: Move): State {
  if (move.rev !== state.rev || !state.alive.includes(move.uid)) return state;

  if (move.kind === 'load') {
    if (state.phase !== 'load') return state;
    if (state.masks[move.uid] !== undefined) return state; // a spin cannot be redone
    if (!Number.isInteger(move.mask) || move.mask < 0 || move.mask >= 1 << CHAMBERS) return state;
    if (popcount(move.mask) !== state.bullets) return state;
    const s = edit(state);
    s.masks[move.uid] = move.mask;
    s.spun.push(move.uid);
    return s;
  }

  // Aiming: only in the aiming part (everybody has spun by then). It can be changed until the time is up:
  // the newest move counts.
  if (state.phase !== 'aim' || state.masks[move.uid] === undefined) return state;
  const ok = move.target === 'self' || (move.target !== move.uid && state.alive.includes(move.target));
  if (!ok) return state;
  if (move.at <= (state.aimAt[move.uid] ?? 0) || state.aims[move.uid] === move.target) return state;
  const s = edit(state);
  s.aims[move.uid] = move.target;
  s.aimAt[move.uid] = move.at;
  if (!s.aimed.includes(move.uid)) s.aimed.push(move.uid);
  return s;
}

// ----------------------------------------------------------- timers ----
// All the guns fire. Returns what happened, in the order it will be shown.
function fireAll(s: State, rand: () => number): Reveal {
  const bullets = s.bullets;
  const info = s.alive.map((id) => {
    const mask = s.masks[id] ?? autoMask(bullets, rand);
    const asked = s.aims[id];
    let aim: Aim = asked ?? 'self';
    if (aim !== 'self' && !s.alive.includes(aim)) aim = 'self';
    const spin = s.spins[id] ?? Math.floor(rand() * CHAMBERS);
    return { uid: id, aim, auto: asked === undefined, live: ((mask >> spin) & 1) === 1 };
  });
  // Only a blank that was AIMED at yourself protects. A defenseless player (no decision) has no protection.
  const protectedIds = new Set(info.filter((i) => !i.auto && i.aim === 'self' && !i.live).map((i) => i.uid));
  const dead = new Set<string>();
  const shots: Shot[] = info.map((i) => {
    let outcome: Outcome;
    if (i.auto) outcome = 'idle';
    else if (!i.live) outcome = i.aim === 'self' ? 'shielded' : 'click';
    else if (i.aim === 'self') {
      outcome = 'suicide';
      dead.add(i.uid);
    } else if (protectedIds.has(i.aim)) outcome = 'blocked';
    else {
      outcome = 'hit';
      dead.add(i.aim);
    }
    return { uid: i.uid, aim: i.aim, live: i.auto ? false : i.live, auto: i.auto, outcome };
  });
  return {
    round: s.round,
    bullets,
    shots: shuffled(shots, rand),
    dead: s.alive.filter((id) => dead.has(id)),
    survivors: s.alive.filter((id) => !dead.has(id)),
  };
}

export const revealMs = (r: Pick<Reveal, 'shots'>) => REVEAL_LEAD_MS + r.shots.length * SHOT_MS + REVEAL_TAIL_MS;
// When shot i starts, and when its result lands, in ms from the start of the reveal.
export const shotStart = (i: number) => REVEAL_LEAD_MS + i * SHOT_MS;
export const shotResultAt = (i: number) => shotStart(i) + SHOT_RESULT_AT;

function resolve(s: State, now: number, rand: () => number) {
  const reveal = fireAll(s, rand);
  s.reveal = reveal;
  s.alive = reveal.survivors.slice();
  s.masks = {};
  s.spins = {};
  s.aims = {};
  s.aimAt = {};
  s.phase = 'reveal';
  s.endsAt = now + revealMs(reveal);
  s.rev += 1;
}

function over(s: State) {
  s.phase = 'over';
  s.winner = s.alive.length === 1 ? s.alive[0] : null;
  s.endsAt = 0;
  s.rev += 1;
}

function afterReveal(s: State, now: number, rand: () => number) {
  if (s.alive.length <= 1 || s.round >= MAX_ROUNDS) {
    over(s);
    return;
  }
  s.round += 1;
  startRound(s, now, rand);
}

function dropPlayer(state: State, uid: string): State {
  const s = edit(state);
  s.gone.push(uid);
  s.lastLeft = uid;
  s.alive = s.alive.filter((id) => id !== uid);
  s.spun = s.spun.filter((id) => id !== uid);
  s.aimed = s.aimed.filter((id) => id !== uid);
  delete s.masks[uid];
  delete s.spins[uid];
  delete s.aims[uid];
  delete s.aimAt[uid];
  // During the reveal the round is already settled: afterReveal decides what happens next.
  if (s.alive.length <= 1 && (s.phase === 'load' || s.phase === 'aim')) over(s);
  return s;
}

// Call a few times per second on the lobby host. `left` = players who forfeited the game.
export function tick(state: State, now: number, left: string[] = [], rand: () => number = Math.random): State {
  if (state.phase === 'over') return state;
  for (const id of left) if (state.order.includes(id) && !state.gone.includes(id)) return dropPlayer(state, id);

  if (state.phase === 'load') {
    const allSpun = state.alive.every((id) => state.spun.includes(id)) && now >= state.pickFrom + MIN_LOAD_MS;
    if (!allSpun && now < state.endsAt) return state;
    const s = edit(state);
    startAim(s, now, rand);
    return s;
  }
  if (state.phase === 'aim') {
    // Nobody pulls the trigger early: all the guns fire together when the time is up.
    if (now < state.endsAt) return state;
    const s = edit(state);
    resolve(s, now, rand);
    return s;
  }
  if (state.endsAt === 0 || now < state.endsAt) return state;
  const s = edit(state);
  afterReveal(s, now, rand);
  return s;
}

export const remainingNow = (state: State, receivedAt: number, now: number) =>
  Math.max(0, state.remainingMs - (now - receivedAt));

// Small deterministic shuffle for cosmetic things (which silhouette a player gets).
export const variantOf = (seed: string, uid: string, variants: number) => {
  const rnd = makeRng(`${seed}:rr:${uid}`);
  return Math.floor(rnd() * variants);
};