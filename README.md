# gt

Small Bun CLI for making a new branch from a base ref.

## Usage

```bash
git clone https://github.com/gaki2/gt
cd gt
bun install
bun run init
gt
gt -b fix/custom -o origin/release/26.3.11
gt --dry-run
gt --update
```

Default behavior:

- Runs `git checkout -b <today> origin/main`
- Uses today's date as `YY.M.D`
- Applies an optional prefix from config
- Runs optional `postCheckout` commands after checkout

Quick setup after cloning:

```bash
git clone https://github.com/gaki2/gt
cd gt
bun install
bun run init
```

`bun run init` does this:

- makes `gt` executable
- runs `bun link` so `gt` is available in your terminal

`init` always resolves the repository root from the script location, so it stays safe even if you run it outside the repo root.

If `gt` is still not found afterward, add Bun's global bin directory to your `PATH`.

If you want custom config, create `gt.json` yourself in the repo root.

## Config

`gt` looks for config files in this order:

1. `--config <path>`
2. `<repo-root>/gt.json`
3. `<repo-root>/.config/gt.json`

Example config:

```json
{
  "prefix": "fix/",
  "baseRef": "origin/main",
  "postCheckout": [
    "pnpm install",
    "pnpm test"
  ]
}
```

Default values:

- `prefix`: `""`
- `baseRef`: `origin/main`
- `postCheckout`: not set, so nothing runs after checkout

## Options

- `-b`, `--branch`: branch name override
- `-o`, `--origin`: base ref override
- `-p`, `--prefix`: prefix override
- `-c`, `--config`: config path override
- `--update`: update `gt` repo (`git pull --ff-only origin main`, `bun install`, `bun link`)
- `--dry-run`: print commands only

## Test

```bash
bun test
```
