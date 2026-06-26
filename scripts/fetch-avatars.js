// 离线头像:抓每位人物的维基缩略图 → 压缩 → base64 存 data/avatars.json。
// gen-bloodline.js 把它内联进节点数据,彻底去掉运行时对 en.wikipedia.org 的 fetch(大陆友好)。
// 重跑:node scripts/fetch-avatars.js  (用 curl + sips,失败的人物留空→渲染回退首字母)
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "hinton-sample.json"), "utf8"));
const OUT = path.join(__dirname, "..", "data", "avatars.json");
const TMP = "/tmp/av"; fs.mkdirSync(TMP, { recursive: true });
const ORG = new Set(["University of Toronto", "Google", "Vector Institute"]);
const people = DATA.persons.filter(p => !ORG.has(p.id));

// execFileSync + 参数数组:不经 shell,缩略图 URL 等数据无法注入命令
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { timeout: 30000, maxBuffer: 1 << 25, ...opts });
// Wikipedia/Wikimedia 强制要求描述性 User-Agent,否则返回限流页 → 必须带 UA
const UA = "ai-bloodline/1.0 (https://github.com/RyanYunweiYan/ai-bloodline; offline avatar fetch)";
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const out = {};
let ok = 0, miss = 0;
for (let i = 0; i < people.length; i++) {
  const p = people[i], name = p.name_en;
  if (prev[name]) { out[name] = prev[name]; ok++; continue; } // 复用已抓到的,可断点续跑
  try {
    const api = "https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=240&redirects=1&titles=" + encodeURIComponent(name) + "&origin=*";
    const j = JSON.parse(run("curl", ["-sL", "-A", UA, "--max-time", "20", api], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
    const pg = Object.values(j.query.pages)[0];
    const src = pg && pg.thumbnail ? pg.thumbnail.source : null;
    if (!src) { miss++; console.log(`  ✗ ${name} (无缩略图)`); continue; }
    const raw = path.join(TMP, i + ".img"), jpg = path.join(TMP, i + ".jpg");
    run("curl", ["-sL", "-A", UA, "--max-time", "25", src, "-o", raw], { stdio: "ignore" });
    run("sips", ["-Z", "110", "-s", "format", "jpeg", "-s", "formatOptions", "62", raw, "--out", jpg], { stdio: "ignore" });
    const b64 = fs.readFileSync(jpg).toString("base64");
    out[name] = "data:image/jpeg;base64," + b64;
    ok++; console.log(`  ✓ ${name} (${Math.round(b64.length / 1024)}KB)`);
  } catch (e) { miss++; console.log(`  ✗ ${name} (${String(e.message).slice(0, 40)})`); }
}
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`\n完成: ${ok} 有头像 / ${miss} 缺 / 共 ${people.length} 人 · avatars.json ${Math.round(fs.statSync(OUT).size / 1024)}KB`);
