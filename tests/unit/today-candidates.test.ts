import { describe, expect, test } from "vitest";
import { buildTodayCandidates, todayCandidateFromConfig } from "../../src/todayCandidates";
import type { AppConfig, InboxItem, LauncherProject } from "../../src/types";
import { createPublicFixture } from "../visual/fixtures";

// V165 PR 2: the candidate list is what the Today picker and the Do Now offer read, and it is a
// pure function of the config. These cases cover the states the app can reach: a project without a
// next step, a wish whose text is blank, two wishes that share the legacy key, and a wish on a
// project that has no timer settings of its own.
function baseConfig(): AppConfig {
  return createPublicFixture().config;
}

function project(id: string, nextStepText?: string): LauncherProject {
  const base = baseConfig().projects[0];
  return {
    ...base,
    id,
    name: id,
    nextStep: nextStepText === undefined ? undefined : { ...base.nextStep!, text: nextStepText },
  };
}

function wish(id: string, text: string, projectId?: string): InboxItem {
  return projectId === undefined ? { id, text } : { id, text, projectId };
}

function configWith(projects: LauncherProject[], inbox: InboxItem[]): AppConfig {
  return { ...baseConfig(), projects, inbox };
}

describe("today candidates", () => {
  test("lists project next steps before wishes and skips blank text", () => {
    const config = configWith(
      [project("p1", "机の上の紙を2山に分ける"), project("p2", "   ")],
      [wish("i1", "本を開いて次の見出しまで読む", "p1"), wish("i2", "   ")],
    );
    const candidates = buildTodayCandidates(config);
    expect(candidates.map((candidate) => candidate.key)).toEqual(["project:p1", "wishlist:i1"]);
    expect(candidates[0].source).toBe("次の一手");
    expect(candidates[1].source).toBe("やりたいこと");
  });

  test("gives the legacy alias only to the first wish that shares it", () => {
    const config = configWith(
      [project("p1", "机の上の紙を2山に分ける")],
      [
        wish("i1", "本を開いて次の見出しまで読む", "p1"),
        wish("i2", "本を開いて次の見出しまで読む", "p1"),
      ],
    );
    const [first, second] = buildTodayCandidates(config).filter(
      (candidate) => candidate.source === "やりたいこと",
    );
    expect(first.key).toBe("wishlist:i1");
    expect(second.key).toBe("wishlist:i2");
    expect(first.sourceAliases).toEqual(["wishlist:p1:本を開いて次の見出しまで読む"]);
    expect(second.sourceAliases).toBeUndefined();
  });

  test("finds a candidate by its current key or by its legacy alias", () => {
    const config = configWith(
      [project("p1", "机の上の紙を2山に分ける")],
      [wish("i1", "本を開いて次の見出しまで読む", "p1")],
    );
    expect(todayCandidateFromConfig(config, "project:p1")?.text).toBe("机の上の紙を2山に分ける");
    expect(todayCandidateFromConfig(config, "wishlist:i1")?.text).toBe(
      "本を開いて次の見出しまで読む",
    );
    expect(todayCandidateFromConfig(config, "wishlist:p1:本を開いて次の見出しまで読む")?.key).toBe(
      "wishlist:i1",
    );
    expect(todayCandidateFromConfig(config, "project:missing")).toBeUndefined();
  });

  test("uses the default timer minutes when the project has no next step", () => {
    const config = configWith([project("p1", "机の上の紙を2山に分ける")], [wish("i1", "散歩する", "p1")]);
    const [candidate] = buildTodayCandidates(config).filter(
      (entry) => entry.source === "やりたいこと",
    );
    expect(candidate.defaultTimerMinutes).toBe(config.settings.defaultTimerMinutes);
    expect(candidate.shortTimerMinutes).toBe(config.settings.shortTimerMinutes);
  });
});
