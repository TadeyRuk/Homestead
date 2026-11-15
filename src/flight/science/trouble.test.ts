import { describe, expect, it } from "vitest";
import { createConverter, LOW_OXYGEN } from "./converter";
import { SAFE_HIGH, SAFE_LOW } from "./core";
import { scienceTrouble } from "./trouble";

const ship = (cabinOxygen = 0.9, coreTemp = 0.5) => ({ cabinOxygen, coreTemp });

describe("science trouble for the crew strip", () => {
  it("is steady with air in the cabin and the core in its band", () => {
    expect(scienceTrouble(createConverter(1), ship())).toBeNull();
  });

  it("names low cabin oxygen first", () => {
    const c = createConverter(1);
    c.jammed = 2;
    expect(scienceTrouble(c, ship(LOW_OXYGEN - 0.01, SAFE_HIGH + 0.1))).toBe("Oxygen low");
  });

  it("names a jammed intake next", () => {
    const c = createConverter(1);
    c.jammed = 2;
    expect(scienceTrouble(c, ship(0.9, SAFE_HIGH + 0.1))).toBe("Intake jam");
  });

  it("warns when the core runs hot or cold", () => {
    expect(scienceTrouble(createConverter(1), ship(0.9, SAFE_HIGH + 0.1))).toBe("Core hot");
    expect(scienceTrouble(createConverter(1), ship(0.9, SAFE_LOW - 0.1))).toBe("Core cold");
  });
});
