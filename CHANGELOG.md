# Changelog

Historial completo de HVT, de la más reciente a la más antigua. Formato basado en
SemVer.

> **Sobre este archivo.** Se reordenó y se limpiaron duplicados al publicar el
> repositorio por primera vez: las versiones estaban en orden mezclado y varias
> aparecían dos veces, una con la descripción completa y otra con la nota
> automática del respaldo. Se conservó siempre la versión larga y se quitó la
> corta. El contenido no se ha tocado.
>
> El monolito `HVT_alpha.html` es la base inmutable y nunca se modifica: su hash
> se guarda en `HVT_alpha.sha256`. Las revisiones se respaldan en `backups/`, que
> es local y no se publica, así que aquí no se citan las rutas.
>
> `tools/` tampoco se publica: el arnés de pruebas se queda en la máquina donde
> se desarrolla. Se nombra en las notas porque forma parte de la historia.

---

## 2.3.1

Pilar 2, punto 1. La primera herramienta para **revisar** de verdad, no solo para
grabar.

Nuevo
- **Recorrer**: un botón en la barra de transporte. Con él encendido, ▶ suena la
  toma de cada línea, una detrás de otra, y la columna activa va siguiendo sola.
  Es el gesto que faltaba: escuchar el diálogo entero del principio al final y
  parar en la línea que hay que repetir, sin darle a ▶ trescientas veces.
- **Repetir**: 1, 2, 3, 5, 10 o ∞ veces cada línea antes de pasar a la siguiente.
  Para una línea difícil no hace falta pararla a mitad, volver atrás y
  escucharla otra vez: se repite sola.
- **Velocidad**: de 0,5× a 2×, en pasos de 0,75×, 0,9×, 1,1×, 1,25× y 1,5×. A
  menos de 1× **mantiene la altura de la voz**: sin eso, 0,5× suena a dibujo
  animado y no sirve para juzgar cómo se pronuncia una frase.
- **Respetar timecodes**: de normal las tomas se encadenan sin dead air, que es
  lo que hace falta para revisar. Con la casilla, se espera en silencio hasta el
  timecode de la línea siguiente, que es como suena la mezcla final.
- **⏮ y ⏭**: saltan a la línea anterior o siguiente **que tenga toma**. Si la
  línea activa no tiene nada grabado, van a la más cercana por tiempo en esa
  dirección, que es lo que se busca al revisar: la toma de al lado que exista.

Decisiones
- **El recorrido va apagado de serie.** No se cambia lo que ya funcionaba: sin
  pulsar nada, ▶ sigue controlar el video de referencia, y si no hay video, la
  toma de la línea activa.
- **Las líneas sin toma se saltan.** En un recorrido no hay nada que escuchar, y
  pararse en silencio a media revisión sin avisar es peor que saltársela.
- **Con video de referencia cargado, manda el recorrido.** ▶ y ⏸ lo gobiernan
  como hasta ahora; para escuchar las tomas hay que encender Recorrer, y entonces
  la referencia se calla y la cabecera sigue a la toma. Sin esto, quien tiene un
  video cargado no podía recorrer sus tomas: era imposible.
- **Nada se guarda.** Ni la velocidad, ni el número de repeticiones, ni si
  Recorrer estaba encendido. Es un mando de esta sesión, como el volumen. Lo que
  se guarda en el proyecto es el trabajo, no cómo estabas mirando.

Arreglado
- **Escuchar ensuciaba el proyecto.** `setActiveLine` marcaba el archivo como
  modificado cada vez que cambiaba la línea activa, y el recorrido la cambia
  sola: veinte líneas revisadas y el proyecto pedía guardar sin haber escrito
  nada. Ahora el recorrido mueve la columna activa sin marcar el proyecto, que es
  lo que corresponde: oír no es editar.
- **El recorrido se paraba solo.** La línea activa la cambia también el
  `render` y el clic, y cada uno de esos momentos lo paraba. Ahora cualquier
  toque del usuario lo detiene, a propósito, y no lo reanuda por su cuenta: si
  eliges otra línea es porque quieres esa.
- **La cabecera se quedaba clavada en el silencio.** Entre toma y toma hay un
  instante en el que no suena nada; el bucle de `requestAnimationFrame` lo leía
  como «pausado» y se moría en el primer frame, dejando la cabecera a medias
  justo donde se debería ver el hueco.
- **«Transporte controlando: peli.mp4» se llevaba por delante el texto de ayuda**
  de la fila, que ya no volvía a aparecer. Ese aviso es de un momento: ahora va
  a la barra de estado, donde cualquier otro mensaje lo sustituye igual.

