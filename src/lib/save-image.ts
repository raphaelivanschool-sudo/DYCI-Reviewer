import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Platform, type HostInstance } from 'react-native';
import { captureRef } from 'react-native-view-shot';

const FILE = 'METAKNOWIA-schedule.png';

/** Turns a view into a PNG. On the web this uses html2canvas-pro (installed for that). */
async function capture(ref: RefObject<HostInstance | null>) {
  return captureRef(ref, Platform.OS === 'web' ? { format: 'png', quality: 1, result: 'data-uri' } : { format: 'png', quality: 1, fileName: 'METAKNOWIA-schedule' });
}

/** Phone: saves to the Gallery. Web: downloads a PNG file. Returns the message to show. */
export async function downloadImage(ref: RefObject<HostInstance | null>): Promise<string> {
  const uri = await capture(ref);
  if (Platform.OS === 'web') {
    const a = document.createElement('a');
    a.href = uri;
    a.download = FILE;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return `Downloaded ${FILE}`;
  }
  const perm = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
  if (!perm.granted) throw new Error('Allow photo access in Settings to save your schedule.');
  await MediaLibrary.Asset.create(uri);
  return 'Saved to your Gallery';
}

/**
 * Phone: opens the share sheet. Web: uses the browser's share (with the PNG) when it can,
 * otherwise downloads the file so it can be shared by hand. Returns a message, or null if shared.
 */
export async function shareImage(ref: RefObject<HostInstance | null>): Promise<string | null> {
  const uri = await capture(ref);
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    const file = new File([blob], FILE, { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: 'My METAKNOWIA schedule' });
      return null;
    }
    await downloadImage(ref);
    return 'Your browser can’t share images, so we downloaded it instead.';
  }
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share my schedule' });
  return null;
}
