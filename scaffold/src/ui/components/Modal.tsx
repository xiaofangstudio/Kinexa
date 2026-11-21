import { useEffect, type ReactNode } from "react";
import { IconClose } from "./Icons";
import "./Modal.css";

/** 通用弹窗：关于、快捷键这类一次性说明放这里。 */
export default function Modal({
  title,
  onClose,
  children,
  width = 440,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="kx-modal-mask" onPointerDown={onClose}>
      <div
        className="kx-modal"
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header className="kx-modal-head">
          <h2 className="kx-modal-title">{title}</h2>
          <button className="kx-icon-btn" onClick={onClose} aria-label="关闭">
            <IconClose size={16} />
          </button>
        </header>
        <div className="kx-modal-body">{children}</div>
      </div>
    </div>
  );
}
