# 角色進度與世界系統

## 角色狀態

一條命的所有東西都掛在角色身上。人物死亡不會繼承任何東西給下一輪——那是另一個人生。

```typescript
interface CharacterState {
  name: string;
  rank: Rank;                                // 玩家當前階級
  rankProgress: number;                      // 同階通關次數（滿 15 升階）
  attrs: Attributes;                         // 六主屬性，0〜255，起始 10
  rewardPoints: number;                      // 獎勵點（唯一貨幣），起始 0
  inventory: string[];                       // 物品 ID
  knownSkills: string[];                     // 已學會的技能 ID
  equippedWeapon: string | null;             // 主手武器
  equippedGear: Record<GearSlot, string>;    // 裝備
  skillSlots: string[];                      // 技能欄（最多 5 格）
}
```

## 階級系統

所有內容以五階設計：**D / C / B / A / S**。

五階制涵蓋：

| 對象 | 說明 |
|---|---|
| 玩家階級 | 對應隨機到的副本等階 |
| 副本階級 | 副本的難度與獎勵等級 |
| 武器階級 | 武器的強度等級 |
| 裝備階級 | 防具/飾品的強度等級 |
| 技能階級 | 技能的強度等級 |
| 道具階級 | 消耗品的效果等級 |
| 效果優先度 | buff/debuff 的覆蓋優先度 |

### 升階

通關同階副本 **15 次**升階（暫定固定值，以後可調）。

- 升階不可逆——後期越來越難
- 只有前期累積正向循環的玩家才能打到後期
- 技術好的玩家仍可以低屬性攻克高階副本

### 五階制數值參照

| 階級 | 效果優先度 | 商店基準價 |
|---|---|---|
| D | 10 | 50 |
| C | 40 | 150 |
| B | 90 | 400 |
| A | 150 | 1,000 |
| S | 230 | 2,500 |

```typescript
type Rank = 'D' | 'C' | 'B' | 'A' | 'S';
const RANK_PRIORITY: Record<Rank, number> = { D: 10, C: 40, B: 90, A: 150, S: 230 };
const RANK_PRICE: Record<Rank, number> = { D: 50, C: 150, B: 400, A: 1000, S: 2500 };
const RANK_UP_CLEARS = 15;   // 升階所需同階通關次數
```

## 起始配置

- 起始階級：D
- 起始屬性：全部 10
- 起始獎勵點：0（空身開局）
- 起始物品：無
- 技能欄上限：5 格

第一個副本（D 階）提供難度選項，讓空身玩家可以選擇降低難度通關。

## 存檔

```typescript
interface GameState {
  version: number;      // 存檔版本：不相容時直接重開
  era: number;          // 紀元
  records: {
    lives: number;      // 歷史命數（紀錄用）
    bestRank: Rank;     // 歷史最高階級（紀錄用）
  };
  character: CharacterState | null;   // null = 尚未創角或已死亡
}
```

網頁版存 `localStorage`。

## 偉業系統（紀元全域效果）

有人在世界中達成隱藏條件時，全體玩家獲得對應效果。「前人種樹後人乘涼」只發生在世界層級，不在個人層級。

現階段用常數開關，上線後改由後端 API 提供。

```typescript
interface WorldEffects {
  攻擊聖火: number;   // 全體攻擊加成（0.1 = +10%，0 = 未觸發）
  守護壁壘: number;   // 全體防禦加成（護甲值倍率）
  遺產祝福: number;   // 獎勵點倍率（平時 1，觸發日 2）
}
```

## 角色組裝（養成 → 戰鬥單位）

養成狀態 + 世界效果 = 戰鬥單位。裝備詞綴在此時烤死，戰鬥中的 buff/debuff 才走效果系統。

```
護甲 = round(裝備護甲加總 × (1 + 守護壁壘))
減傷率 = min(0.8, 裝備減傷率加總)
格檔率 = min(0.45, 盾牌格檔率)
招架率 = 武器招架率
增傷倍率 = 1 + 攻擊聖火
```
