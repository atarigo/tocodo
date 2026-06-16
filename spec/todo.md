# 規格 vs 程式碼差異清單與 TODO

## 比對方法

逐一比對 `spec/` 下每份規格文件與 `src/` 下現行程式碼的差異。標記為：

- 🔴 **缺失**：規格定義了但程式碼完全沒有
- 🟡 **部分**：有實作但與規格不一致或不完整
- 🟢 **一致**：程式碼符合規格

---

## 一、attributes.md — 六主屬性

| # | 項目 | 狀態 | 現況 | 差異 |
|---|---|---|---|---|
| A1 | 六屬性定義 (str/vit/agi/dex/wil/luk) | 🟢 | `types.ts` Attributes 介面 | 一致 |
| A2 | maxHp = vit × 10 | 🟢 | `formulas.ts:9` | 一致 |
| A3 | maxMp = wil × 5 | 🟢 | `formulas.ts:13` | 一致 |
| A4 | 攻速飽和曲線 60%/(agi+128) | 🟢 | `formulas.ts:27-33` | 一致 |
| A5 | 平衡放大飽和曲線 60%/(dex+128) | 🟢 | `formulas.ts:49-52` | 一致 |
| A6 | Debuff 持續時間意志折減 −70% | 🟢 | `formulas.ts:4` | 公式正確；但引擎未調用（見 E3） |
| A7 | 毒系附加成功率體質折減 | 🔴 | 已刪除（commit f8ae631） | `poisonApplyChance` 被移除 |
| A8 | 屬性升級定價表 | 🟡 | `economy.ts` 有定價邏輯 | 函式正確，但無 UI 使用（商店未實作） |
| A9 | 屬性範圍 0〜255 | 🟡 | `economy.ts` 有 ATTR_MAX=255 | 無 `clampAttr` 輔助函式，引擎不夾值 |
| A10 | vit 影響毒系成功率（屬性表備註） | 🔴 | types.ts 的 vit 註解缺少毒系說明 | 同 A7 |

## 二、combat.md — 戰鬥系統

| # | 項目 | 狀態 | 現況 | 差異 |
|---|---|---|---|---|
| C1 | 單骰攻擊表結構 | 🟢 | `attackTable.ts:107-158` | 一致 |
| C2 | 閃避公式 40%×agi/255×(1−0.5×dex/255) | 🟢 | `attackTable.ts:90-93` | 一致 |
| C3 | 躲避公式 12%×luk/(luk+128) | 🟢 | `attackTable.ts:78-79` | 一致 |
| C4 | 暴擊公式 30%×luk/255 | 🟢 | `attackTable.ts:103-104` | 一致 |
| C5 | 招架減傷 30% | 🟢 | `attackTable.ts:67` | 一致 |
| C6 | 格檔減傷 60% | 🟢 | `attackTable.ts:69` | 一致 |
| C7 | 碾壓預設 15%、×2 | 🟡 | 常數定義正確 `attackTable.ts:61-62` | 引擎永遠傳 `crushRate: 0`（`engine.ts:1068`） |
| C8 | 傷害結算：增傷→破防→減算→減成→折減 | 🟢 | `attackTable.ts:185-204` resolveDamage | 一致 |
| C9 | 穿透（pierce）參數 | 🟡 | resolveDamage 有 pierce 參數 | 引擎從未傳 `pierce=true`，技能定義無此欄位 |
| C10 | 真傷（trueDamage） | 🔴 | resolveDamage 不支援 trueDamage | 連參數都沒有 |
| C11 | 未破防時特效不發動 | 🟡 | 引擎用 `lastDamage > 0` 判定 | 未區分 `brokeDefense`；傷害=1（未破防）時仍算 >0，效果會錯誤發動 |
| C12 | effectsIgnoreBreak | 🔴 | 技能定義無此欄位 | |
| C13 | 格檔阻止單體鎖定效果 | 🔴 | 無此邏輯 | |
| C14 | defenderIncapacitated | 🟡 | attackTable 支援此參數 | 引擎從未傳入 true |
| C15 | 數值修飾統一規則 (基準+固定)×(1+比例) | 🔴 | 無 modifiedValue 函式 | 舊 effects.ts 有此邏輯，已刪除 |
| C16 | 攻速效果倍率（buff/debuff 修飾攻速） | 🔴 | 攻擊間隔在初始化時算死，戰鬥中不變 | |
| C17 | 詠唱速度效果倍率 | 🔴 | 無詠唱機制 | |
| C18 | 戰鬥時間上限 90 秒 | 🔴 | 引擎無超時判定 | 舊 combat.ts 有 MAX_TIME=90 |

