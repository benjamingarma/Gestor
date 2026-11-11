import "server-only";
import { estadoVisita, type EstadoVisita } from "@/dominio/visitas";
import { crearClienteSupabase } from "@/lib/supabase/servidor";

type FilaVistaCliente = {
  cliente_id: string;
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  notas: string | null;
  intervalo_visita_dias: number;
  ultima_visita_inicial: string | null;
  archivado_en: string | null;
  fecha_alta: string;
  ultima_visita: string | null;
  ultima_visita_id: string | null;
  ultima_venta: string | null;
};

export type Cliente = {
  id: string;
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  notas: string | null;
  intervaloDias: number;
  archivado: boolean;
  fechaAlta: string;
  ultimaVisita: string | null;
  ultimaVisitaId: string | null;
  ultimaVenta: string | null;
  ultimaVisitaInicial: string | null;
  estado: EstadoVisita;
};

function aCliente(f: FilaVistaCliente, hoy: string): Cliente {
  const datos = {
    fechaAlta: f.fecha_alta,
    intervaloDias: f.intervalo_visita_dias,
    ultimaVisita: f.ultima_visita,
    ultimaVenta: f.ultima_venta,
    ultimaVisitaInicial: f.ultima_visita_inicial,
    archivado: f.archivado_en !== null,
  };
  return {
    id: f.cliente_id,
    nombre: f.nombre,
    telefono: f.telefono,
    direccion: f.direccion ?? null,
    notas: f.notas,
    intervaloDias: f.intervalo_visita_dias,
    archivado: datos.archivado,
    fechaAlta: f.fecha_alta,
    ultimaVisita: f.ultima_visita,
    ultimaVisitaId: f.ultima_visita_id,
    ultimaVenta: f.ultima_venta,
    ultimaVisitaInicial: f.ultima_visita_inicial,
    estado: estadoVisita(datos, hoy),
  };
}

export async function listarClientes(negocioId: string, hoy: string): Promise<Cliente[]> {
  const supabase = await crearClienteSupabase();
  const { data, error } = await supabase.from("v_clientes").select("*").eq("negocio_id", negocioId).order("nombre");
  if (error) throw new Error(`No se pudieron leer los clientes: ${error.message}`);
  return ((data ?? []) as FilaVistaCliente[]).map((f) => aCliente(f, hoy));
}

export async function obtenerCliente(negocioId: string, id: string, hoy: string): Promise<Cliente | null> {
  const supabase = await crearClienteSupabase();
  const { data, error } = await supabase
    .from("v_clientes")
    .select("*")
    .eq("negocio_id", negocioId)
    .eq("cliente_id", id)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el cliente: ${error.message}`);
  return data ? aCliente(data as FilaVistaCliente, hoy) : null;
}
