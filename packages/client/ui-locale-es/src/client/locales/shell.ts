/** Spanish dictionaries for the namespaces owned by `nulu-client-locale`. */
import type { SpanishDictionary } from './types.ts'

/** `common`: shared cross-feature vocabulary. */
export const common = {
  'ok': 'Aceptar',
  'cancel': 'Cancelar',
  'close': 'Cerrar',
  'copy': 'Copiar',
  'copied': 'Copiado',
  'copy.failed': 'No se pudo copiar',
  'copy.value': 'Copiar valor',
  'copy.json': 'Copiar JSON',
  'copy.path': 'Copiar ruta de la propiedad',
  'copy.prettyJson': 'Copiar JSON con formato',
  'copy.compactJson': 'Copiar JSON compacto',
  'copy.optionsHint': '{action}; clic derecho para más opciones de copia',
  'retry': 'Reintentar',
  'loading': 'Cargando…',
  'load.failed': 'No se pudo cargar',
  'submit': 'Enviar',
  'submitting': 'Enviando…',
  'next': 'Siguiente',
  'previous': 'Anterior',
  'skip': 'Omitir',
  'delete': 'Eliminar',
  'edit': 'Editar',
  'save': 'Guardar',
  'search': 'Buscar',
  'more': 'Más',
  'collapse': 'Contraer',
  'expand': 'Expandir',
  'back': 'Atrás',
  'brand.localBuild': 'Compilación local de NULU',
  'unknown': 'Desconocido',
  'none': 'Ninguno',
  'truncated': 'Truncado',
  'markdown.footnotes': 'Notas al pie',
  'markdown.truncatedCharacters': '… truncado en {total} caracteres',
} satisfies SpanishDictionary<'common'>

/** `settings.locale`: the Language settings row. */
export const settingsLocale = {
  'language.title': 'Idioma',
} satisfies SpanishDictionary<'settings.locale'>
