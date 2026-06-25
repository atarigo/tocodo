# 02 — 戰鬥管線 (Pipeline)

Layer 2：引擎如何處理戰鬥——從「技能觸發」到「傷害結算」到「效果掛上」的完整流程。這是引擎的固定邏輯，極少變動。

---

## 設計原則

戰鬥是連續時間軸：攻速、詠唱、冷卻、buff/debuff 都以秒計，每個單位照自己的節奏出手。

**防守天生吃虧**：防禦相關的計算是「減少傷害」而不是「抵銷傷害」，不能造就靠屬性就無解的全防流。護甲做減算、減傷率上限 80%、格檔率上限 45%——防守投資永遠只能降低傷害，不能歸零。

**引擎只做三件事**：收集 modifier、依管線排序、計算結果。引擎不知道任何具體技能或武器的名字——它只看 tag 和 modifier。技能說「我有 `attack` tag、`weaponMult: 1.8`、`pierce: true`」，引擎就照規則跑；引擎不知道這叫「重斬」還是「穿甲射擊」。

---

## 技能行為類型 (Action Types)

引擎認識的行為類型，由技能的 `action` 欄位宣告：

| action | 行為 |
|---|---|
| `strike` | 立即出手一次。走攻擊表 → 傷害管線 → 效果觸發 |
| `cast` | 詠唱 → 出手。詠唱時間由技能 + 法杖 + buff 決定。詠唱中被打斷不扣 MP 不進冷卻 |
| `instant` | 瞬發，不走攻擊表，不造成傷害。直接觸發效果（如治癒術） |

資源結算時機在「技能出手」那一刻：扣 MP、進冷卻。詠唱中被打斷，什麼都不消耗。但只要技能出手了——即使被閃避、落空——照樣扣 MP、進冷卻。

---

## 完整攻擊流程

```
玩家觸發技能
    │
    ├─ action = instant → 直接觸發效果 → 結束
    │
    ├─ action = cast → 進入詠唱
    │   │  詠唱時間 = 技能基礎詠唱 × 法杖倍率 ÷ max(0.05, 詠唱速度效果倍率)
    │   │  詠唱中被命中 → 中斷（不扣資源）
    │   └─ 詠唱完成 → 扣 MP、進冷卻 → 繼續下方
    │
    └─ action = strike → 扣 MP、進冷卻 → 繼續下方
         │
         ▼
    ① 相容性檢查
         技能 tags ∩ 武器 tags 包含技能要求的武器類型 → 通過
         │
         ▼
    ② 收集攻擊方 modifier
         來源：武器 provides + 屬性衍生 + 技能 modifiers + 場景規則 + buff
         │
         ▼
    ③ 攻擊表判定（見 04-attack-table.md）
         依技能 tags 決定啟用哪些列
         擲骰 → 結果：閃避/躲避/招架/格檔/暴擊/碾壓/命中
         │
         ├─ 閃避或躲避 → 無傷害、無效果 → 結束
         │
         └─ 其他結果 → 繼續
              │
              ▼
    ④ 傷害管線
         依技能 tags 分流：attack → 非法術管線、spell → 法術管線
         trueDamage → 跳過管線，直接扣固定值
         │
         ▼
    ⑤ 效果觸發
         走效果觸發管線 → 結束
```

---

## 傷害管線（非法術）

適用於 tags 包含 `attack` 的技能（物理攻擊）。

```
Step 1 — 基礎傷害
  base = (技能 damage.base ?? 0)
  如果有 weaponMult：
    武器傷害 = balanceRoll(武器大小傷, 有效平衡)
    若武器 tags 包含規則允許的屬性（見 03-tags.md）：
      武器傷害 += STR
    base += 武器傷害 × weaponMult
  如果有 scaling：
    for each (屬性, 係數) in scaling:
      base += 屬性值 × 係數

Step 2 — 增傷
  incoming = base × damage.mult（技能倍率，預設 1.0）
  incoming ×= damage.more（場景/buff 的獨立乘算，各自相乘）

Step 3 — 暴擊/碾壓
  若暴擊：incoming ×= 1.5
  若碾壓：incoming ×= 2

Step 4 — 破防判定
  若技能宣告 pierce：跳過，必定破防
  incoming > 護甲值總和         → 破防，進入 Step 5
  incoming > 護甲值總和 ÷ 3    → 未破防，強制傷害 1，跳到 Step 7
  incoming ≤ 護甲值總和 ÷ 3    → 完全擋下，傷害 0，跳到 Step 7

Step 5 — 護甲減算
  incoming = incoming − 護甲值總和

Step 6 — 減傷率
  incoming = incoming × (1 − 減傷率)

Step 7 — 折減（招架/格檔）
  若招架：incoming ×= 0.7（減免 30%）
  若格檔：incoming ×= 0.4（減免 60%）

Step 8 — 最終傷害
  final = max(1, round(incoming))
  （未破防強制 1 或完全擋下 0 的情況在 Step 4 已處理）
```

