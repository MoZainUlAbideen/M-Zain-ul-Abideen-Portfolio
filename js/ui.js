// ─────────────────────────────────────────────────────────────
//  HTML overlay: HUD, "Press E" prompt, podium popups, goal banner.
// ─────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
}

const isExternal = (href) => /^https?:|\.pdf$/i.test(href); // opens in a new tab
function link(href, text, cls) {
  const a = el('a', { href, class: cls || '' }, text);
  if (isExternal(href)) { a.target = '_blank'; a.rel = 'noopener'; }
  return a;
}

export class UI {
  constructor() {
    this.panelOpen = false;
    this.onClose = null;
    this.prompt = $('prompt');
    this.promptLabel = $('prompt-label');
    this.panel = $('panel');
    this.card = $('panel-card');
    this.boostNum = $('boost-num');
    this.boostArc = $('boost-arc');
    this.goalEl = $('goal');
    this.goalTimer = 0;
    this.panel.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) this.close(); });
    this.lastBoost = -1;
  }

  setPrompt(pod) {
    if (!pod) { this.prompt.hidden = true; this.promptPod = null; return; }
    if (this.promptPod === pod.id && !this.prompt.hidden) return;
    this.promptPod = pod.id;
    this.promptLabel.textContent = pod.label;
    this.prompt.style.setProperty('--accent', pod.color);
    this.prompt.hidden = false;
  }

  setBoost(v) {
    const r = Math.round(v);
    if (r === this.lastBoost) return;
    this.lastBoost = r;
    this.boostNum.textContent = r;
    this.boostArc.style.strokeDashoffset = String(283 * (1 - v / 100));
  }

  setScore(goals) {
    const n = $('score-goals');
    if (!n) return;
    n.textContent = goals;
    n.classList.remove('is-bump');
    void n.offsetWidth;
    n.classList.add('is-bump');
  }

  setBallCam(on) { $('ballcam').classList.toggle('is-on', on); }

  goal(team) {
    this.goalEl.className = `goal goal--${team === 'orange' ? 'blue' : 'orange'}`;
    this.goalEl.hidden = false;
    void this.goalEl.offsetWidth; // restart animation
    this.goalEl.classList.add('is-show');
    clearTimeout(this.goalTimer);
    this.goalTimer = setTimeout(() => { this.goalEl.hidden = true; }, 2600);
  }

  open(pod) {
    const p = pod.panel;
    const body = $('panel-body');
    body.replaceChildren();
    this.card.style.setProperty('--accent', pod.color);
    $('panel-kicker').textContent = p.kicker || '';
    const title = $('panel-title');
    title.replaceChildren(p.href ? link(p.href, p.title, 'title-link') : p.title);
    if (p.href) title.firstChild.append(el('span', { class: 'arrow', 'aria-hidden': 'true' }, ' ↗'));

    if (p.subtitle) body.append(el('p', { class: 'subtitle' }, p.subtitle));
    if (p.tagline) body.append(el('p', { class: 'tagline' }, p.tagline));
    for (const t of p.paragraphs || []) body.append(el('p', {}, t));
    if (p.comingSoon) body.append(el('div', { class: 'soon' }, el('span', { class: 'soon__dot' }), 'Coming soon'));
    if (p.facts) {
      body.append(el('dl', { class: 'facts' }, p.facts.map(([k, v, logo]) => el('div', { class: logo ? 'has-logo' : '' },
        el('dt', {}, k),
        el('dd', {}, logo ? el('img', { class: 'facts__logo', src: logo, alt: '' }) : null, v),
      ))));
    }
    if (p.experience) {
      body.append(el('ol', { class: 'timeline' }, p.experience.map((x) => el('li', {},
        el('div', { class: 'timeline__head' }, el('strong', {}, x.role), el('span', {}, x.when)),
        el('p', { class: 'timeline__org' }, x.org),
        el('ul', { class: 'bullets' }, x.points.map((b) => el('li', {}, b))),
      ))));
    }
    if (p.lede) body.append(el('p', { class: 'lede' }, p.lede));
    if (p.skills && p.lab) {
      body.append(el('div', { class: 'lab' }, p.skills.map(([group, list], i) => el('section', { class: `lab__group lab__group--${i % 5}` },
        el('h3', { class: 'lab__title' }, group),
        el('ul', { class: 'lab__chips' }, list.map((t) => el('li', {}, t))),
      ))));
    } else if (p.skills) {
      body.append(el('div', { class: 'skills' }, p.skills.map(([group, list]) => el('div', { class: 'skills__row' },
        el('p', { class: 'skills__group' }, group),
        el('ul', { class: 'chips' }, list.map((t) => el('li', {}, t))),
      ))));
    }
    if (p.items) {
      body.append(el('ol', { class: 'projects' }, p.items.map((it, i) => el('li', { class: 'project' },
        el('span', { class: 'project__num', 'aria-hidden': 'true' }, String(i + 1).padStart(2, '0')),
        el('div', { class: 'project__main' },
          el('h3', { class: 'project__title' }, link(it.href, it.title, 'title-link'), el('span', { class: 'arrow', 'aria-hidden': 'true' }, ' ↗')),
          el('p', { class: 'tagline' }, it.tagline),
          el('ul', { class: 'bullets' }, it.points.map((b) => el('li', {}, b))),
          el('div', { class: 'project__foot' },
            el('ul', { class: 'chips' }, it.tech.map((t) => el('li', {}, t))),
            el('div', { class: 'links links--small' }, it.links.map((l) => link(l.href, l.label, 'btn btn--small'))),
          ),
        ),
      ))));
    }
    if (p.life) body.append(this.renderLife(p.life));
    if (p.vision) {
      p.vision.forEach((s, i) => {
        body.append(el('h3', { class: 'section' }, s.heading));
        const imgClass = `story__img${s.photo ? ' story__img--photo' : ''}`;
        body.append(el('div', { class: `story${i % 2 ? ' story--flip' : ''}${s.photo ? ' story--photo' : ''}` },
          el('p', { class: 'story__text' }, s.text),
          s.tip
            ? el('span', { class: 'story__pic', tabindex: '0' },
                el('img', { class: imgClass, src: s.img, alt: s.alt, loading: 'lazy' }),
                el('span', { class: 'story__tip', role: 'tooltip' }, s.tip))
            : el('img', { class: imgClass, src: s.img, alt: s.alt, loading: 'lazy' }),
        ));
      });
    }
    if (p.certs) {
      body.append(el('ul', { class: 'certs' }, p.certs.map((c) => el('li', { class: 'cert' },
        el('div', { class: 'cert__medal', 'aria-hidden': 'true' }),
        el('div', {},
          link(c.href, c.title, 'cert__title'),
          el('p', { class: 'cert__meta' }, [c.issuer, c.date].filter(Boolean).join(' · ')),
        ),
        el('span', { class: 'cert__go', 'aria-hidden': 'true' }, '↗'),
      ))));
    }
    if (p.contact?.length) {
      body.append(el('h3', { class: 'section' }, 'Contact'));
      body.append(el('div', { class: 'links' }, p.contact.map((l) => link(l.href, l.label, 'btn'))));
    }
    if (p.links?.length) {
      body.append(el('div', { class: 'links' }, p.links.map((l) => link(l.href, l.label, 'btn'))));
    }

    this.card.classList.toggle('panel__card--wide', !!(p.items || p.experience || p.skills || p.life || p.vision));
    this.card.classList.toggle('panel__card--lab', !!p.lab);
    this.card.scrollTop = 0;
    this.panel.hidden = false;
    this.panelOpen = true;
    this.prompt.hidden = true;
    requestAnimationFrame(() => this.panel.classList.add('is-open'));
    this.card.focus();
  }

  // "Life Uncoded": community work + sports, with a hover/tap photo pop-up
  renderLife(life) {
    const frag = document.createDocumentFragment();
    const logo = (src, alt) => el('img', { class: 'life__logo', src, alt, loading: 'lazy' });
    // a favourite quote, shown under the card text
    const quote = (q) => q ? el('blockquote', { class: 'life-quote' },
      el('p', {}, `\u201c${q.text}\u201d`),
      q.by ? el('cite', {}, `\u2014 ${q.by}`) : null) : null;

    if (life.community) {
      frag.append(el('h3', { class: 'section' }, life.community.heading));
      for (const it of life.community.items) {
        frag.append(el('article', { class: 'life-card' },
          logo(it.logo, it.logoAlt),
          el('div', {},
            el('h4', { class: 'life-card__title' }, link(it.href, it.role, 'title-link')),
            el('p', { class: 'life-card__org' }, link(it.href, it.org, 'life-card__link')),
            el('p', { class: 'life-card__meta' }, link(it.href, it.place, 'life-card__link')),
            el('p', { class: 'life-card__text' }, it.text),
            quote(it.quote),
          ),
        ));
      }
    }

    if (life.aspiration) {
      frag.append(el('h3', { class: 'section' }, life.aspiration.heading));
      for (const it of life.aspiration.items) {
        frag.append(el('article', { class: 'life-card life-card--sport' },
          logo(it.logo, it.logoAlt),
          el('div', {},
            el('p', { class: 'life-card__sport' }, it.sport),
            el('h4', { class: 'life-card__title' }, it.href ? link(it.href, it.name, 'title-link') : it.name),
            el('p', { class: 'life-card__text' }, it.text),
            it.repo ? (() => {
              const a = link(it.repo.href, '', 'repo-link');
              a.setAttribute('aria-label', `${it.repo.label} repository`);
              const i = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
              i.setAttribute('viewBox', '0 0 24 24');
              i.setAttribute('aria-hidden', 'true');
              // generic code-repository icon (a book with </>)
              i.innerHTML = '<path d="M5 3.5h11.5a2 2 0 0 1 2 2V20H6.5A1.5 1.5 0 0 1 5 18.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M5 18.5A1.5 1.5 0 0 1 6.5 17h12" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 8.5 8 10.5l2 2M13.5 8.5l2 2-2 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
              a.append(i, el('span', {}, it.repo.label), el('span', { class: 'arrow', 'aria-hidden': 'true' }, '↗'));
              return a;
            })() : null,
          ),
        ));
      }
    }

    // sports sections: "Beyond" (competitive) and "Not Competitive but Fascinating"
    for (const group of [life.beyond, life.fascinating]) {
      if (!group) continue;
      frag.append(el('h3', { class: 'section' }, group.heading));
      if (group.title) frag.append(el('p', { class: 'life__big' }, group.title));
      for (const it of group.items) {
        const card = el('article', { class: 'life-card life-card--sport' },
          logo(it.logo, it.logoAlt),
          el('div', {},
            el('p', { class: 'life-card__sport' }, it.sport),
            el('h4', { class: 'life-card__title' }, it.name),
            el('p', { class: 'life-card__text' }, it.text),
            quote(it.quote),
          ),
        );
        if (it.player) {
          const btn = el('button', { class: 'poc', type: 'button', 'aria-label': it.player.label, 'aria-expanded': 'false' },
            el('span', { class: 'poc__icon', 'aria-hidden': 'true' },
              // simple shirt outline
              (() => {
                const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                s.setAttribute('viewBox', '0 0 48 48');
                s.innerHTML = '<path d="M17 6l-9 5-5 10 7 4 3-5v22h22V20l3 5 7-4-5-10-9-5c-1 3.5-3.6 5.5-7 5.5S18 9.5 17 6z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M21 22h6v14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>';
                return s;
              })(),
            ),
            el('span', { class: 'poc__label' }, it.player.label),
            el('span', { class: 'poc__pop', role: 'tooltip' }, el('img', { src: it.player.img, alt: it.player.alt, loading: 'lazy' })),
          );
          // tap to toggle on touch screens; hover/focus handles desktop via CSS
          btn.addEventListener('click', () => {
            const open = btn.classList.toggle('is-open');
            btn.setAttribute('aria-expanded', String(open));
          });
          card.querySelector('div').append(btn);
        }
        frag.append(card);
      }
    }
    return frag;
  }

  close() {
    if (!this.panelOpen) return;
    this.panel.classList.remove('is-open');
    this.panelOpen = false;
    this.promptPod = null;
    setTimeout(() => { if (!this.panelOpen) this.panel.hidden = true; }, 180);
    this.onClose?.();
  }
}
