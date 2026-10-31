# Fusion Pixel Font（标题用）

「电雷计划」的正式标题是 `public/ui/title-mark.jpg`。这套 **Fusion Pixel Font**（CSS `font-family: "Fusion Pixel Font"`）只在那张图还没载入时当作退路。

- 上游：TakWolf / [fusion-pixel-font](https://github.com/TakWolf/fusion-pixel-font) **2026.10.25**
- 源文件：`fusion-pixel-12px-proportional-zh_hans.otf.woff2`（简体，12px 比例字）
- 本目录的 woff2 是标题字子集，只留「电雷计划」和 `DIANLEI PLAN`。字形未改，仍是 OFL 1.1
- 许可：`OFL.txt`。融合来源的许可在 `LICENSES/`（Ark Pixel、Cubic 11、Galmuri）

## 怎么加载

- **H5**：`index.html` 的 `@font-face`，地址是相对 `./fonts/fusion-pixel-12px-proportional-zh_hans.woff2`（生产构建 `base: './'`，子路径部署仍能找到）。`src/main.ts` 在开机时 `document.fonts.load`。启动页的 1.5 秒是加载条，不是专门等字体。封面和标题图在 `public/ui/`，相对路径 `ui/...`，和这份字体一样给 H5 与微信包用。
- **微信**：`wx.loadFontFace`，`family` 同为 `Fusion Pixel Font`，`scopes: ['native']`（给小游戏 canvas）。调用在 `src/platform/wx.ts` 和 `wx-shell/game.js`。小游戏包需要自行带上这份 woff2，路径相对包根 `fonts/...`。
- 画布字体栈：`"Fusion Pixel Font", "Fusion Pixel", "PingFang SC", "Microsoft YaHei", sans-serif`。菜单按钮和战斗 HUD 仍用系统中文栈，不走这份子集。
