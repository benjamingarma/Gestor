"use client";

import { useActionState, useState } from "react";
import { Aviso } from "@/componentes/Aviso";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { nuevoUuid } from "@/lib/uuid";
import type { EstadoProducto } from "./acciones";

type Props = {
  accion: (previo: EstadoProducto, formulario: FormData) => Promise<EstadoProducto>;
  inicial?: { id: string; marca: string; modelo: string; precioGeneral: string; activo: boolean };
  textoBoton: string;
};

export function FormularioProducto({ accion, inicial, textoBoton }: Props) {
  const [estado, enviar, enviando] = useActionState(accion, {});
  const [id] = useState(() => inicial?.id ?? nuevoUuid());
  const v = estado.valores ?? inicial;

  return (
    <form action={enviar} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="id" value={id} />
      <Campo
        etiqueta="Marca"
        name="marca"
        defaultValue={v?.marca}
        autoCapitalize="words"
        autoComplete="off"
        required
        error={estado.errores?.marca}
        placeholder="Ej: Elfbar"
      />
      <Campo
        etiqueta="Modelo (con los puffs)"
        name="modelo"
        defaultValue={v?.modelo}
        autoComplete="off"
        required
        error={estado.errores?.modelo}
        placeholder="Ej: 5000"
      />
      <Campo
        etiqueta="Precio general de venta (opcional)"
        name="precioGeneral"
        inputMode="decimal"
        autoComplete="off"
        defaultValue={v?.precioGeneral}
        error={estado.errores?.precioGeneral}
        placeholder="Ej: 10.000"
        ayuda="En pesos. Se propone al vender si el cliente no tiene precio especial."
      />
      {inicial && (
        <label className="flex min-h-[52px] items-center gap-3 text-lg">
          <input type="checkbox" name="activo" defaultChecked={inicial.activo} className="h-6 w-6" />
          Producto activo (se puede comprar y vender)
        </label>
      )}
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <Boton type="submit" disabled={enviando}>
        {enviando ? "Guardando…" : textoBoton}
      </Boton>
    </form>
  );
}
