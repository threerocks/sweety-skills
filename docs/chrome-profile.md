# Chrome Profile

All CDP skills share a single profile directory. Do NOT create per-skill profiles.

Override: `SWEETY_CHROME_PROFILE_DIR` env var (takes priority over all defaults).

| Platform | Default Path |
|----------|-------------|
| macOS | `~/Library/Application Support/sweety-skills/chrome-profile` |
| Linux | `$XDG_DATA_HOME/sweety-skills/chrome-profile` (fallback `~/.local/share/`) |
| Windows | `%APPDATA%/sweety-skills/chrome-profile` |
| WSL | Windows home `/.local/share/sweety-skills/chrome-profile` |

New skills: use `SWEETY_CHROME_PROFILE_DIR` only (not per-skill env vars like `X_BROWSER_PROFILE_DIR`).

## Implementation Pattern

```typescript
function getDefaultProfileDir(): string {
  const override = process.env.SWEETY_CHROME_PROFILE_DIR?.trim();
  if (override) return path.resolve(override);
  const base = process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support')
    : process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  return path.join(base, 'sweety-skills', 'chrome-profile');
}
```
