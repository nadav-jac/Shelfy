import { QRCodeSVG } from 'qrcode.react';

export function buildQrUrl(token) {
  // QR codes are printed on physical labels and scanned by phones that have no
  // Home Assistant session cookie. They must therefore point to the direct-port
  // URL, never the ingress URL (which requires HA authentication → 401).
  //
  // Priority:
  //  1. window.__QR_BASE__ — injected by the server from the QR_BASE_URL env var
  //     (set via the add-on "qr_base_url" option in HA, e.g. http://homeassistant.local:43127).
  //  2. VITE_PUBLIC_BASE_URL — build-time override for standalone / non-HA use.
  //  3. window.location.origin — fallback for local dev (no ingress, no config needed).
  const base = window.__QR_BASE__ || import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;
  return `${base}/scan/container/${token}`;
}

export default function ContainerQRCode({ token, size = 220 }) {
  return <QRCodeSVG value={buildQrUrl(token)} size={size} marginSize={2} />;
}
