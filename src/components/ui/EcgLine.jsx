// Assinatura visual: linha de ECG discreta. Decorativa (aria-hidden).
export default function EcgLine({ className = "" }) {
  return (
    <svg
      className={`hx-ecg ${className}`.trim()}
      viewBox="0 0 1200 80"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M0 40 H330 L352 40 L368 14 L388 66 L408 4 L428 58 L444 40 H520 L540 40 L552 30 L566 40 H1200"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
