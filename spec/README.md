# 世界（第一紀元）— 遊戲規格

穿梭副本、自由配裝的網頁 Roguelite。靈感來自《無盡武裝》：強迫晉級、不適者淘汰、前人種樹後人乘涼（世界層級）。

## 核心哲學

技能、武器、屬性三者分離，透過 **tag + modifier** 在運算時組合。引擎只認 tag 和 modifier，不知道任何具體技能或武器的名字。職業是從機制長出來的，不是設計出來的。

## 四層架構

```
改的頻率        層                        內容
─────────────────────────────────────────────────────
每天改    Layer 4 ─ 內容定義 (Content)     技能、武器、敵人、副本（YAML）
偶爾改    Layer 3 ─ 規則宣告 (Rules)       攻擊表、tag 對照、效果行為（也是資料）
幾乎不改  Layer 2 ─ 管線引擎 (Pipeline)    收集 modifier → 排序 → 計算
不改      Layer 1 ─ 基礎元件 (Primitives)  飽和曲線、擲骰、衍生值公式
```

遊戲調整只在上面兩層：改 YAML 裡的數值（Layer 4）或調規則表（Layer 3）。不碰程式碼。

## 規格文件索引

### Layer 1 — 基礎元件

| 文件 | 內容 |
|---|---|
| [01-primitives.md](01-primitives.md) | 所有數學公式：飽和曲線、HP/MP、攻速、平衡擲骰、閃避/躲避/暴擊、意志折減、數值修飾統一規則、屬性升級定價、敵人縮放 |

### Layer 2 — 管線引擎

| 文件 | 內容 |
|---|---|
| [02-pipeline.md](02-pipeline.md) | 完整攻擊流程圖、非法術/法術傷害管線（8 步）、穿透與真傷、效果觸發管線（6 步）、modifier 收集與解析順序、攻速動態計算、角色組裝 |

### Layer 3 — 規則宣告

| 文件 | 內容 |
|---|---|
| [03-tags.md](03-tags.md) | Tag 分類法（行動/武器/元素/裝備/特殊）、技能—武器相容性、武器屬性規則、修飾條件語法 |
| [04-attack-table.md](04-attack-table.md) | 單骰攻擊表各列的 tag 驅動規則、各技能類型的組表差異、冰凍/暈眩對攻擊表的影響 |
| [05-effect-rules.md](05-effect-rules.md) | 效果三大類型、疊加規則、觸發條件（命中/破防/格檔）、狀態開關特殊行為、可修飾目標清單 |

### Layer 4 — 內容定義

`spec/content/*.yaml` 是格式範例，用來示範各類內容的欄位結構和資料格式。其中的數值（護甲值、傷害、冷卻時間等）都是假設值，不是定案。實際的遊戲資料定義在 `src/data/content/*.yaml`。只有公式類（如飽和曲線、衍生值計算）和定義類（如欄位名稱、型別、流程）的內容才是規格約束。

| 文件 | 內容 |
|---|---|
| [content/skills.yaml](content/skills.yaml) | 全部技能定義（近戰/槍/法術），tag + modifier 格式 |
| [content/weapons.yaml](content/weapons.yaml) | 全部武器定義，tag + provides 格式 |
| [content/armor.yaml](content/armor.yaml) | 防具、盾牌、頸飾、手飾、腰帶等非武器裝備定義 |
| [content/effects.yaml](content/effects.yaml) | 18 種效果定義（數值修飾/持續跳動/狀態開關） |
| [content/natural-equipment.yaml](content/natural-equipment.yaml) | 天生裝備定義（不可取得的武器與護甲） |
| [content/enemies.yaml](content/enemies.yaml) | 敵人原型定義（戰鬥參數 + runtime 屬性） |
| [content/scenes.yaml](content/scenes.yaml) | 場景定義（敵人組成、勝利條件，可被副本共用） |
| [content/dungeons.yaml](content/dungeons.yaml) | 副本定義（場景、Boss 機制、勝利條件） |

### 系統規則

| 文件 | 內容 |
|---|---|
| [06-progression.md](06-progression.md) | 角色狀態、五階制、升階、經濟系統、商店定價、偉業系統、角色組裝、存檔 |
| [07-balance.md](07-balance.md) | 數值平衡基準（TTK/TTS）— 待定案 |

### 開發追蹤

| 文件 | 內容 |
|---|---|
| [todo.md](todo.md) | 規格 vs 程式碼差異清單 + 實作 TODO |

## 核心循環

城市 → 副本傳送門 → 同階級隨機副本（多場景推進）→ 通關結算 → 回到城市。

死亡不繼承任何東西——那是另一個人生。

## 閱讀順序

1. 先看本文件（架構總覽）
2. 想理解「一次攻擊怎麼算」→ [02-pipeline.md](02-pipeline.md)
3. 想理解「技能和武器怎麼配」→ [03-tags.md](03-tags.md)
4. 想查公式 → [01-primitives.md](01-primitives.md)
5. 想改數值 → `content/*.yaml`
6. 想加新機制 → 先看 [03-tags.md](03-tags.md) 能不能用 tag 解決，不行再改 [02-pipeline.md](02-pipeline.md)
