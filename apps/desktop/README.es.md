# Nulu Harness Desktop

[English](README.md) | Español

La aplicación de escritorio es un shell de Electron alrededor de la interfaz web de nulu. No abre ningún puerto de escucha: un proceso hijo de Node.js upstream incluido arranca el proyecto nulu instalado, tuberías de bytes con marcos versionados transportan solicitudes Fetch y respuestas en streaming sin un sobre Base64 externo, Node IPC transporta el control del ciclo de vida, y `nulu-app://` sirve los recursos del cliente correspondientes.

## Decisiones técnicas clave

| Decisión | Por qué | Consecuencia directa |
|---|---|---|
| Identidad de la versión | La API del shell, el cliente web, el backend y el grafo de plugins se califican como una sola combinación; versiones independientes crearían combinaciones no probadas y una disponibilidad de actualización ambigua. | Electron y `@worldapptechnologies/nulu` siempre tienen exactamente la misma versión. Actualizar nulu es una versión de Desktop, incluso cuando el código del shell no cambia. |
| Entorno de ejecución | El Node.js de Electron lleva parches, fusibles, ABI y restricciones de ciclo de vida de Electron, mientras que los entornos del sistema y el estado del gestor de paquetes no están controlados. | nulu se ejecuta bajo el Node.js upstream incluido y cada operación de paquetes usa el pnpm incluido. El Node.js de Electron, el Node.js del sistema, el pnpm del sistema y la configuración del gestor de paquetes del usuario quedan fuera de la ruta de ejecución. |
| Fuentes de paquetes | La instalación del núcleo al inicio añade trabajo incluso sin conexión. | `extraResources/nulu` lleva un árbol completo de dependencias de producción; el perfil solo instala plugins externos. |
| Módulos compartidos | Las API del host pueden depender de la identidad de los módulos. | Desktop enlaza cada paquete de primera parte incluido dentro del perfil mediante enlaces simbólicos de directorio, o junctions de Windows; las dependencias normales de los plugins permanecen locales. |
| Propiedad del estado | Compartir grafos de dependencias ejecutables permitiría que la CLI y Desktop cambiaran mutuamente sus versiones de nulu, Cordis, plugins o módulos nativos, mientras que dos procesos de escritorio podrían competir por el mismo perfil. | Electron adquiere su bloqueo de instancia única durante toda la vida del proceso antes de cualquier acceso al perfil y posee en exclusiva `$NULU_HOME/profiles/desktop` junto con el estado de su gestor de paquetes. La CLI y Desktop comparten los datos de producto admitidos bajo `$NULU_HOME`, pero nunca paquetes ejecutables, activación de plugins, lockfiles ni `node_modules`. |
| Transporte | Un servicio web en escucha añade problemas de propiedad de puertos, autenticación, CORS y exposición; Electron y el Node.js upstream también necesitan un protocolo explícito entre procesos. | La aplicación no abre ningún puerto web. `nulu-app://` transporta los recursos web y el tráfico Fetch; las tuberías de bytes con marcos transportan fragmentos acotados de solicitud y respuesta con contrapresión, mientras que Node IPC solo transporta el control del ciclo de vida del hijo. |
| Cambios de plugins | La instalación de paquetes y el arranque del Host pueden fallar. | Desktop detiene el Host y modifica el perfil actual directamente. Los fallos conservan cambios parciales para una reparación explícita; no hay reversión automática del perfil. |
| Actualizaciones | Actualizaciones independientes del shell y de nulu recrearían divisiones de versión, mientras que los bloques del shell sin cambios no deberían requerir una transferencia completa. | El shell de Electron, el entorno nulu correspondiente, Node.js y pnpm forman una única unidad de actualización firmada. Los artefactos de actualización por plataforma pueden reutilizar bloques sin cambios, pero la selección de la versión del entorno nunca se separa de la versión de Desktop. |

La [Agent Note de empaquetado y actualización de Electron](../../.agents/notes/implemented/architecture/2026-08-25-electron-desktop-packaging-and-updates.md) es la propietaria de la justificación, las alternativas, las restricciones de seguridad y los requisitos de calificación de versiones detrás de estas decisiones.

