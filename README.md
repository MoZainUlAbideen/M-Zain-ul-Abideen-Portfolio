# Zain's arena portfolio
### https://m-zain-ul-abideen-portfolio.vercel.app/

A small Rocket League-style arena in the browser, under a glass dome. You drive **Beyond** (a
replica of my purple Mini 4WD) on a Rocket League-style pitch inside a closed, glass-walled arena:
drive up the curved walls and across the ceiling, flip, play a 1:30 match against a red bot, and
pull into the glowing spots by the walls to open the podiums standing in booths outside the glass.
Press **E** beside a podium to open it.

Plain static files: Three.js loads from a CDN, so there's no build step (npm is only used to run the tests).

## Controls
| Key | Action |
|---|---|
| W A S D / arrows | drive |
| Shift | boost |
| Space | jump; press again in the air to double jump, or with a direction held to flip |
| W / S in the air | pitch nose down / up (A / D turn) |
| N | start / end a 1:30 match vs the bot |
| E | open the podium you're next to |
| C | ball cam on/off |
| R | reset car + ball |
| M | sound on/off |
| H | hide the controls box |
| Esc | close a popup |

## Run it on your computer
ES modules don't load from `file://`, so serve the folder:

    uv run python -m http.server 8000     # then open http://localhost:8000

Add `?debug` to the URL to expose `physics`, `camera` and `scene` in the browser console.

## Where to change things
| I want to... | Edit |
|---|---|
| Change popup text, links, podium names | `js/content.js` |
| Move a podium or add a new one | `js/content.js` (`x`, `z` in `PODIUMS`) |
| Change car speed, boost, jump, ball bounce | `js/physics.js` (`CFG`) |
| Change arena size, wall curve, goal size | `js/arena.js` (`FIELD`) |
| Make the bot easier or harder | `js/bot.js` (`think`, `boostChance`) |
| Change the car's look | `js/car.js` |
| Change colours / fonts of the UI | `css/style.css` (`:root`) |

## Files
    index.html        page structure (start screen, HUD, popup)
    css/style.css     UI styles
    js/main.js        renderer, camera, input, game loop
    js/content.js     all words, links and podium positions
    js/arena.js       the closed arena (pitch, curved glass shell, goals), stands, dome, lights,
                      ball, and arenaContact(): the shape everything collides with
    js/car.js         the Beyond Mini 4WD model
    js/podiums.js     glowing podiums in booths outside the glass + their spots on the pitch
    js/physics.js     car physics on any surface (walls, ceiling), jumps, flips, demos; ball; goals
    js/bot.js         the red bot
    js/match.js       1:30 match, kickoff countdown, golden goal
    js/fx.js          boost trails, supersonic streaks, demolitions, goal explosion
    js/ui.js          HUD and popups
    js/audio.js       engine, boost, jumps/flips, ball hits, crowd, goal roar + horn (Web Audio, no files)
    js/dugout.js      the dugout + floating My Academy emblem
    js/academy/       My Academy: path chooser + six games
      hallucination.js  Hallucination Hunt (evaluation)
      retrieval.js      Retrieval Relay (RAG)
      pitcrew.js        Agent Pit Crew (agents)
      golf.js           Learning-Rate Golf (gradient descent)
    css/academy.css   academy styles
    tests/            logic tests for the academy games

## Tests
50 tests in two files. The physics tests need three.js, so install it once:

    npm install
    npm test

- `tests/physics.test.mjs` (20): driving up a wall and over the ceiling, falling off the ceiling
  without throttle, peeling off a wall when stopped, top speed, double jump, flips, the ball on the
  curved shell (500 random shots never escape), goals vs. hitting the wall above the goal, boost
  recharge, podium booths staying clear of the ball and cars, demolitions, 50/50 kickoffs, and full
  bot-vs-bot matches.
- `tests/academy.test.mjs` (30): the My Academy games (pipelines, retrieval verdicts, every golf
  hole, quote checks, confidence thresholds).

## Deploy
Push to GitHub and import the repo on Vercel or Netlify. Framework preset "Other",
no build command, output directory = the repo root.
