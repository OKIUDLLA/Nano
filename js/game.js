/* ============================================================
   Věky Války – prezentační vrstva
   Vykreslování (Canvas), HUD, vstupy a ukládání.
   Veškerá herní logika je v js/engine.js (window.Engine).
   ============================================================ */
(() => {
  "use strict";

  const E = window.Engine;
  const { W, H, BASE_W, GROUND_Y, BASE_MAX_HP, AGES, UNITS } = E;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const SAVE_KEY = "veky-valky-save-v3";

  // Ostré vykreslení na hi-DPI displejích: zvětšíme backing store,
  // ale souřadnice necháme v logických 960×380.
  (function setupHiDPI() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  })();

  let game;
  let last = performance.now();

  // ---------- Ukládání ----------
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); } catch (e) { /* ignore */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || s.version !== 3 || s.over) return null;
      return s;
    } catch (e) { return null; }
  }

  function newGame() {
    const diffEl = document.getElementById("difficulty");
    const difficulty = diffEl ? diffEl.value : "normal";
    game = E.createGame({ difficulty });
    exposeForTests();
    save();
  }

  function exposeForTests() {
    window.__game = game;          // pro automatické testy
  }

  // ---------- Vykreslení (deleguje na js/render.js) ----------
  function render(dt) {
    window.Render.scene(ctx, game, dt, performance.now() / 1000);
  }

  // ---------- HUD ----------
  function updateHUD() {
    document.getElementById("age-name").textContent = AGES[game.age].name;
    document.getElementById("gold").textContent = Math.floor(game.gold);
    document.getElementById("xp").textContent = Math.floor(game.xp);

    const evolveBtn = document.getElementById("evolve-btn");
    if (game.age >= AGES.length - 1) {
      evolveBtn.textContent = "Nejvyšší věk";
      evolveBtn.disabled = true;
    } else {
      const cost = AGES[game.age].evolveCost;
      evolveBtn.textContent = `Postoupit do dalšího věku (${cost} XP)`;
      evolveBtn.disabled = game.xp < cost || game.over;
    }

    const specialBtn = document.getElementById("special-btn");
    if (game.specialCd > 0) {
      specialBtn.textContent = `Meteor (${Math.ceil(game.specialCd)}s)`;
      specialBtn.disabled = true;
    } else {
      specialBtn.textContent = "Meteor";
      specialBtn.disabled = game.over;
    }

    const towerBtn = document.getElementById("tower-btn");
    const towers = E.towerCount(game, "player");
    if (towers >= E.MAX_TOWERS) {
      towerBtn.textContent = "Věže (max)";
      towerBtn.disabled = true;
    } else {
      const cost = E.towerCost(game, "player");
      towerBtn.textContent = `Postavit věž (${cost} zlata)`;
      towerBtn.disabled = game.gold < cost || game.over;
    }

    const cards = document.querySelectorAll(".unit-card");
    cards.forEach((card, i) => {
      const t = UNITS[game.age][i];
      card.classList.toggle("unaffordable", !t || game.gold < t.cost);
    });

    const overlay = document.getElementById("overlay");
    if (game.over) {
      if (overlay.classList.contains("hidden")) {
        document.getElementById("overlay-title").textContent = game.won ? "Vítězství!" : "Porážka";
        const st = game.stats || { kills: 0, goldEarned: 0, unitsSent: 0, towersBuilt: 0 };
        const mins = Math.floor(game.time / 60), secs = Math.floor(game.time % 60);
        const base = game.won
          ? "Zničil jsi nepřátelskou základnu. Dobrá práce, veliteli!"
          : "Tvoje základna padla. Zkus to znovu s lepší strategií.";
        document.getElementById("overlay-text").innerHTML =
          base +
          `<br><br>⏱ Čas: ${mins}:${String(secs).padStart(2, "0")}` +
          ` &nbsp; ⚔ Zabití: ${st.kills}` +
          ` &nbsp; 🪖 Vysláno: ${st.unitsSent}` +
          `<br>💰 Vyděláno: ${st.goldEarned} &nbsp; 🗼 Věží: ${st.towersBuilt}`;
        overlay.classList.remove("hidden");
      }
    } else {
      overlay.classList.add("hidden");
    }
  }

  // ---------- Obchod ----------
  function buildShop() {
    const container = document.getElementById("units");
    container.innerHTML = "";
    UNITS[game.age].forEach((t, i) => {
      const card = document.createElement("div");
      card.className = "unit-card" + (i === game.autoUnit ? " auto-selected" : "");
      card.innerHTML = `
        <span class="star">★</span>
        <div class="name">${t.name}</div>
        <div class="cost">${t.cost} zlata</div>
        <div class="stats">
          <span>❤ <b>${t.hp}</b></span>
          <span>⚔ <b>${t.dmg}</b></span>
          <span>${t.range > 60 ? "🏹 střelec" : "🛡 boj zblízka"}</span>
        </div>`;
      card.addEventListener("click", () => { E.buyUnit(game, "player", i); });
      card.querySelector(".star").addEventListener("click", (ev) => {
        ev.stopPropagation();
        game.autoUnit = i;
        buildShop();
      });
      container.appendChild(card);
    });
  }

  // ---------- Smyčka ----------
  let lastAge = -1;
  let saveAccum = 0;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;

    E.update(game, dt);
    if (game.age !== lastAge) { lastAge = game.age; buildShop(); }
    render(dt);
    updateHUD();

    saveAccum += dt;
    if (saveAccum > 2) { saveAccum = 0; save(); }

    requestAnimationFrame(frame);
  }

  // ---------- Vstupy ----------
  document.getElementById("evolve-btn").addEventListener("click", () => E.evolve(game));
  document.getElementById("special-btn").addEventListener("click", () => E.special(game));
  document.getElementById("tower-btn").addEventListener("click", () => E.buyTower(game, "player"));
  document.getElementById("auto-check").addEventListener("change", (e) => { game.auto = e.target.checked; });
  document.getElementById("difficulty").addEventListener("change", () => {
    newGame();
    document.getElementById("auto-check").checked = false;
    lastAge = -1;
  });
  document.getElementById("reset-btn").addEventListener("click", () => {
    newGame();
    document.getElementById("auto-check").checked = false;
    lastAge = -1;
  });
  document.getElementById("restart-btn").addEventListener("click", () => {
    newGame();
    document.getElementById("auto-check").checked = false;
    lastAge = -1;
  });

  // ---------- Start ----------
  const saved = load();
  if (saved) { game = saved; exposeForTests(); }
  else { newGame(); }
  document.getElementById("auto-check").checked = !!game.auto;
  if (game.difficulty) document.getElementById("difficulty").value = game.difficulty;
  buildShop();
  lastAge = game.age;
  requestAnimationFrame(frame);
})();
