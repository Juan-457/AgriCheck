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
