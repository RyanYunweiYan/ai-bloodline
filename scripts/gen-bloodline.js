// 「思想血脉家谱」3D web app v1 —— 自包含单文件 HTML,桌面优先,可录屏。
// 骨架:血脉树为骨(Y=辈分/era 老在顶、X=血脉家族列、Z景深) + 机构上色(节点光环) + 横向边跨支分色。
// 去中心:12 种子根 + Hinton 点亮。边按 significance 加权(strong亮粗/medium暗细/weak默认隐,点节点展开)。
// 时间:底部滑块 + 播放→生长动画(边按 time_start 一条条点亮、从根往下长)。深空发光。
const fs = require("fs"), path = require("path");
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "hinton-sample.json"), "utf8"));
// 渲染库自包含内联(去掉 esm.sh/CDN 运行时依赖,大陆友好):three + 3d-force-graph 打成 IIFE 挂 window。
// 产物由 esbuild 从 scripts/_libs-entry.js 打包,见该文件顶部重建命令。
const LIBS = fs.readFileSync(path.join(__dirname, "vendor-libs.iife.js"), "utf8").replace(/<\/script/gi, "<\\/script");
// 离线头像(data:URL):内联进节点,去掉运行时维基 fetch。缺的人回退首字母。见 scripts/fetch-avatars.js
const AVATARS = (() => { const f = path.join(__dirname, "..", "data", "avatars.json"); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {}; })();

const ORG_IDS = new Set(["University of Toronto", "Google", "Vector Institute"]);
const PEOPLE = DATA.persons.filter(p => !ORG_IDS.has(p.id));
const PID = new Set(PEOPLE.map(p => p.id));
const REL = DATA.relationships.filter(r => PID.has(r.person_a) && PID.has(r.person_b)); // 仅人-人边
// 12 种子根 + Hinton:既是"点亮的多亮核",也是血脉家族的根(rootOf 在此停,避免整支上溯到 Coulson 挤成单巨柱)
const SEEDS = new Set(["Geoffrey Hinton", "Demis Hassabis", "Wojciech Zaremba", "Yoshua Bengio", "Fei-Fei Li", "Shane Legg", "Andrew Ng", "Ian Goodfellow", "Andrej Karpathy", "Mustafa Suleyman", "Dario Amodei", "Quoc Le", "John Schulman"]);

// ── 机构归属(沿用样本逻辑:原25人手调 + 新人物 org_hint→机构,FOLD 合并单点) ──
const CLUSTER = { "Geoffrey Hinton": "Toronto", "Christopher Longuet-Higgins": "Toronto", "Charles Coulson": "Toronto", "Radford Neal": "Toronto", "Ruslan Salakhutdinov": "Toronto", "Brendan Frey": "Toronto", "Graham Taylor": "Toronto", "Richard Zemel": "Toronto", "Raquel Urtasun": "Toronto", "Alex Krizhevsky": "Google", "George Dahl": "Google", "Jeff Dean": "Google", "Yee Whye Teh": "DeepMind", "Vinod Nair": "DeepMind", "Alex Graves": "DeepMind", "Volodymyr Mnih": "DeepMind", "Oriol Vinyals": "DeepMind", "Sam Altman": "OpenAI", "Greg Brockman": "OpenAI", "Ilya Sutskever": "SSI", "Daniel Gross": "SSI", "Daniel Levy": "SSI", "Yann LeCun": "Meta", "Nitish Srivastava": "Apple", "Navdeep Jaitly": "Google" };
const FOLD = { "Tesla": "xAI", "Max Planck": "Toronto", "University of British Columbia": "Toronto", "Alignment Research Center": "Anthropic", "Anyscale": "UC Berkeley", "NYU": "MILA", "Vector Institute": "Toronto", "University of Toronto": "Toronto", "Google": "Google", "Essential AI": "新锐AI", "Adept": "新锐AI", "Sakana AI": "新锐AI" };
const instOf = p => CLUSTER[p.id] || FOLD[p.org_hint] || p.org_hint || "其他";
// 机构 → 光环色(柔和、与边色不撞;边色才是饱和线条)
const INST_COLOR = {
  Toronto: "#7fb2ff", MILA: "#b89bff", Google: "#ff9ec2", DeepMind: "#5fd0e8", OpenAI: "#9be8b0",
  Stanford: "#ffd58a", Caltech: "#e0a36b", "UC Berkeley": "#ffb38a", Anthropic: "#ff8f6b",
  SSI: "#c0c8ff", Meta: "#6fa8ff", Apple: "#cfd6e0", NVIDIA: "#9ee88a", Microsoft: "#8fd0ff",
  IDSIA: "#d8b0ff", xAI: "#c96bff", "Thinking Machines": "#ff8fd0",
  Cohere: "#d98fa8", "Character.AI": "#86c9aa", "新锐AI": "#aaa6d0", 其他: "#9aa6c0",
};
const instColor = inst => INST_COLOR[inst] || "#9aa6c0";

const BIRTH_EST = { "Graham Taylor": 1981, "Vinod Nair": 1982, "Navdeep Jaitly": 1985, "George Dahl": 1986, "Nitish Srivastava": 1988, "Alex Graves": 1980, "Volodymyr Mnih": 1984, "Daniel Levy": 1990 };

// ── 边:per-edge 派生 _yr(time_start) + significance(52有/81按type兜底) ──
const TYPE_SIG = { 师承: "strong", 联创: "strong", 决裂: "strong", 收购: "strong", 同事: "medium", 投资: "medium", 同门: "weak", 其他: "weak" };
const links = REL.map(r => ({
  ...r, source: r.person_a, target: r.person_b, _yr: (r.time_start || r.time_end || 0),
  sig: r.significance || TYPE_SIG[r.relation_type] || "medium",
}));

// ── 血脉家族 + era + 确定性布局(fx家族列 / fy辈分era / fz景深) ──
const byId = {}; PEOPLE.forEach(p => byId[p.id] = { ...p });
const parents = {}, children = {};
for (const l of links) if (l.relation_type === "师承") { (children[l.person_a] = children[l.person_a] || []).push(l.person_b); (parents[l.person_b] = parents[l.person_b] || []).push(l.person_a); }
const inflOf = id => byId[id]?.influence ?? 0.4;
function rootOf(id, seen = new Set()) { // 沿师承上溯到最近的种子根;无种子祖先则到最顶根
  if (SEEDS.has(id)) return id;            // 在种子处停 → 种子即家族根
  if (seen.has(id)) return id; seen.add(id);
  const ps = parents[id]; if (!ps || !ps.length) return id;
  const best = ps.slice().sort((a, b) => inflOf(b) - inflOf(a))[0];
  return rootOf(best, seen);
}
// 邻接(任意边,用于给无师承者归族)
const NB = {}; PEOPLE.forEach(p => NB[p.id] = []); for (const l of links) { NB[l.person_a].push(l.person_b); NB[l.person_b].push(l.person_a); }
const family = {};
PEOPLE.forEach(p => { if (parents[p.id] || children[p.id]) family[p.id] = rootOf(p.id); }); // 师承网内→根
// 无师承者:传播——取已归族邻居中影响力最高者的族,迭代
for (let pass = 0; pass < 6; pass++) for (const p of PEOPLE) {
  if (family[p.id]) continue;
  const asn = NB[p.id].filter(n => family[n]).sort((a, b) => inflOf(b) - inflOf(a));
  if (asn.length) family[p.id] = family[asn[0]];
}
// 仍无族者:按连通块各自成族(根=块内影响力最高)
PEOPLE.forEach(p => { if (!family[p.id]) family[p.id] = p.id; });