## Propiedad de la instalación

Electron posee `$NULU_HOME/profiles/desktop`. Su `dependencies` contiene solo plugins externos instalados en versiones exactas; `nulu.profile.bundles` contiene los bundles integrados seguidos de los plugins habilitados. La aplicación firmada proporciona nulu, el Host privado de Desktop y sus paquetes de producción desde `resources/nulu`. Los enlaces de paquetes compartidos resuelven a esos directorios reales. Tanto el host como los plugins se ejecutan en el mismo proceso Node upstream incluido, con resolución realpath normal; Desktop no habilita `--preserve-symlinks`. La CLI no puede arrancar ni modificar este perfil.

La página de inicio local expone el estado del inicio y las acciones de recuperación disponibles; el renderer nulu cargado recibe solo el marcador del protocolo de escritorio. La ventana de plugins independiente recibe operaciones estructuradas de listado, instalación, eliminación, actualización y comprobación de actualizaciones; ningún renderer recibe acceso al sistema de archivos, IPC de Electron sin procesar, un shell ni argumentos pnpm arbitrarios.

Electron elige texto de shell tipado en inglés o chino según la configuración regional de su aplicación y recurre al inglés. Los menús, los diálogos nativos, la página de inicio y el renderer de gestión de plugins usan la misma carga de configuración regional; la puerta de i18n de la interfaz del cliente del repositorio comprueba estas fuentes de escritorio.

### Entorno de ejecución y activación de plugins

El archivo firmado `resources/nulu/desktop-runtime.json` vincula la versión del shell, la versión de Node incluida, la plataforma, la arquitectura, las versiones de los paquetes compartidos y el inventario final de archivos. El inicio lee los metadatos y comprueba los registros de paquetes compartidos. El esquema de la versión, la versión del shell, la compatibilidad con el destino y la integridad de los archivos se verifican durante el empaquetado. Los paquetes del núcleo nunca se copian al almacenamiento del perfil ni los instala pnpm en el primer inicio.

1. La ventana principal muestra una página de carga local antes de preparar el perfil o iniciar el backend. Un perfil nuevo crea su manifiesto y los enlaces de paquetes compartidos conservando los archivos no relacionados, y luego inicia el backend real una vez. Los inicios sin cambios reutilizan el perfil sin escanear los manifiestos de los plugins instalados.
2. Una actualización compatible de la aplicación actualiza los enlaces compartidos en el perfil actual y comprueba los requisitos de pares de los plugins habilitados. Los archivos de los plugins, la configuración, las versiones y el lockfile permanecen en su sitio; pnpm no se ejecuta.
3. Un cambio en la versión de Node incluida, la plataforma o la arquitectura reinstala el grafo de plugins bloqueado con los scripts deshabilitados, valida y enlaza los paquetes del host, y luego ejecuta las compilaciones pendientes aprobadas y valida de nuevo.
4. Las operaciones de añadir, actualizar y eliminar plugins usan el pnpm incluido y el estado del gestor de paquetes propiedad de Desktop. Los paquetes reservados del host deben ser pares; las copias anidadas y los alias de paquetes compartidos fallan la validación. Las dependencias normales de los plugins deben resolverse dentro del perfil.
5. Los cambios de plugins detienen el backend antes de modificar el perfil actual. Una preparación correcta inicia el Host. Los fallos de paquete o de inicio del Host conservan los archivos modificados y notifican el error. Las operaciones de paquetes sin terminar conservan un marcador para que el siguiente inicio reintente la instalación bloqueada y las compilaciones pendientes. Desktop no crea directorios de preparación, diarios de activación ni copias de reversión.

La página de carga no depende del Host. Los errores ofrecen indicaciones para reiniciar y reinstalar. Deshabilitar plugins y restablecer Desktop solo se ofrecen cuando los recursos de la aplicación empaquetada admiten la recuperación del perfil; el desarrollo y los fallos de inicialización temprana exponen únicamente el reinicio. El gestor de plugins sigue disponible a través del menú de la aplicación. La identidad del entorno de ejecución se comprueba antes de que se inicie cualquier backend; los cambios de plugins no tienen reversión automática.

