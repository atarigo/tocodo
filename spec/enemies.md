# 敵人系統

## 設計原則

敵人與玩家走同一套屬性與公式（0〜255、起始 10），強度由層數決定。頭目：屬性預算 ×1.4、普攻帶碾壓（統一預設 15%）。

## 敵人生成

### 原型系統

每個敵人從原型（Archetype）生成：

```typescript
interface Archetype {
  name: string;                    // 怪物名稱
  bossName: string;                // 頭目名稱
  weights: Attributes;             // 屬性分配權重
  weaponKind: WeaponKind;          // 武器類型
  interval: number;                // 基礎出手間隔
  damageMult: number;              // 武器傷害倍率（快攻型低、重擊型高）
  balance: number;                 // 武器平衡值
  skills: string[];                // 可用技能
}
```

### 原型定義（已定案）

| 原型 | 頭目名 | 武器 | 間隔 | 傷害倍率 | 平衡 | 技能 | 屬性偏重 |
|---|---|---|---|---|---|---|---|
| 嗜血獵犬 | 血月狼王 | 近戰 | 1.3s | 0.7 | 0.5 | rend | agi > str > vit > dex > luk |
| 腐化戰士 | 深淵領主 | 近戰 | 2.4s | 1.2 | 0.4 | heavy-slash, armor-break | str > vit > dex > agi > luk |
| 虛空射手 | 千瞳狙獵者 | 槍 | 1.9s | 1.0 | 0.6 | piercing-shot | dex > vit = agi > luk |
| 墮落巫師 | 焚世法皇 | 法杖 | 2.2s | 0.6 | 0.45 | fireball, ice-bolt | wil > dex > vit > agi > luk |

### 屬性預算

```
budget = (40 + 16 × floor) × (頭目 ? 1.4 : 1)
```

每項屬性 = 10 + round(budget × 權重 ÷ 權重總和)，夾在 0〜255。

### 武器生成

```
傷害最小 = round((3 + 1.6 × floor) × damageMult × (頭目 ? 1.15 : 1))
傷害最大 = round((6 + 2.6 × floor) × damageMult × (頭目 ? 1.15 : 1))
```

護甲 = round(floor × 0.8) + (頭目 ? 4 : 0)。

### 首領機制

碾壓不是怪物本身的屬性，是副本場景配置時標記的。同一隻怪在不同場景可以是一般敵人，也可以是首領。

- 首領由副本場景配置標記（見 dungeon.md 的 SceneEnemySpawn）
- 首領普攻帶碾壓：預設 15%，各場景可自訂碾壓率
- 碾壓傷害 ×2
- 首領不一定是頭目，任何敵人都可以在場景中被標記為首領

## 現行即時戰鬥中的敵人

現行引擎中有兩套敵人系統需要統一：

### 靜態定義（enemyCatalog）

手工定義的固定屬性敵人，用於新手試煉和特定遭遇戰。

### 縮放系統（enemyScaling）

使用難度等級（D/C/B/A/S）和原型乘數生成屬性：

```
budget = RANK_ATTR_BUDGET[rank] × archetype.multiplier × (0.9 + random × 0.2)
```

| 難度 | 屬性預算 |
|---|---|
| D | 60 |
| C | 90 |
| B | 135 |
| A | 200 |
| S | 300 |

這套系統應該和層數系統整合：層數決定難度等級，難度等級決定預算。

## 遭遇戰（encounterCatalog）

預定義的遭遇戰模板，包含敵人組合、位置、友軍和中立 NPC。這是即時戰鬥引擎為了地圖場景新增的機制，可以保留並整合到副本層級系統中。
