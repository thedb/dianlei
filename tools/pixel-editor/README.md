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

主界面是装配预览。局内逻辑画面是 360×640，说明里写明这一点，它不是当前对象的编辑框。白框中心在原点。载入 `*.entity.json`、载入装配示例，或把零件移入装配之后，若文件没有 `previewFrame`，白框按所有阶段零件的包围盒外加 8 像素重算。手改宽高，或点「框住零件」，才把整数 `previewFrame`（1–4096）写进文件；没改过不写。文件里已有这个字段时，载入用文件里的数。战斗不读它。点页头「零件预览」打开弹窗，弹窗里只画当前这一张网格。关掉弹窗后屏幕上只留装配。两块画布不会互相替换。

一个姿态一个阶段。「复制阶段」整份复制当前阶段，零件 id 不变；「删除阶段」至少留一个；「播放预览」见下文。玩家机点「侧倾 t0–t5」：和局内一样只编右倾，t0 平飞是原稿（没有 t0 时先把当前阶段复制成 t0），t1–t5 带 `bank` 参数，由 t0 算出；左倾由代码把右倾水平镜像，文件里没有左倾阶段。装配下方的「侧倾对比」按局内 11 帧排开（左五格镜像、t0、t1–t5），点一格选中那一帧，拖「角度」「横向拉伸」「纵向拉伸」「透视」写回那一帧的零件。透视为正时右侧（下沉的那边）更窄、左侧略宽。改 t0，跟参数走的帧一起重算；直接改某一帧的零件，那一帧自动变成手调，只保留零件，不再跟 t0。「改成手调」「按参数重算」手动切换，「恢复默认」把参数放回默认（t1 横向 ×0.94、透视 0.04，每级再窄 0.06、透视加 0.04）。

### 播放预览（P3）

「播放预览」在装配下方打开播放面板，并在装配画布上连续播放，画法和静止预览一样（同一个 `drawPart` / `blitPlacedSprite`），不改文件。逻辑在 `src/game/art/entityTween.ts`（有单元测试），面板在本目录 `src/playback.ts`。

- 内容：「阶段 A → B」（循环时再回 A）、「全部阶段依次」（按文件顺序，循环时回第一个）、「侧倾循环」（t0 → 右倾 t1…t5 → t0 → 左倾 1…5 → t0；左倾是右倾水平镜像，和局内一样，不是文件里的阶段）。只有 t0–t5 的装配打开时默认侧倾循环。
- 插值：零件按 id 对上。同一网格、同一翻转时插值位置（以起点的轴心像素为准，轴心不同也不跳）、角度（走近的那边）、缩放、横向 / 纵向拉伸、斜切。换网格、翻转、层，以及只在一边出现的零件，在过渡一半时切换。尾焰喷口和枪口跟着零件走。
- 参数：过渡、停留（秒，每段先停再走）、缓动（缓入缓出 / 匀速）、倍速 ×0.25–×2、循环、整像素（默认开，过渡中位置取整，和局内一样）。切换「内容」会换成那一类的默认值：阶段 0.8 秒过渡、0.4 秒停留、缓入缓出；侧倾 0.05 秒一格、不停留、匀速。
- 控制：「播放 / 暂停」「停止」，进度条拖动会先暂停再定位。下方一行写当前是哪两个姿态、走到百分之几、第几个姿态、秒数。
- 播放和暂停时不能改零件，也不画受击框和选框控制点。点画布、切换阶段、点「停止」或「收起」回到编辑。侧倾循环时可以边播边拖「侧倾对比」的滑块，画面跟着变。
- t0 左右不对称时，循环过 t0 换边那一下会跳，和局内镜像一致。

零件也可以单独写 `stretchX` / `stretchY`（检查栏的「横向拉伸」「纵向拉伸」，0.1–4），乘在 `scale` 上，按零件自己的轴，在翻转之后、旋转之前。阶段的 `bank` 是 `{ from, angle, stretchX, stretchY, taper }`：零件位置绕原点按 `stretchX`（乘透视系数）和 `stretchY` 拉伸，再整体转 `angle`；每个零件得到同样的转角和拉伸。原稿里已经转过角度的零件只是近似。`from` 必须是另一个不带 `bank` 的阶段。

选中零件后，「复制一份」在本阶段多做一件（偏 2 像素，新 id，多片刃用），「复制到阶段」按 id 送到别的阶段，同 id 替换，没有就新增。选中零件后画布上有选框和白色控制点：角点同时拉宽高，边点只拉一边，按住 Shift 保持比例；顶上圆点旋转（1° 一档，Shift 15°）；拖零件内部按整像素移动。拉伸绕轴心，写进 `stretchX` / `stretchY`，宽高吸附到整像素；旋转写进 `angle`。检查栏「边点拖动」选「斜切」后，四个边点变成菱形：拖上下边点写 `skewX`（上下边左右错开），拖左右边点写 `skewY`（左右边上下错开），1° 一档，Shift 15°，范围 ±60°；也可以直接填「斜切 X」「斜切 Y」（度）。文件里存弧度。零件变换是 旋转 · 斜切 X · 斜切 Y · 缩放（Fabric.js 的顺序），绕轴心，`partLinear` 给出这个矩阵。编辑器预览、选框、受击框、锚点和点选都按它算；游戏里的 `blitPlacedSprite` 还不读斜切，接战斗时再补。拉伸、斜切、旋转、移动零件都不会改白色边界框，视图也只按边界框（和对照框）外加一圈留白来定，不跟着零件缩放；零件超出视图时状态行会提示，改边界宽高或点「框住零件」才会变。检查栏数字跟着变。在侧倾帧上拖，会像手改一样把那一帧变成手调。方向键只在焦点落在装配画布（或零件列表）时挪零件，1 像素，Shift 8 像素；焦点在「侧倾对比」上时，← → 在左 5 镜像、t0、t1–t5 之间切换。零件列表从左到右是从后往前画。

