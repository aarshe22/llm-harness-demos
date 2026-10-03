# DATACENTER

A fast-paced infrastructure-management and crisis-management game. You are the
sole operator of an expanding, procedurally generated datacenter.

## Run it

Open `index.html` in any modern browser (double-click works — no build step,
no dependencies). Or serve it:

```
python3 -m http.server 8000
# -> http://localhost:8000
```

## How to play

- **Pan**: drag, middle-drag, `A`/`D`, `←`/`→` — **Zoom**: mouse wheel
- **Click any equipment** in a rack to inspect it and get actions
  (PWR / NET / KVM / MAINT, drive replacement, breaker resets…)
- **Click alarms** (bottom-left) to jump to problems
- **TICKETS chip**: helpdesk panel — **COOLING chip**: CRAC repair
  — **POWER chip**: utility/UPS/generator/tripped breakers
- `SPACE` pause · `F1` help

Keep services online. Outages generate helpdesk tickets (faster the longer
they last). Fix the *cause* and its tickets clear. Preventing failures earns
PREVENTION bonuses. Good performance raises reputation and demand — at the
threshold you pick an expansion and the datacenter physically grows, with all
the new complexity that implies.

Every run seed generates a different facility (rack layouts, equipment mix,
services, dependencies, failure personality). Progress autosaves; the main
menu offers CONTINUE, CHALLENGES presets, and a CUSTOM GAME with full tuning
sliders plus custom seed entry.

## Architecture

Plain JS, no framework. Fixed-tick simulation (10/s) decoupled from rendering
(60fps canvas). `js/` modules: `rng` (seeded), `config` (tuning), `data`,
`facility` (DNA + procedural generation + expansions), `thermal`, `power`,
`storage` (RAID), `network`, `security`, `helpdesk` (tickets), `incidents`
(director), `growth` (reputation/demand/upgrades/achievements), `render`,
`ui`, `kvm`, `audio` (WebAudio synth), `save` (localStorage), `tutorial`,
`main` (game manager).

`smoke-test.js` is a Node test harness exercising the whole simulation
headlessly: `node smoke-test.js`
