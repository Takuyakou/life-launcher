import { expect, test } from "@playwright/test";
import { resolveDictionaryWindowGeometry } from "../../src/dictionaryWindow";

function monitor(left: number, top: number, width: number, height: number) {
  return {
    workArea: {
      position: { x: left, y: top },
      size: { width, height },
    },
  };
}

test("Dictionary keeps its saved position when it is already on the main monitor", () => {
  expect(
    resolveDictionaryWindowGeometry(
      { x: 2100, y: 120 },
      { width: 760, height: 520 },
      monitor(1920, 0, 1920, 1040),
    ),
  ).toEqual({
    position: { x: 2100, y: 120 },
    size: { width: 760, height: 520 },
  });
});

test("Dictionary moves to the center of the monitor containing the main window", () => {
  expect(
    resolveDictionaryWindowGeometry(
      { x: 200, y: 100 },
      { width: 760, height: 520 },
      monitor(1920, 0, 1920, 1040),
    ),
  ).toEqual({
    position: { x: 2500, y: 260 },
    size: { width: 760, height: 520 },
  });
});

test("Dictionary stays inside a smaller negative-coordinate work area", () => {
  expect(
    resolveDictionaryWindowGeometry(
      { x: 100, y: 100 },
      { width: 1200, height: 900 },
      monitor(-1024, -200, 1024, 768),
    ),
  ).toEqual({
    position: { x: -1008, y: -184 },
    size: { width: 992, height: 736 },
  });
});
