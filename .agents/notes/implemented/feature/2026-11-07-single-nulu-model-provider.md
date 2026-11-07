# Agent Note: One Nulu model provider

Status: implemented

## Problem

Nulu Harness 1.6.x listed the same two models (Nulu 5 Ultra, Nulu 5 Pro) under two providers in the model picker and the Models settings page: "Nulu", served by the native `llm-gateway` route `worldapp-gateway`, and "World App Technologies", a `worldapp` profile the base composition gave the pi-ai adapter. Both routes call the same World App Technologies endpoint with the same key, so the picker showed every model twice.

## Decision

The base composition serves Nulu models only through `worldapp-gateway`, the route web search, file uploads, and session titles already use. The pi-ai adapter is mounted without profiles, as upstream mounts it, so it adds routes only when a user configures a provider on the Models page. The default model is `worldapp-gateway/nulu-5-ultra`, and first-run onboarding offers the key field of that route only.

A default model a 1.6.x user saved through the retired route still works: `agent-default-model` takes `renamedProviders`, and the base composition maps `worldapp` to `worldapp-gateway`. A session whose own selection names `worldapp` shows that selection as not routable until the user picks a Nulu model again.

## Alternatives considered

- **Keep the pi-ai profile and unmount `llm-gateway`.** Web search names `worldapp-gateway` as its search provider and several plugins depend on the native adapter; removing it would remove those features.
- **Hide one route from the picker.** The catalog has no hidden-route concept, and a hidden route would still appear on the Models page and in onboarding.

## Consequences

The base composition matches upstream's provider layout again, so upstream changes to the pi-ai block merge without a Nulu conflict. A user who wants the pi-ai protocol for Nulu models can still add a profile on the Models page; it then appears as a second provider by the user's choice.
