import { describe, expect, it, vi } from "vitest";

import {
  syncStageMachineAssignment,
  type StageMachineTransactionClient,
} from "@/modules/production/stages/stage-machine";

// Cliente de transaccion simulado: no abre ninguna conexion a PostgreSQL. Cubre las
// ramas de decision de la sincronizacion (crear, actualizar, reemplazar, borrar) y la
// obtencion del correlativo, que aqui responde con ultimo_numero = 0.
function createMockTx(
  asignacionesActuales: Array<{
    id_etapa_ruta_maquina: string;
    id_maquina: string;
  }> = [],
) {
  const etapaRutaMaquina = {
    findMany: vi.fn().mockResolvedValue(asignacionesActuales),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
  };

  const tx = {
    etapa_ruta_maquina: etapaRutaMaquina,
    $queryRaw: vi.fn().mockResolvedValue([
      {
        codigo_entidad: "etapa_ruta_maquina",
        prefijo: "ERM",
        ultimo_numero: 0,
      },
    ]),
    $executeRaw: vi.fn().mockResolvedValue(1),
  };

  return {
    tx: tx as unknown as StageMachineTransactionClient,
    etapaRutaMaquina,
  };
}

describe("syncStageMachineAssignment", () => {
  it("sin maquina y sin asignaciones previas no toca nada", async () => {
    const { tx, etapaRutaMaquina } = createMockTx([]);

    await syncStageMachineAssignment(tx, {
      idEtapaRuta: "ETA00000001",
      idMaquina: null,
      tiempoMaquina: null,
    });

    expect(etapaRutaMaquina.deleteMany).not.toHaveBeenCalled();
    expect(etapaRutaMaquina.create).not.toHaveBeenCalled();
    expect(etapaRutaMaquina.update).not.toHaveBeenCalled();
  });

  it("quitar la maquina borra la asignacion existente", async () => {
    const { tx, etapaRutaMaquina } = createMockTx([
      { id_etapa_ruta_maquina: "ERM00000001", id_maquina: "MAQ00000001" },
    ]);

    await syncStageMachineAssignment(tx, {
      idEtapaRuta: "ETA00000001",
      idMaquina: null,
      tiempoMaquina: null,
    });

    expect(etapaRutaMaquina.deleteMany).toHaveBeenCalledWith({
      where: { id_etapa_ruta: "ETA00000001" },
    });
    expect(etapaRutaMaquina.create).not.toHaveBeenCalled();
  });

  it("asignar una maquina por primera vez crea con correlativo ERM", async () => {
    const { tx, etapaRutaMaquina } = createMockTx([]);

    await syncStageMachineAssignment(tx, {
      idEtapaRuta: "ETA00000001",
      idMaquina: "MAQ00000001",
      tiempoMaquina: 6,
    });

    expect(etapaRutaMaquina.create).toHaveBeenCalledWith({
      data: {
        id_etapa_ruta_maquina: "ERM00000001",
        id_etapa_ruta: "ETA00000001",
        id_maquina: "MAQ00000001",
        tiempo_maquina_minutos_unidad: 6,
      },
    });
    expect(etapaRutaMaquina.deleteMany).not.toHaveBeenCalled();
  });

  it("mantener la misma maquina solo actualiza el tiempo", async () => {
    const { tx, etapaRutaMaquina } = createMockTx([
      { id_etapa_ruta_maquina: "ERM00000001", id_maquina: "MAQ00000001" },
    ]);

    await syncStageMachineAssignment(tx, {
      idEtapaRuta: "ETA00000001",
      idMaquina: "MAQ00000001",
      tiempoMaquina: 9.5,
    });

    expect(etapaRutaMaquina.update).toHaveBeenCalledWith({
      where: { id_etapa_ruta_maquina: "ERM00000001" },
      data: { tiempo_maquina_minutos_unidad: 9.5 },
    });
    expect(etapaRutaMaquina.create).not.toHaveBeenCalled();
    expect(etapaRutaMaquina.deleteMany).not.toHaveBeenCalled();
  });

  it("cambiar de maquina retira la anterior y crea la nueva", async () => {
    const { tx, etapaRutaMaquina } = createMockTx([
      { id_etapa_ruta_maquina: "ERM00000001", id_maquina: "MAQ00000001" },
    ]);

    await syncStageMachineAssignment(tx, {
      idEtapaRuta: "ETA00000001",
      idMaquina: "MAQ00000002",
      tiempoMaquina: 4,
    });

    expect(etapaRutaMaquina.deleteMany).toHaveBeenCalledWith({
      where: { id_etapa_ruta_maquina: { in: ["ERM00000001"] } },
    });
    expect(etapaRutaMaquina.create).toHaveBeenCalledWith({
      data: {
        id_etapa_ruta_maquina: "ERM00000001",
        id_etapa_ruta: "ETA00000001",
        id_maquina: "MAQ00000002",
        tiempo_maquina_minutos_unidad: 4,
      },
    });
    expect(etapaRutaMaquina.update).not.toHaveBeenCalled();
  });

  it("conserva la asignacion vigente cuando hay varias y solo retira las demas", async () => {
    // Escenario defensivo: si en el futuro se admiten varias maquinas, este es el
    // comportamiento que habria que relajar, y el test lo deja documentado.
    const { tx, etapaRutaMaquina } = createMockTx([
      { id_etapa_ruta_maquina: "ERM00000001", id_maquina: "MAQ00000001" },
      { id_etapa_ruta_maquina: "ERM00000002", id_maquina: "MAQ00000002" },
    ]);

    await syncStageMachineAssignment(tx, {
      idEtapaRuta: "ETA00000001",
      idMaquina: "MAQ00000002",
      tiempoMaquina: 7,
    });

    expect(etapaRutaMaquina.deleteMany).toHaveBeenCalledWith({
      where: { id_etapa_ruta_maquina: { in: ["ERM00000001"] } },
    });
    expect(etapaRutaMaquina.update).toHaveBeenCalledWith({
      where: { id_etapa_ruta_maquina: "ERM00000002" },
      data: { tiempo_maquina_minutos_unidad: 7 },
    });
    expect(etapaRutaMaquina.create).not.toHaveBeenCalled();
  });

  it("acepta tiempo nulo al asignar (dato aun no capturado)", async () => {
    const { tx, etapaRutaMaquina } = createMockTx([]);

    await syncStageMachineAssignment(tx, {
      idEtapaRuta: "ETA00000009",
      idMaquina: "MAQ00000003",
      tiempoMaquina: null,
    });

    expect(etapaRutaMaquina.create).toHaveBeenCalledWith({
      data: {
        id_etapa_ruta_maquina: "ERM00000001",
        id_etapa_ruta: "ETA00000009",
        id_maquina: "MAQ00000003",
        tiempo_maquina_minutos_unidad: null,
      },
    });
  });
});
