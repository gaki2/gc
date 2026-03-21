import { chmod } from "node:fs/promises";
import { join, resolve } from "node:path";

async function run(
	command: string[],
	options?: { cwd?: string },
): Promise<void> {
	console.log(`$ ${command.join(" ")}`);
	const proc = Bun.spawn(command, {
		cwd: options?.cwd,
		stdout: "inherit",
		stderr: "inherit",
	});
	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		throw new Error(`Command failed with exit code ${exitCode}`);
	}
}

async function main(): Promise<number> {
	try {
		const repoRoot = resolve(import.meta.dir, "..");
		const cliPath = join(repoRoot, "gt");

		await chmod(cliPath, 0o755);

		await run(["bun", "link"], { cwd: repoRoot });

		console.log("\nSetup complete.");
		console.log("You can now run `gt` from your terminal.");
		console.log(
			"If `gt` is not found, add Bun's global bin directory to your PATH.",
		);
		return 0;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(message);
		return 1;
	}
}

const exitCode = await main();
process.exit(exitCode);
