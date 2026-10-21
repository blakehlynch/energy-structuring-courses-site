# Energy Structuring Courses

Twelve interactive courses on petroleum, electricity and gas markets, price drivers, valuation, structuring and risk. They are built from the books in `BOOKS_FOLDER` and sequenced by the tiers in `energy_structuring_reading_list_v3.xlsx`. All twelve are complete: 72 modules, each with lessons, worked examples checked by code, interactive tools, a quiz with desk scenarios, and flashcards.

## Opening the courses

1. Double-click `index.html` in this folder. It opens in your default browser with no server or internet connection. KaTeX and Chart.js are bundled in `assets/vendor`.
2. The dashboard shows the twelve courses with progress bars and a **Continue** link to where you left off. A suggested order is C1, C2, C5, C11, C3, C6, C4, C7, C12, C9, C8 and then the C10 capstone. Each course overview lists its prerequisites.
3. Progress (completed modules), quiz scores (best and last attempt) and known flashcards are stored in your browser's `localStorage`. They persist between sessions in the same browser. Another browser, a private window, or clearing site data starts fresh. A **Reset all progress** button is at the bottom of the dashboard.
4. The **Auto / Light / Dark** button in the top bar switches the theme. `library.html` lists every book, how it was extracted, which courses use it, and how dated it is.

Tested in Chrome on Windows over `file://` at desktop and phone widths. Edge, Firefox and Safari should work the same; Chrome and Edge are recommended.

## What each module contains

- Learning objectives and prerequisites
- A lesson in plain language, with a citation chip on every sourced concept (hover for the full reference)
- Markers: **Synthesis** (combines books or is our own derivation from book inputs), **Outside the texts** (added from beyond the course books; verify independently), **Dated** boxes (what has changed and where to check), and **ALM analogy** boxes
- Worked examples marked *Checked by code*: every highlighted number is recomputed by the test suite from the same JavaScript library (`courses/cN/calc.js`) that drives the tools
- One or more interactive tools whose default settings reproduce a worked example
- A **Going deeper** section
- A quiz with explanations, including at least two "desk scenario" questions (a client asks for X; what do you do?)
- Flashcards, plus a course glossary and an all-terms flashcard deck

## The courses and their tools

| Course | Modules and interactive tools |
|---|---|
| **C1** Petroleum market fundamentals and price drivers | Value chain (pump-price decomposition) · Upstream supply (drilling treadmill, supply stack) · Demand, inventories and the curve (theory-of-storage explorer) · Price formation (disruption shock simulator) · Boom-bust history (investment cycle) · Geopolitics and the transition (long-run demand explorer) |
| **C2** Refining economics, crack spreads and crude differentials | Crude quality lab · Gasoline blending optimiser · Refinery builder · Crack and margin calculator, crack hedge simulator · Value-in-use calculator |
| **C3** Physical oil trading | Grade differential builder · Pricing-window exposure · Hedge P&L decomposition · Incoterms map, laytime and demurrage calculator · Voyage economics and TCE · Destination comparator · Credit exposure through a cargo's life |
| **C4** Trade and structured commodity finance | Trading-house funding needs · LC discounting · Borrowing base · Prepayment waterfall · Hedge overlay for commodity-backed loans · Securitisation loss layers · Trade-finance capital and return |
| **C5** Electricity market design and price formation | Load-duration curve builder · Screening curves and technology mix · Two-settlement calculator · Two-zone locational pricing · Missing-money calculator · Battery arbitrage on a solar-heavy day · Withholding and forward contracts |
| **C6** Forward curves and stochastic price models | Carry curve builder · Seasonal curve builder · Schwartz curve, mean-reverting jump simulator · Two-factor curve dynamics and PCA · Early-expiry term volatility, spark spread option · Stack-based hybrid power model |
| **C7** Structured products: storage, swing, tolling, spark spreads | Asian versus European · Spark-spread strip · Toll dispatch simulator · Storage valuation (intrinsic and rolling intrinsic) · Swing option explorer · Book P&L attribution |
| **C8** Real options and valuation of flexibility | The value of waiting · Real-options lattice · Investment trigger · Entry and exit band · Consolidated volatility |
| **C9** Project finance and offtake structuring | Leverage and returns · Revenue structure and debt cover · Construction risk and contingency · Debt sizing and sculpting · Borrowing base · Cash-flow waterfall |
| **C10** Capstone: origination cases | Refinery supply and offtake intermediation · CCGT tolling agreement · Storage lease · Solar virtual PPA (shape and basis) · Project-financed terminal with throughput contract |
| **C11** Natural gas and LNG | LNG chain calculator · Pipeline capacity as a spread option · Liquefaction fee and US FOB break-even · SPA price formula explorer · Voyage cost calculator · Flexible US cargo (cancel, Europe or Asia) |
| **C12** Market and counterparty risk | VaR and ES explorer (normal versus fat tails) · Spark book VaR and component VaR · VaR backtester · Gas swap exposure profile · CVA with wrong-way risk · xVA stack across CSA terms |

