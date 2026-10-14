# Zain's arena portfolio
### https://m-zain-ul-abideen-portfolio.vercel.app/

A small 3D football arena in the browser. You drive **Beyond** (a replica of my purple
Mini 4WD), knock the ball into the goals, and drive up to the glowing podiums.
Press **E** beside a podium to open it.

Plain static files: Three.js loads from a CDN, so there's no npm and no build step.

## Controls
| Key | Action |
|---|---|
| W A S D / arrows | drive |
| Shift | boost |
| Space | jump |
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
| Change pitch size, goal size | `js/arena.js` (`FIELD`) |
| Change the car's look | `js/car.js` |
| Change colours / fonts of the UI | `css/style.css` (`:root`) |

## Files
    index.html        page structure (start screen, HUD, popup)
    css/style.css     UI styles
    js/main.js        renderer, camera, input, game loop
    js/content.js     all words, links and podium positions
    js/arena.js       pitch, walls, goals, stands, lights, ball
    js/car.js         the Beyond Mini 4WD model
    js/podiums.js     glowing podiums
    js/physics.js     car + ball physics, goals
    js/fx.js          boost trail + goal explosion
    js/ui.js          HUD and popups
    js/audio.js       arena ambience, engine, goal roar + horn, hit sounds (Web Audio, no files)
    js/dugout.js      the dugout + floating My Academy emblem
    js/academy/       My Academy: path chooser + six games
      hallucination.js  Hallucination Hunt (evaluation)
      retrieval.js      Retrieval Relay (RAG)
      pitcrew.js        Agent Pit Crew (agents)
      golf.js           Learning-Rate Golf (gradient descent)
    css/academy.css   academy styles
    tests/            logic tests for the academy games

## Tests
The academy game logic has 30 tests (pipelines, retrieval verdicts, every golf hole, quote checks, confidence thresholds):

    node tests/academy.test.mjs

## Deploy
Push to GitHub and import the repo on Vercel or Netlify. Framework preset "Other",
no build command, output directory = the repo root.
