import "server-only";

// La implementacion real vive en src/lib/correlatives-core.ts (sin
// "server-only") para poder reutilizarse tambien desde scripts/bootstrap-admin.ts,
// que se ejecuta con tsx fuera del bundler de Next.js.
export {
  getNextCorrelativeId,
  getNextCorrelativeIds,
} from "@/lib/correlatives-core";
export type {
  CorrelativeParams,
  CorrelativeTransactionClient,
} from "@/lib/correlatives-core";
