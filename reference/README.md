# 参考底座说明

本文件夹存放 Kinexa 的开源底座，**只读参考，不提交、不打包、不复制进产品仓库**。

---

## 位置

| 项目 | 路径 | 许可证 |
| --- | --- | --- |
| OpenToonz | `reference\animation\opentoonz` | BSD-3-Clause |
| Tahoma2D | `reference\animation\tahoma2d` | BSD-3-Clause |

上游地址：

- OpenToonz — `https://github.com/opentoonz/opentoonz`
- Tahoma2D — `https://github.com/tahoma2d/tahoma2d`

## 用途

### OpenToonz —— 主底座

由 Dwango 与 Digital Video 联合推出，Studio Ghibli 长期使用。许可证 BSD-3-Clause，允许改造并入。

值得看的：

- 逐帧绘制与帧管理的数据模型
- 矢量与位图混合图层
- 骨骼绑定与形变实现
- 特效节点与合成管线

**必须剔除的：**

- 任何联网检查更新与崩溃上报
- 插件市场相关的网络代码
- 与三维、渲染农场相关的模块

### Tahoma2D —— 社区分支参考

OpenToonz 的社区分支，修掉了一些上游长期未处理的可用性问题。重点看它**在交互层做了哪些改动**，那些改动通常直接对应真实的用户痛点。

**只借鉴交互与结构，不整块搬代码。** 搬之前先核对许可证与版权声明。

## 许可判定

BSD-3-Clause 属宽松许可，可并入 MIT 交付物，但必须：

1. 保留上游版权声明；
2. 保留许可证原文；
3. 不得用上游名义为自家产品背书。

随包附 `THIRD_PARTY_NOTICES.md`，逐条列出。

**一句话规则：** MIT / BSD / Apache-2.0 / MPL-2.0 可并入；LGPL 只能动态链接；**GPL 与 AGPL 一律不进仓库**。

## 下载

本目录当前为空，底座尚未克隆。重跑：

```powershell
.\clone-animation.ps1
.\clone-animation.ps1 -Proxy http://127.0.0.1:7890
```

脚本只做 `git clone --depth 1`，跳过已存在目录，不执行任何 `git add` / `commit` / `push`。

## 注意

这两个文件夹是**只读参考**。不要修改它们的内容，不要在里面做实验，不要把它们提交到任何仓库。

---

*小方工作室 · Kinexa · 参考底座*