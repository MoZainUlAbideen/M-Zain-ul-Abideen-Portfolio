// ─────────────────────────────────────────────────────────────
//  A 1:30 match against the red bot.
//  Kickoff countdown → play → goal celebration → kickoff ... → full time.
//  Most goals wins; level at 0:00 means golden goal (next goal wins).
//  The clock only runs while the ball is live, like Rocket League.
// ─────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
export const MATCH_SECONDS = 90;

const fmt = (s) => {
  const t = Math.max(0, Math.ceil(s - 1e-6));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

export class Match {
  // hooks: { physics, bot, audio, onStart(), onStop() }
  constructor({ physics, bot, audio, onStart, onStop }) {
    Object.assign(this, { physics, bot, audio, onStart, onStop });
    this.phase = 'off'; // off | countdown | live | goal | over
    this.el = {
      hud: $('hud'), btn: $('match-btn'), board: $('scoreboard'), clock: $('match-clock'), note: $('match-note'),
      you: $('score-you'), botScore: $('score-bot'), cd: $('countdown'), result: $('result'),
    };
    this.el.btn.addEventListener('click', () => { this.toggle(); this.el.btn.blur(); });
    $('result-again').addEventListener('click', () => this.start());
    $('result-close').addEventListener('click', () => this.stop());
  }

  get on() { return this.phase !== 'off'; }
  get frozen() { return this.phase === 'countdown' || this.phase === 'over'; } // cars held at kickoff / full time
  get botLive() { return this.phase === 'live' || this.phase === 'goal'; }

  toggle() { if (this.on) this.stop(); else this.start(); }

  start() {
    this.you = 0; this.them = 0;
    this.time = MATCH_SECONDS; this.golden = false; this.ot = 0; this.lastShown = '';
    this.el.result.hidden = true;
    this.el.board.hidden = false;
    this.el.board.classList.remove('is-golden', 'is-low');
    this.el.hud.classList.add('is-match');
    this.el.btn.classList.add('is-live');
    this.el.btn.querySelector('span').textContent = 'End match';
    this.el.note.textContent = '';
    this.el.you.textContent = '0'; this.el.botScore.textContent = '0';
    this.physics.autoReset = false;
    this.onStart?.();
    this.kickoff();
    this.render();
  }

  stop() {
    this.phase = 'off';
    this.el.board.hidden = true;
    this.el.cd.hidden = true;
    this.el.result.hidden = true;
    this.el.hud.classList.remove('is-match');
    this.el.btn.classList.remove('is-live');
    this.el.btn.querySelector('span').textContent = 'Start match';
    this.physics.autoReset = true;
    this.physics.resetAll();
    this.onStop?.();
  }

  kickoff() {
    this.physics.resetAll();
    this.bot.reset();
    this.phase = 'countdown';
    this.cd = 3;
    this.lastTick = null;
  }

  // big text in the middle (countdown numbers, GO!, golden goal)
  flash(text, color, small = false) {
    const box = this.el.cd, span = box.querySelector('span');
    box.hidden = false;
    box.classList.toggle('countdown--small', small);
    span.style.setProperty('--cc', color);
    span.textContent = text;
    span.classList.remove('is-tick'); void span.offsetWidth; span.classList.add('is-tick');
    clearTimeout(this.flashT);
    this.flashT = setTimeout(() => { box.hidden = true; }, 950);
  }

  // returns true when the goal counts (only while the ball is live)
  goal(side) {
    if (this.phase !== 'live') return false;
    if (side === 'orange') this.you++; else this.them++; // ball in the orange (+x) goal = you scored
    const n = side === 'orange' ? this.el.you : this.el.botScore;
    n.textContent = side === 'orange' ? this.you : this.them;
    n.classList.remove('is-bump'); void n.offsetWidth; n.classList.add('is-bump');
    this.phase = 'goal';
    this.wait = 2.8;
    if (this.golden) this.wait = 2.2;
    return true;
  }

  update(dt) {
    if (this.phase === 'off' || this.phase === 'over') return;
    if (this.phase === 'countdown') {
      this.cd -= dt;
      const tick = Math.ceil(this.cd);
      if (tick !== this.lastTick && tick > 0 && tick <= 3) {
        this.lastTick = tick;
        this.flash(String(tick), this.golden ? '#ffbf47' : '#2f7bff');
        this.audio.beep(false);
      }
      if (this.cd <= 0) {
        this.phase = 'live';
        this.flash('GO!', this.golden ? '#ffbf47' : '#ff3347');
        this.audio.beep(true);
      }
    } else if (this.phase === 'live') {
      if (this.golden) this.ot += dt;
      else {
        this.time -= dt;
        if (this.time <= 0) {
          this.time = 0;
          if (this.you !== this.them) return this.end();
          // level: golden goal, from a fresh kickoff
          this.golden = true;
          this.el.board.classList.add('is-golden');
          this.el.note.textContent = 'Golden goal';
          this.audio.whistle(false);
          this.kickoff();
          this.cd = 4.2; // a beat longer so the banner can be read before 3-2-1
          this.flash('GOLDEN GOAL', '#ffbf47', true);
        }
      }
    } else if (this.phase === 'goal') {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.golden || (this.time <= 0 && this.you !== this.them)) return this.end();
        this.kickoff();
      }
    }
    this.render();
  }

  render() {
    const text = this.golden ? `+${fmt(this.ot)}` : fmt(this.time);
    if (text !== this.lastShown) { this.lastShown = text; this.el.clock.textContent = text; }
    this.el.board.classList.toggle('is-low', !this.golden && this.time <= 10 && this.phase === 'live');
  }

  end() {
    this.phase = 'over';
    clearTimeout(this.flashT);
    this.el.cd.hidden = true;
    this.render();
    this.audio.whistle(true);
    const win = this.you > this.them;
    const r = this.el.result;
    r.className = `result ${win ? 'result--win' : 'result--loss'}`;
    $('result-title').textContent = win ? 'You win!' : 'Bot wins';
    $('result-score').innerHTML = `<span class="y">${this.you}</span> – <span class="b">${this.them}</span>`;
    $('result-note').textContent = this.golden
      ? `Golden goal after ${fmt(this.ot)} of extra time.`
      : win ? (this.them === 0 ? 'Clean sheet. Nice driving.' : 'Nice driving.') : 'Run it back?';
    r.hidden = false;
    $('result-again').focus();
  }
}
