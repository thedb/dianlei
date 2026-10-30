# Fusion Pixel Font（标题用）

玩家看到的启动页和首页 Logo「电雷计划」使用 **Fusion Pixel Font**（CSS `font-family: "Fusion Pixel Font"`）。

- 上游：TakWolf / [fusion-pixel-font](https://github.com/TakWolf/fusion-pixel-font) **2026.10.25**
- 源文件：`fusion-pixel-12px-proportional-zh_hans.otf.woff2`（简体，12px 比例字）
- 本目录的 woff2 是标题字子集，只留「电雷计划」和 `DIANLEI PLAN`。字形未改，仍是 OFL 1.1
- 许可：`OFL.txt`。融合来源的许可在 `LICENSES/`（Ark Pixel、Cubic 11、Galmuri）

## 怎么加载

- **H5**：`index.html` 的 `@font-face`，地址是相对 `./fonts/fusion-pixel-12px-proportional-zh_hans.woff2`（生产构建 `base: './'`，子路径部署仍能找到）。`src/main.ts` 在开机时 `document.fonts.load`，启动页的 1.5 秒用来等字体。
- **微信**：`wx.loadFontFace`，`family` 同为 `Fusion Pixel Font`，`scopes: ['native']`（给小游戏 canvas）。调用在 `src/platform/wx.ts` 和 `wx-shell/game.js`。小游戏包需要自行带上这份 woff2，路径相对包根 `fonts/...`。
- 画布字体栈：`"Fusion Pixel Font", "Fusion Pixel", "PingFang SC", "Microsoft YaHei", sans-serif`。菜单按钮和战斗 HUD 仍用系统中文栈，不走这份子集。
