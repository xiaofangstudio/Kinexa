> **小方工作室 · 出品** ｜ Kinexa ｜ 状态：OpenToonz 内核 + Kinexa 自有主窗已编译可运行；Tauri 视觉样机保留

# Kinexa

**二维动画与矢量动画软件。** 对标 Adobe Animate，管逐帧绘制与矢量动画这两件事，负责把角色画动。

Kinexa 与 Reelix 分工明确：Kinexa 管逐帧与矢量动画，Reelix 管镜头与合成。画好的素材交给 Reelix 去剪、去合成。

## 底座

底座方向已明确为 **OpenToonz**（BSD-3-Clause）与社区分支 **Tahoma2D**（BSD-3-Clause）。**接管方式不是往 Tauri 壳里搬模块，而是 fork OpenToonz 本体**：功能、Xsheet、调色板、FX Schematic、Plastic 与导出都随底座一起接管，UI 与中文另做。

**源码版已跑通**：`base/kinexa-source`（246.6MB / 1,955 文件）是从 commit `075e032` 的 OpenToonz 源码直接编译，产物 `Kinexa.exe`（9.10MB）。默认入口已切到 **Kinexa 自有主窗 `KxMainWindow`**：顶部品牌与中文菜单、左侧线性工具轨、中间 OpenToonz 场景画布、右侧图层/颜色/画笔、底部 Kinexa 时间轴；不再进入 OpenToonz 的 `MainWindow / Room`，不再显示 `Drawing / Timeline / Cleanup` 房间标签。上一版 `base/kinexa-full`（183.7MB）是官方预编译包 + 启动器，已降为历史参照，不再作为最终底座。首屏、图层/调色板/工具参数绑定、真实 Xsheet 时间轴、网络/更新清理还没做完。账见 [docs/04-OpenToonz底座接管与体积冲突.md](docs/04-OpenToonz底座接管与体积冲突.md)，底座判定见 [reference/README.md](reference/README.md)。

## 一句话说清做什么

三件事：逐帧画、补间动、骨骼绑。

逐帧是二维动画的根，必须做到笔迹零延迟；补间与骨骼是效率工具，让人不用一帧一帧磨；口型与镜头调度是把动画变成片子的最后一段路。

## 文档地图

| 文档 | 内容 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 接手 Agent 的第一份必读，红线与技术栈锁定 |
| [docs/01-立项规划书.md](docs/01-立项规划书.md) | 定位、对标、明确不做什么、硬指标 |
| [docs/02-优化与手感建议.md](docs/02-优化与手感建议.md) | 性能做法与交互做法 |
| [docs/03-竞品研究与界面取舍.md](docs/03-竞品研究与界面取舍.md) | OpenToonz 痛点、竞品可学之处、界面与功能路线 |
| [docs/04-OpenToonz底座接管与体积冲突.md](docs/04-OpenToonz底座接管与体积冲突.md) | 接管方式、构建阻塞、300MB 上限下的体积账 |
| [reference/README.md](reference/README.md) | 底座仓库的位置、许可证与用途 |

## 红线（完整版见 AGENTS.md）

- 界面配色与令牌以 `scaffold/src/styles/tokens.css` 为唯一权威，**主色暖黄 + 白，严禁黑紫、蓝紫与任何紫色**，严禁任何非小方色的第二强调色。
- **绝不自动更新**，绝不联网上传任何用户数据。
- **MIT 许可**，非营利，小方工作室出品。
- **不带任何 AI 功能。**
- 全中文界面。Windows 优先。
- **GPL 与 AGPL 一律不进仓库**，只能作独立进程调用或纯读思路。
- 所有改动保持本地，**绝不提交、绝不推送。**
- 交付体积 ≤ **300MB**（2026-11-21 功能优先拍板；源码版 246.6MB 在限内）。

## 目录结构

```
Kinexa/
├── README.md                 你在这里
├── AGENTS.md                 接手 Agent 的红线
├── docs/                     规格文档
├── scaffold/                 应用工程（Tauri v2 + React + Vite，dev 端口 1423）
└── reference/                底座仓库与说明（只读参考，不提交）
```

---

*小方工作室 · Kinexa · 立项文档*