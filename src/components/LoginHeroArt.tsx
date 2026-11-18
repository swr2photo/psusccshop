'use client';

import { Box } from '@mui/material';
import { keyframes } from '@mui/material/styles';

// Decorative vector backdrop for the login hero: night-blue gradient, soft
// aurora glows, a dot grid, circuit traces with travelling light pulses
// (a nod to the computer club) and a glass club-shirt on a hanger.
// Purely presentational — hidden from assistive tech.

const drift = keyframes`
  from { transform: translate(0, 0); }
  to   { transform: translate(24px, -18px); }
`;

const pulse = keyframes`
  from { stroke-dashoffset: 0; }
  to   { stroke-dashoffset: -520; }
`;

const sway = keyframes`
  0%, 100% { transform: rotate(-1.6deg); }
  50%      { transform: rotate(1.6deg); }
`;

const TRACES = [
  'M0 250 H120 L170 300 H330',
  'M0 420 H70 L120 370 H240 L280 410 H360',
  'M800 520 H690 L640 570 H520',
  'M800 640 H730 L690 600 H600',
  'M0 760 H150 L200 710 H300 L340 750 H420',
  'M260 1000 V900 L300 860 V800',
  'M560 1000 V930 L520 890 V840',
];

const NODES: [number, number][] = [
  [330, 300], [360, 410], [520, 570], [600, 600], [420, 750], [300, 800], [520, 840],
];

export default function LoginHeroArt() {
  return (
    <Box
      aria-hidden="true"
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        '& svg': { width: '100%', height: '100%', display: 'block' },
        '& .art-blob': {
          transformBox: 'fill-box',
          animation: `${drift} 14s ease-in-out infinite alternate`,
        },
        '& .art-blob-2': { animationDuration: '18s', animationDirection: 'alternate-reverse' },
        '& .art-blob-3': { animationDuration: '22s' },
        '& .art-pulse': {
          strokeDasharray: '14 506',
          animation: `${pulse} 5.5s linear infinite`,
        },
        '& .art-shirt': {
          transformBox: 'view-box',
          transformOrigin: '662px 18px', // the hanger hook
          animation: `${sway} 7s ease-in-out infinite`,
          display: { xs: 'none', md: 'inline' },
        },
        '@media (prefers-reduced-motion: reduce)': {
          '& .art-blob, & .art-pulse, & .art-shirt': { animation: 'none' },
          '& .art-pulse': { display: 'none' },
        },
      }}
    >
      <svg viewBox="0 0 800 1000" preserveAspectRatio="xMidYMin slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="art-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0a1c46" />
            <stop offset="45%" stopColor="#071433" />
            <stop offset="100%" stopColor="#030712" />
          </linearGradient>
          <radialGradient id="art-glow-blue">
            <stop offset="0%" stopColor="#0a84ff" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#0a84ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="art-glow-cyan">
            <stop offset="0%" stopColor="#64d2ff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#64d2ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="art-glow-violet">
            <stop offset="0%" stopColor="#bf5af2" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#bf5af2" stopOpacity="0" />
          </radialGradient>
          <pattern id="art-dots" width="26" height="26" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.2" fill="#ffffff" fillOpacity="0.16" />
          </pattern>
          <radialGradient id="art-dots-fade" cx="0.6" cy="0.35" r="0.75">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="art-dots-mask">
            <rect width="800" height="1000" fill="url(#art-dots-fade)" />
          </mask>
          <linearGradient id="art-shirt-fill" x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="art-shirt-stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a5e3ff" />
            <stop offset="100%" stopColor="#0a84ff" />
          </linearGradient>
          <filter id="art-soft-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Base + glows */}
        <rect width="800" height="1000" fill="url(#art-bg)" />
        <circle className="art-blob" cx="660" cy="170" r="380" fill="url(#art-glow-blue)" />
        <circle className="art-blob art-blob-2" cx="80" cy="860" r="420" fill="url(#art-glow-violet)" />
        <circle className="art-blob art-blob-3" cx="720" cy="800" r="280" fill="url(#art-glow-cyan)" />

        {/* Dot grid */}
        <rect width="800" height="1000" fill="url(#art-dots)" mask="url(#art-dots-mask)" />

        {/* Orbit rings */}
        <g fill="none" stroke="#ffffff">
          <circle cx="662" cy="170" r="170" strokeOpacity="0.10" />
          <circle cx="662" cy="170" r="250" strokeOpacity="0.06" strokeDasharray="3 9" />
          <circle cx="662" cy="170" r="340" strokeOpacity="0.04" />
        </g>

        {/* Circuit traces + pulses */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {TRACES.map((d) => (
            <path key={d} d={d} stroke="#64d2ff" strokeOpacity="0.22" strokeWidth="1.5" />
          ))}
          {TRACES.map((d, i) => (
            <path
              key={`p-${d}`}
              className="art-pulse"
              d={d}
              stroke="#a5e3ff"
              strokeWidth="2.5"
              style={{ animationDelay: `${-i * 0.8}s` }}
            />
          ))}
        </g>
        <g>
          {NODES.map(([x, y]) => (
            <g key={`${x}-${y}`}>
              <circle cx={x} cy={y} r="7" fill="#64d2ff" fillOpacity="0.12" />
              <circle cx={x} cy={y} r="3.5" fill="#030712" stroke="#64d2ff" strokeOpacity="0.7" strokeWidth="1.5" />
            </g>
          ))}
        </g>

        {/* Club shirt on a hanger */}
        <g className="art-shirt">
          <g transform="translate(560 30) scale(0.85)">
            <path
              d="M120 0 C120 -14 136 -16 138 -6 M120 0 V14 M62 44 L120 14 L178 44"
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.55"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <g transform="translate(0 30)" filter="url(#art-soft-glow)">
              <path
                d="M90 12 Q120 46 150 12 L200 24 L240 66 L212 104 L184 90 L184 236 Q120 246 56 236 L56 90 L28 104 L0 66 L40 24 Z"
                fill="url(#art-shirt-fill)"
                stroke="url(#art-shirt-stroke)"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path d="M90 12 Q120 46 150 12" fill="none" stroke="#a5e3ff" strokeOpacity="0.8" strokeWidth="3" />
              <text
                x="120"
                y="138"
                textAnchor="middle"
                fontSize="34"
                fontWeight="800"
                letterSpacing="4"
                fill="#ffffff"
                fillOpacity="0.92"
              >
                SCC
              </text>
              <rect x="94" y="150" width="52" height="16" rx="3" fill="#0a84ff" />
              <text x="120" y="162" textAnchor="middle" fontSize="10" fontWeight="800" letterSpacing="2.5" fill="#ffffff">
                SHOP
              </text>
            </g>
          </g>
        </g>
      </svg>
    </Box>
  );
}
