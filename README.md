# gc

Small Bun CLI for making a new branch from a base ref.

## Usage

```bash
git clone https://github.com/gaki2/gc
cd gc
bun install
bun run init
```

## Examples

```bash
# 1) Create branch from today's local date 
gc # git checkout -b 26.3.21 origin/main

# 2) Create a specific branch from default origin/main
gc -b fix/custom # git checkout -b fix/custom origin/main

# 3) Create branch from a different base ref
gc -b fix/custom -o origin/release/26.3.11 # git checkout -b fix/custom origin/release/26.3.11

# 4) Positional branch name (same as: gc -b feature/login)
gc feature/login # git checkout -b feature/login origin/main

# 5) Override prefix only for this run
gc -p hotfix/ # git checkout -b hotfix/26.3.21 origin/main

# 6) Update gc itself (pull + install + relink)
gc --update # git pull --ff-only origin main && bun install && bun link
```

## Config

`gc` looks for config files in this order:

1. `--config <path>`
2. `<repo-root>/gc.json`
3. `<repo-root>/.config/gc.json`

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
- `--update`: update `gc` repo (`git pull --ff-only origin main`, `bun install`, `bun link`)
- `--dry-run`: print commands only

## Test

```bash
bun test
```

## Release

`bun run release` runs `bun test` first and stops if tests fail.

```bash
# build artifact and create GitHub release from package.json version
bun run release

# override version/title
bun run release --version 26.3.22 --title "v26.3.22"

# build tar.gz only (no GitHub release)
bun run release --build-only

# skip tests (if you really need to)
bun run release --skip-test

# preview commands only
bun run release --dry-run
```
