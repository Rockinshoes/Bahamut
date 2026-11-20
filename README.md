# Bahamut Clone

A personal, local card-battle gacha game for the browser, in the style of early-2010s mobile card games.
Collect cards, build a deck, fight quests, fuse and evolve your cards, and summon new ones.

Everything runs on your own computer. There is no server, no account and nothing to install.

## How to play it

1. Download or clone this repo.
2. Open the file **`index.html`** in your browser (double-click it).
3. That's it. Your progress saves automatically in that browser.

> Use the same browser each time. Saves live inside the browser, so a different browser (or clearing
> site data) starts a new game. Use **More > Show my save** to back your game up.

## The game loop

| Tab | What you do |
| --- | --- |
| **Quests** | Spend stamina to fight stages. Winning gives exp, gold and a card drop. First clears give gems. Every 5th stage is a boss. A lost battle costs nothing. |
| **Cards** | Tap a card to **Fuse** (feed other cards to it for exp), **Evolve** (needs max level plus a second copy) or **Sell**. |
| **Deck** | Pick up to 5 cards. Each card has a cost and your deck has a cost limit that grows as you level up. **Auto-fill** builds the strongest legal deck. |
| **Summon** | Spend gems on random cards. A x10 summon always includes at least one Super Rare or better. Rates are shown on screen. |
| **More** | Save backup/import, a few testing buttons, and a reset. |

Elements: Fire beats Wind, Wind beats Water, Water beats Fire. Light and Dark beat each other.
Beating an element deals 1.5x damage; being weak to it deals 0.75x.

## Using your own art

Put an image named after the card's id into `assets/cards/` and reload, for example:

```
assets/cards/ember-imp.png
assets/cards/pyre-sovereign.png
```

Card ids are the first column of the list in `js/data.js`. Any card without an image shows a colored
placeholder. Your browser's developer console may show "failed to load" lines for cards that have no
art yet. That is normal and harmless.

The `.gitignore` file keeps everything in `assets/cards/` **out of Git**, so art never gets uploaded
to GitHub by accident. If you want art in the repo, you'd have to change `.gitignore`.

## Changing the game

Most tweaks are one-line edits in **`js/data.js`**:

- Add a card: add a line to `CARD_LIST`, like `['my-card', 'My Card', 'fire', 'SR']`.
- Change summon rates, stamina speed, gem costs and starter cards: `RARITIES` and `CONFIG`.
- Rename chapters and enemies: `CHAPTERS`.

## Project layout

```
index.html        the page
style.css         how it looks
js/data.js        cards, rarities, chapters, balance settings
js/game.js        the rules (summoning, fusion, battles, saving). No screen code.
js/ui.js          draws the screens and handles taps
tests/game.test.js  automatic checks of the rules
assets/cards/     your own card art goes here (not tracked by Git)
```

## Running the tests (optional)

If you have [Node.js](https://nodejs.org) installed:

```
node tests/game.test.js
```

## Ideas for later

- Card skills and leader abilities
- Daily login gems and event quests
- A player-vs-player arena against saved decks
- Sound and battle animations
