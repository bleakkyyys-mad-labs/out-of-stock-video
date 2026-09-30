// Live preview against the song. Playback runs through Web Audio: getOutputTimestamp() says which sample the
// speakers are playing at this performance.now(), so the picture follows what you HEAR at the display's
// refresh rate (an <audio> element's currentTime only ticks ~10-15x a second).
//   http://127.0.0.1:5630/?play   space = play/pause · left/right = 5 s · 1-9 = jump to a section · click or drag the strip
// Play unlocks after the song is decoded and the warm-up has rendered every look once.
import * as song from "./song.js";

class Transport {
  constructor(ctx, buf) { this.ctx = ctx; this.buf = buf; this.offset = 0; this.src = null; this.gain = null; this.start = 0; this.listeners = []; }
  get playing() { return !!this.src; }
  heard() {                                   // context time of the sample leaving the speakers right now
    const ts = this.ctx.getOutputTimestamp ? this.ctx.getOutputTimestamp() : null;
    return ts && ts.performanceTime > 0 ? ts.contextTime + (performance.now() - ts.performanceTime) / 1000 : this.ctx.currentTime;
  }
  now() { return this.src ? Math.min(song.END, this.offset + Math.max(0, this.heard() - this.start)) : this.offset; }
  async play() {
    if (this.src) return;
    if (this.offset >= song.END - 0.05) this.offset = 0;
    await this.ctx.resume();
    const s = this.ctx.createBufferSource(), g = this.gain = this.ctx.createGain();
    s.buffer = this.buf; s.connect(g); g.connect(this.ctx.destination);
    this.start = this.ctx.currentTime + 0.05;
    // the video's end (song.js): full until FADE0, a straight fade to silence at END, where the sound stops
    const at = tt => this.start + tt - this.offset;
    g.gain.setValueAtTime(song.fadeAt(this.offset), this.start);
    if (this.offset < song.FADE0) g.gain.setValueAtTime(1, at(song.FADE0));
    g.gain.linearRampToValueAtTime(0, at(song.END));
    s.start(this.start, this.offset, song.END - this.offset);
    s.onended = () => { if (this.src === s) { this.offset = song.END; this.src = null; this.emit(); } };
    this.src = s; this.emit();
  }
  pause() {
    if (!this.src) return;
    const s = this.src; this.offset = this.now(); this.src = null; s.onended = null; s.stop(); this.emit();
  }
  seek(t) { const was = this.playing; this.pause(); this.offset = Math.max(0, Math.min(song.END, t)); if (was) this.play(); else this.emit(); }
  toggle() { if (this.playing) this.pause(); else this.play(); }
  onChange(f) { this.listeners.push(f); }
  emit() { this.listeners.forEach(f => f(this)); }
}

export function preview(render, warm) {
  document.body.classList.add("preview");
  const bar = document.createElement("div");
  bar.id = "bar";
  bar.innerHTML = `<button id="pp" aria-label="Play or pause" disabled>&#9654;</button><span id="tc"></span><canvas id="strip" height="44" aria-label="Song timeline"></canvas><span id="fps"></span>`;
  document.body.appendChild(bar);
  const pp = bar.querySelector("#pp"), tc = bar.querySelector("#tc"), strip = bar.querySelector("#strip"), fpsEl = bar.querySelector("#fps");
  const sc = strip.getContext("2d");
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`;
  const COL = { intro: "#5b5866", verse: "#ffb21e", chorus: "#ff2a3d" };

  function drawStrip(t) {
    const w = strip.clientWidth;
    if (strip.width !== w) strip.width = w;
    sc.clearRect(0, 0, w, 44);
    sc.fillStyle = "#1c1a22"; sc.fillRect(0, 19, w, 6);
    for (const s of song.sections) {
      sc.fillStyle = COL[s.kind] || "#444";
      sc.fillRect(s.t0 / song.END * w, 19, Math.max(2, (s.t1 - s.t0) / song.END * w), 6);
    }
    sc.fillStyle = "#fff"; sc.fillRect(Math.round(t / song.END * w) - 1, 6, 2, 32);
  }

  // playback stats for the headless check: rendered frames, longest gap between them, distinct clock values
  const stats = window.OOS_STATS = { frames: 0, maxGap: 0, distinct: 0 };
  let T = null, last = -1, frames = 0, since = performance.now(), prevNow = 0;
  function loop() {
    const t = T.now(), nowMs = performance.now();
    if (T.playing) { if (prevNow) stats.maxGap = Math.max(stats.maxGap, nowMs - prevNow); prevNow = nowMs; } else prevNow = 0;
    if (t !== last) { render(t); last = t; frames++; stats.frames++; stats.distinct++; }
    drawStrip(t);
    tc.textContent = `${fmt(t)} / ${fmt(song.END)}`;
    if (nowMs - since >= 1000) { fpsEl.textContent = T.playing ? `${frames} fps` : ""; frames = 0; since = nowMs; }
    requestAnimationFrame(loop);
  }

  tc.textContent = "loading the song…";
  const ctx = new AudioContext({ latencyHint: "playback" });
  const decoded = fetch("audio/OOM.wav").then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b));
  const warmed = warm((i, n) => { tc.textContent = `warming up ${i}/${n}…`; });
  Promise.all([decoded, warmed]).then(([buf, w]) => {
    T = window.OOS_TRANSPORT = new Transport(ctx, buf);
    window.OOS_WARMED = w;
    T.onChange(t => { pp.innerHTML = t.playing ? "&#10074;&#10074;" : "&#9654;"; });
    pp.disabled = false;
    pp.addEventListener("click", () => { T.toggle(); pp.blur(); });
    const seek = e => { const r = strip.getBoundingClientRect(); T.seek((e.clientX - r.left) / r.width * song.END); };
    strip.addEventListener("pointerdown", e => { seek(e); strip.setPointerCapture(e.pointerId); strip.onpointermove = seek; });
    strip.addEventListener("pointerup", () => { strip.onpointermove = null; });
    addEventListener("keydown", e => {
      if (e.code === "Space") { e.preventDefault(); T.toggle(); }
      else if (e.code === "ArrowLeft") T.seek(T.now() - 5);
      else if (e.code === "ArrowRight") T.seek(T.now() + 5);
      else if (/^Digit[1-9]$/.test(e.code)) { const s = song.sections[+e.code.slice(5) - 1]; if (s) T.seek(s.t0 - 0.6); }
    });
    requestAnimationFrame(loop);
  }, err => { tc.textContent = "could not load the song: " + err.message; });
}
