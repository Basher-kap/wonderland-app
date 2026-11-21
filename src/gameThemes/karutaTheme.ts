import { Platform } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

/**
 * Karuta theme: a washitsu (a traditional Japanese room) at the end of a late-summer day. The shoji
 * doors are slid open on a quiet garden, a wind chime sways in the cool air, the sky goes from
 * blue to peach, and a few fireflies drift by. The cards lie on a tatami floor.
 * Nostalgic, a little wistful, and refreshing.
 *
 * BACKGROUND IMAGE: when your design is ready, put the file in assets/images/ and replace `null`
 * below with:  require('../../assets/images/karuta-bg.png')
 * While it is null, TatamiBackground draws the built-in placeholder room.
 *
 * FONT: a Japanese serif (Mincho) where the phone has one, the system serif elsewhere. Change
 * FONT_KARUTA here and the game screen and the rules dialogs follow.
 */
export const KARUTA_BG_IMAGE: ImageSourcePropType | null = null;

export const FONT_KARUTA = Platform.select({
  ios: 'Hiragino Mincho ProN',
  android: 'serif',
  default: 'serif',
}) as string;

// How tall the view out of the open doors is (the status, the target card and the latest events
// sit in it). Everything below it is the tatami floor.
export const SCENE_HEIGHT = 250;

export const washitsu = {
  // the sky, top to horizon
  sky1: '#27406B',
  sky2: '#3C5A87',
  sky3: '#6F8DAB',
  sky4: '#B7B9B2',
  sky5: '#E8C39B',
  moon: '#F4EAD2',
  hillFar: '#4A6580',
  hillNear: '#2F4A5C',
  pine: '#1F3140',

  wood: '#3A2A1E', // frames, trays
  woodLight: '#5A412C',
  tray: '#4A3524',
  engawa: '#8A6A47', // the veranda between the room and the garden
  shoji: '#F2EAD3', // paper in the sliding doors
  shojiLit: '#F7EFD8',

  tatamiA: '#A8AC74',
  tatamiB: '#A2A66E',
  tatamiEdge: '#8C9060',
  heri: '#27324F', // the cloth binding along the mats
  sun: '#FFD9A0', // the warm light spilling in

  paper: '#F6F0E0', // cards, plates, dialogs
  paperEdge: '#D2C29C',
  ink: '#2B2A1E',
  indigo: '#1F2A4D', // letters on cards
  vermilion: '#B23A3A',
  gold: '#E0B04A',

  glass: 'rgba(190,230,230,0.75)', // the wind chime
  glassEdge: '#7FB7B7',
  firefly: '#E8F59A',
} as const;
