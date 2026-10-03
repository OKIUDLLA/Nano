/* ============================================================
   Age of War – remake: UI (HUD, karty, fronta, věže, menu, konec hry)
   DOM vrstva nad canvasem. Volá akce jádra přes callbacky z main.js.
   ============================================================ */
(function (global) {
  "use strict";

  const D = global.AoWData, E = global.AoWEngine, R = global.AoWRender;
  const { AGES, UNITS, UNITS_BY_AGE, TURRETS, TURRETS_BY_AGE, SPECIALS, SLOT_COSTS, MAX_SLOTS, TPS } = D;
  const $ = id => document.getElementById(id);
  const UNIT_KEYS = ["1", "2", "3", "4"], TURRET_KEYS = ["Q", "W", "E"];

  const UI = { state: null, renderer: null, actions: null, lastAge: -1, cardsAge: -1, tab: "units", sellMode: false, placing: null };

  function init(opts) {
    UI.actions = opts.actions; UI.renderer = opts.renderer;
    // záložky
    document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));
    $("btn-evolve").addEventListener("click", () => UI.actions.evolve());
    $("btn-special").addEventListener("click", () => UI.actions.special());
    $("btn-slot").addEventListener("click", () => UI.actions.buySlot());
    $("btn-sell").addEventListener("click", () => setSellMode(!UI.sellMode));
    $("btn-speed").addEventListener("click", () => UI.actions.cycleSpeed());
    $("btn-pause").addEventListener("click", () => UI.actions.togglePause());
    $("btn-resume").addEventListener("click", () => UI.actions.togglePause());
    $("pause-overlay").addEventListener("click", e => { if (e.target === $("pause-overlay")) UI.actions.togglePause(); });
    $("btn-sound").addEventListener("click", () => UI.actions.toggleMute());
    $("btn-menu").addEventListener("click", () => UI.actions.openMenu());
    $("btn-play").addEventListener("click", () => UI.actions.newGame($("sel-difficulty").value, $("sel-ai").value));
    $("btn-continue").addEventListener("click", () => UI.actions.continueGame());
    $("btn-again").addEventListener("click", () => UI.actions.newGame(UI.state ? UI.state.difficulty : "normal", UI.state ? UI.state.aiKind : "classic"));
    $("btn-go-menu").addEventListener("click", () => UI.actions.openMenu());
    $("btn-howto").addEventListener("click", () => showScreen("howto"));
    $("btn-options").addEventListener("click", () => showScreen("options"));
    $("btn-reset-save").addEventListener("click", () => { UI.actions.deleteSave(); toast("Uložená hra smazána"); });
    document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => { $(b.dataset.close).classList.add("hidden"); $("menu").classList.remove("hidden"); }));
    for (const id of ["opt-sfx", "opt-music", "opt-hpbars", "opt-lowfx", "opt-motion"]) $(id).addEventListener("input", () => UI.actions.optionsChanged(readOptions()));
    document.addEventListener("keydown", onKey);
    // tooltipy
    document.addEventListener("mousemove", e => { const tt = $("tooltip"); if (!tt.classList.contains("hidden")) positionTooltip(e.clientX, e.clientY); });
  }

  function readOptions() {
    return { sfx: +$("opt-sfx").value / 100, music: +$("opt-music").value / 100, hpBars: $("opt-hpbars").checked, lowFx: $("opt-lowfx").checked, reducedMotion: $("opt-motion").checked };
  }
  function applyOptions(o) {
    $("opt-sfx").value = Math.round(o.sfx * 100); $("opt-music").value = Math.round(o.music * 100);
    $("opt-hpbars").checked = !!o.hpBars; $("opt-lowfx").checked = !!o.lowFx; $("opt-motion").checked = !!o.reducedMotion;
  }

  function showScreen(id) {
    for (const s of ["menu", "howto", "options", "gameover"]) $(s).classList.toggle("hidden", s !== id);
  }
  function hideScreens() { for (const s of ["menu", "howto", "options", "gameover"]) $(s).classList.add("hidden"); }

  function setTab(tab) {
    UI.tab = tab;
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    $("tab-units").classList.toggle("hidden", tab !== "units");
    $("tab-turrets").classList.toggle("hidden", tab !== "turrets");
    if (tab !== "turrets") { setPlacing(null); setSellMode(false); }
  }
  function setSellMode(on) {
    UI.sellMode = on; UI.renderer.sellMode = on;
    $("btn-sell").classList.toggle("active", on);
    if (on) { setPlacing(null); hint("Klikni na věž na základně, kterou chceš prodat (Esc zruší)"); } else hint(null);
  }
  function setPlacing(turretId) {
    UI.placing = turretId; UI.renderer.placingTurret = turretId;
    document.querySelectorAll("#turret-cards .card").forEach(c => c.classList.toggle("selected", +c.dataset.id === turretId));
    if (turretId !== null) { UI.sellMode = false; UI.renderer.sellMode = false; $("btn-sell").classList.remove("active"); hint(`Klikni na volnou plošinu základny pro stavbu: ${TURRETS[turretId].name} (Esc zruší)`); }
    else hint(null);
  }

  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.classList.remove("hidden");
    t.style.animation = "none"; void t.offsetWidth; t.style.animation = "";
    clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.add("hidden"), 1600);
  }
  function hint(msg) { const h = $("hint"); if (!msg) h.classList.add("hidden"); else { h.textContent = msg; h.classList.remove("hidden"); } }

  // ---------- Karty ----------
  function buildCards(state) {
    const S = state.sides[0];
    UI.cardsAge = S.age;
    const uc = $("unit-cards"); uc.innerHTML = "";
    UNITS_BY_AGE[S.age].forEach((u, i) => {
      const card = document.createElement("div");
      card.className = "card"; card.dataset.id = u.id; card.tabIndex = 0;
      card.innerHTML = `<canvas width="96" height="96"></canvas><div class="info"><div class="name">${u.name}</div><div class="cost">${fmt(u.cost)} $</div><div class="sub">❤ ${u.hp} · ⚔ ${u.melee}${u.isRanged ? " / 🏹 " + u.ranged : ""}</div></div><kbd>${UNIT_KEYS[i]}</kbd>`;
      R.drawIcon(card.querySelector("canvas"), "unit", u.key, u, 0);
      card.addEventListener("click", () => UI.actions.train(u.id));
      card.addEventListener("mouseenter", e => showTooltip(unitTooltip(u), e.clientX, e.clientY));
      card.addEventListener("mouseleave", hideTooltip);
      uc.appendChild(card);
    });
    const tc = $("turret-cards"); tc.innerHTML = "";
    TURRETS_BY_AGE[S.age].forEach((t, i) => {
      const card = document.createElement("div");
      card.className = "card"; card.dataset.id = t.id; card.tabIndex = 0;
      card.innerHTML = `<canvas width="96" height="96"></canvas><div class="info"><div class="name">${t.name}</div><div class="cost">${fmt(t.cost)} $</div><div class="sub">⚔ ${t.dmg} / ${(t.period / TPS).toFixed(2)} s · dosah ${t.range}</div></div><kbd>${TURRET_KEYS[i]}</kbd>`;
      R.drawIcon(card.querySelector("canvas"), "turret", t.key, t, 0);
      card.addEventListener("click", () => startPlacing(t.id));
      card.addEventListener("mouseenter", e => showTooltip(turretTooltip(t), e.clientX, e.clientY));
      card.addEventListener("mouseleave", hideTooltip);
      tc.appendChild(card);
    });
    // special
    const sp = SPECIALS[S.age];
    $("special-label").textContent = sp.name;
    $("btn-special").title = `${sp.name}: ${sp.desc} [Mezerník]`;
  }
  function startPlacing(turretId) {
    const S = UI.state.sides[0];
    const def = TURRETS[turretId];
    if (S.gold < def.cost) { toast("Nedostatek zlata"); UI.actions.error(); return; }
    if (!S.turrets.slice(0, S.slots).some(t => !t)) { toast(S.slots < MAX_SLOTS ? "Žádná volná plošina – kup další slot" : "Všechny plošiny jsou obsazené"); UI.actions.error(); return; }
    setPlacing(UI.placing === turretId ? null : turretId);
  }

  function unitTooltip(u) {
    return `<b>${u.name}</b> <i>(${u.en})</i><br>Cena: <b>${fmt(u.cost)} $</b> · výcvik ${(u.train / TPS).toFixed(2)} s<br>Zdraví: ${u.hp}<br>Útok zblízka: ${u.melee} každých ${(u.period / TPS).toFixed(2)} s (${u.dps} DPS), dosah ${u.meleeRange}` +
      (u.isRanged ? `<br>Střelba: ${u.ranged} každých ${(u.shootPeriod / TPS).toFixed(2)} s (${u.rdps} DPS), dostřel ${u.shootRange}` : "") +
      `<br>Za zabití nepřítel dostane ${fmt(u.reward)} $; ty za jeho zabití ${fmt(u.reward)} $ a ${fmt(u.killXp)} XP`;
  }
  function turretTooltip(t) {
    return `<b>${t.name}</b> <i>(${t.en})</i><br>Cena: <b>${fmt(t.cost)} $</b> · prodej ${fmt(t.sell)} $<br>Poškození ${t.dmg} každých ${(t.period / TPS).toFixed(2)} s (${t.dps} DPS)<br>Dosah ${t.range} px` +
      (t.projectile === "ballistic" ? "<br>Balistická střela – pomalé cíle trefí líp" : t.projectile === "oil" ? "<br>Lije olej těsně před základnu" : t.shrapnel ? "<br>Po zásahu rozmetá střepiny (plošné)" : "");
  }
  const canHover = !(global.matchMedia && global.matchMedia("(hover: none)").matches);
  function showTooltip(html, x, y) { if (!canHover) return; const tt = $("tooltip"); tt.innerHTML = html; tt.classList.remove("hidden"); positionTooltip(x, y); }
  function hideTooltip() { $("tooltip").classList.add("hidden"); }
  function positionTooltip(x, y) {
    const tt = $("tooltip"); const w = tt.offsetWidth, h = tt.offsetHeight;
    let left = x + 14, top = y - h - 10;
    if (left + w > innerWidth - 8) left = x - w - 14;
    if (top < 8) top = y + 16;
    tt.style.left = left + "px"; tt.style.top = top + "px";
  }
  function fmt(n) { return n.toLocaleString("cs-CZ"); }

  // ---------- Aktualizace každý snímek ----------
  function update(state, meta) {
    UI.state = state;
    const S = state.sides[0];
    if (S.age !== UI.cardsAge) buildCards(state);
    $("gold").textContent = fmt(Math.floor(S.gold));
    $("xp").textContent = fmt(Math.floor(S.xp));
    $("age-name").textContent = AGES[S.age].name;
    const need = AGES[S.age].evolveXp;
    $("xpbar-fill").style.width = (need === Infinity ? 100 : Math.min(100, S.xp / need * 100)) + "%";
    const ev = $("btn-evolve");
    if (S.age >= AGES.length - 1) { ev.textContent = "Nejvyšší věk"; ev.disabled = true; ev.classList.remove("ready"); }
    else { const ok = E.canEvolve(state, 0); ev.textContent = `Evoluce (${fmt(need)} XP)`; ev.disabled = !ok; ev.classList.toggle("ready", ok); }
    const sb = $("btn-special");
    const cd = S.specialCd;
    sb.classList.toggle("ready", cd <= 0 && !state.over);
    sb.style.setProperty("--cd", (100 - cd / state.rules.specialCooldown * 100) + "%");
    $("special-label").textContent = cd > 0 ? `${SPECIALS[S.age].name} (${Math.ceil(cd / TPS)} s)` : SPECIALS[S.age].name;
    sb.disabled = state.over;
    // karty jednotek
    document.querySelectorAll("#unit-cards .card").forEach(c => { const u = UNITS[+c.dataset.id]; c.classList.toggle("unaffordable", S.gold < u.cost || S.queue.length >= state.rules.queueSize); });
    document.querySelectorAll("#turret-cards .card").forEach(c => { const t = TURRETS[+c.dataset.id]; c.classList.toggle("unaffordable", S.gold < t.cost); });
    // fronta
    const fill = $("train-fill"), lbl = $("train-label");
    if (S.queue.length) {
      const u = UNITS[S.queue[0]];
      fill.style.width = (S.trainTotal ? (1 - S.trainLeft / S.trainTotal) * 100 : 0) + "%";
      lbl.textContent = `Výcvik: ${u.name} (${(S.trainLeft / TPS).toFixed(1)} s)`;
    } else { fill.style.width = "0%"; lbl.textContent = "Fronta výcviku je prázdná"; }
    const qs = $("queue-slots");
    const sig = S.queue.join(",");
    if (qs.dataset.sig !== sig) {
      qs.dataset.sig = sig; qs.innerHTML = "";
      for (let i = 0; i < state.rules.queueSize; i++) {
        const d = document.createElement("div"); d.className = "qslot" + (S.queue[i] !== undefined ? " filled" : "");
        if (S.queue[i] !== undefined) {
          const u = UNITS[S.queue[i]]; const c = document.createElement("canvas"); c.width = 64; c.height = 64; R.drawIcon(c, "unit", u.key, u, 0); d.appendChild(c);
          d.title = i === 0 ? `${u.name} – ve výcviku` : `${u.name} – klikni pro zrušení (vrátí ${fmt(u.cost)} $)`;
          if (i > 0) d.addEventListener("click", () => UI.actions.cancelQueued(i));
        } else d.textContent = i + 1;
        qs.appendChild(d);
      }
    }
    // věže
    const slotCost = E.slotCost(state, 0);
    const bs = $("btn-slot");
    bs.textContent = slotCost === null ? "Sloty: max (4)" : `Přidat slot (${fmt(slotCost)} $)`;
    bs.disabled = slotCost === null || S.gold < slotCost;
    const tl = $("turret-list");
    const tsig = S.turrets.map(t => t ? t.id : "-").join(",") + "|" + S.slots;
    if (tl.dataset.sig !== tsig) {
      tl.dataset.sig = tsig; tl.innerHTML = "";
      for (let i = 0; i < S.slots; i++) {
        const t = S.turrets[i]; const d = document.createElement("span"); d.className = "tl";
        d.textContent = `Plošina ${i + 1}: ${t ? TURRETS[t.id].name : "volná"}`; tl.appendChild(d);
      }
    }
    $("btn-sell").disabled = !S.turrets.some(t => t);
    // systém
    $("btn-speed").textContent = meta.speed + "×";
    $("btn-pause").textContent = meta.paused ? "▶" : "⏸";
    $("pause-overlay").classList.toggle("hidden", !meta.paused || state.over);
    $("btn-sound").textContent = meta.muted ? "🔇" : "🔊";
    $("btn-continue").classList.toggle("hidden", !meta.hasSave);
  }

  // ---------- Konec hry ----------
  function showGameOver(state) {
    const S = state.sides[0], won = state.winner === 0;
    $("go-title").textContent = won ? "Vítězství!" : "Porážka";
    $("go-text").textContent = won ? "Nepřátelská základna leží v troskách. Skvělá práce, veliteli!" : "Tvoje základna padla. Zkus to znovu – a tentokrát postav víc věží.";
    const mins = Math.floor(state.tick / TPS / 60), secs = Math.floor(state.tick / TPS % 60);
    const rows = [
      ["Čas", `${mins}:${String(secs).padStart(2, "0")}`],
      ["Obtížnost", D.DIFFICULTIES[state.difficulty].name],
      ["Dosažený věk", AGES[S.age].name],
      ["Zabito nepřátel", S.stats.kills], ["Ztraceno jednotek", S.stats.lost],
      ["Vycvičeno jednotek", S.stats.unitsTrained], ["Postaveno věží", S.stats.turretsBuilt],
      ["Použito specialů", S.stats.specialsUsed],
      ["Zlato vyděláno", fmt(S.stats.goldEarned) + " $"], ["Zlato utraceno", fmt(S.stats.goldSpent) + " $"],
      ["Poškození jednotkám", fmt(Math.round(S.stats.dmgDealt))], ["Poškození základně", fmt(Math.round(S.stats.dmgToBase))],
    ];
    $("go-stats").innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("");
    showScreen("gameover");
  }

  // ---------- Klávesy ----------
  function onKey(e) {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) return;
    const k = e.key;
    const inGame = $("menu").classList.contains("hidden") && $("gameover").classList.contains("hidden") && $("howto").classList.contains("hidden") && $("options").classList.contains("hidden");
    if (!inGame) { if (k === "Escape") { $("howto").classList.add("hidden"); $("options").classList.add("hidden"); if ($("gameover").classList.contains("hidden")) $("menu").classList.remove("hidden"); } return; }
    if (k === "Escape") { if (UI.placing !== null || UI.sellMode) { setPlacing(null); setSellMode(false); } else UI.actions.openMenu(); return; }
    if (k === "p" || k === "P") { UI.actions.togglePause(); return; }
    if (k === "m" || k === "M") { UI.actions.toggleMute(); return; }
    if (k === "+" || k === "=") { UI.actions.cycleSpeed(1); return; }
    if (k === "-") { UI.actions.cycleSpeed(-1); return; }
    if (k === " ") { e.preventDefault(); UI.actions.special(); return; }
    if (k === "Enter") { UI.actions.evolve(); return; }
    const ui = UNIT_KEYS.indexOf(k);
    if (ui >= 0) { const u = UNITS_BY_AGE[UI.state.sides[0].age][ui]; if (u) UI.actions.train(u.id); return; }
    const ti = TURRET_KEYS.indexOf(k.toUpperCase());
    if (ti >= 0) { setTab("turrets"); const t = TURRETS_BY_AGE[UI.state.sides[0].age][ti]; if (t) startPlacing(t.id); return; }
    if (k === "a" || k === "A") { UI.actions.buySlot(); return; }
    if (k === "s" || k === "S") { setTab("turrets"); setSellMode(!UI.sellMode); return; }
    if (k === "Tab") { e.preventDefault(); setTab(UI.tab === "units" ? "turrets" : "units"); }
  }

  global.AoWUI = { init, update, buildCards, showScreen, hideScreens, showGameOver, toast, hint, setPlacing, setSellMode, setTab, readOptions, applyOptions, get placing() { return UI.placing; }, get sellMode() { return UI.sellMode; } };
})(typeof window !== "undefined" ? window : globalThis);
