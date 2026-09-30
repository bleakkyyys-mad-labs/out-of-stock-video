// The rig: the camera, type layers put into the world, the backdrop, the HUD. Shared by the director's shots and
// the intro (intro.js). Moved here verbatim from director.js (9/27) when the intro became its own module.
import * as THREE from "three";
import * as song from "./song.js";
import { font, MONO } from "./type.js";

const _v = new THREE.Vector3(), _e = new THREE.Euler();

export function camera(S, pos, look, roll = 0, fov = 35) {
  const c = S.camera;
  c.fov = fov; c.position.set(pos[0], pos[1], pos[2]);
  c.up.set(Math.sin(roll), Math.cos(roll), 0);
  c.lookAt(look[0], look[1], look[2]);
  c.updateProjectionMatrix();
}
// put canvas pixel (px, py) of a type layer at world point w; returns the cleared 2D context
export function anchor(L, px, py, w, rot = [0, 0, 0], scale = 1) {
  const g = L.mesh.geometry.parameters;
  _v.set((px / L.canvas.width - 0.5) * g.width * scale, (0.5 - py / L.canvas.height) * g.height * scale, 0).applyEuler(_e.set(...rot));
  L.mesh.position.set(w[0] - _v.x, w[1] - _v.y, w[2] - _v.z);
  L.mesh.rotation.set(...rot); L.mesh.scale.setScalar(scale); L.mesh.visible = true;
  return L.begin();
}
export function backdrop(S, mode, o = {}) {
  const u = S.bg.material.uniforms;
  u.mode.value.set(...mode); u.hazeAmt.value = o.haze ?? 0.35; u.grid.value = o.grid ?? 0;
  u.shaft.value.set(...(o.shaft ?? [0.62, 1.2, 0.18, 0]));
}

// ---------- HUD: the thin furniture that makes it feel instrumented ----------
export function hud(S, t, o = {}, extra) {
  const L = S.hud, c = L.begin(), col = o.color ?? "rgba(233,228,216,0.55)", W = L.canvas.width, H = L.canvas.height;
  L.mesh.visible = true;
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2;
  const tick = (x, y, dx, dy) => { c.beginPath(); c.moveTo(x + dx * 26, y); c.lineTo(x, y); c.lineTo(x, y + dy * 26); c.stroke(); };
  tick(40, 40, 1, 1); tick(W - 40, 40, -1, 1); tick(40, H - 40, 1, -1); tick(W - 40, H - 40, -1, -1);
  c.globalAlpha = 1 - (o.bare ?? 0);           // bare: the labels, the time and the bar fade out (the corners stay)
  c.font = font(15, MONO, "600"); c.textBaseline = "alphabetic";
  if (o.left) { c.textAlign = "left"; c.fillText(o.left, 64, 62); }
  if (o.right) { c.textAlign = "right"; c.fillText(o.right, W - 64, 62); }
  const x0 = 64, x1 = W - 64, y = H - 58, p = t / song.END;
  const ba = 1 - (o.bare ?? 0);
  c.globalAlpha = 0.35 * ba; c.fillRect(x0, y, x1 - x0, 1); c.globalAlpha = ba;
  c.fillRect(x0 + (x1 - x0) * p - 1, y - 7, 3, 15);
  const mmss = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`;
  c.textAlign = "left"; c.fillText(`${mmss(t)} / ${mmss(song.END)}`, x0, y - 14);
  c.textAlign = "right"; c.fillText(o.tag ?? "OOS-0426", x1, y - 14);
  c.globalAlpha = 1;
  if (extra) { c.save(); extra(c); c.restore(); }
  L.end();
}
