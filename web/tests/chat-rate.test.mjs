// Prueba del límite del chat (falla cerrado). Correr desde web/:
//   npm test   (node --test --experimental-strip-types tests/*.test.mjs)
// Los .ts que se prueban así no deben importar nada con alias "@/".
// (Node 22.6+; en Node 23.6+ la bandera ya no hace falta).
import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimitBlock } from "../src/lib/chat-rate.ts";

test("permitido: deja pasar", () => {
  assert.equal(rateLimitBlock(true, null), null);
});

test("límite alcanzado: 429", () => {
  const r = rateLimitBlock(false, null);
  assert.equal(r?.status, 429);
  assert.equal(r?.body.provider, "limit");
});

test("error de la RPC: 503 aunque traiga datos", () => {
  const r = rateLimitBlock(null, { message: "connection refused" });
  assert.equal(r?.status, 503);
  assert.match(r?.body.reply ?? "", /WhatsApp/);
  assert.equal(rateLimitBlock(true, { message: "x" })?.status, 503);
});

test("respuesta inesperada (undefined o null): 503", () => {
  assert.equal(rateLimitBlock(undefined, null)?.status, 503);
  assert.equal(rateLimitBlock(null, null)?.status, 503);
});