Restablecer elimina todas las entradas de `$NULU_HOME/profiles/desktop` excepto el bloqueo de transacción retenido, y luego inicializa el perfil integrado. Elimina la configuración de Desktop y los paquetes de terceros instalados sin copia de seguridad. Las tareas compartidas, la configuración y el `.env` del home de Harness no se tocan. Los fallos de recursos y preload del shell usan un documento autocontenido con las acciones de recuperación y el diagnóstico disponibles; sus controles no requieren preload.

Las transacciones de paquetes mantienen `$NULU_HOME/profiles/desktop/lock` en exclusiva hasta que termina el proceso pnpm. Restablecer conserva el directorio y su bloqueo hasta que terminan la inicialización y el inicio del Host. Los enlaces compartidos usan enlaces simbólicos de directorio en macOS/Linux y junctions en Windows; la limpieza elimina los enlaces sin borrar sus destinos. Las rutas canónicas del sistema de archivos identifican los paquetes compartidos, de modo que el uso de mayúsculas y minúsculas en rutas de Windows por sí solo no activa el perfil. Las compilaciones nativas siguen la lista `allowBuilds` revisada del perfil; instalar un paquete nuevo que requiere compilación sin aprobación en esa lista hace fallar la transacción.

## Desarrollo

`dev:desktop` compila el Host actual, los bundles del cliente, el frontend web y el shell de Electron, proyecta la CLI compilada y los paquetes privados del Host de Desktop con sus dependencias del workspace en un proyecto npm de escritorio desechable, y lanza Electron sin descargar el entorno Node.js empaquetado ni resolver nulu desde npm:

```sh
pnpm run dev:desktop
```

El estado de Harness de desarrollo se guarda por defecto en `apps/desktop/.desktop-build/development/home`, el proyecto npm desechable vive en `apps/desktop/.desktop-build/development/project` y los datos del navegador de Electron viven en `apps/desktop/.desktop-build/development/electron-user-data`. Por lo tanto, las sesiones, la configuración, las credenciales, los enlaces de paquetes y los datos del navegador permanecen fuera del home normal de Harness del usuario. Un `NULU_HOME` explícito sustituye solo el home de Harness de desarrollo. DevTools del renderer se abre automáticamente; la depuración de Main, Renderer y del Host nulu escucha en los puertos 9229, 9222 y 9230. `NULU_DESKTOP_MAIN_INSPECT_PORT`, `NULU_DESKTOP_RENDERER_DEBUG_PORT` y `NULU_DESKTOP_HOST_INSPECT_PORT` sustituyen esos puertos, mientras que `NULU_DESKTOP_OPEN_DEVTOOLS=0` mantiene cerradas las herramientas del renderer separadas.

Tras una compilación explícita, `start:desktop` reconstruye el proyecto desechable y lanza los artefactos existentes sin volver a compilar:

```sh
pnpm run start:desktop
```

El desarrollo en el workspace ejecuta la CLI actual y los paquetes privados del Host de Desktop bajo el Node.js que lo invoca y deshabilita las mutaciones de paquetes de escritorio. Su perfil desechable enlazado explícitamente es el único modo autorizado a resolver bundles fuera de su propio directorio. Usa una aplicación desempaquetada para ejercitar el Node.js incluido, el pnpm incluido, los recursos nulu incluidos y las rutas de instalación y reparación de plugins.

## Empaquetado

La ruta de empaquetado normal es un solo comando completo. Realiza la preparación de la versión antes de crear los instaladores y los metadatos de actualización de la plataforma anfitriona. Cada destino requiere un `NULU_DESKTOP_APP_ID` en DNS inverso. Los destinos de macOS requieren además el calificador del certificado de electron-builder en `NULU_DESKTOP_MACOS_SIGNING_IDENTITY`, su Apple Team ID de 10 caracteres en `NULU_DESKTOP_MACOS_TEAM_ID`, y una estrategia completa de credenciales de notarytool. La estrategia de clave de API de App Store Connect usa estas variables:

