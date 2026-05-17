import { QRCodeSVG } from 'qrcode.react';

export function buildQrUrl(token) {
  // QR codes use the stable route /shelfy/scan/container/<token>.
  //
  // This path is served by the shelfy_redirect custom integration on HA's
  // own HTTP server. It redirects to the current ingress URL, so the QR
  // URL never changes when the add-on is reinstalled (unlike raw ingress
  // URLs, which contain a dynamic token that changes on reinstall).
  //
  // In standalone mode (no HA), Express handles /shelfy/scan/container/:token
  // itself and redirects to the React route /scan/container/:token.
  //
  // window.location.origin (not window.__BASE__) gives the correct host:
  //   • Nabu Casa: https://xxx.ui.nabu.casa → works from anywhere
  //   • Local HA:  http://homeassistant.local → works on LAN
  //   • Standalone: http://localhost:43127 → works locally
  const origin = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;
  return `${origin}/shelfy/scan/container/${token}`;
}

export default function ContainerQRCode({ token, size = 220 }) {
  return <QRCodeSVG value={buildQrUrl(token)} size={size} marginSize={2} />;
}
