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

}
