import { Platform, Share } from 'react-native';

// Where shared links point: the web app, which anyone can open.
export const SITE_URL = 'https://dailydrip.alexpatten.com';

// copied: the browser has no share sheet, so the text went to the clipboard instead.
export type ShareResult = 'shared' | 'copied' | 'dismissed' | 'failed';

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
    return e instanceof Error && e.name === 'AbortError' ? 'dismissed' : 'failed';
  }
}
