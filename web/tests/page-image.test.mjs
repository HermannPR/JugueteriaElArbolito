// Prueba de "Importar desde liga" con la página del producto. Correr desde web/: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { findPageImage } from "../src/lib/page-image.ts";

const base = "https://www.mialegria.com.mx/products/telescopio";

test("toma og:image (caso real de Mi Alegría)", () => {
  const html = `<head><meta property="og:image" content="http://acdn-us.mitiendanube.com/stores/007/686/076/products/2514_1-cf45-640-0.webp"></head>`;
  assert.equal(findPageImage(html, base), "http://acdn-us.mitiendanube.com/stores/007/686/076/products/2514_1-cf45-640-0.webp");
});

test("atributos en cualquier orden, comillas simples y entidades", () => {
  const html = `<meta content='https://cdn.x.com/a.jpg?w=800&amp;h=800' property='og:image' />`;
  assert.equal(findPageImage(html, base), "https://cdn.x.com/a.jpg?w=800&h=800");
});

test("prefiere secure_url y resuelve rutas relativas", () => {
  const html = `<meta property="og:image" content="http://x.com/a.jpg"><meta property="og:image:secure_url" content="/cdn/a.jpg">`;
  assert.equal(findPageImage(html, base), "https://www.mialegria.com.mx/cdn/a.jpg");
});

test("respaldo: twitter:image y link image_src", () => {
  assert.equal(findPageImage(`<meta name="twitter:image" content="https://x.com/t.png">`, base), "https://x.com/t.png");
  assert.equal(findPageImage(`<link rel="image_src" href="//cdn.x.com/l.png">`, base), "https://cdn.x.com/l.png");
});

test("sin foto declarada o con esquema raro: null", () => {
  assert.equal(findPageImage("<html><body><img src='a.jpg'></body></html>", base), null);
  assert.equal(findPageImage(`<meta property="og:image" content="javascript:alert(1)">`, base), null);
  assert.equal(findPageImage(`<meta property="og:image" content="">`, base), null);
});
