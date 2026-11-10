import type { InputHTMLAttributes, ReactNode } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  etiqueta: string;
  error?: string;
  ayuda?: ReactNode;
};

/** Campo de formulario grande, con su etiqueta, ayuda y error. */
export function Campo({ etiqueta, error, ayuda, id, name, className = "", ...props }: Props) {
  const idCampo = id ?? name;
  return (
    <label htmlFor={idCampo} className="flex flex-col gap-1">
      <span className="text-[0.85rem] font-semibold">{etiqueta}</span>
      <input
        id={idCampo}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${idCampo}-error` : undefined}
        {...props}
        className={`min-h-[50px] rounded-[14px] border bg-superficie px-3.5 text-lg ${error ? "border-peligro" : "border-borde"} ${className}`}
      />
      {ayuda && !error && <span className="text-[0.82rem] leading-snug text-texto-suave">{ayuda}</span>}
      {error && (
        <span id={`${idCampo}-error`} className="text-[0.82rem] text-peligro">
          {error}
        </span>
      )}
    </label>
  );
}
