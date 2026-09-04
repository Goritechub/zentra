// One-off script — run manually with `node scripts/generate-favicons.mjs`
// whenever the master icon asset changes. Not wired into the build.
import sharp from "sharp";

const SRC = "ZentraGig Logo/ZentraGig png/zentra logo icon.png";

const sizes = [
  { file: "public/favicon-16x16.png", size: 16 },
  { file: "public/favicon-32x32.png", size: 32 },
  { file: "public/apple-touch-icon.png", size: 180 },
];

for (const { file, size } of sizes) {
  await sharp(SRC).resize(size, size).png().toFile(file);
  console.log(`wrote ${file}`);
}

// Single-resolution .ico (32x32 PNG wrapped in an ICO container).
// Modern browsers fall back to the PNG <link> tags above, so a true
// multi-resolution .ico isn't worth a second dependency here.
const png32 = await sharp(SRC).resize(32, 32).png().toBuffer();
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // reserved
icoHeader.writeUInt16LE(1, 2); // type: icon
icoHeader.writeUInt16LE(1, 4); // image count

const dirEntry = Buffer.alloc(16);
dirEntry.writeUInt8(32, 0); // width
dirEntry.writeUInt8(32, 1); // height
dirEntry.writeUInt8(0, 2); // palette
dirEntry.writeUInt8(0, 3); // reserved
dirEntry.writeUInt16LE(1, 4); // color planes
dirEntry.writeUInt16LE(32, 6); // bits per pixel
dirEntry.writeUInt32LE(png32.length, 8); // image data size
dirEntry.writeUInt32LE(22, 12); // offset (6 header + 16 dir entry)

const { writeFileSync } = await import("fs");
writeFileSync("public/favicon.ico", Buffer.concat([icoHeader, dirEntry, png32]));
console.log("wrote public/favicon.ico");
