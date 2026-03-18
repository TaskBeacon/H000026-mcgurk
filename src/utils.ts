import type { ReducedTrialRow } from "psyflow-web";

export function parse_mcgurk_condition(condition: string): string {
  const normalized = String(condition).trim().toLowerCase();
  return normalized.length > 0 ? normalized : "unknown";
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
  response_rate: string;
  fusion_rate: string;
  ba_rate: string;
  da_rate: string;
  ga_rate: string;
  mean_rt_ms: number;
}

function summarizeRows(rows: ReducedTrialRow[]): McGurkSummary {
  const totalTrials = rows.length;
  if (totalTrials === 0) {
    return {
      total_trials: 0,
      responded_trials: 0,
      incongruent_responded: 0,
      response_rate: "0.0%",
      fusion_rate: "0.0%",
      ba_rate: "0.0%",
      da_rate: "0.0%",
      ga_rate: "0.0%",
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
    response_rate: `${((responded.length / totalTrials) * 100).toFixed(1)}%`,
    fusion_rate: `${(rate(incongruentResponded, "reported_syllable", "da") * 100).toFixed(1)}%`,
    ba_rate: `${(rate(responded, "reported_syllable", "ba") * 100).toFixed(1)}%`,
    da_rate: `${(rate(responded, "reported_syllable", "da") * 100).toFixed(1)}%`,
    ga_rate: `${(rate(responded, "reported_syllable", "ga") * 100).toFixed(1)}%`,
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
