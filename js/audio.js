/* ============================================================
   Age of War – remake: ZVUK (Web Audio API, 100 % syntéza, bez assetů)

   window.AoWAudio
     init()                  líně vytvoří AudioContext (bez gesta zůstane suspended)
     resume()                obnoví kontext – volat při prvním gestu uživatele
     isReady()               true, když kontext běží
     play(name, opts)        jednorázový efekt; opts { volume 0..1, pitch, pan -1..1 }
     setMusic(age | null)    crossfade (1.5 s) do procedurální smyčky daného věku
     setIntensity(0..1)      přidává vrstvy hudby (bicí / bas / hi-hat)
     setVolume({master,sfx,music}) / getVolume() / setMuted(b) / isMuted()
     stopAll()               okamžitě utne všechny běžící efekty
     names() / themes()      seznam efektů / témat
     __renderTest(name, s)   offline render → { peak, rms } (self-test)
     __stats()               { voices, tracks, state }

   Nikdy nevyhazuje výjimky; bez AudioContextu (nebo před resume()) je
   každé volání no-op. Hudba používá "two clocks" plánování: setInterval
   25 ms + plánování 100 ms dopředu podle AudioContext.currentTime.
   ============================================================ */
(function (global) {
  "use strict";

  const AC  = global.AudioContext || global.webkitAudioContext || null;
  const OAC = global.OfflineAudioContext || global.webkitOfflineAudioContext || null;

  // ---------- konstanty ----------
  const MUSIC_RATIO  = 0.35;   // hudba sedí pod efekty
  const MASTER_TRIM  = 0.85;   // rezerva za kompresorem
  const MAX_VOICES   = 24;
  const THROTTLE_MS  = 45;
  const PITCH_JITTER = 0.04;
  const XFADE        = 1.5;
  const LOOKAHEAD    = 0.1;
  const TICK_MS      = 25;
  const FLOOR        = 0.0001;
  const BUILTIN      = { sine: 1, square: 1, sawtooth: 1, triangle: 1 };

  // ---------- stav ----------
  let ctx = null, graph = null;
  let muted = false;
  const vol = { master: 1, sfx: 1, music: 1 };
  let intensity = 0;
  let wantMusic = null;
  let voices = [];
  const lastStart = Object.create(null);
  let tracks = [];
  let timer = null;

  const nowMs = () => (global.performance && global.performance.now) ? global.performance.now() : Date.now();
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const num = (x, d) => (typeof x === "number" && isFinite(x)) ? x : d;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const safeF = (f) => clamp(f, 20, 19000);

  // ---------- sdílené buffery / vlny (cache per context) ----------
  const noiseCache = new WeakMap();
  const waveCache = new WeakMap();

  function noiseBuf(c) {
    let b = noiseCache.get(c);
    if (b) return b;
    const n = Math.floor(c.sampleRate * 2);
    b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(c, b);
    return b;
  }

  function harmonics(n, fn) { const a = []; for (let i = 1; i <= n; i++) a.push(fn(i)); return a; }
  const WAVES = {
    flute:  [1, 0.3, 0.1, 0.04, 0.02],
    lute:   harmonics(10, (n) => 1 / Math.pow(n, 1.3)),
    harpsi: harmonics(16, (n) => (1 / Math.pow(n, 0.75)) * (n % 2 ? 1 : 0.7)),
    brass:  harmonics(12, (n) => 1 / Math.pow(n, 0.9)),
  };
  function wave(c, name) {
    let m = waveCache.get(c);
    if (!m) { m = {}; waveCache.set(c, m); }
    if (m[name]) return m[name];
    const spec = WAVES[name] || WAVES.flute;
    const real = new Float32Array(spec.length + 1), imag = new Float32Array(spec.length + 1);
    for (let i = 0; i < spec.length; i++) imag[i + 1] = spec[i];
    m[name] = c.createPeriodicWave(real, imag);
    return m[name];
  }

  // ---------- obálka ----------
  function env(p, t, peak, a, h, dur) {
    peak = Math.max(FLOOR, num(peak, 0.3));
    a = Math.max(0.001, num(a, 0.003));
    const total = Math.max(num(dur, 0.1), a + 0.01);
    h = clamp(num(h, 0), 0, total - a - 0.005);
    p.setValueAtTime(FLOOR, t);
    p.linearRampToValueAtTime(peak, t + a);
    if (h > 0) p.setValueAtTime(peak, t + a + h);
    p.exponentialRampToValueAtTime(FLOOR, t + total);
  }

  // ---------- stavební bloky (fungují nad "hlasem" v = {c, t, pitch, out, reg}) ----------
  // tón: w (typ/vlna), f, f2 (cíl skluzu), slide, slideAt, dur, a, h, g, det, lp/hp/bp(+q, lp2/fe, fslide), vib/vibf, dest
  function T(v, o) {
    const c = v.c, p = v.pitch, t = v.t + (o.t || 0), dur = o.dur || 0.2;
    const osc = c.createOscillator();
    if (BUILTIN[o.w]) osc.type = o.w; else osc.setPeriodicWave(wave(c, o.w || "sine"));
    const f = safeF((o.f || 440) * p);
    osc.frequency.setValueAtTime(f, t);
    if (o.f2) {
      const st = t + (o.slideAt || 0);
      osc.frequency.setValueAtTime(f, st);
      const f2 = safeF(o.f2 * p);
      if (o.lin) osc.frequency.linearRampToValueAtTime(f2, st + (o.slide || dur));
      else osc.frequency.exponentialRampToValueAtTime(f2, st + (o.slide || dur));
    }
    if (o.det) osc.detune.setValueAtTime(o.det, t);
    if (o.vib) {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = o.vibf || 6;
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * o.vib, t + 0.2);
      l.connect(lg); lg.connect(osc.frequency);
      l.start(t); l.stop(t + dur + 0.1); v.reg(l, t + dur + 0.1);
    }
    let node = osc;
    const ff = o.lp || o.hp || o.bp;
    if (ff) {
      const fl = c.createBiquadFilter();
      fl.type = o.lp ? "lowpass" : o.hp ? "highpass" : "bandpass";
      fl.Q.value = o.q || 1;
      fl.frequency.setValueAtTime(safeF(ff), t);
      const fe = o.lp2 || o.fe;
      if (fe) fl.frequency.exponentialRampToValueAtTime(safeF(fe), t + (o.fslide || dur));
      node.connect(fl); node = fl;
    }
    const g = c.createGain();
    env(g.gain, t, o.g, o.a, o.h, dur);
    node.connect(g); g.connect(o.dest || v.out);
    osc.start(t); osc.stop(t + dur + 0.05);
    v.reg(osc, t + dur + 0.05);
    return g;
  }

  // šum: type (lowpass/highpass/bandpass), f, f2, q, fslide, dur, a, h, g, t, dest
  function N(v, o) {
    const c = v.c, t = v.t + (o.t || 0), dur = o.dur || 0.1;
    const src = c.createBufferSource();
    src.buffer = noiseBuf(c); src.loop = true;
    const pf = Math.pow(v.pitch, 0.5);                 // šum reaguje na pitch jen mírně
    const fl = c.createBiquadFilter();
    fl.type = o.type || "bandpass"; fl.Q.value = o.q || 1;
    fl.frequency.setValueAtTime(safeF((o.f || 1000) * pf), t);
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(safeF(o.f2 * pf), t + (o.fslide || dur));
    const g = c.createGain();
    env(g.gain, t, o.g, o.a != null ? o.a : 0.002, o.h, dur);
    src.connect(fl); fl.connect(g); g.connect(o.dest || v.out);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.02);
    v.reg(src, t + dur + 0.02);
    return g;
  }

  // FM (kov, zvonky): f, ratio, idx → idx2 (hloubka modulace v násobcích f), dur, a, h, g, w, t, dest
  function FM(v, o) {
    const c = v.c, t = v.t + (o.t || 0), dur = o.dur || 0.2, f = safeF((o.f || 440) * v.pitch);
    const car = c.createOscillator(); car.type = o.w || "sine"; car.frequency.setValueAtTime(f, t);
    const mod = c.createOscillator(); mod.type = "sine"; mod.frequency.setValueAtTime(safeF(f * (o.ratio || 2)), t);
    const mg = c.createGain();
    mg.gain.setValueAtTime(Math.max(0.01, f * (o.idx || 2)), t);
    mg.gain.exponentialRampToValueAtTime(Math.max(0.01, f * (o.idx2 != null ? o.idx2 : 0.1)), t + dur);
    mod.connect(mg); mg.connect(car.frequency);
    const g = c.createGain();
    env(g.gain, t, o.g, o.a != null ? o.a : 0.002, o.h, dur);
    car.connect(g); g.connect(o.dest || v.out);
    car.start(t); mod.start(t); car.stop(t + dur + 0.02); mod.stop(t + dur + 0.02);
    v.reg(car, t + dur + 0.02); v.reg(mod, t + dur + 0.02);
    return g;
  }

  // měkké zkreslení (tanh) → vrací uzel, do kterého se posílá signál
  function SH(v, k) {
    const c = v.c, n = 1024, curve = new Float32Array(n), norm = Math.tanh(k);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(k * x) / norm; }
    const s = c.createWaveShaper(); s.curve = curve;
    const g = c.createGain(); g.gain.value = 0.8;
    s.connect(g); g.connect(v.out);
    return s;
  }

  // panorama uvnitř efektu (např. přelet letadla)
  function PAN(v, from, to, t, dur) {
    const c = v.c;
    if (!c.createStereoPanner) return v.out;
    const p = c.createStereoPanner();
    p.pan.setValueAtTime(from, v.t + t);
    p.pan.linearRampToValueAtTime(to, v.t + t + dur);
    p.connect(v.out);
    return p;
  }

  // dechový akord (2 rozladěné pily přes lowpass s obálkou filtru)
  function brassChord(v, freqs, t, dur, g, hold) {
    freqs.forEach((f) => {
      T(v, { w: "sawtooth", f, t, dur, a: 0.02, h: hold != null ? hold : dur * 0.55, g, lp: 2800, lp2: 1300, fslide: dur, det: -6 });
      T(v, { w: "sawtooth", f, t, dur, a: 0.02, h: hold != null ? hold : dur * 0.55, g, lp: 2800, lp2: 1300, fslide: dur, det: 6 });
    });
  }
  function timp(v, t, g) {
    T(v, { w: "sine", f: 84, f2: 68, slide: 0.1, t, dur: 0.5, g: g || 0.35 });
    N(v, { type: "lowpass", f: 300, t, dur: 0.06, g: (g || 0.35) * 0.6 });
  }

  // ---------- SFX recepty ----------
  const SFX = {
    ui_click(v) {
      T(v, { w: "sine", f: 1900, f2: 1200, dur: 0.045, g: 0.22 });
      N(v, { type: "highpass", f: 5000, dur: 0.018, g: 0.12 });
    },
    ui_hover(v) {
      T(v, { w: "sine", f: 2600, f2: 2900, dur: 0.04, g: 0.14 });
    },
    ui_error(v) {
      T(v, { w: "square", f: 220, dur: 0.11, g: 0.14, lp: 1400 });
      T(v, { w: "square", f: 165, t: 0.1, dur: 0.17, g: 0.14, lp: 1200 });
      N(v, { type: "lowpass", f: 600, t: 0.1, dur: 0.1, g: 0.06 });
    },
    train(v) {
      N(v, { type: "bandpass", f: 900, q: 2, dur: 0.05, g: 0.3 });
      T(v, { w: "sine", f: 240, f2: 120, dur: 0.07, g: 0.3 });
      T(v, { w: "triangle", f: 660, t: 0.05, dur: 0.07, g: 0.18 });
      T(v, { w: "triangle", f: 990, t: 0.11, dur: 0.12, g: 0.18 });
    },
    spawn(v) {
      N(v, { type: "bandpass", f: 500, f2: 3000, q: 1.2, dur: 0.16, g: 0.14 });
      [523, 659, 784].forEach((f, i) => T(v, { w: "triangle", f, t: 0.03 + i * 0.06, dur: 0.14, g: 0.2 }));
      T(v, { w: "sine", f: 1568, t: 0.21, dur: 0.25, g: 0.14 });
    },
    hit_melee(v) {
      T(v, { w: "sine", f: 170, f2: 55, dur: 0.12, g: 0.55 });
      N(v, { type: "lowpass", f: 500, dur: 0.07, g: 0.5 });
      N(v, { type: "highpass", f: 3000, dur: 0.008, g: 0.25 });
    },
    hit_blade(v) {
      N(v, { type: "bandpass", f: 6500, f2: 1800, q: 1.5, dur: 0.11, g: 0.5 });
      N(v, { type: "highpass", f: 2500, dur: 0.05, g: 0.2 });
      FM(v, { f: 2300, ratio: 1.41, idx: 3, idx2: 0.3, dur: 0.09, g: 0.12 });
    },
    hit_ranged(v) {
      T(v, { w: "sine", f: 320, f2: 110, dur: 0.06, g: 0.4 });
      N(v, { type: "bandpass", f: 1300, q: 1, dur: 0.045, g: 0.4 });
      N(v, { type: "lowpass", f: 900, dur: 0.02, g: 0.3 });
    },
    shot_sling(v) {
      N(v, { type: "bandpass", f: 700, f2: 3200, q: 3, dur: 0.14, a: 0.03, g: 0.45 });
      T(v, { w: "sine", f: 900, f2: 300, t: 0.1, dur: 0.05, g: 0.22 });
    },
    shot_bow(v) {
      T(v, { w: "triangle", f: 175, dur: 0.09, g: 0.35, lp: 1500 });
      T(v, { w: "triangle", f: 350, dur: 0.05, g: 0.15 });
      N(v, { type: "highpass", f: 2500, f2: 7000, dur: 0.12, a: 0.01, g: 0.22 });
    },
    shot_musket(v) {
      N(v, { type: "highpass", f: 900, dur: 0.03, g: 0.8 });
      T(v, { w: "sine", f: 240, f2: 70, dur: 0.22, g: 0.5 });
      N(v, { type: "lowpass", f: 700, f2: 150, dur: 0.3, g: 0.45 });
    },
    shot_rifle(v) {
      N(v, { type: "highpass", f: 3000, dur: 0.012, g: 0.8 });
      N(v, { type: "bandpass", f: 2400, q: 0.8, dur: 0.05, g: 0.5 });
      T(v, { w: "sine", f: 420, f2: 140, dur: 0.07, g: 0.35 });
    },
    shot_cannon(v) {
      const sh = SH(v, 2.5);
      N(v, { type: "highpass", f: 1200, dur: 0.02, g: 0.7, dest: sh });
      T(v, { w: "sine", f: 130, f2: 32, dur: 0.55, g: 0.8, dest: sh });
      N(v, { type: "lowpass", f: 400, f2: 70, dur: 0.5, g: 0.6, dest: sh });
    },
    shot_laser(v) {
      T(v, { w: "sawtooth", f: 1900, f2: 260, dur: 0.14, g: 0.22, lp: 3500, lp2: 800 });
      T(v, { w: "sine", f: 2800, f2: 500, dur: 0.1, g: 0.18 });
      T(v, { w: "square", f: 950, f2: 130, dur: 0.12, g: 0.08, lp: 2000 });
    },
    shot_rocket(v) {
      N(v, { type: "lowpass", f: 500, f2: 3000, dur: 0.4, a: 0.04, g: 0.5 });
      T(v, { w: "sawtooth", f: 85, f2: 190, dur: 0.35, a: 0.03, g: 0.22, lp: 900, vib: 0.03, vibf: 25 });
      N(v, { type: "bandpass", f: 1500, f2: 400, q: 0.7, t: 0.3, dur: 0.3, g: 0.2 });
    },
    shot_catapult(v) {
      T(v, { w: "square", f: 160, f2: 240, dur: 0.17, a: 0.02, g: 0.12, lp: 900, vib: 0.3, vibf: 32 });   // vrzání
      T(v, { w: "sawtooth", f: 65, dur: 0.18, g: 0.14, lp: 400 });
      T(v, { w: "sine", f: 160, f2: 55, t: 0.17, dur: 0.1, g: 0.5 });                                      // rána rámu
      N(v, { type: "lowpass", f: 600, t: 0.17, dur: 0.06, g: 0.4 });
      N(v, { type: "bandpass", f: 250, f2: 1400, q: 2, t: 0.2, dur: 0.3, a: 0.05, g: 0.3 });                // svist
    },
    explosion(v) {
      const sh = SH(v, 3);
      N(v, { type: "highpass", f: 1500, dur: 0.025, g: 0.9, dest: sh });
      N(v, { type: "lowpass", f: 2500, f2: 60, dur: 0.75, g: 0.85, dest: sh });
      T(v, { w: "sine", f: 90, f2: 24, dur: 0.65, g: 0.8, dest: sh });
      N(v, { type: "bandpass", f: 900, q: 0.5, t: 0.05, dur: 0.4, g: 0.3, dest: sh });
    },
    impact_rock(v) {
      N(v, { type: "lowpass", f: 1000, f2: 200, dur: 0.13, g: 0.55 });
      T(v, { w: "sine", f: 210, f2: 65, dur: 0.07, g: 0.45 });
      N(v, { type: "highpass", f: 2000, t: 0.045, dur: 0.008, g: 0.2 });
      N(v, { type: "highpass", f: 2500, t: 0.08, dur: 0.006, g: 0.14 });
    },
    impact_oil(v) {
      N(v, { type: "lowpass", f: 600, f2: 200, dur: 0.12, g: 0.4 });
      N(v, { type: "highpass", f: 3500, dur: 0.5, a: 0.02, g: 0.3 });
      for (let i = 0; i < 4; i++) T(v, { w: "sine", f: 300 + Math.random() * 400, f2: 900, t: 0.08 + i * 0.09 + Math.random() * 0.04, dur: 0.04, g: 0.12 });
    },
    death_human(v) {
      T(v, { w: "sawtooth", f: 150, f2: 85, dur: 0.26, a: 0.02, g: 0.35, bp: 650, q: 3, vib: 0.04, vibf: 9 });
      T(v, { w: "sawtooth", f: 150, f2: 85, dur: 0.26, a: 0.02, g: 0.25, bp: 1150, q: 4 });
      N(v, { type: "bandpass", f: 1600, q: 1, dur: 0.18, a: 0.03, g: 0.12 });
    },
    death_beast(v) {
      const sh = SH(v, 2);
      T(v, { w: "sawtooth", f: 75, f2: 42, dur: 0.65, a: 0.05, g: 0.5, lp: 900, lp2: 250, vib: 0.08, vibf: 28, dest: sh });
      T(v, { w: "sawtooth", f: 37, f2: 24, dur: 0.6, a: 0.05, g: 0.3, lp: 400, dest: sh });
      N(v, { type: "bandpass", f: 450, q: 1.2, dur: 0.55, a: 0.04, g: 0.3, dest: sh });
    },
    death_machine(v) {
      const sh = SH(v, 3);
      FM(v, { f: 420, ratio: 2.71, idx: 12, idx2: 2, dur: 0.38, g: 0.3, dest: sh });
      N(v, { type: "lowpass", f: 1800, f2: 200, dur: 0.4, g: 0.5, dest: sh });
      T(v, { w: "sine", f: 95, f2: 38, dur: 0.3, g: 0.5, dest: sh });
      FM(v, { f: 1200, ratio: 3.9, idx: 6, idx2: 1, t: 0.12, dur: 0.15, g: 0.18, dest: sh });
      FM(v, { f: 760, ratio: 2.3, idx: 8, idx2: 1, t: 0.24, dur: 0.2, g: 0.15, dest: sh });
    },
    coin(v) {
      T(v, { w: "triangle", f: 1047, dur: 0.08, g: 0.3 });
      T(v, { w: "triangle", f: 1568, t: 0.07, dur: 0.3, g: 0.3 });
      T(v, { w: "sine", f: 3136, t: 0.07, dur: 0.2, g: 0.06 });
    },
    evolve(v) {
      for (let i = 0; i < 6; i++) timp(v, i * 0.05, 0.22);
      brassChord(v, [262, 330, 392], 0.3, 0.3, 0.1);
      brassChord(v, [349, 440, 523], 0.55, 0.25, 0.1);
      brassChord(v, [392, 523, 659, 784], 0.78, 0.45, 0.09);
      N(v, { type: "highpass", f: 5000, t: 0.78, dur: 0.45, g: 0.12 });
      T(v, { w: "sine", f: 1568, t: 0.78, dur: 0.45, g: 0.08 });
    },
    special_meteors(v) {
      N(v, { type: "lowpass", f: 120, dur: 2.0, a: 0.15, h: 1.2, g: 0.9 });
      T(v, { w: "sine", f: 38, dur: 2.0, a: 0.2, h: 1.1, g: 0.3, vib: 0.1, vibf: 3 });
      [0.15, 0.5, 0.85, 1.2, 1.5].forEach((t) => {
        N(v, { type: "bandpass", f: 4000, f2: 300, q: 1.5, t, dur: 0.35, a: 0.05, g: 0.35 });
        T(v, { w: "sine", f: 110, f2: 30, t: t + 0.3, dur: 0.25, g: 0.5 });
        N(v, { type: "lowpass", f: 800, f2: 100, t: t + 0.3, dur: 0.2, g: 0.4 });
      });
    },
    special_arrows(v) {
      T(v, { w: "triangle", f: 180, dur: 0.08, g: 0.25 });
      N(v, { type: "highpass", f: 2500, f2: 7000, dur: 0.1, g: 0.2 });
      for (let i = 0; i < 12; i++) {
        const t = 0.1 + i * 0.11 + Math.random() * 0.05, f = 1800 + Math.random() * 1200;
        T(v, { w: "sine", f, f2: f * 0.55, t, dur: 0.14, a: 0.02, g: 0.14 });
        N(v, { type: "bandpass", f: f * 1.1, q: 6, t, dur: 0.12, a: 0.02, g: 0.12 });
        T(v, { w: "sine", f: 260, f2: 90, t: t + 0.15, dur: 0.05, g: 0.22 });
      }
    },
    special_heal(v) {
      [523, 659, 784, 1047, 1319].forEach((f, i) => FM(v, { f, ratio: 3.5, idx: 1.2, idx2: 0.1, t: i * 0.14, dur: 1.2, g: 0.16 }));
      [262, 330, 392].forEach((f) => T(v, { w: "triangle", f, dur: 1.5, a: 0.3, h: 0.6, g: 0.06, lp: 1200 }));
      T(v, { w: "sine", f: 4186, t: 0.6, dur: 0.9, a: 0.3, g: 0.03, vib: 0.01, vibf: 7 });
    },
    special_airstrike(v) {
      const pan = PAN(v, -1, 1, 0, 2.2);
      [55, 55.7, 110.5].forEach((f, i) => T(v, { w: "sawtooth", f, f2: f * 0.8, dur: 2.3, a: 0.4, h: 1.0, g: i === 2 ? 0.1 : 0.16, lp: 500, dest: pan }));
      N(v, { type: "lowpass", f: 300, dur: 2.3, a: 0.4, h: 1.0, g: 0.15, dest: pan });
      [0.55, 0.9, 1.25, 1.6].forEach((t) => {
        T(v, { w: "sine", f: 1500, f2: 500, t: t - 0.3, dur: 0.3, a: 0.05, g: 0.08 });
        const sh = SH(v, 2.5);
        N(v, { type: "lowpass", f: 1800, f2: 80, t, dur: 0.45, g: 0.6, dest: sh });
        T(v, { w: "sine", f: 80, f2: 28, t, dur: 0.4, g: 0.5, dest: sh });
      });
    },
    special_deathray(v) {
      T(v, { w: "sawtooth", f: 70, f2: 1000, dur: 0.95, a: 0.1, h: 0.75, g: 0.2, lp: 300, lp2: 4000, fslide: 0.9, vib: 0.02, vibf: 30 });
      T(v, { w: "sine", f: 140, f2: 2000, dur: 0.95, a: 0.1, h: 0.75, g: 0.12 });
      N(v, { type: "highpass", f: 3000, t: 0.95, dur: 0.12, g: 0.7 });
      T(v, { w: "square", f: 1400, f2: 180, t: 0.95, dur: 0.1, g: 0.25, lp: 3000 });
      const sh = SH(v, 3);
      N(v, { type: "lowpass", f: 500, f2: 50, t: 1.0, dur: 1.2, g: 0.85, dest: sh });
      T(v, { w: "sine", f: 55, f2: 30, t: 1.0, dur: 1.0, g: 0.5, dest: sh });
      N(v, { type: "bandpass", f: 1200, q: 0.6, t: 1.05, dur: 0.35, g: 0.3, dest: sh });
    },
    build(v) {
      for (let i = 0; i < 3; i++) {
        const t = i * 0.19, p = 1 + i * 0.06;
        N(v, { type: "bandpass", f: 2600 * p, q: 1, t, dur: 0.02, g: 0.5 });
        T(v, { w: "sine", f: 420 * p, f2: 150, t, dur: 0.05, g: 0.35 });
        FM(v, { f: 1900 * p, ratio: 2.9, idx: 1.5, idx2: 0.2, t, dur: 0.08, g: 0.12 });
      }
    },
    sell(v) {
      N(v, { type: "bandpass", f: 1500, q: 1, dur: 0.12, g: 0.15 });
      [0, 0.05, 0.095, 0.15, 0.21].forEach((t) => FM(v, { f: 2400 + Math.random() * 900, ratio: 2.4, idx: 1.5, idx2: 0.2, t, dur: 0.14, g: 0.16 }));
    },
    slot(v) {
      T(v, { w: "sine", f: 230, f2: 110, dur: 0.07, g: 0.4 });
      N(v, { type: "bandpass", f: 800, q: 1.5, dur: 0.05, g: 0.35 });
      N(v, { type: "bandpass", f: 700, f2: 300, q: 1, t: 0.1, dur: 0.32, a: 0.05, g: 0.3 });
      T(v, { w: "sine", f: 80, f2: 38, t: 0.42, dur: 0.2, g: 0.6 });
      N(v, { type: "lowpass", f: 250, t: 0.42, dur: 0.16, g: 0.5 });
    },
    base_hit(v) {
      const sh = SH(v, 2);
      N(v, { type: "highpass", f: 1500, dur: 0.012, g: 0.4, dest: sh });
      T(v, { w: "sine", f: 75, f2: 26, dur: 0.45, g: 0.9, dest: sh });
      N(v, { type: "lowpass", f: 260, f2: 50, dur: 0.35, g: 0.6, dest: sh });
    },
    base_warning(v) {
      for (let i = 0; i < 3; i++) {
        const t = i * 0.24;
        T(v, { w: "square", f: 660, t, dur: 0.12, a: 0.01, h: 0.08, g: 0.1, lp: 1800, vib: 0.01, vibf: 20 });
        T(v, { w: "square", f: 520, t: t + 0.12, dur: 0.12, a: 0.01, h: 0.08, g: 0.1, lp: 1800 });
      }
    },
    win(v) {
      timp(v, 0, 0.35);    brassChord(v, [262, 330, 392, 523], 0.0, 0.34, 0.07);
      timp(v, 0.38, 0.35); brassChord(v, [349, 440, 523, 698], 0.38, 0.34, 0.07);
      timp(v, 0.76, 0.35); brassChord(v, [392, 494, 587, 784], 0.76, 0.34, 0.07);
      T(v, { w: "sine", f: 400, f2: 1600, t: 1.08, dur: 0.24, a: 0.02, h: 0.18, g: 0.12 });
      for (let i = 0; i < 5; i++) timp(v, 1.3 + i * 0.06, 0.3);
      brassChord(v, [523, 659, 784, 1047, 1319], 1.3, 1.2, 0.07, 0.75);
      N(v, { type: "highpass", f: 5000, t: 1.3, dur: 1.2, g: 0.12 });
      T(v, { w: "sine", f: 2093, t: 1.3, dur: 1.1, g: 0.05 });
    },
    lose(v) {
      [220, 262, 330].forEach((f) => T(v, { w: "triangle", f, f2: f * 0.94, slideAt: 1.5, slide: 0.9, dur: 2.45, a: 0.3, h: 1.4, g: 0.12, lp: 900 }));
      [[330, 0], [294, 0.4], [262, 0.8], [247, 1.2], [220, 1.6]].forEach(([f, t]) =>
        T(v, { w: "lute", f, t, dur: 0.85, a: 0.01, g: 0.22, lp: 2200, lp2: 900 }));
      T(v, { w: "sine", f: 70, f2: 35, t: 1.6, dur: 0.7, g: 0.4 });
      N(v, { type: "lowpass", f: 200, t: 1.6, dur: 0.3, g: 0.2 });
    },
  };
  const SFX_NAMES = Object.keys(SFX);

  // ---------- hudební nástroje: (c, dest, t, freq, dur, vel) ----------
  const fv = (c, out, t) => ({ c, t, pitch: 1, out, reg() {} });
  const INST = {
    flute(c, d, t, f, dur, v) { const w = fv(c, d, t); T(w, { w: "flute", f, dur: dur + 0.1, a: 0.05, h: dur - 0.1, g: v * 0.5, vib: 0.006, vibf: 5.5 }); N(w, { type: "bandpass", f: 2500, q: 1, dur: 0.07, g: v * 0.05 }); },
    wood(c, d, t, f, dur, v) { const w = fv(c, d, t); T(w, { w: "sine", f, dur: 0.05, g: v * 0.5 }); N(w, { type: "bandpass", f: 2800, q: 2, dur: 0.012, g: v * 0.3 }); },
    logdrum(c, d, t, f, dur, v) { T(fv(c, d, t), { w: "sine", f: f * 1.12, f2: f, slide: 0.05, dur: 0.45, g: v * 0.6 }); },
    djembeLo(c, d, t, f, dur, v) { const w = fv(c, d, t); T(w, { w: "sine", f: 120, f2: 62, slide: 0.06, dur: 0.3, g: v * 0.6 }); N(w, { type: "lowpass", f: 450, dur: 0.04, g: v * 0.3 }); },
    djembeHi(c, d, t, f, dur, v) { const w = fv(c, d, t); T(w, { w: "sine", f: 330, f2: 200, slide: 0.03, dur: 0.1, g: v * 0.35 }); N(w, { type: "bandpass", f: 1800, q: 1, dur: 0.035, g: v * 0.4 }); },
    shaker(c, d, t, f, dur, v) { N(fv(c, d, t), { type: "bandpass", f: 5200, q: 1.2, dur: 0.05, a: 0.01, g: v * 0.18 }); },
    lute(c, d, t, f, dur, v) { T(fv(c, d, t), { w: "lute", f, dur: Math.min(dur * 1.3, 0.7), a: 0.003, g: v * 0.4, lp: 3800, lp2: 1600, fslide: 0.12 }); },
    bassPluck(c, d, t, f, dur, v) { T(fv(c, d, t), { w: "triangle", f, dur: Math.min(dur * 1.2, 0.6), a: 0.005, g: v * 0.6, lp: 700 }); },
    tamb(c, d, t, f, dur, v) { const w = fv(c, d, t); [0, 0.014, 0.034].forEach((o, i) => N(w, { type: "highpass", f: 6000, t: o, dur: 0.07 + i * 0.02, g: v * 0.16 })); },
    frame(c, d, t, f, dur, v) { const w = fv(c, d, t); T(w, { w: "sine", f: 100, f2: 58, slide: 0.08, dur: 0.25, g: v * 0.6 }); N(w, { type: "lowpass", f: 500, dur: 0.04, g: v * 0.25 }); },
    harpsi(c, d, t, f, dur, v) { const w = fv(c, d, t); const dd = Math.min(dur * 1.1 + 0.05, 0.6); T(w, { w: "harpsi", f, dur: dd, a: 0.002, g: v * 0.22, hp: 180 }); T(w, { w: "harpsi", f: f * 2, dur: dd * 0.7, a: 0.002, g: v * 0.07 }); },
    strings(c, d, t, f, dur, v) { const w = fv(c, d, t); [-8, 8].forEach((det) => T(w, { w: "sawtooth", f, det, dur: dur + 0.25, a: 0.15, h: dur - 0.15, g: v * 0.1, lp: 1300 })); },
    timpani(c, d, t, f, dur, v) { const w = fv(c, d, t); T(w, { w: "sine", f: f * 1.06, f2: f, slide: 0.1, dur: 0.8, g: v * 0.6 }); N(w, { type: "lowpass", f: 250, dur: 0.06, g: v * 0.3 }); },
    tabor(c, d, t, f, dur, v) { const w = fv(c, d, t); N(w, { type: "bandpass", f: 1300, q: 0.8, dur: 0.12, g: v * 0.35 }); T(w, { w: "sine", f: 200, f2: 130, slide: 0.05, dur: 0.1, g: v * 0.25 }); },
    brass(c, d, t, f, dur, v) { const w = fv(c, d, t); [-5, 5].forEach((det) => T(w, { w: "sawtooth", f, det, dur: dur + 0.08, a: 0.02, h: dur - 0.05, g: v * 0.16, lp: 2800, lp2: 1500, fslide: 0.15 })); },
    synthbass(c, d, t, f, dur, v) { const w = fv(c, d, t); const dd = Math.min(dur, 0.3); T(w, { w: "square", f, dur: dd, a: 0.004, g: v * 0.28, lp: 650, lp2: 180, fslide: 0.2 }); T(w, { w: "sine", f, dur: dd, a: 0.004, g: v * 0.3 }); },
    kick(c, d, t, f, dur, v) { const w = fv(c, d, t); T(w, { w: "sine", f: 165, f2: 44, slide: 0.07, dur: 0.3, g: v * 0.9 }); N(w, { type: "highpass", f: 2500, dur: 0.008, g: v * 0.2 }); },
    snareTight(c, d, t, f, dur, v) { const w = fv(c, d, t); N(w, { type: "bandpass", f: 2300, q: 0.7, dur: 0.1, g: v * 0.45 }); T(w, { w: "triangle", f: 240, f2: 170, slide: 0.03, dur: 0.06, g: v * 0.25 }); },
    clap(c, d, t, f, dur, v) { const w = fv(c, d, t); [0, 0.011, 0.023, 0.034].forEach((o, i) => N(w, { type: "bandpass", f: 1300, q: 1.2, t: o, dur: i === 3 ? 0.16 : 0.02, g: v * 0.4 })); },
    hat(c, d, t, f, dur, v) { N(fv(c, d, t), { type: "highpass", f: 7500, dur: 0.04, g: v * 0.2 }); },
    hatOpen(c, d, t, f, dur, v) { N(fv(c, d, t), { type: "highpass", f: 6500, dur: 0.22, g: v * 0.18 }); },
    sawpad(c, d, t, f, dur, v) { const w = fv(c, d, t); [-12, 0, 12].forEach((det) => T(w, { w: "sawtooth", f, det, dur: dur + 0.4, a: 0.25, h: dur - 0.1, g: v * 0.09, lp: 1000 })); },
    arpbass(c, d, t, f, dur, v) { T(fv(c, d, t), { w: "sawtooth", f, dur: Math.min(dur + 0.05, 0.22), a: 0.003, g: v * 0.3, lp: 1900, lp2: 320, fslide: 0.12 }); },
    synthlead(c, d, t, f, dur, v) { const w = fv(c, d, t); T(w, { w: "square", f, dur: dur + 0.08, a: 0.01, h: dur - 0.05, g: v * 0.12, lp: 2600, vib: 0.004, vibf: 6 }); T(w, { w: "sawtooth", f, det: 7, dur: dur + 0.08, a: 0.01, h: dur - 0.05, g: v * 0.08, lp: 2200 }); },
  };

  // ---------- mini DSL pro party ----------
  function noteToMidi(s) {
    const m = /^([a-g])(#|b)?(-?\d)$/i.exec(s);
    if (!m) return null;
    const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1].toLowerCase()];
    return 12 * (+m[3] + 1) + base + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  }
  // melodie: tokeny po `tok` krocích; "-" prodlužuje předchozí notu, "." pauza
  function mel(bars, tok, oct) {
    const toks = bars.join(" ").trim().split(/\s+/), out = [];
    let cur = null;
    toks.forEach((tk, i) => {
      if (tk === "-") { if (cur) cur.d += tok; return; }
      cur = null;
      if (tk === ".") return;
      const m = noteToMidi(tk);
      if (m == null) return;
      cur = { step: i * tok, m: m + (oct || 0), d: tok, v: 1 };
      out.push(cur);
    });
    return out;
  }
  // bicí: pole taktů (16 znaků = 16tiny, 8 = osminy); x úder, o tichý, X akcent, r roll (2 údery), y/z 2./3. nota
  function drum(pats, nBars, notes) {
    const out = [];
    for (let bar = 0; bar < nBars; bar++) {
      const s = pats[bar % pats.length], cs = 16 / s.length;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === ".") continue;
        const step = bar * 16 + Math.round(i * cs);
        const idx = ch === "y" ? 1 : ch === "z" ? 2 : 0;
        const m = notes ? notes[idx] : null;
        if (ch === "r") { out.push({ step, m, d: 0.5, v: 0.45 }); out.push({ step, m, d: 0.5, v: 0.5, sub: 0.5 }); }
        else out.push({ step, m, d: 1, v: ch === "o" ? 0.5 : ch === "X" ? 1.15 : 1 });
      }
    }
    return out;
  }
  // arpeggio z akordů: index >= počet tónů = o oktávu výš, -1 pauza
  function arp(chords, pattern, tok, nBars, oct) {
    const out = [];
    for (let bar = 0; bar < nBars; bar++) {
      const ch = chords[bar % chords.length].n, n = ch.length, per = 16 / tok;
      for (let i = 0; i < per; i++) {
        const idx = pattern[i % pattern.length];
        if (idx == null || idx < 0) continue;
        out.push({ step: bar * 16 + i * tok, m: ch[idx % n] + 12 * Math.floor(idx / n) + (oct || 0), d: tok, v: 1 });
      }
    }
    return out;
  }
  // riff nad základním tónem akordu: k-tý úder v taktu = offsets[k] půltónů od kořene
  function riff(chords, rhythm, offsets, nBars, oct, dSteps) {
    const out = [];
    for (let bar = 0; bar < nBars; bar++) {
      const r = chords[bar % chords.length].r, cs = 16 / rhythm.length;
      let k = 0;
      for (let i = 0; i < rhythm.length; i++) {
        const ch = rhythm[i];
        if (ch === ".") continue;
        out.push({ step: bar * 16 + Math.round(i * cs), m: r + offsets[k % offsets.length] + (oct || 0), d: dSteps || cs, v: ch === "o" ? 0.6 : 1 });
        k++;
      }
    }
    return out;
  }
  // celý akord na každém úderu rytmu
  function chordHits(chords, pats, dSteps, nBars, oct) {
    const out = [];
    for (let bar = 0; bar < nBars; bar++) {
      const ch = chords[bar % chords.length].n, s = pats[bar % pats.length], cs = 16 / s.length;
      for (let i = 0; i < s.length; i++) {
        if (s[i] === ".") continue;
        const v = s[i] === "o" ? 0.6 : 1;
        for (const m of ch) out.push({ step: bar * 16 + Math.round(i * cs), m: m + (oct || 0), d: dSteps, v });
      }
    }
    return out;
  }
  // držený akord přes celý takt
  function sustain(chords, nBars, oct) {
    const out = [];
    for (let bar = 0; bar < nBars; bar++) for (const m of chords[bar % chords.length].n) out.push({ step: bar * 16, m: m + (oct || 0), d: 16, v: 1 });
    return out;
  }
  const rest8 = ". . . . . . . .";

  // ---------- témata ----------
  const CH = {
    castle: { Dm: { n: [62, 65, 69], r: 38 }, Bb: { n: [58, 62, 65], r: 34 }, C: { n: [60, 64, 67], r: 36 }, A: { n: [57, 61, 64], r: 33 }, Gm: { n: [58, 62, 67], r: 31 } },
    ren:    { G: { n: [55, 59, 62], r: 43 }, D: { n: [57, 62, 66], r: 38 }, Em: { n: [55, 59, 64], r: 40 }, C: { n: [55, 60, 64], r: 36 }, Bm: { n: [54, 59, 62], r: 47 }, Am: { n: [57, 60, 64], r: 45 } },
    modern: { Cm: { n: [60, 63, 67], r: 36 }, Ab: { n: [56, 60, 63], r: 44 }, Bb: { n: [58, 62, 65], r: 46 }, G: { n: [55, 59, 62], r: 43 } },
    future: { Am: { n: [57, 60, 64], r: 33 }, F: { n: [57, 60, 65], r: 41 }, C: { n: [55, 60, 64], r: 36 }, G: { n: [55, 59, 62], r: 43 } },
  };
  const seq = (map, keys) => keys.split(/\s+/).map((k) => map[k]);

  const THEME_DEFS = [
    { // 0 – Doba kamenná: kmenové bubny, pentatonická flétna, dřívka
      name: "stone", bpm: 104, bars: 16,
      layers: [
        { bus: "core",  inst: "flute",    gain: 0.8,  make: (b) => mel([
          "a4 - c5 - d5 - - -", "e5 - d5 c5 a4 - - -", "g4 - a4 - c5 - - -", "d5 c5 a4 - - - . .",
          "a4 - c5 d5 e5 - - -", "g5 - e5 d5 c5 - d5 -", "e5 - - - d5 c5 a4 -", "g4 - a4 - - - . .",
          "e5 - g5 - e5 - d5 -", "c5 - d5 - e5 - - -", "a5 - g5 e5 d5 - c5 -", "d5 - - - . . . .",
          "a4 c5 d5 - e5 - d5 -", "c5 - a4 - g4 - a4 -", "c5 - d5 - c5 a4 g4 -", "a4 - - - - - . .",
        ], 2) },
        { bus: "core",  inst: "wood",     gain: 0.5,  make: (b) => drum(["x.y..x..x.y..x..", "x.y..x..x.y.xy.."], b, [86, 91]) },
        { bus: "drums", inst: "djembeLo", gain: 0.7,  make: (b) => drum(["x..x....x..x..x.", "x..x....x..x.xx."], b) },
        { bus: "drums", inst: "djembeHi", gain: 0.7,  make: (b) => drum(["..x...o...x...xo"], b) },
        { bus: "bass",  inst: "logdrum",  gain: 0.6,  make: (b) => drum(["x...x...x.x.....", "x...x...x...y..."], b, [45, 43]) },
        { bus: "top",   inst: "shaker",   gain: 0.8,  make: (b) => drum(["o.x.o.x.o.x.o.x."], b) },
      ],
    },
    { // 1 – Hradní věk: loutna, mollová tonina, tamburína
      name: "castle", bpm: 112, bars: 16,
      chords: seq(CH.castle, "Dm Dm Bb Bb C C A A Dm Dm Gm Gm Bb C A A"),
      layers: [
        { bus: "core",  inst: "lute",      gain: 1.0,  make: (b, ch) => mel([
          "d5 - - - e5 - f5 -", "a5 - g5 f5 e5 - - -", "f5 - - - d5 - f5 -", "g5 - f5 e5 d5 - - -",
          "e5 - - - c5 - e5 -", "g5 - e5 - d5 - c5 -", "c#5 - - - e5 - a5 -", "g5 - e5 - c#5 - - -",
          "d5 - f5 - a5 - - -", "d6 - c6 a5 f5 - - -", "g5 - - - bb5 - a5 -", "g5 - f5 - d5 - - -",
          "f5 - d5 - bb4 - d5 -", "e5 - c5 - g5 - e5 -", "c#5 - e5 - a5 - g5 -", "d5 - - - - - . .",
        ], 2) },
        { bus: "core",  inst: "lute",      gain: 0.6,  make: (b, ch) => arp(ch, [0, 1, 2, 3, 2, 1, 0, 1], 2, b, -12) },
        { bus: "bass",  inst: "bassPluck", gain: 0.9,  make: (b, ch) => riff(ch, "x.......x.....x.", [0, 0, 7], b, 0) },
        { bus: "drums", inst: "frame",     gain: 0.9,  make: (b) => drum(["x.....x...x.....", "x.....x...x...x."], b) },
        { bus: "drums", inst: "tamb",      gain: 0.9,  make: (b) => drum(["....x.......x..o"], b) },
        { bus: "top",   inst: "tamb",      gain: 0.5,  make: (b) => drum(["o.o.o.o.o.o.o.o."], b) },
      ],
    },
    { // 2 – Renesance: cembalo, barokní arpeggio, smyčcový pad
      name: "renaissance", bpm: 120, bars: 16,
      chords: seq(CH.ren, "G D Em C G D C D G Bm Em C G Am D G"),
      layers: [
        { bus: "core",  inst: "harpsi",  gain: 1.0,  make: (b) => mel([
          "b4 - d5 - g5 - f#5 -", "a5 - f#5 - d5 - - -", "e5 - g5 - b5 - a5 -", "g5 - e5 - c5 - - -",
          "d5 - g5 - b5 - a5 -", "f#5 - a5 - d6 - c6 -", "b5 - g5 - e5 - c5 -", "a4 - d5 - f#5 - a5 -",
          "g5 - - - d5 - b4 -", "d5 - f#5 - b5 - a5 -", "g5 - e5 - b4 - e5 -", "c5 - e5 - g5 - c6 -",
          "b5 - g5 - d5 - g5 -", "a5 - c6 - e5 - c5 -", "d5 - f#5 - a5 - c6 -", "b5 - g5 - - - . .",
        ], 2) },
        { bus: "core",  inst: "harpsi",  gain: 0.55, make: (b, ch) => arp(ch, [0, 1, 2, 3, 2, 1, 0, 1], 2, b, 0) },
        { bus: "core",  inst: "strings", gain: 0.8,  make: (b, ch) => sustain(ch, b, 0) },
        { bus: "bass",  inst: "harpsi",  gain: 0.8,  make: (b, ch) => arp(ch, [0, 2, 1, 2], 2, b, -12) },
        { bus: "drums", inst: "timpani", gain: 0.7,  make: (b, ch) => riff(ch, "x.......x.......", [0], b, 0, 1) },
        { bus: "drums", inst: "tabor",   gain: 0.6,  make: (b) => drum(["x..x.x..x..x.x..", "x..x.x..x..x.xrr"], b) },
        { bus: "top",   inst: "harpsi",  gain: 0.4,  make: (b, ch) => arp(ch, [-1, 5, -1, 4, -1, 5, -1, 4, -1, 5, -1, 4, -1, 5, 4, 3], 1, b, 12) },
      ],
    },
    { // 3 – Moderní věk: vojenské víření, synth bas, žesťové stab akordy
      name: "modern", bpm: 126, bars: 16,
      chords: seq(CH.modern, "Cm Cm Cm Cm Ab Ab Bb Bb Cm Cm Cm Cm Ab Ab G G"),
      layers: [
        { bus: "core",  inst: "brass",      gain: 0.8,  make: (b, ch) => chordHits(ch, ["x..x..x.........", "..........x...x."], 1.5, b, 0) },
        { bus: "core",  inst: "brass",      gain: 1.0,  make: (b) => mel([
          rest8, rest8, rest8, rest8, rest8, rest8, rest8, rest8,
          "g4 - - - g4 g4 c5 -", "- - - - . . g4 g4", "c5 - eb5 - g5 - - -", "- - - - . . eb5 eb5",
          "g5 - eb5 - c5 - eb5 -", "d5 - - - - - . .", "g4 g4 c5 c5 eb5 eb5 g5 -", "c6 - - - - - . .",
        ], 2, 12) },
        { bus: "bass",  inst: "synthbass",  gain: 0.9,  make: (b, ch) => riff(ch, "x..x..x.x..x..x.", [0, 0, 12, 0, 0, 7, 0], b, 0) },
        { bus: "drums", inst: "kick",       gain: 0.9,  make: (b) => drum(["x...x...x.x.x..."], b) },
        { bus: "drums", inst: "snareTight", gain: 0.9,  make: (b) => drum(["....x.......x...", "....x.......x.rr", "....x.......x...", "....x....rrrrrrr"], b) },
        { bus: "top",   inst: "hat",        gain: 0.8,  make: (b) => drum(["xoxoxoxoxoxoxoxo"], b) },
        { bus: "top",   inst: "snareTight", gain: 0.35, make: (b) => drum(["..o...o...o...o."], b) },
      ],
    },
    { // 4 – Budoucnost: synthwave – rozladěné pily, arpeggiovaný bas, side-chain, 16tinové hi-haty
      name: "future", bpm: 132, bars: 16, pump: true,
      chords: seq(CH.future, "Am F C G Am F C G Am F C G Am F C G"),
      layers: [
        { bus: "pad",   inst: "sawpad",    gain: 1.0,  make: (b, ch) => sustain(ch, b, 0) },
        { bus: "core",  inst: "synthlead", gain: 1.0,  make: (b) => mel([
          rest8, rest8, rest8, rest8, rest8, rest8, rest8, rest8,
          "a4 - c5 - e5 - a5 -", "g5 - e5 - - - c5 -", "f5 - a5 - c6 - a5 -", "g5 - - - e5 - d5 -",
          "c5 - e5 - g5 - c6 -", "b5 - g5 - e5 - d5 -", "b4 - d5 - g5 - b5 -", "a5 - - - - - . .",
        ], 2) },
        { bus: "bass",  inst: "arpbass",   gain: 0.9,  make: (b, ch) => riff(ch, "xxxxxxxxxxxxxxxx", [0, 12, 0, 12, 7, 12, 0, 12], b, 0) },
        { bus: "drums", inst: "kick",      gain: 1.0,  make: (b) => drum(["x...x...x...x..."], b) },
        { bus: "drums", inst: "clap",      gain: 0.8,  make: (b) => drum(["....x.......x..."], b) },
        { bus: "top",   inst: "hat",       gain: 0.9,  make: (b) => drum(["xoxoxoxoxoxoxoxo"], b) },
        { bus: "top",   inst: "hatOpen",   gain: 0.7,  make: (b) => drum(["..............x."], b) },
      ],
    },
  ];
  const THEME_NAMES = THEME_DEFS.map((t) => t.name);
  const BUSES = ["core", "pad", "drums", "bass", "top"];
  const BUS_CURVE = { core: null, pad: null, drums: [0.08, 0.45], bass: [0.3, 0.75], top: [0.6, 1.0] };
  const busLevel = (bus, x) => { const c = BUS_CURVE[bus]; return c ? smooth((x - c[0]) / (c[1] - c[0])) : 1; };

  const compiled = [];
  function theme(idx) {
    if (compiled[idx]) return compiled[idx];
    const def = THEME_DEFS[idx], steps = def.bars * 16;
    const layers = def.layers.map((L) => {
      const ev = new Array(steps);
      for (const e of L.make(def.bars, def.chords)) {
        const s = ((e.step + (L.shift || 0)) % steps + steps) % steps;
        (ev[s] || (ev[s] = [])).push({ f: e.m != null ? mtof(e.m) : 0, d: e.d, v: e.v * (L.gain || 1), sub: e.sub || 0 });
      }
      return { inst: L.inst, bus: L.bus, ev };
    });
    return (compiled[idx] = { name: def.name, bpm: def.bpm, steps, layers, pump: !!def.pump });
  }

  // ---------- sekvencer ----------
  function makeTrack(idx, c, dest, t0, fadeIn) {
    const th = theme(idx);
    const g = c.createGain();
    g.gain.setValueAtTime(FLOOR, t0);
    g.gain.linearRampToValueAtTime(1, t0 + (fadeIn ? XFADE : 0.4));
    g.connect(dest);
    const buses = {};
    for (const b of BUSES) { const bg = c.createGain(); bg.gain.value = busLevel(b, intensity); bg.connect(g); buses[b] = bg; }
    return { idx, th, c, gain: g, buses, step: 0, nextTime: t0, stopAt: Infinity, stepDur: 60 / th.bpm / 4 };
  }

  function scheduleStep(tr, step, t) {
    const th = tr.th, c = tr.c, sd = tr.stepDur;
    for (const L of th.layers) {
      const evs = L.ev[step];
      if (!evs) continue;
      const inst = INST[L.inst], dest = tr.buses[L.bus];
      for (const e of evs) {
        const vel = e.v * (0.9 + Math.random() * 0.2);
        inst(c, dest, t + e.sub * sd, e.f, e.d * sd, vel);
      }
    }
    if (th.pump && step % 4 === 0) {
      const g = tr.buses.pad.gain, depth = 0.3 + 0.4 * intensity;
      g.cancelScheduledValues(t);
      g.setValueAtTime(1, t);
      g.linearRampToValueAtTime(1 - depth, t + 0.012);
      g.linearRampToValueAtTime(1, t + sd * 4 * 0.65);
    }
  }

  function tick() {
    try {
      if (!ctx) return;
      const now = ctx.currentTime;
      const ahead = (global.document && global.document.hidden) ? 1.2 : LOOKAHEAD;   // utlumený tab → plánuj dál dopředu
      for (let i = tracks.length - 1; i >= 0; i--) {
        const tr = tracks[i];
        if (tr.stopAt <= now) { try { tr.gain.disconnect(); } catch (e) {} tracks.splice(i, 1); continue; }
        if (tr.nextTime < now - 0.25) {   // zaspali jsme (throttling) – přeskoč, ale drž fázi smyčky
          const missed = Math.ceil((now - tr.nextTime) / tr.stepDur);
          tr.step = (tr.step + missed) % tr.th.steps;
          tr.nextTime += missed * tr.stepDur;
        }
        while (tr.nextTime < now + ahead) {
          if (tr.nextTime < tr.stopAt) scheduleStep(tr, tr.step, tr.nextTime);
          tr.nextTime += tr.stepDur;
          tr.step = (tr.step + 1) % tr.th.steps;
        }
      }
      if (!tracks.length) stopTimer();
      gcVoices();
    } catch (e) { /* nikdy nevyhazovat */ }
  }
  function startTimer() { if (timer == null) timer = setInterval(tick, TICK_MS); }
  function stopTimer() { if (timer != null) { clearInterval(timer); timer = null; } }

  function fadeOutTrack(tr, now) {
    const g = tr.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(FLOOR, g.value), now);
    g.linearRampToValueAtTime(FLOOR, now + XFADE);
    tr.stopAt = now + XFADE + 0.05;
  }
  function applyMusic() {
    if (!ctx || ctx.state !== "running") return;
    const now = ctx.currentTime;
    const cur = tracks.find((t) => t.stopAt === Infinity);
    if (cur && cur.idx === wantMusic) return;
    if (!cur && wantMusic == null) return;
    if (cur) fadeOutTrack(cur, now);
    if (wantMusic != null) tracks.push(makeTrack(wantMusic, ctx, graph.music, now + 0.03, !!cur));
    startTimer();
  }

  // ---------- graf / mixér ----------
  function buildGraph(c) {
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 12;
    comp.attack.value = 0.002; comp.release.value = 0.12;
    const master = c.createGain(); master.gain.value = MASTER_TRIM;
    comp.connect(master); master.connect(c.destination);
    const sfx = c.createGain(); sfx.gain.value = 1; sfx.connect(comp);
    const music = c.createGain(); music.gain.value = MUSIC_RATIO; music.connect(comp);
    return { comp, master, sfx, music };
  }
  function applyVolumes() {
    if (!ctx || !graph) return;
    const t = ctx.currentTime;
    graph.master.gain.setTargetAtTime(muted ? 0 : vol.master * MASTER_TRIM, t, 0.02);
    graph.sfx.gain.setTargetAtTime(vol.sfx, t, 0.02);
    graph.music.gain.setTargetAtTime(vol.music * MUSIC_RATIO, t, 0.02);
  }

  // ---------- hlasy ----------
  function Voice(c, out, pitch, t) { this.c = c; this.out = out; this.pitch = pitch; this.t = t; this.srcs = []; this.end = t; }
  Voice.prototype.reg = function (src, end) { this.srcs.push(src); if (end > this.end) this.end = end; return src; };
  Voice.prototype.kill = function () {
    const t = this.c.currentTime;
    try { const g = this.gain.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.01); } catch (e) {}
    for (const s of this.srcs) { try { s.stop(t + 0.012); } catch (e) {} }
    this.end = t;
  };
  function gcVoices() {
    if (!ctx) return;
    const now = ctx.currentTime;
    if (voices.some((v) => v.end <= now)) voices = voices.filter((v) => v.end > now);
  }
  function stealVoice() {
    let victim = null;
    for (const v of voices) {
      if (!victim || v.volume < victim.volume || (v.volume === victim.volume && v.start < victim.start)) victim = v;
    }
    if (victim) { victim.kill(); voices = voices.filter((v) => v !== victim); }
  }
  function spawnVoice(c, dest, name, o, t) {
    const rec = SFX[name];
    const volume = clamp(num(o.volume, 1), 0, 1);
    const pitch = clamp(num(o.pitch, 1), 0.25, 4) * (1 + (Math.random() * 2 - 1) * PITCH_JITTER);
    const vg = c.createGain(); vg.gain.value = volume;
    let out = dest;
    const pan = clamp(num(o.pan, 0), -1, 1);
    if (pan !== 0 && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; p.connect(dest); out = p; }
    vg.connect(out);
    const v = new Voice(c, vg, pitch, t);
    v.gain = vg; v.name = name; v.volume = volume; v.start = t;
    rec(v, t);
    return v;
  }

  // ---------- veřejné API ----------
  function init() {
    try {
      if (ctx || !AC) return !!ctx;
      ctx = new AC();
      graph = buildGraph(ctx);
      applyVolumes();
      try { ctx.addEventListener("statechange", () => { try { if (ctx.state === "running") applyMusic(); } catch (e) {} }); } catch (e) {}
      return true;
    } catch (e) { ctx = null; graph = null; return false; }
  }
  function resume() {
    try {
      if (!init()) return Promise.resolve(false);
      if (ctx.state === "running") { applyMusic(); return Promise.resolve(true); }
      return ctx.resume().then(() => { applyMusic(); return ctx.state === "running"; }, () => false);
    } catch (e) { return Promise.resolve(false); }
  }
  function isReady() { try { return !!ctx && ctx.state === "running"; } catch (e) { return false; } }

  function play(name, opts) {
    try {
      if (!ctx || ctx.state !== "running" || muted) return false;
      if (!SFX[name]) return false;
      const ms = nowMs();
      if (ms - (lastStart[name] || -1e9) < THROTTLE_MS) return false;
      lastStart[name] = ms;
      gcVoices();
      while (voices.length >= MAX_VOICES) stealVoice();
      const v = spawnVoice(ctx, graph.sfx, name, opts || {}, ctx.currentTime + 0.005);
      voices.push(v);
      return true;
    } catch (e) { return false; }
  }
  function stopAll() {
    try { for (const v of voices) v.kill(); voices = []; } catch (e) {}
  }

  function setMusic(age) {
    try {
      wantMusic = (age == null || age === false) ? null : clamp(Math.round(num(age, 0)), 0, THEME_DEFS.length - 1);
      applyMusic();   // bez běžícího kontextu si jen pamatuje přání; spustí se po resume()
    } catch (e) {}
  }
  function setIntensity(x) {
    try {
      intensity = clamp(num(x, 0), 0, 1);
      if (!ctx) return;
      const t = ctx.currentTime;
      for (const tr of tracks) for (const b of BUSES) if (b !== "pad") tr.buses[b].gain.setTargetAtTime(busLevel(b, intensity), t, 0.3);
    } catch (e) {}
  }
  function setVolume(o) {
    try {
      if (o) for (const k of ["master", "sfx", "music"]) if (o[k] != null) vol[k] = clamp(num(o[k], vol[k]), 0, 1);
      applyVolumes();
    } catch (e) {}
  }
  function getVolume() { return { master: vol.master, sfx: vol.sfx, music: vol.music }; }
  function setMuted(m) { try { muted = !!m; applyVolumes(); if (muted) stopAll(); } catch (e) {} }
  function isMuted() { return muted; }

  // ---------- offline self-test ----------
  function __renderTest(name, seconds) {
    return new Promise((resolve) => {
      try {
        if (!OAC) return resolve({ name, error: "OfflineAudioContext unavailable" });
        const sr = 44100, secs = clamp(num(seconds, 2), 0.2, 60);
        const oc = new OAC(2, Math.ceil(sr * secs), sr);
        const g = buildGraph(oc);
        if (/^music:/.test(String(name))) {
          const idx = clamp(Math.round(+String(name).slice(6)) || 0, 0, THEME_DEFS.length - 1);
          const keep = intensity; intensity = 1;
          const tr = makeTrack(idx, oc, g.music, 0.02, false);
          intensity = keep;
          for (const b of BUSES) tr.buses[b].gain.value = 1;
          while (tr.nextTime < secs) { scheduleStep(tr, tr.step, tr.nextTime); tr.nextTime += tr.stepDur; tr.step = (tr.step + 1) % tr.th.steps; }
        } else {
          if (!SFX[name]) return resolve({ name, error: "unknown sfx" });
          spawnVoice(oc, g.sfx, name, { pitch: 1, volume: 1 }, 0.02);
        }
        oc.startRendering().then((buf) => {
          let peak = 0, sum = 0, n = 0;
          for (let ch = 0; ch < buf.numberOfChannels; ch++) {
            const d = buf.getChannelData(ch);
            for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; }
            n += d.length;
          }
          resolve({ name, seconds: secs, peak, rms: Math.sqrt(sum / Math.max(1, n)) });
        }, (e) => resolve({ name, error: String(e) }));
      } catch (e) { resolve({ name, error: String(e) }); }
    });
  }
  function __stats() {
    return { voices: voices.length, tracks: tracks.length, state: ctx ? ctx.state : "none", music: wantMusic, intensity };
  }

  const API = {
    init, resume, isReady, play, stopAll,
    setMusic, setIntensity,
    setVolume, getVolume, setMuted, isMuted,
    names: () => SFX_NAMES.slice(), themes: () => THEME_NAMES.slice(),
    __renderTest, __stats,
  };
  global.AoWAudio = API;
})(typeof window !== "undefined" ? window : globalThis);
