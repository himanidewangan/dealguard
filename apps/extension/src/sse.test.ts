import { describe, expect, it } from "vitest";
import { partialExplanation, splitSse } from "./sse.ts";

describe("splitSse", () => {
  it("returns complete events and keeps the remainder", () => {
    const { events, rest } = splitSse('event: delta\ndata: {"text":"a"}\n\nevent: done\ndata: {"x":1}\n\nevent: del');
    expect(events.map((e) => e.event)).toEqual(["delta", "done"]);
    expect(rest).toBe("event: del");
  });
});

describe("partialExplanation", () => {
  it("reads a half-streamed explanation", () => {
    expect(partialExplanation('{"explanation":"It asks you to pa')).toBe("It asks you to pa");
  });
  it("unescapes quotes and ignores a trailing backslash", () => {
    expect(partialExplanation('{"explanation":"say \\"no\\" now\\')).toBe('say "no" now');
  });
  it("returns empty before the field starts", () => {
    expect(partialExplanation('{"expl')).toBe("");
  });
});
