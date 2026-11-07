/** Spanish dictionaries for the sidebars, workspace list, and document previews. */
import type { DirectoryBrowserKey, SpanishDictionary } from './types.ts'

/** `sidebar`: the left sidebar chrome (`nulu-client-ui-sidebar`). */
export const sidebar = {
  'session.new': 'Nueva sesión',
  'session.new.label': 'Nueva sesión',
  'toggle.open': 'Abrir barra lateral',
  'toggle.collapse': 'Contraer barra lateral',
  'panels.label': 'Paneles globales',
} satisfies SpanishDictionary<'sidebar'>

/** `workspace`: the workspace and session list (`nulu-client-ui-workspace`). */
export const workspace = {
  'group.ungrouped': 'Sin agrupar',
  'session.new': 'Nueva sesión',
  'section.workspaces': 'Espacios de trabajo',
  'section.sessions': 'Sesiones',
  'viewOptions.label': 'Opciones de vista',
  'groupBy.label': 'Agrupar por',
  'groupBy.workspace': 'Espacio de trabajo',
  'groupBy.flat': 'En una sola lista',
  'orderBy.label': 'Ordenar por',
  'orderBy.manual': 'Manual',
  'orderBy.updated': 'Última actualización',
  'sessions.expand': 'Mostrar {n} sesiones más',
  'sessions.collapse': 'Mostrar menos',
  'empty.none': 'Aún no hay sesiones',
  'empty.noMatches': 'Sin coincidencias',
  'workspace.add': 'Agregar espacio de trabajo',
  'search.sessions.aria': 'Buscar sesiones',
  'search.placeholder': 'Buscar sesiones…',
  'search.clear': 'Borrar búsqueda',
  'search.results.aria': 'Resultados de la búsqueda',
  'search.pending': 'Buscando en el historial de sesiones…',
  'search.unavailable': 'La búsqueda de contenido no está disponible temporalmente. Se muestran las coincidencias por nombre.',
  'search.noMatches': 'No hay sesiones que coincidan',
  'search.hasMore': 'Se muestran los primeros {n} resultados. Acota tu búsqueda.',
  'menu.addWorkspace': 'Agregar espacio de trabajo…',
  'picker.loading': 'Cargando espacios de trabajo…',
  'conflict.named': 'Ya existe un espacio de trabajo llamado “{name}”.',
  'folderError.title': 'No se pudo abrir la carpeta',
  'folderError.retry': 'Elegir de nuevo',
  'rename': 'Cambiar nombre',
  'rename.workspace.title': 'Cambiar nombre del espacio de trabajo',
  'rename.session.title': 'Cambiar nombre de la sesión',
  'field.workspaceName': 'Nombre del espacio de trabajo',
  'field.sessionName': 'Nombre de la sesión',
  'delete.workspace': 'Eliminar espacio de trabajo',
  'delete.desc': 'Esto quita “{name}” de la lista de espacios de trabajo. La carpeta y los registros de sesión se conservan. Sus sesiones aparecerán en Sin agrupar.',
  'delete.pending': 'Eliminando espacio de trabajo…',
  'menu.fork': 'Bifurcar sesión',
  'menu.archiveSession': 'Archivar sesión',
  'sessions.count.one': '{n} sesión',
  'sessions.count.other': '{n} sesiones',
  'actions.workspace.aria': 'Acciones del espacio de trabajo {name}',
  'actions.session.aria': 'Acciones de la sesión {name}',
  'actions.newSession.aria': 'Nueva sesión en {name}',
  'status.running': 'En ejecución',
  'status.subagentsRunning.one': '{n} subagente en ejecución',
  'status.subagentsRunning.other': '{n} subagentes en ejecución',
  'status.idle': 'Inactiva',
  'status.waitingApproval': 'Esperando aprobación',
  'status.planReview': 'Plan pendiente de revisión',
  'status.waitingAnswer': 'Esperando respuesta',
  'status.completed': 'Completada',
  'schedule.active': 'Tiene una tarea programada activa',
  'hover.created': 'Creada {time}',
  'hover.copied': 'Copiado',
  'time.now': 'ahora',
  'time.months': '{n}mes',
  'time.years': '{n}a',
  'time.ago': 'hace {t}',
} satisfies SpanishDictionary<'workspace'>

