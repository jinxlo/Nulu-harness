# Nulu Harness

[English](README.md) | Español

Nulu Harness (`nulu`) es un agente harness de código abierto desarrollado por [World App Technologies](https://worldapptechnologies.com).

Está construido sobre una arquitectura **todo es un plugin** y funciona con [Cordis](https://github.com/cordiverse/cordis), cuyo diseño se describe en [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512).

Documentación: [https://worldapptechnologies.github.io/nulu-harness/nulu-harness/](https://worldapptechnologies.github.io/nulu-harness/nulu-harness/)

## Vista previa para desarrolladores

Nulu Harness está en _vista previa para desarrolladores_ y evoluciona rápidamente. **HABRÁ CAMBIOS QUE ROMPAN LA COMPATIBILIDAD.**

Revisa el [aviso de seguridad](SAFETY.md) antes de ejecutar el proyecto.

## Ejecución

Nulu Harness se ejecuta de tres maneras: la aplicación de escritorio, la línea de comandos `nulu` o una copia del código fuente. Todas las rutas ejecutan el mismo harness; los datos del usuario viven bajo `$NULU_HOME` (por defecto `~/.nulu`).

### Aplicación de escritorio

Descarga el instalador para tu plataforma desde [GitHub Releases](https://github.com/worldapptechnologies/nulu-harness/releases):

| Plataforma | Instalador |
|---|---|
| Windows x64 | `nulu-harness-<version>-win-x64.exe` |
| macOS Apple silicon | `nulu-harness-<version>-mac-arm64.dmg` |
| macOS Intel | `nulu-harness-<version>-mac-x64.dmg` |
| Linux x64 | `nulu-harness-<version>-linux-x64.AppImage` |

La aplicación de escritorio incluye su propio entorno de ejecución y no necesita `Node.js`, `git` ni terminal instalados. El primer inicio muestra una pantalla de bienvenida que solicita una clave de API de World App Technologies y la guarda en el directorio local de datos de Nulu. Los instaladores actuales no están firmados, por lo que macOS y Windows pueden mostrar una advertencia de seguridad; las [notas de empaquetado de escritorio](apps/desktop/README.md) cubren los requisitos de firma.

### Ejecución desde `npm`

Instala `Node.js` (22.19+ o 24+) y ejecuta:

```sh
npx @worldapptechnologies/nulu web
```

El comando inicia la interfaz web en `http://127.0.0.1:3080` de forma predeterminada y la abre en el navegador para un inicio local. Un inicio por SSH solo imprime la URL del host porque el cliente SSH o el editor controla la dirección local reenviada. Usa `--no-open` para ejecutar el servidor sin abrir el navegador. Consulta la [guía de la interfaz web](docs/user/guide/index.md).

### Ejecución con Docker

Construye la imagen y ejecútala en segundo plano:

```sh
docker build -t nulu-harness .
docker run --network host -v nulu-data:/data/nulu nulu-harness
```

La interfaz web está en `http://127.0.0.1:3080`. El perfil incluido se enlaza solo a loopback, por lo que `--network host` es obligatorio en Linux y la publicación de puertos no puede exponer el servidor. Los datos del usuario persisten en el volumen `nulu-data`.

### Ejecución desde el código fuente

Para ejecutar desde una copia del repositorio:

```sh
git clone https://github.com/worldapptechnologies/nulu-harness.git
cd nulu-harness
pnpm install
pnpm run build
pnpm nulu web
```

`pnpm run build` prepara los artefactos del repositorio. `pnpm nulu web` usa esos artefactos compilados sin volver a compilar.

## Comunidad y soporte

- Envía comentarios o informes de errores a través de [GitHub Discussions](https://github.com/worldapptechnologies/nulu-harness/discussions).
- Añade el tema [`nulu-plugin`](https://github.com/topics/nulu-plugin) a tu repositorio de plugins para que sea más fácil de encontrar.
- Visita [World App Technologies](https://worldapptechnologies.com) para novedades de la empresa y del producto.

## Contribuir

Consulta [CONTRIBUTING.md](CONTRIBUTING.md).

## Desarrollo

Empieza por la [guía de desarrollo](docs/development.md) y la [documentación de arquitectura](docs/architecture.md).

Si eres un agente, sigue [AGENTS.md](AGENTS.md).

## Cita

```bibtex
@misc{nulu-harness2026,
  title={Nulu Harness: Everything is a Plugin},
  author={World App Technologies},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/worldapptechnologies/nulu-harness}},
}
```

## Licencia

[MIT](LICENSE)

Las dependencias de terceros y sus licencias se detallan en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