```sh
export NULU_DESKTOP_APP_ID='<reverse-DNS application ID>'
export NULU_DESKTOP_MACOS_SIGNING_IDENTITY='<certificate name without the Developer ID Application prefix>'
export NULU_DESKTOP_MACOS_TEAM_ID='<10-character Apple Team ID>'
export APPLE_API_KEY='<absolute path to the .p8 file>'
export APPLE_API_KEY_ID='<App Store Connect API Key ID>'
export APPLE_API_ISSUER='<App Store Connect issuer UUID>'
```

`prepare:desktop` no es un requisito previo:

```sh
pnpm run package:desktop
```

La automatización de versiones usa comandos de destino fijos para que la preparación del entorno, la preparación de nulu y electron-builder reciban la misma plataforma y arquitectura:

```sh
pnpm run package:desktop:mac:arm64
pnpm run package:desktop:mac:x64
pnpm run package:desktop:win:x64
pnpm run package:desktop:linux:x64
```

El comando de macOS arm64 requiere Apple Silicon. El comando de macOS x64 se ejecuta en macOS Intel o en Apple Silicon con Rosetta. El comando de Windows x64 requiere Windows x64. El comando de Linux x64 requiere un host Linux x64 y produce un AppImage; los artefactos de Linux se distribuyen a través de GitHub Releases y quedan fuera del flujo de carga automática de COS.

Cada destino posee sus entradas de paquete empaquetadas, su entorno preparado, su conjunto de paquetes, su árbol nulu, su estado de preparación de pnpm, su aplicación desempaquetada, sus metadatos de actualización y sus artefactos finales bajo `apps/desktop/.desktop-build/targets/<target>/`. La caché de archivos de Node.js permanece compartida bajo `.desktop-build/downloads` porque cada nombre de archivo incluye su versión, plataforma y arquitectura y se verifica antes de la extracción. Una compilación de destino nunca consume el estado de preparación mutable de otro destino.

### Selección de archivos del entorno

Los paquetes de producción pasan primero por las reglas de publicación y la instalación de dependencias de npm. [La política de archivos de Desktop](scripts/runtime-file-policy.ts) filtra después la copia inmutable `resources/nulu/node_modules` antes de la firma y el sellado de integridad. Omite declaraciones de TypeScript, mapas de código fuente de JavaScript/CSS/TypeScript reconocidos, cachés de compilación de TypeScript, el directorio de pruebas de Domino, salidas seleccionadas del compilador nativo y precompilaciones de node-pty para otras plataformas. Conserva el JavaScript de tiempo de ejecución, los módulos nativos y sus auxiliares DLL/EXE, WASM, activos desconocidos, licencias y avisos. La política no altera los tarballs de npm, el gestor de paquetes incluido ni los archivos de plugins instalados por el usuario.

La aplicación empaquetada ejecuta JavaScript compilado y metadatos Typert pregenerados; no compila plugins de TypeScript. La navegación del depurador a nivel de código fuente y las declaraciones del editor siguen disponibles en los paquetes de desarrollo. [Las pruebas de la política de copia](tests/runtime-file-policy.spec.ts) cubren las exclusiones y los activos conservados; `prepare:nulu` ejecuta el [smoke del payload](tests/fixtures/runtime-payload-smoke.mjs) bajo el Node incluido antes del smoke del Host y la verificación final del inventario.

La calificación de versiones de Windows también ejecuta [comprobaciones nativas de limpieza y reemplazo](scripts/smoke-windows.ps1) manualmente después de la compilación de Desktop. Establece `$Electron` en el ejecutable de Electron preparado y `$Makensis`, `$SevenZip` y `$PluginDir` en el compilador NSIS del builder fijado, el ejecutable de 7-Zip y el directorio del plugin NSIS x86-unicode. Desde la raíz del repositorio, ejecuta el comando siguiente. Verifica la limpieza de junctions de Electron, la limpieza de archivos temporales del instalador y ambos modos de reemplazo de archivos bloqueados; no forma parte del carril de pruebas unitarias.

