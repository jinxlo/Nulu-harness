/** Decide what a `nulu` invocation without arguments does, so the command never ends in a bare usage error. */

/**
 * Complete the launcher arguments for an invocation that named no command.
 * @param {readonly string[]} args - arguments after the command name.
 * @param {boolean} interactive - whether a person is at the terminal.
 * @returns {{ args: string[], notice?: string }} arguments for the launcher and an optional line to print first.
 */
export function startArguments(args, interactive) {
  if (args.length > 0) return { args: [...args] }
  // A person at a terminal gets the product; a script or pipe gets the command list instead of a server that never exits.
  return interactive
    ? { args: ['web'], notice: 'Starting Nulu Harness for this folder (same as "nulu web"). Run "nulu --help" for all commands.' }
    : { args: ['--help'] }
}
