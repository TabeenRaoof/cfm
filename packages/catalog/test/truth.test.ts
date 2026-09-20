import { describe, expect, it } from "vitest";
import { and, FALSE, not, or, TRUE, unknown } from "../src/truth.ts";

const U = (...m: string[]) => unknown(m);

describe("Kleene conjunction", () => {
  it("is false when any operand is false, even alongside unknowns", () => {
    expect(and([TRUE, FALSE, U("a")]).truth).toBe("false");
  });

  it("is unknown when an operand is unknown and none is false", () => {
    expect(and([TRUE, U("a")]).truth).toBe("unknown");
  });

  it("is true only when every operand is true", () => {
    expect(and([TRUE, TRUE]).truth).toBe("true");
  });

  it("reports no questions once the result is decided", () => {
    // Asking the customer for facts that cannot change the answer trains them to ignore us.
    expect(and([FALSE, U("a")]).missing).toEqual([]);
  });

  it("collects and deduplicates questions from every unresolved branch", () => {
    expect(and([U("b"), U("a"), U("b")]).missing).toEqual(["a", "b"]);
  });

  it("is vacuously true when empty", () => {
    expect(and([]).truth).toBe("true");
  });
});

describe("Kleene disjunction", () => {
  it("is true when any operand is true, even alongside unknowns", () => {
    expect(or([FALSE, TRUE, U("a")]).truth).toBe("true");
  });

  it("is unknown when an operand is unknown and none is true", () => {
    expect(or([FALSE, U("a")]).truth).toBe("unknown");
  });

  it("is false only when every operand is false", () => {
    expect(or([FALSE, FALSE]).truth).toBe("false");
  });

  it("is vacuously false when empty", () => {
    expect(or([]).truth).toBe("false");
  });
});

describe("Kleene negation", () => {
  it("inverts decided values", () => {
    expect(not(TRUE).truth).toBe("false");
    expect(not(FALSE).truth).toBe("true");
  });

  it("leaves unknown unknown, and keeps its questions", () => {
    // The line most often written wrong: in two-valued code `!undefined` is `true`, which
    // silently turns "we don't know" into "yes".
    const result = not(U("manufacturer.country"));
    expect(result.truth).toBe("unknown");
    expect(result.missing).toEqual(["manufacturer.country"]);
  });
});
