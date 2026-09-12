// One-off script — run manually with `node scripts/generate-social-images.mjs`
// whenever the brand mark changes. Not wired into the build.
import sharp from "sharp";

await sharp("ZentraGig Logo/ZentraGig png/zentra logo icon.png")
  .resize(512, 512)
  .png()
  .toFile("public/zentragig-logo.PNG");

await sharp({
  create: { width: 1200, height: 630, channels: 3, background: "#1E2337" },
})
  .composite([{ input: "src/assets/zentragig-wordmark-white.png", gravity: "center" }])
  .jpeg({ quality: 90 })
  .toFile("public/og-image.jpeg");

console.log("wrote public/zentragig-logo.PNG and public/og-image.jpeg");