const eraOf = p => p.birth_year ?? BIRTH_EST[p.id] ?? null;
const earliestEdgeYr = {}; for (const l of links) if (l._yr > 0) { for (const k of [l.person_a, l.person_b]) earliestEdgeYr[k] = Math.min(earliestEdgeYr[k] ?? 9999, l._yr); }
const eraVal = p => eraOf(p) ?? ((earliestEdgeYr[p.id] ?? 1995) - 28);
const hash = s => { let x = 9; for (const c of s) x = (x * 33 + c.charCodeAt(0)) >>> 0; return x; };
// Y = 按 era 全局排名均匀铺(老在顶),避免现代扎堆;同 era 用 id hash 破平
const YTOP = 520, YBOT = -520;
const sortedEra = [...PEOPLE].sort((a, b) => eraVal(a) - eraVal(b) || (hash(a.id) - hash(b.id)));
const yRank = {}; sortedEra.forEach((p, i) => yRank[p.id] = i);
const rankY = id => YTOP + (YBOT - YTOP) * (yRank[id] / Math.max(1, PEOPLE.length - 1));

// 家族列:按"根的 era"从左到右(老左),每族一 X 列
const fams = [...new Set(PEOPLE.map(p => family[p.id]))];
const famEra = f => eraVal(byId[f] || { birth_year: 1970 });
const famSize = {}; PEOPLE.forEach(p => famSize[family[p.id]] = (famSize[family[p.id]] || 0) + 1);
fams.sort((a, b) => famEra(a) - famEra(b) || famSize[b] - famSize[a]);
const XSPAN = 1440; const famX = {};
fams.forEach((f, i) => { famX[f] = -XSPAN / 2 + (XSPAN * (fams.length === 1 ? 0.5 : i / (fams.length - 1))); });

PEOPLE.forEach(p => {
  const n = byId[p.id]; const f = family[p.id]; const hh = hash(p.id);
  const band = Math.max(18, Math.min(54, 12 + famSize[f] * 3.2)); // 族内 X 抖动收紧→师承成纵向主干
  n.__inst = instOf(p);
  n.__era = eraVal(p);
  n.fy = rankY(p.id) + (((hh >> 3) % 60) / 60 - 0.5) * 22;
  n.fx = famX[f] + (((hh) % 100) / 100 - 0.5) * band;
  n.fz = (((hh >> 6) % 100) / 100 - 0.5) * 440; // 景深(Z 拉开,做纵深/景深虚化)
  n.__family = f;
});
// 横向边各自一个 3D 弧面旋转角(确定性 hash),避免某视角叠线糊成一团
links.forEach(l => { l.__rot = l.relation_type === "师承" ? 0 : ((hash(l.person_a + l.person_b) % 628) / 100); });

// 节点进入年(生长动画用)= 最早边年份;无边用 era
for (const p of PEOPLE) { const n = byId[p.id]; n.__entry = earliestEdgeYr[p.id] ?? n.__era; }

PEOPLE.forEach(p => byId[p.id].__seed = SEEDS.has(p.id));

// 祖师度:师承"徒子徒孙"的传递闭包规模 → 驱动"根亮叶暗"(根=后代多→大而亮;叶=没后代→小而暗)。
// 比 SEEDS(家族列锚点,混了中生代大厂创始人)更贴炸点①"根就那么几个人、大厂核心都是徒子徒孙"。
const descCount = {};
for (const p of PEOPLE) {
  const set = new Set(); const stack = [...(children[p.id] || [])];
  while (stack.length) { const x = stack.pop(); if (set.has(x)) continue; set.add(x); for (const c of (children[x] || [])) stack.push(c); }
  descCount[p.id] = set.size;
}
const maxDesc = Math.max(1, ...PEOPLE.map(p => descCount[p.id]));
PEOPLE.forEach(p => { const n = byId[p.id]; n.__desc = descCount[p.id]; n.__root = descCount[p.id] / maxDesc; });

// 世代轴:在 rank 布局上标真实出生世代(越上越早),让"时间映射纵轴"可读。
// 用 rank-Y(避免现代扎堆),decade 边界落在各自 rank 位置→线距不均反而显出"近年人物爆炸"。
const AXIS = [];
for (let d = 1920; d <= 2000; d += 20) {
  const idx = sortedEra.findIndex(p => eraVal(p) >= d);
  if (idx < 0) continue;
  AXIS.push({ year: d, y: Math.round(YTOP + (YBOT - YTOP) * (idx / Math.max(1, PEOPLE.length - 1))) });
}

// 师承网参与标记(师承单筛态用:非血脉网节点降为星尘)
PEOPLE.forEach(p => { byId[p.id].__lineage = !!(parents[p.id] || children[p.id]); });

// Transformer 作者:LLM 开端枢纽 → 给体量+金晕(祖师度算不到他们,因下游是联创非师承)
const TF_AUTHORS = ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar", "Jakob Uszkoreit", "Llion Jones", "Aidan Gomez", "Lukasz Kaiser", "Illia Polosukhin"];
const TF_LEAD = new Set(["Ashish Vaswani", "Noam Shazeer"]);
TF_AUTHORS.forEach(id => { if (byId[id]) byId[id].__tf = TF_LEAD.has(id) ? 1 : 0.6; });

// Landmark:把《Attention Is All You Need》立成"LLM 开端"枢纽(簇质心爆光 + 顶上金字 + 引线)
const LANDMARKS = [];
{ const tf = TF_AUTHORS.map(id => byId[id]).filter(Boolean);
  if (tf.length >= 4) {
    const cx = tf.reduce((s, n) => s + n.fx, 0) / tf.length;
    const cy = tf.reduce((s, n) => s + n.fy, 0) / tf.length;
    const cz = tf.reduce((s, n) => s + n.fz, 0) / tf.length;
    // 标注抬到全图顶部空白区(脱离节点缠绕→总览可读),用引线拉回簇质心
    LANDMARKS.push({ t1: "Attention Is All You Need", t2: "2017 · 大语言模型的开端", t2_en: "2017 · the dawn of large language models", cx, cy, cz, lx: cx, ly: YTOP + 150, lz: cz });
  }
}

const NODES = PEOPLE.map(p => byId[p.id]);
NODES.forEach(n => { const a = AVATARS[n.name_en]; if (a) n.__av = a; }); // 挂离线头像
const N_PEOPLE = NODES.length, N_RELS = links.length;
const INSTS_USED = [...new Set(NODES.map(n => n.__inst))];

