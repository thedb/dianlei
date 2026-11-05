# 电雷像素化（本地）

把参考 PNG 收成游戏调色板索引网格，再把多张网格装配成阶段。预览走游戏同一条 blit，导出 `*.grid.json` 和 `*.entity.json`。这个目录**不打进** H5 / 微信包，也**不上传** CDN。

过门禁的素材只有导出的文件。参考 PNG 只是输入，留在这个目录或画师自己的磁盘上，不要进 `public/`、微信包或 CDN。同一份素材不要再留一份手绘精灵。这一步还没有把 Eagle、黑曜或其它现役机体换成这些文件。

## 本地运行

在仓库根目录先装好游戏依赖（测试和示例脚本要用）。编辑器自己再装一次：

```bash
cd tools/pixel-editor
npm install
npm run dev
```

浏览器打开 `http://localhost:5190`。第一次会弹出「使用说明」，之后点页头的「使用说明」可以再看。按钮旁边的短句和这一页讲的是同一件事；给第一次用的人看的正文在编辑器里，不在这份 README。`npm run typecheck` 和 `npm run build` 只检查这个工具，不进根目录的 `lint` / `typecheck` / `test` / `build:h5`。

## 像素化

「载入示例」读 `fixtures/sample.png`（8×8：透明角、黑边、青底、白心），参数是 nearest / nearest、透明阈值 0、抖动强度 1、目标 8×8。导出应与 `fixtures/sample.grid.json` 逐字节相同，状态行会写「一致」。

从仓库根目录重写这两份示例：

```bash
npx vite-node tools/pixel-editor/scripts/build-fixture.ts
```

扩展名 `*.grid.json`。`format` 是 `dianlei.palette-grid`，`version` 是 `1`。`cells` 行优先，`-1` 透明，其余是调色板下标。`palette` 记下 `dianlei` / 版本 `1` / 长度（当前 52）。`source.name` 只是文件名，**不含** PNG 字节。`source.params` 记下目标尺寸、`sample`（`nearest` | `box`）、`quantize`（`nearest` | `dither`）、`alphaCutoff`、`ditherStrength`。同一张图、同一组参数，得到同一串 `cells`。

取样和抖动的定义写在 `pixelize.ts` 文件头。单张预览先把网格烤成和游戏一样的 RGBA（`renderSprite`），再按 `Renderer.drawImage` 的规则贴上：`imageSmoothingEnabled = false`，原点取整，元素 `image-rendering: pixelated`。底色是游戏信箱用的 `EXTERIOR_VOID`。整数放大，长边对齐逻辑宽度 360。

PNG 需为 8-bit、不交错。支持灰、灰+透明、RGB、RGBA、索引色。`gAMA` / `iCCP` 被忽略，避免浏览器色彩管理改字节。

## 装配

左边「零件预览」和右边「装配预览」是两块画布。左边只画当前这一张网格，右边只画当前阶段。

试示例：点「载入装配示例」。它读 `fixtures/sample.entity.json`。阶段下拉有 `folded`、`half`、`open`（机身加一对翼，用来冒烟，不是现役黑曜）。点右边画布上的零件，或点列表，选中的描金边。可改 x / y、轴心、角度（界面是度，文件里是弧度）、缩放（整数 1–16）、水平翻转、层（上移 / 下移），以及可选受击框。然后「导出 .entity.json」。

把自己的图加进去：先在左边像素化，再点「移入装配」。也可以直接载入一份 `*.grid.json` 或 `*.entity.json`。角度为 0 时走不旋转的取整贴图；其它角度先移到轴心再旋转，和 `drawPartSprite` 一样。`scale` 是绕轴心的整数倍：每个格子变成 `scale`×`scale`，最近邻、不模糊。旋转后的边可能盖住半个屏幕像素，不吸附、不滤波。画布为了看清而做的整体放大不写进文件。水平翻转按像素下标镜像。没有垂直翻转。受击框是翻转前的精灵像素矩形，预览里用青色描边盖在贴图上，不另做一套光栅。

从仓库根目录重写装配示例：

```bash
npx vite-node tools/pixel-editor/scripts/build-entity-fixture.ts
```

扩展名 `*.entity.json`。`format` 是 `dianlei.entity`，`version` 是 `1`。`grids` 把锁定的 `*.grid.json` 内联进来，键是部件引用的 id。`stages` 保持作者顺序。每个部件有 `id`、`grid`、`x`、`y`、`pivot`、`angle`（弧度，顺时针为正）、`flipX`、`layer`，以及可选的 `hit`（`x,y,w,h`）。层小的画在后面，同层保持文件顺序。轴心必须落在未翻转网格的像素内。

## 游戏里的导入路径

| 用途 | 模块 |
| --- | --- |
| 网格类型、JSON、`SpriteData` 互转 | `src/game/art/gridFile.ts` |
| 实体阶段、轴心、受击框、JSON | `src/game/art/entityFile.ts` |
| 可复现像素化 | `src/game/art/pixelize.ts` |
| 8-bit PNG → RGBA（不看色彩配置） | `src/game/art/pngRgba.ts` |
| 和游戏相同的像素字节 / 贴图 | `writePalettePixels`、`renderSprite`、`blitSprite`、`blitPlacedSprite`（`src/game/art/spriteRenderer.ts`） |

单张网格：

```ts
import { parsePaletteGrid, gridToSpriteData } from '@/game/art/gridFile';
import { renderSprite } from '@/game/art/spriteRenderer';

const grid = parsePaletteGrid(jsonText);
const frame = renderSprite(gridToSpriteData(grid));
```

一个阶段：

```ts
import { parseEntityFile, placedSprite, stageDrawOrder } from '@/game/art/entityFile';
import { blitPlacedSprite, renderSprite } from '@/game/art/spriteRenderer';

const entity = parseEntityFile(jsonText);
const stage = entity.stages[0];
if (stage) {
  for (const index of stageDrawOrder(stage.parts)) {
    const part = stage.parts[index];
    const grid = part ? entity.grids[part.grid] : undefined;
    if (!part || !grid) continue;
    const placed = placedSprite(grid, part);
    const frame = renderSprite(placed.data);
    frame.anchorX = placed.anchorX;
    frame.anchorY = placed.anchorY;
    blitPlacedSprite(ctx, frame, part.x, part.y, part.angle);
  }
}
```

## 还没接上的

- 现役机体和 Boss 仍用原来的精灵，战斗碰撞仍是圆，不读这里的受击框
- 没有垂直翻转，没有部件任意缩放，也没有关卡波次编辑
- 编辑器不进 H5 / 微信包，也不上 CDN
