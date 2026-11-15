export const colors = {
  bg: '#17143A',
  card: '#26215C',
  cardAlt: '#2F2A6E',
  border: '#3C3489',
  text: '#FAEEDA',
  muted: '#AFA9EC',
  accent: '#EF9F27',
  danger: '#E24B4A',
  logic: '#AFA9EC',
  experience: '#5DCAA5',
  chance: '#F09595',
};

export type Domain = 'logic' | 'experience' | 'chance';

// `icon` is a MaterialCommunityIcons name (from @expo/vector-icons, already installed):
// brain = Logic, earth = Experience, dice = Chance. Change an icon here and it changes everywhere
// (the logo badges are set in src/components/Logo.tsx).
export const domainInfo: Record<
  Domain,
  { label: string; icon: 'brain' | 'earth' | 'dice-5'; color: string; blurb: string }
> = {
  logic: {
    label: 'Logic',
    icon: 'brain',
    color: colors.logic,
    blurb: 'Critical thinking and pure analysis.',
  },
  experience: {
    label: 'Experience',
    icon: 'earth',
    color: colors.experience,
    blurb: 'Personal knowledge, great ideas and visual sense.',
  },
  chance: {
    label: 'Chance',
    icon: 'dice-5',
    color: colors.chance,
    blurb: 'Randomness, probability and luck.',
  },
};

export const DOMAIN_ORDER: Domain[] = ['logic', 'experience', 'chance'];

export const radius = { sm: 8, md: 12, lg: 20 };