/** `sidebarRight`: the right sidebar dock (`nulu-client-ui-sidebar-right`). */
export const sidebarRight = {
  'chrome.expand': 'Abrir barra lateral',
  'chrome.expandAria': 'Abrir barra lateral derecha',
  'chrome.collapse': 'Contraer barra lateral',
  'chrome.collapseAria': 'Contraer barra lateral derecha',
  'chrome.toFullscreen': 'Pantalla completa',
  'chrome.exitFullscreen': 'Salir de pantalla completa',
  'dock.emptyPane': 'Panel vacío',
  'dock.splitPane': 'Dividir',
  'dock.splitPaneDisabled': 'El límite es de dos paneles',
  'dock.splitPaneNarrow': 'No hay espacio suficiente para dividir; amplía la barra lateral',
  'dock.closeTab': 'Cerrar',
  'dock.addTab': 'Nueva pestaña',
  'dock.dockFloat': 'Devolver a la barra lateral',
  'dock.closeFloat': 'Cerrar',
  'dock.drop.center': 'Mover aquí',
  'dock.drop.left': 'Agregar división a la izquierda',
  'dock.drop.right': 'Agregar división a la derecha',
  'dock.drop.top': 'Agregar división arriba',
  'dock.drop.bottom': 'Agregar división abajo',
  'tab.guide.title': 'Inicio',
  'tab.unavailable': 'Todavía no hay nada aquí que pueda mostrar este tipo de contenido.',
} satisfies SpanishDictionary<'sidebarRight'>

/** `sidebarFiles`: the workspace file tree tab (`nulu-client-ui-sidebar-files`). */
export const sidebarFiles = {
  'type.label': 'Archivos',
  'guide.title': 'Archivos del espacio de trabajo',
  'guide.description': 'Explora los archivos del espacio de trabajo de esta sesión',
  loading: 'Leyendo…',
  empty: 'Directorio vacío',
  truncated: 'Hay demasiadas entradas; solo se muestran algunas.',
  noWorkspace: 'Esta sesión no tiene directorio de espacio de trabajo.',
  reload: 'Recargar',
  'entry.other': 'No es un archivo ni un directorio, así que no se puede abrir.',
  'error.notFound': 'Ese directorio ya no existe. Es posible que se haya movido o eliminado.',
  'error.outsideWorkspace': 'Ese directorio está fuera del espacio de trabajo, así que la barra lateral no lo leerá.',
  'error.notDirectory': 'Eso no es un directorio.',
  'error.unavailable': 'Error de lectura: {message}',
} satisfies SpanishDictionary<'sidebarFiles'>

/** `sidebarTerminal`: the terminal tab (`nulu-client-ui-sidebar-terminal`). */
export const sidebarTerminal = {
  recoveryFailed: 'No se pudo recuperar la terminal: {message}',
  retryRecovery: 'Reintentar la recuperación de la terminal',
  shell: 'Elegir shell',
  shellLoading: 'Cargando shells…',
  shellEmpty: 'No hay shells disponibles',
  description: 'Ejecuta comandos en el espacio de trabajo de la sesión',
  title: 'Terminal',
  new: 'Nueva terminal',
  loading: 'Leyendo el entorno de la terminal…',
  creating: 'Iniciando…',
  connecting: 'Conectando…',
  disconnected: 'Desconectada.',
  reconnect: 'Reconectar',
  readonly: 'Esta vista es de solo lectura.',
  control: 'Tomar el control',
  closed: 'Terminal cerrada.',
  exited: 'El proceso terminó ({code})',
  failed: 'Error de la terminal: {message}',
  rename: 'Nombre de la terminal',
  unavailable: 'No disponible',
  retry: 'Reintentar',
  cleanupFailed: 'No se pudo cerrar la terminal “{title}”: {message}',
  missingTerminal: 'Esta terminal ya no existe. Abre una terminal nueva.',
  inputFull: 'El búfer de entrada está lleno. Reconecta e inténtalo de nuevo.',
  attachmentEnded: 'La conexión con la terminal terminó. Reconecta para continuar.',
  invalidOutput: 'No se pudo recibir la pantalla de la terminal. Reconecta para recuperarla.',
  terminalLimit: 'Se alcanzó el límite de terminales. Cierra las que no uses e inténtalo de nuevo. Las terminales cuyo proceso terminó también cuentan para el límite.',
} satisfies SpanishDictionary<'sidebarTerminal'>

