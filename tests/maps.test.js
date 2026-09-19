import test from "node:test";
import assert from "node:assert/strict";
import { createGame, MAP_PRESETS, makeUnit, canStand, walkable, isWater, worldFor, fogFor, refreshVisibility, isVisible, isExplored, issueOrder, update, distance, economy, enqueue, placeBuilding, placementReason, setRally, activateAbility, serializeGame, restoreGame } from "../src/engine.js";
const tick = (g,seconds) => { for (let i=0;i<Math.ceil(seconds*10);i++) update(g,.1); };
const quiet = (id) => { const g=createGame(id); g.units=[]; g.waveAt=1e8; g.enemyThinkAt=1e8; g.incomeTimer=1e8; return g; };

for (const preset of MAP_PRESETS) {
  test(`${preset.id}: expanded geometry keeps every unit, resource and building on valid terrain`, () => {
    const g=createGame(preset.id);
    assert.equal(g.world.id,preset.id); assert.equal(g.world.w,preset.w); assert.equal(g.ores.length,12);
    assert.ok(g.world.w*g.world.h > 1600*900*3);
    assert.ok(g.world.water.length>=2); assert.ok(g.world.roads.length>=5); assert.ok(g.world.obstacles.length>=8);
    g.units.forEach(u => assert.ok(canStand(g,u.x,u.y,u.type),`unit ${u.id} invalid`));
    g.ores.forEach(o => assert.ok(walkable(o.x,o.y,"ground",g),`ore ${o.id} invalid`));
    g.buildings.forEach(b => assert.ok(walkable(b.x,b.y,"ground",g),`building ${b.id} invalid`));
    const dock=g.buildings.find(b=>b.type==="shipyard");
    const empty=quiet(preset.id); empty.fog=false; empty.buildings=empty.buildings.filter(b=>b.id!==dock.id);
    assert.equal(placementReason(empty,"shipyard",dock),"");
  });
  test(`${preset.id}: land routes reach all 12 strategic points without crossing lake or rock footprints`, () => {
    const g=quiet(preset.id); g.fog=false;
    for (const ore of g.ores) {
      const u=makeUnit(80,"tank",g.home.x+160,g.home.y-30); g.units=[u];
      assert.ok(issueOrder(g,[u.id],"move",ore));
      for (let i=0;i<1600 && u.order!=="idle";i++) { update(g,.1); assert.ok(canStand(g,u.x,u.y,u.type),`${ore.id} crossed terrain`); }
      assert.ok(distance(u,ore)<9,`${ore.id} unreachable: ${u.x},${u.y}, stalled=${u.stalled}`);
    }
  });
  test(`${preset.id}: shoreline production, naval movement and repair stay in the matching lake`, () => {
    const g=quiet(preset.id), dock=g.buildings.find(b=>b.type==="shipyard"); g.fog=false;
    const lake=g.world.water[0];
    assert.ok(setRally(g,dock.id,{x:lake.x,y:lake.y})); assert.ok(enqueue(g,"boat",dock.id)); tick(g,15);
    const boat=g.units.find(u=>u.type==="boat"); assert.ok(boat); assert.ok(isWater(boat.x,boat.y,g));
    boat.hp=80; const alloy=g.alloy; assert.ok(issueOrder(g,[boat.id],"retreat"));
    for(let i=0;i<350;i++){update(g,.1); assert.ok(isWater(boat.x,boat.y,g));}
    assert.equal(boat.hp,boat.maxHp); assert.equal(boat.order,"idle"); assert.ok(Math.abs(alloy-g.alloy-12.5)<.001);
  });
  test(`${preset.id}: remote scouting and construction work beyond the old map edges`, () => {
    const g=quiet(preset.id), p={x:g.world.w-200,y:g.world.h-200};
    assert.ok(p.x>1600 && p.y>900); assert.equal(isVisible(g,p),false);
    assert.ok(activateAbility(g,"scan",p)); assert.equal(isVisible(g,p),true);
    assert.equal(isExplored(g,p),true); const {cols,rows}=fogFor(g); assert.equal(g.visible.length,cols*rows);
    assert.equal(placementReason(g,"barracks",p),""); const b=placeBuilding(g,"barracks",p); assert.ok(b);
    tick(g,11); assert.ok(enqueue(g,"infantry",b.id)); tick(g,4);
    assert.ok(g.units.some(u=>u.type==="infantry" && u.x>1600 && u.y>900));
    assert.match(placementReason(g,"barracks",{x:g.world.w-10,y:g.world.h-10}),/侦察|边界/);
    assert.equal(activateAbility(g,"scan",{x:g.world.w+100,y:50}),false);
  });
}

test("captured outposts retain ownership, hostile presence suspends income and recapture takes time", () => {
  const g=quiet(), ore=g.ores[0], u=makeUnit(80,"infantry",ore.x,ore.y); g.units=[u]; u.order="hold";
  tick(g,3); assert.equal(ore.team,null); assert.ok(ore.captureProgress>0); tick(g,3.1); assert.equal(ore.team,"blue");
  g.units=[]; tick(g,1); assert.equal(ore.team,"blue"); assert.equal(economy(g).controlled,1);
  const blue=makeUnit(81,"tank",ore.x-50,ore.y), enemy=makeUnit(82,"enemy",ore.x+50,ore.y,"gold");
  blue.cooldown=enemy.cooldown=1000; blue.order=enemy.order="hold"; g.units=[blue,enemy];
  tick(g,1); assert.ok(ore.contested); assert.equal(economy(g).controlled,0); assert.equal(ore.team,"blue");
  g.units=[enemy]; tick(g,3); assert.equal(ore.team,"blue"); tick(g,3.1); assert.equal(ore.team,"gold");
  ore.remaining=0; g.incomeTimer=.1; const funds=g.enemyCredits; tick(g,.1); assert.equal(g.enemyCredits-funds,12);
});

