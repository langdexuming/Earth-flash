import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { worldFor, isWater } from "./engine.js";

export const battlefieldPosition = (point, world) => new THREE.Vector3((point.x - world.w / 2) / 12, point.type === "aircraft" ? 7 : 0, (point.y - world.h / 2) / 12);
function randomSeed(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function mesh(geometry, material, y = 0) { const object = new THREE.Mesh(geometry, material); object.position.y = y; object.receiveShadow = true; return object; }
function texture(name, x, y) {
  const map = new THREE.TextureLoader().load("/assets/terrain/Terrain_" + name + ".png");
  map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(x, y); map.anisotropy = 8; return map;
}
function distanceToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function ellipseGeometry(lake, scale, world) {
  const shape = new THREE.Shape(), c = Math.cos(lake.rotation || 0), s = Math.sin(lake.rotation || 0);
  for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2, x = Math.cos(a) * lake.rx * scale, y = Math.sin(a) * lake.ry * scale;
    const px = (lake.x + x * c - y * s - world.w / 2) / 12, pz = -(lake.y + x * s + y * c - world.h / 2) / 12;
    if (!i) shape.moveTo(px, pz); else shape.lineTo(px, pz);
  }
  const geometry = new THREE.ShapeGeometry(shape); geometry.rotateX(-Math.PI / 2); return geometry;
}
export function extractScenery(root) {
  root.updateMatrixWorld(true);
  const tree = new THREE.Group(); let trunk;
  root.traverse(o => { if (o.name === "Pine_trunk" || o.name === "Pine trunk") trunk = o; });
  if (!trunk) root.traverse(o => { if (!trunk && /^Pine[ _]trunk/.test(o.name)) trunk = o; });
  if (trunk) {
    const center = new THREE.Vector3(); trunk.getWorldPosition(center);
    root.traverse(o => {
      if (!o.isMesh || !/^Pine/.test(o.name)) return;
      const p = new THREE.Vector3(); o.getWorldPosition(p);
      if (Math.hypot(p.x - center.x, p.z - center.z) > .1) return;
      const part = o.clone(); part.geometry = o.geometry.clone().applyMatrix4(o.matrixWorld); part.geometry.translate(-center.x, 0, -center.z); part.position.set(0, 0, 0); part.rotation.set(0, 0, 0); part.scale.set(1, 1, 1); tree.add(part);
    });
  }
  let rock; root.traverse(o => { if (!rock && o.isMesh && /^Granite/.test(o.name)) { rock = o.clone(); rock.geometry = o.geometry.clone(); rock.position.set(0, 0, 0); } });
  return { tree, rock };
}
function mergeScenery(group) {
  group.updateMatrixWorld(true); const materials = new Map(), output = new THREE.Group();
  group.traverse(o => { if (!o.isMesh) return; const key = o.material.uuid; if (!materials.has(key)) materials.set(key, { material: o.material, geometry: [] }); const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); materials.get(key).geometry.push(geo); });
  for (const { material, geometry } of materials.values()) { const merged = mergeGeometries(geometry); if (merged) { const object = mesh(merged, material); object.castShadow = true; output.add(object); } geometry.forEach(g => g.dispose()); }
  return output;
}
export function createTerrain(game, scenery) {
  const world = worldFor(game), group = new THREE.Group(), vegetation = new THREE.Group();
  const seed = [...world.id].reduce((v, c) => v + c.charCodeAt(0), 739), rand = randomSeed(seed);
  const ground = new THREE.PlaneGeometry(world.w / 12, world.h / 12, 160, 90); ground.rotateX(-Math.PI / 2);
  const colors = [], color = new THREE.Color();
  for (let i = 0; i < ground.attributes.position.count; i++) { const x = ground.attributes.position.getX(i), z = ground.attributes.position.getZ(i); const variation = .90 + Math.sin(x * .061) * Math.cos(z * .079) * .13 + rand() * .09; color.setRGB(variation, variation, variation * .94); colors.push(color.r, color.g, color.b); }
  ground.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  group.add(mesh(ground, new THREE.MeshStandardMaterial({ map: texture("GrassDry", world.w / 130, world.h / 130), color: 0xd9d4a5, vertexColors: true, roughness: .96 })));
  const base = mesh(new THREE.BoxGeometry(world.w / 12, 3.5, world.h / 12), new THREE.MeshStandardMaterial({ color: 0x4d5140, roughness: 1 }), -1.8); group.add(base);
  const roadMaterial = new THREE.MeshStandardMaterial({ map: texture("DirtRoad", 1, 8), color: 0xc4b290, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const road of world.roads || []) for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i], length = Math.hypot(b.x - a.x, b.y - a.y) / 12;
    const strip = mesh(new THREE.PlaneGeometry((road.width || 44) / 12, length + .3), roadMaterial, .025); strip.rotation.set(-Math.PI / 2, 0, Math.atan2(b.x - a.x, b.y - a.y)); strip.position.x = ((a.x + b.x) / 2 - world.w / 2) / 12; strip.position.z = ((a.y + b.y) / 2 - world.h / 2) / 12; group.add(strip);
    for (const side of [-1, 1]) { const track = strip.clone(); track.geometry = new THREE.PlaneGeometry(.14, length); track.material = new THREE.MeshBasicMaterial({ color: 0x7f745e, transparent: true, opacity: .26, depthWrite: false }); track.position.y = .04; const angle = Math.atan2(b.x - a.x, b.y - a.y); track.position.x += Math.cos(angle) * side * .75; track.position.z -= Math.sin(angle) * side * .75; group.add(track); }
  }
  const waterMeshes = [];
  for (const lake of world.water || []) {
    const shore = mesh(ellipseGeometry(lake, 1.055, world), new THREE.MeshStandardMaterial({ color: 0xa8a797, roughness: .88 }), .045); group.add(shore);
    const water = mesh(ellipseGeometry(lake, 1, world), new THREE.MeshStandardMaterial({ color: 0x2a969c, metalness: .34, roughness: .27, transparent: true, opacity: .94 }), .08); group.add(water); waterMeshes.push(water);
    const deep = mesh(ellipseGeometry(lake, .82, world), new THREE.MeshBasicMaterial({ color: 0x236b76, transparent: true, opacity: .2, depthWrite: false }), .09); group.add(deep);
    for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, c = Math.cos(lake.rotation || 0), s = Math.sin(lake.rotation || 0); const dx = Math.cos(a) * lake.rx * 1.05, dy = Math.sin(a) * lake.ry * 1.05; const p = { x: lake.x + dx * c - dy * s, y: lake.y + dx * s + dy * c }; if (p.x < 20 || p.x > world.w - 20 || p.y < 20 || p.y > world.h - 20) continue; addRock(p, 3 + rand() * 9); }
  }
  function addRock(point, size) {
    if (!scenery?.rock) return;
    const object = scenery.rock.clone(); const bounds = new THREE.Box3().setFromObject(object), extent = bounds.getSize(new THREE.Vector3()); object.scale.setScalar(size / 12 / Math.max(extent.x, extent.z, .01)); object.position.copy(battlefieldPosition(point, world)); object.rotation.y = rand() * Math.PI * 2; vegetation.add(object);
  }
  for (const obstacle of world.obstacles || []) { addRock(obstacle, obstacle.radius * 2); for (let i = 0; i < 4; i++) { const a = i * 2.1; addRock({ x: obstacle.x + Math.cos(a) * obstacle.radius * .92, y: obstacle.y + Math.sin(a) * obstacle.radius * .92 }, obstacle.radius * (.24 + rand() * .3)); } }
  for (const forest of world.forests || []) {
    const count = Math.min(110, Math.max(18, Math.round((forest.density || 25) * 1.8)));
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2, radius = Math.sqrt(rand()), p = { x: forest.x + Math.cos(a) * forest.rx * radius, y: forest.y + Math.sin(a) * forest.ry * radius };
      if (p.x < 20 || p.x > world.w - 20 || p.y < 20 || p.y > world.h - 20 || isWater(p.x, p.y, game)) continue;
      if (game.buildings.some(b => Math.hypot(b.x - p.x, b.y - p.y) < 110) || game.ores.some(o => Math.hypot(o.x - p.x, o.y - p.y) < 100)) continue;
      if ((world.roads || []).some(r => r.points.some((b, j) => j && distanceToSegment(p, r.points[j - 1], b) < r.width * .8))) continue;
      if (scenery?.tree.children.length) { const object = scenery.tree.clone(); object.position.copy(battlefieldPosition(p, world)); object.scale.setScalar(.7 + rand() * .7); object.rotation.y = rand() * Math.PI * 2; vegetation.add(object); }
    }
  }
  group.add(mergeScenery(vegetation));
  const boundaryPoints = [[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]].map(([x,z]) => new THREE.Vector3(x * world.w / 24, .15, z * world.h / 24));
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(boundaryPoints), new THREE.LineBasicMaterial({ color: 0x73c2b6, transparent: true, opacity: .32 })));
  group.userData.animate = time => waterMeshes.forEach((water, i) => { water.material.roughness = .25 + Math.sin(time * .4 + i) * .035; });
  group.userData.dispose = () => { const materials = new Set(), textures = new Set(); group.traverse(o => { o.geometry?.dispose(); if (o.material && ![scenery?.rock?.material].includes(o.material)) materials.add(o.material); }); materials.forEach(m => { if (m.map) textures.add(m.map); if (!scenery?.tree.children.some(c => c.material === m)) m.dispose(); }); textures.forEach(t => t.dispose()); };
  return group;
}
