import { describe, expect, test } from "bun:test";

import {
	applyPrefix,
	defaultBranchName,
	determineBranchName,
	loadConfig,
	normalizePostCheckout,
	parseArgs,
	resolveUniqueBranchName,
	updateGc,
} from "../src/gc";

describe("gc", () => {
	test("defaultBranchName uses short local date", () => {
		expect(defaultBranchName(new Date(2026, 2, 12, 12, 0, 0))).toBe("26.3.12");
	});

	test("applyPrefix avoids duplicate prefixes", () => {
		expect(applyPrefix("fix/custom", "fix/")).toBe("fix/custom");
	});

	test("determineBranchName uses config prefix", () => {
		expect(
			determineBranchName(
				{ name: "custom", dryRun: false, update: false },
				{ prefix: "fix/" },
			),
		).toBe("fix/custom");
	});

	test("parseArgs supports --update", () => {
		const options = parseArgs(["--update", "--dry-run"]);
		expect(options.update).toBe(true);
		expect(options.dryRun).toBe(true);
	});

	test("normalizePostCheckout supports string", () => {
		expect(normalizePostCheckout("bun test")).toEqual(["bun test"]);
	});

	test("resolveUniqueBranchName keeps unused branch name", async () => {
		const result = await resolveUniqueBranchName("fix/custom", async () => false);
		expect(result).toBe("fix/custom");
	});

	test("resolveUniqueBranchName appends incrementing suffix", async () => {
		const taken = new Set(["fix/custom", "fix/custom_1", "fix/custom_2"]);
		const result = await resolveUniqueBranchName(
			"fix/custom",
			async (name) => taken.has(name),
		);
		expect(result).toBe("fix/custom_3");
	});

	test("loadConfig reads config file", async () => {
		const path = "/tmp/gc-config-test.json";
		await Bun.write(
			path,
			JSON.stringify({
				prefix: "fix/",
				baseRef: "origin/main",
				postCheckout: ["bun test"],
			}),
		);

		const config = await loadConfig(path);
		expect(config).toEqual({
			prefix: "fix/",
			baseRef: "origin/main",
			postCheckout: ["bun test"],
		});
	});

	test("updateGc runs pull install and link", async () => {
		const calls: Array<{ command: string[]; dryRun?: boolean; cwd?: string }> = [];
		await updateGc(true, async (command, dryRun, cwd) => {
			calls.push({ command, dryRun, cwd });
		});

		expect(calls.length).toBe(3);
		expect(calls[0]?.command).toEqual([
			"git",
			"pull",
			"--ff-only",
			"origin",
			"main",
		]);
		expect(calls[1]?.command).toEqual(["bun", "install"]);
		expect(calls[2]?.command).toEqual(["bun", "link"]);
		expect(calls.every((call) => call.dryRun === true)).toBe(true);
		expect(calls.every((call) => typeof call.cwd === "string" && call.cwd.length > 0)).toBe(true);
	});
});
