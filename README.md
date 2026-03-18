# H000026 McGurk Effect Task

HTML/browser preview of the McGurk Effect task built with `psyflow-web`.
Audiovisual congruent/incongruent/audio-only trial logic, syllable report mapping (`/ba/`, `/da/`, `/ga/`), and block-level fusion metrics are aligned to local `T000026-mcgurk`, with fewer blocks for preview.

## Layout

- `main.ts`: task orchestration
- `config/config.yaml`: declarative config
- `src/controller.ts`: trial planner and history tracker
- `src/run_trial.ts`: trial logic
- `src/utils.ts`: condition parsing and summary helpers

## Run

From `e:\xhmhc\TaskBeacon\psyflow-web`:

```powershell
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:4173/?task=H000026-mcgurk
```
