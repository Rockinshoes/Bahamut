# Bahamut Clone

A personal, local card-battle gacha game for the browser, in the style of early-2010s mobile card games.
Fight monsters, open treasure chests, beat chapter bosses, build a party, fuse and evolve your cards, and summon new ones.

Everything runs on your own device. There is no server, no account and nothing to install.

## How to play it

1. Download or clone this repo.
2. Open the file **`index.html`** in your browser (double-click it).
3. That's it. Your progress saves automatically in that browser.

**On a phone?** Some phone file previewers open `index.html` on its own and show a blank, unstyled page,
because they can't load the other files next to it. Open **`play.html`** instead: it is the whole game
packed into one file. (If you change the code, run `node build.js` to rebuild it.)

> Use the same browser each time. Saves live inside the browser, so a different browser (or clearing
> site data) starts a new game. Use **More > Show my save** to back your game up.

## How a quest works

1. **Quests tab > Enter.** Each chapter has 5 sections. Sections 1 to 4 are monsters, section 5 is the boss.
2. **Pick your party.** Before every battle you choose up to 5 cards. The first card is the **leader** (+20% ATK and HP).
   The screen shows the enemies, which element hits them hardest, and a green up arrow or red down arrow on each of
   your cards that is strong or weak against them. Your party has a **cost limit** that grows as you level up.
3. **Watch the battle.** Both sides attack in rounds. Use 1x / 2x / 4x speed, or **Skip** to jump to the result.
4. **Collect rewards.** Every win costs stamina and gives exp and gold, and monsters sometimes drop a card.
   After **3 monsters** a **treasure chest** opens (gold and a likely card) and the section is cleared.
   The **boss** always drops a card and a **Cure Water** (refills all your stamina).
5. **A lost battle costs nothing.** Change your party, level up your cards, and try again.

Cleared sections can be replayed to farm cards and gold. First clears also give gems.

### Levelling up
Each level gives **3 attribute points** to spend on **Stamina** (+2 max), **ATK PWR** (+2% team ATK) or **DEF PWR** (+2% team HP).
Level-ups also refill your stamina.

### Other tabs
| Tab | What you do |
| --- | --- |
| **Cards** | Tap a card to **Fuse** (use up other cards to give it exp), **Evolve** (needs max level plus a second copy) or **Sell**. |
| **Deck** | Your default party and leader. You can still change the party before each battle. |
| **Summon** | Spend gems on random cards. A x10 summon always includes at least one Super Rare or better. Rates are shown on screen. |
| **More** | Your attribute totals, save backup/import, a few testing buttons, and a reset. |

Elements: Fire beats Wind, Wind beats Water, Water beats Fire. Light and Dark beat each other.
Beating an element deals 1.5x damage; being weak to it deals 0.75x.

## Art

Every card and enemy has **placeholder art drawn by the game itself** (`js/art.js`), so nothing needs downloading.

To use your own art, put an image named after the card's id into `assets/cards/` and reload, for example:

```
assets/cards/ember-imp.png
assets/cards/pyre-sovereign.png
```

Card ids are the first column of the list in `js/data.js`. A card with an image uses it instead of the placeholder.
Your browser's developer console may show "failed to load" lines for cards that have no image. That is normal and harmless.

The `.gitignore` file keeps everything in `assets/cards/` **out of Git**, so art never gets uploaded
to GitHub by accident. If you want art in the repo, you'd have to change `.gitignore`.

## Changing the game

Most tweaks are one-line edits in **`js/data.js`**:

- Add a card: add a line to `CARD_LIST`, like `['my-card', 'My Card', 'fire', 'SR', 'knight']`.
  The last value picks the placeholder drawing: `sprite`, `archer`, `knight`, `mage`, `beast`, `dragon`, `seraph` or `tyrant`.
- Change summon rates, stamina speed, monsters per section, chest odds, leader bonus, attribute points and starter cards: `RARITIES` and `CONFIG`.
- Rename chapters, monsters and bosses: `CHAPTERS`.

## Project layout

```
index.html        the page
play.html         the whole game packed into one file (made by build.js)
build.js          rebuilds play.html:  node build.js
style.css         how it looks
js/data.js        cards, rarities, chapters, balance settings
js/art.js         draws the placeholder card and enemy art
js/game.js        the rules (summoning, fusion, battles, quests, saving). No screen code.
js/ui.js          draws the screens, the party picker and the animated battle
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
- A player-vs-player arena against saved decks
- Daily login gems and event quests
- Sound
