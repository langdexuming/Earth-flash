import test from "node:test";
import assert from "node:assert/strict";
import { createGame, makeUnit, update, issueOrder, enqueue, TYPES, BUILDINGS, economy, placeBuilding, placementReason, cancelProduction, setRally, startResearch, activateAbility, refreshVisibility, isVisible, isWater, serializeGame, restoreGame, repairBuilding, canStand } from "../src/engine.js";
const tick = (g, seconds) => { for (let i = 0; i < Math.ceil(seconds * 10); i++) update(g, .1); };
const quiet = () => { const g = createGame(); g.units = g.units.filter(u => u.team === "blue"); g.waveAt = 1e6; g.incomeTimer = 1e6; return g; };

test("independent producers run in parallel and cancellation refunds only once", () => {
  const g = quiet(), before = g.credits;
  enqueue(g, "tank"); enqueue(g, "infantry"); enqueue(g, "aircraft");
  const q = g.queue.find(q => q.type === "aircraft");
  assert.ok(cancelProduction(g, q.id)); assert.equal(cancelProduction(g, q.id), false);
  assert.equal(g.credits, before - TYPES.tank.cost - TYPES.infantry.cost);
  tick(g, 6); assert.equal(g.queue.length, 0);
  assert.equal(g.units.filter(u => u.type === "tank").length, 4);
  assert.equal(g.units.filter(u => u.type === "infantry").length, 4);
});
test("building placement rejects collisions without charging; construction unlocks supply and production", () => {
  const g = quiet(); g.units = []; g.fog = false;
  const before = g.credits, cap = economy(g).cap;
  assert.equal(placeBuilding(g, "barracks", g.home), null); assert.equal(g.credits, before);
  const b = placeBuilding(g, "barracks", { x: 700, y: 470 }); assert.ok(b);
  assert.equal(economy(g).cap, cap); assert.equal(enqueue(g, "infantry", b.id), false);
  tick(g, 11); assert.equal(economy(g).cap, cap + BUILDINGS.barracks.cap);
  assert.ok(enqueue(g, "infantry", b.id));
});
test("unexplored ground cannot be built on until scanned", () => {
  const g = quiet(); g.units = []; refreshVisibility(g);
  const p = { x: 1100, y: 620 };
  assert.match(placementReason(g, "barracks", p), /侦察/);
  assert.ok(activateAbility(g, "scan", p)); assert.equal(placementReason(g, "barracks", p), "");
});
test("resource control uses local force counts; equal forces neutralize income", () => {
  const g = quiet(), o = g.ores[0];
  g.units = [makeUnit(80, "infantry", o.x, o.y), makeUnit(81, "enemy", o.x + 50, o.y, "gold")];
  g.units.forEach(u => { u.order = "hold"; u.cooldown = 100; });
  tick(g, .1); assert.equal(o.team, null); assert.ok(o.contested);
  g.units.pop(); tick(g, .1); assert.equal(o.team, "blue");
  g.incomeTimer = .1; const credits = g.credits, alloy = g.alloy;
  tick(g, .1); assert.equal(g.credits - credits, 38); assert.equal(g.alloy - alloy, 6);
});
test("land units reject lake orders, aircraft cross water, ships stay on water", () => {
  const g = quiet(); g.units = [makeUnit(80, "tank", 600, 300), makeUnit(81, "aircraft", 600, 300), makeUnit(82, "boat", 200, 160)];
  assert.equal(issueOrder(g, [80], "move", { x: 200, y: 160 }), false);
  assert.ok(issueOrder(g, [81], "move", { x: 200, y: 160 }));
  assert.equal(issueOrder(g, [82], "move", { x: 1000, y: 600 }), false);
  assert.ok(issueOrder(g, [82], "move", { x: 320, y: 130 }));
  tick(g, 6); assert.ok(g.units[1].x < 210); assert.ok(isWater(g.units[2].x, g.units[2].y));
});
test("shoreline shipyard produces a vessel into the lake", () => {
  const g = quiet(); g.units = []; g.fog = false;
  assert.match(placementReason(g, "shipyard", { x: 800, y: 450 }), /湖岸/);
  const b = placeBuilding(g, "shipyard", { x: 400, y: 300 }); assert.ok(b);
  tick(g, 15); assert.ok(enqueue(g, "boat", b.id)); tick(g, 6);
  const boat = g.units.find(u => u.type === "boat"); assert.ok(boat); assert.ok(isWater(boat.x, boat.y));
});
test("rally points automatically move newly produced units", () => {
  const g = quiet(); g.units = [];
  assert.ok(setRally(g, "factory-1", { x: 850, y: 600 })); enqueue(g, "tank");
  tick(g, 15); assert.ok(g.units[0].x > 800); assert.ok(g.units[0].y < 640);
});
test("shift orders run in sequence; patrol returns; guard follows a moving ally", () => {
  const g = quiet(); g.units = [makeUnit(80, "tank", 650, 450), makeUnit(81, "infantry", 900, 450)];
  issueOrder(g, [80], "move", { x: 740, y: 450 }); issueOrder(g, [80], "move", { x: 740, y: 600 }, true);
  tick(g, 5); assert.equal(g.units[0].order, "idle"); assert.ok(g.units[0].y > 590);
  issueOrder(g, [80], "patrol", { x: 900, y: 600 }); tick(g, 3);
  assert.equal(g.units[0].order, "patrol"); assert.ok(g.units[0].patrolBack);
  issueOrder(g, [80], "guard", g.units[1]); issueOrder(g, [81], "move", { x: 1150, y: 650 }); tick(g, 10);
  assert.equal(g.units[0].order, "guard"); assert.ok(g.units[0].x > 1000);
});
test("ground pathfinding goes around an occupied building footprint", () => {
  const g = quiet(); g.units = [makeUnit(80, "tank", 200, 570)];
  issueOrder(g, [80], "move", { x: 365, y: 800 });
  for (let i = 0; i < 160; i++) { update(g, .1); assert.ok(canStand(g, g.units[0].x, g.units[0].y, "tank")); }
  assert.equal(g.units[0].order, "idle");
});
test("scan reveals hidden enemies, costs energy and cannot bypass cooldown", () => {
  const g = quiet(), p = { x: 1370, y: 150, team: "gold" };
  assert.equal(isVisible(g, p), false); assert.ok(activateAbility(g, "scan", p)); assert.equal(isVisible(g, p), true);
  assert.equal(g.abilityEnergy, 80); assert.equal(activateAbility(g, "scan", p), false);
  tick(g, 36); assert.ok(activateAbility(g, "scan", p));
});
test("technology prerequisite, completion, and overcharge change actual combat damage", () => {
  const g = quiet(); assert.equal(startResearch(g, "logistics"), false);
  assert.ok(startResearch(g, "ballistics")); assert.equal(startResearch(g, "ballistics"), false);
  tick(g, 25); assert.ok(g.researched.includes("ballistics")); assert.ok(startResearch(g, "logistics"));
  g.units = [makeUnit(80, "tank", 900, 500), makeUnit(81, "enemy", 1000, 500, "gold")];
  g.units[1].cooldown = 100; g.units.forEach(u => { u.order = "hold"; }); g.fog = false;
  const hp = g.units[1].hp; activateAbility(g, "overcharge"); tick(g, .1);
  assert.ok(Math.abs(hp - g.units[1].hp - 36 * 1.12 * 1.35) < .001);
  assert.equal(activateAbility(g, "overcharge"), false);
});
test("population reserves queue slots; low power slows production; repairs consume alloy", () => {
  const g = quiet(); g.units = Array.from({ length: 50 }, (_, i) => makeUnit(100 + i, "infantry", 800 + i % 10 * 25, 600 + Math.floor(i / 10) * 25));
  assert.ok(enqueue(g, "tank")); const q = g.queue[0]; tick(g, 1);
  assert.ok(q.remaining > q.total - .6); assert.ok(economy(g).demand > economy(g).supply);
  for (let i = 0; i < 3; i++) assert.ok(enqueue(g, "infantry")); assert.equal(enqueue(g, "tank"), false);
  g.home.hp -= 100; const alloy = g.alloy; assert.ok(repairBuilding(g, "home")); tick(g, 1);
  assert.ok(g.home.hp > g.home.maxHp - 100); assert.ok(g.alloy < alloy);
});
test("destroyed producers stop queued production and lower capacity", () => {
  const g = quiet(); g.units = []; enqueue(g, "tank");
  const cap = economy(g).cap, factory = g.buildings.find(b => b.id === "factory-1"); factory.hp = 1;
  g.units = [makeUnit(80, "enemy", factory.x + 70, factory.y - 15, "gold")]; tick(g, .1);
  assert.ok(factory.hp <= 0); assert.equal(g.queue.length, 0); assert.equal(economy(g).cap, cap - BUILDINGS.factory.cap);
});
test("save/load restores aliases, queued orders, research, abilities and freezes until resumed", () => {
  const g = quiet(); enqueue(g, "aircraft"); startResearch(g, "armor"); activateAbility(g, "scan", { x: 1200, y: 150 });
  issueOrder(g, [1], "move", { x: 800, y: 450 }); issueOrder(g, [1], "move", { x: 900, y: 550 }, true); tick(g, 1);
  const loaded = restoreGame(serializeGame(g));
  assert.equal(loaded.home, loaded.buildings[0]); assert.equal(loaded.ore, loaded.ores[0]); assert.ok(loaded.paused);
  assert.equal(loaded.queue.length, 1); assert.equal(loaded.research[0].id, "armor"); assert.equal(loaded.scans.length, 1);
  const before = serializeGame(loaded); tick(loaded, 3); assert.equal(serializeGame(loaded), before);
  assert.throws(() => restoreGame('{"version":1}'));
});
