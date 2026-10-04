// ─────────────────────────────────────────────────────────────
//  Everything you'll want to edit as words (and where each podium
//  stands) lives in this one file.
//
//  Map of the pitch, seen from above:
//
//        top  (z = -32)
//    ┌──────────────┬──────────────┐
//    │ STACK    LIFE UNCODED   CERTS │
//  B │                             │ O    x runs left (-50) → right (+50)
//  L ▌goal         (o)        goal ▐ R    z runs top (-32) → bottom (+32)
//  U │                             │ A
//  E │ EXPERIENCE VISION WHO AM I PROJECTS│ N
//    └──────────────┴──────────────┘ G
//        bottom (z = +32)            E
// ─────────────────────────────────────────────────────────────

export const SITE = {
  name: 'Zain',
  role: 'AI Full Stack Engineer',
  splashIntro:
    "Hop in my car, knock the ball around, and drive up to the glowing podiums to see who I am, what I've built and what I've learned.",
};

const GH = 'https://github.com/MoZainUlAbideen';

// kind: 'about' | 'interests' | 'projects' | 'certs'  (changes the floating icon + popup layout)
// color: the podium's glow colour
// headline: optional big glowing sign floating above the podium's label
// plate: false hides the small label plate (the headline is used instead)
export const PODIUMS = [
  {
    id: 'about', kind: 'about', label: 'WHO AM I', headline: "ZAIN'S HQ", x: 0, z: 27, color: '#2de2ff',
    panel: {
      kicker: "Zain's HQ",
      title: 'Who am I',
      subtitle: 'Muhammad Zain-ul-Abideen · AI Full Stack Engineer · Islamabad, Pakistan',
      paragraphs: [
        'I ship production LLM applications: retrieval-augmented generation, multi-agent pipelines and eval harnesses on Python/FastAPI backends with Next.js frontends, backed by automated tests, CI/CD and observability.',
      ],
      facts: [
        ['Education', 'Bachelors in Electrical Engineering, NUST CEME · 2022 – 2026', 'assets/life/nust-ceme.png'],
      ],
      // Shown under a "Contact" heading. Resume opens in a new tab.
      contact: [
        { label: 'LinkedIn', href: 'https://www.linkedin.com/in/muhammad-zain-ul-abideen-nust/' },
        { label: 'GitHub', href: GH },
        { label: 'Resume', href: 'resume/Muhammad-Zain-ul-Abideen-Resume.pdf' },
        { label: 'Email', href: 'mailto:mu.zainulabideen@gmail.com' },
      ],
    },
  },
  {
    // on the bottom touchline, half in / half out (the glass opens here, see FIELD.touchPods in arena.js)
    id: 'vision', kind: 'vision', label: 'VISION', x: -19, z: 32, color: '#60a5fa',
    panel: {
      kicker: 'Behind the build',
      title: 'Vision',
      vision: [
        {
          heading: 'Rocket League',
          text: "\u201cThat probably u would have guessed till now, that's one of my all time favorite games, So combining my mini toy car with Rocket League made this vision come to life\u201d",
          img: 'assets/life/rocket-league.png',
          alt: 'Rocket League logo',
        },
        {
          heading: 'Where did this portfolio Idea come from',
          text: "\u201cThere's this mini car placed on my desk, and every time I look at it, Life resets\u201d",
          img: 'assets/life/beyond-car-photo.jpg',
          photo: true, // a real photo: shown framed, not as a cut-out
          alt: 'Photo of the purple Beyond Mini 4WD toy car on my desk',
          tip: "That's the car you're driving right now",   // pops up when you hover the picture
        },
      ],
    },
  },
  {
    id: 'interests', kind: 'interests', label: 'LIFE UNCODED', headline: 'LIFE UNCODED', plate: false,
    x: 0, z: -27, color: '#ff4fd8',
    panel: {
      kicker: 'Off the pitch',
      title: 'Life Uncoded',
      life: {
        community: {
          heading: 'Community Work',
          items: [
            {
              logo: 'assets/life/wwf.png',
              logoAlt: 'WWF logo',
              role: 'Collaborations Lead',
              org: 'WWF – Pakistan',
              place: 'Peshawar, Khyber Pakhtunkhwa, Pakistan · Remote',
              href: 'https://www.linkedin.com/in/muhammad-zain-ul-abideen-nust/details/experience/',
              text: 'Led the Collaborations team under WWF in support of education initiatives, contributing to awareness and learning activities focused on environmental responsibility and sustainable living. Engaged with communities and helped promote educational efforts that encouraged a greater understanding of conservation and the importance of protecting our environment.',
              quote: { text: 'Love it or Lose it', by: 'WWF' },
            },
          ],
        },
        beyond: {
          heading: 'Beyond',
          title: 'Competitive Sports Fanatic',
          items: [
            {
              sport: 'Football',
              logo: 'assets/life/fcb.png',
              logoAlt: 'FC Barcelona crest',
              name: 'FC Barcelona',
              text: "The first complete football match I watched was the 2015 Champions League final, and I've never looked back since. It's a hard love affair with this team, they almost bottle the Champions League every year, but they dismantle Real Madrid three times a year. Hahahah.",
              // hover / tap the badge to pop up the player's photo
              player: { label: 'Player of choice', img: 'assets/life/player.jpg', alt: 'Pedri in the FC Barcelona number 8 shirt' },
              quote: { text: 'Never give up, sit down, or grieve, find another way!!', by: 'Pedri' },
            },
            {
              sport: 'Cricket',
              logo: 'assets/life/pak-star.png',
              logoAlt: 'Pakistan cricket star emblem',
              name: 'Pakistan Cricket Team',
              text: "This Love affair has always been one sided. Still can't believe how I end up seeing all their matches ball by ball, well some things are bigger than sports. After all, this is the only sport we play.",
              player: { label: 'Player of choice', img: 'assets/life/player-akram.jpg', alt: 'Wasim Akram celebrating a wicket in the 1992 World Cup final' },
              quote: { text: 'First of all, convince yourself that you are the best, because the rest of your life is going to go proving this to others.', by: 'Wasim Akram' },
            },
            {
              sport: 'MMA',
              logo: 'assets/life/ufc.png',
              logoAlt: 'UFC logo',
              name: 'UFC',
              text: "My first ever experience was watching Khabib Nurmagomedov vs Conor McGregor in 2018, and since then I've followed the sport on and off, but always kept up with who the champions are in each division.",
              player: { label: 'Fighter of choice', img: 'assets/life/player-khabib.jpg', alt: 'Khabib Nurmagomedov in his papakha at a UFC weigh-in' },
              quote: { text: 'Too much movies make your heart weak.', by: 'Khabib Nurmagomedov' },
            },
            {
              sport: 'Motorsport',
              logo: 'assets/life/f1.png',
              logoAlt: 'Formula 1 logo',
              name: 'Formula 1',
              text: "Only started following it closely recently, since playing the F1 video games on my PC, but I always knew a bit about F1.",
              player: { label: 'Driver of choice', img: 'assets/life/player-alonso.jpg', alt: 'Fernando Alonso in his Renault race suit' },
              quote: { text: "I knew he'd hit the brakes. He has a wife and two kids at home, I don't.", by: 'Fernando Alonso' },
            },
          ],
        },
        fascinating: {
          heading: 'Not Competitive but Fascinating',
          items: [
            {
              sport: 'Sports entertainment',
              logo: 'assets/life/wwe.png',
              logoAlt: 'WWE logo',
              name: 'WWE',
              text: "Since childhood, I've always loved not only watching these scripted fights and the storytelling, but also practising them at home.",
              player: { label: 'Superstar of choice', img: 'assets/life/player-punk.jpg', alt: 'CM Punk on the mic in the ring' },
              quote: { text: "As long as you speak from your heart, you can't go wrong!!", by: 'CM Punk' },
            },
          ],
        },
      },
    },
  },
  {
    // mirror of Vision on the bottom touchline, half in / half out (see FIELD.touchPods in arena.js)
    id: 'aspiration', kind: 'aspiration', label: 'ASPIRATION', x: 19, z: 32, color: '#ff6b6b',
    panel: {
      kicker: 'Always climbing',
      title: 'Aspiration',
      life: {
        aspiration: {
          heading: 'Problem Solving',
          items: [
            {
              sport: 'DSA practice',
              logo: 'assets/life/leetcode.png',
              logoAlt: 'LeetCode logo',
              name: 'LeetCode',
              text: "Always got a bit jealous by these DSA freaks, don't know if I am gonna ace this or get really good at it,  but I do practice leetcode problems every other weekend. Click the link if you want to follow up",
              repo: { label: 'GitHub', href: 'https://github.com/MoZainUlAbideen/DSA_Python' },
            },
          ],
        },
      },
    },
  },
  {
    id: 'experience', kind: 'experience', label: 'EXPERIENCE', x: -50, z: 32, color: '#4ade80',
    panel: {
      kicker: 'Career so far',
      title: 'Experience',
      experience: [
        {
          role: 'Machine Learning Engineer Intern',
          org: 'RISETech',
          when: 'Jun – Aug 2025',
          points: [
            'Built the feature set from an underground vibration, magnetic and acoustic sensor node to classify passing vehicles (LTV, HTV, none).',
            'Trained ensemble classifiers (Random Forest, SVM, KNN, LDA, Extra Trees), taking accuracy from 71% to 99%.',
          ],
        },
        {
          role: 'AI Engineer Intern',
          org: 'Software Productivity Strategists (SPS), NSTP',
          when: 'Jun – Aug 2024',
          points: [
            'Built backend features for two flagship products: Business Management System and Cognitive Service Management.',
            'Deployed AI solutions on Microsoft Azure and improved analytics for a security management system.',
          ],
        },
      ],
    },
  },
  {
    id: 'stack', kind: 'stack', label: 'STACK', x: -50, z: -32, color: '#a78bfa',
    panel: {
      lab: true, // terminal-style layout: grouped, colour-coded chips
      title: 'Stack',
      lede: 'Every layer from model to production. Every tool I ship with.',
      skills: [
        ['LLM & Agentic AI', ['RAG', 'Agentic Workflows', 'Multi-Agent Systems', 'Prompt & Evaluation Design (LLM-as-Judge)', 'Hybrid Search (BM25, RRF)', 'Vector Databases (FAISS, ChromaDB)', 'LangChain', 'Gemini API', 'Groq', 'Ollama', 'Langfuse']],
        ['NLP', ['Embeddings (Sentence Transformers, bge-small)', 'Tokenization', 'Information Extraction', 'Transformers']],
        ['Machine Learning', ['PyTorch', 'Keras', 'TensorFlow', 'Scikit-learn', 'Supervised & Unsupervised Learning', 'Ensembles', 'Feature Engineering', 'Pandas']],
        ['Backend & APIs', ['Python', 'FastAPI', 'REST APIs', 'Inference Pipelines', 'SQL', 'SQLAlchemy', 'Next.js', 'Playwright']],
        ['MLOps & Cloud', ['Docker', 'GitHub Actions', 'CI/CD', 'Testing (pytest)', 'Git', 'Microsoft Azure', 'Google Cloud', 'Render']],
      ],
    },
  },

  // ── Projects: bottom-right corner ──
  {
    id: 'projects', kind: 'projects', label: 'PROJECTS', x: 50, z: 32, color: '#ff8a1f',
    panel: {
      kicker: 'Highlight reel',
      title: 'Projects',
      items: [
        {
          title: 'Parity',
          href: 'https://parity-iota-puce.vercel.app',
          tagline: 'AI web-accessibility auditor that finds, explains and fixes WCAG 2.2 issues.',
          points: [
            'Runs axe-core in headless Chromium (desktop + mobile) with a pixel-based contrast meter, a keyboard-navigation agent and a Gemini vision agent that rewrites faulty alt text.',
            'Recall on a 24-issue labelled benchmark: 54% with rules alone → 24/24 with zero false alarms.',
            'Hybrid RAG over 1,092 W3C passages; 190+ tests with eval gates in CI.',
          ],
          tech: ['Python', 'FastAPI', 'Playwright', 'Gemini'],
          links: [
            { label: 'Live', href: 'https://parity-iota-puce.vercel.app' },
            { label: 'GitHub', href: `${GH}/Parity` },
          ],
        },
        {
          title: 'Rehnuma',
          href: 'https://rehnuma-kappa.vercel.app',
          tagline: 'Urdu/English AI copilot that audits Pakistani electricity bills.',
          points: [
            'Reads bill photos with Gemini and a self-verifying re-read loop (96.2% field accuracy); forecasts 12 months of bills and prices 2026 solar rules.',
            'Hybrid RAG over 566 NEPRA clauses with a citation critic: 91% top-5 retrieval, out-of-scope questions refused.',
            '319 tests, 20 eval metrics gated in CI, Langfuse tracing with PII masking.',
          ],
          tech: ['Python', 'FastAPI', 'Next.js', 'Gemini'],
          links: [
            { label: 'Live', href: 'https://rehnuma-kappa.vercel.app' },
            { label: 'GitHub', href: `${GH}/rehnuma` },
          ],
        },
        {
          title: 'EdgarIQ',
          href: 'https://edgar-iq-web.vercel.app',
          tagline: 'Grounded multi-agent research copilot over live SEC filings.',
          points: [
            'Planner → retriever → drafter → critic pipeline with a numeric checker that verifies every figure against the source text.',
            'Diagnosed wrong-quarter retrieval and fixed it with metadata-filtered hybrid search: golden-set accuracy 29% → 100%.',
            'Eval harness (deterministic + LLM-as-judge) backed by 89 tests.',
          ],
          tech: ['Python', 'SEC EDGAR', 'Ollama', 'Groq'],
          links: [
            { label: 'Live', href: 'https://edgar-iq-web.vercel.app' },
            { label: 'GitHub', href: `${GH}/Edgar_iq` },
          ],
        },
        {
          title: 'Job Assistant',
          href: `${GH}/Job-Assistant-An-AI-Resume-Fit-Dashboard-Built-From-Scratch-FastAPI-Groq-RAG`,
          tagline: 'Chrome extension + dashboard that scores how well your resume fits a job.',
          points: [
            'Captures listings from your own LinkedIn / Indeed session and matches them semantically with sentence-transformers + FAISS.',
            'Fit score, gap analysis and grounded rewrite suggestions; auto-tailors a resume for jobs above 50% fit.',
          ],
          tech: ['FastAPI', 'Groq', 'FAISS', 'Chrome MV3'],
          links: [
            { label: 'GitHub', href: `${GH}/Job-Assistant-An-AI-Resume-Fit-Dashboard-Built-From-Scratch-FastAPI-Groq-RAG` },
          ],
        },
      ],
    },
  },

  // ── Certifications: top-right corner ──
  {
    id: 'certs', kind: 'certs', label: 'CERTIFICATIONS', x: 50, z: -32, color: '#ffd23f',
    panel: {
      kicker: 'Trophy cabinet',
      title: 'Certifications',
      certs: [
        { title: 'Google AI Professional Certificate', issuer: 'Google · Coursera', href: 'https://www.coursera.org/account/accomplishments/professional-cert/certificate/V00M6JVIR24O' },
        { title: 'IBM AI Engineering Professional Certificate', issuer: 'IBM · Coursera', href: 'https://www.coursera.org/account/accomplishments/specialization/0UEVNFVYBN8V' },
        { title: 'Advanced Machine Learning on Google Cloud', issuer: 'Google Cloud · Coursera', href: 'https://www.coursera.org/account/accomplishments/specialization/8ZNO2FZQPFR5' },
        { title: 'IBM Machine Learning Professional Certificate', issuer: 'IBM · Coursera', href: 'https://www.coursera.org/account/accomplishments/specialization/6AF4NKP5SG0W' },
        { title: 'Google Advanced Data Analytics', issuer: 'Google · Coursera', href: 'https://www.coursera.org/account/accomplishments/specialization/2M7FIVKXPNCE' },
        { title: 'Google AI Essentials', issuer: 'Google · Coursera', href: 'https://www.coursera.org/account/accomplishments/specialization/certificate/HFGV9W2AM02V' },
      ],
    },
  },
];
