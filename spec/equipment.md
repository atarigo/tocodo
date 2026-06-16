# 裝備系統

## 裝備欄位

舊系統欄位：武器（主手）、副手（盾牌）、防具、飾品。

現行即時戰鬥引擎欄位（更細分）：mainHand、offHand、head、body、legs、feet。

兩套欄位的共通原則：

- 武器（主手）：必備，空手 = 沒有普攻
- 副手：盾牌（提供格檔率）或副手武器（雙持）
- 雙手武器佔滿主副手

## 武器

武器定義核心屬性：

```typescript
interface WeaponDefinition {
  id: string;
  name: string;
  rank: Rank;                    // 五階制
  kind: WeaponKind;              // '近戰' | '槍' | '弓' | '法杖'
  damage: [min, max];            // 大小傷區間
  balance: number;               // 0〜0.8，平衡（擲骰中心）
  interval: number;              // 普攻基礎出手間隔（秒）
  strApplies: boolean;           // 傷害吃不吃力量
  agiApplies: boolean;           // 攻速吃不吃敏捷
  dexAmp: boolean;               // 平衡吃不吃靈巧放大
  parryRate: number;             // 招架率（5%〜25%）
  price?: number;                // 商店價格；無 = 副本限定
  // 法杖專屬
  castTimeMult?: number;         // 詠唱時間倍率（如 0.85 = −15%）
  mpCostMult?: number;           // 精神消耗倍率（如 0.9 = −10%）
  // 即時戰鬥專屬（現行引擎需要）
  slot: 'mainHand' | 'offHand';
  twoHanded: boolean;
  attackMode: 'melee' | 'projectile';
  range: number;                 // 攻擊範圍（像素）
  arc: number;                   // 攻擊錐角（弧度）
  projectile?: { ammoType, shotsPerAttack, spreadAngle };
}
```

### 武器分類設計

| 類型 | 力量 | 敏捷（攻速） | 靈巧（平衡） | 暴擊 | 定位 |
|---|---|---|---|---|---|
| 近戰 | ✓ | ✓ | ✓ | ✓ | 全面受屬性影響 |
| 弓 | ✓ | ✓ | ✓ | ✓ | 吃力量的遠程武器 |
| 槍 | ✗ | ✗ | ✗ | ✗ | 數值完全由武器決定；機制配合度高（特殊彈藥） |
| 法杖 | ✓（敲人） | ✓ | ✓ | ✓ | 特效在詠唱倍率與精神消耗倍率 |

### 武器內容（已定案）

| ID | 名稱 | 階級 | 類型 | 傷害 | 平衡 | 間隔 | 招架 | 特殊 |
|---|---|---|---|---|---|---|---|---|
| iron-sword | 鐵劍 | D | 近戰 | 8〜14 | 0.45 | 1.8s | 10% | |
| dagger | 短刀 | D | 近戰 | 5〜9 | 0.55 | 1.1s | 20% | 快攻高招架 |
| greatsword | 巨劍 | C | 近戰 | 16〜34 | 0.35 | 2.8s | 5% | 靈巧低甩不出上限 |
| hunting-bow | 獵弓 | D | 弓 | 9〜19 | 0.4 | 2.0s | 5% | |
| pistol | 手槍 | D | 槍 | 12〜16 | 0.6 | 1.3s | 5% | 不吃任何屬性 |
| rifle | 步槍 | C | 槍 | 24〜32 | 0.65 | 2.2s | 5% | 不吃任何屬性 |
| apprentice-staff | 學徒法杖 | D | 法杖 | 4〜8 | 0.4 | 2.0s | 8% | 詠唱 −15%、MP −10% |
| sage-staff | 賢者法杖 | B | 法杖 | 5〜10 | 0.5 | 2.2s | 8% | 詠唱 −30%、MP −20%。副本限定 |

## 裝備（防具、副手、飾品）

裝備走制式組合設計，不做 PoE 式隨機詞綴。裝備詞綴在組裝時烤死。

```typescript
interface GearDefinition {
  id: string;
  name: string;
  rank: Rank;
  slot: GearSlot;                // '副手' | '防具' | '飾品'
  armor?: number;                // 護甲值（減算用）
  reductionRate?: number;        // 減傷率（0〜1）
  blockRate?: number;            // 格檔率（只有盾牌會給，30%〜45%）
  attrs?: Partial<Attributes>;   // 屬性加成（可為負，如重甲 −敏捷）
  price?: number;                // 商店價格；無 = 副本限定
}
```

### 裝備內容（已定案）

#### 防具

| ID | 名稱 | 階級 | 護甲 | 減傷率 | 屬性 |
|---|---|---|---|---|---|
| leather-armor | 皮甲 | D | 6 | — | — |
| cloth-robe | 布袍 | D | 3 | — | 意志 +15 |
| chainmail | 鎖子甲 | C | 12 | — | 敏捷 −10 |
| plate-armor | 重板甲 | B | 22 | 8% | 敏捷 −25 |

#### 副手（盾牌）

| ID | 名稱 | 階級 | 護甲 | 格檔率 | 屬性 |
|---|---|---|---|---|---|
| round-shield | 圓盾 | D | 3 | 30% | — |
| tower-shield | 塔盾 | B | 6 | 45% | 敏捷 −15。副本限定 |

#### 飾品

| ID | 名稱 | 階級 | 效果 |
|---|---|---|---|
| power-ring | 力量戒指 | D | 力量 +15 |
| life-amulet | 生命項鍊 | C | 體質 +20 |
| gale-boots | 疾風之靴 | C | 敏捷 +20 |
| marksman-goggles | 精準護目鏡 | C | 靈巧 +20 |
| meditation-pendant | 冥想吊墜 | C | 意志 +20 |
| lucky-coin | 幸運硬幣 | C | 幸運 +20 |

## 空身規則

空身沒有防禦：護甲值全部來自裝備。基礎防禦不來自體質，主要來自裝備。
