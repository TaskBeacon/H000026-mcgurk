export interface TrialSpec {
  condition: string;
  audio_syllable: string;
  visual_syllable: string;
  expected_percept: string;
}

export class Controller {
  readonly syllables: string[];
  readonly incongruent_pairs: Array<[string, string]>;
  readonly random_seed: number | null;
  readonly enable_logging: boolean;
  private readonly rng: () => number;
  private trial_counter = 0;
  private readonly random_seed_state: number;
  private readonly history: Record<string, Array<Record<string, unknown>>> = {};

  constructor(args: {
    syllables?: string[];
    incongruent_pairs?: Array<[string, string] | string[]>;
    random_seed?: number | null;
    enable_logging?: boolean;
  }) {
    const normalizedSyllables = (Array.isArray(args.syllables) ? args.syllables : ["ba", "da", "ga"])
      .map((value) => String(value).trim().toLowerCase())
      .filter(Boolean);
    this.syllables = normalizedSyllables.length > 0 ? normalizedSyllables : ["ba", "da", "ga"];

    const rawPairs = Array.isArray(args.incongruent_pairs) ? args.incongruent_pairs : [["ba", "ga"], ["ga", "ba"]];
    const normalizedPairs: Array<[string, string]> = [];
    rawPairs.forEach((pair) => {
      if (!Array.isArray(pair) || pair.length !== 2) {
        return;
      }
      const audio = String(pair[0]).trim().toLowerCase();
      const visual = String(pair[1]).trim().toLowerCase();
      if (!audio || !visual) {
        return;
      }
      normalizedPairs.push([audio, visual]);
    });
    this.incongruent_pairs = normalizedPairs.length > 0 ? normalizedPairs : [["ba", "ga"], ["ga", "ba"]];

    this.random_seed =
      args.random_seed == null || !Number.isFinite(Number(args.random_seed)) ? null : Number(args.random_seed);
    this.enable_logging = args.enable_logging !== false;
    this.random_seed_state = this.random_seed == null ? this.buildFallbackSeed() : Number(this.random_seed);
    this.rng = makeSeededRandom(this.random_seed_state);
  }

  static from_dict(config: Record<string, unknown>): Controller {
    return new Controller({
      syllables: Array.isArray(config.syllables) ? config.syllables.map(String) : undefined,
      incongruent_pairs: Array.isArray(config.incongruent_pairs)
        ? (config.incongruent_pairs as Array<[string, string] | string[]>)
        : undefined,
      random_seed:
        config.random_seed == null || config.random_seed === ""
          ? null
          : Number.isFinite(Number(config.random_seed))
            ? Number(config.random_seed)
            : null,
      enable_logging: Boolean(config.enable_logging ?? true)
    });
  }

  start_block(_block_idx: number): void {}

  next_trial_id(): number {
    this.trial_counter += 1;
    return this.trial_counter;
  }

  sample_duration(value: unknown, defaultValue: number): number {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (Array.isArray(value) && value.length >= 2) {
      const left = Number(value[0]);
      const right = Number(value[1]);
      if (Number.isFinite(left) && Number.isFinite(right)) {
        const lo = Math.min(left, right);
        const hi = Math.max(left, right);
        return lo + this.rng() * (hi - lo);
      }
    }
    return defaultValue;
  }

  build_trial(condition: string): TrialSpec {
    const conditionId = String(condition).trim().toLowerCase();
    if (conditionId === "congruent") {
      const syllable = this.sample_syllable();
      return {
        condition: "congruent",
        audio_syllable: syllable,
        visual_syllable: syllable,
        expected_percept: syllable
      };
    }
    if (conditionId === "incongruent") {
      const pair = this.pick(this.incongruent_pairs);
      return {
        condition: "incongruent",
        audio_syllable: pair[0],
        visual_syllable: pair[1],
        expected_percept: "da"
      };
    }
    if (conditionId === "audio_only") {
      const syllable = this.sample_syllable();
      return {
        condition: "audio_only",
        audio_syllable: syllable,
        visual_syllable: "none",
        expected_percept: syllable
      };
    }
    const fallback = this.sample_syllable();
    return {
      condition: conditionId || "unknown",
      audio_syllable: fallback,
      visual_syllable: "none",
      expected_percept: fallback
    };
  }

  record_trial(row: Record<string, unknown>): void {
    const condition = String(row.condition ?? "unknown");
    if (!this.history[condition]) {
      this.history[condition] = [];
    }
    this.history[condition].push({ ...row });
  }

  get histories(): Record<string, Array<Record<string, unknown>>> {
    return Object.fromEntries(Object.entries(this.history).map(([key, rows]) => [key, [...rows]]));
  }

  private sample_syllable(): string {
    return this.pick(this.syllables);
  }

  private pick<T>(values: T[]): T {
    const safe = values.length > 0 ? values : ([] as T[]);
    if (safe.length === 0) {
      throw new Error("Cannot sample from an empty list.");
    }
    const index = Math.floor(this.rng() * safe.length);
    return safe[index];
  }

  private buildFallbackSeed(): number {
    const now = Date.now() >>> 0;
    const random = Math.floor(Math.random() * 0xffffffff) >>> 0;
    return (now ^ random ^ 0x9e3779b9) >>> 0;
  }
}

function makeSeededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
