# Fuentes alojadas

Desde la entrega 8 las fuentes del ERP viven en esta carpeta y se cargan con
`next/font/local` en `src/app/layout.tsx`. Antes se cargaban con
`next/font/google`, que las descarga de Google en cada build: el 2026-10-12 esa
descarga falló y rompió el despliegue de producción del grupo 4 de fixes, con
el mismo código que staging había desplegado bien. Una regla de ESLint prohíbe
volver a importar `next/font/google`.

## Procedencia

Son los archivos que `next/font/google` descargó y servía en producción: se
copiaron de `.next/static/media` del build local del 2026-10-12, sin volver a
descargarlos. `fonts.test.ts` fija su SHA-256.

| Archivo | Familia y pesos | Archivo que generaba `next/font/google` | SHA-256 |
|---|---|---|---|
| `geist-latin.woff2` | Geist, variable 100–900 | `caa3a2e1cccd8315-s.p.0wgildi0cnwt9.woff2` | `9b6f5ff4…6c608` |
| `oswald-latin.woff2` | Oswald, variable; se declara 500, 600 y 700 | `6ad1cda2f16975ee-s.p.2j22bd4n1tlhh.woff2` | `9dde3797…b6b85` |
| `jetbrains-mono-latin.woff2` | JetBrains Mono, 500 | `e1750518007a189a-s.p.29e6ydd6osd72.woff2` | `615a7673…7d04b` |

Cada archivo es el subconjunto latino de Google, el único que se precargaba:
`U+0000-00FF`, `U+0131`, `U+0152-0153`, `U+02BB-02BC`, `U+02C6`, `U+02DA`,
`U+02DC`, `U+0304`, `U+0308`, `U+0329`, `U+2000-206F`, `U+20AC`, `U+2122`,
`U+2191`, `U+2193`, `U+2212`, `U+2215`, `U+FEFF` y `U+FFFD`. Cubre todo el
español (vocales con tilde, ñ, ¿, ¡, comillas, rayas y €). Google servía
además los subconjuntos latin-ext, cirílico y vietnamita (y griego en JetBrains
Mono), que no se precargaban: un carácter de esos alfabetos, como «ő» o «Ł»,
se ve ahora con la fuente de respaldo.

## Lo que cambia y lo que no

- Los glifos, los pesos y los estilos son los mismos. Oswald es variable, pero
  se declara cada peso por separado sobre el mismo archivo, como hacía Google:
  así un peso intermedio, como el 650 de los títulos, se sigue resolviendo en
  700.
- El nombre de la familia pasa de `Geist`, `Oswald` y `JetBrains Mono` a
  `geist`, `oswald` y `jetBrainsMono`: `next/font/local` lo toma del nombre de la
  constante, y la variable CSS (`--font-sans`, `--font-oswald`,
  `--font-jetbrains-mono`) usa ese nombre aunque se cambie con `declarations`.
- La fuente de respaldo ajustada (Arial con `size-adjust`), que solo se ve
  mientras carga el archivo, se calcula ahora con las métricas del propio
  archivo: sus porcentajes difieren en décimas de los que traía Google.

## Licencia

Las tres familias se distribuyen con la SIL Open Font License 1.1. El
repositorio es público, así que publicarlo redistribuye las fuentes, y la
licencia exige que su aviso de copyright y su texto viajen con ellas:
`OFL-geist.txt`, `OFL-oswald.txt` y `OFL-jetbrains-mono.txt`, copiados de
`github.com/google/fonts` (`ofl/geist`, `ofl/oswald` y `ofl/jetbrainsmono`).

## Cambiar o agregar una fuente

1. Copiar el `.woff2` a esta carpeta junto con su licencia.
2. Declararlo en `layout.tsx` con `localFont`.
3. Registrar su SHA-256, su licencia y su copyright en `fonts.test.ts` (la
   prueba falla si hay un `.woff2` sin registrar).
4. Comprobar en staging que las pantallas se ven igual o aprobar el cambio.
