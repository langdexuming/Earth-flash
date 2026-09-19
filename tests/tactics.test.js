import test from "node:test";
import assert from "node:assert/strict";
import { createGame as createMapGame, makeUnit, update, issueOrder, distance, isWater, placeBuilding, serializeGame, restoreGame } from "../src/engine.js";

const createGame = () => createMapGame("Legacy160");
const tick = (g, seconds) => { for (let i = 0; i < Math.ceil(seconds * 10); i++) update(g, .1); };
const quiet = () => {
  const g = createGame();
  g.units = []; g.waveAt = 1e6; g.enemyThinkAt = 1e6; g.incomeTimer = 1e6; g.fog = false;
  return g;
};
const hurtTank = g => {
  const u = makeUnit(80, "tank", 650, 600); u.hp = 120; g.units.push(u); return u;
};

test("retreat returns damaged units to their producer, restores HP, and charges only for healing", () => {
  const g = quiet(), u = hurtTank(g), alloy = g.alloy;
  assert.ok(issueOrder(g, [u.id], "retreat"));
  assert.equal(u.targetId, "factory-1");
  tick(g, 15);
  assert.equal(u.hp, u.maxHp); assert.equal(u.order, "idle");
  assert.ok(distance(u, g.buildings.find(b => b.id === "factory-1")) <= 158);
  assert.ok(Math.abs(alloy - g.alloy - 15) < 1e-6);
});

test("incoming fire delays repair, insufficient alloy waits, and a new order cancels repair", () => {
  const g = quiet(), u = hurtTank(g);
  u.x = 580; u.y = 730; u.lastHitAt = 0;
  issueOrder(g, [u.id], "retreat"); tick(g, 3.9); assert.equal(u.hp, 120);
  g.alloy = 1; tick(g, 1); assert.ok(Math.abs(u.hp - 128) < 1e-6); assert.ok(g.alloy < 1e-6);
  tick(g, 1); assert.ok(Math.abs(u.hp - 128) < 1e-6);
  g.alloy = 10; tick(g, 1); assert.ok(u.hp > 128);
  issueOrder(g, [u.id], "move", { x: 900, y: 650 });
  const hp = u.hp; tick(g, 1); assert.equal(u.hp, hp); assert.equal(u.order, "move");
});

test("repair orders reject full-health units and missing facilities; destroyed facilities reroute", () => {
  const g = quiet(), u = hurtTank(g);
  u.hp = u.maxHp; assert.equal(issueOrder(g, [u.id], "retreat"), false);
  u.hp = 120; const factory = g.buildings.find(b => b.id === "factory-1");
  factory.hp = 0; assert.equal(issueOrder(g, [u.id], "retreat"), false);
  factory.hp = factory.maxHp;
  const second = { ...factory, id: "factory-2", x: 850, y: 740 }; g.buildings.push(second);
  issueOrder(g, [u.id], "retreat"); const first = g.buildings.find(b => b.id === u.targetId);
  first.hp = 0; tick(g, .1); assert.notEqual(u.targetId, first.id);
  g.buildings.find(b => b.id === u.targetId).hp = 0;
  tick(g, .1); assert.equal(u.order, "idle"); assert.ok(g.events.some(e => e.includes("维修设施已失去")));
});

test("naval retreat stays in water and repairs at a shoreline shipyard", () => {
  const g = quiet();
  const dock = placeBuilding(g, "shipyard", { x: 400, y: 300 }); assert.ok(dock); tick(g, 15);
  const boat = makeUnit(80, "boat", 200, 160); boat.hp = 90; g.units.push(boat);
  assert.ok(issueOrder(g, [80], "retreat"));
  for (let i = 0; i < 180; i++) { update(g, .1); assert.ok(isWater(boat.x, boat.y)); }
  assert.equal(boat.hp, boat.maxHp); assert.equal(boat.order, "idle");
});

test("focus fire pursues a designated target instead of stopping for a closer enemy", () => {
  const g = quiet(), tank = makeUnit(80, "tank", 700, 500), decoy = makeUnit(81, "enemy", 720, 520, "gold"), target = makeUnit(82, "enemy", 1080, 500, "gold");
  decoy.order = target.order = "hold"; decoy.cooldown = target.cooldown = 100;
  g.units = [tank, decoy, target]; issueOrder(g, [80], "attack", target);
  tick(g, 2); assert.ok(tank.x > 820); assert.equal(decoy.hp, decoy.maxHp);
  tick(g, 2); assert.ok(target.hp < target.maxHp);
});

