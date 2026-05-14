import { QRCodeSVG } from 'qrcode.react';

export function buildQrUrl(token) {
  // Origin: prefer the build-time env var (set for LAN use), otherwise use the
  // current browser origin (correct for HA Cloud / Nabu Casa remote access).
  const origin = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;
  // Include the ingress base path so the QR URL works when accessed through
  // Home Assistant ingress. Empty string when running locally.
  const pathBase = window.__BASE__ || '';
  return `${origin}${pathBase}/scan/container/${token}`;
}

export default function ContainerQRCode({ token, size = 220 }) {
  return <QRCodeSVG value={buildQrUrl(token)} size={size} marginSize={2} />;
}