`hit.role` 可以是 `block`（仅阻挡：挡子弹不掉血，画灰色虚线）；不写就是可打（青色实线）。「受击用途」选「无」就不写 `hit`。零件的 `anchors` 是相对轴心的点列表 `{ id, kind, x, y }`，`kind` 是 `exhaust`（尾焰喷口，画黄橙闪烁方块）或 `muzzle`（枪口，画白色十字），每件最多 16 个，随翻转（x 取反）、缩放和角度一起动。工具栏「锚点」关掉时，只画选中零件的锚点。

「对照尺寸」在画布上叠粉色虚线框（Eagle 28×32、Mandy 48×32、Jason 26×30、小型敌机 24×24、黑曜机身 80×96 等），状态行写当前阶段的零件包围和倍数。只对照，不裁切，不写进文件。

零件弹窗显示参考图和目标的宽高比，偏差超过 10% 标黄，并说明是上下压扁还是左右压窄。「锁定源比例」默认勾着：改宽就按比例算高，改高就算宽。「按源比例」按当前宽度重算高度。颜色统计列出用得最多的调色板编号和占比；暗色（亮度低于 0.2）占不透明格九成以上，或一种亮色占九成以上，会标黄，「移入装配」后的状态行也会写出来。

每个零件的 `hit` 可以不写。旧的 `{x,y,w,h}` 仍是方形（矩形，宽高分开），`x,y` 是左上角。`shape: "circle"` 用圆心 `x,y` 和半径 `r`。两者都是未翻转的精灵像素，不限制在零件边内，可以比零件大。水平翻转会镜像。选中的零件始终画出粗的青色受击圈；工具栏「受击框」再把其余零件的细圈打开。战斗碰撞仍是原来的圆，不读这里。

试示例：点「载入装配示例」。它读 `fixtures/sample.entity.json`。阶段下拉有 `folded`、`half`、`open`（机身加一对翼，用来冒烟，不是现役黑曜）。点装配画布上的零件，或点列表，选中的描金边，「选中零件」从画布右侧滑入，盖在画布上，画布本身的大小不变。未选中时这一栏滑出。这一栏只放这一件的 x / y、轴心、角度（界面是度，文件里是弧度）、缩放（大于 0、不超过 16，步进 0.1，例如 0.5）、水平翻转、层（上移 / 下移），以及可选受击框。Esc、关闭，或点画布空白处退出。然后「导出 .entity.json」。

装配里只要还有零件，「载入示例」和「载入装配示例」都不可点，避免把练手样例再载进来盖住当前装配。点「清空装配」清掉零件、阶段和预览边界后，这两个按钮恢复。零件弹窗里的「载入示例」只换弹窗里的网格，但同样在装配有零件时停用；弹窗里已经有素材（PNG 或示例）时也停用，点「清空当前素材」清掉弹窗里的参考图和网格后恢复（不动装配）。自己的 PNG 仍可载入再移入。弹窗里没有网格时「导出 .grid.json」和「移入装配」不可点；有了网格，这两个按钮是弹窗底部的主按钮。弹窗限宽限高，小屏上预览框和参数排成紧凑两列，再窄就一列，超出高度时弹窗内部滚动；长说明收在「按钮说明」里。

把自己的图加进去：打开「零件预览」，像素化之后点「移入装配」。弹窗关掉，新零件出现在列表里并打开调参栏。也可以直接载入一份 `*.grid.json` 或 `*.entity.json`。角度为 0 且 `scale` 为 1 时走不旋转的取整贴图。角度为 0 且 `scale` 为其它整数时，同样取整原点再按目标尺寸放大。小于 1，或任何非整数，以及任何非 0 角度，都绕轴心做最近邻缩放（不取平均、不模糊）。这时边可以盖住半个屏幕像素，不吸附、不滤波。画布为了看清而做的整体放大不写进文件。水平翻转按像素下标镜像。没有垂直翻转。受击框是翻转前的精灵像素，方形或圆形，可以比零件大。预览里用青色描边盖在贴图上，不另做一套光栅。

从仓库根目录重写装配示例：

```bash
npx vite-node tools/pixel-editor/scripts/build-entity-fixture.ts
```

扩展名 `*.entity.json`。`format` 是 `dianlei.entity`，`version` 是 `1`。`grids` 把锁定的 `*.grid.json` 内联进来，键是部件引用的 id。`stages` 保持作者顺序。每个部件有 `id`、`grid`、`x`、`y`、`pivot`、`angle`（弧度，顺时针为正）、`flipX`、`scale`（大于 0、不超过 16；缺省按 1）、`layer`，以及可选的 `hit`（`x,y,w,h`）。层小的画在后面，同层保持文件顺序。轴心必须落在未翻转网格的像素内。

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
    blitPlacedSprite(ctx, frame, part.x, part.y, part.angle, part.scale);
  }
}
```

## 还没接上的

- 现役机体和 Boss 仍用原来的精灵，战斗碰撞仍是圆，不读这里的受击框
- 没有垂直翻转，也没有关卡波次编辑
- 编辑器不进 H5 / 微信包，也不上 CDN
