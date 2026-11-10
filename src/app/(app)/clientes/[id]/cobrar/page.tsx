import { notFound, redirect } from "next/navigation";
import { esUuid } from "@/lib/uuid";

/** Ruta vieja del cobro (antes del módulo 1.7): ahora el cobro está en /cobrar/[cliente]. */
export default async function PaginaCobrarVieja({ params, searchParams }: PageProps<"/clientes/[id]/cobrar">) {
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const { importe, venta } = await searchParams;
  const q = new URLSearchParams();
  if (typeof importe === "string") q.set("importe", importe);
  if (typeof venta === "string") q.set("venta", venta);
  redirect(`/cobrar/${id}${q.size ? `?${q}` : ""}`);
}
