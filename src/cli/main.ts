// CLI dispatch shell (one command is defined per P3 lifecycle action).
// Foundation scope: parse + route. Network execution requires a live Bee and is
// performed in the core phase; nothing here touches credentials at rest.

import { parseArgs } from 'node:util';

const COMMANDS = ['init', 'extend', 'publish', 'handoff', 'verify', 'read'] as const;
export type CommandName = (typeof COMMANDS)[number];

export interface CliRequest {
  command: string;
  options: Record<string, string | undefined>;
}

export function parseCli(argv = process.argv.slice(2)): CliRequest {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: {} });
  const command = (positionals[0] as string | undefined) ?? 'help';
  const options: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(values)) {
    options[k] = typeof v === 'string' ? v : undefined;
  }
  return { command, options };
}

export function helpText(): string {
  return [
    'problem-3-succession',
    '',
    `Commands: ${COMMANDS.join(', ')}`,
    'Run with a live Bee node and .env values (see .env.example).',
  ].join('\n');
}

export function dispatch(argv = process.argv.slice(2)): number {
  const { command } = parseCli(argv);
  if (command === 'help') {
    process.stdout.write(helpText() + '\n');
    return 0;
  }
  if ((COMMANDS as readonly string[]).includes(command)) {
    process.stdout.write(`${command}: wired in core phase (foundation: routing only).\n`);
    return 0;
  }
  process.stderr.write(`unknown command: ${command}\n`);
  return 2;
}