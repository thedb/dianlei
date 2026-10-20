# 电雷 (Dianlei)

《电雷》是一款致敬经典街机风格的竖屏像素飞行射击游戏。

## 项目架构

- **纯 TypeScript 游戏核心** - 无游戏引擎依赖，手写 Canvas 2D 渲染器
- **平台适配层** - 游戏核心不直接依赖 DOM 或微信 API，通过适配器接口访问平台功能
- **双平台外壳**：
  - **H5** - 基于 Vite 构建，用于浏览器和移动端 Web 测试
  - **微信小游戏** - game.js 入口，适用于微信开发者工具

### 核心特性

- 固定逻辑分辨率 360×640，竖屏
- 整数倍或最近邻缩放，保持像素清晰，按需加黑边
- 固定时间步长游戏循环（60Hz 更新），配合 rAF 渲染
- 锁定的 48 色调色板
- 多点触控支持（虚拟摇杆 + A/B 按钮）

## 目录结构

```
dianlei/
├── docs/                    # 设计文档
│   ├── 电雷_设计文档_v1.1.md
│   └── 电雷_第一关波次表_v1.md
├── src/
│   ├── platform/           # 平台适配层
│   │   ├── types.ts        # 适配器接口定义
│   │   ├── h5.ts           # H5/浏览器实现
│   │   └── wx.ts           # 微信小游戏实现
│   ├── engine/             # 游戏引擎核心
│   │   ├── loop.ts         # 固定时间步长游戏循环
│   │   ├── renderer.ts     # Canvas 2D 渲染器
│   │   ├── input.ts        # 多点触控输入处理
│   │   ├── audio.ts        # 音频系统（P0 为占位）
│   │   └── pool.ts         # 对象池
│   ├── game/               # 游戏逻辑
│   │   ├── config.ts       # 可调常量（设计文档 §14）
│   │   ├── palette.ts      # 48 色调色板
│   │   ├── scenes/         # 场景系统
│   │   ├── levels/         # 关卡数据类型定义
│   │   ├── entities/       # 实体（后续里程碑）
│   │   └── assets/         # 素材管理（后续里程碑）
│   └── main.ts             # H5 入口
├── wx-shell/               # 微信小游戏外壳
│   ├── game.js             # 微信入口（P0 为简化版）
│   ├── game.json           # 游戏配置
│   └── project.config.json # 项目配置
├── assets/                 # 静态资源（字体、音频等）
└── dist/                   # H5 构建产物
```

## 本地开发

### 环境要求

- Node.js >= 18.0.0
- npm

### 安装与运行

```bash
# 安装依赖
npm install

# 启动开发服务器（H5）
npm run dev

# 打开浏览器访问 http://localhost:3000
```

### 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build:h5` | 构建 H5 版本 |
| `npm run build:wx` | 类型检查微信版本 |
| `npm run lint` | ESLint 检查 |
| `npm run lint:fix` | ESLint 自动修复 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run test` | 运行 Vitest 测试 |
| `npm run test:watch` | 测试监视模式 |

### 操作方式

**键盘（H5 测试用）**：
- 方向键 / WASD - 移动
- Z / 空格 - 射击（A 键）
- X - 炸弹（B 键）
- F1 - 切换调试信息
- ESC - 暂停

**触摸**：
- 左半屏拖动 - 虚拟摇杆
- 右下区域 - A/B 按钮

## 微信小游戏开发

### 在微信开发者工具中打开

1. 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 打开开发者工具，选择"导入项目"
3. 选择项目中的 `wx-shell/` 目录
4. 在 `wx-shell/project.config.json` 中填入你的小游戏 AppID
5. 点击"编译"运行

**注意**：P0 阶段的微信外壳是一个简化版本，仅用于验证基础功能。完整的游戏逻辑会在后续里程碑中集成。

## 部署

### CI/CD（GitHub Actions）

- **PR 检查**：lint、typecheck、test、build
- **推送到 main**：自动部署到阿里云 OSS

### 生产环境 URL

- H5 版本：`https://cdn.it-consultis.com/vibeCoding/dianlei/h5/index.html`
- 素材 CDN：`https://cdn.it-consultis.com/vibeCoding/dianlei/assets/`

### 手动部署

需要设置以下 GitHub Secrets：
- `OSS_ACCESS_KEY_ID`
- `OSS_ACCESS_KEY_SECRET`

## 里程碑

| 阶段 | 内容 | 状态 |
|------|------|------|
| P0 | 工程骨架、Canvas 循环、输入系统 | ✅ 完成 |
| P1 | 最小可玩版本：玩家、敌机、碰撞 | 待开发 |
| P2 | 完整关卡：地块背景、所有敌人 | 待开发 |
| P3 | BOSS、流程、菜单、存档 | 待开发 |
| P4 | 打磨：特效、音频、性能优化 | 待开发 |
| P5 | 上线准备：合规、包体优化 | 待开发 |

## 技术说明

### 为什么不用游戏引擎？

- 保持包体小巧，适合微信小游戏 4MB 主包限制
- 完全控制渲染和更新循环
- 像素游戏不需要复杂的物理或场景图
- 便于在微信和 H5 之间共享代码

### 调色板设计

48 色调色板基于设计文档 §3.4 的色组分配，针对街机风格优化：

- 中性色（8 色）：描边、高光、烟尘
- 玩家色（6 色）：青白主色调
- 敌方空军（6 色）：暗红系
- 地面单位（5 色）：橄榄色系
- 地形（10 色）：草地、公路、混凝土等
- 水域（5 色）：海洋、河流
- 爆炸（4 色）：黄橙红
- 敌弹（4 色）：粉紫品红，高对比度

发光和粒子效果由代码生成，可使用半透明色，不受调色板限制。

## 许可证

私有项目 - 保留所有权利