Notas
- 90 aserciones nuevas (256 en el arnés de transporte, 543 en total con las 12
  externas del WAV).
- Las pruebas validaron el recorrido rompiendo el código a propósito cinco veces:
  dejar `sinAudio` sin vigilar, devolver la línea activa sin `sinMarcar`, apagar
  el vídeo al empezar el recorrido, no reiniciar `ended` entre tomas y quedarse
  sin `preservesPitch` en el stub de `Audio` — que si no, `applySpeed()` creía
  que ningún navegador conserva la altura de la voz y la prueba pasaba de mentira.
- Sigue sin probarse en un navegador de verdad: el `ended` se dispara a mano en
  el arnés. Es lo que se puede comprobar sin abrir nada, y conviene sentarlo una
  vez en un Chrome antes de confiar en el sonido.

---

## 2.2.1

Pilar 1, punto 3. Con esto se acaba el primer pilar: los datos salen.

Nuevo
- Menú Proyecto → **Guardar solo texto .hvt**: el mismo proyecto sin los bytes de
  audio. El texto de todas las columnas, los timecodes, los personajes, las
  emociones, qué línea tenía toma, cuánto duraba, la fuente y el idioma se
  guardan igual. Solo faltan los samples. La barra de estado dice el tamaño que
  pesa y el que pesaba con audio, que es el número que convence.
- El archivo se llama `...-texto.hvt`, para que no se confunda con el otro.

Arreglado
- **Abrir un proyecto sin audio perdía las tomas.** `applyProject` hacía
  `filter(t => t && t.data)`, así que una toma sin sonido desaparecía del todo. Y
  como el final de la línea de tiempo se calcula con la duración de las tomas,
  al abrir un `.hvt` de texto **todo lo de detrás se movía hacia atrás**: los
  timecodes dejaban de caer donde caían. Ahora la toma se conserva como marcador
  (`sinAudio`), con su duración, y la línea de tiempo mide lo mismo que antes de
  cerrar el proyecto.
- El proyecto cuenta cuántas tomas vinieron mudas y **lo avisa en el título de la
  pestaña**, con «(sin audio)» delante de todo. Va en el título y no solo en la
  barra de estado porque la barra se pisa con la siguiente acción, y a los dos
  minutos ya nadie se acuerda de que el proyecto venía callado.
- `audioOmitted` queda escrito en el archivo, también cuando sí lleva audio. Un
  `.hvt` viejo que no lo traiga se trata como si lo llevara, que es lo que pasaba
  antes de que existiera el modo texto.

Refactor
- El texto del título lo compone ahora `projectTitle()` en `utils.js`, y
  `updateDirtyTitle()` solo lo pone en `document.title`. Estaba escrito dentro de
  `render.js`, que los arneses de pruebas no pueden cargar, así que
  `tools/domstub.js` tenía **su propia copia** para poder probarlo. Las dos se
  fueron por caminos distintos sin que nada lo notara: la copia del arnés no
  enseñaba el «(sin audio)» y la prueba pasaba igual porque probaba la copia.

Notas
- 46 aserciones nuevas, 441 en total.
- Las pruebas de esta versión se validaron rompiendo el código a propósito cuatro
  veces: volver a tirar las tomas mudas, perder su duración, no marcar el archivo
  y dejar pasar el base64 cacheado. Las cuatro se detectan. La última ya la
  cubría una prueba que había escrito sin querer al principio.

---

## 2.1.1

Pilar 1, punto 2. Ya no hace falta llevar el audio a otra parte a mano.

Nuevo
- Menú Proyecto → **Audio del proyecto .wav**: un solo archivo con cada toma
  colocada en el momento de su línea y **silencio en los huecos**, a la duración
  completa del proyecto. Se importa en el editor de vídeo y la imagen ya está en
  su sitio, sin nada que ir ajustando a ojo.
- Menú Proyecto → **Índice de tomas .csv**: una fila por toma con su timecode de
  destino, su duración, su personaje y su texto. Sin audio, se lee en un segundo.
  Lleva el BOM del principio para que Excel lo abra como UTF-8 y los acentos no
  salgan Rare characters.

Detalles que importan
- **No se recorta ni una muestra.** Si una toma se saliera por el final del
  proyecto, el archivo se estira en vez de cortarla. Es lo pedido: nada de audio
  perdido.
- El WAV es **PCM de 16 bits sin comprimir**. Pesa lo que pesa, pero lo que
  suena dentro es lo mismo que sonaba aquí. Con FLAC o MP3 se ahorraría sitio a
  costa de perder fidelidad, que no es el objetivo.
