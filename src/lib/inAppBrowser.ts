// Links opened from Messenger, Facebook, Instagram etc. open in that app's own browser.
// Google blocks sign-in there (403 disallowed_useragent), so the login page warns first.

const APPS: [RegExp, string][] = [
  [/Messenger|FB_IAB\/MESSENGER/i, 'Messenger'],
  [/FBAN|FBAV|FB_IAB/, 'Facebook'],
  [/Instagram/, 'Instagram'],
  [/musical_ly|BytedanceWebview|TikTok/i, 'TikTok'],
  [/\bLine\//, 'LINE'],
  [/MicroMessenger/, 'WeChat'],
  [/Snapchat/, 'Snapchat'],
  [/Twitter|X-Client/, 'X'],
];

/** The app whose built-in browser this is, 'an app' for an unknown Android webview, or null. */
export function inAppBrowserName(userAgent: string): string | null {
  for (const [pattern, name] of APPS) if (pattern.test(userAgent)) return name;
  if (/; wv\)/.test(userAgent)) return 'an app';
  return null;
}
