import "server-only";
import { listarClientes } from "@/datos/clientes";
import { deudasMasViejas, listarSaldos } from "@/datos/cuentas";
import { diasEntre } from "@/lib/fechas";
import type { ClienteParaCobrar } from "./ListaQuienDebe";

/** Lista de quién debe (de mayor a menor) y todos los clientes para el buscador de Cobrar. */
export async function datosQuienDebe(negocioId: string, dia: string) {
  const [saldos, clientes] = await Promise.all([listarSaldos(negocioId), listarClientes(negocioId, dia)]);
  const conDeuda = saldos.filter((s) => s.saldo > 0);
  const masViejas = await deudasMasViejas(negocioId, conDeuda.map((s) => s.cliente_id));
  const saldoDe = new Map(saldos.map((s) => [s.cliente_id, s.saldo]));
  const aFila = (id: string, nombre: string): ClienteParaCobrar => {
    const masVieja = masViejas.get(id);
    return { id, nombre, saldo: saldoDe.get(id) ?? 0, diasDeudaMasVieja: masVieja ? diasEntre(masVieja, dia) : null };
  };
  const deudores = conDeuda.map((s) => aFila(s.cliente_id, s.nombre)); // listarSaldos ya viene de mayor a menor
  // Buscador: clientes activos y también los archivados que todavía tienen saldo.
  const activos = clientes.filter((c) => !c.archivado).map((c) => aFila(c.id, c.nombre));
  const ids = new Set(activos.map((c) => c.id));
  const todos = [...activos, ...saldos.filter((s) => !ids.has(s.cliente_id)).map((s) => aFila(s.cliente_id, s.nombre))];
  const totalDeuda = conDeuda.reduce((t, s) => t + s.saldo, 0);
  return { deudores, todos, totalDeuda };
}
