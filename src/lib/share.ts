import type { RefObject } from 'react';
import { PixelRatio, Platform, Share, type HostInstance } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef, releaseCapture } from 'react-native-view-shot';

// Where shared links point: the web app, which anyone can open.
export const SITE_URL = 'https://thedailydrip.app';

// copied: the browser has no share sheet, so the text went to the clipboard instead.
// saved: the browser can't share images, so the picture was downloaded instead.
export type ShareResult = 'shared' | 'copied' | 'saved' | 'dismissed' | 'failed';

const isAbort = (e: unknown) => e instanceof Error && e.name === 'AbortError';

/** Opens the system share sheet with `message` and a link to the app. */
export async function shareWithLink(message: string): Promise<ShareResult> {
  try {
    if (Platform.OS === 'web') {
      if (navigator.share) {
        await navigator.share({ text: message, url: SITE_URL });
        return 'shared';
      }
      await navigator.clipboard.writeText(`${message} ${SITE_URL}`);
      return 'copied';
    }
    // Android shares only the message, so the link goes in it.
    const result = await Share.share(
      Platform.OS === 'ios' ? { message, url: SITE_URL } : { message: `${message} ${SITE_URL}` },
    );
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch (e) {
    // Browsers reject with AbortError when the share sheet is closed.
    return isAbort(e) ? 'dismissed' : 'failed';
  }
}

// A picture to share: a temporary file on native, a data URI and File on web.
export type ShareImage = { uri: string; name: string; file?: File };

// Shared pictures are 1080 pixels square, a size every social app takes.
const IMAGE_PIXELS = 1080;

/** Takes a picture of a square view, ready for shareImage. */
export async function captureForSharing(view: RefObject<HostInstance | null>, name: string): Promise<ShareImage> {
  // Native sizes are in points; web sizes are in pixels.
  const size = Platform.OS === 'web' ? IMAGE_PIXELS : IMAGE_PIXELS / PixelRatio.get();
  if (Platform.OS !== 'web') {
    const uri = await captureRef(view.current, { format: 'png', result: 'tmpfile', width: size, height: size });
    return { uri, name };
  }
  const uri = await captureRef(view.current, { format: 'png', result: 'data-uri', width: size, height: size });
  const blob = await (await fetch(uri)).blob();
  return { uri, name, file: new File([blob], `${name}.png`, { type: 'image/png' }) };
}

/**
 * Shares a picture from captureForSharing. On web, call it straight from a tap: browsers
 * only open the share sheet right after one.
 */
export async function shareImage(image: ShareImage, message: string): Promise<ShareResult> {
  try {
    if (Platform.OS === 'web') {
      const files = image.file ? [image.file] : [];
      const text = `${message} ${SITE_URL}`;
      if (files.length > 0 && navigator.canShare?.({ files, text })) {
        await navigator.share({ files, text });
        return 'shared';
      }
      // No image sharing here (most desktop browsers): download it instead.
      const link = document.createElement('a');
      link.href = image.uri;
      link.download = `${image.name}.png`;
      link.click();
      return 'saved';
    }
    if (!(await Sharing.isAvailableAsync())) return shareWithLink(message);
    await Sharing.shareAsync(image.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share' });
    return 'shared';
  } catch (e) {
    return isAbort(e) ? 'dismissed' : 'failed';
  }
}

/** Deletes a picture's temporary file once it's no longer needed. */
export function releaseImage(image: ShareImage) {
  if (Platform.OS !== 'web') releaseCapture(image.uri);
}
