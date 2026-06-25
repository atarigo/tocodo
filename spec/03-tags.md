# 標籤系統

## 設計原則

標籤取代硬編碼的布林欄位（`canBeParried`、`canCrit`、`weaponKind`、`strApplies` 等）。技能和武器各自攜帶一組標籤，規則層（攻擊表、修飾條件）透過查詢標籤來決定行為。標籤是純加法的——新增標籤不會破壞既有內容，新機制從新的標籤組合中長出來，而不是新的程式碼。

## 標籤分類

### 行動類型

| 標籤 | 說明 |
|---|---|
| `attack` | 物理攻擊。走完整攻擊表（閃避、躲避、招架、格檔、暴擊、碾壓） |
| `spell` | 法術。跳過閃避與躲避，必定命中 |

### 武器類型

| 標籤 | 說明 |
|---|---|
| `melee` | 近戰武器（劍、匕首、巨劍、法杖拿來敲） |
| `ranged` | 遠程武器（弓、槍） |
| `sword` | 劍 |
| `dagger` | 匕首 |
| `greatsword` | 巨劍 |
| `bow` | 弓 |
| `gun` | 槍（火器） |
| `staff` | 法杖 |

### 元素類型

| 標籤 | 說明 |
|---|---|
| `physical` | 物理傷害 |
| `fire` | 火焰傷害 |
| `ice` | 冰霜傷害 |
| `poison` | 毒素傷害 |

### 裝備類型

| 標籤 | 說明 |
|---|---|
| `weapon` | 武器 |
| `armor` | 防具 |
| `shield` | 盾牌 |
| `accessory` | 飾品 |
| `body` | 身體欄位 |
| `head` | 頭部欄位 |
| `legs` | 腿部欄位 |
| `feet` | 足部欄位 |
| `ring` | 戒指欄位 |
| `amulet` | 項鍊欄位 |

### 特殊標記

| 標籤 | 說明 |
|---|---|
| `boss_source` | 場景中被標記為頭目的實體才擁有此標籤，啟用攻擊表中的碾壓段 |
| `dungeon_only` | 物品無法在商店購買，只能從副本中取得 |
| `two_handed` | 武器同時佔據主手與副手欄位 |

## 技能—武器相容性

技能是否能與當前武器搭配，由標籤交集決定：

1. 技能宣告所需的武器標籤（例如 `[melee]` 或 `[ranged]`）
2. 裝備中的武器帶有自己的標籤（例如 `[weapon, melee, sword, physical]`）
3. 技能所需的武器標籤是武器標籤的**子集** → 相容

範例：

| 技能 | 技能標籤 | 武器需求 | 武器 | 武器標籤 | 結果 |
|---|---|---|---|---|---|
| 重斬 | `attack`, `melee`, `physical` | `melee` | 鐵劍 | `weapon`, `melee`, `sword`, `physical` | ✓ 相容 |
| 重斬 | `attack`, `melee`, `physical` | `melee` | 手槍 | `weapon`, `ranged`, `gun`, `physical` | ✗ 不相容 |
| 火球術 | `spell`, `fire` | （無） | 任意 | — | ✓ 永遠可用 |

法術不宣告武器需求，因此無視武器種類皆可施放。法杖仍有意義——它提供詠唱時間倍率與精神消耗倍率的加成。

## 武器屬性規則

武器吃哪些屬性，由武器自身的標籤組合決定，取代舊有的 `strApplies`、`agiApplies`、`dexAmp` 布林欄位。

| 標籤組合 | 力量加傷 | 敏捷加速 | 靈巧放大平衡 | 可暴擊 |
|---|---|---|---|---|
| `melee` | ✓ | ✓ | ✓ | ✓ |
| `ranged` + `bow` | ✓ | ✓ | ✓ | ✓ |
| `ranged` + `gun` | ✗ | ✗ | ✗ | ✗ |
| `staff`（拿來敲） | ✓ | ✓ | ✓ | ✓ |

