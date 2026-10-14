// ─────────────────────────────────────────────────────────────
//  Timestamp Detective (from Earshot): play the quote checker.
//  An AI answer cites quotes from a podcast with a timestamp each.
//  Decide for every citation: said word for word at that moment,
//  said but at the wrong moment (then repair it by clicking where it
//  starts), or never said at all.
//  (All podcasts and speakers here are made up for the game.)
// ─────────────────────────────────────────────────────────────
import { el } from './dom.js';

export const WORD_GAP = 0.45; // seconds per word inside a transcript line
export const TOLERANCE = 1;   // a citation within 1 s of the real start counts as on time

export const ROUNDS = [
  {
    show: 'The Half-Space · Ep. 12', topic: 'football tactics',
    question: 'Why did the team switch to a back three?',
    lines: [
      { t: 724, text: 'We switched to a back three because our full backs kept getting caught upfield.' },
      { t: 730, text: 'With three centre backs, the wing backs could push on without leaving a hole.' },
      { t: 737, text: 'Honestly the pressing numbers went up straight away, about twenty percent more high turnovers.' },
      { t: 745, text: "It wasn't perfect, we still struggled against teams that sat deep." },
    ],
    claims: [
      { said: 'The switch came because the full backs were exposed.', quote: 'our full backs kept getting caught upfield', at: 727 },
      { said: 'Pressing improved dramatically.', quote: 'the pressing numbers went up by half', at: 738 },
      { said: 'Deep defences were still a problem.', quote: 'we still struggled against teams that sat deep', at: 731 },
    ],
  },
  {
    show: 'Shipping LLMs · Ep. 31', topic: 'AI engineering',
    question: 'How do they stop the model inventing numbers?',
    lines: [
      { t: 2020, text: 'Every number in the answer gets checked against the source document before it ships.' },
      { t: 2027, text: "If the checker can't find the figure word for word, the answer goes back for one repair attempt." },
      { t: 2035, text: "And if the repair fails too, we just say we don't know. That's better than a confident wrong answer." },
      { t: 2044, text: 'Users trust a system that admits its gaps.' },
    ],
    claims: [
      { said: 'Unverified numbers trigger a retry.', quote: 'the answer goes back for one repair attempt', at: 2032 },
      { said: 'Admitting uncertainty beats guessing.', quote: "That's better than a confident wrong answer", at: 2020 },
      { said: 'Users prefer honest systems.', quote: 'users always trust systems that admit gaps', at: 2044 },
    ],
  },
  {
    show: 'Box Box Strategy · Ep. 7', topic: 'Formula 1',
    question: 'Why did they pit early?',
    lines: [
      { t: 495, text: 'We boxed early to get the undercut on the car ahead.' },
      { t: 500, text: 'Fresh tyres are worth about a second a lap for the first few laps.' },
      { t: 507, text: 'The risk is traffic. If you come out behind slower cars the undercut is gone.' },
      { t: 515, text: 'Today the gap was clean, so the call worked.' },
    ],
    claims: [
      { said: 'Traffic can ruin the plan.', quote: 'the undercut is gone', at: 495 },
      { said: 'New tyres are much quicker at first.', quote: 'Fresh tyres are worth about a second a lap', at: 500 },
      { said: 'Pitting early is a guaranteed win.', quote: 'early stops always win races', at: 509 },
      { said: 'This time it paid off.', quote: 'the gap was clean, so the call worked', at: 516 },
    ],
  },
];

// ── pure logic (also used by the tests) ──
export const norm = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
export const fmt = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

// every word of the transcript with its start time
export function words(round) {
  const out = [];
  round.lines.forEach((ln, li) => ln.text.split(/\s+/).forEach((w, wi) => out.push({ w, li, wi, time: Math.round(ln.t + wi * WORD_GAP) })));
  return out;
}

// where a quote appears word for word (within one line), or null
export function findQuote(round, quote) {
  const q = norm(quote);
  for (let li = 0; li < round.lines.length; li++) {
    const ws = norm(round.lines[li].text);
    for (let i = 0; i + q.length <= ws.length; i++) {
      if (q.every((x, k) => ws[i + k] === x)) {
        // map the normalised index back to the raw word index (punctuation-only tokens are rare here)
        return { li, wi: i, time: Math.round(round.lines[li].t + i * WORD_GAP) };
      }
    }
  }
  return null;
}

// the truth for one citation: 'exact' | 'mistimed' | 'missing'
export function verdict(round, claim) {
  const hit = findQuote(round, claim.quote);
  if (!hit) return 'missing';
  return Math.abs(hit.time - claim.at) <= TOLERANCE ? 'exact' : 'mistimed';
}

// 1 point when the call is right; a wrong-time call also needs the right repair
export function scoreClaim(round, claim, pick, repairedTime) {
  const truth = verdict(round, claim);
  if (pick !== truth) return 0;
  if (truth !== 'mistimed') return 1;
  const hit = findQuote(round, claim.quote);
  return repairedTime != null && Math.abs(repairedTime - hit.time) <= TOLERANCE ? 1 : 0;
}

const LABELS = { exact: '✓ Exact', mistimed: '⏱ Wrong time', missing: '✗ Never said' };

