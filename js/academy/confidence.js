// ─────────────────────────────────────────────────────────────
//  Confidence Call (from Dehqan): selective prediction.
//  A leaf-disease model labels every photo with a confidence. Pick the
//  threshold below which it should stay quiet and send the farmer to an
//  extension office instead. Lab photos, field photos, then photos that
//  aren't leaves at all. (Validation sets here are made up for the game.)
// ─────────────────────────────────────────────────────────────
import { el } from './dom.js';

const C = (conf, label) => ({ conf, ok: true, label });
const W = (conf, label) => ({ conf, ok: false, label });
const N = (conf, label) => ({ conf, ok: false, leaf: false, label });

export const ROUNDS = [
  {
    name: 'Lab photos', tip: 'Clean photos on a plain background, like the training set. The model is usually right here.',
    goals: { accuracy: 0.95, coverage: 0.8 }, start: 0.5,
    items: [
      C(0.99, 'Tomato · early blight'), C(0.98, 'Potato · late blight'), C(0.98, 'Apple · scab'), C(0.97, 'Corn · common rust'),
      C(0.97, 'Grape · black rot'), C(0.96, 'Tomato · leaf mold'), C(0.96, 'Pepper · bacterial spot'), C(0.95, 'Corn · healthy'),
      C(0.94, 'Potato · healthy'), C(0.93, 'Tomato · mosaic virus'), C(0.92, 'Apple · cedar rust'), C(0.91, 'Grape · healthy'),
      C(0.9, 'Strawberry · leaf scorch'), C(0.88, 'Peach · bacterial spot'), C(0.86, 'Cherry · powdery mildew'), C(0.83, 'Soybean · healthy'),
      C(0.8, 'Tomato · septoria'), W(0.7, 'Corn · grey leaf spot?'), W(0.62, 'Tomato · target spot?'), W(0.55, 'Potato · early blight?'),
    ],
  },
  {
    name: 'Field photos', tip: 'Real farms: shadows, soil, several leaves per shot. Same model, very different world. Confidence still looks high.',
    goals: { accuracy: 0.75, coverage: 0.2 }, start: 0.5,
    items: [
      C(0.98, 'Wheat · leaf rust'), C(0.96, 'Cotton · leaf curl'), C(0.95, 'Rice · blast'), C(0.93, 'Wheat · healthy'),
      C(0.91, 'Maize · rust'), C(0.92, 'Tomato · early blight'), C(0.78, 'Rice · brown spot'), C(0.66, 'Cotton · healthy'),
      W(0.94, 'Wheat · yellow rust?'), W(0.9, 'Rice · bacterial blight?'), W(0.88, 'Cotton · leaf curl?'), W(0.86, 'Maize · blight?'),
      W(0.84, 'Wheat · septoria?'), W(0.82, 'Tomato · late blight?'), W(0.8, 'Rice · sheath blight?'), W(0.77, 'Cotton · boll rot?'),
      W(0.74, 'Wheat · powdery mildew?'), W(0.72, 'Maize · smut?'), W(0.69, 'Rice · tungro?'), W(0.65, 'Tomato · leaf mold?'),
      W(0.62, 'Wheat · stem rust?'), W(0.58, 'Cotton · wilt?'), W(0.54, 'Maize · streak?'), W(0.5, 'Rice · false smut?'),
      W(0.46, 'Wheat · loose smut?'),
    ],
  },
  {
    name: 'Anything goes', tip: 'Farmers send all sorts: a shoe, the sky, a cat. The model still names a disease, often confidently. Can a threshold alone stop that?',
    goals: { accuracy: 0.75, coverage: 0.25, noNonLeaf: true }, start: 0.9, gate: true,
    items: [
      C(0.97, 'Wheat · leaf rust'), C(0.95, 'Cotton · leaf curl'), C(0.93, 'Rice · blast'), C(0.91, 'Maize · rust'),
      C(0.84, 'Tomato · early blight'), C(0.72, 'Wheat · healthy'),
      W(0.92, 'Rice · brown spot?'), W(0.88, 'Wheat · yellow rust?'), W(0.81, 'Cotton · wilt?'), W(0.77, 'Maize · blight?'),
      W(0.7, 'Rice · sheath blight?'), W(0.66, 'Tomato · leaf mold?'), W(0.61, 'Wheat · septoria?'), W(0.55, 'Cotton · boll rot?'),
      W(0.48, 'Maize · smut?'),
      N(0.99, 'A shoe → “potato late blight”'), N(0.98, 'Bare soil → “wheat stem rust”'), N(0.97, 'A cat → “maize rust”'),
      N(0.96, 'Blue sky → “rice blast”'), N(0.94, 'A hand → “tomato mosaic”'), N(0.62, 'A brick wall → “cotton wilt”'),
    ],
  },
];

