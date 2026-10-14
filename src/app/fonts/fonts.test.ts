import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Fuentes alojadas en el repositorio (entrega 8). Cada archivo es el que
// next/font/google descargo y servia en produccion (ver README.md): el hash
// fija su procedencia, y la licencia OFL debe viajar con el archivo porque el
// repositorio es publico.
const FONTS_DIR = "src/app/fonts";

const FONTS = [
  {
    file: "geist-latin.woff2",
    sha256: "9b6f5ff45b278c744b5f379a2c4ecbaf858a842b8eaf82ac8d21b699ca16c608",
    license: "OFL-geist.txt",
    copyright: "Copyright 2024 The Geist Project Authors",
  },
  {
    file: "oswald-latin.woff2",
    sha256: "9dde3797547520f762f4ba3a822d417a0872b962bc78753a7ee9f955382b6b85",
    license: "OFL-oswald.txt",
    copyright: "Copyright 2016 The Oswald Project Authors",
  },
  {
    file: "jetbrains-mono-latin.woff2",
    sha256: "615a7673d37b1dd624e2deeb572a1a238f9b32981bf3fc44f87aa14f3bd7d04b",
    license: "OFL-jetbrains-mono.txt",
    copyright: "Copyright 2020 The JetBrains Mono Project Authors",
  },
];

function sha256(file: string) {
  return createHash("sha256")
    .update(readFileSync(path.join(FONTS_DIR, file)))
    .digest("hex");
}

describe("fuentes alojadas", () => {
  it.each(FONTS)("$file es el archivo que servia Google", ({ file, sha256: expected }) => {
    expect(sha256(file)).toBe(expected);
  });

  it.each(FONTS)("$file viaja con su licencia OFL", ({ license, copyright }) => {
    const text = readFileSync(path.join(FONTS_DIR, license), "utf8");

    expect(text).toContain(copyright);
    expect(text).toContain("SIL OPEN FONT LICENSE Version 1.1");
  });

  it("no hay fuentes sin registrar en la carpeta", () => {
    const files = readdirSync(FONTS_DIR).filter((name) => name.endsWith(".woff2"));

    expect(files.sort()).toEqual(FONTS.map(({ file }) => file).sort());
  });

  it("el layout carga cada fuente desde esta carpeta", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");

    expect(layout).toContain('from "next/font/local"');
    for (const { file } of FONTS) {
      expect(layout).toContain(`./fonts/${file}`);
    }
  });
});