```powershell
pwsh -NoProfile -File apps/desktop/scripts/smoke-windows.ps1 -Electron $Electron -Makensis $Makensis -SevenZip $SevenZip -PluginDir $PluginDir
```

### Subir actualizaciones

`NULU_DESKTOP_AUTO_UPDATE_ENV` selecciona `test` o `production` tanto para la URL incrustada durante el empaquetado como para la carga posterior a COS; un valor ausente selecciona `test`. El empaquetado de prueba requiere su origen HTTPS en `DOWNLOAD_TEST_ORIGIN`, mientras que el origen de producción sigue siendo `https://download.worldapptechnologies.com`. La carga requiere además el bucket COS del despliegue seleccionado en `DOWNLOAD_TEST_COS_BUCKET` o `DOWNLOAD_PROD_COS_BUCKET`. La ruta de destino es `_/harness/desktop/stable/<target>/`, donde `target` es `mac-arm64`, `mac-x64` o `win-x64`. Los paquetes de Linux x64 incrustan el origen seleccionado, pero no son destinos de carga a COS.

El destino de actualización y las credenciales de carga siguen el despliegue seleccionado:

| Entorno | Origen público | Bucket COS | Credenciales de COS |
|---|---|---|---|
| `test` o sin definir | `DOWNLOAD_TEST_ORIGIN` | `DOWNLOAD_TEST_COS_BUCKET` | `DOWNLOAD_TEST_COS_SECRET_ID`, `DOWNLOAD_TEST_COS_SECRET_KEY` |
| `production` | `https://download.worldapptechnologies.com` | `DOWNLOAD_PROD_COS_BUCKET` | `DOWNLOAD_PROD_COS_SECRET_ID`, `DOWNLOAD_PROD_COS_SECRET_KEY` |

Empaqueta y sube un destino bajo el mismo entorno. Por ejemplo, el despliegue de prueba predeterminado usa:

```sh
export DOWNLOAD_TEST_ORIGIN='https://desktop-updates.example.com'
pnpm run package:desktop:mac:arm64

export DOWNLOAD_TEST_COS_BUCKET='<test COS bucket>'
export DOWNLOAD_TEST_COS_SECRET_ID='<test COS SecretId>'
export DOWNLOAD_TEST_COS_SECRET_KEY='<test COS SecretKey>'
pnpm run upload:mac:arm64
```

Establece `NULU_DESKTOP_AUTO_UPDATE_ENV=production` antes de empaquetar y luego proporciona `DOWNLOAD_PROD_COS_BUCKET` y el par de credenciales de producción antes de ejecutar `upload:mac:arm64`, `upload:mac:x64` o `upload:win:x64`. El empaquetado no requiere un bucket COS ni credenciales. Deshabilita explícitamente la publicación de electron-builder, elimina los cuatro campos de credenciales de COS de sus subprocesos y escribe un registro de finalización del destino solo después de que electron-builder y cada hook de firma o notarización tengan éxito. La carga requiere que ese registro coincida con el entorno seleccionado, el destino, la URL pública y la versión actual de nulu; también requiere que la versión raíz de nulu, la versión de Desktop, la versión de los metadatos del canal, los nombres de los artefactos, los tamaños y los valores SHA-512 coincidan antes de leer el par de credenciales de COS seleccionado. Sube solo los artefactos versionados inmutables de ese destino, sube en último lugar los metadatos del canal derivados de la versión con `no-cache` y nunca elimina objetos históricos. Las versiones estables usan `latest-mac.yml` o `latest.yml`; una versión preliminar como `alpha` usa `alpha-mac.yml` o `alpha.yml`, coincidiendo con el nombre de archivo emitido por electron-builder.