引擎讀取武器標籤後自動套用對應規則，武器藍圖不再需要逐一宣告布林欄位。

## 攻擊表行為

攻擊表各段是否啟用，由技能攜帶的標籤決定（詳見 04-attack-table.md）：

| 攻擊表段 | 啟用條件 | 排除條件 |
|---|---|---|
| 閃避 | `attack` | `spell` |
| 躲避 | `attack` | `spell` |
| 招架 | `attack` + `melee` | `spell`、`ranged` |
| 格檔 | — | — |
| 暴擊 | — | `gun` |
| 碾壓 | `boss_source` | — |

法術跳過閃避與躲避（必中），但保留格檔（盾牌連火球都擋得住）。招架需要 `melee` tag，法術自然跳過。槍技因 `gun` 標籤排除暴擊。

## 修飾條件

裝備詞綴、buff、場景修飾器透過標籤來指定作用範圍。以 YAML 表示：

```yaml
# 所有近戰技能攻速 +10%
modifier:
  target: attack.interval
  op: "×"
  value: 0.9
  condition:
    skill_has_tag: melee

# 火焰法術傷害 +40%（副本場景修飾器）
modifier:
  target: damage.more
  value: 1.4
  condition:
    skill_has_tag: fire
```

不帶 `condition` 的修飾器對所有行動生效。多個條件之間為 AND 邏輯——所有條件都滿足時修飾器才生效。

## 現有內容標籤對照

以下是現行已定案內容轉換為標籤後的對照表。

### 武器

| 武器 | 標籤 |
|---|---|
| 鐵劍 | `weapon`, `melee`, `sword`, `physical` |
| 短刀 | `weapon`, `melee`, `dagger`, `physical` |
| 巨劍 | `weapon`, `melee`, `greatsword`, `physical`, `two_handed` |
| 獵弓 | `weapon`, `ranged`, `bow`, `physical`, `two_handed` |
| 手槍 | `weapon`, `ranged`, `gun`, `physical` |
| 步槍 | `weapon`, `ranged`, `gun`, `physical`, `two_handed` |
| 學徒法杖 | `weapon`, `melee`, `staff`, `magical` |
| 賢者法杖 | `weapon`, `melee`, `staff`, `magical`, `dungeon_only` |

### 技能

| 技能 | 標籤 |
|---|---|
| 重斬 | `attack`, `melee`, `physical` |
| 撕裂 | `attack`, `melee`, `physical` |
| 破甲擊 | `attack`, `melee`, `physical` |
| 蓄力斬 | `attack`, `melee`, `physical` |
| 吸血斬 | `attack`, `melee`, `physical` |
| 穿甲射擊 | `attack`, `ranged`, `physical` |
| 毒彈 | `attack`, `ranged`, `poison` |
| 震撼彈 | `attack`, `ranged`, `physical`, `dungeon_only` |
| 火球術 | `spell`, `fire`, `magical` |
| 寒冰箭 | `spell`, `ice`, `magical` |
| 蝕甲術 | `spell`, `magical` |
| 烈焰爆發 | `spell`, `fire`, `magical`, `dungeon_only` |
| 冰封術 | `spell`, `ice`, `magical`, `dungeon_only` |
| 治癒術 | `spell`, `magical` |

### 裝備

| 裝備 | 標籤 |
|---|---|
| 皮甲 | `armor`, `body` |
| 布袍 | `armor`, `body` |
| 鎖子甲 | `armor`, `body` |
| 重板甲 | `armor`, `body`, `dungeon_only` |
| 圓盾 | `shield` |
| 塔盾 | `shield`, `dungeon_only` |
| 力量戒指 | `accessory`, `ring` |
| 生命項鍊 | `accessory`, `amulet` |
| 疾風之靴 | `accessory`, `feet` |
| 精準護目鏡 | `accessory`, `head` |
| 冥想吊墜 | `accessory`, `amulet` |
| 幸運硬幣 | `accessory` |
