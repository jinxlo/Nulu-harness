# Agent Note: Spanish UI language pack

Status: implemented

## Problem

The Web client and the Electron shell shipped only Chinese and English copy. Spanish-speaking users had no way to use the product in their language. About 1,300 strings live in dictionaries owned by more than forty Client packages, and this repository is regularly re-synced with its upstream. Adding a third locale to every owner's `{ zh, en }` registration would touch each of those upstream-owned files and conflict on every sync.

## Decision

Spanish ships as the Nulu-owned package [`nulu-client-ui-locale-es`](../../../../packages/client/ui-locale-es/README.md), mounted by the `nulu-web-app` bundle immediately after the locale row. Its browser half calls `ctx.locale.addLanguage({ id: 'es', label: 'Español', fallback: 'en' })` and registers one Spanish dictionary per namespace through the single-locale `register(ns, 'es', dict)` form. Each dictionary is typed as a partial record of its owner's `LocaleNamespaceMap` keys, so a key the owner removes or renames fails typecheck, while a key the owner adds renders in English through the fallback chain until it is translated. The Settings Language row, `<html lang>`, browser-language matching, and preference persistence come from the existing language-pack support in [`nulu-client-locale`](../../../../packages/client/locale/README.md); no locale-runtime change was needed.

The pack translates 44 namespaces with neutral Latin American Spanish in the `tú` register. It leaves English in place for product names, model ids, placeholders, units identical in both languages, and the `command` namespace's `token.*` keys, because the command resolver matches only the Chinese and English tokens. The experimental agent-team namespace stays English because its package is outside the web-app roster.

The Electron shell keeps its own dictionaries in `apps/desktop/src/locale.ts`; Spanish is a third typed dictionary there, selected when the application locale starts with `es`.

Upstream-owned files touched: the web-app bundle patch and manifest (one row and one dependency), `tsconfig.base.json` path aliases, the `tsconfig.client.json` aggregate, the Client package table, and the already-protected Desktop locale module. `nulu-fork-manifest.json` lists the two web-app files so synchronization preserves the row.

## Alternatives considered

**Add `es` to `LOCALE_IDS` and every owner's typed registration.** The typed `{ zh, en }` form would then require a complete Spanish dictionary in each of the forty-plus owner packages. Every upstream sync would conflict in those files, and every upstream key addition would break typecheck until translated.

**One untyped JSON catalog.** A flat file is easy to hand to translators, but stale keys would go unnoticed until a reader saw English, and placeholder drift would have no compile-time owner.

**Translate the experimental agent-team namespace.** It would add a dependency from a shipped package to an experimental one that the web-app roster does not mount.

## Consequences

Upstream syncs leave Spanish working: new copy appears in English, and only removed or renamed keys need a Spanish edit, which typecheck reports. The pack depends at development time on every dictionary owner it types against. A few owners declare their namespace in a module their client entry declarations do not reference, so the pack type-imports those declaring modules directly. Registry-held text that reads its translation once, such as command descriptions, follows the same limitation as the built-in locales.

## Verification

`packages/client/ui-locale-es/tests/language-pack.client.spec.ts` runs the pack over a real `LocaleRuntime`: Español joins the catalog, selection switches copy, an omitted key falls back to English, fiber teardown removes the language and dictionaries, every Spanish key exists in its owner's English dictionary with the same placeholders, and a stale key fails typecheck. `packages/client/ui-locale-es/tests/web-app.client.spec.ts` boots the shipped web-app roster, reads Español from the Settings Language row, selects it, and observes Spanish copy, `<html lang="es">`, and the persisted preference write. `apps/desktop/tests/locale.spec.ts` covers the Desktop key set, placeholders, and `es*` locale resolution.
