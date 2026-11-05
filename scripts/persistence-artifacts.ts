/** Render the English persistence document without translation sidecars. */

/** One repository-relative generated file and its complete UTF-8 content. */
export interface PersistenceArtifact {
  readonly path: string
  readonly content: string
}

/**
 * Return one complete English document without filesystem mutation.
 * @param source - repository-relative document path.
 * @param content - authored or generated English Markdown.
 * @returns the document to write or compare.
 */
export function renderPersistenceDocument(source: string, content: string): PersistenceArtifact[] {
  return [{ path: source, content }]
}
