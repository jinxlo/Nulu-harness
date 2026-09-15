/**
 * Virtual root of the worker host's in-memory filesystem. Kept
 * in one module so the process shim, the path/os shims, and the VFS image
 * collector cannot drift apart.
 */

/** Virtual filesystem root; `process.cwd()` and every absolute path start here. */
export const NULU_ROOT = '/nulu'

/** `$NULU_HOME`: durable-state directory inside the image. */
export const NULU_HOME = `${NULU_ROOT}/home`

/** Flat, symlink-free package tree resolved by the worker module loader. */
export const NULU_NODE_MODULES = `${NULU_ROOT}/node_modules`

/** Directory holding the composed cordis.yml and the agent-preset tree. */
export const NULU_CONFIG = `${NULU_ROOT}/config`

/** Default (empty) workspace directory. */
export const NULU_WORKSPACE = `${NULU_ROOT}/workspace`

/** Temporary directory reported by `os.tmpdir()`. */
export const NULU_TMP = `${NULU_ROOT}/tmp`
