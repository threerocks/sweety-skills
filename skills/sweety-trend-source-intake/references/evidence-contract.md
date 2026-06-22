# Trend Source Evidence Contract

## Output Contract

Every evidence pack must answer:

- What decision is being supported?
- Which sources were searched?
- Which URLs were read in full?
- What did each source actually say?
- What can be safely claimed?
- What cannot be claimed?
- Which downstream project gate must decide next?

## Evidence Strength

| Level | Evidence | Use |
|---|---|---|
| A | Official page, original post, platform page, primary source | Can support factual claims if directly stated |
| B | Scraped article, reputable media, high-signal public post | Can support trend/context claims with caution |
| C | Search result title/snippet only | Discovery only; do not use as final factual proof |
| D | Aggregated or ambiguous mention | Use only as weak context |

## Project Decision Rules

For content selection:

- Prefer one executable recommendation over a menu when the project expects automatic selection.
- Record rejected candidates and the reason each was rejected.
- Treat popularity as an entry point, not as a publish reason.

For WeChat or public publishing:

- Run title trust and platform risk gates after evidence collection.
- Do not turn conflict, sexuality, fear, medical claims, financial claims, or job promises into click hooks without project-specific approval.

For product or outfit selection:

- Do not claim sales, inventory, price, brand endorsement, or personal purchase unless verified from an appropriate source.
- Reject candidates that are visually unreadable, off-account, or likely to distort the character/line.

For X/Twitter:

- Use X as a primary source for tech, AI, creator, sports, and English discourse.
- Use X as secondary or weak context for Chinese lifestyle, mom outfits, office lunch, and WeChat-specific topics.
- Scrape selected X URLs only; avoid bulk X scraping.
