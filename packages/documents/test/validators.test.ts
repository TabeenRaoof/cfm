import { describe, expect, it } from "vitest";
import {
  parseStandard, validateCountry, validateDate, validateIssueDate,
  validateStandard, validateValidityWindow,
} from "../src/validators.ts";

describe("dates", () => {
  it("accepts a real ISO date", () => {
    expect(validateDate("2026-09-13").verdict).toBe("valid");
  });

  it("rejects a date that does not exist", () => {
    // Date.parse rolls this forward to 2 March without complaint, which is how a wrong expiry
    // becomes a plausible one.
    expect(validateDate("2026-02-30")).toMatchObject({ verdict: "invalid" });
  });

  it("rejects the wrong format rather than trying to interpret it", () => {
    expect(validateDate("13/09/2026").verdict).toBe("invalid");
  });

  it("treats an absent date as undetermined, not valid", () => {
    expect(validateDate(null).verdict).toBe("undetermined");
    expect(validateDate(undefined).verdict).toBe("undetermined");
  });
});

describe("issue dates", () => {
  it("rejects a document dated in the future", () => {
    // A typo, a misread or a forgery. All three want a human.
    const result = validateIssueDate("2027-01-01", "2026-09-13");
    expect(result.verdict).toBe("invalid");
    expect(result.reason).toMatch(/in the future/);
  });

  it("rejects one implausibly old for a product on sale now", () => {
    expect(validateIssueDate("1990-01-01", "2026-09-13").verdict).toBe("invalid");
  });

  it("accepts one issued today", () => {
    expect(validateIssueDate("2026-09-13", "2026-09-13").verdict).toBe("valid");
  });

  it("does not depend on when the check runs", () => {
    // Re-evaluating an old document must not change its verdict because a year passed.
    expect(validateIssueDate("2010-05-01", "2026-09-13").verdict).toBe("valid");
    expect(validateIssueDate("2010-05-01", "2040-09-13").verdict).toBe("invalid");
  });
});

describe("validity windows", () => {
  it("rejects an expiry before its issue date", () => {
    expect(validateValidityWindow("2026-01-01", "2025-01-01").verdict).toBe("invalid");
  });

  it("accepts a sane window", () => {
    expect(validateValidityWindow("2026-01-01", "2027-01-01").verdict).toBe("valid");
  });

  it("is undetermined when either end is missing", () => {
    expect(validateValidityWindow("2026-01-01", null).verdict).toBe("undetermined");
  });
});

describe("countries", () => {
  it("accepts an alpha-2 code and rejects a name", () => {
    expect(validateCountry("DE").verdict).toBe("valid");
    expect(validateCountry("Germany").verdict).toBe("invalid");
  });
});

describe("standards", () => {
  it("parses a reference with a version and an amendment", () => {
    expect(parseStandard("EN 71-1:2014+A1:2018")).toMatchObject({
      body: "EN", number: "71-1", year: 2014, amendments: ["A1:2018"],
    });
  });

  it("parses a compound body", () => {
    expect(parseStandard("EN IEC 62368-1:2020")).toMatchObject({ body: "EN IEC", number: "62368-1", year: 2020 });
  });

  it("parses one with no year", () => {
    expect(parseStandard("EN 71-3")).toMatchObject({ number: "71-3", year: null });
  });

  it("returns structure rather than a string, so versions can be compared later", () => {
    // The v2 verification module has to compare cited versions against current ones. That
    // comparison is impossible on free text.
    const parsed = parseStandard("EN 71-1:2014");
    expect(typeof parsed?.year).toBe("number");
  });

  it("rejects prose", () => {
    expect(validateStandard("tested to the relevant standards").verdict).toBe("invalid");
  });
});
