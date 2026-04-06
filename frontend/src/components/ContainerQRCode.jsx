import { QRCodeSVG } from 'qrcode.react';

export function buildQrUrl(token) {
  return `${import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin}/scan/container/${token}`;
}

export default function ContainerQRCode({ token, size = 220 }) {
  return <QRCodeSVG value={buildQrUrl(token)} size={size} marginSize={2} />;
}