## 三、effects.md — Buff/Debuff 系統

| # | 項目 | 狀態 | 現況 | 差異 |
|---|---|---|---|---|
| E1 | 效果三大類型（數值修飾/持續跳動/狀態開關） | 🔴 | 只有持續跳動型（damage/heal） | 數值修飾型和狀態開關型完全缺失 |
| E2 | 效果名錄（17 種命名效果） | 🔴 | 只有 bleed 和 healing 兩種 | effectRegistry.ts 已刪除 |
| E3 | Debuff 持續時間受意志折減 | 🔴 | 引擎 applyStatus 不調用 debuffDuration | 公式在 formulas.ts 但沒人用 |
| E4 | 毒系體質附加折減 | 🔴 | poisonApplyChance 已刪除 | |
| E5 | 優先度覆蓋機制 | 🔴 | StatusEffect 無 priority 欄位 | |
| E6 | 同名效果疊加（⚠️ 待討論） | 🟡 | sourceId 追蹤 ✅；同源 refresh/replace/stack ✅ | 不同來源各自獨立 ✅，但規則需重新定案 |
| E7 | 冰凍/暈眩（行動停止、破除池） | 🔴 | 無此效果類型 | |
| E8 | 沉默（禁用技能） | 🔴 | 無此效果類型 | |
| E9 | 破甲/佑甲等數值修飾效果 | 🔴 | 無 | |
| E10 | 減速/加速/冰緩等攻速修飾 | 🔴 | 無 | |
| E11 | 冰凍/暈眩中斷詠唱 | 🔴 | 無詠唱機制 | |

## 四、skills.md — 技能系統

| # | 項目 | 狀態 | 現況 | 差異 |
|---|---|---|---|---|
| S1 | 技能有 Rank 階級 | 🔴 | SkillDefinition 無 rank | |
| S2 | 技能有 price | 🔴 | SkillDefinition 無 price | |
| S3 | 技能有 weaponKind 需求 | 🔴 | 無武器類型檢查 | |
| S4 | 技能有 castTime 詠唱 | 🔴 | 所有技能瞬發 | |
| S5 | 技能傷害公式：base + weaponMult + scaling | 🟡 | 只有 multiplier（武器倍率） | 無 base damage、無屬性 scaling |
| S6 | 技能有 pierce 穿透 | 🔴 | 無 | |
| S7 | 技能有 trueDamage 真傷 | 🔴 | 無 | |
| S8 | 技能有 canBeParried/canBeBlocked | 🟡 | 引擎按武器類型硬編碼 | 不是由技能宣告 |
| S9 | 技能有 canCrit | 🟡 | 引擎按武器 kind 硬編碼（槍不可暴擊） | 不是由技能宣告 |
| S10 | 技能附加效果用 EffectSpec（名稱+值+時長+優先度） | 🟡 | 用 statusId+chance+duration+amount | 缺 priority，且綁定 statusCatalog 而非 effectRegistry |
| S11 | 技能有 heal（base + scaling） | 🟡 | 只有 applyStatus 型的 HoT | 無即時治療、無屬性 scaling |
| S12 | 法術技能（fire/ice/heal 等 12 個） | 🔴 | 只有 charge/bite/heal 三個 | |
| S13 | 資源結算在出手那一刻 | 🟢 | `engine.ts:811-812` | MP 和 CD 在 useSkill 開頭結算 |
| S14 | 詠唱中被打斷不扣資源 | 🔴 | 無詠唱機制，不適用 | |

