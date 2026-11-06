import { mkdir, writeFile } from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";

const destination = new URL("../assets/", import.meta.url);
const mark =
  "M14 45V22h7v3.1c1.8-2.6 4.1-3.9 7-3.9 3.2 0 5.5 1.3 6.8 4 2-2.7 4.6-4 7.8-4 5.4 0 8.6 3.5 8.6 9.3V45h-7.4V33.2c0-3.1-1.2-4.8-3.7-4.8-2.6 0-4.3 2-4.3 5.1V45h-7.4V33.2c0-3.1-1.2-4.8-3.7-4.8-2.7 0-4.3 2-4.3 5.1V45z";

function artwork(background) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 64 64">
    ${background === "icon" ? '<rect width="64" height="64" fill="#234c3c"/>' : background === "mark" ? '<rect width="64" height="64" rx="16" fill="#234c3c"/>' : ""}
    <path d="${mark}" fill="#f5f6f2"/>
  </svg>`;
}

await mkdir(destination, { recursive: true });
await writeFile(
  new URL("miledesk-icon.png", destination),
  new Resvg(artwork("icon")).render().asPng(),
);
await writeFile(
  new URL("miledesk-mark.png", destination),
  new Resvg(artwork("mark")).render().asPng(),
);
await writeFile(
  new URL("miledesk-foreground.png", destination),
  new Resvg(artwork("foreground")).render().asPng(),
);