- 5 ms de entrada y de salida en cada toma. No es para "suavizar": es que una
  grabación pegada sobre silencio en seco da un chasquido. Solo toca el primer y
  el último sample de cada borde.
- Si **dos tomas se pisan**, su suma puede pasar de 1.0 y en 16 bits eso recorta.
  Se baja el nivel de todo lo justo para que no recorte, y **se dice en la barra de
  estado** en vez de hacerlo a escondidas.
- Una línea **sin toma** es silencio en su sitio, no un error. Se cuenta al final.
- Las duraciones se miden al decodificar, no de las guardadas: si el navegador
  todavía no ha medido una grabación, la del hueco de la línea es solo una
  estimación y no sirve para decidir cuánto dura el archivo.
- Se reutiliza la caché de la franja de referencia. Si la onda ya está dibujada,
  esas grabaciones ya están decodificadas y no se repite el trabajo.
- Tope de 250 MB, por encima del cual se avisa en vez de dejar morir la pestaña.

Arreglado
- `downloadTextFile()` y la descarga de audio compartían el mismo dance de
  `Blob` + `createObjectURL` + `click`; ahora las dos pasan por `downloadBlob()`.
- Se habían quedado **tres funciones auxiliares duplicadas** en
  `tools/menu-tests.js`: la segunda ganaba sobre la primera y no se notaba.

Notas
- Nuevo paso 7 en `check.sh`: el WAV que genera la app, **abierto por un
  decodificador de verdad** (`afinfo` de macOS y el módulo `wave` de Python). Las
  pruebas anteriores leían la cabecera con el mismo código que la escribía, así
  que si el formato estuviera mal, las dos cosas estarían mal a la vez. Además
  comprueba que el silencio esté **exactamente** donde debe, con ceros y no con
  ruido bajísimo.
- Ese paso se validó rompiendo el código a propósito cinco veces (amplitud a la
  mitad, sin recortar picos, bytes por muestra mal, canales mal, frecuencia mal):
  las pilla cuatro. La quinta la cubre `transport-tests.js`, porque ni `afinfo` ni
  el módulo `wave` miran ese campo. Las dos pruebas se necesitan.
- `tools/lint-comments.py` añade tres reglas más: **texto en chino,
  japonés o coreano** (se me coló varias veces al escribir comentarios, y no
  rompe nada, así que ningún otro aviso lo pilla; ahora mira también los `.sh`) y
  **funciones declaradas dos veces en el mismo archivo** (el verificador de
  sintaxis pasa los módulos por `new Function`, y ahí dos `function` con el mismo
  nombre no son error: la segunda gana y la primera queda muerta).
- 36 aserciones nuevas y 12 comprobaciones externas. 392 en total.

---

## 2.0.1

Empieza el salto grande. Pilar 1, punto 1: que los datos salgan de aquí.

Nuevo
- Exportar subtítulos en **SRT** y **VTT** desde el menú Proyecto. Es lo primero
  que hace falta para que el trabajo sirva: hasta ahora lo único que salía era una
  tabla Markdown para leer, y ahora hay un archivo que se abre en Premiere, en
  Resolve, en Subtitle Edit o en un móvil.
- Se exporta la columna que se está reescribiendo: la primera adaptación activa y,
  si no hay, la traducción bruta o el original. La barra de estado dice de qué
  columna salió el archivo.

Detalles que importan
- El texto se aplana a una sola línea. Los SRT y VTT separan los bloques con una
  línea en blanco, así que un salto dentro del texto partiría el bloque en dos y el
  lector lo descifraría mal.
- Las líneas se exportan ordenadas por tiempo de inicio. Una línea añadida a mano
  puede haber quedado fuera de sitio.
- Se omiten las líneas vacías y las que no tienen timecode válido, y se cuenta
  cuántas han quedado fuera para no exportar un archivo con huecos en silencio.
- El personaje se antepone (`ANA: texto`) solo si la línea lo tiene.
- Numeración correlativa: al saltarse una línea vacía, la siguiente no arrastra un
  número fantasma.
- El VTT lleva cabecera `WEBVTT` y punto en los milisegundos; el SRT, coma.

Arreglado
- Espaces dobles en el texto exportado cuando la línea tenía saltos en blanco por
  medio.
- Huecos en la numeración de los subtítulos al omitir una línea vacía.

