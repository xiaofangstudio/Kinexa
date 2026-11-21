# 04 · OpenToonz 内核 + Kinexa 自有界面

> 小方工作室 · Kinexa ｜ 2026-11-21
>
> 这份文档只记事实与取舍。当前 Kinexa 已**从 OpenToonz 源码编译出 `Kinexa.exe`**，并且**默认入口已切到 Kinexa 自有主窗 `KxMainWindow`**，不再进入 OpenToonz 的 `MainWindow / Room` 工作区。OpenToonz 只作为内核：场景、绘制、渲染、工具、文件格式。

---

## 一 一句话结论

**底座是 OpenToonz 源码本体，壳是 Kinexa 自己的。** 本机直接编译 `toonz/sources`，产物 `Kinexa.exe` 约 9.10MB；运行目录 `base/kinexa-source` 为 **246.6MB / 1,955 文件**，在 300MB 红线内。默认启动进入 Kinexa 自有主窗，而不是换色的 OpenToonz。

---

## 二 已经落地的事实

| 事项 | 状态 | 位置 |
| --- | --- | --- |
| OpenToonz 源码 | 已克隆（commit `075e032`） | `reference/animation/opentoonz` |
| 源码 LFS 依赖 | 55 个对象 / 114MB 已拉全 | `thirdparty` |
| 构建链 | Qt 5.15.2 msvc2019_64、MSVC 2022 Build Tools、CMake 3.31、Ninja | `C:\Qt`、`C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools` |
| Boost | 1.85 头文件（pip `boost-headers`） | Python site-packages |
| OpenCV | 4.11 预编译包 | `tools/opencv` |
| 源码编译 | `OpenToonz` 目标成功，输出 `Kinexa.exe` | `build/opentoonz` |
| 源码成品 | 246.6MB / 1,955 文件 | `base/kinexa-source` |
| 默认主窗 | `KxMainWindow`，不再用 `MainWindow` | `toonz/kxmainwindow.*`、`main.cpp` |
| 产品身份 | 进程名/标题 `Kinexa 0.1.0`，About 标题 `About Kinexa` | `main.cpp`、`mainwindow.cpp` |
| 中文翻译 | 6,381 条，约 95.3% | `scaffold/opentoonz-theme/translations/chinese` |
| 上游许可证 | BSD-3 原文已保留 | `LICENSES/OpenToonz-LICENSE.txt` |

**源码修正（为 MSVC 编译）：**
- 全项目加 `/utf-8`，否则日文/中文注释被 CP936 截断，`igs_hsv_noise.cpp` 等会报语法错误。
- `plasticskeletondeformation.h` 的 `boost::iterators::transform_iterator` 改为 `boost::transform_iterator`，兼容 Boost 1.85 头文件。
- `toonz/CMakeLists.txt` 设置 `OUTPUT_NAME "Kinexa"`，产物不再是 `OpenToonz.exe`。
- `main.cpp` 设置 `TEnv::setApplicationFullName("Kinexa 0.1.0")`。
- `main.cpp` 改用 `KxMainWindow`，并跳过 OpenToonz 的 `Kinexa-Light` 旧 QSS。

**Kinexa 自有主窗包含：**
- 顶部：品牌标记、工程名、文件/编辑/视图/帮助、导出/设置；
- 左侧：Kinexa 线性工具轨（选择、画笔、橡皮、形状、填充、抓手、缩放）；
- 中间：OpenToonz `SceneViewer` 画布 + Kinexa 播放条；
- 右侧：图层、颜色、画笔；
- 底部：Kinexa 自绘画格时间轴；
- 状态栏：本地离线、Kinexa 内核。

---

## 三 体积账

| 项 | 体积 |
| --- | --- |
| 源码成品 `base/kinexa-source` | **246.6MB / 1,955 文件** |
| 分发包 `Kinexa-Source-0.1.0-win64.zip` | **104.7MB** |
| 其中 `opencv_world4110.dll` | 64.8MB |
| `Kinexa.exe`（源码编译，Kx UI） | 9.10MB |
| 300MB 红线余量 | 53.4MB |

结论：源码全量底座仍在 300MB 内，不需要为体积砍 OpenCV、扫描或农场。

---

## 四 还没解决的事

### 4.1 主窗是骨架，数据绑定还没做完

Kx 主窗已经能起、能显示、能切工具、能点时间轴，但：
- 图层列表、颜色板、画笔大小还是界面骨架，没和 OpenToonz 的图层/调色板/工具参数双向绑定；
- 时间轴画格条是 Kinexa 自绘，没接真实 Xsheet 单元格；
- 导出/设置/新建/打开/保存还是半成品流程。

### 4.2 首屏还没做

现在启动直接进 Kx 编辑主窗，还没有 Kinexa 的“新建/打开/最近”首屏。

### 4.3 网络与更新

源码仍保留检查更新、崩溃上报、插件/农场等网络相关代码；主窗已不调用检查更新，但红线要求“不联网、不自动更新”，还需要在源码里删干净。

### 4.4 工程格式

仍是 `.tnz`，未切 `.kin`。

---

## 五 下一步（按顺序）

1. **首屏**：启动进 Kinexa 欢迎页，选择新建/打开/最近后再进 Kx 主窗。
2. **数据绑定**：图层列表接 `TXsheet`，颜色板接 `TPalette`，画笔大小接 `TTool` 参数。
3. **时间轴**：把 Kx 画格条接真实单元格与播放头。
4. **导出/保存**：接 `IoCmd` 的导出与保存流程。
5. **删网络/更新**：移除检查更新、崩溃上报、插件市场网络代码。
6. **打包**：重新打包 zip + 许可证 + 体积实测。

---

*小方工作室 · Kinexa · 2026-11-21*
