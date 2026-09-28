# HVT · Handy Vocal Translation

**Traducir diálogos y grabar las tomas de voz, todo en la misma tabla.**

Una app web de una sola página. Abres el vídeo, importas el SRT, reescribes el
diálogo por columnas, grabas cada línea y.exportas lo que hace falta para el
montaje: subtítulos, el audio ya colocado en su sitio y un índice de tomas.

Se usa en **<https://elraru.github.io/HVT/>**. Sin cuenta, sin instalación, sin
servidor: es HTML, CSS y JavaScript.

---

## Aviso: esto está vibeado

Lo ha escrito casi entera una IA a partir de instrucciones humanas. No es un
producto: es la herramienta que hacía falta para un trabajo concreto, publicada
por si a alguien más le viene bien.

- **No hay empresa detrás.** Lo mantiene una persona, en ratos libres.
- **Sin soporte.** Si algo falla, abre un issue. Si tienes una solución, mejor
  todavía.
- **Alpha de verdad.** La versión **2.3.1** es la primera que sale de mi máquina.
  La app tiene un arnés de pruebas propio, pero en 2.3.1 había partes —el
  final de una toma, entre otras— que solo se habían comprobado en ese arnés y
  no en un Chrome de verdad. Cada versión dice en sus notas lo que queda así.
- **No la pongas delante de un cliente.** Haz una copia de tu proyecto (`.hvt`)
  antes de experimentar.

Licencia MIT: úsala, cámbiala, haz con ella lo que quieras.

---

## Qué hace

**Texto**

- Columnas ilimitadas de tres tipos —adaptación, traducción bruta y original— con
  tres visibles a la vez. Se reordenan, se minimizan a una pestaña lateral y se
  pueden bloquear con 🔒 para no rozarlas.
- Contador de sílabas por columna, en español o inglés.
- Negrita, cursiva y personaje (`ANA: …`) con atajos de teclado.
- Una emoción por línea, con clic derecho sobre la adaptación, y un indicador
  en la barra.
- Importar y exportar SRT.

**Audio**

- Grabación por línea desde el navegador, con la waveform en vivo.
- Hasta tres tomas por línea; la elegida se marca con la estrella y es la que
  sale al exportar.
- La referencia (el vídeo) se ancla en la barra o se suelta en una ventana
  arrastrable que no se sale de la pantalla.
- La franja de arriba dibuja la waveform de la referencia, o la de lo grabado
  cuando no hay vídeo.
- Línea de tiempo con marcadores de diálogo y pistas.

**Transporte**

- **Recorrer**: ▶ suena las tomas línea a línea y la columna activa va
  siguiendo, para revisar el diálogo entero y parar donde hay que repetir.
- Repetir 1, 2, 3, 5, 10 o ∞ veces cada línea.
- Velocidad de 0,5× a 2×; por debajo de 1× **mantiene la altura de la voz**, que
  es lo que hace falta para juzgar cómo se pronuncia una frase.
- Respetar timecodes: esperar en silencio hasta el de la línea siguiente, que es
  como suena la mezcla final.
- ⏮ y ⏭ saltan a la línea anterior o siguiente **que tenga toma**.

**Salidas**

| Desde el menú Proyecto | Qué sale |
| --- | --- |
| Guardar `.hvt` | El proyecto entero: columnas, tiempos, emociones y audio incrustado |
| Guardar solo texto `.hvt` | Lo mismo sin los bytes de audio, para mandar el texto por correo |
| Exportar tabla `.md` | La tabla, para leer y comparar |
| Subtítulos `.srt` / `.vtt` | Para Premiere, Resolve, Subtitle Edit o un móvil |
| Audio del proyecto `.wav` | Cada toma ya colocada en su línea, con silencio en los huecos |
| Índice de tomas `.csv` | Una fila por toma, con su timecode y su personaje |

---

## Tus datos no salen de aquí

- El texto se autoguarda solo en tu navegador (`localStorage`), 700 ms después
  de cada cambio.
- **El audio nunca se sube a ningún sitio.** No hay servidor, ni cuentas, ni
  analítica, ni peticiones a terceros. Todo ocurre en la pestaña.
- Los archivos `.hvt`, `.wav` y `.csv` los genera tu navegador y los descargas
  tú.

Lo único que se descarga es la propia app desde GitHub Pages.

---

## Requisitos

- Un navegador actual: Chrome, Edge, Firefox o Safari.
- **Para grabar** hace falta un contexto seguro: o la URL de GitHub Pages, que ya
  es HTTPS, o servir la carpeta en `localhost`. Abriendo `index.html` con doble
  clic (`file://`) el navegador puede bloquear el micrófono, y la app lo avisa en
  vez de fallar en silencio.
- Permiso de micrófono. La referencia de audio y la de las tomas se gestionan por
  separado, así que puedes grabar sin cargar ningún vídeo.

---

## Cómo está montado

```
index.html      La página entera: barra, columnas, línea de tiempo, transporte
css/style.css   Todo el estilo
js/             11 módulos, cargados en orden con <script>
VERSION         La versión que se lee al arrancar y se muestra en la barra
```

No hay build, ni bundler, ni `node_modules`, ni dependencias. GitHub Pages
sirve el repositorio tal cual: la rama `main`, desde la raíz. Es exactamente lo
mismo que tienes en local si abres `index.html`.

El código viene de un monolito, `HVT_alpha.html`, que se partió en módulos sin
cambiar ni una línea de comportamiento. Ese archivo no se publica: se guarda
junto a su SHA-256 como base inmutable, y a partir de ahí ya sí se permiten
cambios reales.

El historial de cambios está en [CHANGELOG.md](CHANGELOG.md), en orden inverso.
Las decisiones —incluidas las que se tomaron descartando algo— están ahí
razonadas, que es la parte útil.

---

## Lo que no está aquí

Por decisión, el repositorio publica solo la app. El arnés de pruebas
(`tools/`), los scripts de trabajo local (`snapshot.sh`, `start.sh`) y los
respaldos de cada versión (`backups/`) se quedan en la máquina donde se
desarrolla. El `CHANGELOG` los menciona porque son parte de la historia, pero
aquí no se pueden abrir: no se suben.

---

## Licencia

MIT — ver [LICENSE](LICENSE).