La configuración de macOS usa el entorno de versión requerido en lugar de aceptar el primer certificado que aparezca en un llavero. Rechaza valores vacíos, un Team ID mal formado, una identidad de firma que incluya el prefijo no admitido `Developer ID Application:` de electron-builder y credenciales de notarización incompletas. El empaquetado de macOS requiere la identidad configurada y su clave privada. La preparación del entorno aplica esa identidad, una marca de tiempo segura y el runtime endurecido a cada archivo Mach-O incrustado; después de firmar la aplicación, una comprobación estricta profunda rechaza cualquier otra autoridad hoja o Team ID antes de crear los artefactos. Los comandos de instalador de macOS de destino fijo crean copias separadas de la aplicación firmada y ejecutan dos carriles de artefactos en paralelo. Un carril notariza y grapa la App antes de generar el ZIP y sus metadatos de actualización. El otro encierra su copia firmada de la App en un DMG firmado, y luego notariza, grapa y verifica el DMG; su App interna no tiene un ticket grapado individualmente. Ambos carriles deben terminar correctamente antes de que sus artefactos lleguen al directorio final y se escriba el registro de finalización de la versión. Los comandos de solo directorio también requieren credenciales de notarización y esperan a la notarización de Apple y al grapado de la App, salvo que se combinen con `--unsigned`. La [decisión de notarización paralela](../../.agents/notes/implemented/process/2026-09-09-parallel-macos-notarization.md) posee el aislamiento de copias y la semántica de tickets de contenedor. La clave privada puede proceder del llavero de inicio de sesión o de la entrada estándar `CSC_LINK` de electron-builder; las variables ambientales `CSC_NAME` y el orden de descubrimiento de certificados no seleccionan el propietario de la versión. Las credenciales del notario pueden usar en su lugar la estrategia completa de Apple ID o de perfil de llavero de electron-builder. Las dos variables de identidad de macOS también son necesarias al repetir manualmente la comprobación de la aplicación con `pnpm --dir apps/desktop run verify:mac-signature -- <path-to-app>`.

La firma de macOS recorre archivos reales sin seguir alias de enlaces simbólicos de Framework. Los recursos PAK conservan todos los idiomas distribuidos y se sellan mediante la firma del Framework o de la aplicación que los contiene en lugar de recibir firmas individuales. La [política de versiones](../../.agents/notes/implemented/architecture/2026-08-25-electron-desktop-packaging-and-updates.md) posee el parche de dependencias y los requisitos de verificación.

Los proxies de la empresa pueden acelerar las cargas al servicio de notarización de Apple. Consulta la documentación interna de la empresa para la configuración.

### Instaladores de prueba sin firma para Windows y macOS

En Windows x64 y macOS, usa los comandos completos de empaquetado sin firma para pruebas de instalación local:

```sh
pnpm run package:desktop:win:x64:unsigned
pnpm run package:desktop:mac:arm64:unsigned
pnpm run package:desktop:mac:x64:unsigned
```

Cada comando requiere `NULU_DESKTOP_APP_ID` y las dependencias de compilación normales, incluidas las herramientas de compilación de Python y Visual C++ para módulos nativos en Windows. Establece `PYTHON` en el ejecutable de Python cuando no esté en `PATH`. Los comandos sin firma escriben los instaladores en `.desktop-build/targets/<target>/unsigned-artifacts/`, omiten la configuración de actualización automática, eliminan las credenciales de firma y notarización y no crean ningún registro de finalización de versión. No requieren credenciales de firma de código ni un origen de actualización. Los comandos de empaquetado y carga con firma conservan sus requisitos de versión. Los paquetes de Linux x64 no están firmados por construcción y no necesitan ningún indicador adicional.

### Firma EV de Windows

El empaquetado de Windows fija el filtro de 7-Zip en `BCJ` por compatibilidad con el decodificador NSIS incluido. Esto conserva los binarios ARM64 que las dependencias incluyen en los instaladores x64; el filtrado ARM64 automático produce entradas que este decodificador no puede extraer.

