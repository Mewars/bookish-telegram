/** A small bitten-cookie mark with a transparent background and black strokes. */
export function CookieIcon({ size = 27 }: { size?: number }) {
  return <svg className="cookie-bite-icon" width={size} height={size} viewBox="0 0 100 100"
    aria-hidden="true" focusable="false" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M57 8C48 4 39 4 29 8C19 12 10 21 7 33C4 42 5 56 10 68C16 82 30 92 45 94C59 97 72 91 81 81C90 71 95 59 93 45C87 48 81 45 78 39C71 40 66 34 67 28C60 28 55 23 56 18C53 15 54 11 57 8Z"
      stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"
    />
    <circle cx="28" cy="30" r="5" fill="currentColor"/>
    <circle cx="43" cy="18" r="4.5" fill="currentColor"/>
    <circle cx="20" cy="54" r="5.5" fill="currentColor"/>
    <circle cx="51" cy="43" r="8" fill="currentColor"/>
    <circle cx="73" cy="52" r="4.5" fill="currentColor"/>
    <circle cx="37" cy="75" r="6" fill="currentColor"/>
    <circle cx="63" cy="77" r="5.5" fill="currentColor"/>
    <circle cx="18" cy="72" r="3.5" fill="currentColor"/>
  </svg>;
}
