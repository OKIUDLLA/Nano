/* ============================================================
   Age of War – remake: HLAVNÍ SMYČKA
   Pevný krok simulace (40 Hz), render každý snímek s interpolací,
   rychlost hry, pauza, ukládání, vstupy na canvasu, zvuk.
   ============================================================ */
(() => {
  "use strict";

  const D = window.AoWData, E = window.AoWEngine, R = window.AoWRender, UI = window.AoWUI;
  const A = window.AoWAudio || { init() {}, resume() {}, play() {}, setMusic() {}, setIntensity() {}, setVolume() {}, setMuted() {}, isMuted() { return false; } };
  const { TPS, UNITS, TURRETS, GROUND_Y, WORLD_W } = D;
  const TICK = 1 / TPS;
  const SAVE_KEY = "veky-valky-remake-save-v1", OPT_KEY = "veky-valky-remake-options-v1";
  const SPEEDS = [1, 2, 3];

  const canvas = document.getElementById("game");
  const renderer = R.create(canvas);
  let state = null, speed = 1, paused = false, acc = 0, last = performance.now(), saveAcc = 0, muted = false, running = false;
  let options = { sfx: 0.8, music: 0.6, hpBars: true, lowFx: false, reducedMotion: false };

  // ---------- Ukládání ----------
  function save() { if (!state || state.over) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }
  function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.version === 1 && !s.over ? s : null; } catch (e) { return null; } }
  function deleteSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
  function loadOptions() { try { Object.assign(options, JSON.parse(localStorage.getItem(OPT_KEY)) || {}); } catch (e) { /* ignore */ } }
  function saveOptions() { try { localStorage.setItem(OPT_KEY, JSON.stringify(options)); } catch (e) { /* ignore */ } }
  function applyOptions() {
    renderer.showHpBars = options.hpBars; renderer.lowFx = options.lowFx; renderer.reducedMotion = options.reducedMotion;
    A.setVolume({ master: 1, sfx: options.sfx, music: options.music });
    UI.applyOptions(options);
  }

  // ---------- Hra ----------
  function startGame(st) {
    state = st; window.__game = state; // pro testy
    acc = 0; paused = false; speed = 1;
    UI.hideScreens(); UI.setTab("units"); UI.setPlacing(null); UI.setSellMode(false);
    UI.buildCards(state);
    renderer.lastAge = [-1, -1];
    A.setMusic(state.sides[0].age);
    running = true;
  }
  const actions = {
    newGame(difficulty, ai) { A.resume(); deleteSave(); startGame(E.createGame({ difficulty, ai })); },
    continueGame() { A.resume(); const s = loadSave(); if (s) startGame(s); },
    openMenu() { if (state && !state.over) save(); running = false; paused = false; UI.showScreen("menu"); updateMeta(); },
    train(id) { if (!state || state.over) return; if (E.enqueueUnit(state, 0, id)) A.play("train"); else { const S = state.sides[0]; UI.toast(S.queue.length >= state.rules.queueSize ? "Fronta je plná" : "Nedostatek zlata"); A.play("ui_error"); } },
    cancelQueued(i) { if (state && E.cancelQueued(state, 0, i)) A.play("sell"); },
    evolve() { if (!state) return; if (E.evolve(state, 0)) { A.play("evolve"); A.setMusic(state.sides[0].age); UI.toast("Postup do věku: " + D.AGES[state.sides[0].age].name); } else { UI.toast("Nedostatek zkušeností"); A.play("ui_error"); } },
    special() { if (!state) return; if (E.useSpecial(state, 0)) A.play("special_" + D.SPECIALS[state.sides[0].age].key); else { UI.toast("Special se ještě nabíjí"); A.play("ui_error"); } },
    buySlot() { if (!state) return; if (E.buySlot(state, 0)) A.play("slot"); else { UI.toast(E.slotCost(state, 0) === null ? "Máš všechny 4 plošiny" : "Nedostatek zlata"); A.play("ui_error"); } },
    buildAt(slot) {
      const id = UI.placing; if (id === null) return;
      if (E.buildTurret(state, 0, slot, id)) { A.play("build"); UI.setPlacing(null); }
      else { UI.toast(state.sides[0].turrets[slot] ? "Plošina je obsazená" : "Nedostatek zlata"); A.play("ui_error"); }
    },
    sellAt(slot) { if (E.sellTurret(state, 0, slot)) { A.play("sell"); UI.toast("Věž prodána"); UI.setSellMode(false); } },
    cycleSpeed(dir) { const i = SPEEDS.indexOf(speed); speed = SPEEDS[(i + (dir || 1) + SPEEDS.length) % SPEEDS.length]; A.play("ui_click"); },
    togglePause() { if (!state || state.over) return; paused = !paused; A.play("ui_click"); },
    toggleMute() { muted = !muted; A.setMuted(muted); A.play("ui_click"); },
    optionsChanged(o) { options = Object.assign(options, o); saveOptions(); applyOptions(); },
    deleteSave, error() { A.play("ui_error"); },
  };

  // ---------- Vstup na canvasu ----------
  let dragging = null;
  canvas.addEventListener("pointerdown", e => {
    A.resume();
    if (!state || state.over) return;
    const rect = canvas.getBoundingClientRect();
    const w = R.toWorld(renderer, e.clientX - rect.left, e.clientY - rect.top);
    const slot = R.slotAt(renderer, state, 0, w.x, w.y);
    if (UI.placing !== null) { if (slot !== null) actions.buildAt(slot); else UI.setPlacing(null); return; }
    if (UI.sellMode) { if (slot !== null && state.sides[0].turrets[slot]) actions.sellAt(slot); else UI.setSellMode(false); return; }
    dragging = { x: e.clientX, camX: renderer.camX };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", e => {
    if (!state) return;
    const rect = canvas.getBoundingClientRect();
    const w = R.toWorld(renderer, e.clientX - rect.left, e.clientY - rect.top);
    renderer.hoverSlot = R.slotAt(renderer, state, 0, w.x, w.y);
    if (dragging) { renderer.camX = dragging.camX - (e.clientX - dragging.x) / renderer.zoom; renderer.camX = Math.max(0, Math.min(WORLD_W - renderer.viewW, renderer.camX)); }
  });
  canvas.addEventListener("pointerup", () => { dragging = null; });
  canvas.addEventListener("pointercancel", () => { dragging = null; });
  canvas.addEventListener("contextmenu", e => { e.preventDefault(); UI.setPlacing(null); UI.setSellMode(false); });
  window.addEventListener("resize", () => R.resize(renderer));
  document.addEventListener("visibilitychange", () => { if (document.hidden && state && !state.over) { paused = true; save(); } });
  window.addEventListener("pagehide", save);
  window.addEventListener("pointerdown", () => A.resume(), { once: true });
  window.addEventListener("keydown", () => A.resume(), { once: true });

  // ---------- Zvuky z událostí ----------
  const BLADES = new Set(["swordman", "knight", "dueler", "godsblade"]);
  const BEASTS = new Set(["dino", "knight"]);
  const MACHINES = new Set(["tank", "warmachine", "cannoneer"]);
  function soundFor(events) {
    let intensity = 0;
    for (const ev of events) {
      switch (ev.t) {
        case "hit": {
          const from = E.findUnit(state, ev.from);
          const key = from ? UNITS[from.id].key : "";
          if (ev.kind === "shot" || ev.kind === "fast") A.play("hit_ranged", { volume: 0.5 });
          else if (ev.kind === "oil" || ev.kind === "shrapnel") { /* potichu */ }
          else if (ev.kind === "bomb" || ev.kind === "meteors") A.play("explosion", { volume: 0.5 });
          else if (ev.kind === "arrows") A.play("hit_ranged", { volume: 0.4 });
          else if (ev.kind === "ray") A.play("shot_laser", { volume: 0.7 });
          else if (ev.ranged) A.play(key === "slinger" ? "shot_sling" : key === "archer" ? "shot_bow" : key === "musketeer" ? "shot_musket" : key === "infantry" ? "shot_rifle" : "shot_laser", { volume: 0.55, pan: pan(ev.x) });
          else A.play(BLADES.has(key) ? "hit_blade" : "hit_melee", { volume: 0.6, pan: pan(ev.x) });
          intensity += 0.02; break;
        }
        case "hitbase": A.play("base_hit", { volume: 0.6 }); if (ev.side === 0) intensity += 0.1; break;
        case "death": { const key = UNITS[ev.id].key; A.play(MACHINES.has(key) ? "death_machine" : BEASTS.has(key) ? "death_beast" : "death_human", { volume: 0.7, pan: pan(ev.x) }); if (ev.side === 1) A.play("coin", { volume: 0.5 }); intensity += 0.05; break; }
        case "shot": { const t = TURRETS[ev.id]; A.play(t.projectile === "laser" ? "shot_laser" : t.projectile === "rocket" ? "shot_rocket" : t.projectile === "fast" ? "shot_cannon" : t.projectile === "oil" ? "impact_oil" : t.id <= 1 ? "shot_sling" : "shot_catapult", { volume: 0.5, pan: pan(ev.x) }); break; }
        case "impact": if (ev.kind === "explosion" || ev.kind === "bomb" || ev.kind === "meteors") A.play("explosion", { volume: 0.6 }); else if (ev.kind === "ground") A.play("impact_rock", { volume: 0.25 }); break;
        case "spawn": if (ev.side === 0) A.play("spawn", { volume: 0.5 }); break;
        case "evolve": if (ev.side === 1) UI.toast("Nepřítel postoupil do věku: " + D.AGES[ev.age].name); break;
        case "build": if (ev.side === 1) A.play("build", { volume: 0.3 }); break;
        case "special": if (ev.side === 1) A.play("special_" + ev.key); break;
        case "gameover": A.play(ev.winner === 0 ? "win" : "lose"); A.setMusic(null); break;
      }
    }
    return intensity;
  }
  function pan(x) { return x === undefined ? 0 : Math.max(-1, Math.min(1, (x - WORLD_W / 2) / (WORLD_W / 2))); }

  // ---------- Smyčka ----------
  let intensity = 0, warned = false;
  function frame(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1;
    if (state && running) {
      if (!paused && !state.over) {
        acc += dt * speed;
        let steps = 0;
        while (acc >= TICK && steps < 12) {
          R.beforeTick(renderer, state);
          E.tick(state);
          R.onEvents(renderer, state, state.events);
          intensity = Math.min(1, intensity * 0.995 + soundFor(state.events));
          acc -= TICK; steps++;
        }
        if (steps >= 12) acc = 0;
        A.setIntensity(intensity);
        const S = state.sides[0];
        if (S.baseHp / S.baseMaxHp < 0.25 && !warned) { warned = true; A.play("base_warning"); UI.toast("Základna je v ohrožení!"); }
        if (S.baseHp / S.baseMaxHp >= 0.25) warned = false;
        saveAcc += dt; if (saveAcc > 3) { saveAcc = 0; save(); }
        if (state.over) { deleteSave(); setTimeout(() => UI.showGameOver(state), 1200); }
      }
      R.draw(renderer, state, Math.min(1, acc / TICK), paused ? 0 : dt * speed);
      UI.update(state, meta());
    }
    requestAnimationFrame(frame);
  }
  function meta() { return { speed, paused, muted, hasSave: !!loadSave() }; }
  function updateMeta() { if (state) UI.update(state, meta()); else document.getElementById("btn-continue").classList.toggle("hidden", !loadSave()); }

  // ---------- Start ----------
  loadOptions();
  UI.init({ actions, renderer });
  applyOptions();
  R.resize(renderer);
  updateMeta();
  // registrace service workeru (PWA) – jen přes http(s), ne z file://
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
  window.__app = { get state() { return state; }, actions, renderer, startGame, get speed() { return speed; }, set speed(v) { speed = v; }, get paused() { return paused; } };
  requestAnimationFrame(frame);
})();