Notas
- 36 aserciones nuevas sobre el export, incluida una de ida y vuelta: lo que sale
  vuelve a entrar por `parseSrt` con los timecodes y el texto intactos, tanto en
  SRT como en VTT. 356 en total.
- `js/ui.js` pasa a usar `downloadTextFile()` para la descarga, en vez de repetir
  el dance de `Blob` + `createObjectURL` + `click` en cada sitio.
- `tools/lint-comments.py` avisa de que su conteo es a ciegas y cuenta también los
  `/*` y `*/` de dentro de cadenas y expresiones regulares; dos regex nuevas
  (.replace) dispararon ese falso positivo y se reescribieron sin él.
- 2.0.1 es el mismo contenido que 2.0.0: el número de versión se sube después de
  publicar, como en las revisiones anteriores.

---

## 1.9.1

Nuevo
- Pin de anclaje en el extremo derecho de la barra, junto a la referencia.
- Anclada, la referencia es una miniatura de 74×34 en la propia barra. Suelta
  (pin pulsado), es una ventana de 330×186 que se lleva a donde quieras desde el
  grip de arriba. Al volver a anclarla se queda donde la dejaste, y si esa
  esquina quedó fuera de pantalla la recoge al entrar.
- La ventana no se deja salir de la pantalla por ningún borde.
- Los controles de reproducción del `<video>` solo se activan cuando la
  referencia está suelta: en la miniatura no caben y solo estorban.

Cambiado
- La referencia vuelve a estar dentro de la barra (como elemento), en vez de
  anclada a la esquina con `position:fixed`. El estado suelto sigue siendo
  `position:fixed`, así que al soltarla la barra no crece.
- Fuera «Flotar la referencia» del menú Fuentes: el pin es ese control, y dos
  botones para el mismo estado era justo el desorden que se quería quitar.
- El marcador dePin refleja el estado con `aria-pressed` y su `title` dice lo que
  hará en el siguiente clic, no lo que ya hizo.

Notas
- 35 aserciones nuevas sobre el anclaje y el arrastre (`tools/test-dock.sh`),
  320 en total.
- `eq` pasa a estar en `tools/domstub.js` en vez de estar copiado en cada archivo
  de pruebas: se había desincronizado una copia hasta el punto de no compilar.
- Se corrigen dos fallo del arnés que daban falsos verdes: `window.addEventListener`
  no guardaba el escuchador, y `offsetLeft`/`offsetTop` siempre valían 0, así que
  el arrastre no se podía comprobar.
- Guardas nuevas en `check.sh`: el pin y la referencia tienen que estar en la
  barra, el pin a la izquierda de la referencia, y `btnFloat` no puede volver.
- 1.9.1 es el mismo contenido que 1.9.0.

---

## 1.8.3

Arreglado
- «+ Línea» no se encontraba. Estaba en el transporte, dentro del panel inferior,
  que se plaga con «▾ panel»: con el panel plegado, el botón desaparecía entero.
  Pasa a la barra de estado, junto a «Línea activa», que no se pliega nunca y es
  donde la acción ya tiene contexto.

Notas
- Nueva guarda en `check.sh`: `#btnAddCue` y `#btnToggleBottom` tienen que estar
  en la barra de estado, y `#btnAddCue` no puede aparecer dentro de
  `#timelinePanel` ni de `#refStripWrap`.
- 1.8.3 es el mismo contenido que 1.8.2.

---

## 1.8.1

Nuevo
- La barra de arriba pasa a ser una barra de título de una línea: marca a la
  izquierda, cuatro menús y el selector de idioma. Antes eran 18 botones con marco,
  11 etiquetas sueltas y dos filas.
- Menú **Fuentes**: video/audio local, flotar la referencia, cargar SRT.
- Menú **Añadir columna**: adaptación, traducción bruta u original.
- Menú **Proyecto**: nuevo, abrir, guardar y exportar.
- Menú **Edición**: negrita, cursiva y personaje.
- Abrir un menú cierra los demás, el botón se queda resaltado mientras su panel
  está abierto, y se cierra solo al elegir una opción. Los cuatro menús usan un
  único manejador (`TOGGLES` en `js/ui.js`) en vez de cuatro cableados sueltos.
- Negrita y cursiva se apagan cuando no hay texto seleccionado, en vez de avisar
  con un `alert` al no hacer nada.
- La versión se lee de `VERSION` y aparece junto a la marca. Si no se puede leer
  (en `file://` no hay `fetch`), se queda en blanco sin molestar.
- La referencia es ahora un panel flotante anclado a la esquina, y se puede
  arrastrar desde la parte de arriba cuando está en grande.
