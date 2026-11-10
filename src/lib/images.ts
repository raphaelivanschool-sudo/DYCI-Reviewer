import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { Attachment } from './ai';

/**
 * Shrinks a photo before it is sent to the AI: at most 1600 px wide, JPEG.
 * Phone photos are often 4–8 MB; this keeps several photos small enough to upload quickly.
 */
export async function photoAttachment(uri: string, width?: number): Promise<Attachment> {
  let ctx = ImageManipulator.manipulate(uri);
  if (!width || width > 1600) ctx = ctx.resize({ width: 1600 });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  return { mimeType: 'image/jpeg', base64: out.base64 ?? '' };
}
