export type Track = 'logic' | 'experience' | 'chance' | 'all';

// Ranking titles come from your design doc. A title is earned by POINTS:
//   logic / experience / chance  -> that domain's points
//   all                          -> your WEAKEST domain's points (so you must be good at all three)
// Points: +10 for winning a round, -5 for losing one (see src/game/engine.ts).
// The point thresholds below are PLACEHOLDERS: tune them here, nothing else needs to change.
export const LADDERS: Record<Track, { label: string; titles: string[]; thresholds: number[] }> = {
  logic: {
    label: 'Logic',
    titles: ['The Analyst', 'Logistician', '100 IQ', 'Absolute Rationality'],
    thresholds: [50, 150, 300, 600],
  },
  experience: {
    label: 'Experience',
    titles: ['Genius', 'The Prodigy', 'The Otherworldly'],
    thresholds: [50, 200, 500],
  },
  chance: {
    label: 'Chance',
    titles: ['The Lucky One', 'Blessed Child', 'Chosen by the Gods'],
    thresholds: [50, 200, 500],
  },
  all: {
    label: 'All domains',
    titles: ['Jack-of-all-Trades', 'The Ace All-Star', 'Master of all Domain', 'Legendary'],
    thresholds: [30, 100, 250, 500],
  },
};

export function titleFor(track: Track, points: number): string | null {
  const { titles, thresholds } = LADDERS[track];
  let found: string | null = null;
  thresholds.forEach((min, i) => {
    if (points >= min) found = titles[i];
  });
  return found;
}

// The next title to aim for, with how many points are still missing.
export function nextTitle(track: Track, points: number): { title: string; missing: number } | null {
  const { titles, thresholds } = LADDERS[track];
  const i = thresholds.findIndex((min) => points < min);
  return i === -1 ? null : { title: titles[i], missing: thresholds[i] - points };
}
