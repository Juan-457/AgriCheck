# AgriCheck

Sitio estático de AgriCheck para presentar agroinsumos especiales, productos destacados y páginas individuales por producto. El proyecto está compuesto únicamente por HTML y activos estáticos (imágenes y videos), sin dependencias ni paso de build.

## Contenido del repositorio

- `index.html`: página principal con secciones de presentación, beneficios y destacados.
- `nuestros-productos.html`: catálogo/marketplace para explorar productos.
- `Producto-*.html`: páginas individuales por producto (Beauvisan, Nomu Protec, Parka, Nexula, T-Gro Easy Flow, T-Gro WP, Tundrabac).
- Activos estáticos: imágenes (`.png`, `.webp`, `.jpg`) y videos (`.mp4`) utilizados en las páginas.

## Cómo verlo localmente

No se requieren dependencias. Abrí los archivos HTML en tu navegador:

```bash
# opción simple
open index.html
# o usando un servidor estático (opcional)
python3 -m http.server 8000
```

Luego visita `http://localhost:8000/index.html` si usás el servidor.

## Estructura sugerida para edición

- Para actualizar el contenido principal, editar `index.html`.
- Para sumar productos, agregar un nuevo `Producto-<nombre>.html` y enlazarlo desde `nuestros-productos.html`.
- Para actualizar imágenes, reemplazar los archivos en la raíz del repositorio (se referencian por ruta relativa).

## Tecnologías

- HTML5 + CSS embebido.
- Fuentes servidas desde Google Fonts.
- Recursos estáticos locales para imágenes y videos.


## Actualización automática de Instagram (RSS.app)

El repositorio actualiza `assets/ig-posts.json` desde un feed RSS mediante el workflow `.github/workflows/update-ig.yml` (cada 6 horas y manual).

Requisitos:

1. Crear el secret `IG_RSS_URL` en `Settings → Secrets and variables → Actions` (ejemplo: `https://rss.app/feeds/...xml`).
2. Habilitar `Settings → Actions → General → Workflow permissions → Read and write permissions` para permitir el commit automático del JSON.

Si `IG_RSS_URL` no está configurado, el workflow muestra un warning y omite la actualización.


## Fuente JSON para RAG de productos

Se incluye un generador de conocimiento en `assets/rag-products.json` con datos normalizados del catálogo (`nuestros-productos.html`) y del sitio institucional (`index.html`).

Incluye:

- por cada producto: nombre, descripción, cultivos, problemáticas, tags de búsqueda,
- **link relativo y absoluto al sitio** (`relative_url` y `absolute_url`),
- metadatos básicos de la página del producto,
- bloque `company` con información de AgriCheck (historia, resumen institucional, contacto, redes y marcas representadas),
- bloque `sellers` con vendedores por zona (región, contactos, teléfonos, email y link de WhatsApp).

Para regenerarlo:

```bash
node scripts/build-rag-products.mjs
# opcional: definir dominio base para links absolutos
AGRICHECK_BASE_URL="https://tu-dominio.com" node scripts/build-rag-products.mjs
```

### Frecuencia de actualización

- Manual: cuando se ejecuta el script localmente.
- Automática (GitHub Actions): todos los días a las **03:00 AM de Argentina (ART)** mediante `.github/workflows/update-rag-products.yml` (cron UTC: `0 6 * * *`).
