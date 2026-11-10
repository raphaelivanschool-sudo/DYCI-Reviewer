import { useWindowDimensions, type ViewStyle } from 'react-native';

/**
 * Responsive layout helpers.
 *
 * The app is designed for phones. On tablets, foldables and the web, colored bands (headers, footers,
 * tab bar) still span the full width, but the content inside sits in a centered column so lines and
 * cards don't stretch across a huge screen.
 */

/** Widest the content column gets (a large phone / small tablet in portrait). */
export const CONTENT_MAX = 640;

/** Centered column used inside full-width bands and scroll views. */
export const column: ViewStyle = { width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center' };

/** White bottom-sheet panel: full width on phones, a centered card on wide screens. */
export const sheetPanel: ViewStyle = {
  backgroundColor: '#fff',
  borderTopLeftRadius: 28,
  borderTopRightRadius: 28,
  width: '100%',
  maxWidth: CONTENT_MAX,
  alignSelf: 'center',
};

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    /** Small phones (iPhone SE, older Androids): tighten spacing and shrink big art. */
    compact: width < 360,
    /** Tablets, landscape phones and desktop web. */
    wide: width >= 720,
    /** Extra columns for grids on wide screens: cols(2) → 2 on phones, 3 on tablets, 4 on desktop. */
    cols: (phone: number) => (width >= 1024 ? phone + 2 : width >= 720 ? phone + 1 : phone),
    /** Large illustrations: never take more than ~42% of the screen width or ~22% of its height. */
    art: (size: number) => Math.round(Math.max(64, Math.min(size, width * 0.42, height * 0.22))),
  };
}
