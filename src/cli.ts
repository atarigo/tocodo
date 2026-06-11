import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { simulateBattle } from './core/combat.js';
import {
  buildPlayerCombatant,
  MAX_SKILL_SLOTS,
  POINT_GAIN,
  upgradeCost,
} from './core/character.js';
import { makeEnemy, startingFloor } from './core/dungeon.js';
import { rollFloorDrops } from './core/loot.js';
import { createRng } from './core/rng.js';
import { getEquipment } from './data/equipment.js';
import { getSkill } from './data/skills.js';
import { WORLD_EFFECTS } from './data/worldEffects.js';
import { loadSave, persistSave, type SaveData } from './state/save.js';
import type { Slot } from './core/types.js';

const POINTS_PER_FLOOR = 2;
const RECOVER_RATE_BETWEEN_FLOORS = 0.25;
const SLOTS: Slot[] = ['武器', '防具', '飾品'];

const rl = createInterface({ input: stdin, output: stdout });
const rng = createRng(Date.now() >>> 0);
const save: SaveData = loadSave();

// 自帶輸入緩衝：readline 的 question() 會漏掉提問前就抵達的行，
// 導致管線輸入（自動化測試）無法使用，因此先把所有行收進佇列。
const bufferedLines: string[] = [];
const lineWaiters: ((line: string) => void)[] = [];
let inputClosed = false;

rl.on('line', (line) => {
  const waiter = lineWaiters.shift();
  if (waiter) waiter(line);
  else bufferedLines.push(line);
});

rl.on('close', () => {
  inputClosed = true;
  if (lineWaiters.length > 0) {
    persistSave(save);
    console.log('\n（輸入結束）進度已儲存，下次再戰。\n');
    process.exit(0);
  }
});

async function ask(prompt: string): Promise<string> {
  stdout.write(prompt);
  const buffered = bufferedLines.shift();
  if (buffered !== undefined) {
    stdout.write(`${buffered}\n`);
    return buffered.trim();
  }
  if (inputClosed) {
    persistSave(save);
    console.log('\n（輸入結束）進度已儲存，下次再戰。\n');
    process.exit(0);
  }
  return new Promise((resolve) => {
    lineWaiters.push((line) => resolve(line.trim()));
  });
}

async function askIndex(prompt: string, max: number): Promise<number | null> {
  const raw = await ask(prompt);
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1 || n > max) return null;
  return n - 1;
}

