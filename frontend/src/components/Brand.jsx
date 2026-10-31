import { useId } from 'react';
import { Link } from 'react-router-dom';

export default function Brand({ light = false }) {
  const gradientId = `transly-mark-${useId().replace(/:/g, '')}`;

  return (
    <Link className={`brand${light ? ' brand-light' : ''}`} to="/" aria-label="Transly home">
      <svg className="brand-symbol" viewBox="0 0 40 40" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="4" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor="#83DB91" />
            <stop offset=".56" stopColor="#35A653" />
            <stop offset="1" stopColor="#218342" />
          </linearGradient>
        </defs>
        <path d="M8 5.5h24a4 4 0 0 1 0 8H23v17a4.5 4.5 0 0 1-9 0v-17H8a4 4 0 0 1 0-8Z" fill={`url(#${gradientId})`} />
        <path d="M8 5.5h16a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8Z" fill="#B8EBC0" />
        <circle cx="29.5" cy="30" r="4" fill="#F2B66D" />
      </svg>
      <span className="brand-word"><span>Trans</span><span className="brand-accent">ly</span><span className="brand-period">.</span></span>
    </Link>
  );
}
