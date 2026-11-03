# 《电雷》机型选择 Plan v1

> **视觉已被退回（Yoan 试玩后）。** 选机画面和 Mandy / Jason 造型不满意，按 `docs/电雷_选机重设计_步骤方案_v1.md` 重新分步确认。本文的手感、流程和数据架构仍有效；§1 「造型」和第 18 题的视觉部分作废，等新的确认稿。

状态：**已进代码（本 PR）。** 机体表、栅格和选机都在 `src/`。第 5 关仍暂缓。手感数字不因改色而改。

- 造型：`docs/电雷_机型造型设计_v1.md`
- 选机画面：`docs/电雷_选机UI设计_v1.md`

本文留下已经拍板的选择、数据怎么接、以及 replay 不能被 Eagle 路径带偏。和两份设计不一致时，以设计文档为准。确认前的「建议」表不再使用。

设计文档 v1.1 的规则正文等进代码时再回写。在那之前，运行中的游戏仍是现在这一架没有名字的主角。

---

## 1. 已确认的选择

没点名的条目按原推荐 A。点名的按 Yoan 的编号。

| 题 | 决定 |
|---|---|
| 1 | B。选机放在所有进战路径的最前：开始游戏、Boss连战、关卡选择、挑战 Boss、武器测试、地图预览 |
| 2 | B。画面写 Eagle / Mandy / Jason。id 仍是 `eagle` / `mandy` / `jason` |
| 3–5 | A。Mandy 移速 240，判定半径 3.0，精灵 32×36 |
| 6 | 已确认。一开始 2 发向前，P+1 为 3 发向前，P+2 为加粗的 3 发向前。每秒 4 发，普通弹 1.5，加粗弹 2.5，DPS 12 / 18 / 30，外侧两发 ±12 |
| 7–10 | A。Jason 移速 420，判定半径 2.0，精灵 22×26，射速 10，单发 1，满伤 DPS 10 / 20 / 30 |
| 11 | A。T、炸弹、命数、拾取半径三机共用。T 保持 1.5 / 2.5 |
| 12 | B。僚机伤害 2、射速每秒 5 发，锁成 Eagle。只有外观跟随机体 |
| 13 | 已确认。弹道和弹速按机体区分。Mandy 见第 6 条。Jason 弹速 1.25 倍（900），弹形不改 |
| 14 | A。侧倾都是 0.2 秒进入、0.15 秒回正 |
| 15 | B。地图预览也先选机。attract 和标题演示固定 Eagle |
| 16 | A。交接黑卡和 Retry 沿用已选机体 |
| 17 | A。最高分全局一张榜 |
| 18 | 已确认。参考合金弹头 3 的 SOLDIER SELECT，三行竖排。标题锁定「选择机体」。预览用局内帧放大，不另画立绘。三句特性按选机 UI 文档 §6 定稿 |
| 19 | A。第 5 关继续暂缓 |
| 造型 | 已确认。Eagle 白青、红脊、双发，不动。Mandy 近黑飞翼，腹侧弹舱可见，双发，尾焰仍是更粗的白芯青边。Jason 湖人紫金，金脊，单发，尾焰更粗更长且跟紫金。气氛稿不进仓库，也不代替栅格像素 |

Eagle 的 `FIRE_RATE` 5、`PLAYER_BULLET_DAMAGE` 2、`HOMING_FIRE_RATE` 1.5、`HOMING_DAMAGE` 2.5、`PLAYER_SPEED` 280、`HITBOX_RADIUS` 2.5 保持为 Eagle 的数，不改导出。Mandy、Jason 的数进代码时写在机体表上。

僚机不再跟主机的主炮同一拍。Jason 主炮是每秒 10 发，僚机仍是每秒 5 发、伤害 2。Mandy 的宽弹和加粗弹也不打在僚机上。

---

## 2. 进战顺序

