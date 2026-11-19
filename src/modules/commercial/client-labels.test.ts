import { describe, expect, it } from "vitest";

import {
  CLIENT_TYPE_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
  getClientTypeFilterOptions,
  getClientTypeLabel,
  getDocumentTypeLabel,
} from "@/modules/commercial/client-labels";
import { clientSchema } from "@/schemas/commercial/client.schema";

// C2 del grupo de fixes (D124 y D125): un solo lugar para el texto del tipo de cliente y del tipo de
// documento.
describe("textos del cliente de Comercial", () => {
  it("da el texto de cada valor conocido", () => {
    expect(getClientTypeLabel("cliente_final")).toBe("Cliente final");
    expect(getClientTypeLabel("ferreteria")).toBe("Ferretería");
    expect(getDocumentTypeLabel("ruc")).toBe("RUC");
    expect(getDocumentTypeLabel("dni")).toBe("DNI");
  });

  it("muestra tal cual un valor que no conoce, nunca vacio", () => {
    expect(getClientTypeLabel("empresa")).toBe("empresa");
    expect(getDocumentTypeLabel("pasaporte")).toBe("pasaporte");
  });

  // Las listas ofrecen exactamente lo que acepta el esquema: un valor que falte se veria como se
  // guarda y uno de mas filtraria por algo que nadie puede guardar.
  it("ofrecen los mismos valores que acepta el esquema", () => {
    const values = (options: readonly (readonly [string, string])[]) => options.map(([value]) => value);
    const documentOptions = clientSchema.shape.tipo_documento.def.options[0].unwrap().options;

    expect([...values(CLIENT_TYPE_OPTIONS)].sort()).toEqual([...clientSchema.shape.tipo_cliente.options].sort());
    expect(values(DOCUMENT_TYPE_OPTIONS)).toEqual(documentOptions);
  });

  it("el filtro ofrece la lista entera y despues los tipos guardados que no conoce", () => {
    expect(getClientTypeFilterOptions(["persona", "ferreteria", "empresa", "persona", ""])).toEqual([
      { value: "cliente_final", label: "Cliente final" },
      { value: "ferreteria", label: "Ferretería" },
      { value: "distribuidora", label: "Distribuidora" },
      { value: "constructora", label: "Constructora" },
      { value: "otro", label: "Otro" },
      { value: "empresa", label: "empresa" },
      { value: "persona", label: "persona" },
    ]);
  });
});
