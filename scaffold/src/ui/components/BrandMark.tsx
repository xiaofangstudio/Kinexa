/**
 * 品牌标记：一枚暖黄圆角方块 + 深棕 K 形笔锋。
 * 黄色取自 tokens 的品牌暖黄，形状只用一条竖笔与两道斜锋，不做渐变、不做立体。
 */
export default function BrandMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-label="Kinexa"
      role="img"
    >
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="8.5"
        fill="var(--kx-brand)"
      />
      <path
        d="M11 8.6v14.8"
        stroke="#30260c"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M11.6 16.4l7.2-6.6M11.6 16.4l7.2 6.6"
        stroke="#30260c"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="24.3" cy="23.4" r="1.8" fill="#30260c" opacity="0.92" />
    </svg>
  );
}
