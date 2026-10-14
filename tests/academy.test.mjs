// Logic tests for the My Academy games. Run from the project folder:  node tests/academy.test.mjs
import assert from 'node:assert/strict';
const base = new URL('../js/academy/', import.meta.url).href;
const pc = await import(base + 'pitcrew.js');
const rr = await import(base + 'retrieval.js');
const lg = await import(base + 'golf.js');
const hh = await import(base + 'hallucination.js');
const qc = await import(base + 'quotecheck.js');
const cc = await import(base + 'confidence.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('  ok -', name); };

// ── Agent Pit Crew ──
const [m1, m2, m3] = pc.MISSIONS;
t('bill auditor: correct pipeline passes', () => assert.equal(pc.simulate(m1, ['ocr', 'extract', 'calc', 'compare', 'write', 'critic']).ok, true));
t('bill auditor: calc before extract fails with a useful message', () => {
  const r = pc.simulate(m1, ['ocr', 'calc', 'extract']);
  assert.equal(r.ok, false); assert.match(r.steps.at(-1).msg, /Calculate Slabs needs the bill fields/); assert.match(r.steps.at(-1).msg, /Extract Fields/);
});
t('bill auditor: Guess Answer trap is rejected', () => assert.equal(pc.simulate(m1, ['guess']).ok, false));
t('bill auditor: harmless extra step still passes but is counted', () => {
  const r = pc.simulate(m1, ['web', 'ocr', 'extract', 'calc', 'compare', 'write']); // 6 slots, no critic
  assert.equal(r.ok, false); assert.match(r.msg, /never produced a verified answer/);
});
t('bill auditor: pipeline without the critic fails at the end', () => assert.match(pc.simulate(m1, ['ocr', 'extract', 'calc', 'compare', 'write']).msg, /verified answer/));
t('filings: correct 4-step pipeline passes', () => assert.equal(pc.simulate(m2, ['plan', 'retrieve', 'draft', 'numcheck']).ok, true));
t('filings: summarise-all is allowed but counted as extra', () => { const r = pc.simulate(m2, ['plan', 'sumall', 'retrieve', 'draft', 'numcheck']); assert.equal(r.ok, true); assert.equal(r.extras, 1); });
t('filings: ask-model-directly trap is rejected', () => assert.equal(pc.simulate(m2, ['ask', 'numcheck']).ok, false));
t('scanner: any order of the three checkers passes', () => {
  for (const order of [['axe', 'vision', 'kb'], ['kb', 'axe', 'vision'], ['vision', 'kb', 'axe']]) assert.equal(pc.simulate(m3, ['crawl', ...order, 'merge', 'report']).ok, true);
});
t('scanner: merge before all checks fails', () => assert.equal(pc.simulate(m3, ['crawl', 'axe', 'merge']).ok, false));
t('every mission is solvable within its slot count', () => {
  const sol = { 0: ['ocr', 'extract', 'calc', 'compare', 'write', 'critic'], 1: ['plan', 'retrieve', 'draft', 'numcheck'], 2: ['crawl', 'axe', 'vision', 'kb', 'merge', 'report'] };
  pc.MISSIONS.forEach((m, i) => assert.ok(sol[i].length <= m.slots));
});

// ── Retrieval Relay ──
t('judge: answer only → grounded; wrong only → wrong; both → conflict; neither → none', () => {
  assert.equal(rr.judge([{ role: 'answer' }, { role: 'noise' }]), 'good');
  assert.equal(rr.judge([{ role: 'wrong' }]), 'wrong');
  assert.equal(rr.judge([{ role: 'wrong' }, { role: 'answer' }]), 'conflict');
  assert.equal(rr.judge([{ role: 'related' }, { role: 'noise' }]), 'none');
});
t('every manual round has exactly one answer chunk and a look-alike', () => rr.ROUNDS.filter((r) => !r.auto).forEach((r) => {
  assert.equal(r.chunks.filter((c) => c.role === 'answer').length, 1); assert.ok(r.chunks.some((c) => c.role === 'wrong'));
}));
t('auto round: unfiltered top-3 is wrong, filtered top-3 is grounded', () => {
  const r = rr.ROUNDS.find((x) => x.auto);
  const top = (pool) => [...pool].sort((a, b) => b.sim - a.sim).slice(0, 3);
  assert.equal(rr.judge(top(r.chunks)), 'wrong');
  assert.equal(rr.judge(top(r.chunks.filter((c) => c.tag === r.filterTag))), 'good');
});

// ── Learning-Rate Golf ──
const [h1, h2, h3, h4] = lg.HOLES;
t('hole 1: default lr 0.05 falls short, 0.5 holes, 3 diverges', () => {
  assert.equal(lg.train(h1, 0.05).result, 'short'); assert.equal(lg.train(h1, 0.5).result, 'holed'); assert.equal(lg.train(h1, 3).result, 'diverged');
});
t('hole 2: lr 0.5 diverges, 0.1 holes', () => { assert.equal(lg.train(h2, 0.5).result, 'diverged'); assert.equal(lg.train(h2, 0.1).result, 'holed'); });
t('hole 3: lr 0.5 falls short, 5 holes', () => { assert.equal(lg.train(h3, 0.5).result, 'short'); assert.equal(lg.train(h3, 5).result, 'holed'); });
t('hole 4: no momentum never holes anywhere in the allowed lr range', () => {
  for (let i = 0; i <= 200; i++) { const lr = h4.lr[0] * Math.pow(h4.lr[1] / h4.lr[0], i / 200); assert.notEqual(lg.train(h4, lr, 0).result, 'holed', `lr ${lr}`); }
});
t('hole 4: momentum 0.8 with lr 0.5 holes', () => assert.equal(lg.train(h4, 0.5, 0.8).result, 'holed'));
t('every hole has a winning setting inside its slider range', () => {
  for (const h of lg.HOLES) {
    let win = false;
    for (let i = 0; i <= 200 && !win; i++) for (const b of h.momentum ? [0, 0.5, 0.8, 0.9] : [0]) { if (lg.train(h, h.lr[0] * Math.pow(h.lr[1] / h.lr[0], i / 200), b).result === 'holed') { win = true; break; } }
    assert.ok(win, h.name);
  }
});

// ── Hallucination Hunt ──
t('every round has at least one made-up sentence with a reason and a hint', () => hh.ROUNDS.forEach((r) => {
  const bad = r.answer.filter((s) => !s.ok); assert.ok(bad.length >= 1); bad.forEach((s) => { assert.ok(s.why); assert.ok(s.hint); });
}));
// ── Timestamp Detective (Earshot) ──
t('quote finder: exact words found, punctuation and case ignored', () => {
  const r = qc.ROUNDS[0];
  assert.ok(qc.findQuote(r, 'OUR full backs, kept getting caught upfield'));
  assert.equal(qc.findQuote(r, 'the pressing numbers went up by half'), null); // half-true quotes don't pass
});
t('every episode has an exact, a mistimed and a never-said citation', () => qc.ROUNDS.forEach((r) => {
  const v = r.claims.map((c) => qc.verdict(r, c));
  for (const k of ['exact', 'mistimed', 'missing']) assert.ok(v.includes(k), `${r.show} lacks ${k}`);
}));
t('wrong-time calls only score when the repair lands on the real start', () => {
  const r = qc.ROUNDS[0], c = r.claims.find((x) => qc.verdict(r, x) === 'mistimed'), hit = qc.findQuote(r, c.quote);
  assert.equal(qc.scoreClaim(r, c, 'mistimed', hit.time), 1);
  assert.equal(qc.scoreClaim(r, c, 'mistimed', hit.time + 5), 0);
  assert.equal(qc.scoreClaim(r, c, 'mistimed', null), 0);
  assert.equal(qc.scoreClaim(r, c, 'exact'), 0);
});
t('word times inside a line follow the transcript clock', () => {
  const ws = qc.words(qc.ROUNDS[0]);
  assert.equal(ws[0].time, 724); assert.ok(ws.every((w, i) => i === 0 || w.time >= ws[i - 1].time));
});

// ── Confidence Call (Dehqan) ──
const sweep = (r, gate) => { const out = []; for (let t = 40; t <= 100; t++) out.push([t / 100, cc.evaluate(r, t / 100, gate)]); return out; };
t('every batch fails at its starting threshold without the gate', () => cc.ROUNDS.forEach((r) => assert.equal(cc.evaluate(r, r.start, false).pass, false, r.name)));
t('every batch has a passing threshold (with the gate where it exists)', () => cc.ROUNDS.forEach((r) => assert.ok(sweep(r, !!r.gate).some(([, e]) => e.pass), r.name)));
t('field photos: answering everything is badly wrong; 0.90 passes; 0.95 is too timid', () => {
  const r = cc.ROUNDS[1];
  assert.ok(cc.evaluate(r, 0.4).accuracy < 0.4);
  assert.equal(cc.evaluate(r, 0.9).pass, true);
  const timid = cc.evaluate(r, 0.95); assert.equal(timid.checks.accuracy, true); assert.equal(timid.checks.coverage, false);
});
t('anything goes: no threshold works without the leaf gate', () => assert.ok(sweep(cc.ROUNDS[2], false).every(([, e]) => !e.pass)));
t('leaf gate removes every non-leaf at any threshold', () => sweep(cc.ROUNDS[2], true).forEach(([, e]) => assert.equal(e.nonLeaf, 0)));

console.log(`\n${n} tests passed`);
