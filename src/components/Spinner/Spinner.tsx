
const Spinner = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-primary/70" role="status" aria-live="polite">
      <style>{`
        @keyframes draw {
          from { stroke-dashoffset: var(--len, 240); }
          to { stroke-dashoffset: 0; }
        }
      `}</style>

      <svg
        width="128"
        height="128"
        viewBox="0 0 120 80"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        role="img"
        aria-label="Loading: Open Bible"
      >
        {/* Outer cover hint (subtle) */}
        <path
          d="M60 10 C 40 12, 20 20, 12 30 V72 C 22 62, 42 56, 60 54"
          style={{ opacity: 0.25 }}
        />
        <path
          d="M60 10 C 80 12, 100 20, 108 30 V72 C 98 62, 78 56, 60 54"
          style={{ opacity: 0.25 }}
        />

        {/* Left page outline (bold) */}
        <path
          d="M60 14 C 42 16, 24 22, 16 31 V68 C 26 59, 44 54, 60 52"
          style={{ strokeDasharray: 320, strokeDashoffset: 320, animation: 'draw 2.2s ease-in-out infinite alternate', animationDelay: '0s' }}
        />

        {/* Right page outline (bold) */}
        <path
          d="M60 14 C 78 16, 96 22, 104 31 V68 C 94 59, 76 54, 60 52"
          style={{ strokeDasharray: 320, strokeDashoffset: 320, animation: 'draw 2.2s ease-in-out infinite alternate', animationDelay: '0.18s' }}
        />

        {/* Center spine */}
        <path
          d="M60 14 V52"
          style={{ strokeDasharray: 120, strokeDashoffset: 120, animation: 'draw 1.9s ease-in-out infinite alternate', animationDelay: '0.35s' }}
        />

        {/* Inner page curves (left) */}
        <path
          d="M58 20 C 46 22, 34 26, 22 34"
          style={{ strokeDasharray: 160, strokeDashoffset: 160, animation: 'draw 2.0s ease-in-out infinite alternate', animationDelay: '0.55s' }}
        />
        <path
          d="M58 26 C 45 28, 33 32, 22 40"
          style={{ strokeDasharray: 160, strokeDashoffset: 160, animation: 'draw 2.0s ease-in-out infinite alternate', animationDelay: '0.65s' }}
        />
        <path
          d="M58 32 C 45 34, 34 38, 22 46"
          style={{ strokeDasharray: 160, strokeDashoffset: 160, animation: 'draw 2.0s ease-in-out infinite alternate', animationDelay: '0.75s' }}
        />

        {/* Inner page curves (right) */}
        <path
          d="M62 20 C 74 22, 86 26, 98 34"
          style={{ strokeDasharray: 160, strokeDashoffset: 160, animation: 'draw 2.0s ease-in-out infinite alternate', animationDelay: '0.6s' }}
        />
        <path
          d="M62 26 C 75 28, 87 32, 98 40"
          style={{ strokeDasharray: 160, strokeDashoffset: 160, animation: 'draw 2.0s ease-in-out infinite alternate', animationDelay: '0.7s' }}
        />
        <path
          d="M62 32 C 75 34, 86 38, 98 46"
          style={{ strokeDasharray: 160, strokeDashoffset: 160, animation: 'draw 2.0s ease-in-out infinite alternate', animationDelay: '0.8s' }}
        />

        {/* Ribbon bookmark */}
        <path
          d="M61 52 L61 68 L55 62"
          style={{ strokeDasharray: 120, strokeDashoffset: 120, animation: 'draw 1.7s ease-in-out infinite alternate', animationDelay: '0.95s' }}
        />
      </svg>

      <p className="mt-4 text-sm">Loading...</p>
    </div>
  );
};

export default Spinner;
