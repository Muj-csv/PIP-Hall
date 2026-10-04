import { QRCodeSVG } from 'qrcode.react';

/** QR for a URL, drawn in the surrounding text colour (set by CSS, so no colour is hard-coded). */
export function QrCode({ value, title }: { value: string; title?: string }) {
  return <QRCodeSVG value={value} level="M" marginSize={0} fgColor="currentColor" bgColor="transparent" title={title} />;
}
