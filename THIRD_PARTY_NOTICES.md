# 第三方许可声明（THIRD_PARTY_NOTICES）

Kinexa 以 OpenToonz 为底座方向。以下组件若并入交付物，必须随包保留本文件与对应许可证原文。

## OpenToonz

- 项目：OpenToonz
- 上游：<https://github.com/opentoonz/opentoonz>
- 许可证：BSD 3-Clause "New" or "Revised" License
- 版权：Copyright (c) 2016 - 2026, DWANGO Co., Ltd.；其余贡献者保留各自版权。
- 许可证原文：[`licenses/OpenToonz-LICENSE.txt`](licenses/OpenToonz-LICENSE.txt)
- 用途：二维动画的逐帧、矢量、调色板、Xsheet、节点合成、Plastic 骨骼等底座能力。
- 约束：不得用 OpenToonz 或 DWANGO 名义为 Kinexa 背书；二进制分发必须复现版权声明、许可证与免责声明。

## Tahoma2D

- 项目：Tahoma2D
- 上游：<https://github.com/tahoma2d/tahoma2d>
- 许可证：BSD 3-Clause
- 用途：交互与结构参考；如并入代码，同样保留上游声明与许可证原文。

## Qt 5

- OpenToonz 使用 Qt 5.15（LGPLv3 / 商业双许可）。
- Kinexa 若以动态链接方式使用 Qt，必须保留 LGPL 声明、允许用户替换 Qt 库，并提供对应源码获取方式。
- 不得把 Qt 以静态链接方式并入闭源分发。

## OpenCV

- 项目：OpenCV 4.11
- 上游：<https://github.com/opencv/opencv>
- 许可证：Apache License 2.0
- 用途：OpenToonz 的停止运动、IwaBloomFx、NaruLazyBrush 等模块。
- 交付物中的 `opencv_world4110.dll` 为动态链接，随包保留本声明。

## Boost

- 项目：Boost 1.85（仅头文件）
- 上游：<https://www.boost.org/>
- 许可证：Boost Software License 1.0
- 用途：OpenToonz 的 bimap、multi_index、iterator 等模板库。

## libmypaint / Lz4 / SuperLU

- libmypaint：MIT 风格许可，OpenToonz 的 `thirdparty/libmypaint` 内附原文。
- Lz4：BSD 2-Clause，`thirdparty/Lz4` 内附原文。
- SuperLU：BSD 3-Clause 风格许可，`thirdparty/superlu` 内附原文。
- 以上均以动态链接或原样二进制形式随 OpenToonz 交付；不得移除其版权声明。

## 其他

OpenToonz 的 `stuff/library/mypaint brushes`、`thirdparty` 目录还包含独立许可。打包前逐项核对，未确认的模块不进交付物。

> 本文件是交付前的许可清单，不是法律意见。新增依赖先停，核对后再并入。
