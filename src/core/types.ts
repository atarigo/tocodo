/** 技能與裝備共用的流派標籤，加成綁在標籤上而不是單件物品上 */
export type Tag = '物理' | '火焰' | '冰霜' | '血祭';

export type BuffStat = 'atk' | 'def' | 'spd';

export interface Stats {
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
}

export type SkillEffect =
  | { kind: 'damage'; multiplier: number }
  | { kind: 'heal'; percentOfMax: number }
  | { kind: 'buff'; stat: BuffStat; amount: number; duration: number }
  | { kind: 'debuff'; stat: BuffStat; amount: number; duration: number };

export interface Skill {
  id: string;
  name: string;
  tag: Tag;
  cooldown: number;
  effects: SkillEffect[];
  description: string;
}

export type Slot = '武器' | '防具' | '飾品';

export interface Equipment {
  id: string;
  name: string;
  slot: Slot;
  mods: Partial<Stats>;
  /** 標籤協同：對應標籤的技能傷害加成（0.3 = +30%） */
  synergy?: { tag: Tag; bonus: number };
}

/** 戰鬥模擬器的輸入單位，與角色養成、敵人生成解耦 */
export interface Combatant {
  name: string;
  stats: Stats;
  skills: Skill[];
  synergies: { tag: Tag; bonus: number }[];
}
