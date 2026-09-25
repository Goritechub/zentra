import { describe, expect, it } from "vitest";
import { blogBlocksSchema } from "@/types/blog";
import { validBlockArrays, invalidBlockArrays } from "./blogBlocks.fixtures";

describe("blogBlocksSchema contract", () => {
  it.each(validBlockArrays.map((blocks) => [blocks]))("accepts valid block array %#", (blocks) => {
    const result = blogBlocksSchema.safeParse(blocks);
    expect(result.success).toBe(true);
  });

  it.each(invalidBlockArrays.map((blocks) => [blocks]))("rejects invalid block array %#", (blocks) => {
    const result = blogBlocksSchema.safeParse(blocks);
    expect(result.success).toBe(false);
  });
});
