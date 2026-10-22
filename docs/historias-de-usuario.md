# Historias de usuario

Cada historia incluye criterios de aceptación (CA) funcionales y criterios de seguridad (CS).
Las historias HU-01 a HU-05 cubren la base de la aplicación; HU-06 a HU-10 amplían la aplicación con funcionalidades distintas.

---

## HU-01 · Ver la página principal

**Como** visitante, **quiero** abrir la aplicación en el navegador **para** confirmar que el servicio está disponible.

**Criterios de aceptación**
- `GET /` responde 200 con `index.html` y `Content-Type: text/html; charset=utf-8`.
- La página muestra el título y el estado "Aplicación funcionando".
- Los recursos `styles.css` y `app.js` se sirven con su tipo MIME correcto.
- Una ruta inexistente responde 404 sin exponer información interna.

**Criterios de seguridad**
- Las respuestas incluyen cabeceras de seguridad: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy`.
- La CSP no permite `unsafe-inline` ni scripts de terceros.
- Los mensajes de error no revelan rutas del servidor ni trazas de pila.
- La cabecera `X-Powered-By` y la versión de Node no aparecen en las respuestas.

---

## HU-02 · Proteger el servidor frente a path traversal

**Como** responsable de seguridad, **quiero** que el servidor solo entregue archivos de `public/` **para** evitar la fuga de archivos del sistema.

**Criterios de aceptación**
- Peticiones como `/../package.json`, `/..%2fpackage.json` o `/%2e%2e/src/server.js` responden 403 o 404.
- Solo se sirven las extensiones permitidas (`.html`, `.css`, `.js`, y las que se añadan explícitamente).
- Existe un test automatizado por cada variante de traversal.

**Criterios de seguridad**
- La ruta se normaliza y se valida contra el directorio base después de decodificar la URL.
- Se rechazan rutas con bytes nulos (`%00`) y URLs mal formadas sin lanzar excepciones no controladas.
- Los intentos bloqueados se registran con IP, método y ruta (sin datos sensibles).

---

## HU-03 · Consultar el estado de salud del servicio

**Como** ingeniero de operaciones, **quiero** un endpoint `/health` **para** que el orquestador y el monitoreo detecten fallos.

**Criterios de aceptación**
- `GET /health` responde 200 con `{"status":"ok"}` y `Content-Type: application/json`.
- Responde en menos de 100 ms en condiciones normales.
- Los métodos distintos de `GET` y `HEAD` responden 405 con la cabecera `Allow`.

**Criterios de seguridad**
- No devuelve versión, variables de entorno, rutas ni datos de dependencias.
- Aplica el mismo límite de peticiones por IP que el resto de rutas.
- Una futura ruta de diagnóstico detallado (`/ready`, métricas) no es pública sin autenticación.

---

## HU-04 · Enviar un formulario de contacto

**Como** visitante, **quiero** enviar un mensaje desde la página **para** comunicarme con el equipo.

**Criterios de aceptación**
- El formulario tiene los campos nombre, correo y mensaje, todos obligatorios.
- Se muestra validación en el cliente y un mensaje de éxito o error claro.
- `POST /api/contact` acepta JSON y responde 201 si es válido, 400 si no lo es.
- Los mensajes se almacenan o registran de forma que puedan consultarse.

**Criterios de seguridad**
- Toda entrada se valida en el servidor (tipo, longitud máxima, formato de correo), sin confiar en el cliente.
- Se limita el tamaño del cuerpo (por ejemplo 10 KB) y se responde 413 si se excede.
- La salida se escapa o se inserta con `textContent`, nunca con `innerHTML`, para prevenir XSS.
- Se aplica límite de peticiones por IP (por ejemplo 5 por minuto) y se responde 429.
- Se protege contra CSRF con token o con política `SameSite` y validación de `Origin`.
- Los datos personales no aparecen en logs y se documenta su retención.

---

## HU-05 · Iniciar y cerrar sesión

**Como** administrador, **quiero** autenticarme **para** acceder a un área protegida de la aplicación.

**Criterios de aceptación**
- `POST /api/login` con credenciales válidas crea una sesión y responde 200.
- Con credenciales inválidas responde 401 con un mensaje genérico.
- `POST /api/logout` invalida la sesión en el servidor.
- Las rutas bajo `/admin` responden 401 sin sesión válida.

**Criterios de seguridad**
- Las contraseñas se guardan con un hash lento y con sal (`scrypt` de `node:crypto` o `argon2`), nunca en texto plano.
- La cookie de sesión usa `HttpOnly`, `Secure` y `SameSite=Strict`, con expiración y renovación del identificador al iniciar sesión.
- Tras 5 intentos fallidos se bloquea temporalmente la cuenta o la IP.
- El mensaje de error no distingue entre usuario inexistente y contraseña incorrecta, y el tiempo de respuesta es similar en ambos casos.
- No hay credenciales por defecto en el código; los secretos vienen de variables de entorno.

---

## HU-06 · Recuperar la contraseña

**Como** usuario registrado, **quiero** restablecer mi contraseña si la olvido **para** recuperar el acceso a mi cuenta.

**Criterios de aceptación**
- `POST /api/password-reset` con un correo envía un enlace de restablecimiento y siempre responde 202.
- El enlace abre un formulario para definir la nueva contraseña, con confirmación.
- Tras el cambio, el enlace deja de ser válido y todas las sesiones activas del usuario se cierran.
- La nueva contraseña debe cumplir la política (mínimo 12 caracteres, no estar en una lista de contraseñas comunes).

**Criterios de seguridad**
- La respuesta es idéntica exista o no el correo, para evitar la enumeración de usuarios.
- El token es aleatorio criptográficamente (`crypto.randomBytes`, mínimo 32 bytes), se guarda hasheado y expira en 15 minutos.
- El token es de un solo uso y se invalida al solicitar uno nuevo.
- Se limita la solicitud a 3 por hora por correo y por IP.
- El enlace no se registra en logs y el correo se envía solo por canal cifrado.
- Se notifica por correo al usuario cuando su contraseña cambia.

---

## HU-07 · Gestionar roles y permisos

**Como** administrador, **quiero** asignar roles (administrador, editor, lector) a los usuarios **para** controlar qué puede hacer cada uno.

**Criterios de aceptación**
- Existen los roles `admin`, `editor` y `lector`, con permisos documentados en una matriz.
- Solo un `admin` puede cambiar el rol de otro usuario mediante `PATCH /api/users/:id/role`.
- Un acceso sin el permiso requerido responde 403.
- Siempre queda al menos un `admin` activo; el sistema impide quitar el último.

**Criterios de seguridad**
- La autorización se valida en el servidor en cada petición; ocultar botones en la interfaz no cuenta como control.
- Política de denegar por defecto: una ruta nueva sin permiso declarado es inaccesible.
- Se previene IDOR: un usuario solo accede a recursos propios salvo que su rol lo permita.
- El rol nunca se toma de un dato enviado por el cliente (cuerpo, cabecera o cookie sin firmar).
- Los cambios de rol se registran en auditoría (quién, a quién, antes y después) y exigen reautenticación.

---

## HU-08 · Subir y descargar archivos adjuntos

**Como** usuario autenticado, **quiero** adjuntar archivos a mis registros **para** conservar documentos relacionados.

**Criterios de aceptación**
- `POST /api/files` acepta PDF, PNG y JPG de hasta 5 MB.
- Se muestra una lista de mis archivos con nombre, tamaño y fecha.
- `GET /api/files/:id` descarga el archivo solo si pertenece al usuario o este tiene rol `admin`.
- Un archivo con tipo no permitido o demasiado grande responde 415 o 413 con un mensaje claro.

**Criterios de seguridad**
- El tipo se valida por contenido (firma de bytes / *magic numbers*), no solo por extensión o por `Content-Type`.
- El archivo se guarda fuera de `public/` con un nombre generado (UUID); el nombre original no se usa en rutas del disco.
- Se descarga con `Content-Disposition: attachment` y `X-Content-Type-Options: nosniff`.
- Se limita el tamaño total por usuario y la tasa de subidas, para evitar el agotamiento de disco.
- Se analiza el archivo con un antivirus (por ejemplo ClamAV) antes de ponerlo a disposición.
- Se rechazan archivos con nombres con `..`, caracteres de control o rutas absolutas.

---

## HU-09 · Buscar y listar registros con paginación

**Como** usuario, **quiero** buscar y filtrar registros en una lista paginada **para** encontrar información rápidamente.

**Criterios de aceptación**
- `GET /api/records?q=texto&page=1&limit=20` devuelve resultados, total y número de páginas.
- `limit` tiene un valor por defecto de 20 y un máximo de 100.
- Se puede ordenar por fecha o nombre, ascendente y descendente.
- Una búsqueda sin resultados devuelve una lista vacía con 200, no un error.

**Criterios de seguridad**
- Los parámetros se validan por tipo y rango; los valores inválidos responden 400.
- Las consultas usan sentencias parametrizadas o un ORM, nunca concatenación de texto (previene inyección SQL/NoSQL).
- Los campos de ordenación y filtro se comprueban contra una lista blanca.
- Cada usuario ve solo los registros a los que tiene derecho; el filtrado se aplica en el servidor.
- Se limita la complejidad de la búsqueda (longitud máxima de `q`, tiempo máximo de consulta) para evitar ataques de denegación de servicio.
- La búsqueda no refleja `q` sin escapar en la respuesta HTML.

---

## HU-10 · Consultar el historial de auditoría

**Como** administrador, **quiero** ver un historial de las acciones relevantes **para** investigar incidentes y cumplir con requisitos de trazabilidad.

**Criterios de aceptación**
- Se registran inicios de sesión (exitosos y fallidos), cambios de rol, cambios de contraseña y subidas de archivos.
- Cada evento incluye marca de tiempo UTC, usuario, acción, resultado, IP e identificador de petición.
- `GET /api/audit` permite filtrar por usuario, acción y rango de fechas, con paginación.
- Se puede exportar el resultado filtrado a CSV.

**Criterios de seguridad**
- Solo el rol `admin` accede al historial y a su exportación.
- Los registros son de solo anexar: ninguna ruta de la aplicación permite editarlos o borrarlos.
- No se almacenan contraseñas, tokens, cuerpos completos de peticiones ni datos personales innecesarios.
- Los valores que vienen del usuario se sanean antes de registrarse (contra inyección de logs) y se neutralizan en el CSV (contra inyección de fórmulas: `=`, `+`, `-`, `@`).
- Se define un periodo de retención y se protege el almacenamiento contra manipulación (por ejemplo, encadenando hashes).
- Acceder al historial genera, a su vez, un evento de auditoría.