NSIS elimina su árbol temporal de extracción durante la instalación, antes de la página de finalización o de un lanzamiento automático. Los paquetes de producción instalados siguen siendo archivos normales; el inicio no los vuelve a extraer. La instalación sigue escribiendo el árbol completo de la aplicación.

El empaquetado de versiones de Windows requiere que `NULU_DESKTOP_WINDOWS_CER_FILE` identifique el certificado hoja EV de GlobalSign público, que `NULU_DESKTOP_WINDOWS_SIGNTOOL` identifique el ejecutable SignTool compatible con SafeNet, que `NULU_DESKTOP_WINDOWS_KEY_CONTAINER` identifique el contenedor de clave privada correspondiente y que `NULU_DESKTOP_WINDOWS_TOKEN_PIN` contenga la contraseña del token SafeNet. El archivo del certificado permanece fuera del control de código fuente y la clave privada correspondiente permanece en el token USB. Establece las cuatro entradas antes de ejecutar el destino fijo de Windows:

```powershell
$env:NULU_DESKTOP_WINDOWS_CER_FILE = 'C:\path\to\server.cer'
$env:NULU_DESKTOP_WINDOWS_SIGNTOOL = 'C:\path\to\the\validated\signtool.exe'
$env:NULU_DESKTOP_WINDOWS_KEY_CONTAINER = '<SafeNet private-key container name>'
$env:NULU_DESKTOP_WINDOWS_TOKEN_PIN = '<SafeNet Token Password>'
pnpm run package:desktop:win:x64
```

Inserta y desbloquea el token antes de empaquetar. El hook de electron-builder pasa cada artefacto al archivo CRLF `scripts/windows-sign.cmd`, que invoca el SignTool configurado una vez con `/f`, SafeNet `/kc "[{{PIN}}]=container"`, `/csp "eToken Base Cryptographic Provider"`, un resumen de archivo SHA-256 y una marca de tiempo DigiCert SHA-256 RFC 3161. El hook nunca sustituye el SignTool incluido de electron-builder y nunca reintenta una solicitud de firma fallida. El empaquetado de versiones de Windows falla en lugar de emitir artefactos sin firma cuando el SignTool, el certificado, el contenedor, el PIN, el token o la firma no están disponibles.

El PIN no puede contener `]`, una comilla ni un salto de línea porque esos caracteres delimitan el valor `/kc` de SafeNet o su argumento CMD. El CMD deshabilita la expansión retardada para que un PIN que contenga `!` llegue a SafeNet sin cambios. El empaquetado retiene todos los campos `NULU_DESKTOP_WINDOWS_*` de los subprocesos de compilación y preparación del entorno, entrega a electron-builder solo las cuatro entradas configuradas, entrega al CMD de firma solo los campos de firma validados en un entorno por lo demás limpio, borra esos campos antes de que se inicie SignTool y redacta el diagnóstico de SignTool. SafeNet sigue requiriendo el PIN en la línea de comandos del proceso SignTool. Inyéctalo como un secreto efímero solo en un runner de Windows autohospedado controlado con el token físico conectado; nunca lo confirmes, lo pongas en `.env` ni lo persistas como variable de entorno de usuario o de sistema de Windows.

Crea un directorio de aplicación ejecutable en lugar de un instalador usando el comando `:dir` correspondiente, por ejemplo:

```sh
pnpm run package:desktop:dir
pnpm run package:desktop:mac:arm64:dir
```

Para inspeccionar o solucionar problemas de los recursos preparados del host de destino sin invocar electron-builder, detén el mismo pipeline después de la preparación:

```sh
pnpm run prepare:desktop
```

Este comando de diagnóstico es un punto de parada alternativo, no la primera mitad de una compilación de dos comandos. Un comando `package:desktop*` posterior repite la compilación y la preparación oficiales para no consumir paquetes nulu, archivos del entorno o contenido nulu obsoletos.

