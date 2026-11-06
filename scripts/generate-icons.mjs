import { mkdir, writeFile } from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";

const destination = new URL("../assets/", import.meta.url);
await mkdir(destination, { recursive: true });

function artwork(background, mark) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    ${background ? `<rect width="1024" height="1024" fill="${background}"/>` : ""}
    <path d="M252 674V431c0-78 45-128 113-128 60 0 102 36 118 90 17-54 58-90 118-90 69 0 113 50 113 128v243" fill="none" stroke="${mark}" stroke-width="92" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
for (const [name, background, mark] of [
  ["customer", "#285B43", "#F5F6F0"],
  ["partner", "#F5F6F0", "#285B43"],
]) {
  await writeFile(
    new URL(`${name}-icon.png`, destination),
    new Resvg(artwork(background, mark)).render().asPng(),
  );
  await writeFile(
    new URL(`${name}-foreground.png`, destination),
    new Resvg(artwork("", mark)).render().asPng(),
  );
}
