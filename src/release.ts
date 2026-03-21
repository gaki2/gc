import { chmod, cp, mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

type ReleaseOptions = {
	version?: string;
	title?: string;
	draft: boolean;
	buildOnly: boolean;
	dryRun: boolean;
	skipTest: boolean;
};

function parseArgs(argv: string[]): ReleaseOptions {
	const options: ReleaseOptions = {
		draft: false,
		buildOnly: false,
		dryRun: false,
		skipTest: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--version") {
			options.version = argv[++index];
		} else if (arg === "--title") {
			options.title = argv[++index];
		} else if (arg === "--draft") {
			options.draft = true;
		} else if (arg === "--build-only") {
			options.buildOnly = true;
		} else if (arg === "--dry-run") {
			options.dryRun = true;
		} else if (arg === "--skip-test") {
			options.skipTest = true;
		} else if (arg === "-h" || arg === "--help") {
			printHelp();
			process.exit(0);
		} else {
			throw new Error(`Unknown option: ${arg}`);
		}

		if ((arg === "--version" || arg === "--title") && !argv[index]) {
			throw new Error(`Missing value for ${arg}`);
		}
	}

	return options;
}

function printHelp(): void {
	console.log(`release helper

Usage:
  bun run release
  bun run release --version 26.3.22 --title "v26.3.22"

Options:
  --version <v>    Release version (default: package.json version)
  --title <title>  Release title (default: tag)
  --draft          Create GitHub draft release
  --build-only     Build artifact only (skip gh release create)
  --skip-test      Skip pre-release bun test
  --dry-run        Print commands only
  -h, --help       Show help`);
}

async function runCommand(command: string[], cwd: string, dryRun = false): Promise<void> {
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

async function main(argv = process.argv.slice(2)): Promise<number> {
	try {
		const options = parseArgs(argv);
		const repoRoot = resolve(import.meta.dir, "..");
		const pkgRaw = await readFile(join(repoRoot, "package.json"), "utf8");
		const pkg = JSON.parse(pkgRaw) as { version?: string };

		const version = options.version ?? pkg.version;
		if (!version) {
			throw new Error("Could not resolve version. Pass --version.");
		}

		const tag = version.startsWith("v") ? version : `v${version}`;
		const title = options.title ?? tag;
		const distDir = join(repoRoot, "dist");
		const stagingDir = join(distDir, "gt");
		const artifactName = `gt-${tag}.tar.gz`;
		const artifactPath = join(distDir, artifactName);

		if (!options.skipTest) {
			await runCommand(["bun", "test"], repoRoot, options.dryRun);
		}

		if (!options.dryRun) {
			await rm(stagingDir, { recursive: true, force: true });
			await mkdir(stagingDir, { recursive: true });

			await cp(join(repoRoot, "src"), join(stagingDir, "src"), { recursive: true });
			await cp(join(repoRoot, "gt"), join(stagingDir, "gt"));
			await cp(join(repoRoot, "package.json"), join(stagingDir, "package.json"));
			await cp(join(repoRoot, "README.md"), join(stagingDir, "README.md"));
			if (await Bun.file(join(repoRoot, "gt.json.example")).exists()) {
				await cp(join(repoRoot, "gt.json.example"), join(stagingDir, "gt.json.example"));
			}
			if (await Bun.file(join(repoRoot, "bun.lockb")).exists()) {
				await cp(join(repoRoot, "bun.lockb"), join(stagingDir, "bun.lockb"));
			}
			await chmod(join(stagingDir, "gt"), 0o755);
		}

		await runCommand(["tar", "-czf", artifactPath, "gt"], distDir, options.dryRun);

		if (options.buildOnly) {
			console.log(`Built ${artifactPath}`);
			return 0;
		}

		const ghArgs = [
			"gh",
			"release",
			"create",
			tag,
			artifactPath,
			"--title",
			title,
			"--generate-notes",
		];
		if (options.draft) {
			ghArgs.push("--draft");
		}

		await runCommand(ghArgs, repoRoot, options.dryRun);
		console.log(`Release ready: ${tag}`);
		return 0;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(message);
		return 1;
	}
}

const exitCode = await main();
process.exit(exitCode);