Cada comando de empaquetado compila el repositorio, empaqueta los cierres de producción de primera parte con raíz en nulu y el Host privado de Desktop, compila y empaqueta el paquete de plataforma de primitivas del sistema del host que lleva el lanzador Landlock y el addon flock, y prepara ejecutables de Node y pnpm específicos del destino. `prepare:nulu` instala el grafo de producción una vez en tiempo de compilación, copia los paquetes materializados a `extraResources/nulu`, elimina los metadatos del gestor de paquetes y escribe `desktop-runtime.json` con las versiones de los paquetes compartidos y los hashes finales de los archivos. En macOS firma y verifica los archivos nativos antes de generar el inventario; electron-builder excluye este árbol ya firmado de la re-firma anidada. Las asignaciones de recursos incluyen explícitamente `nulu/node_modules`, que el filtro predeterminado de directorio raíz omite; el inventario copiado se comprueba antes de firmar y de nuevo después de firmar. La calificación del instalador firmado, la notarización, la actualización instalada y los módulos nativos específicos del destino requieren el entorno de versión.

Un artefacto desempaquetado contiene Electron, el árbol de producción materializado de nulu, Node.js y pnpm upstream, y la aplicación del shell. El tamaño del instalador y el tamaño del sistema de archivos difieren; la calificación de la versión mide ambos, además del almacenamiento de plugins del perfil y la latencia del primer inicio. El entorno de ejecución intercambia más archivos de aplicación por eliminar la instalación de paquetes del núcleo en la máquina del usuario.

## Actualizaciones

Una aplicación empaquetada comprueba su flujo de versiones específico del destino diez segundos después de que se abra la ventana principal; el elemento de menú localizado **Check for Updates…** activa la misma comprobación manualmente. Una versión disponible abre un único diálogo de confirmación nativo. Aceptarlo espera a una comprobación en curso, descarga y verifica la versión firmada de Desktop, detiene el proceso hijo nulu y entrega la instalación y el reinicio a electron-updater. El siguiente inicio muestra la página de carga local mientras reconcilia el entorno vinculado a la versión.

El empaquetado firmado emite metadatos de canal de proveedor genérico para el despliegue seleccionado por `NULU_DESKTOP_AUTO_UPDATE_ENV`. Los paquetes diferenciales NSIS y el destino ZIP de macOS permiten que electron-updater reutilice bloques sin cambios; el DMG instalado manualmente se notariza sin blockmap porque no es un payload del actualizador de macOS. El entorno y el shell siguen formando una única versión firmada de Desktop. Las credenciales de firma y notarización de macOS usan el entorno estándar de electron-builder; la firma EV de Windows usa el certificado público, el SignTool validado, el contenedor SafeNet y el PIN del runner descritos anteriormente. El entorno de versión de Desktop requerido selecciona las identidades de firma de la aplicación y de la plataforma que la compilación verifica.

## Anulaciones de bajo nivel para desarrollo

Un proceso de Electron sin empaquetar usa `.desktop-build/development/project` bajo el directorio de su aplicación como proyecto de desarrollo. `NULU_DESKTOP_NODE_BINARY`, `NULU_DESKTOP_PNPM_ENTRY` y `NULU_DESKTOP_NULU_DIR` seleccionan recursos de entorno explícitos. Las aplicaciones empaquetadas ignoran estas variables, resuelven los recursos firmados desde `process.resourcesPath` y usan el perfil gestionado de Desktop.

## Limitaciones conocidas

- La acción **Open In...** de la web está deshabilitada en Desktop porque su plugin host requiere rutas HTTP; Desktop no proporciona un `webServer`.
- La firma de versiones, la notarización, el alojamiento de actualizaciones y la calificación de artefactos instalados de versiones anteriores requieren el entorno de producción de versiones.
- Los plugins de Desktop con scripts de ciclo de vida de dependencias se rechazan a menos que su paquete aparezca en la política `allowBuilds` revisada del proyecto de escritorio.
- El shell de escritorio comparte sesiones, configuración, credenciales, espacios de trabajo y almacenamiento bajo `$NULU_HOME` con la CLI nulu, mientras que los paquetes ejecutables, la activación de plugins, los lockfiles y el estado del gestor de paquetes permanecen separados.
