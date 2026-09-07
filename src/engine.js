export const WORLD = { w: 1600, h: 900 };
export const TYPES = {
  tank: { name: "游骑兵坦克", hp: 240, speed: 72, range: 170, damage: 36, cost: 260, time: 5.8, producer: "factory", cooldown: 2.2 },
  infantry: { name: "先锋步兵", hp: 90, speed: 90, range: 115, damage: 12, cost: 90, time: 2.8, producer: "barracks", cooldown: 1.2 },
  harvester: { name: "勘探采矿车", hp: 180, speed: 85, range: 0, damage: 0, cost: 140, time: 6, producer: "headquarters" },
  aircraft: { name: "苍穹战机", hp: 160, speed: 150, range: 200, damage: 28, cost: 380, time: 7.2, producer: "airfield", cooldown: 1.6, domain: "air" },
  boat: { name: "湖岸巡逻艇", hp: 180, speed: 84, range: 220, damage: 22, cost: 220, time: 5, producer: "shipyard", cooldown: 1.8, domain: "water" },
  enemy: { name: "赤砂守卫", hp: 170, speed: 55, range: 145, damage: 20, cooldown: 1.6 },
};
export const BUILDINGS = {
  headquarters: { name: "指挥中心", cost: 300, alloy: 80, time: 16, hp: 1800, radius: 68, cap: 20, supply: 45, demand: 0, asset: "Headquarters" },
  barracks: { name: "兵营", cost: 260, alloy: 40, time: 10, hp: 520, radius: 48, cap: 10, supply: 8, demand: 6, asset: "Barracks" },
  factory: { name: "战车工厂", cost: 420, alloy: 80, time: 14, hp: 600, radius: 58, cap: 6, supply: 18, demand: 10, asset: "Factory" },
  airfield: { name: "空军基地", cost: 520, alloy: 100, time: 18, hp: 560, radius: 68, cap: 6, supply: 12, demand: 14, asset: "Airfield" },
  shipyard: { name: "船坞", cost: 400, alloy: 70, time: 14, hp: 540, radius: 48, cap: 8, supply: 0, demand: 0 },
};
export const TECHS = {
  ballistics: { name: "弹道学", cost: 260, time: 24, description: "全军伤害 +12%" },
  armor: { name: "强化装甲", cost: 280, time: 26, description: "承伤 ÷1.15" },
  logistics: { name: "后勤网络", cost: 320, time: 30, prerequisite: "ballistics", description: "移速 +8% · 生产 +12%" },
};
export const ABILITIES = {
  scan: { name: "战术扫描", cost: 20, cooldown: 35, description: "永久揭示目标周围区域" },
  overcharge: { name: "武器超载", cost: 30, cooldown: 45, description: "全军伤害 +35% · 持续 8 秒" },
};
export const ORDERS = { idle: "待命", move: "移动", attack: "攻击", patrol: "巡逻", guard: "护卫", hold: "驻守", harvest: "采集", retreat: "撤回维修" };
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const isWater = (x, y) => x > 35 && y > 35 && x < 550 && y < 310 && ((x - 128) / 420) ** 2 + ((y + 18) / 312) ** 2 < 0.96;
export function walkable(x, y, domain = "ground") {
  if (x < 38 || x > 1562 || y < 38 || y > 862) return false;
  return domain === "air" || (domain === "water" ? isWater(x, y) : !isWater(x, y));
}
export function makeUnit(id, type, x, y, team = "blue") {
  return { id, type, x, y, team, hp: TYPES[type].hp, maxHp: TYPES[type].hp, order: "idle", target: null, targetId: null, cooldown: 0, cargo: 0, work: 0, path: [], pending: [] };
}
function building(id, type, x, y, team = "blue") {
  return { id, type, x, y, team, hp: BUILDINGS[type].hp, maxHp: BUILDINGS[type].hp, remaining: 0, total: BUILDINGS[type].time, rally: null, repairing: false, rotation: 0 };
}
export function createGame() {
  const home = building("home", "headquarters", 265, 728), enemyBase = building("base", "headquarters", 1370, 150, "gold");
  const ores = [
    { id: "ore", name: "中央晶矿", x: 1020, y: 425, remaining: 8000 },
    { id: "west", name: "湖岸矿区", x: 520, y: 325, remaining: 5000 },
    { id: "south", name: "南部矿区", x: 760, y: 735, remaining: 6000 },
    { id: "north", name: "北部矿区", x: 1070, y: 185, remaining: 5000 },
  ].map(o => ({ ...o, team: null, contested: false }));
  const g = {
    version: 2, time: 0, credits: 1800, alloy: 2400, mined: 0, kills: 0, nextId: 30, wave: 1, waveAt: 55,
    units: [makeUnit(1, "tank", 620, 445), makeUnit(2, "tank", 690, 530), makeUnit(3, "tank", 760, 610),
      makeUnit(4, "infantry", 870, 555), makeUnit(5, "infantry", 925, 610), makeUnit(6, "infantry", 1010, 585),
      makeUnit(7, "harvester", 535, 620), makeUnit(8, "enemy", 1220, 310, "gold"), makeUnit(9, "enemy", 1335, 355, "gold"), makeUnit(10, "enemy", 1380, 270, "gold")],
    home, enemyBase, buildings: [home, building("barracks-1", "barracks", 284, 450), building("factory-1", "factory", 476, 798), building("airfield-1", "airfield", 716, 820), enemyBase, building("enemy-factory", "factory", 1500, 318, "gold"), building("enemy-airfield", "airfield", 1180, 115, "gold")],
    enemyCredits: 360, enemyThinkAt: 35,
    ores, ore: ores[0], queue: [], research: [], researched: [], abilityEnergy: 100, cooldowns: { scan: 0, overcharge: 0 }, overchargeUntil: 0,
    scans: [], fog: true, visible: [], explored: [], visibilityTimer: 0, incomeTimer: 3, effects: [], explosions: [],
    events: ["占领矿区获取收入，建造生产设施，摧毁敌方指挥中心。"], result: null, paused: false, marker: null, groups: {}, sound: true,
  };
  refreshVisibility(g); return g;
}
export function message(g, text) {
  if (g.events[0] !== text) g.events = [text, ...g.events].slice(0, 5);
}
export function economy(g) {
  const active = g.buildings.filter(b => b.team === "blue" && b.hp > 0 && b.remaining <= 0);
  const population = g.units.filter(u => u.team === "blue" && u.hp > 0).length;
  const cap = 12 + active.reduce((n, b) => n + BUILDINGS[b.type].cap, 0);
  const supply = 30 + active.reduce((n, b) => n + BUILDINGS[b.type].supply, 0);
  const demand = 8 + population * 3 + active.reduce((n, b) => n + BUILDINGS[b.type].demand, 0);
  const controlled = g.ores.filter(o => o.team === "blue").length;
  return { population, cap, supply, demand, energy: Math.round(clamp(1 - demand / supply, 0, 1) * 100), credits: 20 + controlled * 18, alloy: 2 + controlled * 4, controlled };
}
export function canStand(g, x, y, type) {
  const domain = TYPES[type]?.domain || "ground";
  return walkable(x, y, domain) && (domain !== "ground" || !g.buildings.some(b => b.hp > 0 && distance(b, { x, y }) < BUILDINGS[b.type].radius + 10));
}
function nearestStand(g, p, type) {
  if (canStand(g, p.x, p.y, type)) return { x: p.x, y: p.y };
  for (let radius = 20; radius <= 280; radius += 20) for (let i = 0; i < 24; i++) {
    const q = { x: p.x + Math.cos(i * Math.PI / 12) * radius, y: p.y + Math.sin(i * Math.PI / 12) * radius };
    if (canStand(g, q.x, q.y, type)) return q;
  }
  return null;
}
function assign(u, task) {
  Object.assign(u, task, { work: 0, path: [], pathGoal: null, stalled: 0 });
  if (task.order === "patrol") { u.patrolStart = { x: u.x, y: u.y }; u.patrolEnd = task.target; u.patrolBack = false; }
}
function finishOrder(u) {
  if (u.pending.length) assign(u, u.pending.shift());
  else { u.order = "idle"; u.target = null; u.targetId = null; u.path = []; }
}
export function issueOrder(g, ids, order, point, append = false) {
  if (g.result) return false;
  const units = g.units.filter(u => ids.includes(u.id) && u.team === "blue" && u.hp > 0);
  if (!units.length) { message(g, "请先选择部队。"); return false; }
  if (["move", "attack", "patrol", "guard"].includes(order) && !point) return false;
  let count = 0;
  units.forEach((u, i) => {
    if (order === "retreat") {
      const facility = repairDestination(g, u);
      if (!facility || u.hp >= u.maxHp) return;
      u.pending = []; assign(u, { order, target: facility.point, targetId: facility.building.id }); count++; return;
    }
    if (order === "guard" && (point.team !== "blue" || point.id === u.id)) return;
    if (point && ["move", "patrol"].includes(order) && !walkable(point.x, point.y, TYPES[u.type].domain)) return;
    const formation = units.length > 1 && !point?.id;
    const p = point ? { x: point.x + (formation ? ((i % 3) - 1) * 36 : 0), y: point.y + (formation ? Math.floor(i / 3) * 36 : 0) } : null;
    const task = { order, target: p ? nearestStand(g, p, u.type) : null, targetId: point?.id ?? null };
    if (order === "harvest") task.oreId = point?.id || g.ore.id;
    if (order === "harvest" && u.type !== "harvester") { task.order = "move"; task.target = nearestStand(g, point || g.ore, u.type); }
    if (append && u.order !== "idle" && u.order !== "hold") u.pending.push(task);
    else { u.pending = []; assign(u, task); }
    count++;
  });
  if (point) g.marker = { ...point, life: 1.6 };
  message(g, order === "retreat" ? count ? count + " 支部队撤回维修：脱战 4 秒后，每 8 HP 消耗 1 合金。" : "所选部队无需维修，或缺少对应的已建成生产设施。" : count ? (ORDERS[order] || "停止") + "指令已" + (append ? "加入路径队列。" : "下达。") : "目标不适合所选部队：舰艇在水面移动，地面部队在陆地移动。");
  return count > 0;
}
function repairDestination(g, u) {
  const facilities = g.buildings.filter(b => b.team === u.team && b.hp > 0 && b.remaining <= 0 && b.type === TYPES[u.type].producer).sort((a, b) => distance(u, a) - distance(u, b));
  for (const b of facilities) {
    const point = nearestStand(g, { x: b.x + BUILDINGS[b.type].radius + 24, y: b.y - 35 }, u.type);
    if (point && distance(point, b) <= BUILDINGS[b.type].radius + 100) return { building: b, point };
  }
  return null;
}
function retreat(g, u, dt) {
  const b = g.buildings.find(b => b.id === u.targetId && b.hp > 0 && b.remaining <= 0);
  if (!b) {
    const destination = repairDestination(g, u);
    if (!destination) { finishOrder(u); message(g, "维修设施已失去，部队原地待命。"); return; }
    assign(u, { order: "retreat", target: destination.point, targetId: destination.building.id }); return;
  }
  if (distance(u, b) > BUILDINGS[b.type].radius + 100 || !canStand(g, u.x, u.y, u.type)) { move(g, u, u.target, dt); return; }
  if (g.time - (u.lastHitAt ?? -10) < 4) return;
  const amount = Math.min(dt * 24, u.maxHp - u.hp, g.alloy * 8);
  u.hp += amount; g.alloy -= amount / 8;
  if (u.hp >= u.maxHp) { finishOrder(u); message(g, TYPES[u.type].name + "维修完成，等待部署。"); }
}
export function productionReason(g, type, producerId) {
  const d = TYPES[type];
  if (!d?.cost || g.result) return "当前无法生产";
  const b = g.buildings.find(b => (!producerId || b.id === producerId) && b.type === d.producer && b.hp > 0 && b.team === "blue" && b.remaining <= 0);
  if (!b) return "需要已建成的" + BUILDINGS[d.producer].name;
  if (g.credits < d.cost) return "晶矿不足";
  if (g.queue.filter(q => q.producerId === b.id).length >= 5) return "该建筑的队列已满";
  const e = economy(g);
  if (e.population + g.queue.length >= e.cap) return "人口上限：请增建基地设施";
  return "";
}
export function enqueue(g, type, producerId) {
  const reason = productionReason(g, type, producerId);
  if (reason) { message(g, reason); return false; }
  const d = TYPES[type], b = g.buildings.find(b => (!producerId || b.id === producerId) && b.type === d.producer && b.hp > 0 && b.team === "blue" && b.remaining <= 0);
  g.credits -= d.cost;
  g.queue.push({ id: g.nextId++, type, producerId: b.id, remaining: d.time, total: d.time, cost: d.cost });
  message(g, d.name + "已加入" + BUILDINGS[b.type].name + "的队列。"); return true;
}
export function cancelProduction(g, id) {
  if (g.result) return false;
  const i = g.queue.findIndex(q => q.id === id); if (i < 0) return false;
  g.credits += g.queue[i].cost; g.queue.splice(i, 1); message(g, "已取消生产，晶矿全额返还。"); return true;
}
export function placementReason(g, type, p) {
  const d = BUILDINGS[type];
  if (!d || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return "无效位置";
  if (g.result) return "对局已结束";
  if (g.credits < d.cost || g.alloy < d.alloy) return "晶矿或合金不足";
  if (!isVisible(g, p)) return "需要先侦察建造区域";
  if (p.x < d.radius + 40 || p.x > 1560 - d.radius || p.y < d.radius + 40 || p.y > 860 - d.radius) return "超出地图边界";
  if (type === "shipyard") {
    if (isWater(p.x, p.y) || !Array.from({ length: 16 }, (_, i) => ({ x: p.x + Math.cos(i * Math.PI / 8) * 90, y: p.y + Math.sin(i * Math.PI / 8) * 90 })).some(q => isWater(q.x, q.y))) return "船坞需要放在湖岸陆地上";
  } else for (let i = 0; i < 12; i++) if (!walkable(p.x + Math.cos(i * Math.PI / 6) * d.radius, p.y + Math.sin(i * Math.PI / 6) * d.radius)) return "需要完整的陆地空间";
  if (g.buildings.some(b => b.hp > 0 && distance(b, p) < BUILDINGS[b.type].radius + d.radius + 14)) return "与已有建筑重叠";
  if (g.ores.some(o => distance(o, p) < d.radius + 48)) return "不能覆盖矿区";
  if (g.units.some(u => TYPES[u.type].domain !== "air" && distance(u, p) < d.radius + 12)) return "请先移开该区域的部队";
  return "";
}
export function placeBuilding(g, type, p, rotation = 0) {
  const reason = placementReason(g, type, p); if (reason) { message(g, reason); return null; }
  const d = BUILDINGS[type], b = building("building-" + g.nextId++, type, p.x, p.y);
  b.remaining = d.time; b.rotation = rotation; g.credits -= d.cost; g.alloy -= d.alloy; g.buildings.push(b);
  message(g, d.name + "开始施工。"); return b;
}
export function setRally(g, id, p) {
  const b = g.buildings.find(b => b.id === id && b.hp > 0 && b.team === "blue");
  const type = Object.keys(TYPES).find(t => TYPES[t].producer === b?.type);
  if (g.result || !b || !type || !walkable(p.x, p.y, TYPES[type].domain)) { message(g, "集结点不适合该建筑生产的部队。"); return false; }
  b.rally = { x: p.x, y: p.y }; message(g, "集结点已设置，新部队将自动前往。"); return true;
}
export function repairBuilding(g, id) {
  const b = g.buildings.find(b => b.id === id && b.hp > 0 && b.team === "blue");
  if (!b || g.result || b.remaining > 0 || b.hp >= b.maxHp || g.alloy < 1) return false;
  b.repairing = !b.repairing; message(g, b.repairing ? "维修开始：每恢复 8 HP 消耗 1 合金。" : "已停止维修。"); return true;
}
export function startResearch(g, id) {
  const d = TECHS[id];
  if (g.result || !d || g.researched.includes(id) || g.research.some(q => q.id === id)) return false;
  if (d.prerequisite && !g.researched.includes(d.prerequisite)) { message(g, "请先完成弹道学研究。"); return false; }
  if (g.credits < d.cost) { message(g, "研究所需晶矿不足。"); return false; }
  g.credits -= d.cost; g.research.push({ id, remaining: d.time, total: d.time }); message(g, d.name + "研究已启动。"); return true;
}
export function activateAbility(g, id, point) {
  const d = ABILITIES[id];
  if (!d || g.result || (id === "scan" && (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)))) return false;
  if (g.abilityEnergy < d.cost || g.cooldowns[id] > g.time) { message(g, "技能正在冷却或能量不足。"); return false; }
  g.abilityEnergy -= d.cost; g.cooldowns[id] = g.time + d.cooldown;
  if (id === "scan") { g.scans.push({ x: point.x, y: point.y, radius: 290 }); refreshVisibility(g); g.marker = { ...point, life: 3, scan: true }; }
  else g.overchargeUntil = g.time + 8;
  message(g, d.name + "已启动。" + d.description); return true;
}
export const FOG = { cols: 40, rows: 23, cell: 40 };
const cellId = p => clamp(Math.floor(p.y / 40), 0, 22) * 40 + clamp(Math.floor(p.x / 40), 0, 39);
export const isVisible = (g, p) => !g.fog || p.team === "blue" || !!g.visible[cellId(p)];
export const isExplored = (g, p) => !g.fog || !!g.explored[cellId(p)];
export function refreshVisibility(g) {
  g.visible = Array(920).fill(false);
  const sources = [...g.units.filter(u => u.team === "blue" && u.hp > 0).map(u => ({ ...u, radius: u.type === "aircraft" ? 300 : 235 })),
    ...g.buildings.filter(b => b.team === "blue" && b.hp > 0).map(b => ({ ...b, radius: 220 })), ...g.scans];
  for (const p of sources) for (let y = Math.max(0, Math.floor((p.y - p.radius) / 40)); y <= Math.min(22, Math.floor((p.y + p.radius) / 40)); y++)
    for (let x = Math.max(0, Math.floor((p.x - p.radius) / 40)); x <= Math.min(39, Math.floor((p.x + p.radius) / 40)); x++)
      if (distance(p, { x: x * 40 + 20, y: y * 40 + 20 }) < p.radius) g.visible[y * 40 + x] = g.explored[y * 40 + x] = true;
}
// A* follows separate land/water navigation grids and avoids building footprints.
function pathfind(g, u, target) {
  const goal = nearestStand(g, target, u.type); if (!goal) return [];
  const key = p => Math.floor(p.y / 40) * 40 + Math.floor(p.x / 40), start = key(u), end = key(goal);
  const point = k => ({ x: (k % 40) * 40 + 20, y: Math.floor(k / 40) * 40 + 20 });
  const open = [start], from = new Map(), costs = new Map([[start, 0]]), closed = new Set();
  while (open.length) {
    open.sort((a, b) => (costs.get(a) + distance(point(a), goal)) - (costs.get(b) + distance(point(b), goal)));
    const k = open.shift();
    if (k === end || distance(point(k), goal) < 45) {
      const path = [goal]; let current = k;
      while (current !== start) { path.unshift(point(current)); current = from.get(current); }
      return path;
    }
    closed.add(k); const p = point(k);
    for (const [dx, dy] of [[-40, 0], [40, 0], [0, -40], [0, 40], [-40, -40], [-40, 40], [40, -40], [40, 40]]) {
      const q = { x: p.x + dx, y: p.y + dy };
      if (!canStand(g, q.x, q.y, u.type) || (dx && dy && (!canStand(g, p.x + dx, p.y, u.type) || !canStand(g, p.x, p.y + dy, u.type)))) continue;
      const n = key(q); if (closed.has(n)) continue;
      const cost = costs.get(k) + Math.hypot(dx, dy);
      if (cost < (costs.get(n) ?? Infinity)) { costs.set(n, cost); from.set(n, k); if (!open.includes(n)) open.push(n); }
    }
  }
  return [];
}
function clearLine(g, u, p) {
  const steps = Math.ceil(distance(u, p) / 18);
  for (let i = 1; i <= steps; i++) if (!canStand(g, u.x + (p.x - u.x) * i / steps, u.y + (p.y - u.y) * i / steps, u.type)) return false;
  return true;
}
function move(g, u, p, dt) {
  if (!p || distance(u, p) < 7) return true;
  let next = p;
  if (TYPES[u.type].domain !== "air" && !clearLine(g, u, p)) {
    if (!u.path.length || !u.pathGoal || distance(u.pathGoal, p) > 45) { u.path = pathfind(g, u, p); u.pathGoal = { ...p }; }
    if (!u.path.length) { u.stalled = (u.stalled || 0) + dt; return false; }
    next = u.path[0];
    if (distance(u, next) < 8) { u.path.shift(); next = u.path[0] || p; }
  } else u.path = [];
  const d = distance(u, next), speed = TYPES[u.type].speed * (u.team === "blue" && g.researched.includes("logistics") ? 1.08 : 1), amount = Math.min(d, speed * dt);
  if (d > 0) {
    const x = u.x + (next.x - u.x) / d * amount, y = u.y + (next.y - u.y) / d * amount;
    if (canStand(g, x, y, u.type) || !canStand(g, u.x, u.y, u.type)) { u.x = x; u.y = y; } else u.path = [];
  }
  return distance(u, p) < 8;
}
function mine(g, u, dt) {
  let ore = g.ores.find(o => o.id === u.oreId) || g.ore;
  if (u.cargo >= 80 || (ore.remaining <= 0 && u.cargo > 0)) {
    const base = g.buildings.filter(b => b.team === "blue" && b.type === "headquarters" && b.hp > 0 && b.remaining <= 0).sort((a, b) => distance(u, a) - distance(u, b))[0];
    if (!base) { finishOrder(u); return; }
    if (move(g, u, nearestStand(g, { x: base.x + 110, y: base.y - 45 }, u.type), dt)) {
      const cargo = u.cargo; g.credits += cargo; g.mined += cargo; u.cargo = 0; message(g, "晶矿已入库 +" + cargo);
    }
  } else if (ore.remaining <= 0) {
    ore = g.ores.filter(o => o.remaining > 0).sort((a, b) => distance(u, a) - distance(u, b))[0];
    if (ore) u.oreId = ore.id; else finishOrder(u);
  } else if (move(g, u, { x: ore.x - 50, y: ore.y + 30 }, dt)) {
    u.work += dt;
    if (u.work >= 0.08) { const n = Math.min(2, ore.remaining, 80 - u.cargo); u.cargo += n; ore.remaining -= n; u.work = 0; }
  }
}
function damage(g, u, target) {
  const d = TYPES[u.type];
  const buff = u.team === "blue" ? (g.researched.includes("ballistics") ? 1.12 : 1) * (g.overchargeUntil > g.time ? 1.35 : 1) : 1;
  target.hp -= d.damage * buff / (target.team === "blue" && g.researched.includes("armor") ? 1.15 : 1);
  target.lastHitAt = g.time;
  u.cooldown = d.cooldown || 1.1;
  g.effects.push({ id: g.nextId++, x: u.x, y: u.y, sourceType: u.type, tx: target.x, ty: target.y, targetType: target.type, life: 0.22, team: u.team });
  if (target.hp <= 0) {
    g.explosions.push({ id: g.nextId++, x: target.x, y: target.y, life: 0.9, building: typeof target.id === "string" });
    if (u.team === "blue") { g.kills++; g.credits += 30; }
    if (typeof target.id === "string") { g.queue = g.queue.filter(q => q.producerId !== target.id); message(g, (target.team === "blue" ? "我方" : "敌方") + BUILDINGS[target.type].name + "被摧毁。"); }
  }
}
function enemyFacility(g, type) {
  return g.buildings.find(b => b.team === "gold" && b.type === type && b.hp > 0 && b.remaining <= 0);
}
function reinforceEnemy(g) {
  g.wave++;
  const factory = enemyFacility(g, "factory"), airfield = enemyFacility(g, "airfield");
  g.waveAt += factory ? 55 : 75;
  const mines = g.ores.filter(o => o.team === "gold").length;
  const capacity = Math.min(factory ? 6 : 2, g.wave + mines, 18 - g.units.filter(u => u.team === "gold" && u.hp > 0).length);
  let count = 0, aircraft = false;
  for (let i = 0; i < capacity; i++) {
    let type = g.wave >= 3 && i === 0 && airfield ? "aircraft" : g.wave >= 3 && i < 2 && factory ? "tank" : "enemy";
    let cost = TYPES[type].cost || 120;
    if (g.enemyCredits < cost) { type = "enemy"; cost = 120; }
    if (g.enemyCredits < cost) break;
    const producer = type === "aircraft" ? airfield : factory || g.enemyBase;
    const spawn = nearestStand(g, { x: producer.x - BUILDINGS[producer.type].radius - 28, y: producer.y + 35 + i * 22 }, type);
    if (!spawn) continue;
    const u = makeUnit(g.nextId++, type, spawn.x, spawn.y, "gold");
    u.enemyRole = i % 2 === 0 && type !== "aircraft" ? "raider" : "assault";
    assign(u, { order: "attack", target: { x: g.home.x, y: g.home.y }, targetId: null });
    g.units.push(u); g.enemyCredits -= cost; count++; aircraft ||= type === "aircraft";
  }
  message(g, count ? "第 " + g.wave + " 波敌军抵达 · " + count + " 支部队" + (aircraft ? "，含空中单位。" : "。") : "敌军增援受阻：资源不足或兵力已满。");
}
function directEnemy(g) {
  if (g.time < g.enemyThinkAt) return;
  g.enemyThinkAt = g.time + 3;
  const forces = g.units.filter(u => u.team === "gold" && u.hp > 0);
  const threat = g.units.filter(u => u.team === "blue" && u.hp > 0 && TYPES[u.type].damage && distance(u, g.enemyBase) < 310).sort((a, b) => distance(a, g.enemyBase) - distance(b, g.enemyBase))[0];
  const defenders = threat ? forces.slice().sort((a, b) => distance(a, g.enemyBase) - distance(b, g.enemyBase)).slice(0, 3) : [];
  for (const u of forces) {
    let target = g.home, targetId = null, order = "attack";
    if (defenders.includes(u)) { target = threat; targetId = threat.id; }
    else if (u.enemyRole === "raider") {
      const objectives = g.ores.filter(o => o.team !== "gold");
      target = objectives.sort((a, b) => (a.team === "blue" ? -1 : 0) - (b.team === "blue" ? -1 : 0) || distance(u, a) - distance(u, b))[0] || g.ores.find(o => o.id === u.enemyOreId) || g.home;
      // Stay at the selected mine after taking control, until ordered elsewhere.
      const held = g.ores.find(o => o.id === u.enemyOreId);
      if (held?.team === "gold" && distance(u, held) < 120) target = held;
      u.enemyOreId = target.id;
      if (distance(u, target) < 80) order = "hold";
    }
    const point = { x: target.x, y: target.y };
    if (u.order !== order || u.targetId !== targetId || !u.target || distance(u.target, point) > 45) assign(u, { order, target: point, targetId });
  }
}
export function update(g, dt) {
  if (g.paused || g.result) return;
  dt = Math.min(Math.max(0, dt), 0.1); g.time += dt;
  g.effects = g.effects.filter(e => (e.life -= dt) > 0); g.explosions = g.explosions.filter(e => (e.life -= dt) > 0);
  if (g.marker && (g.marker.life -= dt) <= 0) g.marker = null;
  g.abilityEnergy = Math.min(100, g.abilityEnergy + dt * 5);
  g.visibilityTimer -= dt; if (g.visibilityTimer <= 0) { refreshVisibility(g); g.visibilityTimer = 0.25; }
  for (const o of g.ores) {
    const near = g.units.filter(u => u.hp > 0 && TYPES[u.type].domain !== "air" && distance(u, o) < 120);
    const blue = near.filter(u => u.team === "blue").length, gold = near.length - blue, team = blue > gold ? "blue" : gold > blue ? "gold" : null;
    if (team !== o.team && team === "blue") message(g, o.name + "已控制：每 3 秒 +18 晶矿、+4 合金。");
    o.team = team; o.contested = blue > 0 && gold > 0;
  }
  g.incomeTimer -= dt;
  if (g.incomeTimer <= 0) {
    const e = economy(g); g.credits += e.credits; g.alloy += e.alloy;
    g.enemyCredits += 12 + g.ores.filter(o => o.team === "gold").length * 18;
    g.incomeTimer += 3;
  }
  for (const b of g.buildings) {
    if (b.hp <= 0) continue;
    if (b.remaining > 0) { b.remaining = Math.max(0, b.remaining - dt); if (!b.remaining) message(g, BUILDINGS[b.type].name + "已建成，生产与人口容量已启用。"); }
    if (b.repairing) { const repair = Math.min(dt * 32, b.maxHp - b.hp, g.alloy * 8); b.hp += repair; g.alloy -= repair / 8; if (b.hp >= b.maxHp || g.alloy < 0.01) b.repairing = false; }
    const q = g.queue.find(q => q.producerId === b.id);
    if (!q || b.remaining > 0) continue;
    const e = economy(g), speed = (g.researched.includes("logistics") ? 1.12 : 1) * (e.demand > e.supply ? 0.5 : 1);
    q.remaining = Math.max(0, q.remaining - dt * speed);
    if (q.remaining <= 0 && e.population < e.cap) {
      const spawn = nearestStand(g, { x: b.x + BUILDINGS[b.type].radius + 25, y: b.y - 35 }, q.type);
      if (!spawn) continue;
      const u = makeUnit(g.nextId++, q.type, spawn.x, spawn.y);
      if (b.rally) assign(u, { order: "move", target: nearestStand(g, b.rally, u.type), targetId: null });
      g.units.push(u); g.queue.splice(g.queue.indexOf(q), 1); message(g, TYPES[u.type].name + "已就绪。");
    }
  }
  for (const q of g.research) { q.remaining -= dt; if (q.remaining <= 0) { g.researched.push(q.id); message(g, TECHS[q.id].name + "研究完成。"); } }
  g.research = g.research.filter(q => q.remaining > 0);
  if (g.time >= g.waveAt && g.enemyBase.hp > 0) {
    reinforceEnemy(g);
  }
  directEnemy(g);
  for (const u of g.units) {
    if (u.hp <= 0) continue;
    u.cooldown -= dt; const d = TYPES[u.type];
    if (u.order === "retreat") { retreat(g, u, dt); continue; }
    if (u.type === "harvester" && u.order === "harvest") { mine(g, u, dt); continue; }
    if (u.order === "attack" && u.targetId && ![...g.units, ...g.buildings].some(v => v.id === u.targetId && v.hp > 0)) finishOrder(u);
    const entities = [...g.units, ...g.buildings].filter(v => v.hp > 0 && v.team !== u.team && (u.team !== "blue" || isVisible(g, v)));
    const explicit = u.targetId && entities.find(v => v.id === u.targetId);
    const inRange = v => v && distance(u, v) < d.range + (typeof v.id === "string" ? BUILDINGS[v.type].radius : 0);
    const nearby = entities.filter(inRange).sort((a, b) => distance(u, a) - distance(u, b))[0], target = explicit ? inRange(explicit) ? explicit : null : nearby;
    if (target && d.damage && u.order !== "move") { if (u.cooldown <= 0) damage(g, u, target); }
    else if (u.order === "guard") {
      const friend = [...g.units, ...g.buildings].find(v => v.id === u.targetId && v.hp > 0);
      if (!friend) finishOrder(u);
      else if (distance(u, friend) > 85) move(g, u, nearestStand(g, { x: friend.x - 60, y: friend.y + 45 }, u.type), dt);
    } else if (u.order === "patrol" && u.target) {
      if (move(g, u, u.target, dt)) { u.patrolBack = !u.patrolBack; u.target = u.patrolBack ? u.patrolStart : u.patrolEnd; u.path = []; }
    } else if ((u.order === "move" || u.order === "attack") && u.target) {
      if (u.targetId && u.order === "attack" && ![...g.units, ...g.buildings].some(v => v.id === u.targetId && v.hp > 0)) finishOrder(u);
      else if (move(g, u, explicit ? nearestStand(g, explicit, u.type) : u.target, dt)) finishOrder(u);
    }
    if (u.team === "gold" && u.order === "idle" && g.time < 35) {
      u.order = "attack"; u.target = { x: g.ores[3].x, y: g.ores[3].y };
      if (distance(u, g.ores[3]) < 100) u.order = "hold";
    }
  }
  for (let i = 0; i < g.units.length; i++) for (let j = i + 1; j < g.units.length; j++) {
    const a = g.units[i], b = g.units[j]; if ((TYPES[a.type].domain || "ground") !== (TYPES[b.type].domain || "ground")) continue;
    const d = distance(a, b); if (d >= 19 || d < 0.01) continue;
    const push = Math.min(19 - d, dt * 22) / 2, dx = (a.x - b.x) / d * push, dy = (a.y - b.y) / d * push;
    if (canStand(g, a.x + dx, a.y + dy, a.type)) { a.x += dx; a.y += dy; }
    if (canStand(g, b.x - dx, b.y - dy, b.type)) { b.x -= dx; b.y -= dy; }
  }
  g.units = g.units.filter(u => u.hp > 0);
  if (g.enemyBase.hp <= 0) { g.result = "victory"; message(g, "敌方指挥中心已摧毁，区域已控制。"); }
  else if (g.home.hp <= 0) { g.result = "defeat"; message(g, "指挥中心失联。"); }
}
export function serializeGame(g) { return JSON.stringify({ ...g, labels: undefined, fps: undefined, effects: [], explosions: [] }); }
export function restoreGame(json) {
  const g = JSON.parse(json);
  if (g.version !== 2 || !Array.isArray(g.units) || !Array.isArray(g.buildings) || !Array.isArray(g.ores) || !Array.isArray(g.queue) || !Array.isArray(g.researched) || !Number.isFinite(g.time) || !Number.isFinite(g.credits)) throw new Error("存档版本或内容不兼容");
  if (g.units.some(u => !TYPES[u.type] || !Number.isFinite(u.x) || !Number.isFinite(u.y)) || g.buildings.some(b => !BUILDINGS[b.type])) throw new Error("存档包含无效单位或建筑");
  g.home = g.buildings.find(b => b.id === "home"); g.enemyBase = g.buildings.find(b => b.id === "base"); g.ore = g.ores[0];
  if (!g.home || !g.enemyBase || !g.ore) throw new Error("存档缺少对局数据");
  // Existing version-2 saves retain their battlefield; new AI state receives safe defaults.
  if (!Number.isFinite(g.enemyCredits)) g.enemyCredits = 360;
  if (!Number.isFinite(g.enemyThinkAt)) g.enemyThinkAt = Math.max(35, g.time + 3);
  g.paused = true; refreshVisibility(g); message(g, "存档已载入，战术暂停中。"); return g;
}
