---
description: "Spanish language pack for the Web client: Español in the language selector with English fallback, for users choosing a language and maintainers updating translations."
kind: "package-reference"
---

# @worldapptechnologies/nulu-client-ui-locale-es


## Summary

This package adds Español to the Web client's language selector and registers neutral Latin American Spanish dictionaries for the shipped Client UI namespaces. Spanish falls back to English, so a key or namespace without a Spanish entry renders its English text instead of a bare key. It is a Nulu-owned language pack: it extends the locale catalog through the public `addLanguage` and per-locale `register` APIs and changes no dictionary owner. It does not affect model requests.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The `nulu-web-app` bundle mounts this plugin after the locale row. Open Settings → General → Language and choose Español; the choice persists like any other locale preference, and `<html lang>` becomes `es`. A browser whose preferred language is any `es-*` tag opens in Spanish when no preference is stored.

### Updating translations

Each namespace has one dictionary under [`src/client/locales/`](src/client/locales/), typed with `SpanishDictionary<'namespace'>`. A key the owner no longer declares fails typecheck; a key the owner adds later renders in English until a Spanish entry is added. Keep `{name}` placeholders, product names, model ids, keyboard shortcuts, and command tokens unchanged. Translate from the English dictionary and use the Chinese one only to resolve ambiguity.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The browser half calls `ctx.locale.addLanguage({ id: 'es', label: 'Español', fallback: 'en' })` and one `ctx.locale.register(namespace, 'es', dictionary)` per namespace, each as its own effect, so disposing the plugin removes the language and every dictionary. [`src/client/locales/types.ts`](src/client/locales/types.ts) imports each owner's client entry type-only to merge its namespaces into `LocaleNamespaceMap`; owners whose emitted entry declarations omit the merge are imported through the declaring module. The `directory-browser` namespace is registered untyped by its owner, so its key union is declared locally and checked against the registered English keys by the package spec.

The `command` namespace's `token.*` keys stay English because the command resolver accepts only the Chinese and English tokens. Compact unit formats identical in both languages are omitted and resolve through English.

| File | Role |
|---|---|
| [`src/client/index.ts`](src/client/index.ts) | Plugin body: language definition and dictionary registrations |
| [`src/client/locales/index.ts`](src/client/locales/index.ts) | Language definition and the namespace-to-dictionary table |
| [`src/client/locales/types.ts`](src/client/locales/types.ts) | Namespace merges and the `SpanishDictionary` type |
| [`src/index.ts`](src/index.ts) | Empty node half for the Loader row |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages for the locale registry this package extends and the policy that keeps Client UI copy in dictionaries.

- [nulu-client-locale](../locale/README.md) — the locale catalog, fallback chain, and language-pack registration API.
- [Locale-owned Client UI copy](../../../.agents/notes/implemented/architecture/2026-08-23-locale-owned-client-ui-copy.md) — why product text lives in typed dictionaries.
- [Spanish language pack decision](../../../.agents/notes/implemented/feature/2026-11-07-spanish-ui-language-pack.md) — why Spanish ships as a separate language pack.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package registers browser dictionaries only; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits describe where Spanish text is incomplete. They are current package constraints, not a translation backlog.

- **New upstream copy appears in English** — keys and namespaces added by their owners render in English until this package translates them.
- **The experimental agent-team namespace stays English** — `nulu-experimental-client-ui-agent-team` ships outside the web-app roster.
- **Slash command tokens stay English** — the command resolver matches only Chinese and English tokens.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The package retains no mutable state; the locale registry owns the catalog and dictionaries, and the package spec asserts registration and disposal.