/** `sidebarDocumentPreview`: the document preview tab (`nulu-client-ui-sidebar-documentpreview`). */
export const sidebarDocumentPreview = {
  loading: 'Leyendo…',
  loadMore: 'Cargar más',
  changed: 'El archivo cambió; se muestra el contenido anterior.',
  reloadNow: 'Recargar',
  reload: 'Volver a leer el archivo',
  'wrap.enable': 'Activar ajuste de línea',
  'wrap.disable': 'Desactivar ajuste de línea',
  'wrap.aria': 'Ajuste de línea',
  openWith: 'Abrir con',
  'viewer.text': 'Texto sin formato',
  resourceUnavailable: 'El servicio de recursos de archivos no está disponible.',
  rendererUnavailable: 'La vista previa de {name} no está disponible.',
  unsupportedFile: 'Todavía no hay vista previa para este tipo de archivo.',
  'error.notFound': 'No se encontró el archivo. Es posible que se haya movido o eliminado.',
  'error.tooLarge': 'Esta página supera el límite de {limit} y no se puede leer.',
  'error.notText': 'Todavía no hay vista previa para este tipo de archivo.',
  'error.notRegularFile': 'No es un archivo normal; no hay nada que mostrar.',
  'error.unavailable': 'Error de lectura: {message}',
  retry: 'Reintentar',
} satisfies SpanishDictionary<'sidebarDocumentPreview'>

/** `documentMarkdown`: the Markdown preview. */
export const documentMarkdown = {
  'code.copy': 'Copiar',
  'code.copied': 'Copiado',
  'footnotes': 'Notas al pie',
} satisfies SpanishDictionary<'documentMarkdown'>

/** `sidebarCodePreview`: the code preview. */
export const sidebarCodePreview = {
  title: 'Código',
  copy: 'Copiar',
  copied: 'Copiado',
} satisfies SpanishDictionary<'sidebarCodePreview'>

/** `documentHtml`: the HTML preview. */
export const documentHtml = {
  frame: 'Vista previa del documento HTML',
  loading: 'Leyendo…',
  failed: 'No se pudo mostrar la vista previa de este documento HTML.',
} satisfies SpanishDictionary<'documentHtml'>

/** `sidebarImage`: the image preview. */
export const sidebarImage = {
  title: 'Imagen',
  preview: 'Vista previa de la imagen: {name}',
  loading: 'Leyendo…',
  failed: 'No se pudo mostrar esta imagen.',
  unsupported: 'La vista previa de imágenes requiere el contenido completo del archivo.',
} satisfies SpanishDictionary<'sidebarImage'>

/** `sidebarPdf`: the PDF preview. */
export const sidebarPdf = {
  pageImage: 'Página {page} del PDF',
  loading: 'Leyendo…',
  rendering: 'Renderizando página…',
  failed: 'No se puede mostrar el PDF: {message}',
  password: 'Este PDF requiere contraseña; no se admite la vista previa de archivos protegidos con contraseña.',
  workerFailed: 'El proceso de renderizado del PDF no pudo continuar. Inténtalo de nuevo.',
  unsupported: 'La vista previa de PDF requiere el contenido completo del archivo.',
  retry: 'Reintentar',
} satisfies SpanishDictionary<'sidebarPdf'>

/**
 * `directory-browser`: the Select Workspace Directory dialog
 * (`nulu-client-ui-directory-picker-browse`, registered untyped).
 */
export const directoryBrowser = {
  'browser.title': 'Seleccionar directorio del espacio de trabajo',
  'browser.home': 'Inicio',
  'browser.newFolder': 'Nueva carpeta',
  'browser.folderName': 'Nombre de la carpeta',
  'browser.createIn': 'Nueva carpeta en "{name}"',
  'browser.untitledFolder': 'Carpeta sin título',
  'browser.create': 'Crear',
  'browser.cancel': 'Cancelar',
  'browser.open': 'Abrir',
  'browser.editPath': 'Editar ruta',
  'browser.loading': 'Cargando…',
  'browser.truncated': 'Hay demasiadas carpetas para listarlas; solo se muestran las primeras.',
  'browser.showHidden': 'Mostrar archivos ocultos',
} satisfies Partial<Record<DirectoryBrowserKey, string>>

/** `reference`: the `@` reference menu (`nulu-client-ui-reference`). */
export const reference = {
  'section.files': 'Archivos y carpetas',
  'section.sessions': 'Sesiones',
  'candidate.noCwd': '(sin directorio de trabajo)',
  'crumb.root': 'Espacio de trabajo',
  'time.now': 'ahora',
  'time.months': '{n}mes',
  'time.years': '{n}a',
} satisfies SpanishDictionary<'reference'>

/** `open-in-app`: the Open In split button (`nulu-client-ui-open-in-app`); product names stay English. */
export const openInApp = {
  'open.title': 'Abrir el espacio de trabajo en {app}',
  'open.tooltip': 'Abrir localmente',
  'open.error': 'No se pudo abrir',
  'menu.toggle': 'Elegir una aplicación para abrir',
  'menu.aria': 'Abrir en',
  'app.explorer': 'Explorador de archivos',
  'app.filemanager': 'Archivos',
  'app.terminal': 'Terminal',
} satisfies SpanishDictionary<'open-in-app'>
