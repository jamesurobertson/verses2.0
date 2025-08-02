import React from 'react';

const BookLoader = () => {
  const strokeLength = 180; // total approx length for smooth animation

  const drawAnimation = {
    strokeDasharray: strokeLength,
    strokeDashoffset: strokeLength,
    animation: 'draw 2.5s linear infinite',
  };

  return (
    <>
      <style>{`
        @keyframes draw {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>

      <svg
        width="100"
        height="100"
        viewBox="0 0 64 64"
        fill="none"
        stroke="#444"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g style={drawAnimation}>
          {/* Book cover */}
          <rect x="14" y="12" width="36" height="40" rx="6" ry="6" />

          {/* Book spine line */}
          <line x1="22" y1="12" x2="22" y2="52" />

          {/* Ribbon bookmark */}
          <polyline points="44,44 44,36 38,44" fill="none" />
        </g>
      </svg>
    </>
  );
};

export default BookLoader;
