/** Provider-specific JSON and contribution types for Nulu request extensions. */
/** Lossless JSON value accepted by the Nulu request body. */
export type NuluLlmApiJson = null | boolean | number | string | NuluLlmApiJson[] | {
    [key: string]: NuluLlmApiJson;
};
/**
 * Merge-extensible table of top-level Nulu request extension fields.
 * Contributor packages declaration-merge the field they own.
 */
export interface NuluLlmApiExtensionMap {
}
/** Exact serialized request facts visible to extension providers. */
export interface NuluLlmApiExtensionRequest {
    /** Base Nulu request body before extension fields are merged. */
    readonly body: Readonly<Record<string, NuluLlmApiJson>>;
    /** Session identity carried by the model request, when present. */
    readonly sessionId?: string;
    /** Auxiliary request classification, when present. */
    readonly purpose?: 'compaction' | 'session-title';
    /** Cancellation for request preparation; providers must stop promptly after abort. */
    readonly signal: AbortSignal;
}
/** One prepared field value and its optional post-2xx commit. */
export interface PreparedNuluLlmApiExtension<T extends NuluLlmApiJson> {
    /** Detached value merged under the provider's registered field. */
    readonly value: T;
    /** Commit state that depends on confirmed provider acceptance. */
    accept?(): void | Promise<void>;
}
/** Provider registered under one key of {@link NuluLlmApiExtensionMap}. */
export interface NuluLlmApiExtensionProvider<T extends NuluLlmApiJson> {
    /**
     * Prepare one field for an exact serialized request.
     * @param request - immutable base request facts.
     * @returns the prepared field, or `undefined` when this request has no value for it.
     */
    prepare(request: NuluLlmApiExtensionRequest): PreparedNuluLlmApiExtension<T> | undefined | Promise<PreparedNuluLlmApiExtension<T> | undefined>;
}
/** All fields prepared for one request plus their joint acceptance transaction. */
export interface PreparedNuluLlmApiExtensions {
    /** Detached top-level fields to merge into the base request. */
    readonly fields: Readonly<Partial<NuluLlmApiExtensionMap>>;
    /**
     * Commit every captured provider after HTTP 2xx. Repeated calls join the same settlement.
     * @returns fulfillment after every commit succeeds.
     */
    accept(): Promise<void>;
}
//# sourceMappingURL=types.d.ts.map