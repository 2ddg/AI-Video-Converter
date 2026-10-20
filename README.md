# 视频格式转换器 · AI-Video-Converter

一个基于 **Electron + Vue 3** 的桌面端视频格式转换器，内置 FFmpeg，零配置开箱即用。

> 线上笔试作业 · AI 辅助开发 · 限时三天
> 重点交付物：桌面客户端（非 Web） + 视频信息/缩略图 + FFmpeg 命令行转换 + 自测验证 + 会话总结文档

## 为什么是桌面客户端

评审标准明确：**"界面选型与'客户端'关联为 0 不予考虑"**。本项目从选型即定为 **Electron 桌面客户端**——原生窗口、任务栏图标、系统通知、本地文件拖拽、磁盘读写，一打开即"客户端感"拉满。技术选型与决策详见 [docs/会话总结.md](docs/会话总结.md)。

## 功能特性

### 核心功能（需求 1-2）
- 🎬 **视频信息加载**：拖拽/选择视频后，显示时长、分辨率、文件大小、帧率、总码率、视频/音频编码、格式
- 🖼️ **缩略图生成**：自动截取时长 10% 处画面避开黑屏片头，支持 10%/50%/90% 三帧 hover 预览
- 🔁 **FFmpeg 命令行转换**：支持 MP4 / MKV / WebM / MOV / AVI / GIF，视频编码（H.264/H.265/VP9/硬编）、音频编码（AAC/Opus/MP3）、分辨率/帧率/码率/CRF 全可调

### 自行优化（需求 3）
- ⚡ **GPU 硬件编码自动检测**：运行时试编码探测 NVENC / AMF / QSV 真实可用性（非静态读编译开关），检测到即显示徽章并自动启用，无 GPU 自动回落 libx264
- 📋 **批量转换 + 并发队列**：多文件拖入批量入队，并发池（默认 2，可配 1-4），支持取消/重试
- 📊 **实时进度 + ETA**：基于 `out_time_us` 计算百分比、速度、剩余时间，≥100ms 节流推送
- 🎯 **常用预设**：微信通用 / B站投稿 / 抖音竖屏 / YouTube / 极致压缩 / WebM / 转 GIF 一键应用
- 💾 **任务历史持久化**：本地 JSON 存储，重启保留，支持清理
- 🔔 **完成系统通知**：Windows toast 通知（已设置 AppUserModelId）
- 📉 **体积节省可视化**：完成后显示"体积减少 X%"对比
- 🎨 **深色/浅色双主题**：CSS 变量设计令牌，一键切换
- ✂️ **视频剪辑 + 音频去除**：可选起止时间片段剪辑、去除音轨
- 🔒 **输出防覆盖**：`原名_converted.ext` + 同名追加序号，永不覆盖源文件

### 安全与工程
- `contextIsolation: true + nodeIntegration: false + sandbox: true`
- preload 仅暴露白名单 API（contextBridge），IPC channel 常量单一真源
- TypeScript 严格模式，web/node 双 tsconfig 类型检查通过
- e2e 集成测试验证全链路（probe→缩略图→转换→进度→完成）

## 技术栈

| 层 | 技术 |
|---|---|
| 客户端框架 | Electron 44.8 |
| 构建工具 | electron-vite 6 + Vite 8.3 |
| 渲染框架 | Vue 3.5 `<script setup>` + Pinia 4 |
| 语言 | TypeScript 5.9 |
| 视频引擎 | FFmpeg 7.1 essentials（内置，随项目分发） |
| 打包 | electron-builder 26 |

## 运行

### 环境要求
- Node.js ≥ 20
- Windows 10/11 x64（macOS/Linux 需另配 ffmpeg 二进制）

### 开发

```bash
# 注意：若环境有 ELECTRON_RUN_AS_NODE=1 需先清除（否则 electron 以纯 Node 模式运行）
unset ELECTRON_RUN_AS_NODE

npm install
npm run dev
```

### 生产构建

```bash
npm run build        # 编译 main/preload/renderer 到 out/
```

### 打包

```bash
npm run dist:dir     # 解压版（dist/win-unpacked/，零额外下载，必成功）
npm run dist:win     # NSIS 安装包（需下载 nsis，走 npmmirror 镜像）
```

ffmpeg.exe 通过 `extraResources` 打包进 `resources/ffmpeg/`，运行时走 `process.resourcesPath` 定位，安装到 Program Files 也能正常工作。

### e2e 测试

```bash
unset ELECTRON_RUN_AS_NODE
./node_modules/.bin/electron e2e-test.js
```

测试用 ffmpeg 生成 15 秒 720p 样例视频，加载真实应用走完整 IPC 链路，验证 probe/缩略图/GPU 检测/转换/进度/完成全流程。

## 目录结构

```
AI-Video-Converter/
├─ src/
│  ├─ main/                  # 主进程
│  │  ├─ index.ts            # 窗口、thumbnail 协议、单实例、IPC 注册
│  │  ├─ ffmpeg/             # ffmpegPath / probe / thumbnail / transcode / gpu / queue
│  │  ├─ ipc/                # channels + register
│  │  ├─ store/              # settings + history 持久化
│  │  └─ utils/notify.ts     # 系统通知
│  ├─ preload/               # contextBridge 安全白名单 API
│  ├─ shared/                # main/renderer 共享 types + presets
│  └─ renderer/              # Vue 3 渲染进程
│     └─ src/
│        ├─ components/      # AppShell / DropZone / VideoPanel / ConvertForm / TaskQueue / SettingsDialog
│        ├─ stores/          # video / gpu / tasks / settings
│        └─ views/HomeView.vue
├─ resources/ffmpeg/ffmpeg.exe   # 内置 FFmpeg 7.1
├─ docs/会话总结.md           # 开发决策与反馈文档（需求 4）
├─ e2e-test.js               # 端到端集成测试
├─ electron.vite.config.ts
├─ electron-builder.yml
└─ package.json
```

## 需求对照

| 需求 | 满足情况 |
|---|---|
| 1. 加载视频信息 + 缩略图显示 | ✅ ffmpeg -i 探测 + 10% 处截图 + 三帧预览 |
| 2. ffmpeg 命令行转换 | ✅ spawn ffmpeg.exe，6 种容器 + 多编码器 |
| 3. 自行优化 | ✅ GPU 检测/批量队列/预设/历史/通知/主题/剪辑 等 16 项 |
| 4. 生成会话总结 md | ✅ [docs/会话总结.md](docs/会话总结.md) |
| 5. 提交 GitHub | ✅ github.com/2ddg/AI-Video-Converter |
| 6. 界面选型与"客户端"关联 | ✅ Electron 桌面客户端（原生窗口/任务栏/通知/拖拽） |
| 7. 给人用 + 自测 | ✅ e2e 全链路测试通过，非空壳 |

## 评审要点速览

1. **这是桌面客户端，不是 Web**：原生窗口按钮、任务栏图标、系统通知、本地磁盘操作
2. **真的能跑**：e2e 测试输出 `ALL_OK: true`，输出文件真实存在可播放
3. **GPU 加速是真实探测的**：不是读编译开关，是运行时试编码（本机检测到 Intel QSV）
4. **决策有据**：所有选型和踩坑过程记录在 [docs/会话总结.md](docs/会话总结.md)

## License

MIT
