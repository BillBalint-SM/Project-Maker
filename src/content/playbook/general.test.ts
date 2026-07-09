import { describe, expect, it } from "vitest";
import { general } from "./general";
import { PlaybookSchema } from "./types";

describe("content/playbook/general", () => {
  it("PlaybookSchema.parse(general) nem dob hibát", () => {
    expect(() => PlaybookSchema.parse(general)).not.toThrow();
  });

  it("general.items.length === 30", () => {
    expect(general.items.length).toBe(30);
  });

  it("general.items ids pontosan [1..30], nincs duplikáció, nincs hiányzó id", () => {
    const ids = general.items.map((item) => item.id);
    const expected = Array.from({ length: 30 }, (_, index) => index + 1);
    expect([...ids].sort((a, b) => a - b)).toEqual(expected);
  });

  it("general.items egyik eleme sem hordoz hint kulcsot (D-11)", () => {
    for (const item of general.items) {
      expect("hint" in item).toBe(false);
    }
  });
});
