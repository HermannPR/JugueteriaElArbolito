// Prueba de la lista de fotos sugeridas. Correr desde web/: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { isSuggestionLevel, pairSuggestions } from "../src/lib/photo-suggestions.ts";

const producto = (sku, extra = {}) => ({ id: `p-${sku}`, eleventa_sku: sku, image_url: null, is_active: true, ...extra });

test("junta cada sugerencia con su producto por clave de Eleventa", () => {
  const pares = pairSuggestions([{ id: "s1", clave: "A" }, { id: "s2", clave: "B" }], [producto("B"), producto("A")]);
  assert.deepEqual(pares.map((p) => [p.suggestion.id, p.product.id]), [["s1", "p-A"], ["s2", "p-B"]]);
});

test("omite las que ya no sirven: sin producto, con foto o fuera de Eleventa", () => {
  const pares = pairSuggestions(
    [{ id: "s1", clave: "NO_EXISTE" }, { id: "s2", clave: "CON_FOTO" }, { id: "s3", clave: "INACTIVO" }, { id: "s4", clave: "OK" }],
    [producto("CON_FOTO", { image_url: "https://x/f.webp" }), producto("INACTIVO", { is_active: false }), producto("OK"), producto(null)]
  );
  assert.deepEqual(pares.map((p) => p.suggestion.id), ["s4"]);
});

test("varias sugerencias del mismo producto se muestran todas", () => {
  const pares = pairSuggestions([{ id: "s1", clave: "A" }, { id: "s2", clave: "A" }], [producto("A")]);
  assert.equal(pares.length, 2);
});

test("niveles válidos", () => {
  assert.equal(isSuggestionLevel("muy_alta"), true);
  assert.equal(isSuggestionLevel("media"), true);
  assert.equal(isSuggestionLevel("manual"), false);
  assert.equal(isSuggestionLevel(undefined), false);
});
