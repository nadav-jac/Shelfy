import { QRCodeSVG } from 'qrcode.react';

export function buildQrUrl(token) {
  // QR codes encode the full URL to this container's scan page.
  //
  // We use the current browser origin + the ingress base path so the URL is
  // always correct for wherever the app is being accessed from:
  //
  //   • Via Nabu Casa remote access: origin = https://xxx.ui.nabu.casa,
  //     __BASE__ = /api/hassio_ingress/<token> → full cloud URL that works
  //     from anywhere with an internet connection.
  //     (Requires the scanning device to be logged into Home Assistant in its
  //     browser — a one-time step. After that, scanning works everywhere.)
  //
  //   • Via direct local port (43127): origin = http://homeassistant.local:43127,
  //     __BASE__ = "" → local network URL.
  //
  //   • Local development: origin = http://localhost:5173, __BASE__ = "".
  //
  // Tip: print QR labels while accessing Shelfy through Nabu Casa so the
  // encoded URL works both at home and away.
  const origin = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;
  const pathBase = window.__BASE__ || '';
  return `${origin}${pathBase}/scan/container/${token}`;
}

export default function ContainerQRCode({ token, size = 220 }) {
  return <QRCodeSVG value={buildQrUrl(token)} size={size} marginSize={2} />;
}
