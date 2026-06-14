// Flat-style semi-truck illustration in the Asphalt & Amber palette. Sized via className.
export default function TruckArt({ className = "h-auto w-full" }) {
  return (
    <svg viewBox="0 0 260 140" className={className} role="img" aria-label="Semi truck" xmlns="http://www.w3.org/2000/svg">
      {/* motion lines */}
      <g stroke="#fbbf24" strokeWidth="3" strokeLinecap="round">
        <line x1="4" y1="58" x2="20" y2="58" />
        <line x1="0" y1="72" x2="22" y2="72" />
        <line x1="6" y1="86" x2="20" y2="86" />
      </g>

      {/* ground shadow */}
      <ellipse cx="134" cy="124" rx="116" ry="7" fill="#e2e8f0" />

      {/* trailer */}
      <rect x="94" y="30" width="146" height="74" rx="7" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2.5" />
      <g stroke="#e2e8f0" strokeWidth="2">
        <line x1="130" y1="36" x2="130" y2="98" />
        <line x1="166" y1="36" x2="166" y2="98" />
        <line x1="202" y1="36" x2="202" y2="98" />
      </g>
      <rect x="100" y="86" width="134" height="7" rx="3.5" fill="#fde68a" />

      {/* cab + hood */}
      <path
        d="M26 104 L26 80 Q26 76 30 76 L58 76 L70 44 Q72 40 78 40 L94 40 L94 104 Z"
        fill="#f59e0b"
      />
      {/* windshield */}
      <path d="M64 73 L72 50 L89 50 L89 73 Z" fill="#e0f2fe" stroke="#bae6fd" strokeWidth="1.5" />
      {/* headlight + grille */}
      <rect x="27.5" y="86" width="4.5" height="9" rx="1.5" fill="#fcd34d" />
      <circle cx="31" cy="82" r="2.2" fill="#fffbeb" />

      {/* wheels */}
      {[50, 158, 200].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="106" r="17" fill="#1e293b" />
          <circle cx={cx} cy="106" r="7.5" fill="#cbd5e1" />
          <circle cx={cx} cy="106" r="3" fill="#f59e0b" />
        </g>
      ))}
    </svg>
  )
}
