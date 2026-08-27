import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const distDir = fileURLToPath(new URL("../dist/", import.meta.url));
const src = fileURLToPath(new URL("../src/styles.css", import.meta.url));
const dest = fileURLToPath(new URL("../dist/styles.css", import.meta.url));

mkdirSync(distDir, { recursive: true });
copyFileSync(src, dest);
console.log("[@filmset/ui] copied styles.css to dist/");
