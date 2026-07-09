# Spec vs Code 比對報告

## 4. Code 有機制，Spec 沒有定義

### 4.1 雙持系統
`CombatHand[]` 支援雙武器各自獨立冷卻與攻擊，規格沒有定義雙持的設計。
`[src/core/types.ts:CombatHand]`

### 4.2 投射物系統
弓和槍有彈道物理（速度、半徑、TTL），規格沒有涵蓋遠程攻擊的投射流程。
`[src/core/engine.ts]`

### 4.3 AI 狀態機
guard → patrol → combat → returning 四狀態 + 仇恨表 + 視線檢測 + 脫戰歸位，規格沒有定義 NPC 行為。
`[src/core/engine.ts]`

### 4.4 閒置回血/回魔
玩家脫戰後自動回復 HP/MP、NPC 歸位後回復 HP/MP，規格沒有定義這個概念。
`[src/core/engine.ts]`

### 4.5 裝備六槽位系統
程式碼定義 mainHand/offHand/head/body/legs/feet 六個欄位，規格只用語義分類（weapon/armor/shield/ring/amulet），沒有定義實際的欄位系統。
`[src/core/types.ts:EquipmentSlot]`

### 4.6 額外 tag
程式碼使用 `offhand`、`heavy` 兩個 tag，規格 03-tags.md 的 tag 清單沒有列入。
`[src/data/yamlLoader.ts:VALID_TAGS vs spec/03-tags.md]`

### 4.7 武器攻擊距離與弧度
每種武器類型有不同的 range 和 arc，決定命中範圍，規格沒有涵蓋這個設計。
`[src/data/equipmentLoader.ts:weaponDefaults]`

---

## 5. Spec 有機制，Code 沒有實作（補充）

### 5.1 法術傷害管線
規格定義法術跳過護甲減算和減傷率（02-pipeline.md），程式碼 `damagePipeline.ts` 只有一條管線，spell 和 attack 走同一套，法術會被護甲和減傷削減。
`[spec/02-pipeline.md vs src/core/damagePipeline.ts]`

### 5.2 效果機率判定
規格效果觸發管線 Step 4 定義 `chance` 欄位做機率擲骰，程式碼的 `SkillOnHitEffect` 沒有 chance 欄位，效果命中即必定觸發。
`[spec/02-pipeline.md vs src/data/skillsLoader.ts:SkillOnHitEffect]`

### 5.3 格檔阻止單體效果
規格說格檔可阻止「單體鎖定」效果（05-effect-rules.md），程式碼 onHit 觸發流程完全沒有檢查格檔結果。
`[spec/05-effect-rules.md vs src/core/engine.ts]`

### 5.4 副本載入
規格定義副本→場景的層級結構，`dungeonsLoader.ts` 有解析函數但不自動載入，`src/data/content/` 沒有 `dungeons.yaml`。
`[spec/content/dungeons.yaml vs src/data/dungeonsLoader.ts]`

### 5.5 偉業系統
規格定義 `WorldEffects`（攻擊聖火、守護壁壘、遺產祝福）影響角色組裝，程式碼完全沒有。
`[spec/06-progression.md vs (missing)]`

### 5.6 角色狀態與存檔
規格定義 `CharacterState`、`GameState` 結構（含階級進度、物品欄、技能習得），程式碼沒有。
`[spec/06-progression.md vs (missing)]`

### 5.7 商店流程
規格定義有 `price` → 商店販售、沒有 → 副本限定的機制，程式碼有 price 欄位但沒有商店流程。
`[spec/06-progression.md vs (missing)]`

---

## 6. 兩邊都有但設計不一致（補充）

### 6.1 攻速/詠唱速度 modifier target 名稱不匹配
效果定義用 `attack.speed`、`cast.speed`，engine 過濾 `defense.attackSpeed`、`defense.castSpeed`。名稱不匹配導致冰緩、減速、恍神等效果完全不生效。
`[src/data/content/effects.yaml vs src/core/engine.ts:dynamicInterval,useSkill]`

### 6.2 減傷率上限
規格 `min(0.8, ...)`，程式碼 `Math.min(1, ...)`。80% vs 100%，「防守不能歸零傷害」的設計意圖被破壞。
`[spec/02-pipeline.md vs src/data/equipmentCatalog.ts:equipmentDefense]`

### 6.3 格擋率上限
規格 `min(0.45, ...)`，程式碼 `Math.min(1, ...)`。45% vs 100%。
`[spec/02-pipeline.md vs src/data/equipmentCatalog.ts:equipmentDefense]`

### 6.4 冰凍/暈眩破冰不計 DoT 傷害
規格說「累積受到 maxHp 20% 傷害即破冰（包含普攻和 DoT 傷害）」，程式碼 `accumulateToggleBreak` 只在直接攻擊時呼叫，DoT tick 不累計。
`[spec/05-effect-rules.md vs src/core/engine.ts:accumulateToggleBreak]`

### 6.5 破防檢查條件
規格說所有傷害技能未破防不觸發效果，程式碼只在 `skill.modifiers.length > 0` 時才檢查破防。若有無 modifier 但帶 onHit 的技能會跳過檢查。
`[spec/02-pipeline.md vs src/core/engine.ts:fireSkill]`

### 6.6 heal-hot 幽靈引用
`battleSetup.ts` 和 `AttributePanel.svelte` 引用 `'heal-hot'` 技能 ID，但該技能不存在於任何 YAML 定義中。
`[src/core/battleSetup.ts, src/playground/AttributePanel.svelte vs src/data/content/skills.yaml]`

---

## 7. audit.md 已解決項目

以下項目在後續開發中已解決，保留記錄供對照：

- **2.2** 技能行為類型：`skillsLoader.ts` 已有 `SkillActionType`，engine 已依此分流
- **2.3** 詠唱中斷：engine 已實作 casting + 任何傷害中斷詠唱
- **2.6** 裝備 provides 格式：`equipmentLoader.ts` 已讀取 provides 格式
- **2.7** 效果疊加階級獨立：`applyStatus` 的 find 有比對 rank，不同階級獨立共存
- **3.3** 效果欄位名稱：YAML 已統一用 `type`/`direction`/`stackLimit`
- **3.4** 技能 onHit 格式：YAML 已統一用 `effect`/`duration`/`amount`
- **3.5** 技能多了未定義欄位：規格 YAML 已同步包含 `rank`、`tags`、`action`、`price`

## 8. audit.md 需更新項目

- **2.4** 場景修飾規則：`sceneModifiers.ts` 已存在但 `appliesTo` 欄位被宣告後忽略
- **2.5** Boss 階段機制：`bossPhases.ts` 資料結構已有，但 engine 沒有自動偵測血量觸發
- **3.8** 武器屬性規則：`tags.ts` 的 `weaponAttrRules` 行為正確，但用 `hasTag('gun')` 硬判斷而非 tag 組合推導
