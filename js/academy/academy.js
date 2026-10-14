// ─────────────────────────────────────────────────────────────
//  My Academy: full-screen overlay with six AI paths.
//  chooser → briefing → game → results. Progress is remembered
//  in this visitor's browser only (nice-to-have, never required).
// ─────────────────────────────────────────────────────────────
import { el, svgIcon, ICONS } from './dom.js';
import * as hallucination from './hallucination.js';
import * as retrieval from './retrieval.js';
import * as pitcrew from './pitcrew.js';
import * as golf from './golf.js';
import * as quotecheck from './quotecheck.js';
import * as confidence from './confidence.js';

const PATHS = [
  {
    id: 'halluc', game: hallucination, icon: ICONS.search, color: '#ff4fa8',
    tag: 'Evaluation', title: 'Hallucination Hunt', cta: 'Start the hunt',
    blurb: 'Read the sources, then catch every sentence the AI made up.',
    lead: 'An AI answer can sound perfect and still be wrong. You get the question, the documents the AI was given, and its answer. Your job is to catch the claims the documents don’t back up.',
    steps: ['Read the sources on the left.', 'Click every sentence in the answer that the sources don’t support.', 'Hit Check answer to see what you caught and what slipped past.', 'Stuck? The Hint button points at a suspicious sentence.'],
    built: 'EdgarIQ’s numeric checker · Rehnuma’s citation critic',
    lesson: 'You just did what an evaluation harness does: compare every claim against the evidence. I automate exactly this in EdgarIQ, where a checker verifies every number against the filing, and in Rehnuma, where a critic rejects answers without a citation.',
  },
  {
    id: 'retrieval', game: retrieval, icon: ICONS.stack, color: '#38bdf8',
    tag: 'RAG', title: 'Retrieval Relay', cta: 'Open the archive',
    blurb: 'Choose what the model reads, and watch the answer change.',
    lead: 'A RAG system can only be as good as what it retrieves. You pick up to three document chunks for the model to read, then see whether it answers correctly, gets confused, or makes something up.',
    steps: ['Read the question.', 'Click chunks in the document store to put them in the context window (3 max).', 'Send to model and read the verdict.', 'The last round is automatic retrieval. Find the one setting that fixes it.'],
    built: 'EdgarIQ: date-aware retrieval, 29% → 100% on the golden set',
    lesson: 'Look-alike chunks are the silent killer of RAG: same words, wrong quarter. In EdgarIQ, adding a metadata filter on the filing date was the single change that took the golden-set score from 29% to 100%.',
  },
  {
    id: 'pitcrew', game: pitcrew, icon: ICONS.wrench, color: '#ffb020',
    tag: 'Agents', title: 'Agent Pit Crew', cta: 'Enter the pit lane',
    blurb: 'Line up the tools so the agent actually finishes the job.',
    lead: 'An AI agent isn’t one magic prompt. It’s a pipeline of tools, where each one needs something the previous one produced. Build the pit stop, hit Run, and see where it breaks.',
    steps: ['Read the request and what the agent starts with.', 'Click tools to add them to the pit lane, in order.', 'Run the pipeline. Every step checks it has the inputs it needs.', 'Watch out for shortcut tools that skip the evidence.'],
    built: 'Rehnuma’s bill pipeline · EdgarIQ’s planner → critic · Parity’s scanners',
    lesson: 'Good agents are mostly plumbing: the right steps, in the right order, with a check at the end. The three missions you ran are simplified versions of the real pipelines behind Rehnuma, EdgarIQ and Parity.',
  },
  {
    id: 'golf', game: golf, icon: ICONS.flag, color: '#34d399',
    tag: 'ML basics', title: 'Learning-Rate Golf', cta: 'Tee off',
    blurb: 'Tune one number and roll the ball into the valley.',
    lead: 'Training a model is a ball rolling downhill on a loss curve. The learning rate decides how big each step is. Too small and it crawls, too big and it flies off. This is real gradient descent, running live.',
    steps: ['Set the learning rate with the slider.', 'Hit Train and watch each step of gradient descent.', 'Land in the hole within the step budget.', 'The last hole unlocks momentum.'],
    built: 'RISETech internship: tuning classifiers from 71% to 99% accuracy',
    lesson: 'Every model I train starts with this exact tension: step size versus stability. Momentum is how optimisers like Adam roll past small bumps instead of getting stuck in them.',
  },
  {
    id: 'earshot', game: quotecheck, icon: ICONS.wave, color: '#a78bfa',
    tag: 'Speech + RAG', title: 'Timestamp Detective', cta: 'Press play',
    blurb: 'Check every quote an AI pulled from a podcast, down to the second.',
    lead: 'An answer that cites a podcast is only useful if the quote was really said, and said at that moment. You get the transcript with word-level timestamps and an AI answer full of citations. Play the quote checker.',
    steps: ['Read the question and the transcript.', 'For each citation pick Exact, Wrong time or Never said.', 'For a Wrong time, click the transcript word where the quote really starts to repair it.', 'Run the checker and see which citations would have reached a listener.'],
    built: 'Earshot: verbatim quote checker + one repair pass',
    lesson: 'This is Earshot’s quote checker. Plain code confirms every quote appears word for word in the Whisper transcript, then checks its timestamp. A single repair pass fixes citations instead of discarding them, which raised answered questions from 77.8% to 93.3% and correctly timed citations from 62.2% to 80.0%.',
  },
  {
    id: 'dehqan', game: confidence, icon: ICONS.leaf, color: '#a3e635',
    tag: 'Computer vision', title: 'Confidence Call', cta: 'Open the field kit',
    blurb: 'Decide when a crop-disease model should answer, and when it should stay quiet.',
    lead: 'A model that is wrong with confidence is worse than one that says “I’m not sure”. Each batch shows a leaf-disease model’s predictions on a confidence scale. Set the bar it must clear before it is allowed to answer a farmer.',
    steps: ['Read the field notes for the batch.', 'Drag the threshold: dots to the right get an answer, dots to the left go to a human expert.', 'Meet the goals for accuracy and for how many farmers still get help.', 'The last batch unlocks a leaf gate for photos that aren’t leaves at all.'],
    built: 'Dehqan: selective prediction + a zero-shot CLIP leaf gate',
    lesson: 'This is selective prediction, the core of Dehqan. Lab accuracy (95.5%) collapsed on real field photos (11.5%), so the model answers only above 0.9 confidence: about a quarter of field photos, 79% of them correct, and the rest go to an extension office. A CLIP check rejects non-leaves first, because no confidence threshold can stop a model that is confidently wrong about a shoe.',
  },
];