Inputs in the tools and worked examples are **illustrative teaching values** unless a citation says otherwise. They are chosen to show the mechanics, not to forecast markets.

## How the source material maps to the courses

Chapter- and page-level sources for every module are on each module page (Sources box) and course overview. `library.html` shows the same mapping by book.

| Course | Tier | Main sources | Supporting sources |
|---|---|---|---|
| **C1** Petroleum fundamentals | Foundation | Downey (*Oil 101*) ch.5–6, 12–14, 17–18; McNally; Yergin | Long §1.1–1.3; Kaiser §1.7, §4.1–4.6; Swindle ch.2–3; Edwards ch.1.2–1.3, 2.3; Clews ch.6, 13; Trafigura CD ch.3–4, 7; Schofield ch.5; Wynne ch.12 |
| **C2** Refining economics | Foundation | Kaiser et al. ch.1–4, 7–8, 12–20; Long §2.2–2.6, §4.1–4.2 | Downey ch.2–3, 7, 9; Edwards ch.2.3, 3.6; Schofield ch.5; Clews §7.2–7.4; Trafigura CD ch.8; Mahoney §4.2; Swindle ch.14 |
| **C3** Physical oil trading | Core | Long ch.3, 12–13, 16; Downey ch.11, 17–19, App. 1; Stopford ch.5–6 | Trafigura CD ch.4, 6–10; Schofield ch.5; Hull ch.3; Clewlow & Strickland ch.11 |
| **C4** Trade and structured commodity finance | Core | Moors & Rutten; Wynne; Trafigura CD ch.11 and PD | Long §13.3; Clews §14.5, ch.16–17 |
| **C5** Electricity markets | Foundation/Core | Kirschen & Strbac ch.1–8; Stoft Parts 1–5 | Murray ch.1–3; Edwards ch.4.2 |
| **C6** Forward curves and models | Core | Clewlow & Strickland ch.2, 4, 6, 8; Swindle ch.2, 5, 7–9, 11 | Eydeland & Wolyniec ch.6–7 |
| **C7** Structured products | Core | Swindle ch.6, 9, 13–15; Eydeland & Wolyniec ch.8–10 | Mahoney §3.1.4, ch.4; Kaminski (ed.) ch.3 |
| **C8** Real options | Secondary | Dixit & Pindyck ch.1–2, 5, 7; Copeland & Antikarov ch.4–6, 8–9 | Hull ch.36; Finnerty ch.12 |
| **C9** Project finance | Core | Yescombe ch.2, 6, 8–9, 12, 14 | Gatti ch.1; Clews ch.17–18 |
| **C10** Capstone cases | Capstone | Synthesis of C1–C9 | Trafigura CD ch.10–11; Rutten ch.5–6; Downey ch.7, 11; Edwards ch.2.3; Swindle ch.9, 13–15; Eydeland & Wolyniec ch.8–9; Mahoney §3.1.4; Kirschen & Strbac §3.3.2, §4.5.3, §5.3.5; Yescombe ch.2, 6, 9, 12, 14; Clews ch.18; Gatti ch.1 |
| **C11** Natural gas and LNG | Core | Tusiani & Shearer ch.2–4, 7, 10–11, 14–15, 18 | Mokhatab et al. §1.2–1.4; Edwards ch.2.1, 5.1–5.2; Yergin ch.4, 14; Stopford §12.4; Swindle ch.3, 6 |
| **C12** Market and counterparty risk | Core | Jorion ch.2, 5–7, 10, 13–15; Gregory (xVA) ch.11–12, 17–21 | Gregory (CCR) ch.8–9, 15; Swindle ch.16; Edwards ch.6.3 |

