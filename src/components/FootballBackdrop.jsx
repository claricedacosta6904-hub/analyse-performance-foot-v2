// Ballon stylisé en SVG (aucune image externe requise), positionné en
// arrière-plan via CSS (.football-backdrop). Toujours derrière le
// contenu (z-index: 0 alors que .app-main est en z-index: 1).
export default function FootballBackdrop() {
  return (
    <>
      <div className="floodlight-glow" aria-hidden="true" />
      <svg
        className="football-backdrop"
        viewBox="0 0 400 400"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="ballShade" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#2A3550" />
            <stop offset="55%" stopColor="#141B2C" />
            <stop offset="100%" stopColor="#070B14" />
          </radialGradient>
          <filter id="ballBlur">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>
        <circle cx="200" cy="200" r="180" fill="url(#ballShade)" filter="url(#ballBlur)" />
        <g stroke="#0A0F1C" strokeWidth="2.5" fill="none" opacity="0.55">
          <polygon points="200,120 235,145 222,188 178,188 165,145" fill="#1B2338" />
          <polygon points="200,120 235,145 270,130 260,95 220,90" />
          <polygon points="165,145 130,130 140,95 180,90 200,120" />
          <polygon points="222,188 260,210 250,250 210,240" />
          <polygon points="178,188 140,210 150,250 190,240" />
          <circle cx="200" cy="200" r="180" />
          <circle cx="200" cy="200" r="180" transform="rotate(72 200 200)" />
          <circle cx="200" cy="200" r="180" transform="rotate(144 200 200)" />
        </g>
        <ellipse cx="150" cy="130" rx="55" ry="35" fill="#3D6BFF" opacity="0.07" />
      </svg>
    </>
  );
}
