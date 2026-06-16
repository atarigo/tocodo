# 副本系統

副本是遊戲的主要內容。每個副本是手工設計的多場景關卡，不是隨機生成的層級。

## 遊戲循環

```
城市 → 副本傳送門 → 同階級隨機副本 → 多場景推進 → 通關結算 → 回到城市
```

- 城市是安全區：升級屬性、購買裝備/技能/道具、整備
- 副本傳送門：依玩家當前階級，從同階副本池中隨機抽取
- 副本內多場景依序推進，每個場景有獨立的勝利條件
- 通關後統一結算獎勵點，回到城市

## 副本結構

```typescript
interface DungeonDefinition {
  id: string;
  name: string;
  rank: Rank;                         // 副本階級：D/C/B/A/S
  scenes: SceneDefinition[];          // 多場景，依序推進
}

interface SceneDefinition {
  id: string;
  title: string;
  enemies: EnemySpawn[];              // 敵人配置
  allies?: NpcSpawn[];                // 輔助 NPC（不可控，固定 AI）
  neutrals?: NpcSpawn[];              // 中立 NPC（可能提供交易等）
  obstacles?: ArenaObstacle[];        // 場地障礙物
  victoryConditions: VictoryCondition[];  // 勝利條件（見下方）
  rewardPoints: number;               // 場景通關獎勵點
}
```

## 勝利條件

每個場景有一組勝利條件，條件之間的關係可以是：

- **required**：必須滿足才能通關
- **optional**：滿足可增加收益（額外獎勵點）
- **any-of**：滿足其中之一即可通關

```typescript
type VictoryConditionKind =
  | 'killAll'              // 殲滅所有敵人
  | 'killCount'            // 擊殺指定數量
  | 'killTarget'           // 擊殺特定目標
  | 'survive'              // 存活指定秒數
  | 'escort'               // 護送 NPC 存活
  | 'interact';            // 與特定 NPC/物件互動

interface VictoryCondition {
  kind: VictoryConditionKind;
  requirement: 'required' | 'optional' | 'any-of';
  bonusPoints?: number;           // optional 條件的額外獎勵點
  // 依 kind 不同的參數
  count?: number;                 // killCount 的數量
  targetId?: string;              // killTarget / escort / interact 的目標
  seconds?: number;               // survive 的秒數
}
```

## 場景內特殊機制

- 場景中可能存在**消耗獎勵點來降低難度**的選項（例如花點數跳過困難條件）
- 某些中立 NPC 允許**場景內交易**（用獎勵點購買補給）
- 輔助 NPC 參戰但不可控，使用固定 AI 行為

## 獎勵結算

所有獎勵在副本通關後統一結算：

- 場景通關獎勵點（每個場景定義的 `rewardPoints`）
- 場景內擊殺獎勵點（每隻怪定義的獎勵點）
- optional 勝利條件的額外獎勵點
- 扣除場景內消耗的獎勵點（降低難度、場景內交易）
- 難度加成倍率

貨幣正式名稱：**獎勵點**。起始值 = 0。

## 難度選項

第一個副本（D 階）提供難度選項，讓空身玩家可以選擇：

- **一般難度**：獎勵加倍（獎勵挑戰）
- **降低難度**：敵人弱化，獎勵減少（讓新手能通關）

具體的難度倍率待定案。

## 階級系統與副本對應

玩家階級 = 對應隨機到的副本階級。

- D 階玩家 → 隨機 D 階副本
- C 階玩家 → 隨機 C 階副本
- 以此類推

### 升階條件

通關同階副本 **15 次**升階（暫定固定值，以後可調）。

升階不可逆——後期越來越難。只有前期累積正向循環的玩家才能打到後期。

### 設計原則

- 獎勵挑戰：高難度通關獎勵更好
- 技術可以彌補數值：低屬性攻克高階副本的可能性存在
- 不設計必死的勝利條件：所有條件在理論上都可被攻克

## 副本內容設計

每個副本都是手工設計的，包含：

- 敵人種類、數量、位置
- 場地配置（障礙物、地形）
- 勝利條件組合
- NPC 配置（輔助、中立、交易）
- 獎勵點分配

副本無法量產，是遊戲的核心內容。同一階級內設計多個副本，隨機抽取保持新鮮感。
