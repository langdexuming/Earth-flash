import * as THREE from "three";
// Earth2 uses a procedural patrol boat too (MockupBoatVisual.cs).
export function boatModel() {
  const root = new THREE.Group();
  const parts = [
    [[0, .28, 0], [1.1, .35, 3.4], 0x29577a], [[0, .48, -.15], [.85, .22, 2.2], 0x668a9a],
    [[0, .72, -.55], [.7, .45, .9], 0x172b36], [[0, 1.05, -.55], [.18, .7, .18], 0x77dfff],
    [[0, .78, .55], [.12, .12, 1.1], 0x192c32], [[0, .22, 1.55], [.55, .18, .55], 0x29577a],
    [[0, .18, -1.65], [.7, .12, .35], 0x172b36],
  ];
  for (const [p, s, color] of parts) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...s), new THREE.MeshStandardMaterial({ color, metalness: .35, roughness: .45 }));
    mesh.position.set(...p); mesh.castShadow = true; root.add(mesh);
  }
  root.scale.setScalar(2); return root;
}
export function shipyardModel() {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0x405b66, metalness: .45, roughness: .6 });
  for (const [x, z, w, d] of [[-3, 0, 1.5, 8], [3, 0, 1.5, 8], [0, 3.5, 7, 1]]) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(w, .6, d), material); dock.position.set(x, .2, z); dock.receiveShadow = true; root.add(dock);
  }
  const boat = boatModel(); boat.scale.setScalar(.8); root.add(boat); return root;
}
export function ring(radius, color, width = .1) {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(radius - width, radius, 48), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: .8, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = .35; return mesh;
}
export function normalizeModel(model, width) {
  const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  const factor = width / Math.max(size.x, size.z);
  model.position.set(-center.x, -bounds.min.y, -center.z);
  const root = new THREE.Group(); root.add(model); root.scale.setScalar(factor);
  model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return root;
}
export function makeAudio() {
  const names = ["Sfx_ShotHeavy", "Sfx_ShotLight", "Sfx_Explosion", "Sfx_Build", "Sfx_MoveOrder"];
  const pool = Object.fromEntries(names.map(n => [n, Array.from({ length: 3 }, () => { const a = new Audio("/audio/" + n + ".wav"); a.volume = .13; return a; })]));
  let unlocked = false;
  return { unlock() { unlocked = true; }, play(name) { if (!unlocked) return; const a = pool[name]?.find(a => a.paused); if (a) { a.currentTime = 0; a.play().catch(() => {}); } }, dispose() { Object.values(pool).flat().forEach(a => { a.pause(); a.removeAttribute("src"); a.load(); }); } };
}

// Only material color changes; the editable source meshes and their textures are retained.
export function finishModel(model, kind, team = "blue") {
  model.traverse(object => {
    if (!object.isMesh) return;
    if (team === "gold") {
      object.material = object.material.clone(); object.material.userData.ownedByEntity = true;
      if (object.material.map) {
        object.material.onBeforeCompile = shader => {
          shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\nfloat factionBlue = smoothstep(0.02, 0.18, diffuseColor.b - diffuseColor.r); float factionLight = dot(diffuseColor.rgb, vec3(0.299,0.587,0.114)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.12,0.83,0.43) * factionLight, factionBlue * 0.85);");
        };
        object.material.customProgramCacheKey = () => "earth-gold-faction";
      } else if (/Alliance|ceramic/.test(object.material.name)) object.material.color.set(0x9e8150);
    } else if (["tank", "harvester"].includes(kind) && /Alliance|ceramic/.test(object.material.name)) {
      object.material = object.material.clone(); object.material.userData.ownedByEntity = true; object.material.color.set(0x66704a);
    }
  });
  return model;
}
