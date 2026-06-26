**English** | [中文](README.zh-CN.md)

# AI Bloodline

I wanted to know who actually taught whom among today's AI leaders. So I wired the whole history of AI into a single graph — where every line traces back to a real source.

It's a map of the people behind AI. Every dot is a person; every line is something that really happened between them — mentorship, co-founding a company, working together, investing, acquiring, falling out.

I ran a multi-agent pipeline to verify the source of every single relationship: it has to find the exact wording on a real web page, attach a link you can open, and have a second AI re-open that page and check it by eye. Anything without a source doesn't get drawn, no matter how plausible; anything uncertain is left as a dashed line. Every line on this graph can be traced. If you spot a mistake, get in touch.

![hero recording placeholder](docs/html/placeholder-hero.gif)

**▶ Live demo: https://ryanyunweiyan.github.io/ai-bloodline/** (best on desktop — drag to orbit, scroll to zoom, click a node for details. There's an EN / 中 toggle in the top-right.)

---

## What it is, and how to read it

The people of the last few decades of AI, wired into one network in deep space. At a glance:

- **Dot = a person.** The bigger the dot, the more senior — the founding figures with the most descendants are largest and brightest. The colored halo around a dot is the institution they came from (Google, DeepMind, OpenAI, Anthropic…).
- **Line = a relationship,** colored by type: mentorship (gold), co-founded a company (green), colleague (cyan), investment (blue), acquisition (purple), split (red). The gold mentorship lines are the backbone of the whole graph.
- **Axes = lineage.** Vertical is generation — higher means earlier; horizontal spreads out a single bloodline.
- **The core = the founding figures.** Those few warm-gold bright cores are the roots of the entire graph. You'll find the roots come down to just a dozen-odd people — and the core staff at today's big labs are mostly their descendants.
- **Timeline + "▶ Watch it grow":** drag the slider to see the field in any given year; hit play and the relationships light up one by one in the order they happened, like fire passing down the bloodline.

---

## One fact: the 8 authors of a single paper seeded half the LLM industry

In 2017, eight people at Google wrote a paper called *Attention Is All You Need*, introducing the Transformer — the foundation under most of today's large language models. Then the eight scattered:

- Aidan Gomez founded **Cohere**;
- Noam Shazeer and Daniel De Freitas founded **Character.AI** (which Google paid roughly $2.7 billion in 2024 to bring back for **Gemini**);
- Ashish Vaswani and Niki Parmar founded **Adept**, then **Essential AI**;
- Llion Jones founded **Sakana AI** in Tokyo;
- Łukasz Kaiser went to **OpenAI** and worked on the o1 generation of reasoning models.

Look upward and they all came out of Google Brain — colleagues of Quoc Le, Jeff Dean, and Hinton. Aidan Gomez was even mentored by Hinton at Google Brain, and Hinton himself invested in Cohere. The author list of one paper pulled in half of today's large-model industry. That line is marked out in the graph.

---

## Every relationship is checked three ways

To push the odds of the AI making something up as close to zero as I could, nothing gets drawn until my agent chain has verified three things:

1. **Nail the original wording.** The AI doing the digging has to find a sentence copied verbatim from a real web page, with its URL. No summarizing, no translating, no "improving" it.
2. **Cross-check.** A second batch of AI re-opens that URL, distrusts the previous step, and checks from scratch. The moment the evidence is even slightly overstated — calling a "researcher" a "co-founder," say — it gets thrown back.
3. **Filter weak ties.** Drop the padding (e.g. merely appearing together in a long author list); keep only the strong ties that actually shaped the field.

What I wanted to build is a clean, traceable foundation. The graph is the hook; the pipeline behind it — how to keep an AI from making things up — is what I actually want to share.

---

## Run it yourself

The output is a single HTML file. No server needed — just open it in a browser.

```bash
git clone https://github.com/RyanYunweiYan/ai-bloodline.git
cd ai-bloodline
node scripts/gen-bloodline.js   # reads data/, generates the HTML — then open index.html
```

Rendering uses [three.js](https://threejs.org/) + [3d-force-graph](https://github.com/vasturiano/3d-force-graph); the verification pipeline runs on multi-agent collaboration in [Claude Code](https://claude.com/claude-code). The data lives in `data/`.

---

## What it can't do yet

- **Not the full picture.** It currently holds 92 people and 162 relationships, centered on the Transformer team and a few core academic roots — not all of AI history.
- **It can get things wrong.** This approach blocks fabrication, but not the occasional AI misread. Every relationship keeps its source, so if you find a wrong link, open an issue — I'll iterate fast.
- **Still early on features.** It can't yet take any person and auto-generate their graph, find the intersection of two people, or auto-complete the rest. That's for v2.
- **Mobile is just "viewable."** Desktop got the attention; portrait is a scaled-down view, not optimized.

What's next (by priority, subject to change): add more core people → mark relationship weights → open up any-person queries.

---

## About

A personal project — one person, spare time, wired together one verified relationship at a time. I built it partly out of curiosity about who's connected to whom, and partly to test whether this "keep the AI from making things up" approach actually holds up. Happy to chat, and happy to be corrected.

Find a wrong link, or a key relationship that's missing? Open an issue — a source link would be ideal.

- GitHub: [RyanYunweiYan](https://github.com/RyanYunweiYan)

## License

Released under the [MIT License](LICENSE).
