# Style Maintenance (sweety-comic)

## Adding a New Style

1. Create style definition: `skills/sweety-comic/references/styles/<style-name>.md`
2. Update SKILL.md: add to `--style` options table + auto-selection entry
3. Generate showcase image:
   ```bash
   ${BUN_X} skills/sweety-danger-gemini-web/scripts/main.ts \
     --prompt "A single comic book page in <style-name> style showing [scene]. Features: [characteristics]. 3:4 portrait aspect ratio comic page." \
     --image screenshots/comic-styles/<style-name>.png
   ```
4. Compress: `${BUN_X} skills/sweety-compress-image/scripts/main.ts screenshots/comic-styles/<style-name>.png`
5. Update both READMEs (`README.md` + `README.zh.md`): add style to options, description table, preview grid

## Updating an Existing Style

1. Update style definition in `references/styles/`
2. Regenerate showcase image if visual characteristics changed (steps 3-4 above)
3. Update READMEs if description changed

## Deleting a Style

1. Delete style definition + showcase image (`.webp`)
2. Remove from SKILL.md `--style` options + auto-selection
3. Remove from both READMEs (options, description table, preview grid)

## Style Preview Grid Format

```markdown
| | | |
|:---:|:---:|:---:|
| ![style1](./screenshots/comic-styles/style1.webp) | ![style2](./screenshots/comic-styles/style2.webp) | ![style3](./screenshots/comic-styles/style3.webp) |
| style1 | style2 | style3 |
```
