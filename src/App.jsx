import React, { useState, useRef, useEffect } from "react";
import { Crosshair, Diamond, Lightning, UsersThree, Pause, Play, ArrowCounterClockwise, Plus, Minus, House, Target, ShieldChevron, NavigationArrow, Flag, Factory, Info, X, ArrowsOut, Check, Mouse, GlobeHemisphereWest, Wrench, FloppyDisk, FolderOpen, SpeakerHigh, SpeakerSlash, Binoculars, CirclesThreePlus, Path, HandPalm, Atom, Anchor, AirplaneTilt } from "@phosphor-icons/react";
import { Battlefield } from "./Battlefield.jsx";
import { createGame, issueOrder, enqueue, TYPES, BUILDINGS, TECHS, ABILITIES, ORDERS, economy, productionReason, cancelProduction, repairBuilding, startResearch, activateAbility, serializeGame, restoreGame, message, isVisible, isExplored, isWater } from "./engine.js";
const formatTime = t => Math.floor(t / 60).toString().padStart(2, "0") + ":" + Math.floor(t % 60).toString().padStart(2, "0");
const unitImage = type => type === "aircraft" ? "/assets/earth2/Thumb_Aircraft.png" : "/assets/" + type + ".png";
const buildImage = type => BUILDINGS[type].asset ? "/assets/earth2/Thumb_" + BUILDINGS[type].asset + ".png" : null;
const SAVE_KEY = "frontier-earth2-save-v2";
function Portrait({ type, building = false }) {
  if (type === "boat" || type === "shipyard") return <Anchor className="naval-portrait" weight="duotone" />;
  return <img src={building ? buildImage(type) : unitImage(type)} alt="" />;
}
function Radar({ state, api, game, selectedRef }) {
  const canvas = useRef(null);
  useEffect(() => {
    const c = canvas.current, ctx = c.getContext("2d"), w = c.width, h = c.height;
    ctx.fillStyle = "#425443"; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < 23; y++) for (let x = 0; x < 40; x++) {
      if (isWater(x * 40 + 20, y * 40 + 20)) { ctx.fillStyle = "#287886"; ctx.fillRect(x * w / 40, y * 40 * h / 900, w / 40 + 1, 40 * h / 900 + 1); }
      if (state.fog && !state.visible[y * 40 + x]) { ctx.fillStyle = state.explored[y * 40 + x] ? "#0b181c80" : "#081318ed"; ctx.fillRect(x * w / 40, y * 40 * h / 900, w / 40 + 1, 40 * h / 900 + 1); }
    }
    for (const o of state.ores) if (isExplored(state, o)) {
      ctx.fillStyle = isVisible(state, o) && o.team === "blue" ? "#7de0f0" : isVisible(state, o) && o.team === "gold" ? "#ed9f6a" : "#dfb77d";
      ctx.save(); ctx.translate(o.x / 1600 * w, o.y / 900 * h); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore();
    }
    for (const b of state.buildings) if (b.hp > 0 && isVisible(state, b)) { ctx.fillStyle = b.team === "blue" ? "#b0eaf6" : "#ff9c71"; ctx.fillRect(b.x / 1600 * w - 3, b.y / 900 * h - 3, 6, 6); }
    for (const u of state.units) if (isVisible(state, u)) {
      ctx.fillStyle = u.team === "blue" ? "#75dfff" : "#ffa172"; ctx.beginPath(); ctx.arc(u.x / 1600 * w, u.y / 900 * h, selectedRef.current.includes(u.id) ? 2.5 : 1.7, 0, Math.PI * 2); ctx.fill();
    }
  }, [state]);
  return <button className="minimap" aria-label="战术地图：左键定位，右键移动所选部队" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); api.current?.focus((e.clientX - r.left) / r.width * 1600, (e.clientY - r.top) / r.height * 900); }} onContextMenu={e => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); issueOrder(game.current, selectedRef.current, "move", { x: (e.clientX - r.left) / r.width * 1600, y: (e.clientY - r.top) / r.height * 900 }, e.shiftKey); }}>
    <canvas width="400" height="225" ref={canvas} />
  </button>;
}
export function App() {
  const game = useRef(null), selectedRef = useRef([1, 2, 3]), api = useRef(null), modeRef = useRef(null), buildingRef = useRef("factory-1");
  if (!game.current) { game.current = createGame(); game.current.paused = true; }
  const [state, setState] = useState(game.current), [selected, setSelected] = useState([1, 2, 3]), [panel, setPanel] = useState("units"),
    [help, setHelp] = useState(true), [ready, setReady] = useState(false), [error, setError] = useState(""), [mode, setModeState] = useState(null), [buildingId, setBuildingId] = useState("factory-1");
  const refresh = () => setState({ ...game.current });
  const setMode = value => { modeRef.current = value; setModeState(value); };
  const select = ids => { selectedRef.current = ids; setSelected(ids); setPanel("units"); };
  const inspect = id => { if (id === "resources") setPanel(id); else { buildingRef.current = id; setBuildingId(id); setPanel("production"); } };
  const all = () => select(game.current.units.filter(u => u.team === "blue" && u.type !== "harvester").map(u => u.id));
  const command = order => {
    if (["move", "attack", "patrol", "guard"].includes(order)) { setMode({ kind: order }); return; }
    if (order === "harvest") {
      const ids = game.current.units.filter(u => u.type === "harvester" && u.team === "blue").map(u => u.id);
      issueOrder(game.current, ids, "harvest"); select(ids);
    } else { setMode(null); issueOrder(game.current, selectedRef.current, order); }
    refresh();
  };
  const pause = () => { if (!game.current.result) { game.current.paused = !game.current.paused; refresh(); } };
  const restart = () => { game.current = createGame(); select([1, 2, 3]); setMode(null); buildingRef.current = "factory-1"; setBuildingId("factory-1"); api.current?.reset(); refresh(); };
  const save = () => { try { localStorage.setItem(SAVE_KEY, serializeGame(game.current)); message(game.current, "对局已保存到此浏览器。"); } catch { message(game.current, "存档失败：浏览器存储不可用。"); } refresh(); };
  const load = () => {
    try { const data = localStorage.getItem(SAVE_KEY); if (!data) throw new Error("尚无本地存档"); game.current = restoreGame(data); setMode(null); select(game.current.units.filter(u => u.team === "blue").slice(0, 3).map(u => u.id)); api.current?.reset(); }
    catch (e) { message(game.current, e.message); } refresh();
  };
  const ability = id => { if (id === "scan") setMode({ kind: "scan" }); else activateAbility(game.current, id); refresh(); };
  useEffect(() => {
    const key = e => {
      if (e.repeat || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase(), modifier = e.ctrlKey || e.metaKey;
      if (modifier && k === "s") { e.preventDefault(); save(); return; }
      if (modifier && k === "l") { e.preventDefault(); load(); return; }
      if (/^[1-9]$/.test(k) && modifier) { e.preventDefault(); game.current.groups[k] = [...selectedRef.current]; message(game.current, "编队 " + k + " 已保存。"); refresh(); return; }
      if (modifier) return;
      if (k === "escape") { setMode(null); setHelp(false); return; }
      if (e.code === "Space") { e.preventDefault(); pause(); }
      if (/^[1-9]$/.test(k)) {
        if (game.current.groups[k]?.length) select(game.current.groups[k].filter(id => game.current.units.some(u => u.id === id)));
        else if (k === "1") all(); else if (k === "2") command("harvest");
      }
      if (k === "h") api.current?.home();
      if (k === "v") api.current?.tactical();
      if (k === "f") command("attack"); if (k === "p") command("patrol"); if (k === "g") command("guard");
      if (k === "x") command("idle");
      if (k === "t") command("retreat");
      if (k === "r") { if (modeRef.current?.kind === "build") setMode({ ...modeRef.current, rotation: (modeRef.current.rotation || 0) + Math.PI / 2 }); else command("hold"); }
      if (k === "z") ability("scan"); if (k === "c") ability("overcharge");
      if (k === "y") setMode({ kind: "rally", id: buildingRef.current });
      const buildKeys = { b: "barracks", n: "factory", m: "airfield", k: "shipyard" };
      if (buildKeys[k]) { setMode({ kind: "build", type: buildKeys[k] }); setPanel("buildings"); }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, []);
  const chosen = state.units.filter(u => selected.includes(u.id) && u.team === "blue"), troops = state.units.filter(u => u.team === "blue"),
    e = economy(state), selectedBuilding = state.buildings.find(b => b.id === buildingId && b.hp > 0),
    baseKnown = isVisible(state, state.enemyBase), baseHp = Math.max(0, Math.round(state.enemyBase.hp / state.enemyBase.maxHp * 100)),
    activeBuildings = state.buildings.filter(b => b.team === "blue" && b.hp > 0);
  const enter = () => { setHelp(false); game.current.paused = false; api.current?.unlockAudio(); refresh(); };
  const modes = { move: "移动：点击目的地", attack: "攻击：点击地面推进，或点击敌军集火", patrol: "巡逻：点击另一端，部队将往返警戒", guard: "护卫：点击一支友军或友方建筑", rally: "集结点：点击生产完成后的目的地", scan: "战术扫描：点击要揭示的区域" };
  return <main className="game-shell">
    <header className="topbar">
      <div className="brand"><Crosshair weight="duotone" size={29} /><div><strong>FRONTIER<span> / </span>前线指令</strong><small>EARTH OPERATIONS · SECTOR 07</small></div></div>
      <div className="resources">
        <div><Diamond weight="duotone" /><span><b data-testid="credits">{Math.floor(state.credits).toLocaleString()}</b><small>晶矿 +{e.credits}/3s</small></span></div>
        <div><CirclesThreePlus weight="duotone" /><span><b>{Math.floor(state.alloy).toLocaleString()}</b><small>合金 +{e.alloy}/3s</small></span></div>
        <div className={e.demand > e.supply ? "low-power" : ""} title={"供电 " + e.supply + " / 负载 " + e.demand + "；供电不足时生产减半"}><Lightning weight="duotone" /><span><b>{e.energy}%</b><small>{e.demand > e.supply ? "低电量 · 生产减半" : "电力余量"}</small></span></div>
        <div><UsersThree weight="duotone" /><span><b>{e.population}<i> / {e.cap}</i></b><small>部队 / 人口上限</small></span></div>
      </div>
      <div className="top-actions"><span className="clock">{formatTime(state.time)}</span>
        <button className="icon-button" onClick={pause} title="空格：暂停 / 继续" aria-label={state.paused ? "继续游戏" : "暂停游戏"}>{state.paused ? <Play /> : <Pause />}</button>
        <button className="icon-button" onClick={save} title="保存对局 · Ctrl/⌘ S" aria-label="保存对局"><FloppyDisk /></button>
        <button className="icon-button" onClick={load} title="载入对局 · Ctrl/⌘ L" aria-label="载入对局"><FolderOpen /></button>
        <button className="icon-button" onClick={() => { game.current.sound = !game.current.sound; api.current?.unlockAudio(); refresh(); }} aria-label={state.sound ? "关闭音效" : "开启音效"}>{state.sound ? <SpeakerHigh /> : <SpeakerSlash />}</button>
        <button className="icon-button" onClick={() => { setHelp(true); game.current.paused = true; refresh(); }} aria-label="操作说明"><Info /></button>
      </div>
    </header>
    <section className="play-area">
      <Battlefield game={game} selectedRef={selectedRef} onSelect={select} onFrame={setState} onReady={(ok, err) => { setReady(ok); if (err) setError(err); }} apiRef={api} onInspect={inspect} modeRef={modeRef} onMode={setMode} />
      <div className="mission panel">
        <div className="eyebrow"><span className="live-dot" /> OPERATION DAWN <span>07</span></div>
        <h1>曙光行动</h1><p>争夺矿区，建立陆海空优势。</p>
        <div className="mission-divider" />
        <div className="objective"><Target size={17} /><div>摧毁敌方指挥中心<small>北部高地 · 需要侦察</small></div><span>{baseKnown ? baseHp + "%" : "未知"}</span></div>
        <div className="progress amber"><span style={{ width: (baseKnown ? baseHp : 100) + "%" }} /></div>
        <div className={"sub-objective " + (e.controlled >= 2 ? "complete" : "")}><Check size={15} /> 控制两处矿区 <span>{Math.min(2, e.controlled)}/2</span></div>
        <div className="enemy-logistics">{[["enemy-factory", "压制地面增援", "摧毁工厂：增援上限降至 2 支，间隔延长至 75 秒"], ["enemy-airfield", "切断空军增援", "摧毁空军基地：敌军无法再增援战机"]].map(([id, label, hint]) => {
          const facility = state.buildings.find(b => b.id === id);
          return facility && <button key={id} title={hint} onClick={() => api.current?.focus(facility.x, facility.y)} className={facility.hp <= 0 ? "complete" : ""}><span>{facility.hp <= 0 ? <Check /> : <Target />}{label}</span><small>{facility.hp <= 0 ? "已摧毁" : isVisible(state, facility) ? Math.ceil(facility.hp / facility.maxHp * 100) + "%" : "待侦察"}</small></button>;
        })}</div>
        <div className="wave-info">敌军增援 <b>{formatTime(Math.max(0, state.waveAt - state.time))}</b></div>
        <button className="assault" onClick={() => { const ids = troops.filter(u => u.type !== "harvester" && u.type !== "boat").map(u => u.id); select(ids); issueOrder(game.current, ids, "attack", { x: state.enemyBase.x - 100, y: state.enemyBase.y + 100 }); }}>向北部高地推进 <NavigationArrow size={13} /></button>
      </div>
      <div className="sector"><GlobeHemisphereWest size={15} /> 林海边境 <span>迷雾侦察 · 联合作战</span></div>
      <div className="world-labels" aria-hidden="true">
        {Array.isArray(state.labels) && state.labels.filter(p => p.visible).map(p => <div key={p.id} className={"world-label " + (p.team === "gold" ? "base" : p.type ? "home" : "ore")} style={{ left: p.x, top: p.y - 15 }}>
          {p.type ? BUILDINGS[p.type].name : p.name}<span>{p.type ? p.remaining > 0 ? "施工 " + Math.ceil(p.remaining) + "s" : Math.ceil(p.hp) + " HP" : !p.known ? "待侦察" : p.contested ? "争夺中" : p.team === "blue" ? "我方控制" : p.team === "gold" ? "敌方控制" : "中立矿区"}</span>
        </div>)}
      </div>
      <div className="camera-tools">
        <button onClick={() => api.current?.zoom(.82)} aria-label="放大视角"><Plus /></button><button onClick={() => api.current?.zoom(1.22)} aria-label="缩小视角"><Minus /></button><span />
        <button onClick={() => api.current?.home()} aria-label="返回基地"><House /></button><button onClick={() => api.current?.tactical()} aria-label="战术俯视 V"><Binoculars /></button><button onClick={() => api.current?.reset()} aria-label="重置视角"><ArrowsOut /></button>
      </div>
      <div className="comms"><span className="live-dot" /><span>指挥频道</span><p aria-live="polite">{state.events[0]}</p></div>
      {mode && <div className="mode-toast">{mode.kind === "build" ? "放置" + BUILDINGS[mode.type].name + "：绿色可建 · R 旋转 · 右键取消" : modes[mode.kind]}<button onClick={() => setMode(null)}>取消 Esc</button></div>}
      {!ready && <div className="loading"><Crosshair size={36} /><h2>{error ? "战场载入失败" : "正在建立战场连接"}</h2><p>{error || "载入地形、作战单位与基地设施…"}</p>{error && <button onClick={() => location.reload()}>重新载入</button>}</div>}
      {state.paused && !help && !state.result && <div className="pause-badge"><Pause /> 战术暂停 · 可规划指令 <button onClick={pause}>继续游戏</button></div>}
    </section>
    <footer className="command-deck">
      <section className="radar-panel">
        <div className="deck-heading"><span>战术地图</span><small>LIVE INTEL</small></div>
        <Radar state={state} api={api} game={game} selectedRef={selectedRef} />
        <div className="map-caption"><span className="live-dot" /> 矿区 {e.controlled}/4 <span>右键下令</span></div>
        <div className="group-strip">{[1, 2, 3, 4].map(n => <button key={n} title={"Ctrl/⌘ " + n + " 保存编队；点击调用"} onClick={() => { const ids = state.groups[n]; if (ids?.length) select(ids.filter(id => troops.some(u => u.id === id))); else { game.current.groups[n] = [...selectedRef.current]; message(game.current, "编队 " + n + " 已保存。"); refresh(); } }}><kbd>{n}</kbd><span>{(state.groups[n] || []).filter(id => troops.some(u => u.id === id)).length || "—"}</span></button>)}</div>
      </section>
      <section className="selection-panel">
        <div className="deck-heading"><span>{{ units: "编队控制", production: "基地生产", buildings: "基地建设", resources: "资源调度", tech: "科技研究" }[panel]}</span><small>{panel === "units" ? chosen.length + " 支已选择" : "ALLIANCE COMMAND"}</small></div>
        <div className="deck-tabs">
          {[["units", ShieldChevron, "部队"], ["production", Factory, "生产"], ["buildings", Wrench, "建设"], ["resources", Diamond, "矿区"], ["tech", Atom, "科技"]].map(([id, Icon, text]) => <button key={id} className={panel === id ? "active" : ""} onClick={() => setPanel(id)}><Icon />{text}</button>)}
        </div>
        <div className="deck-content">
          {panel === "units" && <>
            <div className="unit-cards">{(chosen.length ? chosen : troops).map(u => <button key={u.id} aria-label={"选择" + TYPES[u.type].name + " " + u.id} title={TYPES[u.type].name + " · " + Math.ceil(u.hp) + "/" + u.maxHp + " HP · " + ORDERS[u.order]} className={"unit-card " + (selected.includes(u.id) ? "selected" : "")} onClick={() => select([u.id])}>
              <Portrait type={u.type} /><span>{TYPES[u.type].name}</span><div className="progress"><span style={{ width: u.hp / u.maxHp * 100 + "%" }} /></div><small>{ORDERS[u.order]}{u.pending.length ? " +" + u.pending.length : ""}{u.type === "harvester" ? " " + u.cargo + "/80" : ""}</small>
            </button>)}</div>
            <div className="selection-caption"><span>{chosen.length === 1 ? Math.ceil(chosen[0].hp) + "/" + chosen[0].maxHp + " HP · 射程 " + TYPES[chosen[0].type].range : "Shift 连续下令 · Ctrl/⌘ 数字保存编队"}</span><button disabled={!chosen.some(u => u.hp < u.maxHp) || !!state.result} title="返回对应生产设施；脱战 4 秒后每秒恢复 24 HP，每 8 HP 消耗 1 合金。新指令可取消维修。" onClick={() => command("retreat")}>撤回维修 <kbd>T</kbd></button><button onClick={all}>全选战斗单位 <kbd>1</kbd></button></div>
          </>}
          {panel === "production" && <>
            <div className="producer-toolbar"><label>生产设施 <select aria-label="选择生产设施" value={selectedBuilding?.id || ""} onChange={ev => { buildingRef.current = ev.target.value; setBuildingId(ev.target.value); }}>
              {!selectedBuilding && <option value="">选择设施</option>}{activeBuildings.map(b => <option key={b.id} value={b.id}>{BUILDINGS[b.type].name} {activeBuildings.filter(v => v.type === b.type).findIndex(v => v.id === b.id) + 1}{b.remaining > 0 ? " · 施工中" : ""}</option>)}</select></label>
              <button disabled={!selectedBuilding} onClick={() => api.current?.focus(selectedBuilding.x, selectedBuilding.y)} title="定位设施"><Target /></button>
              <button disabled={!selectedBuilding || selectedBuilding.remaining > 0} onClick={() => setMode({ kind: "rally", id: buildingId })}>集结点 <kbd>Y</kbd></button>
              <button disabled={!selectedBuilding || selectedBuilding.remaining > 0 || selectedBuilding.hp >= selectedBuilding.maxHp || state.alloy < 1} onClick={() => { repairBuilding(game.current, buildingId); refresh(); }}><Wrench />{selectedBuilding?.repairing ? "停止维修" : "维修"}</button>
            </div>
            <div className="production-cards expanded">{["infantry", "tank", "harvester", "aircraft", "boat"].map(type => {
              const producerId = selectedBuilding?.type === TYPES[type].producer ? selectedBuilding.id : undefined;
              const reason = productionReason(state, type, producerId);
              return <button key={type} disabled={!!reason} title={reason || "由" + BUILDINGS[TYPES[type].producer].name + "生产"} onClick={() => { enqueue(game.current, type, producerId); refresh(); }} aria-label={"生产" + TYPES[type].name}>
                <Portrait type={type} /><span>{TYPES[type].name}<small><Diamond size={11} />{TYPES[type].cost} · {TYPES[type].time}s</small><em>{reason || BUILDINGS[TYPES[type].producer].name}</em></span>
              </button>;
            })}</div>
            {selectedBuilding && <div className="facility-state">{Math.ceil(selectedBuilding.hp)} / {selectedBuilding.maxHp} HP · {selectedBuilding.remaining > 0 ? "建造剩余 " + Math.ceil(selectedBuilding.remaining) + "s" : "设施已就绪"} · {selectedBuilding.rally ? "集结点已设置" : "未设置集结点"}</div>}
          </>}
          {panel === "buildings" && <div className="build-cards">{Object.entries(BUILDINGS).map(([type, b]) => <button key={type} className={mode?.type === type ? "active" : ""} disabled={state.credits < b.cost || state.alloy < b.alloy || !!state.result} onClick={() => setMode({ kind: "build", type })} aria-label={"建造" + b.name}>
            <Portrait type={type} building /><div><b>{b.name}</b><small>{b.cost} 晶矿 · {b.alloy} 合金</small><em>{b.time}s · 人口 +{b.cap}{type === "shipyard" ? " · 湖岸" : ""}</em></div>
          </button>)}</div>}
          {panel === "resources" && <div className="ore-cards">{state.ores.map(o => <article key={o.id}>
            <button className="ore-heading" onClick={() => api.current?.focus(o.x, o.y)}><Diamond /><b>{o.name}</b><span className={o.team || ""}>{!isVisible(state, o) ? "待侦察" : o.contested ? "争夺中" : o.team === "blue" ? "已控制" : o.team === "gold" ? "敌方控制" : "中立"}</span></button>
            <small>驻军 +18 晶矿 / +4 合金 · 敌军占矿会扩军</small>
            <div><button onClick={() => { issueOrder(game.current, selectedRef.current, "move", { x: o.x + 65, y: o.y + 40 }); refresh(); }}>派驻部队</button><button onClick={() => { const ids = game.current.units.filter(u => u.type === "harvester" && u.team === "blue").map(u => u.id); issueOrder(game.current, ids, "harvest", o); refresh(); }}>采矿车运输</button></div>
          </article>)}</div>}
          {panel === "tech" && <div className="tech-cards">{Object.entries(TECHS).map(([id, t]) => {
            const q = state.research.find(q => q.id === id), done = state.researched.includes(id), locked = t.prerequisite && !state.researched.includes(t.prerequisite);
            return <button key={id} disabled={done || !!q || !!locked || state.credits < t.cost || !!state.result} onClick={() => { startResearch(game.current, id); refresh(); }}>
              {id === "ballistics" ? <Crosshair /> : id === "armor" ? <ShieldChevron /> : <Factory />}<b>{t.name}</b><small>{t.description}</small>
              <span>{done ? "研究完成" : q ? Math.ceil(q.remaining) + "s" : locked ? "前置：弹道学" : t.cost + " 晶矿 · " + t.time + "s"}</span>
              <div className="progress"><span style={{ width: done ? "100%" : q ? (1 - q.remaining / q.total) * 100 + "%" : "0%" }} /></div>
            </button>;
          })}</div>}
        </div>
      </section>
      <section className="orders-panel">
        <div className="deck-heading"><span>战术指令</span><small>COMMAND</small></div>
        <div className="order-grid">
          {[["move", NavigationArrow, "移动"], ["attack", Crosshair, "攻击 F"], ["idle", HandPalm, "停止 X"], ["patrol", Path, "巡逻 P"], ["guard", ShieldChevron, "护卫 G"], ["hold", Flag, "驻守 R"]].map(([id, Icon, label]) => <button key={id} className={mode?.kind === id ? "active" : ""} onClick={() => command(id)} disabled={!chosen.length || !!state.result}><Icon /><span>{label}</span></button>)}
        </div>
        <div className="ability-row">{Object.entries(ABILITIES).map(([id, a]) => {
          const cooldown = Math.ceil(Math.max(0, state.cooldowns[id] - state.time));
          return <button key={id} title={a.description} disabled={!!cooldown || state.abilityEnergy < a.cost || !!state.result} onClick={() => ability(id)} className={id === "overcharge" && state.overchargeUntil > state.time ? "active" : ""}>{id === "scan" ? <Binoculars /> : <Lightning />}<span>{a.name}<small>{cooldown ? cooldown + "s 冷却" : a.cost + " 能量"}</small></span></button>;
        })}<span className="ability-energy">{Math.floor(state.abilityEnergy)}<small>技能能量</small></span></div>
        <div className="queue-strip"><span>生产</span>{state.queue.length ? state.queue.map(q => <button key={q.id} className="queue-item" title={TYPES[q.type].name + " · 点击取消并退款"} aria-label={"取消生产" + TYPES[q.type].name} onClick={() => { cancelProduction(game.current, q.id); refresh(); }}>{TYPES[q.type].name}<b>{Math.ceil(q.remaining)}s</b><X size={10} /></button>) : <small>暂无生产任务</small>}</div>
      </section>
    </footer>
    <div className="statusbar"><span><Mouse size={12} /> 左键选择 / 框选 · 右键指令 · Shift 连续下令 · 中键旋转 · 滚轮缩放 · WASD 平移</span><span>陆海空作战 <i>/</i> 战术侦察 <b>{Math.min(144, state.fps || 60)} FPS</b></span></div>
    {help && <div className="modal-backdrop"><section className="modal">
      <button className="close" onClick={enter} aria-label="关闭操作说明"><X /></button><span className="eyebrow">FIELD MANUAL / EARTH OPERATIONS</span>
      <h2>指挥官，欢迎来到前线。</h2><p>控制矿区、发展基地，带领陆海空部队摧毁敌方指挥中心。</p>
      <div className="manual">
        <div><b>01 · 调度与侦察</b><p>左键选择、拖动框选，右键下令。Shift 追加路径；Ctrl/⌘ + 数字保存编队。扫描揭示迷雾，战机可越过湖泊。</p></div>
        <div><b>02 · 建设与经济</b><p>「建设」选择建筑，绿影可放置、红影不可放置，R 旋转。驻军控制矿点获得收入；采矿车额外运输。船坞建在西北湖岸。</p></div>
        <div><b>03 · 压制与维修</b><p>敌军占矿获得扩军资金，并派兵争夺矿区。摧毁敌方工厂可削弱、延缓增援，摧毁空军基地可切断战机。残血部队按 T 返回对应生产设施，脱战 4 秒后消耗合金维修。</p></div>
        <div><b>04 · 生产与指挥</b><p>每座设施独立生产，可设集结点、取消退款。低供电减慢生产；科技和超载强化全军。F 点击敌人集火，P 巡逻，G 护卫；空格暂停、WASD 平移。顶部保存和载入对局。</p></div>
      </div><button className="primary" disabled={!ready} onClick={enter}>{ready ? "进入战场" : "战场载入中…"}<NavigationArrow /></button>
    </section></div>}
    {state.result && <div className="modal-backdrop"><section className="modal result"><Flag size={46} weight="duotone" /><span className="eyebrow">OPERATION COMPLETE</span><h2>{state.result === "victory" ? "区域已控制" : "行动失利"}</h2><p>{state.result === "victory" ? "赤砂指挥中心已摧毁，曙光行动完成。" : "联盟指挥中心已失联，重整部队再次出击。"}</p><div className="result-stats"><span><b>{formatTime(state.time)}</b>任务用时</span><span><b>{state.kills}</b>击毁目标</span><span><b>{state.mined}</b>运输晶矿</span></div><button className="primary" onClick={restart}><ArrowCounterClockwise />重新部署</button></section></div>}
  </main>;
}
