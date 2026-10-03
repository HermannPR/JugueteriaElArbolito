// Prueba de la selección de "Publicar todos los listos". Correr desde web/: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { chunk, isReadyToPublish, productStage } from "../src/lib/catalog-status.ts";

const listo = {
  is_active: true,
  is_approved: false,
  is_blocked: false,
  image_url: "https://x/foto.webp",
  category_id: "c1",
  price: 199,
};

test("listo: foto, categoría, precio, activo, sin publicar ni bloquear", () => {
  assert.equal(isReadyToPublish(listo), true);
  assert.equal(productStage(listo).label, "Listo para publicar");
});

test("no se publica si falta algo o ya no aplica", () => {
  const casos = {
    sin_foto: { ...listo, image_url: null },
    sin_categoria: { ...listo, category_id: null },
    precio_cero: { ...listo, price: 0 },
    ya_publicado: { ...listo, is_approved: true },
    bloqueado: { ...listo, is_blocked: true },
    no_en_eleventa: { ...listo, is_active: false },
  };
  for (const [nombre, p] of Object.entries(casos)) {
    assert.equal(isReadyToPublish(p), false, nombre);
  }
});

test("coincide con la etiqueta del panel en todos los casos", () => {
  for (const image_url of [null, "u"])
    for (const category_id of [null, "c"])
      for (const price of [0, 10])
        for (const is_approved of [false, true])
          for (const is_blocked of [false, true])
            for (const is_active of [false, true]) {
              const p = { image_url, category_id, price, is_approved, is_blocked, is_active };
              assert.equal(isReadyToPublish(p), productStage(p).label === "Listo para publicar", JSON.stringify(p));
            }
});

test("chunk parte en grupos sin perder elementos", () => {
  const ids = Array.from({ length: 450 }, (_, i) => i);
  const partes = chunk(ids, 200);
  assert.deepEqual(partes.map((p) => p.length), [200, 200, 50]);
  assert.deepEqual(partes.flat(), ids);
  assert.deepEqual(chunk([], 200), []);
});
