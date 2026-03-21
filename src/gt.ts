import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const DEFAULT_BASE_REF = "origin/main";
const DEFAULT_LOCAL_CONFIG = "gt.json";
const DEFAULT_FALLBACK_CONFIG_DIR = ".config";

export type Config = {
	prefix?: string;
	postCheckout?: string[];
	baseRef?: string;
};

export type CliOptions = {
	name?: string;
	branch?: string;
	baseRef?: string;
	prefix?: string;
	config?: string;
	dryRun: boolean;
	update: boolean;
};

export function defaultBranchName(now = new Date()): string {
	return `${String(now.getFullYear()).slice(-2)}.${now.getMonth() + 1}.${now.getDate()}`;
}

export function applyPrefix(branchName: string, prefix = ""): string {
	if (!prefix || branchName.startsWith(prefix)) {
		return branchName;
	}
	return `${prefix}${branchName}`;
}

export function determineBranchName(
	options: CliOptions,
	config: Config,
): string {
	const branchName = options.branch ?? options.name ?? defaultBranchName();
	const prefix = options.prefix ?? config.prefix ?? "";
	return applyPrefix(branchName, prefix);
}

export async function branchExists(branchName: string): Promise<boolean> {
	const proc = Bun.spawn(["git", "show-ref", "--verify", "--quiet", `refs/heads/${branchName}`], {
		stdout: "ignore",
		stderr: "ignore",
	});
	const exitCode = await proc.exited;
	return exitCode === 0;
}

export async function resolveUniqueBranchName(
	branchName: string,
	exists: (name: string) => Promise<boolean> = branchExists,
): Promise<string> {
	if (!(await exists(branchName))) {
		return branchName;
	}

	let suffix = 1;
	while (await exists(`${branchName}_${suffix}`)) {
		suffix += 1;
	}

	return `${branchName}_${suffix}`;
}

export function normalizePostCheckout(value: unknown): string[] | undefined {
	if (value == null) {
		return undefined;
	}
	if (typeof value === "string") {
		return [value];
	}
	if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
		return value;
	}
	throw new Error("`postCheckout` must be a string or an array of strings.");
}

export async function getRepoRoot(): Promise<string | undefined> {
	const proc = Bun.spawn(["git", "rev-parse", "--show-toplevel"], {
		stdout: "pipe",
		stderr: "ignore",
	});
	const output = await new Response(proc.stdout).text();
	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		return undefined;
	}
	return output.trim() || undefined;
}

export async function resolveConfigPath(
	explicitPath?: string,
): Promise<string | undefined> {
	const candidates: string[] = [];

	if (explicitPath) {
		candidates.push(resolve(explicitPath));
	} else {
		const repoRoot = await getRepoRoot();
		if (repoRoot) {
			candidates.push(join(repoRoot, DEFAULT_LOCAL_CONFIG));
			candidates.push(join(repoRoot, DEFAULT_FALLBACK_CONFIG_DIR, DEFAULT_LOCAL_CONFIG));
		}
	}

	const seen = new Set<string>();
	for (const candidate of candidates) {
		if (seen.has(candidate)) {
			continue;
		}
		seen.add(candidate);
		if (existsSync(candidate)) {
			return candidate;
		}
	}
	return undefined;
}

export async function loadConfig(path?: string): Promise<Config> {
	if (!path) {
		return {};
	}

	const file = await readFile(path, "utf8");
	const data = JSON.parse(file) as Record<string, unknown>;

	return {
		prefix: typeof data.prefix === "string" ? data.prefix : undefined,
		baseRef: typeof data.baseRef === "string" ? data.baseRef : undefined,
		postCheckout: normalizePostCheckout(data.postCheckout),
	};
}

export function parseArgs(argv: string[]): CliOptions {
	const options: CliOptions = { dryRun: false, update: false };

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === "-b" || arg === "--branch") {
			options.branch = argv[++index];
		} else if (arg === "-o" || arg === "--origin") {
			options.baseRef = argv[++index];
		} else if (arg === "-p" || arg === "--prefix") {
			options.prefix = argv[++index];
		} else if (arg === "-c" || arg === "--config") {
			options.config = argv[++index];
		} else if (arg === "--dry-run") {
			options.dryRun = true;
		} else if (arg === "--update") {
			options.update = true;
		} else if (arg === "-h" || arg === "--help") {
			printHelp();
			process.exit(0);
		} else if (arg.startsWith("-")) {
			throw new Error(`Unknown option: ${arg}`);
		} else if (!options.name) {
			options.name = arg;
		} else {
			throw new Error(`Unexpected argument: ${arg}`);
		}

		if (
			[
				"-b",
				"--branch",
				"-o",
				"--origin",
				"-p",
				"--prefix",
				"-c",
				"--config",
			].includes(arg) &&
			!argv[index]
		) {
			throw new Error(`Missing value for ${arg}`);
		}
	}

	return options;
}

export function printHelp(): void {
	console.log(`gt - branch helper

Usage:
  gt
  gt <branch>
  gt -b fix/custom -o origin/release/26.3.11

Options:
  -b, --branch   Branch name override
  -o, --origin   Base ref override
  -p, --prefix   Prefix override
  -c, --config   Config path override
      --update   Update gt from repository
      --dry-run  Print commands only
  -h, --help     Show help`);
}

export async function runCommand(
	command: string[],
	dryRun = false,
	cwd?: string,
): Promise<void> {
	console.log(`$ ${command.join(" ")}`);
	if (dryRun) {
		return;
	}

	const proc = Bun.spawn(command, {
		cwd,
		stdout: "inherit",
		stderr: "inherit",
	});
	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		throw new Error(`Command failed with exit code ${exitCode}`);
	}
}

export function getToolRepoRoot(): string {
	return resolve(import.meta.dir, "..");
}

export async function updateGt(
	dryRun = false,
	runner: (command: string[], dryRun?: boolean, cwd?: string) => Promise<void> =
		runCommand,
): Promise<void> {
	const repoRoot = getToolRepoRoot();
	await runner(["git", "pull", "--ff-only", "origin", "main"], dryRun, repoRoot);
	await runner(["bun", "install"], dryRun, repoRoot);
	await runner(["bun", "link"], dryRun, repoRoot);
}

export async function runShellCommand(
	command: string,
	dryRun = false,
): Promise<void> {
	console.log(`$ ${command}`);
	if (dryRun) {
		return;
	}

	const proc = Bun.spawn(["sh", "-lc", command], {
		stdout: "inherit",
		stderr: "inherit",
	});
	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		throw new Error(`Command failed with exit code ${exitCode}`);
	}
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
	try {
		const options = parseArgs(argv);
		if (options.update) {
			if (options.name || options.branch || options.baseRef || options.prefix || options.config) {
				throw new Error("`--update` cannot be combined with branch options.");
			}
			await updateGt(options.dryRun);
			return 0;
		}
		const configPath = await resolveConfigPath(options.config);
		const config = await loadConfig(configPath);
		const branchName = await resolveUniqueBranchName(
			determineBranchName(options, config),
		);
		const baseRef = options.baseRef ?? config.baseRef ?? DEFAULT_BASE_REF;

		await runCommand(
			["git", "checkout", "-b", branchName, baseRef],
			options.dryRun,
		);

		for (const command of config.postCheckout ?? []) {
			await runShellCommand(command, options.dryRun);
		}

		return 0;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(message);
		return 1;
	}
}
