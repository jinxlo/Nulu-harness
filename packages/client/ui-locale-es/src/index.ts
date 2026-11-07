/**
 * Spanish language-pack plugin, node half. The empty apply gives Loader a
 * host-side row while the browser half ships through `exports["./client"]`.
 */

/** Host plugin body — this package contributes browser dictionaries only. */
export function apply(): void {}
