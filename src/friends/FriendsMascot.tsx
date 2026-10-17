import { useId } from 'react';

/** Original РЯДОМ companion icon, vector-only (no third-party character or image). */
export function FriendsMascot({ size = 36, className = '' }: { size?: number; className?: string }) {
  const id = useId().replaceAll(':', '');
  const body = `friends-body-${id}`;
  const glow = `friends-glow-${id}`;
  return <svg className={className || undefined} width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={body} cx="0" cy="0" r="1" gradientTransform="translate(32 22) rotate(59) scale(92 83)" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFFFFF"/>
        <stop offset=".62" stopColor="#E9F7FF"/>
        <stop offset="1" stopColor="#B9D8F5"/>
      </radialGradient>
      <radialGradient id={glow} cx="0" cy="0" r="1" gradientTransform="translate(50 50) rotate(90) scale(49)" gradientUnits="userSpaceOnUse">
        <stop stopColor="#C9F4FF" stopOpacity=".95"/>
        <stop offset="1" stopColor="#80C6FF" stopOpacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="49" fill={`url(#${glow})`}/>
    <path d="M50 17V11" stroke="#84ACDB" strokeWidth="3" strokeLinecap="round"/>
    <circle cx="50" cy="9" r="5" fill="#5FDEAA" stroke="#ECFFFF" strokeWidth="2"/>
    <path d="M18 54C18 32 30 22 50 22s32 10 32 32v13c0 17-13 24-32 24S18 84 18 67V54Z"
      fill={`url(#${body})`} stroke="#D1EBFF" strokeWidth="2.4"/>
    <path d="M28 46c4-5 10-5 14 0M58 46c4-5 10-5 14 0"
      stroke="#1B385B" strokeWidth="4.4" strokeLinecap="round"/>
    <path d="M45 55c3 3 7 3 10 0" stroke="#1B385B" strokeWidth="3.2" strokeLinecap="round"/>
    <ellipse cx="30" cy="55" rx="6" ry="3" fill="#F8B5CC" opacity=".62"/>
    <ellipse cx="70" cy="55" rx="6" ry="3" fill="#F8B5CC" opacity=".62"/>
    <path d="M17 66c-3 0-5-3-5-7M83 66c3 0 5-3 5-7" stroke="#B2D9F8" strokeWidth="6" strokeLinecap="round"/>
    <path d="M50 81s-13-8-13-17a8 8 0 0 1 13-6 8 8 0 0 1 13 6c0 9-13 17-13 17Z"
      fill="#3F9DF5" stroke="#FFFFFF" strokeWidth="2.4"/>
    <path d="M50 72s-7-4.4-7-8a4 4 0 0 1 7-2.3 4 4 0 0 1 7 2.3c0 3.6-7 8-7 8Z" fill="white"/>
  </svg>;
}