## 五、equipment.md — 裝備系統

| # | 項目 | 狀態 | 現況 | 差異 |
|---|---|---|---|---|
| Q1 | 武器有 Rank 階級 | 🔴 | WeaponDefinition 無 rank | |
| Q2 | 武器有 price | 🔴 | WeaponDefinition 無 price | |
| Q3 | 法杖武器類型 | 🟡 | WeaponKind 有 `'法杖'` 但無法杖武器資料 | types.ts 定義了但 equipmentCatalog.ts 沒有法杖 |
| Q4 | 法杖 castTimeMult / mpCostMult | 🔴 | WeaponDefinition 無此欄位 | |
| Q5 | 裝備有屬性加成 attrs（如重甲 −敏捷） | 🔴 | GearDefinition 無 attrs | 舊系統的 Gear 有此功能 |
| Q6 | 裝備有 Rank 階級 | 🔴 | GearDefinition 無 rank | |
| Q7 | 裝備有 price | 🔴 | GearDefinition 無 price | |
| Q8 | 裝備欄位差異 | 🟡 | 現行用 6 欄位（head/body/legs/feet/mainHand/offHand） | 舊系統用 3 欄位（武器/副手/防具/飾品），需決定保留哪套 |
| Q9 | 舊系統的裝備內容（布袍/鎖子甲/重板甲/塔盾/飾品等） | 🔴 | 現行 equipmentCatalog 只有即時戰鬥用的基礎裝備 | |

## 六、enemies.md — 敵人系統

| # | 項目 | 狀態 | 現況 | 差異 |
|---|---|---|---|---|
| N1 | 敵人原型（嗜血獵犬/腐化戰士/虛空射手/墮落巫師） | 🔴 | 被刪除；現行用不同的手工定義敵人 | |
| N2 | 層數決定敵人預算 budget = 40+16×floor | 🔴 | 無層數制 | |
| N3 | 頭目預算 ×1.4、碾壓 15% | 🔴 | 無頭目機制 | |
| N4 | 難度等級預算（D:60/C:90/B:135/A:200/S:300） | 🟢 | `enemyScaling.ts:14-20` | 一致 |
| N5 | 原型乘數與權重分配 | 🟢 | `enemyScaling.ts:41-90` | 現行原型系統可用 |
| N6 | 敵人自帶護甲/減傷與裝備護甲/減傷重複加總 | 🟡 | `engine.ts:151-154` 兩者相加 | 設計上護甲應全來自裝備，但敵人定義自帶 armor/reductionRate |

## 七、dungeon.md — 副本系統

| # | 項目 | 狀態 | 現況 | 差異 |
|---|---|---|---|---|
| D1 | 城市 → 傳送門 → 隨機副本循環 | 🔴 | 無城市場景、無傳送門選擇 | |
| D2 | 副本由多場景組成 | 🟡 | gameFlow.ts 有 stages 概念 | 結構相似但不是規格定義的 DungeonDefinition |
| D3 | 場景勝利條件（required/optional/any-of） | 🔴 | 只有 survive 和 killCount | 無 required/optional/any-of 分類 |
| D4 | 場景內獎勵點消耗（降低難度、交易） | 🔴 | 無 | |
| D5 | 輔助 NPC | 🟡 | 引擎支援 ally faction | 無固定 AI 配置機制 |
| D6 | 中立 NPC 交易 | 🔴 | 引擎支援 neutral faction 但無交易 | |
| D7 | 副本通關後統一結算 | 🟡 | 有 killRewardPoints 但邏輯簡陋 | |
| D8 | 難度選項（一般/降低） | 🟡 | gameFlow 有 3 級難度 | 不是規格定義的「一般加倍/降低減少」 |
| D9 | 同階副本池隨機抽取 | 🔴 | 只有一個固定的灰牙試煉場 | |

## 八、economy.md — 經濟系統