---

## 傷害管線（法術）

適用於 tags 包含 `spell` 的技能。法術不走護甲減算和減傷率。

```
Step 1 — 基礎傷害
  base = 技能 damage.base + Σ(屬性值 × scaling 係數)

Step 2 — 增傷
  incoming = base × damage.mult × damage.more

Step 3 — 暴擊/碾壓（若攻擊表結果適用）
  若暴擊：incoming ×= 1.5
  若碾壓：incoming ×= 2

Step 4 — 不走護甲減算和減傷率

Step 5 — 折減（招架/格檔）
  若招架：incoming ×= 0.7
  若格檔：incoming ×= 0.4

Step 6 — 最終傷害
  final = max(1, round(incoming))
```

---

## 穿透與真傷

**穿透 (pierce)**：無視護甲值（必定破防），仍吃減傷率、招架/格檔折減。在非法術管線中，穿透跳過 Step 4 的破防判定和 Step 5 的護甲減算，但 Step 6 減傷率和 Step 7 折減照常執行。

**真傷 (trueDamage)**：不走傷害管線，直接扣技能宣告的固定值，不計增傷、不計任何防禦與折減。真傷無法被招架、格檔、護甲、減傷率影響——宣告多少就扣多少。

---

## 效果觸發管線

傷害結算之後（或 instant 技能直接）進入效果觸發。

```
Step 1 — 命中判定
  被閃避或躲避 → 不觸發任何效果 → 結束

Step 2 — 破防判定
  未破防 → 不觸發效果
  例外：技能宣告 effectsIgnoreBreak → 仍然觸發

Step 3 — 格檔判定
  被格檔 → 阻止「單體鎖定」效果（不阻止範圍效果和暈眩）

Step 4 — 機率判定
  效果機率 = 技能定義的 chance（0~1）
  擲骰 → 通過則生效

Step 5 — 意志折減
  若為 debuff：實際持續 = 基礎持續 × (1 − 70% × wil ÷ (wil + 128))

Step 6 — 掛上效果
  依疊加規則（見 05-effect-rules.md）處理
```

---

## Modifier 收集與解析

引擎在每次傷害計算前，從所有生效來源收集 modifier。引擎不在乎 modifier 的「理由」，只看它的 target（修飾哪個值）和 operation（怎麼改）。

### 來源（收集順序）

1. 武器 provides（base stats）
2. 裝備 provides（armor, attributes）
3. 屬性衍生值（STR → damage.flat, AGI → attack speed, etc.）
4. 技能 modifiers（skill-specific multipliers）
5. 場景規則 scene_modifiers（dungeon/scene effects）
6. Boss 機制 phase modifiers
7. 當前生效的 buff/debuff

### 解析順序

對每個目標值，依固定順序解析所有 modifier：

```
1. base (=)     — 基準值設定
2. flat (+)     — 固定值加總
3. mult (×)     — 技能/暴擊/碾壓倍率
4. more (×more) — 獨立乘算（場景、buff，各自相乘）
```

`mult` 是同層加總後一次乘：技能倍率 1.8 就是 `mult = 1.8`。`more` 是各來源獨立相乘：場景 +20% 和 buff +30% = ×1.2 × 1.3 = ×1.56。這個區別確保不同系統的增傷不會被加總稀釋。

---

## 攻速計算（戰鬥中動態）

```
實際間隔 = 武器基礎間隔 ÷ (1 + 60% × agi ÷ (agi + 128)) ÷ max(0.05, 攻速效果倍率)
```

攻速在 buff/debuff（加速/減速/冰緩）掛上或移除時即時重算。`max(0.05, ...)` 下限防止除以零或極端數值。

槍類宣告 `agiApplies: false`，公式簡化為：

```
實際間隔 = 武器基礎間隔 ÷ max(0.05, 攻速效果倍率)
```

---

## 角色組裝（養成 → 戰鬥單位）

進入戰鬥前，角色的養成資料被「組裝」成戰鬥單位。裝備詞綴在此時烤死，戰鬥中不再變動——只有 buff/debuff 走即時 modifier 系統。

```
護甲 = round(裝備護甲加總 × (1 + 守護壁壘))
減傷率 = min(0.8, 裝備減傷率加總)
格檔率 = min(0.45, 盾牌格檔率)
招架率 = 武器招架率
增傷倍率 = 1 + 攻擊聖火
```

組裝產出的戰鬥單位攜帶以下固定值：maxHp、maxMp、護甲、減傷率、格檔率、招架率、增傷倍率、攻速間隔、武器大小傷、武器平衡。這些值在整場戰鬥中作為 base，由即時 modifier 系統在其上加減。