const PAYLOAD = JSON.stringify({ nodes: NODES, links, insts: INSTS_USED, axis: AXIS, landmarks: LANDMARKS });

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>AI 思想血脉家谱</title>
<style>
:root{--void:#060912;--text:#eaf1ff;--dim:#8a99b8;--mono:"SF Mono","JetBrains Mono",ui-monospace,monospace;--sans:"Inter","PingFang SC","Hiragino Sans GB",sans-serif}
*{box-sizing:border-box;margin:0;padding:0}html,body{height:100%;background:var(--void);color:var(--text);font-family:var(--sans);overflow:hidden}
#graph{position:fixed;inset:0}.ov{position:fixed;z-index:10}
.brand{top:24px;left:28px;pointer-events:none}.brand .nm{font-size:21px;font-weight:400;letter-spacing:.06em}.brand .fo{margin-top:7px;font-family:var(--mono);font-size:11.5px;letter-spacing:.08em;color:#9fb0cc}
.tools{top:22px;right:28px;display:flex;gap:8px;align-items:center}
.tools input{background:rgba(255,255,255,.06);border:1px solid #2b3650;color:var(--text);font-family:var(--sans);font-size:13px;padding:7px 11px;border-radius:6px;width:180px;outline:none}
.tools input::placeholder{color:#5e6a85}
.btn{background:rgba(255,255,255,.06);border:1px solid #2b3650;color:var(--dim);font-family:var(--mono);font-size:11px;letter-spacing:.05em;padding:7px 11px;border-radius:6px;cursor:pointer;user-select:none}
.btn:hover{color:var(--text);border-color:#3e4d6e}.btn.on{color:#5ee6ff;border-color:#3e6e8e}
.timebar{bottom:26px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:14px;width:min(680px,80vw);background:rgba(8,12,22,.72);border:1px solid #1d2740;border-radius:11px;padding:11px 18px;backdrop-filter:blur(4px)}
.timebar .play{cursor:pointer;color:#f2cf78;font-family:var(--mono);font-size:13px;border:1px solid #5a4a2a;border-radius:6px;padding:5px 13px;user-select:none;min-width:64px;text-align:center;white-space:nowrap}.timebar .play:hover{color:#ffe19a;border-color:#7e6a3e}
.timebar input[type=range]{flex:1;accent-color:#5ee6ff;height:3px}
.timebar .yr{font-family:var(--mono);font-size:15px;color:var(--text);min-width:44px;text-align:right}
.legend{bottom:104px;right:28px;font-family:var(--mono);font-size:11px;color:var(--dim);text-align:right}
.legend .lgh{font-size:9px;letter-spacing:.12em;color:#5a6680;margin-bottom:7px;text-transform:uppercase}
.legend .row{display:flex;align-items:center;justify-content:flex-end;gap:7px;margin-bottom:6px;cursor:pointer;transition:opacity .2s,color .2s;user-select:none}
.legend .row:hover{color:var(--text)}.legend .row.off{opacity:.28;text-decoration:line-through}.legend .dot{width:9px;height:3px;border-radius:1px}
.note{bottom:26px;left:28px;font-family:var(--mono);font-size:10.5px;color:var(--dim);opacity:.62;max-width:340px;pointer-events:none;line-height:1.7}
.genaxis{left:22px;top:50%;transform:translateY(-50%);writing-mode:vertical-rl;font-family:var(--mono);font-size:11.5px;letter-spacing:.46em;color:#7588ad;pointer-events:none;user-select:none}
.genaxis b{color:#a6b6da;font-weight:600;letter-spacing:.46em}
.card{opacity:0;transform:translateY(6px);transition:opacity .3s ease,transform .3s ease;pointer-events:none;position:relative;display:flex;gap:12px;align-items:flex-start;background:rgba(9,13,22,.97);border:1px solid #2c3a55;border-radius:13px;padding:13px 16px 14px 13px;max-width:310px}
.card.show{opacity:1;transform:translateY(0)}
.card .cx{position:absolute;top:7px;right:9px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:17px;line-height:1;color:#7e8aa6;cursor:pointer;border-radius:6px;pointer-events:auto}.card .cx:hover{background:rgba(255,255,255,.08);color:#eaf1ff}
.card .ava{width:64px;height:64px;border-radius:50%;flex:0 0 64px;background:#161e30 center/cover no-repeat;box-shadow:0 0 18px rgba(120,200,255,.4);border:1.5px solid #3a5170;display:flex;align-items:center;justify-content:center;font-size:26px;color:#9fb6da;font-weight:300}
.card .cbody{max-width:226px}.card .cn{font-size:16px;font-weight:500;line-height:1.2}.card .ce{font-family:var(--mono);font-size:10.5px;color:var(--dim);margin-top:2px}
.card .cage{font-size:13px;color:#7cdfff;margin-top:8px;font-weight:500}.card .cinst{display:inline-block;font-size:10px;font-family:var(--mono);margin-top:8px;padding:2px 8px;border-radius:10px}
.card .cev{margin-top:8px}.card .cev .evt{font-family:var(--mono);font-size:9px;letter-spacing:.12em;color:#5e6a85;text-transform:uppercase;margin-bottom:3px}.card .cev .evl{font-size:11.5px;color:#cdd9f2;line-height:1.6}
.card .cev .lnk{color:#7cdfff;cursor:pointer;border-bottom:1px dotted #4a6b85;pointer-events:auto}.card .cev .lnk:hover{color:#bde6ff}
.card .cid{font-size:10.5px;color:#828fab;margin-top:8px;line-height:1.45}
.loading{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:13px;color:var(--dim);letter-spacing:.2em;z-index:20}
@media (max-width:560px){
  .brand{top:12px;left:14px}.brand .nm{font-size:16px;letter-spacing:.04em}.brand .fo{font-size:9px;max-width:90vw;line-height:1.5;margin-top:4px}
  .tools{top:58px;right:14px;left:14px;flex-wrap:wrap;justify-content:flex-end;gap:6px}
  .tools input{width:100%;order:-1;font-size:12px;padding:6px 9px}
  .btn{font-size:10px;padding:6px 9px}
  .note,.genaxis{display:none}
  .legend{bottom:130px;right:14px;font-size:10px}
  .timebar{width:94vw;padding:8px 12px;gap:10px}
  .card{max-width:80vw}
}
</style></head><body>
<div id="loading" class="loading">正在点亮血脉网…</div>
<div id="graph"></div>
<div class="ov brand"><div class="nm">AI 思想血脉家谱</div><div class="fo">师承为骨 · 机构上色 · ${N_PEOPLE} 人 · ${N_RELS} 条考证关系 · 按播放看薪火相传</div></div>
<div class="ov tools"><input id="search" placeholder="搜索人名 / Search…" autocomplete="off"><div class="btn" id="reset">回全景</div><div class="btn" id="cinema">录屏自转</div><div class="btn" id="lang" title="语言 / Language">EN</div></div>
<div class="ov legend" id="legend"></div>
<div class="ov genaxis">更早 · <b>世代</b> · 更近</div>
<div class="ov note">血脉树为骨(越上越早) · 颜色光环=机构 · 节点大小=师承辈分(祖师爷最大) · 暖金大核=血脉之源<br>点节点=聚焦其全部关系(含弱边) · 拖拽环绕 / 滚轮缩放 · 图例点击筛选关系</div>
<div class="ov card" id="card"><div class="cx" id="cClose" title="关闭">×</div><div class="ava" id="cAva"></div><div class="cbody"><div class="cn" id="cName"></div><div class="ce" id="cEn"></div><div class="cage" id="cAge"></div><div class="cinst" id="cInst"></div><div class="cev" id="cEv"></div><div class="cid" id="cId"></div></div></div>
<div class="ov timebar"><div class="play" id="play">▶ 薪火相传</div><input id="time" type="range"><div class="yr" id="yr"></div></div>

<script>${LIBS}</script>
<script type="module">
const THREE = window.THREE, ForceGraph3D = window.ForceGraph3D;
const D = ${PAYLOAD};
const nodes = D.nodes, links = D.links;
const byId = {}; nodes.forEach(n => { byId[n.id] = n; n.__dim = 1; n.__hover = 1; });

// ── 双语(中/EN):浏览器语言自动判定 + 手动切换,两套文案内置同一文件 ──
let LANG = localStorage.getItem('bl_lang') || ((navigator.language||'').toLowerCase().indexOf('zh')===0 ? 'zh' : 'en');
const T = {
  brand:{zh:"AI 思想血脉家谱",en:"AI Bloodline"},
  foot:{zh:"师承为骨 · 机构上色 · ${N_PEOPLE} 人 · ${N_RELS} 条考证关系 · 按播放看薪火相传",
        en:"Mentorship as the spine · halo = institution · ${N_PEOPLE} people · ${N_RELS} sourced ties · press play to watch it grow"},
  search:{zh:"搜索人名…",en:"Search a name…"},
  reset:{zh:"回全景",en:"Reset view"},
  cinema:{zh:"录屏自转",en:"Auto-rotate"},
  play:{zh:"▶ 薪火相传",en:"▶ Watch it grow"},
  pause:{zh:"⏸ 暂停",en:"⏸ Pause"},
  legendH:{zh:"关系 · 点击筛选",en:"Relations · click to filter"},
  note:{zh:"血脉树为骨(越上越早) · 颜色光环=机构 · 节点大小=师承辈分(祖师爷最大) · 暖金大核=血脉之源<br>点节点=聚焦其全部关系(含弱边) · 拖拽环绕 / 滚轮缩放 · 图例点击筛选关系",
        en:"Lineage tree (higher = earlier) · halo = institution · size = mentorship seniority (founders largest) · warm-gold cores = the roots<br>Click a node to focus its ties · drag to orbit / scroll to zoom · click the legend to filter"},
  genaxis:{zh:"更早 · <b>世代</b> · 更近",en:"Earlier · <b>GENERATION</b> · Later"},
  loading:{zh:"正在点亮血脉网…",en:"Lighting up the network…"},
  now:{zh:"现状 · ",en:"Now · "}, around:{zh:"这一年前后",en:"Around this year"}, sig:{zh:"含金量 ",en:"significance "},
  notBorn:{zh:"这一年还未出生",en:"not yet born"},
  birthUnknown:{zh:y=>"生年待考 · "+y+" 年",en:y=>"birth year unknown · "+y},
  age:{zh:(a,y)=>a+" 岁 · "+y+" 年",en:(a,y)=>"age "+a+" · "+y},
};
const tx=k=>T[k][LANG];
const REL_LABEL={"师承":{zh:"师承",en:"Mentorship"},"同门":{zh:"同门",en:"Same lab"},"同事":{zh:"同事",en:"Colleague"},"联创":{zh:"联合创始",en:"Co-founded"},"投资":{zh:"投资",en:"Investment"},"收购":{zh:"收购",en:"Acquired"},"决裂":{zh:"决裂",en:"Split"},"其他":{zh:"其他",en:"Other"}};
const relLabel=t=>(REL_LABEL[t]||{zh:t,en:t})[LANG];
const INST_EN={"新锐AI":"Emerging AI","其他":"Other"};
const instName=i=>LANG==='zh'?i:(INST_EN[i]||i);
const nmOf=n=>LANG==='zh'?(n.name_cn||n.name_en):(n.name_en||n.name_cn);
const idtOf=n=>LANG==='zh'?(n.identity||""):(n.identity_en||n.identity||"");
const langSprites=[]; // 语言相关的 3D 文字(如 landmark),切换时按 lang 显隐

const REL_STYLE = {"师承":{c:"#ffce5c",label:"师承"},"同门":{c:"#9db4d8",label:"同门"},"同事":{c:"#5ee6ff",label:"同事"},"联创":{c:"#7cff9d",label:"联合创始"},"投资":{c:"#6a93ff",label:"投资"},"收购":{c:"#a78bff",label:"收购"},"决裂":{c:"#ff6b5e",label:"决裂"},"其他":{c:"#8a99b8",label:"其他"}};
const INST_COLOR = ${JSON.stringify(INST_COLOR)};
const instColor = i => INST_COLOR[i] || "#9aa6c0";
const SIG_W = {strong:2.4, medium:1.2, weak:0.5};      // 线宽
const SIG_OP = {strong:0.95, medium:0.6, weak:0.16};   // 静止透明度
const typeBoost = t => t==="师承"?1.55:0.7;             // 师承=血脉骨架:总览态明显加粗领衔,横向人际网压细
const DIM = 0.08;

// 关系图例(可点筛选)
const typeOn = {师承:true,联创:true,决裂:true,同事:true,收购:true,投资:true,其他:true};
const LEGEND = [["师承","#d9a73f","师承"],["联合创始","#7cff9d","联创"],["决裂","#ff6b5e","决裂"],["同事","#5ee6ff","同事"],["收购","#a78bff","收购"],["投资","#6a93ff","投资"]];
const legendEl = document.getElementById('legend');
function renderLegend(){legendEl.innerHTML='<div class="lgh">'+tx('legendH')+'</div>'+LEGEND.map(([l,c,t])=>'<div class="row'+(typeOn[t]===false?' off':'')+'" data-t="'+t+'">'+relLabel(t)+' <span class="dot" style="background:'+c+';box-shadow:0 0 6px '+c+'"></span></div>').join('');}
renderLegend();

const NEI = new Map(); nodes.forEach(n=>NEI.set(n.id,new Set([n.id]))); links.forEach(l=>{NEI.get(l.person_a)?.add(l.person_b);NEI.get(l.person_b)?.add(l.person_a);});

// 半径:祖师度(师承后代规模)是主驱动→根远大于叶(≥3:1);影响力打底压低;Transformer 作者额外抬升做 LLM 开端枢纽
const rootnessOf = n => Math.max(n.__seed?0.3:0, n.__root||0, (n.__tf||0)*0.7);
const nodeR = n => 3.5 + (n.influence??0.4)*5 + (n.__root||0)*20 + (n.__tf||0)*10 + (n.__seed?2:0);
let GT=null; function glowTex(){if(GT)return GT;const s=128,c=document.createElement("canvas");c.width=c.height=s;const x=c.getContext("2d");const g=x.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);g.addColorStop(0,"rgba(255,255,255,1)");g.addColorStop(.16,"rgba(255,255,255,.7)");g.addColorStop(.42,"rgba(255,255,255,.15)");g.addColorStop(1,"rgba(255,255,255,0)");x.fillStyle=g;x.fillRect(0,0,s,s);GT=new THREE.CanvasTexture(c);return GT;}
function addGlow(grp,color,size,op,mul){const m=new THREE.SpriteMaterial({map:glowTex(),color,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});m.userData.baseOpacity=op;const s=new THREE.Sprite(m);s.scale.setScalar(size*mul);s.raycast=()=>{};grp.add(s);return s;}
function label(text,color,fontPx,always){const dpr=2,pad=6,c=document.createElement("canvas"),x=c.getContext("2d");x.font="500 "+fontPx+'px "PingFang SC","Hiragino Sans GB",sans-serif';const w=Math.ceil(x.measureText(text).width+pad*2),h=Math.ceil(fontPx+pad*2);c.width=w*dpr;c.height=h*dpr;x.scale(dpr,dpr);x.textAlign="center";x.textBaseline="top";x.shadowColor="rgba(2,4,9,.98)";x.shadowBlur=6;x.font="500 "+fontPx+'px "PingFang SC","Hiragino Sans GB",sans-serif';x.fillStyle=color;x.fillText(text,w/2,pad);const t=new THREE.CanvasTexture(c);t.anisotropy=4;t.minFilter=THREE.LinearFilter;const m=new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false,depthTest:false,fog:false});m.userData.isLabel=true;m.userData.alwaysShow=always;m.userData.baseOpacity=1;m.opacity=always?1:0;const sp=new THREE.Sprite(m);sp.renderOrder=6;sp.scale.set(w*.34,h*.34,1);sp.raycast=()=>{};return sp;}

function nodeObj(n){const grp=new THREE.Group();const ic=new THREE.Color(instColor(n.__inst));const r=nodeR(n);const inf=n.influence??0.4;
  const rootness=rootnessOf(n);
  // 机构色光环:叶节点压暗(读成"材质柔光"而非"信号线"),根/枢纽稍亮;让金骨架不被彩光淹没
  addGlow(grp,ic,r,Math.max(.035,Math.pow(inf,1.7)*0.22*(0.55+rootness*0.7)),4.4);
  // 暖金大光晕:祖师度/Transformer 越高越亮越大 → 辉光是稀缺资源,只给根与开端枢纽
  if(rootness>0.12){addGlow(grp,new THREE.Color("#ffd982"),r,0.2+rootness*0.36,5+rootness*5.5);addGlow(grp,new THREE.Color("#fff1c8"),r,0.16+rootness*0.26,2.6+rootness*2.6);}
  const co=(0.42+inf*0.32)*(0.62+rootness*0.45);const cm=new THREE.MeshBasicMaterial({color:ic,transparent:true,opacity:co,fog:false});cm.userData.baseOpacity=co;grp.add(new THREE.Mesh(new THREE.SphereGeometry(r,22,16),cm));
  // 枢纽清晰亮核(根/种子/Transformer 枢纽)
  if(rootness>=0.3||inf>=0.85){const warm=n.__seed||(n.__tf||0)>0;const ho=new THREE.MeshBasicMaterial({color:warm?0xffd47a:0xeef4ff,transparent:true,opacity:0.78,fog:false});ho.userData.baseOpacity=0.78;grp.add(new THREE.Mesh(new THREE.SphereGeometry(r*(warm?0.5:0.4),16,12),ho));}
  const always=rootness>=0.3||inf>=0.92||(n.__tf||0)>0;const lcol=(n.__seed||(n.__tf||0)>0)?"#ffe7b0":"#dbe6fb";const fpx=rootness>=0.4?25:20;
  const lz=label(n.name_cn,lcol,fpx,always);lz.material.userData.lang='zh';lz.position.set(0,r+7,0);grp.add(lz);
  const le=label(n.name_en||n.name_cn,lcol,fpx,always);le.material.userData.lang='en';le.position.set(0,r+7,0);grp.add(le);
  n.__group=grp;return grp;}

const NOW_YEAR=new Date().getFullYear(); // 当前年运行时动态取,不写死,永不过期
let curYear=NOW_YEAR, focusId=null, growing=false, playRank=-1;
// 生长序列:把"会出现在静止态的边"(非weak)按出现年份排序,赋 __rank;播放按 rank 匀速逐条点亮(自动压空白年、打散密集年)
const GROW_SEQ=(()=>{
  const g=links.filter(l=>l.sig!=="weak").map(l=>({l,ky:(l._yr>0?l._yr:Math.max(byId[l.person_a]?.__entry??1995,byId[l.person_b]?.__entry??1995))}));
  g.sort((a,b)=>a.ky-b.ky||(a.l.person_a+a.l.person_b).localeCompare(b.l.person_a+b.l.person_b));
  g.forEach((x,i)=>{x.l.__rank=i;x.l.__ky=x.ky;});
  return g.map(x=>x.l);
})();
links.forEach(l=>{if(l.__rank==null)l.__rank=Infinity;}); // weak 边:不参与生长,聚焦才显
const NE=GROW_SEQ.length;
nodes.forEach(n=>{n.__revealRank=Infinity;n.__phase=(n.id.charCodeAt(0)%12)*0.55;});
GROW_SEQ.forEach((l,i)=>{const a=byId[l.person_a],b=byId[l.person_b];if(a&&i<a.__revealRank)a.__revealRank=i;if(b&&i<b.__revealRank)b.__revealRank=i;});
nodes.forEach(n=>{if(n.__seed)n.__revealRank=-1;}); // 12 种子根:t=0 即点亮
const nodeVisFn=n=>{ if(playRank>=0) return n.__seed||n.__revealRank<=playRank; return (n.__entry??n.__era)<=curYear; };
function linkShown(l){
  if(typeOn[l.relation_type]===false) return false;
  if(playRank>=0) return l.__rank<=playRank;                 // 播放中:按边出现顺序逐条点亮(匀速节奏)
  const sy=byId[l.person_a]?.__entry??9999, ty=byId[l.person_b]?.__entry??9999; // 静止态:时间门控
  if(!((l._yr===0||l._yr<=curYear)&&sy<=curYear&&ty<=curYear)) return false;
  if(focusId&&(l.person_a===focusId||l.person_b===focusId)) return true; // 聚焦:显其全部边(含weak)
  if(l.sig==="weak") return false;
  return true;
}
const elem=document.getElementById('graph');
const Graph=ForceGraph3D({controlType:'orbit'})(elem)
  .backgroundColor('#060912').showNavInfo(false)
  .graphData({nodes,links})
  .nodeThreeObject(nodeObj).nodeThreeObjectExtend(false).nodeVisibility(nodeVisFn)
  .nodeLabel(n=>'<div style="font-family:sans-serif;max-width:240px;padding:6px 9px;background:rgba(8,11,21,.95);border:1px solid #4f7fb5;border-radius:4px;color:#eaf1ff;font-size:12px"><b>'+nmOf(n)+'</b> <span style="color:#9fb0d4">'+(LANG==="zh"?(n.name_en||""):(n.name_cn||""))+(n.birth_year?" · "+n.birth_year:"")+'</span><div style="color:#8aa0c8;font-size:10.5px;margin-top:2px">'+instName(n.__inst)+'</div></div>')
  .linkColor(l=>REL_STYLE[l.relation_type]?.c||"#8a99b8").linkOpacity(1).linkVisibility(linkShown)
  .linkWidth(l=>{const w=(SIG_W[l.sig]||1)*typeBoost(l.relation_type);return l.relation_type==="师承"?w*(1+Math.max(rootnessOf(byId[l.person_a]||{}),rootnessOf(byId[l.person_b]||{}))*1.1):w;})
  .linkCurvature(l=>l.relation_type==="师承"?0.05:0.32)
  .linkCurveRotation(l=>l.__rot||0)
  .linkDirectionalArrowLength(l=>l.directed?4.5:0).linkDirectionalArrowRelPos(.86).linkDirectionalArrowColor(l=>REL_STYLE[l.relation_type]?.c||"#8a99b8")
  .linkDirectionalParticles(0).linkDirectionalParticleSpeed(0.0062).linkDirectionalParticleWidth(2.4).linkDirectionalParticleColor(()=>"#ffe6a0")
  .linkLabel(l=>{const s=REL_STYLE[l.relation_type];const src=l.significance?'<div style="color:#7f8ba6;font-size:10.5px">'+tx('sig')+l.significance+'</div>':'';const factTxt=(LANG==="zh"?l.fact:(l.fact_en||l.fact))||"";return '<div style="font-family:sans-serif;max-width:330px;padding:9px 12px;background:rgba(8,11,21,.97);border:1px solid '+(s?.c||"#4f7fb5")+';border-radius:5px;color:#eaf1ff;font-size:12px;line-height:1.6"><div style="color:'+(s?.c||"#9db4d8")+';font-weight:600">'+relLabel(l.relation_type)+(l._yr?' · '+l._yr:'')+'</div><div style="margin:3px 0">'+factTxt+'</div><div style="color:#9fb0d4;border-left:2px solid '+(s?.c||"#4f7fb5")+';padding-left:7px;margin:4px 0;font-style:italic">“'+((typeof l.source==="object"?l.source.verbatim_quote:l.verbatim_quote)||"").slice(0,200)+'”</div>'+src+'</div>';})
  .enableNodeDrag(false).warmupTicks(0).cooldownTicks(0)
  .onNodeHover(n=>{if(!focusId)setHL(n?n.id:null);document.body.style.cursor=n?'pointer':'default';})
  .onNodeClick(n=>{focusId=n.id;setHL(n.id);flyTo(n);showCard(n);Graph.linkVisibility(linkShown);})
  .onBackgroundClick(()=>{focusId=null;setHL(null);hideCard();Graph.linkVisibility(linkShown);});

// 平滑高亮
let hlId=null;
// 师承=金主干提权;同事/投资=背景网再压暗;联创/决裂/收购=叙事动作边居中→金骨架在总览即唯一主干色
function linkBaseOp(l){const t=l.relation_type;const m=t==="师承"?1.32:(t==="同事"||t==="投资")?0.36:0.54;return (SIG_OP[l.sig]||0.4)*m;}
function setHL(id){hlId=id;const nei=id?NEI.get(id):null;
  for(const n of nodes){const lit=!id||(nei&&nei.has(n.id));n.__dim=lit?1:DIM;n.__lit=!!lit;n.__hover=(id&&n.id===id)?1.5:1;}
  for(const l of links){const cn=id&&(l.person_a===id||l.person_b===id);l.__op=!id?linkBaseOp(l):(cn?(l.relation_type==="师承"?0.66:0.78):DIM*0.5);}}
for(const l of links)l.__op=linkBaseOp(l);
// 师承单筛态:只剩金骨架时,非血脉网节点降为星尘 → "几个根 + 徒子徒孙网"才读得出
// 仅看图例可切的 5 类(同门/其他无图例,不计入判断)
const OTHER_LEGEND_T=["联创","决裂","同事","收购","投资"];
function applyFilterDim(){const onlyShi=typeOn["师承"]!==false&&OTHER_LEGEND_T.every(t=>typeOn[t]===false);
  for(const n of nodes){n.__fdim=(onlyShi&&!n.__lineage)?0.1:1;}}
applyFilterDim();

function flyTo(n){const np=new THREE.Vector3(n.fx,n.fy,n.fz);const cp=Graph.camera().position;const dir=cp.clone().sub(np);if(dir.lengthSq()<1)dir.set(0,0,1);dir.normalize();const tp=np.clone().add(dir.multiplyScalar(320));Graph.cameraPosition({x:tp.x,y:tp.y,z:tp.z},{x:np.x,y:np.y,z:np.z},900);}

// 卡片
const cardEl=document.getElementById('card'),cAva=document.getElementById('cAva'),cName=document.getElementById('cName'),cEn=document.getElementById('cEn'),cAge=document.getElementById('cAge'),cInst=document.getElementById('cInst'),cEv=document.getElementById('cEv'),cId=document.getElementById('cId');
let cardNode=null;// 头像已离线内联(node.__av),无运行时网络依赖
function eventsOf(id,year){
  const pool=links.filter(l=>(l.person_a===id||l.person_b===id)&&l._yr>0&&l._yr<=year);
  // 联创按机构合并:每个机构只留影响力最高的合伙人(+记同创人数),避免"与A/B/C 共同创立同一家"刷屏、并保证显最知名的那位
  const coG={}, rest=[];
  for(const l of pool){ if(l.relation_type==='联创'&&l.org){(coG[l.org]=coG[l.org]||[]).push(l);} else rest.push(l); }
  for(const org in coG){const g=coG[org];
    g.sort((a,b)=>{const oa=a.person_a===id?a.person_b:a.person_a,ob=b.person_a===id?b.person_b:b.person_a;return (byId[ob]?.influence??0)-(byId[oa]?.influence??0);});
    const top=g[0]; top.__coN=g.length; top.__yr=Math.min(...g.map(x=>x._yr)); rest.push(top); }
  const evs=rest.sort((a,b)=>(b.__yr||b._yr)-(a.__yr||a._yr)).slice(0,4);
  return evs.map(l=>{const other=l.person_a===id?l.person_b:l.person_a;const oo=byId[other];const on=oo?nmOf(oo):other;const t=l.relation_type;let pre,post='';
    const org=l.org?(' '+l.org):'';const isStu=l.person_b===id, isSrc=l.person_a===id;
    if(LANG==='zh'){
      if(t==='师承'){pre=isStu?'师从 ':'指导 ';}else if(t==='联创'){pre='与 ';post=(l.__coN>1?' 等':'')+' 共同创立'+org;}else if(t==='同事'){pre='与 ';post=' 共事';}else if(t==='投资'){if(isSrc){pre='投资 ';post=l.org?(' · '+l.org):'';}else{pre='获 ';post=' 投资';}}else if(t==='收购'){if(isSrc){pre='收购 ';post=l.org?(' · '+l.org):'';}else{pre='被 ';post=' 收购';}}else if(t==='决裂'){pre='与 ';post=' 决裂';}else{pre=t+' ';}
    }else{
      if(t==='师承'){pre=isStu?'studied under ':'advised ';}else if(t==='联创'){pre='co-founded'+org+' with ';post=(l.__coN>1?', among others':'');}else if(t==='同事'){pre='colleague of ';}else if(t==='投资'){if(isSrc){pre='invested in ';post=l.org?(' · '+l.org):'';}else{pre='backed by ';}}else if(t==='收购'){if(isSrc){pre='acquired ';post=l.org?(' · '+l.org):'';}else{pre='acquired by ';}}else if(t==='决裂'){pre='split with ';}else{pre=relLabel(t)+' ';}
    }
    return {yr:(l.__yr||l._yr),pre,otherId:other,otherName:on,post};});}
function renderCardYear(n){const y=Math.round(curYear);const age=y-(n.birth_year??n.__era);
  cAge.textContent=(n.birth_year==null)?T.birthUnknown[LANG](y):(age<0?tx('notBorn'):T.age[LANG](age,y));
  const evs=eventsOf(n.id,curYear);
  cEv.innerHTML=evs.length?('<div class="evt">'+tx('around')+'</div>'+evs.map(e=>'<div class="evl">· '+e.yr+' · '+e.pre+'<span class="lnk" data-id="'+e.otherId.replace(/"/g,'&quot;')+'">'+e.otherName+'</span>'+e.post+'</div>').join('')):'';}
async function showCard(n){cardNode=n;cName.textContent=nmOf(n);cEn.textContent=(LANG==='zh'?(n.name_en||''):(n.name_cn||n.name_en||''))+(n.birth_year?" · "+n.birth_year:"");cId.textContent=idtOf(n)?(tx('now')+idtOf(n)):"";
  const ic=instColor(n.__inst);cInst.textContent=instName(n.__inst);cInst.style.background='rgba(255,255,255,.06)';cInst.style.color=ic;cInst.style.border='1px solid '+ic+'66';
  renderCardYear(n);
  if(n.__av){cAva.style.backgroundImage="url('"+n.__av+"')";cAva.textContent="";}else{cAva.style.backgroundImage="";cAva.textContent=n.name_en.slice(0,1);}
  cAva.style.boxShadow='0 0 18px '+ic+'66';cAva.style.borderColor=ic;
  cardEl.classList.add('show');}
function hideCard(){cardNode=null;cardEl.classList.remove('show');}
cEv.addEventListener('click',e=>{const a=e.target.closest('.lnk');if(!a)return;const id=a.dataset.id;if(byId[id])window.__focus(id);});
function closeCard(){focusId=null;setHL(null);hideCard();Graph.linkVisibility(linkShown);}
document.getElementById('cClose').addEventListener('click',e=>{e.stopPropagation();closeCard();});
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeCard();});

// 时间轴 + 生长动画(炸点)
const yrs=nodes.map(n=>n.__entry||n.__era).concat(links.map(l=>l._yr).filter(y=>y>0));
const YMIN=Math.min(...yrs), YMAX=Math.max(NOW_YEAR, ...yrs);
const timeEl=document.getElementById('time'),yrEl=document.getElementById('yr'),playEl=document.getElementById('play');
timeEl.min=YMIN;timeEl.max=YMAX;timeEl.value=YMAX;yrEl.textContent=YMAX;
function setYear(y){curYear=y;yrEl.textContent=Math.round(y);Graph.nodeVisibility(nodeVisFn);Graph.linkVisibility(linkShown);if(cardNode)renderCardYear(cardNode);}
timeEl.addEventListener('input',e=>{stopPlay();setYear(+e.target.value);});
let playRAF=0,playT=null;
function stopPlay(){if(playRAF){cancelAnimationFrame(playRAF);playRAF=0;}playEl.textContent=tx('play');playT=null;growing=false;playRank=-1;Graph.linkDirectionalParticles(0);nodes.forEach(n=>{n.__bornT=0;n.__hover=1;});links.forEach(l=>l.__actT=0);curYear=YMAX;timeEl.value=YMAX;yrEl.textContent=YMAX;Graph.nodeVisibility(nodeVisFn);Graph.linkVisibility(linkShown);}
playEl.addEventListener('click',()=>{if(playRAF){stopPlay();return;}playEl.textContent=tx('pause');playT=null;growing=true;focusId=null;setHL(null);hideCard();const DUR=16000;
  nodes.forEach(n=>{n.__bornT=0;if(n.__group)n.__group.scale.setScalar(0.001);});links.forEach(l=>{l.__actT=0;const lo=l.__lineObj;if(lo&&lo.material)lo.material.opacity=0;});
  Graph.linkDirectionalParticles(2); // 薪火:火花顺线从根(导师/早)跑向徒弟
  const applyRank=r=>{playRank=Math.max(0,Math.min(NE-1,r));const y=GROW_SEQ[playRank].__ky;curYear=y;yrEl.textContent=Math.round(y);timeEl.value=y;Graph.nodeVisibility(nodeVisFn);Graph.linkVisibility(linkShown);};
  applyRank(0); // 从第一条边起(跳过空白前奏);12 种子根 rank=-1 已在 t=0 点亮
  const step=ts=>{if(playT==null)playT=ts;const t=Math.min(1,(ts-playT)/DUR);applyRank(Math.round(t*(NE-1)));if(t<1)playRAF=requestAnimationFrame(step);else stopPlay();};
  playRAF=requestAnimationFrame(step);});

// 控件
const controls=Graph.controls();controls.enablePan=true;controls.autoRotate=false;controls.enableDamping=true;controls.dampingFactor=0.12;controls.minDistance=80;controls.maxDistance=2400;controls.zoomToCursor=true;
document.getElementById('cinema').addEventListener('click',e=>{controls.autoRotate=!controls.autoRotate;e.target.classList.toggle('on',controls.autoRotate);});
document.getElementById('reset').addEventListener('click',()=>{focusId=null;setHL(null);hideCard();Graph.linkVisibility(linkShown);Graph.cameraPosition({x:90,y:20,z:1100},{x:0,y:0,z:0},400);setTimeout(()=>Graph.zoomToFit(500,70),430);});
legendEl.addEventListener('click',e=>{const row=e.target.closest('.row');if(!row||!row.dataset.t)return;const t=row.dataset.t;typeOn[t]=(typeOn[t]===false);renderLegend();applyFilterDim();Graph.linkVisibility(linkShown);});
document.getElementById('search').addEventListener('keydown',e=>{if(e.key!=='Enter')return;const q=e.target.value.trim().toLowerCase();if(!q)return;const n=nodes.find(x=>x.name_cn.toLowerCase().includes(q)||x.name_en.toLowerCase().includes(q));if(n){focusId=n.id;setHL(n.id);flyTo(n);showCard(n);Graph.linkVisibility(linkShown);}});

// 深空:雾 + 星场
const scene=Graph.scene();scene.fog=new THREE.FogExp2(new THREE.Color("#0a1426").getHex(),0.00046);
{const g=new THREE.BufferGeometry(),N=1700,P=new Float32Array(N*3),C=new Float32Array(N*3);let seed=12345;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};for(let i=0;i<N;i++){const rr=1300+Math.pow(rnd(),.6)*2800,t=rnd()*Math.PI*2,ph=Math.acos(2*rnd()-1);P[i*3]=rr*Math.sin(ph)*Math.cos(t);P[i*3+1]=rr*Math.sin(ph)*Math.sin(t);P[i*3+2]=rr*Math.cos(ph);const b=.12+rnd()*.22;C[i*3]=b*.8;C[i*3+1]=b*.86;C[i*3+2]=b;}g.setAttribute("position",new THREE.BufferAttribute(P,3));g.setAttribute("color",new THREE.BufferAttribute(C,3));const st=new THREE.Points(g,new THREE.PointsMaterial({size:1.1,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:.65,depthWrite:false,fog:false}));st.renderOrder=-2;scene.add(st);}

// 世代地层:极淡 decade 横向参考线(纹理,无文字)→ 暗示"世代分层";精确年份刻度移交左缘 HTML 轴题
if(D.axis&&D.axis.length){const XW=740;
  for(const a of D.axis){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array([-XW,a.y,0, XW,a.y,0]),3));
    const ln=new THREE.Line(g,new THREE.LineBasicMaterial({color:0x33456c,transparent:true,opacity:0.1,depthWrite:false,fog:false}));ln.renderOrder=-1;ln.frustumCulled=false;scene.add(ln);
  }
}

// Landmark:把《Attention Is All You Need》立成"LLM 开端"枢纽(簇金爆光 + 长引线拉到顶部空白 + 金字大标注)
if(D.landmarks&&D.landmarks.length){const dpr=2;
  for(const lm of D.landmarks){
    // 簇爆光:Transformer 簇罩两层金柔光(外柔+内核)→ "大语言模型开端"的金色爆发点(饱和金,避免叠白)
    const b1=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:new THREE.Color("#ffc24b"),transparent:true,opacity:0.19,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
    b1.scale.setScalar(510);b1.position.set(lm.cx,lm.cy,lm.cz);b1.renderOrder=-1;b1.raycast=()=>{};scene.add(b1);
    const b2=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:new THREE.Color("#ffb02e"),transparent:true,opacity:0.23,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
    b2.scale.setScalar(230);b2.position.set(lm.cx,lm.cy,lm.cz);b2.renderOrder=-1;b2.raycast=()=>{};scene.add(b2);
    // 长引线:簇质心 → 顶部标注(虚线感:细金线)
    const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.BufferAttribute(new Float32Array([lm.cx,lm.cy+12,lm.cz, lm.lx,lm.ly-26,lm.lz]),3));
    const ll=new THREE.Line(lg,new THREE.LineBasicMaterial({color:0xffce5c,transparent:true,opacity:0.5,depthWrite:false,fog:false}));ll.renderOrder=6;ll.frustumCulled=false;scene.add(ll);
    // 金字大标注(2 行 + 金色下划线);中英各一份,按语言显隐(t1 同为英文,只副标题不同)
    const mkText=(t2)=>{
      const c=document.createElement('canvas'),x=c.getContext('2d');const f1=40,f2=22,padX=26,gap=11,padY=16,rule=10;
      x.font='700 '+f1+'px "PingFang SC",sans-serif';const w1=x.measureText(lm.t1).width;
      x.font='500 '+f2+'px "PingFang SC",sans-serif';const w2=x.measureText(t2).width;
      const W=Math.ceil(Math.max(w1,w2)+padX*2),H=Math.ceil(f1+rule+gap+f2+padY*2);
      c.width=W*dpr;c.height=H*dpr;x.scale(dpr,dpr);x.textAlign='center';x.textBaseline='top';x.shadowColor='rgba(2,4,9,1)';x.shadowBlur=14;
      x.font='700 '+f1+'px "PingFang SC",sans-serif';x.fillStyle='#ffeab0';x.fillText(lm.t1,W/2,padY);
      x.shadowBlur=0;x.strokeStyle='#ffce5c';x.globalAlpha=0.85;x.lineWidth=1.5;x.beginPath();x.moveTo(W/2-w1/2,padY+f1+rule*0.6);x.lineTo(W/2+w1/2,padY+f1+rule*0.6);x.stroke();x.globalAlpha=1;
      x.shadowColor='rgba(2,4,9,1)';x.shadowBlur=12;x.font='500 '+f2+'px "PingFang SC",sans-serif';x.fillStyle='#e0c896';x.fillText(t2,W/2,padY+f1+rule+gap);
      const t=new THREE.CanvasTexture(c);t.anisotropy=4;t.minFilter=THREE.LinearFilter;
      const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false,depthTest:false,fog:false}));
      sp.renderOrder=8;sp.scale.set(W*.42,H*.42,1);sp.position.set(lm.lx,lm.ly,lm.lz);sp.frustumCulled=false;return sp;
    };
    const spZh=mkText(lm.t2);spZh.material.userData.lang='zh';scene.add(spZh);langSprites.push(spZh);
    const spEn=mkText(lm.t2_en||lm.t2);spEn.material.userData.lang='en';scene.add(spEn);langSprites.push(spEn);
  }
}

setTimeout(()=>{Graph.cameraPosition({x:90,y:20,z:1100},{x:0,y:0,z:0},0);Graph.zoomToFit(0,70);},120);

// rAF:平滑 lerp + 生长态新边脉冲
const L=0.16; const ease3=t=>1-Math.pow(1-Math.min(1,Math.max(0,t)),3);
function loop(){requestAnimationFrame(loop);controls.update();const tnow=performance.now();
  for(const n of nodes){const g=n.__group;if(!g)continue;
    let bp=1; // 生长态:节点 born 后平滑缩放+淡入(ease),非瞬间 pop
    if(growing){ if(nodeVisFn(n)){ if(!n.__bornT)n.__bornT=tnow; bp=ease3((tnow-n.__bornT)/560); } else { n.__bornT=0; bp=0; } }
    if(growing && n.__seed) n.__hover = 1.1 + 0.13*Math.sin(tnow/520 + (n.__phase||0)); // 种子根呼吸,t=0 即有动静
    const fd=n.__fdim??1;
    const sc=(n.__hover||1)*bp*(0.62+0.38*fd); // 师承单筛被降噪的节点缩小退场
    g.scale.setScalar(g.scale.x+(sc-g.scale.x)*(growing?0.28:L));
    g.traverse(o=>{if(!o.material)return;const ud=o.material.userData||{};const base=ud.baseOpacity??1;const tgt=(ud.isLabel?(((ud.alwaysShow||n.__lit)&&fd>0.5&&ud.lang===LANG)?1:0):base*(n.__dim??1)*fd)*bp;o.material.opacity+=(tgt-o.material.opacity)*(growing?0.28:L);});}
  for(const l of links){const lo=l.__lineObj;
    let gp=1; // 生长态:边 draw-on 淡入(配合顺线火花粒子=薪火相传)
    if(growing){ if(linkShown(l)){ if(!l.__actT)l.__actT=tnow; gp=ease3((tnow-l.__actT)/720); } else { l.__actT=0; gp=0; } }
    if(lo&&lo.material){lo.material.transparent=true;const tgt=(l.__op??linkBaseOp(l))*gp;lo.material.opacity+=(tgt-lo.material.opacity)*(growing?0.32:L);}
    const ao=l.__arrowObj;if(ao&&ao.material){ao.material.transparent=true;ao.material.opacity+=(((l.__op??linkBaseOp(l))*gp)-ao.material.opacity)*L;}}
  if(cardNode){const sc=Graph.graph2ScreenCoords(cardNode.fx,cardNode.fy,cardNode.fz);if(sc){cardEl.style.left=(sc.x+18)+'px';cardEl.style.top=(sc.y-40)+'px';}}
}
requestAnimationFrame(loop);
window.__focus=id=>{const n=byId[id];if(!n)return;focusId=id;setHL(id);flyTo(n);showCard(n);Graph.linkVisibility(linkShown);};
window.__dbg={visN:()=>links.filter(linkShown).length,focus:()=>focusId,cardName:()=>cName.textContent,nNodes:nodes.length};
window.__setYear=y=>{stopPlay();timeEl.value=y;setYear(y);};
window.__screenOf=id=>{const n=byId[id];if(!n)return null;return Graph.graph2ScreenCoords(n.fx,n.fy,n.fz);};

// ── 语言切换:更新所有静态文案 + 图例 + landmark + 卡片;节点标签由 loop 按 ud.lang 显隐 ──
function applyLang(){
  document.documentElement.lang = LANG==='zh'?'zh-CN':'en';
  document.querySelector('.brand .nm').textContent=tx('brand');
  document.querySelector('.brand .fo').textContent=tx('foot');
  const noteEl=document.querySelector('.note');if(noteEl)noteEl.innerHTML=tx('note');
  const gaEl=document.querySelector('.genaxis');if(gaEl)gaEl.innerHTML=tx('genaxis');
  document.getElementById('search').placeholder=tx('search');
  document.getElementById('reset').textContent=tx('reset');
  document.getElementById('cinema').textContent=tx('cinema');
  document.getElementById('lang').textContent=LANG==='zh'?'EN':'中';
  const lo=document.getElementById('loading');if(lo&&lo.style.display!=='none')lo.textContent=tx('loading');
  playEl.textContent=playRAF?tx('pause'):tx('play');
  renderLegend();
  langSprites.forEach(s=>{s.visible=(s.material.userData.lang===LANG);});
  if(cardNode)showCard(cardNode);
  try{localStorage.setItem('bl_lang',LANG);}catch(e){}
}
document.getElementById('lang').addEventListener('click',()=>{LANG=LANG==='zh'?'en':'zh';applyLang();});
applyLang();
setTimeout(()=>{const el=document.getElementById('loading');if(el)el.style.display='none';},900);
</script></body></html>`;

const os = require("os");
const out2 = path.join(__dirname, "..", "docs", "html", "AI思想血脉家谱.html");
const out3 = path.join(__dirname, "..", "index.html"); // 站点首页(GitHub Pages 服务此文件)
fs.mkdirSync(path.dirname(out2), { recursive: true });
fs.writeFileSync(out2, html);
fs.writeFileSync(out3, html);
// 桌面副本(仅本机便利,跨机器失败不影响主流程)
try { const desk = path.join(os.homedir(), "Desktop", "claude-html"); fs.mkdirSync(desk, { recursive: true }); fs.writeFileSync(path.join(desk, "AI思想血脉家谱.html"), html); } catch (e) { /* 非本机环境跳过 */ }
console.log("血脉家谱 app 已生成 ·", N_PEOPLE, "人 /", N_RELS, "边 · 家族列:", fams.length, "· 机构:", INSTS_USED.length);
console.log("站点首页:", out3);