| # | 項目 | 狀態 | 現況 | 差異 |
|---|---|---|---|---|
| M1 | 貨幣正式名稱「獎勵點」 | 🟡 | UI 中使用「獎勵點」 | 程式碼變數名混用 rewardPoints/currency |
| M2 | 起始獎勵點 = 0 | 🟡 | playground 中 rewardPoints 初始 0 | 舊 economy 有 STARTING_CURRENCY=300 |
| M3 | 商店系統 | 🔴 | 無商店 UI 或邏輯 | |
| M4 | 掉落系統 | 🔴 | loot.ts 已刪除 | |
| M5 | 五階制基準定價 | 🔴 | RANK_PRIORITY/RANK_PRICE 未定義在 types.ts | |

## 九、progression.md — 角色進度

| # | 項目 | 狀態 | 現況 | 差異 |
|---|---|---|---|---|
| P1 | CharacterState 模型 | 🔴 | state/model.ts 已刪除 | 角色狀態散落在 playground 的 Svelte 元件中 |
| P2 | GameState 存檔模型 | 🔴 | 已刪除 | |
| P3 | 玩家階級 (rank) | 🔴 | 無 | |
| P4 | 升階條件（15 次通關） | 🔴 | 無 | |
| P5 | 偉業系統 (WorldEffects) | 🔴 | worldEffects.ts 已刪除 | |
| P6 | 角色組裝（養成→戰鬥單位） | 🔴 | character.ts 已刪除 | 玩家直接在 playground 組裝 |
| P7 | 技能欄上限 5 格 | 🔴 | 無 MAX_SKILL_SLOTS | |
| P8 | Rank 型別 + RANK_PRIORITY + RANK_PRICE | 🔴 | 只有 DifficultyRank 型別，無 priority/price 常數 | |

---

## TODO（依優先順序）

優先順序邏輯：**基礎型別 → 核心公式 → 效果系統 → 技能系統 → 副本/進度 → 內容填充 → 平衡**。每一層依賴前一層。

### Phase 0：基礎架構（被所有東西依賴）

- [x] **T01** 建立統一的 Rank 型別取代 DifficultyRank，加入 RANK_BASE_PRICE 基準定價常數（P8/M5）
- [x] **T02** 為武器/裝備/技能定義加上 rank、price、等級相關欄位（Q1/Q2/Q6/Q7/S1/S2）
- [x] **T03** 恢復 clampAttr / addAttrs 輔助函式（A9）
- [ ] **T04** 統一貨幣變數名為 rewardPoints，移除 currency 殘留（M1）

### Phase 1：效果系統重建（⚠️ 需討論疊加規則）

- [ ] **T05** 討論並定案效果疊加規則（E6）
- [ ] **T06** 重建 effectRegistry.ts — 17 種命名效果定義（E2）
- [ ] **T07** 重建 effects.ts — 優先度覆蓋、modifiedValue、持續跳動結算（E1/E5/C15）
- [ ] **T08** 恢復 poisonApplyChance 公式到 formulas.ts（A7/E4）
- [ ] **T09** 引擎接入意志折減：applyStatus 調用 debuffDuration（E3）
- [ ] **T10** 引擎接入數值修飾：攻速/護甲/減傷率受 buff/debuff 即時影響（E9/E10/C16）
- [ ] **T11** 引擎接入狀態開關：冰凍/暈眩（行動停止、破除池、defenderIncapacitated）（E7/C14）
- [ ] **T12** 引擎接入沉默（禁用技能）（E8）
- [ ] **T13** 攻擊間隔改為戰鬥中動態計算（不在初始化時算死）（C16）

### Phase 2：戰鬥引擎修正

- [ ] **T14** 修正未破防判定：用 brokeDefense 取代 `lastDamage > 0`（C11）
- [ ] **T15** 格檔阻止單體鎖定效果發動（C13）
- [ ] **T16** 引擎支援 crushRate > 0：從敵人定義取得頭目碾壓率（C7）
- [ ] **T17** 引擎支援 pierce 參數透傳（C9）
- [ ] **T18** 引擎支援 trueDamage（C10）
- [ ] **T19** 戰鬥時間上限 90 秒（C18）