const STORE = 'zain-academy-v1';
const loadProgress = () => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } };
const saveProgress = (p) => { try { localStorage.setItem(STORE, JSON.stringify(p)); } catch {} };

export class Academy {
  constructor() {
    this.isOpen = false;
    this.onClose = null;
    this.game = null;
    this.progress = loadProgress();
    this.root = el('div', { class: 'academy', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'My Academy' });
    this.closeBtn = el('button', { class: 'academy__x', type: 'button', 'aria-label': 'Close academy' }, '×');
    this.closeBtn.addEventListener('click', () => this.close());
    this.body = el('div', { class: 'academy__body' });
    this.root.append(this.closeBtn, this.body);
    document.body.append(this.root);
  }

  open() {
    this.isOpen = true;
    this.root.hidden = false;
    requestAnimationFrame(() => this.root.classList.add('is-open'));
    this.showChooser();
    this.closeBtn.focus();
  }

  close() {
    if (!this.isOpen) return;
    this.game?.destroy(); this.game = null;
    this.isOpen = false;
    this.root.classList.remove('is-open');
    setTimeout(() => { if (!this.isOpen) this.root.hidden = true; }, 200);
    this.onClose?.();
  }

  // Esc: from a game go back to the paths, from the paths close
  back() {
    if (this.screen === 'chooser') this.close(); else this.showChooser();
  }