export function mount(root, { onDone }) {
  let r = 0, score = 0, total = 0;

  function render() {
    const round = ROUNDS[r];
    const picks = round.claims.map(() => ({ pick: null, repaired: null }));
    let repairing = -1; // claim index waiting for a word click
    let checked = false;

    const head = el('div', { class: 'ag-head' },
      el('span', { class: 'ag-chip' }, `Episode ${r + 1} / ${ROUNDS.length}`),
      el('h3', { class: 'ag-title' }, round.show),
      el('span', { class: 'ag-chip ag-chip--score' }, `Score ${score} / ${total}`),
    );
    const q = el('div', { class: 'ag-question' }, el('span', {}, 'Listener asked'), el('p', {}, round.question));

    // transcript with clickable words
    const wordBtns = [];
    const transcript = el('div', { class: 'qc-transcript' },
      el('p', { class: 'ag-label' }, `Transcript · ${round.topic}`),
      ...round.lines.map((ln, li) => el('p', { class: 'qc-line' },
        el('span', { class: 'qc-time' }, fmt(ln.t)),
        el('span', { class: 'qc-words' }, ...ln.text.split(/\s+/).map((w, wi) => {
          const time = Math.round(ln.t + wi * WORD_GAP);
          const b = el('button', { class: 'qc-word', type: 'button', title: fmt(time), tabindex: '-1' }, w);
          b.addEventListener('click', () => {
            if (repairing < 0 || checked) return;
            picks[repairing].repaired = time;
            repairing = -1;
            paint();
          });
          wordBtns.push({ b, li, wi, time });
          return [b, ' '];
        }).flat()),
      )),
    );

    // the AI's cited answer
    const claimEls = round.claims.map((c, ci) => {
      const btns = Object.keys(LABELS).map((k) => {
        const b = el('button', { class: 'qc-pick', type: 'button', 'data-k': k }, LABELS[k]);
        b.addEventListener('click', () => {
          if (checked) return;
          picks[ci].pick = k;
          if (k === 'mistimed') { repairing = ci; picks[ci].repaired = null; if (transcript.getBoundingClientRect().bottom < 0) transcript.scrollIntoView({ block: 'start', behavior: 'smooth' }); } else { if (repairing === ci) repairing = -1; picks[ci].repaired = null; }
          paint();
        });
        return b;
      });
      const repair = el('p', { class: 'qc-repair' });
      const why = el('p', { class: 'qc-why' });
      const box = el('div', { class: 'qc-claim' },
        el('p', { class: 'qc-said' }, c.said),
        el('p', { class: 'qc-quote' }, `“${c.quote}”`, el('span', { class: 'qc-stamp' }, `▶ ${fmt(c.at)}`)),
        el('div', { class: 'qc-picks' }, ...btns),
        repair, why,
      );
      return { box, btns, repair, why };
    });
    const answer = el('div', { class: 'qc-answer' }, el('p', { class: 'ag-label' }, 'AI answer · each claim cites a quote and a time'), ...claimEls.map((x) => x.box));

    const note = el('p', { class: 'ag-note', role: 'status' }, 'Judge every citation. If it was said at a different moment, pick Wrong time and click the word where it really starts.');
    const checkBtn = el('button', { class: 'ag-btn', type: 'button' }, 'Run the checker');
    const actions = el('div', { class: 'ag-actions' }, checkBtn);

    function paint() {
      claimEls.forEach((x, ci) => {
        const p = picks[ci];
        x.btns.forEach((b) => b.classList.toggle('is-on', b.dataset.k === p.pick));
        x.box.classList.toggle('is-repairing', repairing === ci);
        x.repair.textContent = p.pick === 'mistimed'
          ? (repairing === ci ? 'Now click the word in the transcript where this quote starts…' : p.repaired != null ? `Repaired to ▶ ${fmt(p.repaired)}` : '')
          : '';
      });
      transcript.classList.toggle('is-picking', repairing >= 0);
      wordBtns.forEach((w) => w.b.tabIndex = repairing >= 0 ? 0 : -1);
      checkBtn.disabled = picks.some((p) => !p.pick || (p.pick === 'mistimed' && p.repaired == null));
    }

    checkBtn.addEventListener('click', () => {
      if (checked) return;
      checked = true; repairing = -1;
      let got = 0;
      round.claims.forEach((c, ci) => {
        const x = claimEls[ci], p = picks[ci];
        const truth = verdict(round, c);
        const pts = scoreClaim(round, c, p.pick, p.repaired);
        got += pts;
        x.box.classList.add(pts ? 'is-right' : 'is-wrong');
        const hit = findQuote(round, c.quote);
        if (hit) {
          const n = norm(c.quote).length;
          wordBtns.filter((w) => w.li === hit.li && w.wi >= hit.wi && w.wi < hit.wi + n).forEach((w) => w.b.classList.add('is-hit'));
        }
        x.why.textContent = truth === 'exact' ? `Found word for word at ${fmt(hit.time)}. Citation verified.`
          : truth === 'mistimed' ? `Said word for word, but at ${fmt(hit.time)}, not ${fmt(c.at)}. A repair pass fixes the timestamp instead of throwing the answer away.`
          : 'Not in the transcript word for word. It’s a paraphrase or an invention, so the checker blocks it.';
      });
      score += got; total += round.claims.length;
      head.lastChild.textContent = `Score ${score} / ${total}`;
      note.textContent = got === round.claims.length ? 'Every citation judged correctly.' : `${got} of ${round.claims.length} correct. Highlighted words show where each real quote sits.`;
      checkBtn.remove();
      const last = r === ROUNDS.length - 1;
      actions.append(el('button', { class: 'ag-btn', type: 'button', onclick: () => { if (last) onDone({ score, total }); else { r++; render(); } } }, last ? 'See results' : 'Next episode →'));
      paint();
    });

    root.replaceChildren(head, q, el('div', { class: 'qc-grid' }, transcript, answer), note, actions);
    paint();
  }
  render();
  return { destroy() {} };
}