- `aria-expanded` en los cuatro botones de menú, para lectores de pantalla.

Cambiado
- La referencia ya no vive en la barra: flotando, la barra se queda en una línea y
  la franja de waveform conserva su eje. Anclado y flotante son los dos estados
  fijos que ya distinguía el botón "Flotar".
- «+ Línea» pasa de la barra al transporte, que es donde se trabaja con líneas.
- El texto «Clic derecho en una adaptación = asignar emoción» baja a su propia
  línea, en gris, en vez de competir con los botones.

Arreglado
- El botón «Flotar la referencia» decía siempre lo mismo; ahora alterna entre
  «Flotar» y «Anclar» y se marca cuando está en grande.

Notas
- 31 aserciones nuevas sobre los menús (`tools/test-menus.sh`), 285 en total.
- Dos guardas nuevas en `check.sh`: los botones de menú deben llevar
  `aria-expanded` en el HTML, y `sources.js`/`columns.js` no pueden volver a
  cablear su propio botón de menú.
- 1.8.1 es el mismo contenido que 1.8.0: el número de versión se sube después de
  publicar, como en las revisiones anteriores.

---

## 1.7.1

Arreglado
- La cabecera ya avanza al reproducir una toma. `▶` no movía nada porque el bucle
  de reproducción solo lo arrancaba el evento `play` del `<video>`, que aquí no
  existe; ahora `tlPlay` lo arranca también.
- Al terminar una toma, la cabecera se queda en su sitio. Antes se quedaba a medio
  camino porque nadie la fijaba al acabar.
- La cabecera de la franja de arriba seguía al `<video>` aunque lo que sonase fuera
  una toma; ahora sigue a lo que esté sonando de verdad.
- La cabecera superior ya no pasa por un porcentaje (multiplicar por 100 y dividir
  entre 100), lo que perdía precisión y la dejaba unos píxeles fuera de sitio.

Nuevo
- Cuando no hay referencia, la franja de arriba dibuja la waveform de lo grabado,
  colocada sobre el mismo eje temporal que la línea de tiempo de abajo. La waveform
  de la referencia tiene prioridad si la hay.
- Las tomas se decodifican con `decodeAudioData` y se cachean por id. Si el navegador
  no puede decodificar el formato, se dibuja un bloque atenuado con su duración, para
  que se vea igualmente qué se ha grabado y cuándo.
- La franja de arriba se pliega con el botón `▾` de su tirador, además del doble
  clic de siempre, y el estado se guarda con el proyecto (`ui.refStripCollapsed`).
  Arrastrando el tirador se sigue pudiendo cambiar el alto.
- La franja y la línea de tiempo comparten margen (14 px) y total, así que un mismo
  segundo cae en el mismo píxel en las dos.

Notas
- 93 aserciones de transporte, franja y paneles (antes 49); 254 en total.
- 1.7.1 es el mismo contenido que 1.7.0: el numero de version se sube despues de
  publicar, como en las revisiones anteriores.

---

## 1.6.0

### Añadido
- **El audio se reproduce sin video de referencia.** El transporte ya no está
  atado al video: si no hay ninguno cargado, reproduce la toma elegida de la
  línea activa, así que se puede escuchar lo grabado sin cargar nada. Si no hay
  toma tampoco, el aviso dice las dos opciones en vez de solo "carga un video".
- **Panel inferior retractable**, con un botón `▾ panel` / `▴ panel` en la barra
  de estado. Plegado se van la waveform de referencia y la línea de tiempo, y las
  columnas —que son `flex:1`— se quedan con todo el alto. La barra de grabación no
  se pliega nunca: ahí está el botón de grabar. El estado se guarda en el `.hvt`.
- `tools/test-transport.sh` + `tools/transport-tests.js`: 49 aserciones nuevas
  sobre el transporte y el plegado. Esta lógica no tenía arnés antes.

### Corregido
- **El botón Detener no podía parar el audio de una toma.** Cada clic en un bloque
  de pista creaba un `new Audio()` que nadie guardaba, así que la grabación
  seguía sonando y no había forma de callarla. Ahora hay un único elemento de
  audio reutilizado —al que se le cambia el `src`—, de modo que el transporte
  siempre puede parar lo que esté sonando.
- La cabecera de reproducción ya no se queda clavada: sigue a la toma que suena,
  sumándole al timestamp de su línea, no solo al video de referencia.
- Al pulsar un marcador de diálogo sin video cargado, ahora suena esa línea en
  lugar de no hacer nada.

