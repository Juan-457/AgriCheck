# AgriCheck

Sitio estatico de AgriCheck para presentar productos, catalogo y contenidos tecnicos del portfolio agro.

## Contenido

- `index.html`: home principal.
- `nuestros-productos.html`: catalogo de productos.
- `Producto-*.html`: fichas individuales por producto.
- `assets/`: JSONs y recursos auxiliares generados automaticamente.
- `scripts/rss-to-ig-json.mjs`: actualizacion de feed de Instagram desde RSS.
- `scripts/build-rag-products.mjs`: generacion del JSON para RAG de productos.
- `PROMPT_AGRIBOT_N8N.md`: contexto auxiliar relacionado con automatizacion.

## Stack

- Sitio HTML estatico
- JavaScript vanilla
- Un script Node para tareas auxiliares

`package.json` se usa solo para tooling del feed de Instagram y tareas de datos.

## Verlo localmente

```bash
cd AgriCheck
python3 -m http.server 8000
```

## Scripts utiles

```bash
npm install
npm run update:ig-posts
node scripts/build-rag-products.mjs
```

## Automatizaciones

- Actualizacion del feed de Instagram via GitHub Actions.
- Generacion de `assets/rag-products.json` para uso en busqueda o asistentes.

## Deploy

El sitio se sirve como estatico. Conservar:

- `CNAME`
- `assets/`
- workflows de GitHub si se quiere mantener la automatizacion
