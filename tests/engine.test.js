import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  makeUnit,
  update,
  issueOrder,
  enqueue,
  TYPES,
} from "../src/engine.js";
const tick = (g, seconds) => {
  for (let i = 0; i < seconds * 10; i++) update(g, 0.1);
};
test("paused simulation freezes movement, timer and production", () => {
  const g = createGame();
  enqueue(g, "tank");
  g.paused = true;
  const before = JSON.stringify(g);
  tick(g, 12);
  assert.equal(JSON.stringify(g), before);
});
test("production spends only available funds and creates unit after build time", () => {
  const g = createGame();
  assert.ok(enqueue(g, "tank"));
  assert.equal(g.credits, 1800 - TYPES.tank.cost);
  tick(g, 8);
  assert.equal(g.units.filter((u) => u.type === "tank").length, 4);
  assert.equal(g.queue.length, 0);
  g.credits = 0;
  assert.equal(enqueue(g, "tank"), false);
  assert.equal(g.queue.length, 0);
});
test("harvester completes automated mining round trip and conserves ore", () => {
  const g = createGame();
  g.units = g.units.filter((u) => u.team === "blue");
  g.incomeTimer = Infinity; // Isolate cargo income from the new control-point economy.
  issueOrder(g, [7], "harvest");
  tick(g, 26);
  assert.ok(g.mined >= 80);
  assert.equal(g.credits, 1800 + g.mined);
  assert.equal(
    8000 - g.ore.remaining,
    g.mined + g.units.find((u) => u.id === 7).cargo,
  );
});
test("moving orders terminate and resume guard mode", () => {
  const g = createGame();
  issueOrder(g, [1], "move", { x: 790, y: 500 });
  tick(g, 6);
  const u = g.units.find((u) => u.id === 1);
  assert.equal(u.order, "idle");
  assert.ok(Math.hypot(u.x - 790, u.y - 500) < 9);
});
test("coordinated assault can win a complete mission", () => {
  const g = createGame();
  issueOrder(g, [7], "harvest");
  issueOrder(g, [1, 2, 3, 4, 5, 6], "attack", g.enemyBase);
  tick(g, 90);
  assert.equal(g.result, "victory");
  assert.ok(g.kills >= 3);
  assert.ok(g.home.hp > 0);
  const t = g.time;
  tick(g, 10);
  assert.equal(g.time, t);
});
test("enemy damage triggers defeat and stops simulation", () => {
  const g = createGame();
  g.units = [makeUnit(88, "enemy", g.home.x + 40, g.home.y, "gold")];
  g.home.hp = 10;
  tick(g, 2);
  assert.equal(g.result, "defeat");
});
test("enemy reinforcements spawn on schedule", () => {
  const g = createGame();
  g.units = [];
  tick(g, 56);
  assert.equal(g.wave, 2);
  assert.equal(g.units.length, 2);
  assert.equal(g.waveAt, 110);
});