### Nota de comportamiento
- ▶ reproduce la toma **elegida con la estrella** de la línea activa. Previsualizar
  otra toma desde su bloque no cambia esa elección: son dos cosas distintas, y
  la estrella es la que se guarda al exportar.

---

## 1.5.0

### Eliminado
- **YouTube, por completo.** Se fue el campo de URL y su botón, el handler que
  construía el iframe, los textos de la waveform y del transporte que lo
  mencionaban, la regla CSS de `#ytUrl`, y el aviso de `file://` que solo
  existía para explicar el «error 153». La herramienta es de uso local y solo
  trabaja con vídeo/audio del disco, así que el reproductor embebido no aporta
  nada y solo traía límites.
- Con esto se cae el «error 153» por sí solo: era YouTube exigiendo la cabecera
  `Referer`, algo que un archivo abierto con doble clic no puede enviar.

### Corregido
- **La grabación fallaba en silencio fuera de un contexto seguro.**
  `navigator.mediaDevices` no existe ahí, así que la llamada reventaba con un
  `TypeError: Cannot read properties of undefined` que no explicaba nada. Ahora
  se comprueba antes y se dice qué pasa y cómo arreglarlo (`./start.sh` o un
  sitio con HTTPS).

### Cambiado
- `start.sh` ya no se justifica por YouTube: ahora se ofrece porque servir por
  HTTP da un origen estable y real, donde el autoguardado no se pierde y nada
  depende de lo que el navegador permita sobre ficheros locales. Sigue siendo
  opcional — con doble clic en `index.html` la app funciona igual.
- `start.sh` pasa a funcionar en **Linux** además de macOS: la detección de
  puertos ya no depende de `lsof` (que no viene en many Linux mínimos) sino de
  `python3`, y la apertura del navegador prefiere `xdg-open`.

---

## 1.4.0

### Corregido
- **YouTube volvía a soltar «error 153» y no reproducía.** No era un fallo del
  reproductor: YouTube rechaza cualquier player embebido al que no le llegue la
  cabecera `Referer`, y una app abierta con doble clic tiene origen opaco
  (`file://`), de modo que el navegador no puede mandarla. Ahora hay `start.sh`,
  que sirve la carpeta por `http://127.0.0.1` y abre el navegador ahí, donde el
  `Referer` sí existe. Eligiendo solo un puerto libre entre 8787-8791 (o el que se
  le pase), y parándolo con Ctrl+C.
- El iframe de YouTube ya no fija su propio `referrerPolicy`: la política del
  documento rige igual, y	setearla ahí solo podía recortar el `Referer` que
  YouTube necesita para validar el embed.

### Añadido
- Aviso en la parte superior cuando la app se abre por `file://`, explicando por
  qué YouTube no va a funcionar y cómo arreglarlo, en vez de dejar un player en
  negro con un código de error sin contexto. El aviso desaparece solo al servir la
  app por HTTP.

### Ojo al migrar
- `file://` y `http://127.0.0.1` son **orígenes distintos** para `localStorage`:
  el autoguardado que tengas hecho en `file://` no aparecerá al pasar a
  `start.sh`. Guarda el proyecto como `.hvt` antes de cambiar. Los `.hvt` en
  disco no se ven afectados.

---

## 1.3.0

### Añadido
- **Candado de edición por columna.** La columna Original nace bloqueada, como
  hasta ahora, pero ahora tiene un botón 🔒 en su cabecera para liberarla cuando
  el SRT viene descuadrado o con errores que merece la pena corregir, y para
  volver a bloquearla después. El mismo botón sirve en cualquier columna, así que
  también se puede bloquear una adaptación para no rozarla por error.
- El candado se guarda en el `.hvt`: un proyecto reabierto recuerda qué columnas
  estaban bloqueadas.

### Cambiado
- `COL_TYPES.readonly` deja de ser un veto y pasa a ser el estado de bloqueo por
  defecto del tipo; el estado vivo es `col.locked`. Los proyectos anteriores, que
  no tienen el campo, se abren con el bloqueo que le toca a cada tipo.
- `columnsSignature()` incluye el candado para que la cabecera se repinte al
  cambiarlo; el glifo se distingue del de mover y del de minimizar con color ámbar
  y con su propio separador.
- El menú "+ columna" ya no dice "solo lectura", que era una afirmación que ya no
  era cierta.

### Verificación
- **161 aserciones** en verde (78 de columnas + 83 de persistencia), incluidas
  25 nuevas sobre el candado: valores iniciales, liberar/bloquear sin perder
  texto, firma del esqueleto, columnas nuevas, fallback de proyectos viejos y
  ida y vuelta por el `.hvt`.

