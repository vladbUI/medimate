import { cpSync, mkdirSync } from "node:fs";
for (const name of ["cmaps", "standard_fonts", "wasm"]) {
  mkdirSync(`public/${name}`, { recursive: true });
  cpSync(`node_modules/pdfjs-dist/${name}`, `public/${name}`, {
    recursive: true,
  });
}
