import { useEffect, useRef, useState } from "react";
import "./MenuBar.css";

export interface MenuItem {
  label?: string;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
  onSelect?: () => void;
}

export interface MenuGroup {
  label: string;
  items: MenuItem[];
}

/**
 * 顶部菜单条。
 *
 * 欢迎页与编辑壳共用同一套：条目照常列出，暂不可用的置灰而不是直接藏起来 ——
 * 用户看得见功能在哪，才不会到处找。
 */
export default function MenuBar({ groups }: { groups: MenuGroup[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open === null) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="kx-menubar" ref={rootRef}>
      {groups.map((group, i) => (
        <div className="kx-menu" key={group.label}>
          <button
            className={open === i ? "kx-menu-btn is-open" : "kx-menu-btn"}
            onClick={() => setOpen(open === i ? null : i)}
            aria-haspopup="menu"
            aria-expanded={open === i}
          >
            {group.label}
          </button>
          {open === i && (
            <div className="kx-menu-pop" role="menu">
              {group.items.map((item, j) =>
                item.separator ? (
                  <div className="kx-menu-sep" key={`sep-${j}`} />
                ) : (
                  <button
                    className="kx-menu-item"
                    key={`${item.label}-${j}`}
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                      if (item.disabled) return;
                      setOpen(null);
                      item.onSelect?.();
                    }}
                  >
                    <span className="kx-menu-label">{item.label}</span>
                    {item.shortcut && (
                      <span className="kx-menu-key">{item.shortcut}</span>
                    )}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
