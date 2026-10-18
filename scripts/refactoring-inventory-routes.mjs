// URL de una pagina del App Router a partir de la ruta de su archivo (entrega
// 10.3). Sigue la convencion de Next 16 (docs de intercepting-routes y
// parallel-routes):
// - un grupo (nombre) no es parte de la URL;
// - una ranura @nombre tampoco: la pagina se pinta en esa ranura del layout;
// - (.), (..), (..)(..) y (...) interceptan la URL del segmento que les sigue,
//   contando segmentos de ruta (sin grupos ni ranuras), no carpetas.

const INTERCEPTION = /^(\(\.\.\.\)|\(\.\)|(?:\(\.\.\))+)(.+)$/;

/**
 * @param {string} file Ruta relativa con barras normales: "src/app/.../page.tsx".
 * @returns {{ route: string, slot: string | null, intercepted: boolean }}
 */
export function describeRoute(file) {
  const folders = file
    .slice("src/app/".length, -"page.tsx".length)
    .split("/")
    .filter(Boolean);
  const segments = [];
  let slot = null;
  let intercepted = false;

  for (const folder of folders) {
    if (folder.startsWith("@")) {
      slot = folder;
      continue;
    }

    const interception = INTERCEPTION.exec(folder);

    if (interception) {
      const [, marker, segment] = interception;

      if (marker === "(...)") {
        segments.length = 0;
      } else if (marker !== "(.)") {
        const levels = marker.length / "(..)".length;
        segments.splice(Math.max(0, segments.length - levels));
      }

      segments.push(segment);
      intercepted = true;
      continue;
    }

    if (folder.startsWith("(") && folder.endsWith(")")) {
      continue;
    }

    segments.push(folder);
  }

  return { route: `/${segments.join("/")}`, slot, intercepted };
}
