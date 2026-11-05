---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-11-04-nulu-event-read-compatibility

## Summary

Retain the historical delivery receipt and web-search event declarations while registering the two Nulu event names emitted by this fork.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-11-04-nulu-event-read-compatibility
baseline: false
changes:
  - root: "event:session-log-gateway/delivery-accepted"
    previous: null
    after: "e078a516ddc6078e3edbd2ba27dead3854eab2c891ec70751b63fc126fed0d66"
    decision: same-version
  - root: "event:web/nulu-search-llm-request"
    previous: null
    after: "e714f6f6798051aa3f417936efa617688caa5f958a276044f86ed63e3d609762"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

The original session-log-deepseek/delivery-accepted and web/deepseek-search-llm-request payloads remain readable with their captured schemas. The Nulu event names add declarations without changing Session envelopes or released V0–V3 codecs. Only a Nulu delivery receipt advances the Nulu upload cursor; a historical receipt cannot acknowledge delivery to a different service. This declaration repair does not require a structural Session format increment.

<a id="verification"></a>
## Verification

The session upload regression appends a historical delivery receipt, verifies the Nulu cursor remains unset, sends the complete body, and verifies that only the new Nulu receipt advances it. The focused replay and receipt suites pass 48 tests. Release-history verification accepts all 26 captured releases and 25 comparisons, and historical-format verification accepts V0–V3 without rewriting committed generations.

<a id="dev-note"></a>
## Dev Note

None.
