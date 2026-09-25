import {
  BULLET_LIST_STYLES,
  NUMBERED_LIST_STYLES,
  type BulletListStyle,
  type NumberedListStyle,
} from "@/types/blog";

export type ListStyle = BulletListStyle | NumberedListStyle;

const NUMBERED_LABELS: Record<NumberedListStyle, string> = {
  decimal: "1, 2, 3…",
  "upper-roman": "I, II, III…",
  "lower-roman": "i, ii, iii…",
  "upper-alpha": "A, B, C…",
  "lower-alpha": "a, b, c…",
};

const BULLET_LABELS: Record<BulletListStyle, { label: string; glyph: string }> = {
  disc: { label: "Filled circle", glyph: "•" },
  circle: { label: "Circle", glyph: "◦" },
  square: { label: "Square", glyph: "▪" },
  arrow: { label: "Arrow", glyph: "→" },
};

export const NUMBERED_LIST_STYLE_OPTIONS = NUMBERED_LIST_STYLES.map((value) => ({
  value,
  label: NUMBERED_LABELS[value],
}));

export const BULLET_LIST_STYLE_OPTIONS = BULLET_LIST_STYLES.map((value) => ({
  value,
  ...BULLET_LABELS[value],
}));

function toLowerRoman(num: number): string {
  const table: [number, string][] = [
    [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"],
    [100, "c"], [90, "xc"], [50, "l"], [40, "xl"],
    [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
  ];
  let n = num;
  let result = "";
  for (const [value, symbol] of table) {
    while (n >= value) {
      result += symbol;
      n -= value;
    }
  }
  return result;
}

function toLowerAlpha(num: number): string {
  let n = num;
  let result = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(97 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

export function getListMarker(
  type: "bullet_list" | "numbered_list",
  style: ListStyle | undefined,
  index: number,
): string {
  const resolved = style ?? (type === "bullet_list" ? "disc" : "decimal");
  const n = index + 1;
  switch (resolved) {
    case "decimal":
      return `${n}.`;
    case "upper-roman":
      return `${toLowerRoman(n).toUpperCase()}.`;
    case "lower-roman":
      return `${toLowerRoman(n)}.`;
    case "upper-alpha":
      return `${toLowerAlpha(n).toUpperCase()}.`;
    case "lower-alpha":
      return `${toLowerAlpha(n)}.`;
    case "disc":
      return BULLET_LABELS.disc.glyph;
    case "circle":
      return BULLET_LABELS.circle.glyph;
    case "square":
      return BULLET_LABELS.square.glyph;
    case "arrow":
      return BULLET_LABELS.arrow.glyph;
    default:
      return `${n}.`;
  }
}
