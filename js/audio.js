/* ============================================================
   Věky Války – zvuky (WebAudio, syntéza bez assetů)
   API: Sound.play(name), Sound.setMuted(b), Sound.isMuted(), Sound.resume()
   Vše je odolné: když AudioContext není k dispozici, tiše nic nedělá.
   ============================================================ */
(function (global) {
  "use strict";

  let ctx = null, master = null, muted = false;
  const lastPlay = {};

  function ensure() {
    if (ctx) return;
    try {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
  }
  function resume() {
    ensure();
    if (ctx && ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
  }

  function tone(freq, dur, type, when, vol) {
    if (!ctx) return;
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || "square";
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, cutoff) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    n.buffer = buf;
    const g = ctx.createGain(); g.gain.value = vol || 0.2;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = cutoff || 1200;
    n.connect(f); f.connect(g); g.connect(master);
    n.start(t); n.stop(t + dur);
  }

  const SFX = {
    hire() { tone(440, 0.08, "square", 0, 0.16); tone(660, 0.08, "square", 0.05, 0.12); },
    tower() { tone(300, 0.08, "sawtooth", 0, 0.14); tone(200, 0.1, "sawtooth", 0.05, 0.12); },
    evolve() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.13, "triangle", i * 0.07, 0.18)); },
    meteor() { noise(0.5, 0.3, 900); tone(80, 0.5, "sawtooth", 0, 0.22); tone(60, 0.6, "sine", 0.05, 0.2); },
    shot() { tone(900, 0.04, "square", 0, 0.05); },
    hit() { noise(0.06, 0.1, 1600); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, "triangle", i * 0.1, 0.2)); },
    lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.22, "sawtooth", i * 0.12, 0.18)); },
  };

  function play(name) {
    if (muted) return;
    resume();
    if (!ctx) return;
    if (name === "shot" || name === "hit") {
      const now = ctx.currentTime || 0;
      if (lastPlay[name] && now - lastPlay[name] < 0.07) return;
      lastPlay[name] = now;
    }
    try { (SFX[name] || function () {})(); } catch (e) {}
  }

  global.Sound = {
    play,
    resume,
    setMuted(m) { muted = !!m; },
    isMuted() { return muted; },
  };
})(typeof window !== "undefined" ? window : globalThis);