### Phase 3：技能系統升級（⚠️ 需逐一設計）

- [ ] **T20** 擴充 SkillDefinition：加入 castTime/weaponKind/canBeParried/canBeBlocked/canCrit/effectsIgnoreBreak（S3-S9/S12）
- [ ] **T21** 技能傷害公式改為 base + weaponMult + scaling 結構（S5）
- [ ] **T22** 技能附加效果改用 EffectSpec（名稱+值+時長+優先度）（S10）
- [ ] **T23** 引擎支援詠唱機制（castTime、詠唱中斷）（S4/S14/E11）
- [ ] **T24** 引擎技能結算改為由技能宣告 canBeParried/canBeBlocked/canCrit（S8/S9）
- [ ] **T25** 即時治療型技能（base + scaling），不只 HoT（S11）

### Phase 4：裝備系統升級（⚠️ 需逐一設計）

- [ ] **T26** 決定裝備欄位方案（6 欄位 vs 4 欄位 vs 混合）（Q8）
- [ ] **T27** 武器加入 castTimeMult/mpCostMult（法杖支援）（Q4）
- [ ] **T28** 裝備加入 attrs 屬性加成（如重甲 −敏捷）（Q5）
- [ ] **T29** 加入法杖武器資料（Q3）
- [ ] **T30** 決定敵人自帶防禦值 vs 全部由裝備提供的方案（N6）

### Phase 5：副本與進度系統

- [ ] **T31** 建立 CharacterState / GameState 模型（P1/P2）
- [ ] **T32** 建立存檔系統（localStorage）（P2）
- [ ] **T33** 建立玩家階級系統（rank + rankProgress + 升階邏輯）（P3/P4）
- [ ] **T34** 建立 DungeonDefinition / SceneDefinition / VictoryCondition 型別（D1/D3）
- [ ] **T35** 建立城市場景（升級/商店/傳送門入口）（D1/M3）
- [ ] **T36** 建立副本傳送門：依玩家階級從同階副本池隨機抽取（D9）
- [ ] **T37** 場景勝利條件引擎（required/optional/any-of）（D3）
- [ ] **T38** 副本通關統一結算（獎勵點加總）（D7）
- [ ] **T39** 難度選項機制（一般加倍/降低減少）（D8）
- [ ] **T40** 場景內獎勵點消耗（降低難度、NPC 交易）（D4/D6）
- [ ] **T41** 偉業系統恢復（P5）
- [ ] **T42** 角色組裝函式恢復（P6）

### Phase 6：內容填充（⚠️ 需逐一設計，依賴 Phase 1-4）

- [ ] **T43** 討論數值平衡基準（TTK/TTS 目標值）
- [ ] **T44** 討論升階數值曲線（D→S 階武器/裝備/敵人的成長比例）
- [ ] **T45** 設計完整技能列表（12+ 個，覆蓋近戰/槍/弓/法術）
- [ ] **T46** 設計完整武器列表（含法杖、各階級）
- [ ] **T47** 設計完整裝備列表（防具/盾牌/飾品、各階級）
- [ ] **T48** 設計完整效果列表（各階級的出血/破甲/冰凍等）
- [ ] **T49** 設計 D 階副本內容（多個副本，每個多場景）
- [ ] **T50** 設計 C〜S 階副本內容
- [ ] **T51** 重建或改寫平衡模擬器

---

## 現行程式碼結構評估

| 目錄 | 用途 | 狀態 |
|---|---|---|
| `src/core/` | 純邏輯（公式、攻擊表、引擎、RNG、型別） | ✅ 分離良好 |
| `src/data/` | 內容資料（敵人、裝備、技能、狀態、遭遇） | ✅ 分離良好 |
| `src/playground/` | UI（Svelte 元件、gameFlow） | 🟡 gameFlow 混了副本定義和 UI 邏輯 |
| `src/web/` | 路由入口 | ✅ 乾淨 |

資料與邏輯已分離。改資料不用動引擎。主要問題是 `engine.ts`（1329 行）太大，效果系統加入後需要拆分。