  showChooser() {
    this.game?.destroy(); this.game = null;
    this.screen = 'chooser';
    this.root.style.removeProperty('--accent');
    const cards = PATHS.map((p) => {
      const best = this.progress[p.id];
      const b = el('button', { class: 'ac-card', type: 'button', style: `--accent:${p.color}` },
        el('span', { class: 'ac-card__icon' }, svgIcon(p.icon)),
        el('span', { class: 'ac-card__tag' }, p.tag),
        el('strong', { class: 'ac-card__title' }, p.title),
        el('span', { class: 'ac-card__blurb' }, p.blurb),
        el('span', { class: 'ac-card__cta' }, `${p.cta} →`),
        best ? el('span', { class: 'ac-card__best' }, svgIcon(ICONS.check), `Best ${best.score}/${best.total}`) : null,
      );
      b.addEventListener('click', () => this.showIntro(p));
      return b;
    });
    const done = PATHS.filter((p) => this.progress[p.id]).length;
    this.body.replaceChildren(
      el('div', { class: 'ac-hero' },
        el('p', { class: 'ac-kicker' }, 'My Academy · AI engineering lab'),
        el('h2', { class: 'ac-h' }, 'Choose your AI path'),
        el('p', { class: 'ac-sub' }, 'Six disciplines, six short missions. Play through the problems I actually solve as an AI engineer, and walk away knowing how that part of AI really works.'),
        el('p', { class: 'ac-progress' }, `${done} / ${PATHS.length} paths completed`),
      ),
      el('div', { class: 'ac-cards' }, ...cards),
    );
  }

  showIntro(p) {
    this.screen = 'intro';
    this.root.style.setProperty('--accent', p.color);
    const start = el('button', { class: 'ag-btn ag-btn--big', type: 'button' }, `${p.cta} →`);
    start.addEventListener('click', () => this.startGame(p));
    this.body.replaceChildren(
      this.backBtn(),
      el('div', { class: 'ac-intro' },
        el('span', { class: 'ag-chip' }, p.tag),
        el('h2', { class: 'ac-h ac-h--left' }, p.title),
        el('p', { class: 'ac-lead' }, p.lead),
        el('ol', { class: 'ac-steps' }, ...p.steps.map((s) => el('li', {}, s))),
        el('p', { class: 'ac-built' }, el('span', {}, 'Built from my work'), p.built),
        start,
      ),
    );
    start.focus();
  }

  startGame(p) {
    this.screen = 'game';
    const stage = el('div', { class: 'ag' });
    this.body.replaceChildren(this.backBtn(), stage);
    this.game = p.game.mount(stage, { onDone: (res) => this.showResults(p, res) });
  }

  showResults(p, res) {
    this.game?.destroy(); this.game = null;
    this.screen = 'results';
    const prev = this.progress[p.id];
    if (!prev || res.score / res.total > prev.score / prev.total) {
      this.progress[p.id] = { score: res.score, total: res.total };
      saveProgress(this.progress);
    }
    const pct = Math.round((res.score / res.total) * 100);
    const replay = el('button', { class: 'ag-btn ag-btn--ghost', type: 'button' }, 'Play again');
    replay.addEventListener('click', () => this.startGame(p));
    const next = el('button', { class: 'ag-btn', type: 'button' }, 'Back to paths');
    next.addEventListener('click', () => this.showChooser());
    this.body.replaceChildren(
      el('div', { class: 'ac-results' },
        el('span', { class: 'ag-chip' }, `${p.title} complete`),
        el('p', { class: 'ac-score' }, el('b', {}, res.score), ` / ${res.total}`),
        el('p', { class: 'ac-score__pct' }, pct === 100 ? 'Flawless.' : pct >= 70 ? 'Nicely done.' : 'Good start. Replay to beat it.'),
        el('h3', { class: 'ac-results__h' }, 'What you just practised'),
        el('p', { class: 'ac-lead' }, p.lesson),
        el('p', { class: 'ac-built' }, el('span', {}, 'Built from my work'), p.built),
        el('div', { class: 'ag-actions ag-actions--center' }, replay, next),
      ),
    );
    next.focus();
  }

  backBtn() {
    const b = el('button', { class: 'ac-back', type: 'button' }, svgIcon(ICONS.back), 'All paths');
    b.addEventListener('click', () => this.showChooser());
    return b;
  }
}
