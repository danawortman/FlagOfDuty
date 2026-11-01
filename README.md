# Flag of Duty

A Capture the Flag game in the browser. Squads of three autonomous agents play on a 2D
arena, each driven by a state machine.

## Run it

```bash
npm install
npx playwright install chromium
npm run dev
```

Then open http://localhost:5199.

## Rules

- First to 3 captures wins. After 3 minutes (1800 ticks) the leader wins, or it is a draw.
- Touch the enemy flag to pick it up, then carry it to your own base to score. Your own
  flag does not need to be home.
- Standing in your own half next to an enemy who is also in your half tags them. They drop
  any flag and respawn after 4 seconds. Each tag costs the tagger a 5 second recharge.
- A dropped flag goes home when its own team touches it, or after 10 seconds.
- Mud takes twice as long to cross, and agents path around it when that is quicker.
- Each match draws one of four arenas from its seed. After a countdown, matches keep
  running with a new seed until you pause or restart.

## Commands

| Command | What it does |
|---|---|
| `npm test` | Unit tests for the simulation (no browser) |
| `npm run test:e2e` | Playwright behaviour and screenshot tests |
| `npm run test:e2e:update` | Generate screenshot baselines, or accept an intended visual change |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build into `dist/` |
| `npm run tournament -- 100` | Round-robin of every brain, 100 seeds per pairing |

## Layout

- `src/sim/`: the game, with no browser code. Integer-only, seeded and deterministic.
  - `types.ts`: includes the brain JSON format.
  - `fsm.ts`: the state-machine interpreter and data check. Its semantics are at the top of the file.
  - `brains.ts`: the six brains.
  - `arenas.ts`: the four arena layouts.
  - `sensors.ts`, `actions.ts`: what conditions can read and what states can do.
  - `rules.ts`: every tuning number.
- `src/ui/`: canvas renderer, squad panels and the `window.flagOfDuty` test hook.
- `tests/unit/`: Vitest. `tests/e2e/`: Playwright.
- `scripts/tournament.ts`: headless balance check.

## Visual tests

Any exact moment can be loaded from the URL, which keeps screenshots deterministic:

```
/?seed=7&blue=raider,rusher,sentry&red=picket,rusher,sentry&tick=240&arena=1
```

Playwright starts its own server on port 5198 and never reuses one, so a dev server left
open elsewhere cannot be tested by mistake. It fails if that port is busy.

Screenshot baselines are not included, because text renders differently on each OS. Generate
them with `npm run test:e2e:update` before the first `npm run test:e2e`, and review the images.
They are written to `tests/e2e/__screenshots__/`, in a folder for each platform.

The comparison is strict (`threshold: 0.02`), so small colour changes fail it.

## License

MIT. See [LICENSE](LICENSE).
