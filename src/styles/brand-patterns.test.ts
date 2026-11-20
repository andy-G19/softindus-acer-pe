import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Barrido termico (propuesta de fundamentos del responsable, 2026-11-20): un riel de 6 px atenuado
// que un brillo brasa -> primario del 38 % del ancho cruza cada 6 s. Es un patron para integrar mas
// adelante en algunos componentes; hoy solo lo muestra la galeria. Usa --motion-temper, el ciclo de
// 6 s de la marca que ya mueven la barra termica y el riel templado, en lugar de un token nuevo con
// el mismo valor.

const BRAND = readFileSync("src/styles/brand.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function declaracionesDe(selector: string) {
  const inicio = BRAND.indexOf(`${selector} {`);
  return inicio === -1 ? "" : BRAND.slice(inicio, BRAND.indexOf("}", inicio));
}

describe("barrido termico", () => {
  it("es un riel de 6 px, redondo y atenuado, que recorta el brillo", () => {
    const riel = declaracionesDe(".heat-sweep");

    expect(riel).toMatch(/height:\s*6px/);
    expect(riel).toMatch(/border-radius:\s*9999px/);
    expect(riel).toMatch(/background-color:\s*var\(--muted\)/);
    expect(riel).toMatch(/overflow:\s*hidden/);
    expect(riel).toMatch(/position:\s*relative/);
  });

  it("el brillo ocupa el 38 % y va de transparente a brasa, primario y transparente", () => {
    const brillo = declaracionesDe(".heat-sweep::before");

    expect(brillo).toMatch(/width:\s*38%/);
    expect(brillo).toMatch(
      /linear-gradient\(\s*90deg,\s*transparent,\s*var\(--accent-ember\) 45%,\s*var\(--primary\) 55%,\s*transparent\s*\)/,
    );
  });

  it("cruza el riel cada 6 s con el ciclo de la marca, a velocidad constante", () => {
    expect(declaracionesDe(".heat-sweep::before")).toMatch(/animation:\s*heat-sweep var\(--motion-temper\) linear infinite/);
    const pasos = BRAND.slice(BRAND.indexOf("@keyframes heat-sweep"));
    expect(pasos).toMatch(/translateX\(-120%\)/);
    expect(pasos).toMatch(/translateX\(380%\)/);
  });

  it("con reducir movimiento queda quieto", () => {
    const reducido = BRAND.slice(BRAND.indexOf("prefers-reduced-motion"));

    expect(reducido).toMatch(/\.heat-sweep::before\s*\{\s*animation:\s*none/);
  });
});
