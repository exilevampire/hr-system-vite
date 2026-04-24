export function RedCrossIcon({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="สภากาชาดไทย"
    >
      <circle cx="50" cy="50" r="48" fill="white" stroke="#CC0000" strokeWidth="3" />
      <rect x="38" y="18" width="24" height="64" rx="3" fill="#CC0000" />
      <rect x="18" y="38" width="64" height="24" rx="3" fill="#CC0000" />
    </svg>
  );
}
