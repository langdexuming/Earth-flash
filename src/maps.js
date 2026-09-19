// Battlefield geometry is shared by simulation, fog, minimap and Three.js terrain.
export const MAP_PRESETS = [
  { id: "Frontier320", name: "边境前线", size: 320, w: 3200, h: 1800, description: "双湖之间的开阔前线，12 处晶矿与南北侧翼。" },
  { id: "TwinLakes280", name: "双湖走廊", size: 280, w: 2800, h: 1575, description: "两座大湖压缩陆路，控制湖岸与中部通道。" },
  { id: "Highland360", name: "高地远征", size: 360, w: 3600, h: 2025, description: "辽阔高地、岩丘与多条包抄路线，扩张资源网络。" },
];
const legacy = { id: "Legacy160", name: "经典战场", size: 160, w: 1600, h: 900, description: "兼容既有战役存档。" };
const point = (x, y) => ({ x, y });
export function createWorld(id = MAP_PRESETS[0].id) {
  const preset = id === legacy.id ? legacy : MAP_PRESETS.find(m => m.id === id);
  if (!preset) throw new Error("未知地图：" + id);
  const { w, h } = preset, sx = w / 3200, sy = h / 1800;
  const p = (x, y) => point(Math.round(x * sx), Math.round(y * sy));
  const world = { ...preset, bounds: { minX: 38, minY: 38, maxX: w - 38, maxY: h - 38 }, water: [], roads: [], obstacles: [], forests: [], landmarks: [], spawns: { blue: p(530, 1456), gold: p(2740, 300) } };
  if (id === legacy.id) {
    world.water = [{ id: "lake-west", name: "西北湖", x: 128, y: -18, rx: 420, ry: 312, rotation: 0 }];
    world.spawns = { blue: point(265, 728), gold: point(1370, 150) };
    return world;
  }
  const lake = (id, name, x, y, rx, ry) => ({ id, name, ...p(x, y), rx: rx * sx, ry: ry * sy, rotation: 0 });
  world.water = [lake("lake-west", "翡翠湖", 570, 450, 430, 300), lake("lake-east", "落日湖", 2530, 1320, 310, 220)];
  if (id === "TwinLakes280") world.water = [lake("lake-west", "翡翠湖", 570, 450, 480, 350), lake("lake-east", "落日湖", 2490, 1280, 400, 270)];
  if (id === "Highland360") world.water[1] = lake("lake-east", "高地水库", 2580, 1320, 245, 170);
  if (id !== "TwinLakes280") world.water.push(lake("lake-south", "南岭池塘", 1460, 1510, 130, 85), lake("lake-northeast", "东北水潭", 3000, 175, 110, 80));
  const road = (id, points, width = 44) => ({ id, width: width * sx, points: points.map(([x, y]) => p(x, y)) });
  world.roads = [
    road("main", [[530,1456],[780,1220],[1110,1080],[1600,910],[2110,610],[2440,570],[2740,300]], 62),
    road("north-flank", [[780,1220],[1080,820],[1100,610],[1150,270],[1780,330],[2110,610]]),
    road("south-flank", [[780,1220],[1350,1300],[1930,1570],[2850,1630],[2980,1070],[2510,860],[2440,570]]),
    road("west-shore", [[320,850],[750,1040],[1080,820],[1100,610]]),
    road("east-crossing", [[1600,910],[2100,1090],[2510,860],[2980,1070]]),
  ];
  const rocks = [[1330,720,62,20],[1770,1170,72,24],[1840,640,56,22],[2360,470,45,15],[470,1080,48,17],[2280,1650,68,26],[1480,420,52,20],[3000,740,44,17]];
  if (id === "Highland360") rocks.push([1500,1460,90,35],[2050,820,72,28],[830,850,60,26],[1270,1600,68,29]);
  world.obstacles = rocks.map(([x,y,radius,height], i) => ({ id: "rock-" + i, kind: "rock", ...p(x,y), radius: radius * sx, height }));
  world.forests = [[260,260,130,170],[870,220,100,130],[430,770,110,70],[920,810,95,75],[1300,560,95,70],[1630,220,110,70],[2070,400,115,70],[2320,970,85,90],[2840,1210,100,130],[1530,1640,100,70],[2050,1450,85,75]].map(([x,y,rx,ry],i) => ({ id: "forest-"+i, ...p(x,y), rx: rx*sx, ry: ry*sy, density: 18 + i%4*4 }));
  world.landmarks = [
    { id: "west-shore", name: "翡翠湖岸", kind: "lake", ...p(550,440) },
    { id: "central-pass", name: "中央前线", kind: "pass", ...p(1600,790) },
    { id: "southern-road", name: "南部侧翼", kind: "road", ...p(1810,1660) },
    { id: "north-ridge", name: "北方高地", kind: "ridge", ...p(1650,250) },
    { id: "eastern-lake", name: id === "Highland360" ? "高地水库" : "落日湖", kind: "lake", ...p(2530,1320) },
  ];
  return world;
}
export function mapPoint(world, x, y) { return { x: x * world.w / 3200, y: y * world.h / 1800 }; }