```
标题
 ├─ 开始游戏 → 选机 → 难度 → 战斗
 ├─ Boss连战 → 选机 → 难度 → Boss 1
 └─ 设置（不选机）

调试面板
 ├─ 关卡选择 → 选机 → 关卡 → 难度 → 战斗
 ├─ 挑战 Boss → 选机 → Boss 列表 → 普通/困难 → 战斗
 ├─ 武器测试 → 选机 → 武器测试
 ├─ 地图预览 → 选机 → 地图列表 → 预览画选中的机体
 └─ 调试开关（不进战斗）

attract、标题演示：固定 Eagle，不打开选机
```

选机的返回回到标题或调试面板。难度、关卡列表、Boss 列表、地图列表的返回回到选机。挑战 Boss 难度的返回仍回到 Boss 列表。

交接和 Retry 不重新选。`title.enter` 清掉 `shipId`。

---

## 3. 数据架构（已进代码：`src/game/entities/shipDefs.ts`）

一行一架，战斗代码不按机型写 `if`。

```ts
type ShipId = 'eagle' | 'mandy' | 'jason';

interface ShipDef {
  id: ShipId;
  name: string;          // "Eagle" | "Mandy" | "Jason"
  role: string;
  blurb: string;
  speed: number;
  hitRadius: number;
  spriteW: number;
  spriteH: number;
  fireRate: number;
  bulletDamage: number;  // Mandy 的加粗弹另记
  bulletSpeed: number;
  muzzleY: number;
  mateOffsetX: number;
  flame: { baseLength: number; baseWidth: number };
}
```

| 块 | 落点 |
|---|---|
| 注册表 | `src/game/entities/shipDefs.ts`。省略 id 当 Eagle |
| 精灵 | 按 id 取 11 帧。Eagle 现有栅格的输出保持不变 |
| 弹道 | 火神的档位描述形状。Eagle 保持现在的 1 / 间距 10 / ±15°。Mandy 用 ±12 的 2 发、3 发和加粗 3 发。Jason 用 Eagle 的形状，弹速用自己的 |
| 场景 | `SceneContext.shipId?`。不进设置存档，不写入 `CarriedRun` |
| 僚机 | 外观、间距、焰用该机。伤害和时钟锁在 2 和每秒 5 发，不走 P伤 |
| 碰撞 | 函数默认半径仍是 2.5。战斗按机体传入 |

武器测试的 P速 / P伤 开局改成该机主炮的薄弹射速和伤害。Eagle 仍是 5 和 2。T 仍是 1.5 和 2.5。覆盖不写回 `WEAPONS`。僚机不吃 P伤。

### 3.1 Replay

现有用例不写 `shipId`，必须仍是今天的 Eagle：速度、判定、精灵、射速、伤害、僚机拍子都不变。`battle.replay.test.ts` 和 `battle.render.test.ts` 的 digest 不重录。attract 固定 Eagle，所以演示 digest 也不动。

地图预览在玩家选了 Mandy 或 Jason 之后会画另一张表。那是新行为，用新测试，不改旧用例。

`config.test.ts` 继续锁 Eagle 的 280、5、2、1.5、2.5。横穿时间那条测试不能改去迁就 Jason 的 420。

---

## 4. 里程碑

| 步 | 状态 |
|---|---|
| 1. 设计确认 | 完成。选择记在 §1 |
| 2. 造型设计 | 完成，见造型文档。栅格已进 `art/shipSprites.ts` |
| 3. 选机 UI 设计 | 完成，见选机 UI 文档。浮层已进 `ui/shipSelect.ts` |
| 4. 进代码 | 已进代码（本 PR）。Eagle 路径保持 digest |
| 5. 测试 | 机体表、弹道、选机流和原有 replay 一起跑。CI 要绿。仍等「合并」 |

第 5 关不在其中。

---

## 5. 这一阶段仍然不做

- 不改 `src/` 的玩法和运行时代码。
- 不重录 replay / render digest。
- 不把 `GenerateImage` 的位图当成精灵或确认稿。
- 不另画一套和局内帧不同的选机立绘。
- 不做第 5 关。
- 不改设计文档 v1.1 的规则正文，直到进代码。
