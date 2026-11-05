# 电雷像素化（本地，P0）

把参考 PNG 收成游戏调色板索引网格，预览走游戏同一条 blit，再导出 `*.grid.json`。这个目录**不打进** H5 / 微信包，也**不上传** CDN。

参考图只是输入。走这条路径的游戏内素材必须来自导出的网格，不要再留一份手绘精灵。P0 还没有把现有机体换成网格；装配（关卡、受击、轴心）是 P1，界面上那一栏是停用的。

## 本地运行

在仓库根目录先装好游戏依赖（测试和示例脚本要用）。编辑器自己再装一次：

```bash
cd tools/pixel-editor
npm install
npm run dev
```

浏览器打开 `http://localhost:5190`。`npm run typecheck` 和 `npm run build` 只检查这个工具，不进根目录的 `lint` / `typecheck` / `test` / `build:h5`。

「载入示例」读 `fixtures/sample.png`（8×8：透明角、黑边、青底、白心），参数是 nearest / nearest、透明阈值 0、抖动强度 1、目标 8×8。导出应与 `fixtures/sample.grid.json` 逐字节相同，状态行会写「一致」。

从仓库根目录重写这两份示例：

```bash
npx vite-node tools/pixel-editor/scripts/build-fixture.ts
```

## 游戏里的导入路径

| 用途 | 模块 |
| --- | --- |
| 类型、JSON、`SpriteData` 互转 | `src/game/art/gridFile.ts` |
| 可复现像素化 | `src/game/art/pixelize.ts` |
| 8-bit PNG → RGBA（不看色彩配置） | `src/game/art/pngRgba.ts` |
| 和游戏相同的像素字节 / 贴图 | `writePalettePixels`、`renderSprite`、`blitSprite`（`src/game/art/spriteRenderer.ts`） |

以后实体可以这样接（P0 还没有接上）：

```ts
import { parsePaletteGrid, gridToSpriteData } from '@/game/art/gridFile';
import { renderSprite } from '@/game/art/spriteRenderer';

const grid = parsePaletteGrid(jsonText);
const frame = renderSprite(gridToSpriteData(grid));
```

## 网格

扩展名 `*.grid.json`。`format` 是 `dianlei.palette-grid`，`version` 是 `1`。`cells` 行优先，`-1` 透明，其余是调色板下标。`palette` 记下 `dianlei` / 版本 `1` / 长度（当前 52）。`source.name` 只是文件名，**不含** PNG 字节。`source.params` 记下目标尺寸、`sample`（`nearest` | `box`）、`quantize`（`nearest` | `dither`）、`alphaCutoff`、`ditherStrength`。同一张图、同一组参数，得到同一串 `cells`。

取样和抖动的定义写在 `pixelize.ts` 文件头。预览先把网格烤成和游戏一样的 RGBA（`renderSprite`），再按 `Renderer.drawImage` 的规则贴上：`imageSmoothingEnabled = false`，原点取整，元素 `image-rendering: pixelated`。底色是游戏信箱用的 `EXTERIOR_VOID`。整数放大，长边对齐逻辑宽度 360。

PNG 需为 8-bit、不交错。支持灰、灰+透明、RGB、RGBA、索引色。`gAMA` / `iCCP` 被忽略，避免浏览器色彩管理改字节。