// ── pure logic (also used by the tests) ──
// answer every photo at or above the threshold; the leaf gate sends non-leaves back first
export function evaluate(round, threshold, gate = false) {
  const pool = gate ? round.items.filter((i) => i.leaf !== false) : round.items;
  const leaves = round.items.filter((i) => i.leaf !== false);
  const answered = pool.filter((i) => i.conf >= threshold);
  const right = answered.filter((i) => i.ok).length;
  const nonLeaf = answered.filter((i) => i.leaf === false).length;
  const answeredLeaves = answered.filter((i) => i.leaf !== false).length;
  const accuracy = answered.length ? right / answered.length : 0;
  const coverage = answeredLeaves / leaves.length;
  const g = round.goals;
  const checks = {
    accuracy: accuracy >= g.accuracy,
    coverage: coverage >= g.coverage,
    nonLeaf: !g.noNonLeaf || nonLeaf === 0,
  };
  return { answered: answered.length, right, accuracy, coverage, nonLeaf, checks, pass: checks.accuracy && checks.coverage && checks.nonLeaf };
}

const pct = (x) => `${Math.round(x * 100)}%`;
const LO = 0.4, HI = 1;
const xPos = (c) => ((c - LO) / (HI - LO)) * 100;

export function mount(root, { onDone }) {
  let r = 0, firstTry = 0;

  function render() {
    const round = ROUNDS[r];
    let threshold = round.start, gate = false, tries = 0, done = false;

    const head = el('div', { class: 'ag-head' },
      el('span', { class: 'ag-chip' }, `Batch ${r + 1} / ${ROUNDS.length}`),
      el('h3', { class: 'ag-title' }, round.name),
      el('span', { class: 'ag-chip ag-chip--score' }, `First-try passes ${firstTry}`),
    );
    const tip = el('div', { class: 'ag-question' }, el('span', {}, 'Field notes'), el('p', {}, round.tip));

    // the strip: every photo as a dot on the confidence axis (stacked when close)
    const strip = el('div', { class: 'cc-strip' });
    const zoneDefer = el('div', { class: 'cc-zone cc-zone--defer' }, el('span', {}, 'Send to extension office'));
    const zoneAnswer = el('div', { class: 'cc-zone cc-zone--answer' }, el('span', {}, 'Answer the farmer'));
    const line = el('div', { class: 'cc-line' });
    strip.append(zoneDefer, zoneAnswer, line);
    // stack dots so none overlap: each goes on the lowest row with room (rows ~5% of the width apart)
    const rows = [];
    const dots = round.items.map((it) => {
      const x = xPos(it.conf);
      let level = 0;
      while ((rows[level] || []).some((ox) => Math.abs(ox - x) < 5.2)) level++;
      (rows[level] = rows[level] || []).push(x);
      const d = el('span', { class: `cc-dot ${it.leaf === false ? 'is-nonleaf' : it.ok ? 'is-ok' : 'is-bad'}`, title: `${it.label} · ${Math.round(it.conf * 100)}% sure`,
        style: `left:${x}%; bottom:${10 + level * 19}px` });
      strip.append(d);
      return { d, it };
    });
    const axis = el('div', { class: 'cc-axis' }, ...[0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map((v) => el('span', { style: `left:${xPos(v)}%` }, v.toFixed(1))));
    const legend = el('p', { class: 'cc-legend' },
      el('span', { class: 'cc-key is-ok' }), 'model right', el('span', { class: 'cc-key is-bad' }), 'model wrong',
      round.items.some((i) => i.leaf === false) ? [el('span', { class: 'cc-key is-nonleaf' }), 'not a leaf'] : null);

    const note = el('p', { class: 'ag-note', role: 'status' });
    const tOut = el('output', { class: 'lg-val' });
    const tIn = el('input', { type: 'range', min: 40, max: 100, value: Math.round(threshold * 100), 'aria-label': 'Confidence threshold' });
    tIn.addEventListener('input', () => { threshold = tIn.value / 100; if (!done) note.textContent = ''; paint(); });
    const gateBox = el('input', { type: 'checkbox' });
    gateBox.addEventListener('change', () => { gate = gateBox.checked; if (!done) note.textContent = ''; paint(); });
    const controls = el('div', { class: 'lg-controls' },
      el('label', { class: 'lg-ctl' }, el('span', {}, 'Answer only above'), tIn, tOut),
      round.gate ? el('label', { class: 'rr-filter' }, gateBox, 'Leaf gate: a zero-shot CLIP check that asks “is this a leaf?” first')
        : el('p', { class: 'lg-lock' }, 'The leaf gate unlocks on the last batch'),
    );

    const goalsEl = el('ul', { class: 'cc-goals' });
    const stats = el('div', { class: 'lg-stats' });
    const lockBtn = el('button', { class: 'ag-btn', type: 'button' }, 'Lock it in');
    const actions = el('div', { class: 'ag-actions' }, lockBtn);

    function paint() {
      const e = evaluate(round, threshold, gate);
      tOut.textContent = threshold.toFixed(2);
      line.style.left = `${xPos(threshold)}%`;
      zoneDefer.style.width = `${xPos(threshold)}%`;
      zoneAnswer.style.left = `${xPos(threshold)}%`;
      dots.forEach(({ d, it }) => {
        const gated = gate && it.leaf === false;
        d.classList.toggle('is-gated', gated);
        d.classList.toggle('is-answered', !gated && it.conf >= threshold);
      });
      stats.replaceChildren(...[
        el('span', {}, 'Answered ', el('b', {}, `${e.answered} / ${round.items.length}`)),
        el('span', {}, 'Accuracy when answering ', el('b', {}, e.answered ? pct(e.accuracy) : '–')),
        el('span', {}, 'Leaf photos answered ', el('b', {}, pct(e.coverage))),
        round.goals.noNonLeaf ? el('span', {}, 'Non-leaves answered ', el('b', {}, String(e.nonLeaf))) : null,
      ].filter(Boolean));
      const g = round.goals;
      goalsEl.replaceChildren(...[
        el('li', { class: e.checks.accuracy ? 'is-met' : '' }, `Accuracy on answered photos ≥ ${pct(g.accuracy)}`),
        el('li', { class: e.checks.coverage ? 'is-met' : '' }, `Answer at least ${pct(g.coverage)} of leaf photos`),
        g.noNonLeaf ? el('li', { class: e.checks.nonLeaf ? 'is-met' : '' }, 'Never diagnose something that isn’t a leaf') : null,
      ].filter(Boolean));
    }

    lockBtn.addEventListener('click', () => {
      if (done) return;
      const e = evaluate(round, threshold, gate);
      // on the gated batch, failing before the gate is switched on is the discovery, not a miss
      if (!(round.gate && !gate && !e.pass)) tries++;
      if (!e.pass) {
        note.textContent = !e.checks.nonLeaf
          ? (gate ? 'A non-leaf still gets a diagnosis.' : 'A shoe just got diagnosed with a crop disease. No threshold fixes this, because the model is confidently wrong. Something has to check it’s a leaf first.')
          : !e.checks.accuracy ? 'Too many wrong answers reach the farmer. Raise the bar so the model stays quiet when unsure.'
          : 'Now it barely answers anyone. Lower the bar a little so farmers still get help.';
        return;
      }
      done = true;
      if (tries === 1) firstTry++;
      head.lastChild.textContent = `First-try passes ${firstTry}`;
      note.textContent = r === 0 ? `Locked at ${threshold.toFixed(2)}: ${pct(e.accuracy)} accurate while answering ${pct(e.coverage)} of photos.`
        : r === 1 ? `Locked at ${threshold.toFixed(2)}: it answers only ${pct(e.coverage)} of field photos, but ${pct(e.accuracy)} of those are right. The rest go to a human expert instead of a confident wrong answer.`
        : `With the leaf gate on, non-leaves are sent back with “please photograph a leaf”, and the threshold handles the rest.`;
      lockBtn.remove();
      const last = r === ROUNDS.length - 1;
      actions.append(el('button', { class: 'ag-btn', type: 'button', onclick: () => { if (last) onDone({ score: firstTry, total: ROUNDS.length }); else { r++; render(); } } }, last ? 'See results' : 'Next batch →'));
    });

    root.replaceChildren(head, tip,
      el('div', { class: 'cc-board' }, strip, axis, legend),
      controls, el('div', { class: 'cc-meta' }, goalsEl, stats), note, actions);
    paint();
  }
  render();
  return { destroy() {} };
}
