type Props = { size?: number; className?: string };

function frame(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };
}

export function IconBrush(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <path d="M4 20l4.4-1.1 9.1-9.1a2.2 2.2 0 0 0-3.1-3.1L5.3 15.8z" />
      <path d="M13.4 6.9l3.1 3.1" />
      <path d="M6.2 15l2.8 2.8" opacity={0.55} />
    </svg>
  );
}

export function IconEraser(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <path d="M8 19.5h11" />
      <path d="M7 16.9l7.6-7.6a1.7 1.7 0 0 1 2.4 0l2.6 2.6a1.7 1.7 0 0 1 0 2.4l-4.6 4.6H7.6z" />
      <path d="M7 16.9l4.2-4.2" />
    </svg>
  );
}

export function IconHand(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <path d="M9 11.6V6.4a1.45 1.45 0 0 1 2.9 0v5" />
      <path d="M11.9 11.2V5.6a1.45 1.45 0 0 1 2.9 0v5.8" />
      <path d="M14.8 11.6V8.1a1.45 1.45 0 0 1 2.9 0v6.3" />
      <path d="M9 11.6l-.9-1.4a1.4 1.4 0 0 0-2.4 1.4l3.4 6.4A5.2 5.2 0 0 0 13.7 21h1.1a4.9 4.9 0 0 0 4.9-4.9v-1.7" />
    </svg>
  );
}

export function IconZoom(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <circle cx="10.6" cy="10.6" r="6.4" />
      <path d="M15.3 15.3L21 21" />
      <path d="M8 10.6h5.2M10.6 8v5.2" />
    </svg>
  );
}

export function IconPen(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <path d="M5 20l.9-4.6L15.6 5.7a2.2 2.2 0 0 1 3.1 3.1L9 19.1z" />
      <circle cx="9.4" cy="15.7" r="1.1" />
    </svg>
  );
}

export function IconShape(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <rect x="3.8" y="3.8" width="9" height="9" rx="1.4" />
      <circle cx="16.2" cy="16.2" r="4.3" />
    </svg>
  );
}

export function IconBucket(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <path d="M3.8 12.2l7.1-7.1 7 7-6.1 6.1a1.9 1.9 0 0 1-2.7 0L3.8 12.2z" />
      <path d="M10.9 5.1l7 7" />
      <path d="M18.2 14.6c1.1 1.5 1.7 2.4 1.7 3.2a1.7 1.7 0 0 1-3.4 0c0-.8.6-1.7 1.7-3.2z" />
    </svg>
  );
}

export function IconUndo(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <path d="M9.2 6.8L4.5 11.5l4.7 4.7" />
      <path d="M4.5 11.5h9.2a6.3 6.3 0 0 1 6.3 6.3" />
    </svg>
  );
}

export function IconRedo(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <path d="M14.8 6.8l4.7 4.7-4.7 4.7" />
      <path d="M19.5 11.5h-9.2a6.3 6.3 0 0 0-6.3 6.3" />
    </svg>
  );
}

export function IconSave(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <path d="M5 3.8h10.6L19 7.2v13H5z" />
      <path d="M8 3.8v5h7.2V3.8" />
      <path d="M8 20v-5.6h8V20" />
    </svg>
  );
}

export function IconEye(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <path d="M2.8 12S6.2 5.8 12 5.8 21.2 12 21.2 12 17.8 18.2 12 18.2 2.8 12 2.8 12z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

export function IconEyeOff(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <path d="M2.8 12S6.2 5.8 12 5.8 21.2 12 21.2 12 17.8 18.2 12 18.2 2.8 12 2.8 12z" opacity={0.45} />
      <circle cx="12" cy="12" r="2.6" opacity={0.45} />
      <path d="M4 4l16 16" />
    </svg>
  );
}

export function IconLock(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <rect x="5.6" y="10" width="12.8" height="9.4" rx="2" />
      <path d="M8.8 10V7.2a3.2 3.2 0 0 1 6.4 0v2.8" />
      <path d="M12 13.6v2.4" opacity={0.7} />
    </svg>
  );
}

export function IconUnlock(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <rect x="5.6" y="10" width="12.8" height="9.4" rx="2" />
      <path d="M8.8 10V7.2a3.2 3.2 0 0 1 6.2-1.1" />
      <path d="M12 13.6v2.4" opacity={0.7} />
    </svg>
  );
}

export function IconPlus(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <path d="M12 5.5v13M5.5 12h13" />
    </svg>
  );
}

export function IconTrash(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <path d="M4.8 7h14.4" />
      <path d="M9 7V4.8h6V7" />
      <path d="M6.8 7l1 12.2h8.4l1-12.2" />
      <path d="M10.2 10.6v5.4M13.8 10.6v5.4" opacity={0.65} />
    </svg>
  );
}

export function IconChevronUp(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <path d="M6.5 14.5L12 9l5.5 5.5" />
    </svg>
  );
}

export function IconChevronDown(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <path d="M6.5 9.5L12 15l5.5-5.5" />
    </svg>
  );
}

export function IconChevronLeft(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <path d="M14.5 6.5L9 12l5.5 5.5" />
    </svg>
  );
}

export function IconChevronRight(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <path d="M9.5 6.5L15 12l-5.5 5.5" />
    </svg>
  );
}

export function IconFilm(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2" />
      <path d="M7.4 4.6v14.8M16.6 4.6v14.8M3.4 9.2h4M3.4 14.8h4M16.6 9.2h4M16.6 14.8h4" />
    </svg>
  );
}

export function IconLayers(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <path d="M12 3.6l8.4 4.6-8.4 4.6-8.4-4.6z" />
      <path d="M3.6 12.4l8.4 4.6 8.4-4.6" />
      <path d="M3.6 16.6l8.4 4.6 8.4-4.6" opacity={0.6} />
    </svg>
  );
}

export function IconClose(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconSun(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.6v2M12 19.4v2M2.6 12h2M19.4 12h2M5.4 5.4l1.4 1.4M17.2 17.2l1.4 1.4M18.6 5.4l-1.4 1.4M6.8 17.2l-1.4 1.4" />
    </svg>
  );
}

export function IconMoon(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <path d="M20 14.2a8.4 8.4 0 1 1-10.2-10.2 6.9 6.9 0 0 0 10.2 10.2z" />
    </svg>
  );
}

export function IconCopy(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <rect x="4.2" y="7.8" width="12" height="12" rx="2" />
      <path d="M8 4.2h9.8a2 2 0 0 1 2 2V16" />
    </svg>
  );
}

export function IconPlay(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <path d="M8 5.4l10 6.6-10 6.6z" />
    </svg>
  );
}

export function IconGrid(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <rect x="3.8" y="3.8" width="16.4" height="16.4" rx="1.6" />
      <path d="M9.4 3.8v16.4M14.6 3.8v16.4M3.8 9.4h16.4M3.8 14.6h16.4" opacity={0.7} />
    </svg>
  );
}

export function IconArrowLeft(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <path d="M19 12H5.5M11 5.5L4.5 12l6.5 6.5" />
    </svg>
  );
}

export function IconCheck(p: Props = {}) {
  const s = p.size ?? 18;
  return (
    <svg {...frame(s, p.className)}>
      <path d="M5 12.5l4.6 4.6L19 6.8" />
    </svg>
  );
}


