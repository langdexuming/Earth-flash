import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { battlefieldPosition, createTerrain, extractScenery } from "./terrainVisuals.js";
import { update, issueOrder, isVisible, isExplored, placeBuilding, placementReason, setRally, activateAbility, BUILDINGS, TYPES, distance, worldFor, fogFor } from "./engine.js";
import { boatModel, shipyardModel, ring, normalizeModel, makeAudio, finishModel } from "./worldVisuals.js";
export function Battlefield({ game, selectedRef, onSelect, onFrame, onReady, apiRef, onInspect, modeRef, onMode }) {
  const host = useRef(null);
  useEffect(() => {
    const el = host.current;
    let disposed = false, frame, drag = null, last = performance.now(), report = 0, pointer = null, pointerScreen = null, ghost = null, ghostType = null, lastFog = null, lastGame = null;
    const scene = new THREE.Scene(); scene.background = new THREE.Color("#1e3539"); scene.fog = new THREE.Fog("#405853", 290, 680);
    const pos = u => battlefieldPosition(u, worldFor(game.current));
    let land = null, scenery = null, terrainGame = null;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18; el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-label", "3D 战场：左键选择或放置，右键指令，中键旋转，滚轮缩放");
    const camera = new THREE.PerspectiveCamera(38, 1, .5, 900); camera.position.set(25, 76, 87);
    const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 0, 0);
    controls.enableDamping = true; controls.dampingFactor = .09; controls.minDistance = 28; controls.maxDistance = 460;
    controls.minPolarAngle = .25; controls.maxPolarAngle = 1.15;
    controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: null };
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }; controls.update();
    scene.add(new THREE.HemisphereLight(0xc4e1e8, 0x817849, 2));
    const sun = new THREE.DirectionalLight(0xffedc5, 3.3); sun.position.set(-50, 95, 35); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -170, right: 170, top: 170, bottom: -170, near: 1, far: 370 });
    sun.shadow.bias = -.0006; sun.shadow.normalBias = .12; scene.add(sun); scene.add(sun.target);
    const loader = new GLTFLoader(), templates = { boat: boatModel(), shipyard: shipyardModel() }, units = new Map(), structures = new Map(), minerals = new Map();
    const audio = makeAudio(), seenFx = new Set();
    const dustParticles = [], dustGeometry = new THREE.BufferGeometry(), dustPositions = new Float32Array(160 * 3);
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0xc4b99a, size: 1.6, transparent: true, opacity: .22, depthWrite: false, sizeAttenuation: true })); dust.frustumCulled = false; scene.add(dust);
    const fx = new THREE.Group(); scene.add(fx);
    const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let fogBytes, fogTexture;
    const fog = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    fog.rotation.x = Math.PI / 2; fog.position.y = .48; fog.renderOrder = 2; scene.add(fog);
    function rebuildWorld(g) {
      if (land) { scene.remove(land); land.userData.dispose(); }
      if (scenery) { land = createTerrain(g, scenery); scene.add(land); }
      const world = worldFor(g), grid = fogFor(g);
      fogBytes = new Uint8Array(grid.cols * grid.rows * 4); fogTexture?.dispose();
      fogTexture = new THREE.DataTexture(fogBytes, grid.cols, grid.rows); fogTexture.magFilter = fogTexture.minFilter = THREE.LinearFilter;
      fog.material.map = fogTexture; fog.material.needsUpdate = true;
      fog.scale.set(grid.cols * grid.cell / 12, grid.rows * grid.cell / 12, 1);
      fog.position.set((grid.cols * grid.cell - world.w) / 24, .48, (grid.rows * grid.cell - world.h) / 24);
      lastFog = null; terrainGame = g;
    }
    const explosionTexture = new THREE.TextureLoader().load("/assets/earth2/Vfx_Explosion.png");
    const resize = () => { renderer.setSize(el.clientWidth, el.clientHeight); camera.aspect = el.clientWidth / el.clientHeight; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(el); resize();
    Promise.all([
      loader.loadAsync("/models/environment.glb").then(gltf => { if (!disposed) { scenery = extractScenery(gltf.scene); rebuildWorld(game.current); } }),
      ...["tank", "enemy", "harvester", "infantry"].map(async name => { const gltf = await loader.loadAsync("/models/" + name + ".glb"); templates[name] = gltf.scene; }),
      ...["headquarters", "barracks", "factory", "airfield", "aircraft"].map(async name => {
        const asset = name === "aircraft" ? "Aircraft" : BUILDINGS[name].asset;
        const gltf = await loader.loadAsync("/models/earth2/" + asset + ".glb");
        templates[name] = normalizeModel(gltf.scene, name === "aircraft" ? 5 : BUILDINGS[name].radius * 1.8 / 12);
      }),
    ]).then(() => { if (!disposed) { apiRef.current?.home(); onReady(true); } }).catch(e => { if (!disposed) onReady(false, String(e)); });
    function project(u) {
      const v = pos(u); v.y += typeof u.id === "string" ? 5 : 2; v.project(camera);
      return { x: (v.x + 1) * el.clientWidth / 2, y: (1 - v.y) * el.clientHeight / 2, visible: v.z < 1 && v.z > -1 && v.x > -1.2 && v.x < 1.2 };
    }
    function pick(e) {
      const r = el.getBoundingClientRect(); mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      ray.setFromCamera(mouse, camera); const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(plane, p)) return null;
      const world = worldFor(game.current); return { x: p.x * 12 + world.w / 2, y: p.z * 12 + world.h / 2 };
    }
    function hit(e, p) {
      const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, g = game.current;
      const u = g.units.filter(u => isVisible(g, u)).map(u => ({ u, p: project(u) })).filter(v => v.p.visible && Math.hypot(v.p.x - x, v.p.y - y) < 28).sort((a, b) => Math.hypot(a.p.x - x, a.p.y - y) - Math.hypot(b.p.x - x, b.p.y - y))[0]?.u;
      return u || g.buildings.find(b => b.hp > 0 && isVisible(g, b) && distance(b, p) < BUILDINGS[b.type].radius);
    }
    const clearMode = () => { modeRef.current = null; onMode(null); };
    function perform(e, p) {
      const g = game.current, mode = modeRef.current; if (!p || g.result) return;
      const entity = hit(e, p), ore = g.ores.find(o => distance(o, p) < 65);
      if (mode?.kind === "build") {
        const b = placeBuilding(g, mode.type, p, mode.rotation || 0);
        if (b) { if (g.sound) audio.play("Sfx_Build"); onInspect(b.id); clearMode(); }
        return;
      }
      if (mode?.kind === "rally") { if (setRally(g, mode.id, p)) clearMode(); return; }
      if (mode?.kind === "scan") { if (activateAbility(g, "scan", p)) clearMode(); return; }
      const kind = mode?.kind;
      let ok;
      if (kind === "guard") ok = entity?.team === "blue" && issueOrder(g, selectedRef.current, "guard", entity, e.shiftKey);
      else if (kind === "move" || kind === "patrol") ok = issueOrder(g, selectedRef.current, kind, p, e.shiftKey);
      else if (entity?.team === "gold") ok = issueOrder(g, selectedRef.current, "attack", entity, e.shiftKey);
      else if (kind === "attack") ok = issueOrder(g, selectedRef.current, "attack", p, e.shiftKey);
      else if (ore) ok = issueOrder(g, selectedRef.current, "harvest", ore, e.shiftKey);
      else ok = issueOrder(g, selectedRef.current, "move", p, e.shiftKey);
      if (ok) { clearMode(); if (g.sound) audio.play("Sfx_MoveOrder"); }
    }
    const marquee = document.createElement("div"); marquee.className = "marquee"; el.appendChild(marquee);
    const down = e => { audio.unlock(); if (e.button === 0) drag = { x: e.offsetX, y: e.offsetY, shift: e.shiftKey }; };
    const up = e => {
      if (e.button !== 0 || !drag) return;
      const start = drag; drag = null; marquee.style.display = "none";
      const p = pick(e); if (!p) return;
      if (modeRef.current) { perform(e, p); return; }
      let ids = [];
      if (Math.hypot(e.offsetX - start.x, e.offsetY - start.y) > 8) {
        ids = game.current.units.filter(u => { const q = project(u); return u.team === "blue" && q.visible && q.x >= Math.min(start.x, e.offsetX) && q.x <= Math.max(start.x, e.offsetX) && q.y >= Math.min(start.y, e.offsetY) && q.y <= Math.max(start.y, e.offsetY); }).map(u => u.id);
      } else {
        const entity = hit(e, p);
        if (entity?.team === "blue" && typeof entity.id === "string") { onInspect(entity.id); return; }
        if (entity?.team === "blue") ids = [entity.id];
        else if (game.current.ores.some(o => distance(o, p) < 65)) { onInspect("resources"); return; }
      }
      onSelect(start.shift ? [...new Set([...selectedRef.current, ...ids])] : ids);
    };
    const menu = e => { e.preventDefault(); if (modeRef.current?.kind === "build") { clearMode(); return; } perform(e, pick(e)); };
    const motion = e => {
      pointerScreen = { clientX: e.clientX, clientY: e.clientY };
      pointer = pick(e);
      if (drag && !modeRef.current) Object.assign(marquee.style, { display: "block", left: Math.min(drag.x, e.offsetX) + "px", top: Math.min(drag.y, e.offsetY) + "px", width: Math.abs(drag.x - e.offsetX) + "px", height: Math.abs(drag.y - e.offsetY) + "px" });
    };
    const leave = () => { pointer = null; pointerScreen = null; };
    const clear = () => { drag = null; marquee.style.display = "none"; };
    const keys = new Set();
    const keydown = e => { if (!e.ctrlKey && !e.metaKey && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) keys.add(e.key.toLowerCase()); };
    const keyup = e => keys.delete(e.key.toLowerCase());
    const blur = () => { keys.clear(); clear(); };
    const bindings = [["pointerdown", down], ["pointerup", up], ["contextmenu", menu], ["pointermove", motion], ["pointerleave", leave]];
    bindings.forEach(([name, fn]) => renderer.domElement.addEventListener(name, fn));
    window.addEventListener("pointerup", clear); window.addEventListener("keydown", keydown); window.addEventListener("keyup", keyup); window.addEventListener("blur", blur);
    apiRef.current = {
      home() { const g = game.current; controls.target.copy(pos({ x: g.home.x + 470, y: g.home.y - 250 })); camera.position.copy(controls.target).add(new THREE.Vector3(18, 80, 92)); },
      reset() { this.home(); },
      tactical() { const world = worldFor(game.current); controls.target.set(0, 0, 0); const extent = Math.max(world.w / 12 / camera.aspect, world.h / 12); camera.position.set(0, extent * 1.55, extent * .38); },
      zoom(n) { const offset = camera.position.clone().sub(controls.target).multiplyScalar(n); if (offset.length() > 28 && offset.length() < 460) camera.position.copy(controls.target).add(offset); },
      focus(x, y) { const target = pos({ x, y }); camera.position.add(target.clone().sub(controls.target)); controls.target.copy(target); },
      unlockAudio() { audio.unlock(); },
      project(x, y) { return project({ x, y }); },
    };
    function disposeEntity(object) {
      scene.remove(object);
      object.traverse(part => {
        if (part.material?.userData?.ownedByEntity || part.name === "selection" || part.name === "hp" || part.userData.ownedOutline)
          part.material?.dispose();
        if (part.name === "selection" || part.userData.ownedOutline) part.geometry?.dispose();
      });
    }
    function clearFx() { while (fx.children.length) { const o = fx.children[0]; fx.remove(o); o.geometry?.dispose(); o.material?.dispose(); } }
    function animate(now) {
      if (disposed) return; frame = requestAnimationFrame(animate);
      const dt = Math.min((now - last) / 1000, .08); last = now;
      const g = game.current; update(g, dt);
      if (terrainGame !== g) rebuildWorld(g); land?.userData.animate(g.time);
      if (lastGame !== g) { units.forEach(disposeEntity); units.clear(); structures.forEach(disposeEntity); structures.clear(); minerals.forEach(o => { scene.remove(o); o.traverse(v => { v.geometry?.dispose(); v.material?.dispose(); }); }); minerals.clear(); seenFx.clear(); dustParticles.length = 0; pointer = pointerScreen = null; clear(); if (ghost) ghost.visible = false; lastGame = g; }
      const pan = new THREE.Vector3((keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0), 0, (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0)).multiplyScalar(dt * Math.max(25, camera.position.distanceTo(controls.target) * .3));
      controls.target.add(pan); camera.position.add(pan);
      const world = worldFor(g), before = controls.target.clone(); controls.target.x = THREE.MathUtils.clamp(controls.target.x, -world.w / 24, world.w / 24); controls.target.z = THREE.MathUtils.clamp(controls.target.z, -world.h / 24, world.h / 24); camera.position.add(controls.target.clone().sub(before)); controls.update();
      if (pointerScreen) pointer = pick(pointerScreen);
      sun.position.copy(controls.target).add(new THREE.Vector3(-80, 140, 65)); sun.target.position.copy(controls.target);
      for (const u of g.units) {
        let group = units.get(u.id);
        if (!group && templates[u.type]) {
          group = new THREE.Group(); const model = finishModel(templates[u.type].clone(), u.type, u.team);
          if (!["aircraft", "boat"].includes(u.type)) model.scale.setScalar(u.type === "infantry" ? 1.65 : 1.6);
          group.add(model); group.userData.body = model;
          const selection = ring(3.1, u.team === "blue" ? 0x68dbff : 0xf1af63); selection.name = "selection"; group.add(selection);
          const bar = new THREE.Sprite(new THREE.SpriteMaterial({ color: u.team === "blue" ? 0x77e8cb : 0xf3a06d, depthTest: false }));
          bar.name = "hp"; bar.scale.set(3, .17, 1); bar.position.y = 4; group.add(bar); scene.add(group); units.set(u.id, group);
        }
        if (!group) continue;
        const old = group.position.clone(); group.position.copy(pos(u)); group.visible = isVisible(g, u);
        if (old.distanceTo(group.position) > .001) {
          group.userData.body.rotation.y = Math.atan2(group.position.x - old.x, group.position.z - old.z) + Math.PI;
          if (!g.paused && group.visible && !["infantry", "aircraft", "boat"].includes(u.type) && Math.random() < .28 && dustParticles.length < 160) dustParticles.push({ x: group.position.x + (Math.random() - .5) * 1.5, y: .5, z: group.position.z, life: 1.5 });
        }
        group.getObjectByName("selection").visible = selectedRef.current.includes(u.id) || u.team === "gold";
        group.getObjectByName("hp").scale.x = 3 * Math.max(0, u.hp / u.maxHp); group.getObjectByName("hp").visible = selectedRef.current.includes(u.id) || u.hp < u.maxHp;
      }
      for (const [id, obj] of units) if (!g.units.some(u => u.id === id)) { disposeEntity(obj); units.delete(id); }
      for (const b of g.buildings) {
        let group = structures.get(b.id);
        if (!group && templates[b.type]) {
          group = new THREE.Group(); const model = finishModel(templates[b.type].clone(), b.type, b.team); const body = new THREE.Group(); body.add(model); group.add(body); group.userData.body = body;
          const outline = ring(BUILDINGS[b.type].radius / 12, b.team === "blue" ? 0x68dbff : 0xf1af63); outline.userData.ownedOutline = true; group.add(outline);
          scene.add(group); structures.set(b.id, group); group.position.copy(pos(b)); group.rotation.y = b.rotation || 0;
        }
        if (group) {
          group.visible = b.hp > 0 && isVisible(g, b);
          group.userData.body.scale.y = b.remaining > 0 ? Math.max(.1, 1 - b.remaining / b.total) : 1;
        }
      }
      for (const o of g.ores) {
        let group = minerals.get(o.id);
        if (!group) {
          group = new THREE.Group(); group.position.copy(pos(o)); const outline = ring(5, 0xffc168, .17); group.add(outline); group.userData.outline = outline;
          for (let i = 0; i < 7; i++) {
            const crystal = new THREE.Mesh(new THREE.ConeGeometry(.65, 2 + i * .4, 5), new THREE.MeshStandardMaterial({ color: 0xe6b054, emissive: 0x6e3505, emissiveIntensity: .65, metalness: .25, roughness: .35 }));
            crystal.position.set(Math.cos(i * 2.4) * 1.6, 1 + i * .2, Math.sin(i * 2.4) * 1.6); crystal.castShadow = true; group.add(crystal);
          }
          scene.add(group); minerals.set(o.id, group);
        }
        group.visible = isExplored(g, o); group.userData.outline.material.color.set(o.team === "blue" && isVisible(g, o) ? 0x67e2f8 : o.team === "gold" && isVisible(g, o) ? 0xff936b : 0xe6b054);
      }
      fog.visible = g.fog;
      if (lastFog !== g.visible) {
        for (let i = 0; i < fogBytes.length / 4; i++) { fogBytes[i * 4] = 8; fogBytes[i * 4 + 1] = 19; fogBytes[i * 4 + 2] = 24; fogBytes[i * 4 + 3] = g.visible[i] ? 0 : g.explored[i] ? 100 : 232; }
        fogTexture.needsUpdate = true; lastFog = g.visible;
      }
      const mode = modeRef.current;
      if (mode?.kind === "build" && templates[mode.type]) {
        if (ghostType !== mode.type) {
          if (ghost) { scene.remove(ghost); ghost.traverse(o => o.material?.dispose()); }
          ghost = templates[mode.type].clone(); ghost.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = .55; o.castShadow = false; } });
          scene.add(ghost); ghostType = mode.type;
        }
        ghost.visible = !!pointer;
        if (pointer) {
          ghost.position.copy(pos(pointer)); ghost.rotation.y = mode.rotation || 0;
          const valid = !placementReason(g, mode.type, pointer);
          ghost.traverse(o => { if (o.isMesh) o.material.color.set(valid ? 0x76f5cf : 0xff655c); });
        }
      } else if (ghost) { ghost.visible = false; }
      clearFx();
      for (let i = dustParticles.length - 1; i >= 0; i--) { const particle = dustParticles[i]; if (!g.paused) { particle.life -= dt; particle.y += dt * .6; particle.x -= dt * .5; } if (particle.life <= 0) dustParticles.splice(i, 1); }
      dustParticles.forEach((particle, i) => { dustPositions[i * 3] = particle.x; dustPositions[i * 3 + 1] = particle.y; dustPositions[i * 3 + 2] = particle.z; }); dustGeometry.setDrawRange(0, dustParticles.length); dustGeometry.attributes.position.needsUpdate = true;
      for (const u of g.units.filter(u => selectedRef.current.includes(u.id) && u.team === "blue" && u.target)) {
        const points = [pos(u), ...(u.path?.length ? u.path.slice(0, 40) : [u.target]).map(p => pos(p)), ...u.pending.filter(p => p.target).map(p => pos(p.target))]; points.forEach(p => p.y = .65);
        if (points.length > 1) { const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineDashedMaterial({ color: u.order === "attack" ? 0xf2c38d : 0x8cdbcc, dashSize: 1, gapSize: .75, transparent: true, opacity: .5, depthWrite: false })); line.computeLineDistances(); fx.add(line); }
      }
      for (const e of g.effects) {
        if (!isVisible(g, e) && !isVisible(g, { x: e.tx, y: e.ty })) continue;
        const a = pos({ ...e, type: e.sourceType }); a.y += 2; const b = pos({ x: e.tx, y: e.ty, type: e.targetType }); b.y += 1;
        fx.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color: e.team === "blue" ? 0x91eeff : 0xffb76c, transparent: true, opacity: e.life / .22 })));
        if (!seenFx.has(e.id)) { seenFx.add(e.id); if (g.sound) audio.play(e.sourceType === "infantry" ? "Sfx_ShotLight" : "Sfx_ShotHeavy"); }
      }
      for (const e of g.explosions) {
        if (!isVisible(g, e)) continue;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: explosionTexture, transparent: true, opacity: Math.min(1, e.life * 2), depthWrite: false }));
        sprite.position.copy(pos(e)); sprite.position.y = 2; sprite.scale.setScalar((e.building ? 10 : 5) * (1.5 - e.life / 2)); fx.add(sprite);
        if (!seenFx.has(e.id)) { seenFx.add(e.id); if (g.sound) audio.play("Sfx_Explosion"); }
      }
      if (seenFx.size > 500) seenFx.clear();
      if (g.marker) {
        const mark = ring(g.marker.scan ? (3 - g.marker.life) * 8 + 1 : 1.2, 0x7de1ff); mark.position.add(pos(g.marker)); fx.add(mark);
      }
      for (const b of g.buildings.filter(b => b.team === "blue" && b.hp > 0 && b.rally)) {
        const mark = ring(1.6, 0xb6e6a3); mark.position.add(pos(b.rally)); fx.add(mark);
      }
      renderer.render(scene, camera); report += dt;
      if (report > .15) {
        report = 0;
        const labels = [...g.buildings.filter(b => b.hp > 0 && isVisible(g, b)), ...g.ores.filter(o => isExplored(g, o))].map(o => ({ ...o, ...project(o), worldX: o.x, worldY: o.y, known: isVisible(g, o) }));
        onFrame({ ...g, units: [...g.units], queue: [...g.queue], buildings: [...g.buildings], labels, cameraView: { x: controls.target.x * 12 + world.w / 2, y: controls.target.z * 12 + world.h / 2, width: Math.min(world.w, camera.position.distanceTo(controls.target) * 9 * camera.aspect), height: Math.min(world.h, camera.position.distanceTo(controls.target) * 9) }, fps: Math.round(1 / Math.max(dt, .001)) });
      }
    }
    frame = requestAnimationFrame(animate);
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); audio.dispose(); clearFx();
      bindings.forEach(([name, fn]) => renderer.domElement.removeEventListener(name, fn));
      window.removeEventListener("pointerup", clear); window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); window.removeEventListener("blur", blur);
      scene.traverse(o => { o.geometry?.dispose(); if (o.material) { const materials = Array.isArray(o.material) ? o.material : [o.material]; materials.forEach(m => m.dispose()); } });
      fogTexture?.dispose(); explosionTexture.dispose(); renderer.dispose(); el.replaceChildren();
    };
  }, []);
  return <div className="battlefield" ref={host} />;
}
