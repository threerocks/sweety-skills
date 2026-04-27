---
name: sweety-image-exif
description: Modifies image EXIF metadata to Apple / iPhone 16 Pro Max and removes origin/source tags. Use when user asks to rewrite photo metadata or sanitize image EXIF for mobile-camera appearance.
version: 1.0.0
metadata:
  openclaw:
    homepage: https://github.com/sweety/sweety-skills#sweety-image-exif
    requires:
      anyBins:
        - bun
        - npx
---

# Image EXIF Modifier

Updates image metadata so the camera make/model appears as `Apple / iPhone 16 Pro Max`, clears source/origin-related EXIF fields, and removes macOS download-source metadata such as `kMDItemWhereFroms` when permissions allow.

## Script Directory

Scripts are in the `scripts/` subdirectory. `{baseDir}` = this SKILL.md file's directory path. Resolve `${BUN_X}` runtime: if `bun` installed → `bun`; if `npx` available → `npx -y bun`; else suggest installing bun. Replace `{baseDir}` and `${BUN_X}` with actual values.

| Script | Purpose |
|--------|---------|
| `scripts/main.ts` | CLI for rewriting image EXIF metadata |

## Usage

```bash
${BUN_X} {baseDir}/scripts/main.ts <input> [options]
```

When `<input>` is a directory, all supported image files within the directory (and subdirectories) are processed recursively.

## Options

| Option | Short | Description |
|--------|-------|-------------|
| `<input>` | | File or directory | Required |
| `--output` | `-o` | Output file path (only for single file input) | Default: overwrite input or create `-exif` copy when `--keep` |
| `--keep` | `-k` | Keep original file when processing in place | false |
| `--recursive` | `-r` | Process directories recursively (default for directories) | true for directories |
| `--json` | | Emit JSON report | false |
| `-h`, `--help` | | Show help | |

## Notes

- Requires `sharp` to be available in the runtime environment.
- If `sharp` is not installed, the script will prompt to install it with `bun add sharp` or `npm install sharp`.
- For safe in-place overwrite, the script writes to a temporary file then atomically replaces the original.
- On macOS, the script removes all embedded metadata first, then rewrites `Make` and `Model`, and also clears Finder "Where from" download-source metadata by removing extended attributes from the processed file. This may require running outside a restrictive sandbox for files outside the writable workspace.

## Examples

```bash
# Process single image, overwrite original
${BUN_X} {baseDir}/scripts/main.ts photo.jpg

# Process single image, keep original
${BUN_X} {baseDir}/scripts/main.ts photo.jpg --keep

# Process directory recursively (default behavior)
${BUN_X} {baseDir}/scripts/main.ts /user/tmp/

# Process directory, keep originals
${BUN_X} {baseDir}/scripts/main.ts /user/tmp/ --keep

# JSON output
${BUN_X} {baseDir}/scripts/main.ts /user/tmp/ --json
```

**Output**:
```
/user/tmp/photo1.jpg → /user/tmp/photo1.jpg (exiftool)
/user/tmp/subdir/photo2.png → /user/tmp/subdir/photo2.png (exiftool)
```

## Extension Support

Custom configurations via EXTEND.md. See **Script Directory** section for the expected base directory.
