"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface Props {
  currentOrden?: string;
}

export default function SortSelect({ currentOrden }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) params.set("orden", e.target.value);
    else params.delete("orden");
    params.delete("pagina");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      className="text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
      value={currentOrden ?? ""}
      onChange={handleChange}
    >
      <option value="">Relevancia</option>
      <option value="precio_asc">Precio: menor a mayor</option>
      <option value="precio_desc">Precio: mayor a menor</option>
      <option value="nuevos">Más nuevos</option>
    </select>
  );
}