test("large-map harvesting returns cargo without inventing or losing mined resources", () => {
  const g=quiet(); g.units=[makeUnit(80,"harvester",g.home.x+180,g.home.y-100)];
  assert.ok(issueOrder(g,[80],"harvest",g.ore)); const credits=g.credits,remaining=g.ore.remaining;
  tick(g,90); const u=g.units[0]; assert.ok(g.mined>=80); assert.equal(g.credits-credits,g.mined); assert.equal(remaining-g.ore.remaining,g.mined+u.cargo);
});

test("separate games retain their map bounds and fog even when another preset is selected", () => {
  const large=quiet("Highland360"), small=quiet("TwinLakes280");
  const p={x:3400,y:1900}; assert.ok(walkable(p.x,p.y,"air",large)); assert.equal(walkable(p.x,p.y,"air",small),false);
  large.scans.push({...p,radius:180}); refreshVisibility(large); refreshVisibility(small);
  assert.ok(isVisible(large,p)); assert.equal(isVisible(small,p),false); assert.equal(worldFor(large).w,3600);
});

test("save/load retains a remote battle, control progress, orders and the selected map", () => {
  const g=quiet("Highland360"), ore=g.ores[11];
  g.units=[makeUnit(80,"tank",ore.x,ore.y)]; g.units[0].order="hold"; tick(g,2);
  const loaded=restoreGame(serializeGame(g)); assert.equal(loaded.mapId,"Highland360"); assert.equal(loaded.world.w,3600);
  assert.equal(loaded.ores[11].captureProgress,ore.captureProgress); assert.ok(loaded.paused); loaded.paused=false; tick(loaded,4.1); assert.equal(loaded.ores[11].team,"blue");
  const classic=createGame("Legacy160"), old=JSON.parse(serializeGame(classic)); old.version=2; delete old.world; delete old.mapId;
  const migrated=restoreGame(JSON.stringify(old)); assert.equal(migrated.world.w,1600); assert.equal(migrated.home.x,classic.home.x); assert.equal(migrated.units[0].x,classic.units[0].x);
  const invalid=JSON.parse(serializeGame(g)); invalid.units[0].x=999999; assert.throws(()=>restoreGame(JSON.stringify(invalid)),/坐标/);
});

test("enemy raiders expand into remote resource points and production respects surviving infrastructure", () => {
  const g=quiet(); g.time=35; g.enemyThinkAt=35;
  const ore=g.ores[8], u=makeUnit(80,"enemy",ore.x+160,ore.y,"gold"); u.enemyRole="raider"; g.units=[u];
  tick(g,12); assert.equal(u.enemyOreId,ore.id); assert.equal(ore.team,"gold");
  const credits=g.enemyCredits; g.incomeTimer=.1; tick(g,.1); assert.equal(g.enemyCredits-credits,12+ore.income);
  g.waveAt=g.time; g.enemyCredits=2000; tick(g,.1); assert.ok(g.units.length>1);
  assert.ok(g.units.every(u=>canStand(g,u.x,u.y,u.type)));
});

test("supported orders reject nonfinite coordinates without corrupting the simulation", () => {
  const g=createGame(); assert.equal(issueOrder(g,[1],"move",{x:NaN,y:20}),false); assert.equal(issueOrder(g,[1],"teleport",{x:50,y:50}),false);
  const before=g.time; update(g,NaN); assert.equal(g.time,before);
});

for (const preset of MAP_PRESETS) test(`${preset.id}: combined production, research and an assault complete the full mission`, async () => {
  const {startResearch,activateAbility}=await import("../src/engine.js");
  const g=createGame(preset.id); issueOrder(g,[7],"harvest",g.ores[2]);
  assert.ok(startResearch(g,"ballistics")); assert.ok(startResearch(g,"armor"));
  for(let i=0;i<3;i++) assert.ok(enqueue(g,"tank")); assert.ok(enqueue(g,"aircraft"));
  for(let i=0;i<1400 && !g.result;i++) {
    if(i%30===0) {
      const army=g.units.filter(u=>u.team==="blue" && !["harvester","boat"].includes(u.type));
      issueOrder(g,army.map(u=>u.id),"attack",g.enemyBase);
      if(g.credits>400) enqueue(g,"tank");
      if(army.some(u=>distance(u,g.enemyBase)<250)) activateAbility(g,"overcharge");
    }
    update(g,.1);
  }
  assert.equal(g.result,"victory"); assert.ok(g.kills>=5); assert.ok(g.home.hp>0);
  assert.ok(g.researched.includes("ballistics")); assert.ok(g.mined>=80);
  const time=g.time; tick(g,10); assert.equal(g.time,time);
});

test("an unsupported opening rush meets base defenders and enemy counterattack can end the mission", () => {
  const g=createGame(); issueOrder(g,[1,2,3,4,5,6],"attack",g.enemyBase); tick(g,210);
  assert.equal(g.result,"defeat"); assert.ok(g.enemyBase.hp>0); const time=g.time; tick(g,10); assert.equal(g.time,time);
});

test("corrupt production, resource or research records are rejected before resuming a save", () => {
  const g=createGame();
  for(const mutate of [save=>save.queue.push({type:"missing",remaining:2}),save=>save.ores[0].remaining=-50,save=>save.research.push({id:"missing",remaining:3}),save=>save.units[0].hp=null]) {
    const bad=JSON.parse(serializeGame(g)); mutate(bad); assert.throws(()=>restoreGame(JSON.stringify(bad)),/存档/);
  }
});