---

## 1.2.0

### Añadido
- **`js/project.js`**: persistencia real. Un proyecto `.hvt` es un JSON con
  cabecera `format: "hvt"` y versionado, que guarda columnas, líneas, textos por
  columna, emociones, personaje, tiempos, la toma seleccionada y las
  grabaciones incrustadas en base64.
- Guardar (`proyecto.hvt`), Abrir y Nuevo proyecto en la barra superior, más atajo
  `Cmd/Ctrl+S`. El título lleva un `•` mientras haya cambios sin guardar.
- **Autoguardado** en `localStorage` 700 ms después de cada cambio, con aviso en la
  barra de estado al arrancar. Sin audio, a propósito: el autoguardado no cabe en
  la cuota de `localStorage`.
- Aviso si el autoguardado se queda sin cuota, en lugar de fallar en silencio.
- Exportación del proyecto a Markdown legible, ahora en su propio archivo
  (`proyecto.md`) y no sobrescribiendo el SRT de origen.

### Corregido
- **`js/project.js:1`**: el comentario de cabecera no cerraba y se comía las
  declaraciones `const`/`let` del archivo. El módulo cargaba sin errores de
  sintaxis y con `autosaveTimer` y compañía sin definir: cualquier llamada a
  `scheduleAutosave()` reventaba en tiempo de ejecución. Añadido
  `tools/lint-comments.py` para que esta clase de fallo no vuelva a colarse.
- Al reabrir un proyecto, cada toma recibía un `Blob` donde se esperaba una URL
  (`take.url`): el audio se recuperaba pero no sonaba. Ahora se crea el
  `Blob` y su `URL.createObjectURL`.
- El autoguardado arrastraba el base64 ya cacheado de las grabaciones y podía
  reventar la cuota en cuanto el proyecto tenía audio. `buildProjectData()`
  ahora recibe `includeAudio` y solo guarda en disco lo pide explícitamente.
- Un proyecto vacío guardado (el resultado de "Nuevo") se perdía: al recargar
  volvía el proyecto de ejemplo. `bootProject()` respeta cualquier autoguardado
  con cabecera válida, tenga líneas o no.
- `removeColumn` vaciaba los textos de las líneas, lo que disparaba
  `scheduleAutosave()`; el arnés de columnas no lo cubría y ahora sí.

### Verificación
- `tools/project-tests.js` + `tools/test-project.sh`: 73 aserciones de ida y
  vuelta, autoguardado, arranque y datos inválidos.
- `tools/check.sh` suma un paso de persistencia y el linter de comentarios:
  **133 aserciones** en total (60 de columnas + 73 de persistencia).

---

## 1.1.1

Los botones de minimizar se confundían con los de reordenar: ambos usaban
`‹ ›`. Ahora hay dos acciones visualmente distintas:

- **Mover**: chevron simple `‹ ›`, fondo transparente, se atenúan en los extremos.
- **Minimizar**: chevron doble `« »` (convención de "colapsar al borde"), fondo
  hundido `--#17191d` con sombra interior, borde más claro y tamaño mayor. El
  hover lo tiñe de acento.
- Un separador vertical (`.colSep`) separa los dos grupos dentro del header.

Las 5 aserciones nuevas en `tools/column-tests.js` fijan este requisito: el glifo
de minimizar no puede coincidir con el de mover, y el separador debe existir. Se
verificó el control negativo (reintroducir el chevron simple hace fallar 3 tests).

Total: 60 aserciones.

---

## 1.1.0

Refactor del sistema de columnas: de 3 columnas fijas por ID a un array dinámico
con pestañas laterales. `HVT_alpha.html` sigue intacto.

Modelo de datos:
- `columns` en `state.js`: `{id, type, title, active, restoreIndex, side}`. El
  orden del array es el orden izquierda→derecha de las columnas visibles.
- `COL_TYPES` con `original` (solo lectura), `adapted` y `rough`: cada tipo lleva
  su proporción `fr`, su `readonly` y su placeholder.
- `MAX_ACTIVE_COLS = 3`: se pueden crear ilimitadas columnas, pero solo 3 visibles.
- El texto de cada línea pasa de `cue.original/rough/adapted` sueltos a
  `cue.text[<colId>]`, con accesores `cueText()` / `setCueText()`. `newCue()`
  migra automáticamente las claves antiguas, así que los SRT y los datos de
  ejemplo siguen funcionando sin tocarlos.

