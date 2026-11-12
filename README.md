# 羽六 · 羽毛球分组海报（微信小程序版）

Taro 4.3.2 + React + TypeScript 实现的微信小程序。
粘贴微信羽毛球接龙 → 自动识别昵称与 🌹 女生标记 → 分组 → 生成可发群的海报。

**所有数据只存在手机本地，不上传任何服务器。**

## 快速开始

```bash
npm install
npm run dev:weapp        # 开发模式，产物在 dist/
```

然后用**微信开发者工具**打开本项目根目录（会自动读取 `project.config.json`，指向 `dist/`）。

```bash
npm run build:weapp      # 生产构建
npm run test             # 88 项单元测试
npm run typecheck        # 类型检查
```

> 注意：Taro 会把配置缓存写到用户主目录。若遇到 `EPERM: mkdir ~/.taro4.0`，
> 用 `HOME="$(pwd)/.taro-home" npx taro build --type weapp` 绕过。

## 上架前你需要做的事

| 事项 | 说明 |
| --- | --- |
| 注册小程序 | [微信公众平台](https://mp.weixin.qq.com)，个人主体免费 |
| 拿到 AppID | 设置 → 基本设置 → 账号信息，填进 `project.config.json` 的 `appid` |
| 小程序备案 | **2023 年 9 月起强制**，需 1–3 周，建议最先启动 |
| 选择类目 | 建议「工具 → 效率」 |
| 名称与简介 | 如「羽六分组」，名称需查重 |
| 隐私协议 | 后台「用户隐私保护指引」声明**不收集任何个人信息** |

### 审核注意事项

- 本工具**无需登录**，不要调用 `getUserProfile` 获取头像昵称，容易被拒。
- 保存图片需要 `scope.writePhotosAlbum`，已在 `app.config.ts` 的 `permission` 中声明。
- 分享通过 `onShareAppMessage` 实现，无需额外权限。
- 接龙文本仅本地处理，不涉及用户内容上传，审核时说明清楚即可。

## 目录结构

```
src/
├─ lib/                  # 纯逻辑，与 Web 版共用
│  ├─ parser.ts          # 接龙解析（纯表情、🌹、去重）
│  ├─ grouping.ts        # 分组算法（补齐、互换、容量校验）
│  ├─ poster-layout.ts   # 海报布局计算
│  ├─ poster-theme.ts    # 海报主题调色板（6 套预设）
│  ├─ poster-render.ts   # Canvas 绘制
│  ├─ storage.ts         # Taro Storage 适配
│  └─ export.ts          # 保存相册 / 预览
├─ state/                # reducer + 本地状态
├─ components/           # 页面组件
└─ pages/index/          # 主页面（三步流程）
```

## 与 Web 版的差异

| 能力 | Web 版 | 小程序版 |
| --- | --- | --- |
| 分组交互 | 拖拽卡片 | **按住拖动**换场次，也可**点成员 → 选目标场次**（拖不动时用），已满场次内可选「互换」 |
| 存储 | localStorage | Taro Storage |
| 海报 | `canvas.toBlob` 下载 | `canvasToTempFilePath` + 保存到相册 |
| 分享 | Web Share API | 预览大图后长按保存 / 发群 |
| 🌹 图标 | emoji 字体 | emoji 字体（与界面一致），Canvas 缺字时退化为粉色圆点兜底 |
| 日期时间选择 | 自定义输入 | 原生 `Picker` |
| 海报配色 | 单一绿色 | **6 套主题可选**（森野绿/午夜蓝/暖魄橙/暮色紫/樱粉/冰川青） |

## 已知限制

- 拖拽用 touch 事件实现（长按 180ms 或位移 8px 触发），落点靠 `boundingClientRect` 命中判定；页面滚动时仍以点按移动为稳妥路径。
- 不包含截图 OCR，只处理可复制的文本。
- 无云端同步，换设备数据不跟随。
