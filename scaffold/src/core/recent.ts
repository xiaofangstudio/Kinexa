import type { DocInfo } from "./api";

/** 最近打开的工程。只存路径与规格，不存像素。 */
export interface RecentEntry {
  path: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  openedAt: number;
  missing?: boolean;
}

const KEY = "kinexa.recent.v1";
const LIMIT = 8;

export function loadRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as RecentEntry[];
    if (!Array.isArray(list)) return [];
    return list.filter((it) => typeof it?.path === "string").slice(0, LIMIT);
  } catch {
    return [];
  }
}

function save(list: RecentEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, LIMIT)));
  } catch {
    /* 本地记录写不进去不影响工程本身 */
  }
}

export function pushRecent(doc: DocInfo) {
  if (!doc.path) return;
  const entry: RecentEntry = {
    path: doc.path,
    name: doc.name,
    width: doc.width,
    height: doc.height,
    fps: doc.fps,
    openedAt: Date.now(),
  };
  const rest = loadRecent().filter((it) => it.path !== doc.path);
  save([entry, ...rest]);
}

export function removeRecent(path: string) {
  save(loadRecent().filter((it) => it.path !== path));
}

export function clearRecent() {
  save([]);
}

export function patchRecent(path: string, patch: Partial<RecentEntry>) {
  const list = loadRecent();
  const idx = list.findIndex((it) => it.path === path);
  if (idx < 0) return;
  list[idx] = { ...list[idx], ...patch };
  save(list);
}
