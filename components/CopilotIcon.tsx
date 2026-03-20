export default function CopilotIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ci-bg" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id="ci-glow" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#A78BFA" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="128" height="128" rx="26" fill="url(#ci-bg)" />
      <rect x="6" y="6" width="116" height="116" rx="22" fill="url(#ci-glow)" />

      {/* Antenna */}
      <rect x="61" y="24" width="6" height="18" rx="3" fill="white" opacity="0.92" />
      <circle cx="64" cy="20" r="7" fill="#38BDF8" />
      <circle cx="64" cy="20" r="3.5" fill="white" opacity="0.6" />

      {/* Robot head */}
      <rect x="26" y="40" width="76" height="60" rx="14" fill="white" opacity="0.95" />

      {/* Left eye */}
      <rect x="36" y="57" width="20" height="14" rx="5" fill="#1E40AF" />
      <circle cx="39.5" cy="60.5" r="3" fill="white" opacity="0.55" />
      {/* Right eye */}
      <rect x="72" y="57" width="20" height="14" rx="5" fill="#1E40AF" />
      <circle cx="75.5" cy="60.5" r="3" fill="white" opacity="0.55" />

      {/* Mouth */}
      <rect x="42" y="80" width="44" height="3.5" rx="1.75" fill="#1E40AF" opacity="0.45" />
      <rect x="42" y="87" width="44" height="3.5" rx="1.75" fill="#1E40AF" opacity="0.3" />

      {/* Ears */}
      <rect x="13" y="58" width="13" height="22" rx="5" fill="white" opacity="0.78" />
      <rect x="102" y="58" width="13" height="22" rx="5" fill="white" opacity="0.78" />
    </svg>
  );
}
