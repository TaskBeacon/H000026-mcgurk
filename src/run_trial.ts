import {
  set_trial_context,
  type StimBank,
  type TaskSettings,
  type TrialBuilder,
  type TrialSnapshot
} from "psyflow-web";

import type { Controller, TrialSpec } from "./controller";
import { parse_mcgurk_condition } from "./utils";

function asDuration(controller: Controller, value: unknown, defaultValue: number): number {
  return controller.sample_duration(value, defaultValue);
}

function response_to_syllable(
  responseKey: unknown,
  args: {
    ba_key: string;
    da_key: string;
    ga_key: string;
  }
): "ba" | "da" | "ga" | null {
  const key = String(responseKey ?? "").trim().toLowerCase();
  if (key === args.ba_key) {
    return "ba";
  }
  if (key === args.da_key) {
    return "da";
  }
  if (key === args.ga_key) {
    return "ga";
  }
  return null;
}

function resolve_trial_spec(controller: Controller, condition: string): TrialSpec {
  return controller.build_trial(condition);
}

export function run_trial(
  trial: TrialBuilder,
  condition: string,
  context: {
    settings: TaskSettings;
    stimBank: StimBank;
    controller: Controller;
    block_id: string;
    block_idx: number;
  }
): TrialBuilder {
  const { settings, stimBank, controller, block_id, block_idx } = context;
  const conditionName = parse_mcgurk_condition(condition);
  const trialId = controller.next_trial_id();
  const trialSpec = resolve_trial_spec(controller, conditionName);

  const baKey = String(settings.ba_key ?? "f").trim().toLowerCase();
  const daKey = String(settings.da_key ?? "j").trim().toLowerCase();
  const gaKey = String(settings.ga_key ?? "k").trim().toLowerCase();
  const responseKeys = [baKey, daKey, gaKey];

  const fixationDuration = asDuration(controller, settings.fixation_duration, 0.6);
  const avDuration = Number(settings.av_duration ?? 1.1);
  const decisionDeadline = Number(settings.decision_deadline ?? 1.8);
  const feedbackDuration = Number(settings.feedback_duration ?? 0.7);
  const itiDuration = asDuration(controller, settings.iti_duration, 0.7);

  const fixation = trial.unit("fixation").addStim(stimBank.get("fixation"));
  set_trial_context(fixation, {
    trial_id: trialId,
    phase: "fixation",
    deadline_s: fixationDuration,
    valid_keys: [],
    block_id,
    condition_id: trialSpec.condition,
    task_factors: {
      stage: "fixation",
      condition: trialSpec.condition,
      audio_syllable: trialSpec.audio_syllable,
      visual_syllable: trialSpec.visual_syllable,
      expected_percept: trialSpec.expected_percept,
      block_idx
    },
    stim_id: "fixation"
  });
  fixation.show({ duration: fixationDuration }).to_dict();

  const avStimulus = trial
    .unit("av_stimulus")
    .addStim(stimBank.get("avatar_face"))
    .addStim(stimBank.get("eye_left"))
    .addStim(stimBank.get("eye_right"))
    .addStim(stimBank.get("nose"))
    .addStim(stimBank.get(`mouth_${trialSpec.visual_syllable}`))
    .addStim(stimBank.get("speech_prompt"))
    .addStim(stimBank.get(`audio_${trialSpec.audio_syllable}`));
  set_trial_context(avStimulus, {
    trial_id: trialId,
    phase: "av_stimulus",
    deadline_s: avDuration,
    valid_keys: [],
    block_id,
    condition_id: trialSpec.condition,
    task_factors: {
      stage: "av_stimulus",
      condition: trialSpec.condition,
      audio_syllable: trialSpec.audio_syllable,
      visual_syllable: trialSpec.visual_syllable,
      expected_percept: trialSpec.expected_percept,
      block_idx
    },
    stim_id: `audio_${trialSpec.audio_syllable}+mouth_${trialSpec.visual_syllable}`
  });
  avStimulus.show({ duration: avDuration }).to_dict();

  const decision = trial
    .unit("decision")
    .addStim(stimBank.get("decision_prompt"))
    .addStim(
      stimBank.get_and_format("key_hint", {
        ba_key: baKey.toUpperCase(),
        da_key: daKey.toUpperCase(),
        ga_key: gaKey.toUpperCase()
      })
    );
  set_trial_context(decision, {
    trial_id: trialId,
    phase: "decision",
    deadline_s: decisionDeadline,
    valid_keys: responseKeys,
    block_id,
    condition_id: trialSpec.condition,
    task_factors: {
      stage: "decision",
      condition: trialSpec.condition,
      audio_syllable: trialSpec.audio_syllable,
      visual_syllable: trialSpec.visual_syllable,
      expected_percept: trialSpec.expected_percept,
      ba_key: baKey,
      da_key: daKey,
      ga_key: gaKey,
      block_idx
    },
    stim_id: "decision_prompt+key_hint"
  });
  decision
    .captureResponse({
      keys: responseKeys,
      correct_keys: responseKeys,
      duration: decisionDeadline
    })
    .set_state({
      trial_id: trialId,
      response_key: (snapshot: TrialSnapshot) => String(snapshot.units.decision?.response ?? "").trim().toLowerCase(),
      reported_syllable: (snapshot: TrialSnapshot) =>
        response_to_syllable(snapshot.units.decision?.response, {
          ba_key: baKey,
          da_key: daKey,
          ga_key: gaKey
        }),
      timed_out: (snapshot: TrialSnapshot) =>
        response_to_syllable(snapshot.units.decision?.response, {
          ba_key: baKey,
          da_key: daKey,
          ga_key: gaKey
        }) == null,
      matches_expected: (snapshot: TrialSnapshot) => {
        const perceived = response_to_syllable(snapshot.units.decision?.response, {
          ba_key: baKey,
          da_key: daKey,
          ga_key: gaKey
        });
        return perceived != null && perceived === trialSpec.expected_percept;
      },
      fusion_da: (snapshot: TrialSnapshot) => {
        const perceived = response_to_syllable(snapshot.units.decision?.response, {
          ba_key: baKey,
          da_key: daKey,
          ga_key: gaKey
        });
        return trialSpec.condition === "incongruent" && perceived === "da";
      }
    })
    .to_dict();

  const feedback = trial.unit("feedback").addStim((snapshot: TrialSnapshot) => {
    const timedOut = Boolean(snapshot.units.decision?.timed_out ?? true);
    if (timedOut) {
      return stimBank.get("feedback_timeout");
    }
    const responseKey = String(snapshot.units.decision?.response_key ?? "").toUpperCase() || "---";
    const reportedSyllable = String(snapshot.units.decision?.reported_syllable ?? "---");
    return stimBank.get_and_format("feedback_recorded", {
      reported_syllable: reportedSyllable,
      response_key: responseKey
    });
  });
  set_trial_context(feedback, {
    trial_id: trialId,
    phase: "feedback",
    deadline_s: feedbackDuration,
    valid_keys: [],
    block_id,
    condition_id: trialSpec.condition,
    task_factors: {
      stage: "feedback",
      condition: trialSpec.condition,
      block_idx
    },
    stim_id: "feedback"
  });
  feedback.show({ duration: feedbackDuration }).to_dict();

  const iti = trial.unit("iti").addStim(stimBank.get("fixation"));
  set_trial_context(iti, {
    trial_id: trialId,
    phase: "inter_trial_interval",
    deadline_s: itiDuration,
    valid_keys: [],
    block_id,
    condition_id: trialSpec.condition,
    task_factors: {
      stage: "inter_trial_interval",
      block_idx
    },
    stim_id: "fixation"
  });
  iti.show({ duration: itiDuration }).to_dict();

  trial.finalize((snapshot, _runtime, helpers) => {
    const responseKey = String(snapshot.units.decision?.response_key ?? "").trim().toLowerCase();
    const reportedSyllableRaw = snapshot.units.decision?.reported_syllable;
    const reportedSyllable =
      reportedSyllableRaw == null || String(reportedSyllableRaw).length === 0
        ? "none"
        : String(reportedSyllableRaw);
    const timedOut = Boolean(snapshot.units.decision?.timed_out ?? true);
    const rt = snapshot.units.decision?.rt;
    const keyPress = snapshot.units.decision?.key_press;
    const matchesExpected = Boolean(snapshot.units.decision?.matches_expected ?? false);
    const fusionDa = Boolean(snapshot.units.decision?.fusion_da ?? false);

    helpers.setTrialState("trial_id", trialId);
    helpers.setTrialState("condition", trialSpec.condition);
    helpers.setTrialState("audio_syllable", trialSpec.audio_syllable);
    helpers.setTrialState("visual_syllable", trialSpec.visual_syllable);
    helpers.setTrialState("expected_percept", trialSpec.expected_percept);
    helpers.setTrialState("decision_response", responseKey);
    helpers.setTrialState("decision_rt", typeof rt === "number" ? rt : null);
    helpers.setTrialState("decision_key_press", typeof keyPress === "boolean" ? keyPress : !timedOut);
    helpers.setTrialState("decision_timed_out", timedOut);
    helpers.setTrialState("reported_syllable", reportedSyllable);
    helpers.setTrialState("matches_expected", matchesExpected);
    helpers.setTrialState("fusion_da", fusionDa);

    controller.record_trial({
      trial_id: trialId,
      block_id,
      block_idx,
      condition: trialSpec.condition,
      audio_syllable: trialSpec.audio_syllable,
      visual_syllable: trialSpec.visual_syllable,
      expected_percept: trialSpec.expected_percept,
      decision_response: responseKey,
      decision_rt: typeof rt === "number" ? rt : null,
      decision_key_press: typeof keyPress === "boolean" ? keyPress : !timedOut,
      decision_timed_out: timedOut,
      reported_syllable: reportedSyllable,
      matches_expected: matchesExpected,
      fusion_da: fusionDa
    });
  });

  return trial;
}
