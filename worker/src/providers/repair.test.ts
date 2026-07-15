import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseWithRepair, SchemaRepairError } from "./repair.js";

const schema = z.object({ name: z.string(), age: z.number() });

describe("parseWithRepair", () => {
  it("returns the parsed value immediately when the first attempt is valid", async () => {
    const repair = async () => {
      throw new Error("should not be called");
    };
    const result = await parseWithRepair(schema, { name: "Ana", age: 30 }, repair);
    expect(result).toEqual({ name: "Ana", age: 30 });
  });

  it("calls the repair callback and accepts a corrected payload", async () => {
    let calls = 0;
    const repair = async () => {
      calls += 1;
      return { name: "Ana", age: 30 };
    };
    const result = await parseWithRepair(schema, { name: "Ana", age: "30" }, repair);
    expect(result).toEqual({ name: "Ana", age: 30 });
    expect(calls).toBe(1);
  });

  it("throws SchemaRepairError with the last validation errors when repair keeps failing", async () => {
    const repair = async () => ({ name: "Ana", age: "still wrong" });
    await expect(parseWithRepair(schema, { name: "Ana" }, repair)).rejects.toThrow(SchemaRepairError);
  });
});
