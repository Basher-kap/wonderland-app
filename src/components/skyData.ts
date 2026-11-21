// The data of the night sky, with no React Native in it, so it can be previewed and tested in plain Node.
// SpaceBackground.tsx draws it. The seed is fixed: every screen shows the same sky.

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Real star colours: most are white, then blue-white, yellow-white, orange and a rare red one.
const WHITE = '#FFFFFF';
const BLUE = '#CFE0FF';
const YELLOW = '#FFF1D0';
const ORANGE = '#FFC58A';
const RED = '#FFA48F';

function pickColor(u: number) {
  if (u < 0.5) return WHITE;
  if (u < 0.74) return BLUE;
  if (u < 0.9) return YELLOW;
  if (u < 0.98) return ORANGE;
  return RED;
}

export type Dot = { x: number; y: number; r: number; o: number; c: string };
export type Hero = { x: number; y: number; size: number; color: string; spikes: boolean; seed: number };
export type Band = { cx: number; cy: number; angleDeg: number; length: number; sigma: number };
export type Sky = { band: Band; milky: Dot[]; field: Dot[]; twinkle: Dot[][]; heroes: Hero[] };

// density: 1 is a full phone screen; a header strip or a box uses less. heroes: how many bright stars (max 6).
export type SkyOptions = { density?: number; heroes?: number };

export function buildSky(w: number, h: number, opts: SkyOptions = {}): Sky {
  const density = opts.density ?? 1;
  const r = rng(20261121);
  const gauss = () => {
    const u = Math.max(r(), 1e-6);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  };

  // The Milky Way: a band running from the lower left to the upper right.
  const p0 = { x: -0.1 * w, y: 0.92 * h };
  const p1 = { x: 1.1 * w, y: 0.08 * h };
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const length = Math.hypot(dx, dy);
  const sigma = 0.12 * Math.min(w, h);
  const nx = -dy / length;
  const ny = dx / length;
  const band: Band = {
    cx: (p0.x + p1.x) / 2,
    cy: (p0.y + p1.y) / 2,
    angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
    length,
    sigma,
  };

  // Thousands of faint stars blur into the band; here, a few hundred tiny ones stand in.
  const milky: Dot[] = [];
  const milkyCount = Math.round(320 * density);
  while (milky.length < milkyCount) {
    const t = r();
    if (r() > 0.28 + 0.72 * Math.pow(Math.sin(Math.PI * t), 1.5)) continue;
    const off = gauss() * sigma * 0.8;
    const x = p0.x + dx * t + nx * off;
    const y = p0.y + dy * t + ny * off;
    if (x < -4 || x > w + 4 || y < -4 || y > h + 4) continue;
    milky.push({
      x,
      y,
      r: 0.35 + Math.pow(r(), 3) * 0.7,
      o: 0.14 + r() * 0.42,
      c: r() > 0.8 ? '#FFEBCC' : '#DDE6FF',
    });
  }

  // The field: many dim stars, few bright ones.
  const field: Dot[] = Array.from({ length: Math.max(6, Math.round(130 * density)) }, () => {
    const m = Math.pow(r(), 3);
    return {
      x: r() * w,
      y: r() * h,
      r: 0.45 + m * 1.1,
      o: Math.min(1, 0.3 + m * 0.6 + r() * 0.1),
      c: pickColor(r()),
    };
  });

  // Stars that twinkle, in three groups that never blink together.
  const twinkle: Dot[][] = [0, 1, 2].map(() =>
    Array.from({ length: Math.max(4, Math.round(14 * density)) }, () => ({
      x: r() * w,
      y: r() * h,
      r: 0.8 + r() * 0.8,
      o: 0.6 + r() * 0.4,
      c: pickColor(r()),
    }))
  );

  // The few bright stars: a soft glow, and the first three get diffraction spikes.
  const spots = [
    [0.14, 0.12], [0.82, 0.2], [0.58, 0.46], [0.2, 0.7], [0.9, 0.78], [0.42, 0.9],
  ];
  const colors = [BLUE, '#FFE9C2', WHITE, ORANGE, '#BFD3FF', WHITE];
  const heroes: Hero[] = spots.slice(0, opts.heroes ?? 6).map(([fx, fy], i) => ({
    x: (fx + (r() - 0.5) * 0.08) * w,
    y: (fy + (r() - 0.5) * 0.06) * h,
    size: 22 + r() * 14,
    color: colors[i],
    spikes: i < 3,
    seed: 101 + i * 37,
  }));

  return { band, milky, field, twinkle, heroes };
}
