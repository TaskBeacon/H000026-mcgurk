import type { ReducedTrialRow } from "psyflow-web";
import { PythonRandom } from "psyflow-web";

import type { TrialSpec } from "./controller";

function normalizeSyllables(syllables: string[] | null | undefined): string[] {
  const normalized = (Array.isArray(syllables) ? syllables : ["ba", "da", "ga"])
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : ["ba", "da", "ga"];
}

function normalizePairs(pairs: Array<[string, string] | string[]> | null | undefined): Array<[string, string]> {
  const normalized: Array<[string, string]> = [];
  (Array.isArray(pairs) ? pairs : [["ba", "ga"], ["ga", "ba"]]).forEach((pair) => {
    if (!Array.isArray(pair) || pair.length !== 2) {
      return;
    }
    const audio = String(pair[0]).trim().toLowerCase();
    const visual = String(pair[1]).trim().toLowerCase();
    if (audio && visual) {
      normalized.push([audio, visual]);
    }
  });
  return normalized.length > 0 ? normalized : [["ba", "ga"], ["ga", "ba"]];
}

function choice<T>(rng: PythonRandom, values: T[]): T {
  if (values.length === 0) {
    throw new Error("Cannot sample from an empty list.");
  }
  return values[rng.randBelow(values.length)];
}

function buildTrialSpec(
  condition: string,
  rng: PythonRandom,
  syllables: string[],
  incongruentPairs: Array<[string, string]>
): TrialSpec {
  const conditionId = String(condition).trim().toLowerCase();
  if (conditionId === "congruent") {
    const syllable = choice(rng, syllables);
    return {
      condition: "congruent",
      audio_syllable: syllable,
      visual_syllable: syllable,
      expected_percept: syllable
    };
  }
  if (conditionId === "incongruent") {
    const pair = choice(rng, incongruentPairs);
    return {
      condition: "incongruent",
      audio_syllable: pair[0],
      visual_syllable: pair[1],
      expected_percept: "da"
    };
  }
  if (conditionId === "audio_only") {
    const syllable = choice(rng, syllables);
    return {
      condition: "audio_only",
      audio_syllable: syllable,
      visual_syllable: "none",
      expected_percept: syllable
    };
  }
  const syllable = choice(rng, syllables);
  return {
    condition: conditionId || "unknown",
    audio_syllable: syllable,
    visual_syllable: "none",
    expected_percept: syllable
  };
}

export function generate_mcgurk_conditions(
  n_trials: number,
  condition_labels: string[] | null | undefined,
  syllables: string[] | null | undefined,
  incongruent_pairs: Array<[string, string] | string[]> | null | undefined,
  seed: number
): string[] {
  const labels = (Array.isArray(condition_labels) ? condition_labels : ["congruent", "incongruent", "audio_only"])
    .map((label) => String(label).trim().toLowerCase())
    .filter(Boolean);
  const conditionLabels = labels.length > 0 ? labels : ["congruent", "incongruent", "audio_only"];
  const rng = new PythonRandom(Number(seed ?? 0));
  const normalizedSyllables = normalizeSyllables(syllables);
  const normalizedPairs = normalizePairs(incongruent_pairs);

  const schedule: string[] = [];
  while (schedule.length < Math.trunc(n_trials)) {
    schedule.push(...conditionLabels);
  }
  rng.shuffle(schedule);

  return schedule.slice(0, Math.trunc(n_trials)).map((condition) =>
    JSON.stringify(buildTrialSpec(condition, rng, normalizedSyllables, normalizedPairs))
  );
}

export function parse_mcgurk_condition(condition: string): TrialSpec {
  const parsed = JSON.parse(String(condition)) as Partial<TrialSpec>;
  return {
    condition: String(parsed.condition ?? "unknown").trim().toLowerCase(),
    audio_syllable: String(parsed.audio_syllable ?? "ba").trim().toLowerCase(),
    visual_syllable: String(parsed.visual_syllable ?? "none").trim().toLowerCase(),
    expected_percept: String(parsed.expected_percept ?? parsed.audio_syllable ?? "ba").trim().toLowerCase()
  };
}

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "y";
}

function asNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rate(rows: ReducedTrialRow[], field: string, targetValue: string): number {
  if (rows.length === 0) {
    return 0;
  }
  const target = String(targetValue).trim().toLowerCase();
  let matched = 0;
  rows.forEach((row) => {
    if (String(row[field] ?? "").trim().toLowerCase() === target) {
      matched += 1;
    }
  });
  return matched / rows.length;
}

export interface McGurkSummary {
  total_trials: number;
  responded_trials: number;
  incongruent_responded: number;
  response_rate: number;
  fusion_rate: number;
  ba_rate: number;
  da_rate: number;
  ga_rate: number;
  mean_rt_ms: number;
}

function summarizeRows(rows: ReducedTrialRow[]): McGurkSummary {
  const totalTrials = rows.length;
  if (totalTrials === 0) {
    return {
      total_trials: 0,
      responded_trials: 0,
      incongruent_responded: 0,
      response_rate: 0,
      fusion_rate: 0,
      ba_rate: 0,
      da_rate: 0,
      ga_rate: 0,
      mean_rt_ms: 0
    };
  }

  const responded = rows.filter((row) => !asBool(row.decision_timed_out));
  const incongruentResponded = responded.filter(
    (row) => String(row.condition ?? "").trim().toLowerCase() === "incongruent"
  );
  const rtValues = responded
    .map((row) => asNumber(row.decision_rt))
    .filter((value): value is number => value != null);
  const meanRtMs = rtValues.length > 0 ? mean(rtValues) * 1000 : 0;

  return {
    total_trials: totalTrials,
    responded_trials: responded.length,
    incongruent_responded: incongruentResponded.length,
    response_rate: responded.length / totalTrials,
    fusion_rate: rate(incongruentResponded, "reported_syllable", "da"),
    ba_rate: rate(responded, "reported_syllable", "ba"),
    da_rate: rate(responded, "reported_syllable", "da"),
    ga_rate: rate(responded, "reported_syllable", "ga"),
    mean_rt_ms: Number(meanRtMs.toFixed(1))
  };
}

export function summarizeBlock(rows: ReducedTrialRow[], blockId: string): McGurkSummary {
  const blockRows = rows.filter((row) => String(row.block_id ?? "") === blockId);
  return summarizeRows(blockRows);
}

export function summarizeOverall(rows: ReducedTrialRow[]): McGurkSummary {
  return summarizeRows(rows);
}
