"use client";

type BrandMarkProps = {
  size?: number;
  className?: string;
};

/** Faceted, irregular obsidian shard used as the product mark. */
export default function BrandMark({ size = 40, className = "" }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role="img"
      aria-label="Obsidian Gym Manager logo"
    >
      <defs>
        <linearGradient id="obsidian-base" x1="10" y1="7" x2="39" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#667085" />
          <stop offset="0.38" stopColor="#252B3A" />
          <stop offset="1" stopColor="#090B12" />
        </linearGradient>
        <linearGradient id="obsidian-edge" x1="8" y1="8" x2="37" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B7C1D3" stopOpacity="0.9" />
          <stop offset="1" stopColor="#536078" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      <path
        d="M24 3 39 9l6 15-7 16-15 5L8 33 3 19 11 7l13-4Z"
        fill="url(#obsidian-base)"
        stroke="url(#obsidian-edge)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="m24 3 4 18-4 24-16-12 16-12-13-4L24 3Z" fill="#111522" fillOpacity="0.88" />
      <path d="m24 3 15 6-11 12-4-18Z" fill="#8793A8" fillOpacity="0.72" />
      <path d="m28 21 11-12 6 15-21 21 4-24Z" fill="#343C50" fillOpacity="0.9" />
      <path d="m8 33 16 12-7-18-9-13-5 5 5 14Z" fill="#202738" />
      <path d="m11 7 13-4-8 12-13 4L11 7Z" fill="#4D5870" fillOpacity="0.8" />
      <path d="m16 15 8 6-8 6-8-14 8 2Z" fill="#0A0D15" fillOpacity="0.8" />
      <path d="m24 21 4 0-4 24-8-18 8-6Z" fill="#66728A" fillOpacity="0.38" />
    </svg>
  );
}
