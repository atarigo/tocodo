# 技能系統

## 設計原則

每個技能各自宣告：標籤、武器需求、詠唱時間、冷卻、精神消耗、傷害公式（基礎值 + 武器倍率 + 各屬性係數）、是否吃平衡、穿透／真傷、附加狀態。命中一律看靈巧（壓制閃避），不需各技能宣告。

資源結算點在「技能出手」那一刻：詠唱中被打斷不扣精神、不進冷卻；但施放出去就算施放了——落空、被閃避照樣扣精神、進入冷卻。

## 技能定義結構

```typescript
interface Skill {
  id: string;
  name: string;
  rank: Rank;                          // 五階制：D/C/B/A/S
  price?: number;                      // 一般商店價格；無 = 只能副本取得
  weaponKind?: WeaponKind;             // 需要特定武器類型（近戰/槍/弓/法杖）
  castTime: number;                    // 秒；0 = 瞬發
  cooldown: number;                    // 秒
  mpCost: number;                      // 精神消耗
  canBeParried: boolean;               // 可否被招架
  canBeBlocked: boolean;               // 可否被格檔
  damage?: SkillDamage;                // 傷害公式
  heal?: { base: number; scaling?: Partial<Attributes> };  // 治療
  applies?: EffectSpec[];              // 附加效果（對應效果名錄）
  effectsIgnoreBreak?: boolean;        // 未破防仍可附加效果
  description: string;
}
```

## 技能傷害公式

```typescript
interface SkillDamage {
  weaponMult?: number;                 // 吃武器大小傷的倍率
  base?: number;                       // 固定基礎值
  scaling?: Partial<Attributes>;       // 各屬性增傷係數（每點加多少）
  pierce?: boolean;                    // 穿透：無視護甲值、必定破防
  trueDamage?: number;                 // 真傷：固定值，不計任何公式
  canCrit?: boolean;                   // 此攻擊可否暴擊
}
```

傷害計算流程：

```
base = (SkillDamage.base ?? 0)

如果有 weaponMult：
  武器傷害 = balanceRoll(武器大小傷, 有效平衡)
  若武器宣告吃力量：武器傷害 += str
  base += 武器傷害 × weaponMult

如果有 scaling：
  for each (屬性, 係數) in scaling:
    base += 屬性值 × 係數
```

之後進入標準傷害結算（combat.md 第二階段）。

## 默認宣告規則

| 類型 | canBeParried | canBeBlocked | canCrit |
|---|---|---|---|
| 近戰技 | true | true | 由技能宣告 |
| 槍技 | false（子彈撥不開） | true | 由技能宣告（槍普攻不可暴擊） |
| 法術 | false | true（盾牌連火球都擋得住） | 由技能宣告 |

## 近戰技特性

靈巧不影響大小傷（命中仍看靈巧）、效果接觸即發揮，但傷害仍看有無破防。

## 技能內容（已定案）

### 近戰技

| ID | 名稱 | 階級 | 詠唱 | CD | MP | 武器倍率 | 特殊 |
|---|---|---|---|---|---|---|---|
| heavy-slash | 重斬 | D | 0 | 6s | 0 | 1.8× | 可暴擊 |
| rend | 撕裂 | D | 0 | 8s | 0 | 1.0× | 附加出血（D 級，−3/s，6s） |
| armor-break | 破甲擊 | C | 0 | 10s | 0 | 1.2× | 附加破甲（C 級，護甲 −8，8s） |
| charged-slash | 蓄力斬 | C | 1.2s | 12s | 0 | 3.0× | 可暴擊 |
| leech-slash | 吸血斬 | C | 0 | 9s | 0 | 1.2× | 命中時依體質回復生命（base 5 + vit×0.15） |

### 槍技

| ID | 名稱 | 階級 | 詠唱 | CD | MP | 武器倍率 | 特殊 |
|---|---|---|---|---|---|---|---|
| piercing-shot | 穿甲射擊 | C | 0 | 8s | 0 | 1.4× | 穿透（無視護甲、必定破防） |
| venom-round | 毒彈 | C | 0 | 9s | 0 | 0.8× | 穿透，附加中毒（C 級，−3/s，8s，毒系） |
| concussion-round | 震撼彈 | B | 0 | 14s | 0 | 0.6× | 附加暈眩（B 級，1.5s）。副本限定 |

### 法術（不需特定武器、消耗精神）

| ID | 名稱 | 階級 | 詠唱 | CD | MP | 基礎值 | 屬性加成 | 特殊 |
|---|---|---|---|---|---|---|---|---|
| fireball | 火球術 | D | 1.5s | 5s | 10 | 16 | wil×0.3 | 附加燃燒（D 級，−2/s，4s） |
| ice-bolt | 寒冰箭 | D | 1.2s | 6s | 9 | 12 | wil×0.25 | 附加冰緩（D 級，攻速 −30%，5s） |
| corrode-armor | 蝕甲術 | C | 1.2s | 12s | 8 | 4 | wil×0.1 | 附加蝕甲（C 級，減傷率 −30%，15s）；effectsIgnoreBreak |
| flame-burst | 烈焰爆發 | B | 2.5s | 12s | 22 | 40 | wil×0.6 | 附加燃燒（B 級，−4/s，6s）。副本限定 |
| deep-freeze | 冰封術 | B | 2.0s | 18s | 20 | 10 | wil×0.2 | 附加冰凍（B 級，4s）。副本限定 |
| heal | 治癒術 | C | 2.0s | 10s | 14 | — | — | 治療（base 20 + wil×0.4） |

## 普攻

空手不是武器：沒有武器 = 沒有普攻。

| 武器類型 | 傷害 | 速度 | 命中 | 暴擊 |
|---|---|---|---|---|
| 近戰 | 武器 + 力量 | 敏捷影響 | 靈巧（含平衡） | 幸運 |
| 槍 | 只看武器，不吃力量 | 只看武器，不吃敏捷 | 靈巧 | 不可暴擊 |
| 弓 | 武器 + 力量 | 同近戰 | 同近戰 | 同近戰 |
| 法杖 | 拿來敲就是近戰 | — | — | — |
