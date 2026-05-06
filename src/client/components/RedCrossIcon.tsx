export function RedCrossIcon({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="สภากาชาดไทย"
    >
      <rect x="37" y="10" width="26" height="80" fill="#CC0000" />
      <rect x="10" y="37" width="80" height="26" fill="#CC0000" />
    </svg>
  );
}
