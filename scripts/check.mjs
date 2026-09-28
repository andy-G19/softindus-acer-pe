import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Run through npm so the same executable works on Windows and Linux, without
// shell interpolation. These checks never invoke seed, migrate or bootstrap.
const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error("Ejecute este script con npm run check.");
  process.exit(1);
}

const cwd = fileURLToPath(new URL("../", import.meta.url));
const env = {
  ...process.env,
  DATABASE_URL: "postgresql://check_user:check_password@127.0.0.1:1/check_db?schema=aceros",
  DIRECT_URL: "postgresql://check_user:check_password@127.0.0.1:1/check_db?schema=aceros",
  AUTH_SECRET: "local_check_dummy_secret_not_for_deployment",
  AUTH_URL: "http://localhost:3000",
  AUTH_TRUST_HOST: "true",
  NEXT_TELEMETRY_DISABLED: "1",
};

// Let Vitest and Next choose their own mode, regardless of the caller's shell.
delete env.NODE_ENV;

const steps = ["db:generate", "db:validate", "lint", "typecheck", "test", "build"];
for (const step of steps) {
  console.log(`\n[check] ${step}`);
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, [npmCli, "run", step], {
      cwd,
      env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", (error) => {
      console.error(`No se pudo iniciar ${step}: ${error.message}`);
      resolve(1);
    });
    child.once("exit", (exitCode) => resolve(exitCode ?? 1));
  });

  if (code !== 0) {
    console.error(`\n[check] Detenido en ${step}. No se ejecutaron los pasos restantes.`);
    process.exit(code);
  }
}

console.log("\n[check] Todas las comprobaciones finalizaron correctamente.");
