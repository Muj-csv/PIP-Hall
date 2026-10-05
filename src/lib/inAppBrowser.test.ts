import { describe, expect, it } from 'vitest';
import { inAppBrowserName } from './inAppBrowser';

const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

describe('inAppBrowserName', () => {
  it('spots the usual in-app browsers', () => {
    expect(inAppBrowserName(`${IPHONE_SAFARI} [FBAN/MessengerForiOS;FBAV/450.0]`)).toBe('Messenger');
    expect(inAppBrowserName(`${ANDROID_CHROME} [FB_IAB/MESSENGER;FBAV/450.0]`)).toBe('Messenger');
    expect(inAppBrowserName(`${ANDROID_CHROME} [FB_IAB/FB4A;FBAV/480.0]`)).toBe('Facebook');
    expect(inAppBrowserName(`${IPHONE_SAFARI} Instagram 340.0`)).toBe('Instagram');
    expect(inAppBrowserName(ANDROID_CHROME.replace('Pixel 7)', 'Pixel 7; wv)'))).toBe('an app');
  });
  it('leaves normal phone browsers alone', () => {
    expect(inAppBrowserName(ANDROID_CHROME)).toBeNull();
    expect(inAppBrowserName(IPHONE_SAFARI)).toBeNull();
  });
});