Comportamiento:
- **+ columna**: desplegable con los tres tipos. Con hueco libre la nueva se hace
  visible al final; con las 3 ocupadas nace como pestaña.
- **Minimizar → pestaña**: la columna sale del grid y se ancla a un raíl lateral.
  Solo la más a la izquierda va al raíl izquierdo; el resto, al derecho.
- **Restaurar**: la pestaña devuelve la columna a la posición que tenía. Si ya
  hay 3 visibles, se minimiza la que ocupa ese hueco para no pasarse del máximo.
- **Reparto de ancho**: las activas se reparten el 100% según sus `fr`
  (3 → `1fr 1.2fr 1fr`, 2 → `1.2fr 1fr`, 1 → `1fr`), con la transición ya existente.
- **Reordenar**: botones `‹ ›` en cada header que intercambian con la vecina
  inmediata. Sin drag & drop ni selectores de posición.
- El esqueleto de columnas solo se reconstruye cuando cambia la estructura, así
  que los `<textarea>` sobreviven a los renders y no pierden el foco al escribir.
- El conteo de sílabas se muestra solo en columnas de tipo adaptación; el clic
  derecho para asignar emoción también.
- La columna destacada (`.center`) es la primera adaptación activa.
- El export `.hvt` genera la tabla con las columnas que existan en ese momento.
- Las pestañas tienen un `✕` para eliminar la columna (no estaba pedido, pero sin
  él un sistema de columnas ilimitadas no tiene salida).

Herramientas:
- `tools/domstub.js` + `tools/column-tests.js` + `tools/test-columns.sh` — 55
  aserciones sobre la lógica de columnas, ejecutadas sin navegador en
  JavaScriptCore. `check.sh` las corre en cada respaldo.

Bugs detectados y corregidos durante el refactor:
- `updateColumnsGrid()` unía las proporciones sin la unidad y producía
  `1 1.2 1` en vez de `1fr 1.2fr 1fr`, lo que rompía el grid.
- El umbral de anclaje de las pestañas mandaba también a la izquierda la columna
  central de un grupo de 3.
- El verificador de IDs de `check.sh` contaba como estática una llamada con
  concatenación (`getElementById('body_' + col.id)`).

---

## 1.0.0

Desglose mecánico inicial de `HVT_alpha.html` en módulos. **Cero cambios de
comportamiento**: el código es byte a byte el del monolito, solo reordenado en
archivos.

Base inmutable:
- `HVT_alpha.html` — 1240 líneas, 54,443 bytes
- SHA-256 `d3e64df3cb972b5a37ec135cd48dd09f69317043d569c237121b4737287d3696`

Archivos generados:
- `index.html` — 148 líneas; enlaza CSS y los 10 módulos en orden de carga
- `css/style.css` — 206 líneas, extraídas del `<style>` inline sin modificar
- `js/state.js` — estado compartido: `cues`, `activeCueId`, `cueCounter`,
  `sourceRef`, `EMOTIONS`, `uid`, `newCue`, `refMediaEl`,
  `lastRefAudioBuffer`, `markerDragState`
- `js/utils.js` — `fmtTs`, `esc`, `countSyllables`, `fixWebmDuration`,
  `tsToSeconds`, `secondsToTs`
- `js/render.js` — `render`, `updateSyllHint`, `editTimestamp`, `setActiveLine`,
  `renderEmoIndicator`
- `js/ctxmenu.js` — menú de emociones
- `js/columns.js` — colapso de columnas
- `js/refstrip.js` — waveform de la franja de referencia y su tirador
- `js/sources.js` — dropdown de fuentes, SRT, video/audio local, YouTube
- `js/audio.js` — grabación, waveform en vivo, volumen
- `js/timeline.js` — transporte, playhead, arrastre de marcadores, pistas
- `js/ui.js` — herramientas de texto, modal de archivos crudos, export, arranque

Herramientas:
- `tools/syntaxcheck.js` — parseo conjunto de los módulos en JavaScriptCore
  (detecta errores de sintaxis y declaraciones `let` duplicadas)
- `tools/check.sh` — verificación completa antes de cada respaldo
- `snapshot.sh` — crea una revisión versionada y su respaldo

Verificación de esta revisión:
- 641 líneas de código idénticas al monolito (multiconjunto, sin pérdidas ni
  duplicados)
- 10/10 módulos se parsean juntos sin errores
- 0 IDs faltantes entre los 48 que pide el JS y los 64 del HTML
- 0 residuos de `<style>` o `<script>` inline en `index.html`
- CSS y body del HTML idénticos al original