Notes on the inventory:
- 33 texts are used: 24 from the reading list, four trade-finance texts added for C4, and five added for C11 and C12 (Tusiani & Shearer and Mokhatab et al. on LNG; Jorion and Gregory's two books on risk). Willis & Philipson (*Understanding Electric Utilities and De-Regulation*) ended up as background reading only and is not cited.
- *An Introduction to Models for the Energy Markets* (Huisman) was not in the folder and is not used.
- The reading list names "Barney Rubin" for item 11 and "Robert Weaver" for item 24. The files are by **Barrie Murray** and **Robert Clews**.
- Extraction: *Oil 101* was OCR'd with Tesseract. The Clewlow & Strickland DJVU was read with DjVuLibre and the Kaminski CHM was decompiled. Several scanned PDFs (Eydeland, Mahoney, Murray, Copeland, Dixit, Wynne) used their existing OCR layer. Dixit & Pindyck's OCR is poor, so it is cited by chapter and section only, and its mathematics was rebuilt independently. The Mokhatab et al. EPUB has no printed page numbers, so it is cited by section. Status per book is on `library.html`.
- Citations point only to pages and sections that were actually read during the build. Where a claim goes beyond the books it is marked *Outside the texts*.

## Quality checks

Run from the project root (`energy structuring/`):

| Check | Command | Result |
|---|---|---|
| Worked examples and numeric quiz answers match code; no `$…$` maths left unrendered; multiple-choice answers not guessable by length (correct option is the longest in at most 35% of questions per course) | `node site_src/tests/run_checks.js` | 1,261 checks pass, 0 fail |
| Independent Python re-implementation (C2, C11 and C12 formulas plus Monte Carlo cross-checks) | `python site_src/tests/independent_check.py` | 52 agree, 0 disagree |
| Verbatim overlap against all extracted book text (8-word shingles; fail at ≥12 words) | `python site_src/tests/overlap_check.py` | longest shared run is 11 words (book titles and short technical phrases) |
| Browser end-to-end: every page, quiz, flashcard deck, tool, theme switch and phone width | `node site_src/tests/browser_test.js` (needs `puppeteer-core` and a local Chrome or Edge) | 1,560 checks pass, 0 fail |

The browser test answers every quiz question (checking scoring and explanations), takes the wrong-answer path, flips and scores flashcards, saves completion, and checks that each tool's default output matches its worked example and responds when inputs change. It also checks for JavaScript errors, unrendered maths, broken internal links, horizontal scrolling at phone width, and theme switching.

## Rebuilding

The site is generated from `site_src/` (module text, quizzes, glossaries, calculation libraries) by `python site_src/build.py`, which writes into this folder. Edit the sources, not the generated HTML. Each course's worked-example values are defined in `site_src/tests/cN_checks.js`. Module text refers to them with the `[[n:key:dp]]` shorthand, and the build fills in the numbers, so it needs Node as well as Python. Tool tests are in `site_src/tests/cN_browser.js`. The extracted book text used by the overlap check lives in `_work/extract/` and is not needed to use the site.
