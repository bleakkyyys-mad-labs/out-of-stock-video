// Loopback-only static server for the video workspace (preview + headless renders). No dependencies.
//   node tools/serve.mjs [port]      -> http://127.0.0.1:5630/        (the song is served at /audio/OOM.wav)
// Byte ranges are supported: browsers need 206 responses to seek inside audio.
import http from "http";
import fs from "fs";
import path from "path";
import url from "url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const SONG = process.env.OOS_SONG ? path.resolve(process.env.OOS_SONG) : path.resolve(ROOT, "..", "suno-songs", "out-of-stock", "OOM.wav");   // the song is not in the repo: OOS_SONG=<path to the WAV>
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".ttf": "font/ttf", ".wav": "audio/wav", ".css": "text/css", ".mp4": "video/mp4" };

export function serve(port = 5630) {
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "index.html";
    const file = rel === "audio/OOM.wav" ? SONG : path.join(ROOT, path.normalize(rel));
    if (file !== SONG && !file.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404).end(); return; }
      const head = { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store", "Accept-Ranges": "bytes" };
      const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
      let start = 0, end = st.size - 1, code = 200;
      if (m && (m[1] || m[2])) {
        if (m[1]) { start = +m[1]; if (m[2]) end = Math.min(+m[2], end); } else start = Math.max(0, st.size - +m[2]);
        if (start > end || start >= st.size) { res.writeHead(416, { "Content-Range": `bytes */${st.size}` }).end(); return; }
        code = 206; head["Content-Range"] = `bytes ${start}-${end}/${st.size}`;
      }
      head["Content-Length"] = end - start + 1;
      res.writeHead(code, head);
      if (req.method === "HEAD") { res.end(); return; }
      const s = fs.createReadStream(file, { start, end });
      s.on("error", () => res.destroy());
      res.on("close", () => s.destroy());      // a browser aborting a range request is normal
      s.pipe(res);
    });
  });
  return new Promise((resolve, reject) => { srv.once("error", reject); srv.listen(port, "127.0.0.1", () => resolve(srv)); });
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
  const port = +process.argv[2] || 5630;
  serve(port).then(() => console.log(`serving ${ROOT} at http://127.0.0.1:${port}/ (loopback only) · preview: http://127.0.0.1:${port}/?play`));
}
