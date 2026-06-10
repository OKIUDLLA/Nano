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
  const SAVE_KEY = "veky-valky-save-v2";

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
      if (!s || s.version !== 2 || s.over) return null;
      return s;
    } catch (e) { return null; }
  }

  function newGame() {
    game = E.createGame({});
    exposeForTests();
    save();
  }

  function exposeForTests() {
    window.__game = game;          // pro automatické testy
  }

  // ---------- Vykreslení ----------
  function render() {
    const age = AGES[game.age];
    ctx.fillStyle = age.sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = age.ground;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = "rgba(0,0,0,.15)";
    ctx.fillRect(0, GROUND_Y, W, 4);

    drawBase("player", game.playerBaseHp, game.age);
    drawBase("enemy", game.enemyBaseHp, game.enemyAge);
    drawTowers();

    const sorted = [...game.units].sort((a, b) => a.x - b.x);
    for (const u of sorted) drawUnit(u);

    drawEffects();
    drawFloats();
  }

  function drawBase(side, hp, age) {
    const x = side === "player" ? 0 : W - BASE_W;
    const color = side === "player" ? "#33507a" : "#7a3733";
    const top = GROUND_Y - 120;
    ctx.fillStyle = color;
    ctx.fillRect(x + 6, top, BASE_W - 12, 120);
    ctx.fillStyle = side === "player" ? "#3e5f90" : "#90413c";
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x + 6 + i * ((BASE_W - 12) / 4), top - 10, (BASE_W - 12) / 4 - 3, 10);
    }
    ctx.fillStyle = side === "player" ? "#6fa8ff" : "#ff7a6f";
    ctx.fillRect(x + BASE_W / 2 - 1, top - 34, 2, 24);
    ctx.fillRect(x + BASE_W / 2 + 1, top - 34, 14 * (side === "player" ? 1 : -1), 10);

    // číslo věku na základně
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(age + 1), x + BASE_W / 2, top + 70);

    const bw = BASE_W - 14, bx = x + 7, by = top - 50;
    ctx.fillStyle = "rgba(0,0,0,.5)";
    ctx.fillRect(bx, by, bw, 7);
    ctx.fillStyle = side === "player" ? "#4a90e2" : "#e2574a";
    ctx.fillRect(bx, by, bw * Math.max(0, hp / BASE_MAX_HP), 7);
  }

  function drawTowers() {
    for (const tw of game.towers) {
      const x = tw.side === "player" ? BASE_W - 10 : W - BASE_W + 10;
      const y = GROUND_Y - 150 - tw.slot * 26;
      ctx.fillStyle = tw.side === "player" ? "#4a90e2" : "#e2574a";
      ctx.fillRect(x - 8, y, 16, 16);
      ctx.fillStyle = "#1b2230";
      const dir = tw.side === "player" ? 1 : -1;
      ctx.fillRect(x, y + 5, dir * 12, 4);
    }
  }

  function drawUnit(u) {
    const h = u.size * 1.7;
    const w = u.size;
    const x = u.x - w / 2;
    const y = GROUND_Y - h;

    ctx.fillStyle = u.color;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = u.side === "player" ? "rgba(74,144,226,.9)" : "rgba(226,87,74,.9)";
    ctx.fillRect(x, y, w, 4);
    ctx.fillRect(x, GROUND_Y - 4, w, 4);
    if (u.ranged) {
      const dir = u.side === "player" ? 1 : -1;
      ctx.fillStyle = "#2b2f38";
      ctx.fillRect(u.x + dir * (w / 2), y + h * 0.3, dir * 8, 3);
    }

    const ratio = Math.max(0, u.hp / u.maxHp);
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(x, y - 8, w, 4);
    ctx.fillStyle = ratio > 0.5 ? "#5dd35d" : ratio > 0.25 ? "#e6c34c" : "#e2574a";
    ctx.fillRect(x, y - 8, w * ratio, 4);
  }

  function drawEffects() {
    for (const e of game.effects) {
      if (e.type === "shot") {
        ctx.strokeStyle = e.tower
          ? "rgba(255,235,140,.9)"
          : e.side === "player" ? "rgba(150,200,255,.8)" : "rgba(255,170,150,.8)";
        ctx.lineWidth = e.tower ? 2.5 : 2;
        const y = e.tower ? GROUND_Y - 150 : GROUND_Y - 22;
        ctx.beginPath();
        ctx.moveTo(e.x1, e.tower ? y : GROUND_Y - 22);
        ctx.lineTo(e.x2, GROUND_Y - 22);
        ctx.stroke();
      } else if (e.type === "hit") {
        ctx.fillStyle = "rgba(255,230,150," + (e.ttl / 0.15) + ")";
        ctx.beginPath();
        ctx.arc(e.x, GROUND_Y - 20, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === "meteor") {
        ctx.fillStyle = "rgba(255,120,40," + (e.ttl / 0.7) * 0.5 + ")";
        ctx.fillRect(W / 2, 0, W / 2, H);
      }
    }
  }

  function drawFloats() {
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    for (const f of game.floats) {
      ctx.globalAlpha = Math.min(1, f.ttl);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
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
        document.getElementById("overlay-text").textContent = game.won
          ? "Zničil jsi nepřátelskou základnu. Dobrá práce, veliteli!"
          : "Tvoje základna padla. Zkus to znovu s lepší strategií.";
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
    render();
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
  buildShop();
  lastAge = game.age;
  requestAnimationFrame(frame);
})();
