/**
 * Nulu LLM API extension registry: plugins own independent top-level request
 * fields while the official adapter performs one preparation and acceptance transaction.
 * @module @worldapptechnologies/nulu-llm-api-extensions
 */
import { Context, Service } from '@worldapptechnologies/cordis';
import type { NuluLlmApiExtensionMap, NuluLlmApiExtensionProvider, NuluLlmApiExtensionRequest, PreparedNuluLlmApiExtensions } from './types.ts';
export type * from './types.ts';
declare module '@worldapptechnologies/cordis' {
    interface Context {
        nuluLlmApiExtensions: NuluLlmApiExtensionRegistry;
    }
}
/** Registry of independently owned top-level fields for official Nulu requests. */
export declare class NuluLlmApiExtensionRegistry extends Service {
    private readonly providers;
    constructor(ctx: Context);
    /**
     * Register the sole provider of one top-level request field. Registration is effect-scoped.
     * @param field - declaration-merged field owned by the provider.
     * @param provider - request-time field preparation and optional acceptance behavior.
     * @returns disposer that releases the field.
     */
    register<K extends keyof NuluLlmApiExtensionMap>(field: K, provider: NuluLlmApiExtensionProvider<NuluLlmApiExtensionMap[K]>): () => Promise<void>;
    /**
     * Prepare every currently registered field from one immutable base request.
     * Preparation failures reject before HTTP dispatch. Field values are cloned and frozen;
     * providers retain no mutable alias to the outgoing request.
     * @param request - exact serialized request facts before extension fields.
     * @returns detached fields and their idempotent joint acceptance transaction.
     */
    prepare(request: NuluLlmApiExtensionRequest): Promise<PreparedNuluLlmApiExtensions>;
}
export default NuluLlmApiExtensionRegistry;
//# sourceMappingURL=index.d.ts.map