function describeEquipment(id: string): string {
  const item = getEquipment(id);
  const mods = Object.entries(item.mods)
    .map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`)
    .join(' ');
  const synergy = item.synergy ? `｜${item.synergy.tag}技能傷害 +${Math.round(item.synergy.bonus * 100)}%` : '';
  return `${item.name}（${mods}${synergy}）`;
}

async function createCharacter(): Promise<void> {
  const name = (await ask('為新的冒險者命名（直接按 Enter 使用「無名者」）：')) || '無名者';
  save.character = {
    name,
    unspentPoints: 0,
    allocated: { hp: 0, atk: 0, def: 0, spd: 0 },
    equipped: {},
    skillSlots: save.knownSkills.slice(0, 1),
  };
  // 自動穿上倉庫裡每個部位的第一件，省去新手第一次配裝的麻煩
  for (const slot of SLOTS) {
    const owned = save.inventory.find((id) => getEquipment(id).slot === slot);
    if (owned) save.character.equipped[slot] = owned;
  }
  console.log(`\n${name} 踏入了血腥都市。第 ${save.era} 紀元的試煉開始了。\n`);
}

function showStatus(): void {
  const character = save.character!;
  const combatant = buildPlayerCombatant(character, save);
  console.log(`\n【${character.name}】`);
  console.log(
    `  生命 ${combatant.stats.maxHp}｜攻擊 ${combatant.stats.atk}｜防禦 ${combatant.stats.def}｜速度 ${combatant.stats.spd}`,
  );
  console.log(`  未分配屬性點：${character.unspentPoints}`);
  for (const slot of SLOTS) {
    const id = character.equipped[slot];
    console.log(`  ${slot}：${id ? describeEquipment(id) : '（空）'}`);
  }
  const skills = character.skillSlots.map((id) => getSkill(id).name).join('、') || '（無）';
  console.log(`  技能：${skills}`);
  console.log(`  歷史最高層數：${save.highestFloor}｜遺產點數：${save.legacyPoints}`);
}

async function manageEquipment(): Promise<void> {
  const character = save.character!;
  console.log('\n選擇要更換的部位：');
  SLOTS.forEach((slot, i) => {
    const id = character.equipped[slot];
    console.log(`  ${i + 1}. ${slot}：${id ? describeEquipment(id) : '（空）'}`);
  });
  const slotIndex = await askIndex('部位編號（其他輸入返回）：', SLOTS.length);
  if (slotIndex === null) return;
  const slot = SLOTS[slotIndex];

  const owned = save.inventory.filter((id) => getEquipment(id).slot === slot);
  if (owned.length === 0) {
    console.log('倉庫裡沒有這個部位的裝備。');
    return;
  }
  console.log(`\n倉庫中的${slot}：`);
  owned.forEach((id, i) => console.log(`  ${i + 1}. ${describeEquipment(id)}`));
  console.log(`  ${owned.length + 1}. 卸下`);
  const choice = await askIndex('選擇（其他輸入返回）：', owned.length + 1);
  if (choice === null) return;
  if (choice === owned.length) {
    delete character.equipped[slot];
    console.log('已卸下。');
  } else {
    character.equipped[slot] = owned[choice];
    console.log(`已裝備 ${describeEquipment(owned[choice])}。`);
  }
}

async function manageSkills(): Promise<void> {
  const character = save.character!;
  console.log(`\n技能欄（最多 ${MAX_SKILL_SLOTS} 格，戰鬥中由前往後優先施放）：`);
  for (let i = 0; i < MAX_SKILL_SLOTS; i++) {
    const id = character.skillSlots[i];
    console.log(`  ${i + 1}. ${id ? `${getSkill(id).name}｜${getSkill(id).description}` : '（空）'}`);
  }
  const slotIndex = await askIndex('要設定第幾格（其他輸入返回）：', MAX_SKILL_SLOTS);
  if (slotIndex === null) return;

  const available = save.knownSkills.filter((id) => !character.skillSlots.includes(id));
  console.log('\n可放入的技能：');
  available.forEach((id, i) => {
    const skill = getSkill(id);
    console.log(`  ${i + 1}. 【${skill.name}】${skill.tag}｜冷卻 ${skill.cooldown}｜${skill.description}`);
  });
  console.log(`  ${available.length + 1}. 清空此格`);
  const choice = await askIndex('選擇（其他輸入返回）：', available.length + 1);
  if (choice === null) return;

  const slots = character.skillSlots.filter((_, i) => i !== slotIndex);
  if (choice < available.length) {
    slots.splice(slotIndex, 0, available[choice]);
    console.log(`已設定【${getSkill(available[choice]).name}】。`);
  } else {
    console.log('已清空。');
  }
  character.skillSlots = slots;
}

async function allocatePoints(): Promise<void> {
  const character = save.character!;
  if (character.unspentPoints === 0) {
    console.log('\n沒有可分配的屬性點，去副本裡賺吧。');
    return;
  }
  const options = [
    { key: 'hp', label: `生命 +${POINT_GAIN.hp}` },
    { key: 'atk', label: `攻擊 +${POINT_GAIN.atk}` },
    { key: 'def', label: `防禦 +${POINT_GAIN.def}` },
    { key: 'spd', label: `速度 +${POINT_GAIN.spd}` },
  ] as const;
  console.log(`\n未分配屬性點：${character.unspentPoints}（每點效果如下）`);
  options.forEach((o, i) => console.log(`  ${i + 1}. ${o.label}`));
  const choice = await askIndex('要強化哪一項（其他輸入返回）：', options.length);
  if (choice === null) return;
  const raw = await ask(`投入幾點（1〜${character.unspentPoints}）：`);
  const amount = Number.parseInt(raw, 10);
  if (Number.isNaN(amount) || amount < 1 || amount > character.unspentPoints) {
    console.log('輸入無效。');
    return;
  }
  character.allocated[options[choice].key] += amount;
  character.unspentPoints -= amount;
  console.log(`已強化 ${options[choice].label.split(' ')[0]} ×${amount}。`);
}

async function legacyShop(): Promise<void> {
  const options = [
    { key: 'hp', label: '生命 +15／級' },
    { key: 'atk', label: '攻擊 +2／級' },
    { key: 'def', label: '防禦 +1／級' },
    { key: 'spd', label: '速度 +1／級' },
  ] as const;
  console.log(`\n【遺產商店】持有遺產點數：${save.legacyPoints}`);
  console.log('（永久強化，對之後建立的每一位角色生效——前人種樹，後人乘涼）');
  options.forEach((o, i) => {
    const level = save.legacyUpgrades[o.key];
    console.log(`  ${i + 1}. ${o.label}｜目前 Lv.${level}｜升級費用 ${upgradeCost(level)} 點`);
  });
  const choice = await askIndex('要購買哪一項（其他輸入返回）：', options.length);
  if (choice === null) return;
  const key = options[choice].key;
  const cost = upgradeCost(save.legacyUpgrades[key]);
  if (save.legacyPoints < cost) {
    console.log('遺產點數不足。');
    return;
  }
  save.legacyPoints -= cost;
  save.legacyUpgrades[key]++;
  console.log(`已升級！${options[choice].label.split('｜')[0]} 現在是 Lv.${save.legacyUpgrades[key]}。`);
}

function showWorld(): void {
  console.log(`\n【第 ${save.era} 紀元】世界效果（由全世界冒險者的偉業觸發）：`);
  const entries = [
    { name: '攻擊聖火', active: WORLD_EFFECTS.攻擊聖火 > 0, detail: `全體攻擊 +${Math.round(WORLD_EFFECTS.攻擊聖火 * 100)}%` },
    { name: '守護壁壘', active: WORLD_EFFECTS.守護壁壘 > 0, detail: `全體防禦 +${Math.round(WORLD_EFFECTS.守護壁壘 * 100)}%` },
    { name: '遺產祝福', active: WORLD_EFFECTS.遺產祝福 > 1, detail: `遺產點數 ×${WORLD_EFFECTS.遺產祝福}` },
  ];
  for (const e of entries) {
    console.log(`  ${e.active ? '✦' : '・'} ${e.name}：${e.active ? e.detail : '未觸發'}`);
  }
}

function endRun(floorsCleared: number, died: boolean): void {
  const legacy = Math.round(floorsCleared * WORLD_EFFECTS.遺產祝福);
  save.legacyPoints += legacy;
  if (died) {
    console.log(`\n☠ ${save.character!.name} 在血腥都市中倒下了。不適者，淘汰。`);
    console.log(`  這一生攻克了 ${floorsCleared} 層，化為 ${legacy} 點遺產，留給後人。`);
    save.character = null;
  } else {
    console.log(`\n你撤出了副本。本次攻克 ${floorsCleared} 層，獲得 ${legacy} 點遺產。`);
  }
  persistSave(save);
}

async function runDungeon(): Promise<void> {
  const character = save.character!;
  if (character.skillSlots.length === 0) {
    console.log('\n至少裝上一個技能再進副本吧。');
    return;
  }
  let floor = startingFloor(save.highestFloor);
  let floorsCleared = 0;
  const player = buildPlayerCombatant(character, save);
  let currentHp = player.stats.maxHp;
  console.log(`\n（強迫晉級規則：起始層數緊跟你的最高紀錄，沒有回頭路。）`);

  while (true) {
    const enemy = makeEnemy(floor, rng);
    console.log(`\n⚔ 第 ${floor} 層：遭遇 ${enemy.name}`);
    console.log(
      `  敵方｜生命 ${enemy.stats.maxHp}｜攻擊 ${enemy.stats.atk}｜防禦 ${enemy.stats.def}｜速度 ${enemy.stats.spd}`,
    );
    const result = simulateBattle(player, enemy, rng, currentHp);
    for (const line of result.log) console.log(`  ${line}`);

    if (result.winner === 'enemy') {
      endRun(floorsCleared, true);
      return;
    }

    floorsCleared++;
    save.highestFloor = Math.max(save.highestFloor, floor);
    character.unspentPoints += POINTS_PER_FLOOR;
    const recovered = Math.round(player.stats.maxHp * RECOVER_RATE_BETWEEN_FLOORS);
    currentHp = Math.min(player.stats.maxHp, result.playerHpLeft + recovered);
    console.log(`\n✔ 攻克第 ${floor} 層！獲得 ${POINTS_PER_FLOOR} 屬性點，休整後生命 ${currentHp}/${player.stats.maxHp}。`);
    for (const msg of rollFloorDrops(floor, save, rng)) console.log(`  ${msg}`);
    persistSave(save);

    floor++;
    const choice = await ask(`\n繼續深入第 ${floor} 層？（y = 繼續／其他 = 撤退）：`);
    if (choice.toLowerCase() !== 'y') {
      endRun(floorsCleared, false);
      return;
    }
  }
}

async function main(): Promise<void> {
  console.log(`\n═══ 血腥都市：第 ${save.era} 紀元 ═══`);
  while (true) {
    if (!save.character) {
      console.log('\n目前沒有存活的冒險者。');
      console.log('  1. 建立新角色\n  2. 遺產商店\n  3. 世界狀態\n  4. 離開');
      const choice = await ask('> ');
      if (choice === '1') await createCharacter();
      else if (choice === '2') await legacyShop();
      else if (choice === '3') showWorld();
      else if (choice === '4') break;
      persistSave(save);
      continue;
    }

    console.log(
      `\n—— ${save.character.name}｜最高 ${save.highestFloor} 層｜遺產 ${save.legacyPoints} 點 ——`,
    );
    console.log(
      '  1. 進入副本\n  2. 角色狀態\n  3. 配置裝備\n  4. 配置技能\n  5. 分配屬性點\n  6. 遺產商店\n  7. 世界狀態\n  8. 離開',
    );
    const choice = await ask('> ');
    if (choice === '1') await runDungeon();
    else if (choice === '2') showStatus();
    else if (choice === '3') await manageEquipment();
    else if (choice === '4') await manageSkills();
    else if (choice === '5') await allocatePoints();
    else if (choice === '6') await legacyShop();
    else if (choice === '7') showWorld();
    else if (choice === '8') break;
    persistSave(save);
  }
  persistSave(save);
  console.log('\n進度已儲存，下次再戰。\n');
  rl.close();
}

main();
