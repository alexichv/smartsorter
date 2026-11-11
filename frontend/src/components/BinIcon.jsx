export default function BinIcon({ color = "#6A747C", size = 64, animate = true, loop = false }) {
  const stroke = "rgba(0,0,0,.25)";
  return (
    <svg viewBox="0 0 64 72" width={size} height={(size * 72) / 64} aria-hidden="true" className="shrink-0">
      <path d="M12 26h40l-4 40a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3z" fill={color} stroke={stroke} strokeWidth="1.5" />
      <path d="M24 34v28M32 34v28M40 34v28" stroke="rgba(0,0,0,.2)" strokeWidth="2.5" strokeLinecap="round" />
      <g className={animate ? `bin-lid${loop ? " loop" : ""}` : undefined}>
        <rect x="8" y="17" width="48" height="9" rx="3" fill={color} stroke={stroke} strokeWidth="1.5" />
        <rect x="25" y="11" width="14" height="6" rx="2" fill={color} stroke={stroke} strokeWidth="1.5" />
      </g>
    </svg>
  );
}
