export type Track = 'logic' | 'experience' | 'chance' | 'all';

// Titles come from your design doc. The win thresholds are PLACEHOLDERS: tune them here.
// Titles are worked out in the app from each player's win counts (the server only stores wins).
export const LADDERS: Record<Track, { label: string; titles: string[]; thresholds: number[] }> = {
  logic: {
    label: 'Logic',
    titles: ['The Analyst', 'Logistician', '100 IQ', 'Absolute Rationality'],
    thresholds: [5, 15, 30, 60],
  },
  experience: {
    label: 'Experience',
    titles: ['Genius', 'The Prodigy', 'The Otherworldly'],
    thresholds: [5, 20, 50],
  },
  chance: {
    label: 'Chance',
    titles: ['The Lucky One', 'Blessed Child', 'Chosen by the Gods'],
    thresholds: [5, 20, 50],
  },
  all: {
    label: 'All domains',
    titles: ['Jack-of-all-Trades', 'The Ace All-Star', 'Master of all Domain', 'Legendary'],
    thresholds: [3, 10, 25, 50],
  },
};

export function titleFor(track: Track, wins: number): string | null {
  const { titles, thresholds } = LADDERS[track];
  let found: string | null = null;
  thresholds.forEach((min, i) => {
    if (wins >= min) found = titles[i];
  });
  return found;
}
