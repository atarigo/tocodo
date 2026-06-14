import { pushLog, saveGame, ui } from './store.svelte.js';
import { createCharacter } from '../state/model.js';
import { attrUpgradeCost } from '../game/economy.js';
import { buildPlayerUnit } from '../core/character.js';
import { maxHp, maxMp } from '../core/formulas.js';
import { makeEnemy, startingFloor } from '../core/dungeon.js';
import { simulateBattle } from '../core/combat.js';
import { rollFloorDrops } from '../core/loot.js';
import { createRng } from '../core/rng.js';
import { ATTR_NAMES, type AttrKey, type GearSlot } from '../core/types.js';
import { getWeapon, WEAPON_BY_ID } from '../data/weapons.js';
import { getGear } from '../data/gear.js';
import { getSkill } from '../data/skills.js';

const rng = createRng((Date.now() % 0xffffffff) >>> 0);

const RECOVER_RATE_BETWEEN_FLOORS = 0.25;
const ATTR_CAP = 255;

export function newLife(name: string): void {
  ui.game.records.lives += 1;
  ui.game.character = createCharacter(name.trim() || '無名者');
  ui.phase = 'idle';
  pushLog(`${ui.game.character.name} 踏入世界。這是這個世界的第 ${ui.game.records.lives} 段人生`);
  saveGame();
}

export function buyAttr(key: AttrKey): void {
  const c = ui.game.character;
  if (!c || ui.phase !== 'idle' || c.attrs[key] >= ATTR_CAP) return;
  const cost = attrUpgradeCost(c.attrs[key]);
  if (c.currency < cost) return;
  c.currency -= cost;
  c.attrs[key] += 1;
  pushLog(`${ATTR_NAMES[key]} → ${c.attrs[key]}（−${cost}）`, 'shop');
  saveGame();
}

export function buyItem(id: string, price: number): void {
  const c = ui.game.character;
  if (!c || ui.phase !== 'idle' || c.currency < price || c.inventory.includes(id)) return;
  c.currency -= price;
  c.inventory.push(id);
  const name = WEAPON_BY_ID.has(id) ? getWeapon(id).name : getGear(id).name;
  pushLog(`購得【${name}】（−${price}）`, 'shop');
  saveGame();
}

export function buySkill(id: string, price: number): void {
  const c = ui.game.character;
  if (!c || ui.phase !== 'idle' || c.currency < price || c.knownSkills.includes(id)) return;
  c.currency -= price;
  c.knownSkills.push(id);
  pushLog(`習得【${getSkill(id).name}】（−${price}）`, 'shop');
  saveGame();
}

export function equipWeapon(id: string): void {
  const c = ui.game.character;
  if (!c || ui.phase !== 'idle') return;
  c.equippedWeapon = id || null;
  saveGame();
}

export function equipGear(slot: GearSlot, id: string): void {
  const c = ui.game.character;
  if (!c || ui.phase !== 'idle') return;
  if (id) c.equippedGear[slot] = id;
  else delete c.equippedGear[slot];
  saveGame();
}

export function setSkillSlot(index: number, id: string): void {
  const c = ui.game.character;
  if (!c || ui.phase !== 'idle') return;
  const slots = c.skillSlots.filter((_, i) => i !== index);
  if (id && !slots.includes(id)) slots.splice(index, 0, id);
  c.skillSlots = slots;
  saveGame();
}

export function enterDungeon(): void {
  const c = ui.game.character;
  if (!c || ui.phase !== 'idle') return;
  const unit = buildPlayerUnit(c);
  if (!unit.weapon && unit.skills.length === 0) {
    pushLog('空手又沒技能，進去就是送死——先去商店');
    return;
  }
  ui.run = {
    floor: startingFloor(c.highestFloor),
    hp: maxHp(unit.attrs.vit),
    mp: maxMp(unit.attrs.wil),
    floorsCleared: 0,
  };
  pushLog(`—— 進入副本｜第 ${ui.run.floor} 層（強迫晉級：沒有回頭路） ——`, 'divider');
  startBattle();
}

function startBattle(): void {
  const c = ui.game.character!;
  const run = ui.run!;
  const player = buildPlayerUnit(c);
  const enemy = makeEnemy(run.floor, rng);
  const result = simulateBattle(player, enemy, rng, {
    playerStartHp: run.hp,
    playerStartMp: run.mp,
  });
  const playerMaxHp = maxHp(player.attrs.vit);
  const enemyMaxHp = maxHp(enemy.attrs.vit);
  ui.battle = { result, enemyName: enemy.name, enemyMaxHp, playerMaxHp };
  ui.hpView = { player: run.hp, enemy: enemyMaxHp };
  ui.phase = 'battle';
  pushLog(`—— 第 ${run.floor} 層｜${enemy.name} ——`, 'divider');
}

/** 回放結束後才把戰果落地：勝利結算獎勵、失敗結算人生 */
export function finishBattle(): void {
  const c = ui.game.character;
  const run = ui.run;
  const battle = ui.battle;
  if (!c || !run || !battle) return;

  if (battle.result.winner === 'player') {
    run.floorsCleared += 1;
    c.highestFloor = Math.max(c.highestFloor, run.floor);
    for (const msg of rollFloorDrops(run.floor, c, rng)) pushLog(msg, 'reward');
    const unit = buildPlayerUnit(c);
    const hpMax = maxHp(unit.attrs.vit);
    run.hp = Math.min(hpMax, battle.result.playerHpLeft + Math.round(hpMax * RECOVER_RATE_BETWEEN_FLOORS));
    run.mp = maxMp(unit.attrs.wil);
    pushLog(`✔ 攻克第 ${run.floor} 層｜休整後 ${run.hp}/${hpMax}`, 'reward');
    ui.phase = 'decision';
    saveGame();
    return;
  }

  ui.game.records.bestFloor = Math.max(ui.game.records.bestFloor, c.highestFloor);
  pushLog(`☠ ${c.name} 倒在第 ${run.floor} 層。不適者，淘汰`);
  pushLog('什麼都沒有留下——那是另一個人生了');
  ui.game.character = null;
  ui.run = null;
  ui.battle = null;
  ui.phase = 'dead';
  saveGame();
}

export function continueRun(): void {
  if (ui.phase !== 'decision' || !ui.run) return;
  ui.run.floor += 1;
  startBattle();
}

export function retreat(): void {
  if (ui.phase !== 'decision' || !ui.run) return;
  pushLog(`撤出副本，本次共攻克 ${ui.run.floorsCleared} 層`);
  ui.run = null;
  ui.battle = null;
  ui.phase = 'idle';
  saveGame();
}