test("destroyed focus targets release queued commands immediately", () => {
  const g = quiet(), tank = makeUnit(80, "tank", 700, 500), target = makeUnit(81, "enemy", 740, 500, "gold");
  target.hp = 1; target.cooldown = 100; target.order = "hold"; g.units = [tank, target];
  issueOrder(g, [80], "attack", target); issueOrder(g, [80], "move", { x: 700, y: 650 }, true);
  tick(g, 3); assert.equal(tank.order, "idle"); assert.ok(tank.y > 640);
});

const waveGame = () => { const g = quiet(); g.wave = 2; g.waveAt = 0; g.enemyCredits = 3000; return g; };
test("reinforcements spend a finite enemy budget and spawn beside surviving facilities", () => {
  const g = waveGame(); tick(g, .1);
  assert.deepEqual(g.units.map(u => u.type), ["aircraft", "tank", "enemy"]);
  assert.equal(g.enemyCredits, 3000 - 380 - 260 - 120);
  assert.ok(distance(g.units[0], g.buildings.find(b => b.id === "enemy-airfield")) < 150);
  const poor = waveGame(); poor.enemyCredits = 119; tick(poor, .1);
  assert.equal(poor.units.length, 0); assert.equal(poor.enemyCredits, 119);
});

test("destroying enemy factory reduces wave size and cadence; airfield loss prevents aircraft", () => {
  const g = waveGame(); g.buildings.find(b => b.id === "enemy-factory").hp = 0;
  tick(g, .1); assert.equal(g.units.length, 2); assert.equal(g.waveAt, 75); assert.ok(g.units.every(u => u.type !== "tank"));
  const grounded = waveGame(); grounded.buildings.find(b => b.id === "enemy-airfield").hp = 0;
  tick(grounded, .1); assert.equal(grounded.waveAt, 55); assert.ok(grounded.units.every(u => u.type !== "aircraft"));
});

test("enemy mine control funds reinforcements and raiders hold captured mines", () => {
  const g = quiet(), ore = g.ores[0], raider = makeUnit(80, "enemy", ore.x, ore.y, "gold");
  raider.enemyRole = "raider"; raider.enemyOreId = ore.id; raider.order = "hold"; g.units = [raider];
  g.enemyThinkAt = 35; g.time = 35; g.incomeTimer = .1;
  const funds = g.enemyCredits; tick(g, .1);
  assert.equal(ore.team, "gold"); assert.equal(g.enemyCredits - funds, 30); assert.equal(raider.order, "hold");
  tick(g, 4); assert.ok(distance(raider, ore) < 10);
});

test("raiders contest player mines and nearby defenders respond to a headquarters attack", () => {
  const g = quiet(), raider = makeUnit(80, "enemy", 1000, 650, "gold"), owner = makeUnit(81, "infantry", 760, 735);
  raider.enemyRole = "raider"; raider.order = "hold"; owner.order = "hold";
  g.units = [raider, owner]; g.time = 35; g.enemyThinkAt = 35; tick(g, .1);
  assert.equal(raider.enemyOreId, "south"); assert.equal(raider.order, "attack");
  const attacker = makeUnit(82, "tank", 1310, 420); g.units.push(attacker);
  tick(g, 3); assert.equal(raider.targetId, attacker.id);
});

test("enemy force cap bounds sustained reinforcements", () => {
  const g = waveGame();
  g.units = Array.from({ length: 18 }, (_, i) => makeUnit(100 + i, "enemy", 1100 + i * 20, 400, "gold"));
  tick(g, .1); assert.equal(g.units.length, 18); assert.equal(g.enemyCredits, 3000);
});

test("new saves preserve AI economy and retreat; older saves receive AI defaults", () => {
  const g = quiet(), u = hurtTank(g); issueOrder(g, [u.id], "retreat"); g.enemyCredits = 777;
  const loaded = restoreGame(serializeGame(g));
  assert.equal(loaded.enemyCredits, 777); assert.equal(loaded.units[0].order, "retreat");
  loaded.paused = false; tick(loaded, 15); assert.equal(loaded.units[0].hp, u.maxHp);
  const old = JSON.parse(serializeGame(g)); delete old.enemyCredits; delete old.enemyThinkAt;
  const migrated = restoreGame(JSON.stringify(old)); assert.equal(migrated.enemyCredits, 360); assert.ok(Number.isFinite(migrated.enemyThinkAt));
});
