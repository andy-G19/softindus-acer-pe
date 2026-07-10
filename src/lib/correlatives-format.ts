// Funcion pura sin dependencias, separada de src/lib/correlatives.ts (que
// importa "server-only" y el cliente de Prisma) para poder cubrirla con
// tests unitarios sin arrastrar esas dependencias.
export function formatCorrelativeId(prefijo: string, numero: number): string {
  return `${prefijo}${String(numero).padStart(8, "0")}`;
}
