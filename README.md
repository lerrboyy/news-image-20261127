# The World in One Day — Friday 27 November 2026

[![Competition](https://make.fun/badge/news-image-20261127.svg)](https://make.fun/bounty/news-image-20261127)
[![Rank](https://make.fun/badge/news-image-20261127/lerrboyy/news-image-20261127/rank.svg)](https://make.fun/bounty/news-image-20261127)
[![Reward](https://make.fun/badge/news-image-20261127/lerrboyy/news-image-20261127/reward.svg)](https://make.fun/bounty/news-image-20261127)

A program that sums up **Friday 27 November 2026's world news in one image** —
a 1024×1024 "morning front page" drawn entirely in code.

## The image

`main.ts` (Node 22, standard library only, no network) draws an ivory
front page — **"THE WORLD IN ONE DAY"** — and writes it to
`/output/entry.png`:

- **Lead:** the storm that stopped a century of parades — New York moves the
  100th Macy's Thanksgiving Day Parade to Saturday, the first postponement
  in 100 years (60 mph gusts, 500,000+ homes without power).
- **Secondary leads:** Trump unveils new tariffs on 14 trading partners
  (China up to 40%); the Cairo Ring Road tanker fire kills at least 31.
- **Nine illustrated stories:** Bangkok refinery blast, Kim's nuclear vow,
  Russian missiles on Kyiv, Saudi missile intercepts, the EU's €1.6T
  budget, Black Friday's fake deals, Sinner out of the Australian Open,
  Sooryavanshi's 204 off 53 balls, and the FCC vs ABC ruling.
- **Plus:** a UTC timeline of the day, a world map with numbered pins,
  18 more stories in the "And also" list, and a date-check box that names
  the stale stories left out (COP31, the 25 Nov tariff proposal, and more).

Every story carries a region chip, a named source, and a status tag
(REPORTED / CONFIRMED / ONGOING). Scenes are drawn illustrations, not
photographs. The program is fully deterministic: two runs write byte-identical
PNGs (verified by SHA-256).

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
# writes out/entry.png (1024x1024, ~38 KB, well under the 1 MiB limit)
```

## Verify

```sh
MAKEFUN_OUTPUT_DIR=out2 node main.ts
sha256sum out/entry.png out2/entry.png   # identical hashes
```

## License

MIT — see [LICENSE](LICENSE).
