# Quetre (fork)

Fork de [zyachel/quetre](https://github.com/zyachel/quetre), un frontend libre
para Quora.

Upstream lleva sin mantenimiento activo desde 2024 y todas las instancias
públicas devuelven error. Este fork restaura el funcionamiento del servicio.

> Fork de uso personal. No se publican instancias ni se aceptan contribuciones.
> El código está disponible bajo AGPL-3.0, igual que upstream.

---

## Por qué existe este fork

Quora está detrás de Cloudflare y devuelve un **Managed Challenge**
(`cf-mitigated: challenge`, la página "Just a moment…") a cualquier cliente
HTTP. Upstream no tiene defensa alguna: envía `User-Agent: axios/x.y`, sin
cookies, sin proxy y sin control de ritmo.

El diagnóstico completo está en los issues #1 y #2. Resumen:

| Cliente | Resultado |
|---|---|
| curl estándar, cualquier combinación de cabeceras | challenge |
| curl con fingerprint TLS de navegador | challenge |
| Navegador real | 200 |
| curl estándar + `cf_clearance` | **200** |

**Conclusión:** ningún cliente HTTP supera el challenge, porque exige ejecutar
JavaScript. Pero una vez que un navegador lo resuelve, la `cf_clearance`
resultante es reutilizable desde cualquier cliente: Cloudflare la ata a
**IP de salida + User-Agent**, no al fingerprint TLS. Y es válida para todo el
dominio, no solo para la URL que la generó.

---

## Cómo funciona

```
petición → ¿caché fresca en Redis?  → sí → servir
         → ¿?archived=1 y hay copia? → sí → servir del disco
         → no → cola → axios + cf_clearance
                        └─ ¿challenge? → acuñar → reintentar (1 vez)
         → si falla → copia caducada de Redis, o del archivo en disco
```

Un navegador headless (FlareSolverr) resuelve el challenge **solo cuando la
clearance falta o caduca**, no en cada petición. El resto del tráfico lo sirve
un cliente HTTP normal.

Tres capas de almacenamiento, con propósitos distintos:

| | Qué es | Retiene |
|---|---|---|
| **Redis** | Caché en memoria | 24 h fresco · 30 d como copia de rescate |
| **Disco** | Archivo permanente | Todo lo visitado, sin caducidad |
| **Quora** | Origen | — |

En la práctica: ~0,06 s con caché, ~1,4 s contra Quora, ~14 s únicamente
cuando toca renovar la clearance.

### Piezas

- **`utils/clearance.js`** — acuña el par `cf_clearance` + User-Agent y lo
  persiste como unidad indivisible. Comparte la promesa entre peticiones
  concurrentes para no levantar varios navegadores a la vez.
- **`utils/axiosInstance.js`** — compone el header `Cookie`, fija el
  User-Agent acuñado, deriva las Client Hints de él y detecta el challenge en
  el interceptor de error.
- **`utils/queue.js`** — serializa las peticiones a Quora con intervalo mínimo
  y jitter.
- **`utils/upstreamError.js`** — traduce cada fallo a un código identificable.
- **`middlewares/middlewares.js`** — caché con frescura y retención separadas.
- **`utils/store.js`** — archivo permanente en disco: un JSON por página, en
  subcarpeta por tipo. Nunca lanza: si el disco falla, la aplicación sigue
  sirviendo desde Redis.

---

## Diferencias con upstream

Este fork parte del **PR upstream #149** (`[WIP]: Cooldown`), nunca mergeado,
que aportaba cabeceras de navegador, persistencia de cookies y cooldown.

### Añadido

- Acuñación y reutilización de `cf_clearance` vía navegador headless.
- Cola de peticiones con intervalo mínimo y jitter.
- Caché con frescura (24 h) y retención (30 d) separadas: las entradas
  caducadas se conservan y se sirven si Quora falla, en lugar de devolver error.
- Códigos de error diferenciados y logging con causa y URL.
- Volcado del HTML recibido cuando Quora responde 200 sin datos.

### Corregido

- **`getBaseUrl(undefined)` devolvía `https://undefined.quora.com`.** Regresión
  del PR #149: en `main` el valor por defecto era `'www'` y el refactor lo
  perdió. Se pedía un subdominio inexistente, Cloudflare respondía challenge
  con clearance o sin ella, y además se disparaba una re-acuñación en cada
  petición.
- **El interceptor de rate-limit era código muerto.** Estaba registrado como
  handler de éxito, pero axios rechaza las respuestas no-2xx, así que nunca
  veía un 403.
- **El interceptor sustituía el jar de cookies** en lugar de fusionarlo. Con
  clearance eso sería letal: cualquier `Set-Cookie` de Quora la eliminaría.
- **`redis.expire()` recibía el TTL como primer argumento** en vez de la clave.
  El refresco de TTL en acierto de caché no funcionaba en ningún caso.
- **`checkCache` no fijaba `fromCache`**, por lo que se reescribía la entrada
  en cada acierto.
- **Cabeceras incoherentes:** `Content-Encoding` en vez de `Accept-Encoding`,
  `zstd` anunciado sin poder descomprimirlo, `Sec-Fetch-Site: cross-site` en
  navegaciones directas.
- **El Dockerfile clonaba el repositorio upstream** en lugar de usar el código
  local: construir desde el fork introducía el código de upstream en la imagen
  y los cambios propios se ignoraban en silencio.

---

## Decisiones descartadas

Documentadas para no repetir el camino.

**Cambiar la IP de salida (VPN, proxies rotatorios).** Descartado tras
verificar que un navegador desde la misma IP carga Quora con normalidad: la IP
está limpia y el bloqueo es por fingerprint de cliente. Cloudflare puntúa
reputación de red, y las IPs de datacenter tienen peor score que una
residencial: introducirlas empeoraría el problema.

**Clientes HTTP con fingerprint de navegador.** Probado, recibe challenge
igualmente. Un fingerprint mejor solo evitaría que Cloudflare *emita* el reto;
una vez emitido, exige JavaScript.

**Navegador headless como fetcher principal.** Funciona, pero cuesta ~20 s por
petición frente a ~1,4 s. Se conserva únicamente como acuñador.

**Rotación de User-Agent.** Rotar el UA manteniendo la misma sesión es más
sospechoso que un UA fijo. Además la clearance está ligada al UA que la emitió.

**Cola dentro del cliente HTTP.** El proxy de imágenes comparte instancia pero
apunta al CDN: serializarlo haría que cada página tardase una eternidad.
Además, el reintento tras re-acuñar vuelve a pasar por el interceptor, por lo
que una cola ahí se auto-bloquearía. La cola vive en los fetchers.

---

## Configuración

Además de las variables de upstream:

| Variable | Por defecto | Descripción |
|---|---|---|
| `FLARESOLVERR_URL` | — | URL del servicio que acuña la clearance. Sin ella el servicio no puede renovar el acceso. |
| `FLARESOLVERR_TIMEOUT` | `120000` | Timeout de acuñación (ms). |
| `MIN_REQUEST_INTERVAL` | `2000` | Separación mínima entre peticiones a Quora (ms), ±40% de jitter. `0` desactiva la cola. |
| `REDIS_TTL` | `86400` | Frescura de la caché (s). |
| `REDIS_HARD_TTL` | `2592000` | Retención real en Redis (s). Las entradas caducadas se conservan para servirlas si Quora falla. |
| `STORE_DIR` | `/app/store` | Directorio del archivo permanente. Cadena vacía lo desactiva. |
| `QUORA_BASE_URL` | `https://www.quora.com` | Origen. Solo se cambia para pruebas, p. ej. apuntando a un host inalcanzable para verificar el rescate desde disco. |
| `QUORA_SESSION_COOKIES` | — | Cookies de sesión (`m-b=...; m-s=...`) para la búsqueda. Sin ellas, `/search` devuelve `SEARCH_NEEDS_SESSION`. El resto del servicio no las usa. |
| `SEARCH_QUERY_HASH` | (valor actual) | Hash de la consulta persistida de búsqueda. Cambia cuando Quora recompila su frontend. |

Redis pasa de opcional a **necesario en la práctica**: sin él la clearance no
persiste entre reinicios y cada arranque exige acuñar de nuevo.

---

## Archivo permanente

Toda página obtenida con éxito se guarda en disco de forma indefinida, como
objeto ya parseado y no como HTML crudo: ocupa menos y es inmune a cambios
futuros del marcado.

```
store/
├── answers/what-is-linux-4&lang=en.json
├── topic/physics&lang=en.json
└── profile/charlie-cheever&lang=en.json
```

Cada fichero guarda `savedAt`, de modo que al servir una copia el lector ve de
qué fecha es. Responde a la objeción de upstream (issue #99) sobre servir
respuestas rancias: el contenido antiguo se sirve, pero se dice.

**Rescate automático.** Si Quora falla y Redis no tiene copia, se sirve la del
archivo con un aviso de procedencia. Verificado apuntando `QUORA_BASE_URL` a un
host inalcanzable con Redis vacío: la página sale igual.

**`?archived=1`** fuerza la lectura del disco sin consultar a Quora. Es una
preferencia, no una prohibición: si la página no está archivada, el flujo
continúa a Quora con normalidad. Devolver un 404 haría creer al lector que la
instancia está bloqueada.

**`/archive`** lista lo guardado, ordenado por fecha descendente. Los enlaces
del índice llevan `?archived=1` incorporado: navegar el propio archivo no
debería costar peticiones a un sitio que ya bloqueó la instancia una vez.

Respaldar el archivo es copiar el directorio. No hay base de datos ni formato
propietario.

---

## Búsqueda

Upstream eliminó la búsqueda en 2024 (`f49062d`) porque Quora dejó de servirla
a usuarios anónimos. Sigue siendo cierto, y hoy hay además una segunda barrera.

**Por qué no se puede scrapear.** La ruta `/search` recibe challenge de
Cloudflare incluso con una clearance válida que en el mismo momento sirve otras
rutas con 200: la regla cubre un conjunto de rutas. Y aunque se supere con un
navegador real, el HTML no contiene resultados — cero marcadores del parser, 3
blobs frente a los ~10 de una pregunta normal. Es una cáscara que rellena el
JavaScript.

**Cómo funciona aquí.** La búsqueda va por el endpoint GraphQL de Quora
(`/graphql/gql_para_POST`) con consulta persistida. Requiere tres cosas:

1. El **hash** de la operación `SearchResultsListQuery`. Quora sirve cada
   consulta como artefacto propio en su CDN, así que puede extraerse sin
   desmenuzar bundles.
2. La cabecera **`quora-formkey`**, extraíble del HTML de cualquier página. Es
   estable mientras dure la sesión, así que se obtiene una vez y se reutiliza.
3. **Cookies de sesión.** Sin ellas la consulta responde 200 pero con
   `searchConnection` nulo: Quora devuelve cero resultados a los anónimos.

**La sesión se usa únicamente para la búsqueda.** El resto del servicio sigue
siendo anónimo. Aun así, conviene emplear una cuenta desechable: las búsquedas
quedan asociadas a ella.

**Filtros.** Tipo (`question`, `answer`, `post`, `profile`, `topic`, `tribe`) y
tiempo (`year`, `month`, `week`, `day`, `hour`) funcionan. El filtro de idioma
se eliminó de la interfaz: la consulta no tiene variable para ello.

**Cuando deje de funcionar.** Si Quora recompila su frontend, el hash cambia y
hay que actualizar `SEARCH_QUERY_HASH`. Si caducan las cookies, el error será
`SEARCH_NEEDS_SESSION`.

---

## Operación

### Códigos de error

Aparecen en el log como `[CÓDIGO] mensaje (detalle) → url`.

| Código | Significado |
|---|---|
| `NOT_FOUND` | La página no existe en Quora. |
| `RATE_LIMITED` | Quora está limitando (429). Activa cooldown. |
| `CHALLENGE_UNSOLVED` | Falló la acuñación. **Revisar el servicio acuñador.** |
| `EMPTY_PAYLOAD` | 200 sin datos: Quora cambió el marcado. Genera un volcado. |
| `UPSTREAM_ERROR` | Quora devuelve 5xx. |
| `NETWORK` | No se pudo contactar. |
| `INTERNAL` | Error de programación. Conserva traza. |

### Purgar la caché

La clearance vive en la misma base de Redis que la caché. **No usar
`FLUSHDB`**: borraría la clearance y forzaría una acuñación.

```
redis-cli --scan --pattern 'cache:*' | xargs -r redis-cli del
```

### Cuándo caduca la clearance

El atributo de la cookie indica un año, pero Cloudflare puede invalidarla
antes. El caso más frecuente es un **cambio de IP pública de salida**: la
clearance muere en el acto. La detección de challenge y la re-acuñación
automática son las que hacen que el servicio se recupere solo.

### Volcados

`EMPTY_PAYLOAD` guarda el HTML recibido en `dumps/`, rotando los 10 últimos.
Es la única evidencia disponible si Quora cambia el marcado.

---

## Limitaciones heredadas

- **Búsqueda:** eliminada en upstream (`f49062d`), devuelve `410`.
- **Rutas `/space/`:** nunca implementadas, devuelven `501`.
- **Respuestas:** solo se muestran las primeras. Quora las carga
  incrementalmente y la paginación no está implementada.
- **Quora Plus:** el contenido de pago no es accesible.

---

## Compilación

El lockfile es `lockfileVersion 6.0`, que requiere **pnpm 8**. Versiones
posteriores lo rechazan; regenerarlo con `--force` perdería la reproducibilidad
de las dependencias que upstream probó.

Sass se compila en tiempo de build. El arranque invoca `node server.js`
directamente, no `pnpm start`, que recompilaba el CSS en cada arranque.

---

## Licencia

AGPL-3.0-or-later, igual que upstream.