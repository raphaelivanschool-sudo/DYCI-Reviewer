import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { C } from '@/theme';

// Stroke icons copied from the METAKNOWIA GUI symbol sheet (24x24 grid).
const ICONS = {
  home: <><Path d="M3 10.5 12 3l9 7.5" /><Path d="M5 9.5V21h14V9.5" /><Path d="M9.5 21v-6h5v6" /></>,
  folder: <Path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  chat: <Path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.1A8.5 8.5 0 1 1 21 12z" />,
  user: <><Circle cx="12" cy="8" r="4" /><Path d="M4 21a8 8 0 0 1 16 0" /></>,
  bell: <><Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  right: <Path d="m9 18 6-6-6-6" />,
  left: <Path d="m15 18-6-6 6-6" />,
  up: <Path d="m6 15 6-6 6 6" />,
  down: <Path d="m6 9 6 6 6-6" />,
  x: <Path d="M18 6 6 18M6 6l12 12" />,
  check: <Path d="M20 6 9 17l-5-5" />,
  clock: <><Circle cx="12" cy="12" r="9" /><Path d="M12 7v5l3 2" /></>,
  flame: <Path d="M12 22c4 0 7-2.8 7-7 0-3.5-2.5-6.5-4-8 0 2.5-1.5 4-3 4 0-3-1-6-4-8 0 4-3 6.5-3 11 0 4.2 3 8 7 8z" />,
  upload: <><Path d="M12 15V3" /><Path d="m7 8 5-5 5 5" /><Path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></>,
  file: <><Path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><Path d="M14 3v6h6" /><Path d="M8 13h8M8 17h5" /></>,
  paste: <><Rect x="8" y="2" width="8" height="4" rx="1" /><Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></>,
  camera: <><Path d="M3 8a2 2 0 0 1 2-2h2.5L9 4h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><Circle cx="12" cy="13" r="3.5" /></>,
  sparkles: <><Path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z" /><Path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z" /></>,
  trash: <><Path d="M3 6h18" /><Path d="M8 6V4h8v2" /><Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></>,
  logout: <><Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><Path d="m16 17 5-5-5-5" /><Path d="M21 12H9" /></>,
  moon: <Path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  eye: <><Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><Circle cx="12" cy="12" r="3" /></>,
  bulb: <><Path d="M9 18h6M10 22h4" /><Path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z" /></>,
  send: <><Path d="M22 2 11 13" /><Path d="M22 2 15 22l-4-9-9-4z" /></>,
  lock: <><Rect x="4" y="11" width="16" height="10" rx="2" /><Path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  mail: <><Rect x="3" y="5" width="18" height="14" rx="2" /><Path d="m3 7 9 6 9-6" /></>,
  edit: <><Path d="M12 20h9" /><Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  cap: <><Path d="M22 10 12 5 2 10l10 5z" /><Path d="M6 12v5c3 2 9 2 12 0v-5" /></>,
  play: <Path d="M7 4v16l13-8z" fill="currentColor" />,
  book: <><Path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" /><Path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" /></>,
  trophy: <><Path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><Path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></>,
  music: <><Path d="M9 18V5l12-2v13" /><Circle cx="6" cy="18" r="3" /><Circle cx="18" cy="16" r="3" /></>,
  flask: <><Path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3" /><Path d="M7 15h10" /></>,
  dumbbell: <Path d="M6 7v10M18 7v10M3 9.5v5M21 9.5v5M6 12h12" />,
  shuffle: <Path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />,
  retry: <><Path d="M3 12a9 9 0 1 0 3-6.7" /><Path d="M3 4v5h5" /></>,
  calendar: <><Rect x="3" y="5" width="18" height="16" rx="2" /><Path d="M3 10h18M8 3v4M16 3v4" /></>,
  download: <Path d="M12 4v12M7 11l5 5 5-5M4 20h16" />,
  image: <><Rect x="3" y="4" width="18" height="16" rx="2" /><Circle cx="9" cy="10" r="2" /><Path d="m21 16-5-5-9 9" /></>,
  share: <><Circle cx="18" cy="5" r="3" /><Circle cx="6" cy="12" r="3" /><Circle cx="18" cy="19" r="3" /><Path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></>,
  shirt: <Path d="M8 3 3.5 5.5 2 10.5l4 1.2V21h12v-9.3l4-1.2-1.5-5L16 3a4 4 0 0 1-8 0z" />,
  hand: <><Path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" /><Path d="M11 11.5v-8a1.5 1.5 0 0 1 3 0V12" /><Path d="M14 11.5V5a1.5 1.5 0 0 1 3 0v8.5" /><Path d="M17 9.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.4-2.6L3.3 16a1.6 1.6 0 0 1 2.5-2L8 16" /></>,
  more: <><Circle cx="5" cy="12" r="1.6" fill="currentColor" /><Circle cx="12" cy="12" r="1.6" fill="currentColor" /><Circle cx="19" cy="12" r="1.6" fill="currentColor" /></>,
  finger: <><Path d="M4.6 9.5a7.6 7.6 0 0 1 14.8 0" /><Path d="M4.4 13.2c.2 1.7.6 3.2 1.3 4.6" /><Path d="M19.6 12.5c0 2.4-.4 4.6-1.1 6.6" /><Path d="M7.2 11.2a4.9 4.9 0 0 1 9.6 0c.2 2.9-.2 5.8-1.2 8.5" /><Path d="M7.3 14.3c.2 2.6 1 4.8 2.3 6.6" /><Path d="M12 11.4c.2 3.6-.5 6.9-2 9.6" /><Path d="M14.6 13.4c0 2.6-.5 5-1.4 7.2" /></>,
  star: <Path d="m12 2.8 2.9 5.9 6.4.9-4.7 4.6 1.1 6.4L12 17.6l-5.7 3 1.1-6.4L2.7 9.6l6.4-.9z" />,
  zap: <Path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  target: <><Circle cx="12" cy="12" r="9" /><Circle cx="12" cy="12" r="5" /><Circle cx="12" cy="12" r="1" /></>,
  gift: <><Rect x="3" y="8" width="18" height="4" rx="1" /><Path d="M12 8v13M19 12v9H5v-9" /><Path d="M7.5 8a2.5 2.5 0 1 1 4.5-1.5V8M16.5 8A2.5 2.5 0 1 0 12 6.5" /></>,
  shield: <><Path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6z" /><Path d="m9 12 2 2 4-4" /></>,
  backspace: <><Path d="M21 5H8l-6 7 6 7h13a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" /><Path d="m16 9-5 6M11 9l5 6" /></>,
  chart: <><Path d="M3 3v18h18" /><Path d="m7 15 4-4 3 3 5-6" /></>,
  minus: <Path d="M5 12h14" />,
  database: <><Path d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z" /><Path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><Path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
  globe: <><Circle cx="12" cy="12" r="9" /><Path d="M3 12h18" /><Path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  calc: <><Rect x="5" y="2.5" width="14" height="19" rx="2" /><Path d="M8.5 6.5h7" /><Path d="M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h3.5" strokeWidth={2.6} /></>,
  palette: <><Path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z" /><Circle cx="7.5" cy="11" r="1.2" fill="currentColor" /><Circle cx="10.5" cy="7" r="1.2" fill="currentColor" /><Circle cx="15" cy="7.5" r="1.2" fill="currentColor" /></>,
  code: <><Path d="m8 7-5 5 5 5" /><Path d="m16 7 5 5-5 5" /><Path d="m13.5 4-3 16" /></>,
  heart: <Path d="M12 20s-7.5-4.6-9.3-9.2C1.5 7.6 3.6 4.5 6.8 4.5c2 0 3.3 1.1 4.2 2.4h2c.9-1.3 2.2-2.4 4.2-2.4 3.2 0 5.3 3.1 4.1 6.3C19.5 15.4 12 20 12 20z" />,
  leaf: <><Path d="M5 19c0-8 5.5-14 15-14 0 9.5-6 15-14 15" /><Path d="M5 19 14 10" /></>,
  pen: <><Path d="M15.5 4.5 19.5 8.5 9 19H5v-4z" /><Path d="m13 7 4 4" /></>,
  atom: <><Circle cx="12" cy="12" r="1.6" fill="currentColor" /><Path d="M4.6 7.8c2.3-4 9.7-1.1 13.6 5.7M19.4 16.2c-2.3 4-9.7 1.1-13.6-5.7" /><Path d="M4.6 16.2c-2.3-4 3.9-9.2 11.7-9.2M19.4 7.8c2.3 4-3.9 9.2-11.7 9.2" /></>,
  flag: <><Path d="M5 21V4" /><Path d="M5 4h12l-2 4 2 4H5" /></>,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22, color = C.ink, strokeWidth = 2 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} color={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </Svg>
  );
}

/** Icons a student can pick for a subject. */
export const FOLDER_ICONS: IconName[] = ['book', 'calc', 'flask', 'atom', 'globe', 'flag', 'pen', 'palette', 'music', 'dumbbell', 'code', 'chart', 'leaf', 'heart', 'cap', 'bulb'];
