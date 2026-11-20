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

## Factions and your alignment

Every card belongs to one of three factions. There is **no damage weakness** between them; instead each leans a different way:

| Faction | Leaning |
| --- | --- |
| **Mortal** | Balanced stats. Each card costs 1 less in your party. |
| **Immortal** | The toughest cards: high DEF, lower ATK. |
| **Fallen** | The hardest hitters: high ATK, lower DEF. |

When you start a game you pick an **alignment** and get its starter pack: **one champion** of that faction
(Mortal: Flame Warden, Immortal: Halo Seraph, Fallen: Night Sorceress). You do not start with a full party;
you build it from cards you win in quests and summons. Cards of your alignment get **+5% ATK and DEF** in battle.
You can still use any card. (More > Change alignment switches it later.)

## How a quest works

1. **Quests tab > Enter.** Each chapter has 5 sections. Sections 1 to 4 are monsters, section 5 is the boss.
2. **Pick your party.** Before every battle you choose up to 5 cards. The first card is the **leader** (+20% ATK and DEF).
   The screen shows the enemies and their faction, and a green arrow marks your cards that match your alignment.
   Your party's total card cost can't go over your **ATK PWR** (see below).
3. **Watch the battle.** First your cards' **skills** may trigger, then both sides attack in rounds. Each hit takes
   ATK x 0.2 off the target's DEF; a card at 0 DEF is knocked out. Use 1x / 2x / 4x speed, or **Skip**.
4. **Collect rewards.** Every win costs stamina and gives **1 exp per stamina** (like the original) and gold, and
   monsters sometimes drop a card or a **treasure piece**. After **3 monsters** a **treasure chest** opens (gold and a
   likely card) and the section is cleared. The **boss** always drops a card and an **Ambrosia** (refills all your stamina).
5. **A lost battle costs nothing.** Change your party, level up your cards, and try again.

Cleared sections can be replayed to farm cards and gold. First clears also give gems.

### Card skills
Every card has a skill that can trigger at the start of a battle and lasts the whole fight: ATK Up, DEF Up,
ATK & DEF Up, Enemy ATK Down or Enemy DEF Down. Strength grows with rarity (5% for N up to 20% for SSR).
Some skills only help one faction but are 1.5x stronger, which rewards building around your alignment.

Whether a skill triggers depends on the card's **party slot**: slot 1 always, then 80%, 60%, 40% and 20%.
(The 100/80/60% figures come from players of the original; 40% and 20% are filled in.) The party screen lists
your party's skills and their chances.

### Treasure sets
Each chapter has a 6-piece treasure set. Sections 1-4 each drop one piece (20% per monster win) and the boss
drops pieces 5 and 6 (50% per boss win). With all six, tap **Claim** on the Quests tab to trade the set for a
card: Super Rare for chapters 1-2, Legendary for chapter 3. Sets can be collected again.

### Levelling up and attribute points
You get **3 attribute points** per level-up and **1** the first time you clear each section. Spend them on:

- **Stamina:** +2 max stamina, so you can fight more between refills.
- **ATK PWR:** +1 to your party cost limit. You start at 12, which fits your champion plus a little more.

Level-ups also refill your stamina. (DEF PWR, which set how strong your defending deck was, will return with player-vs-player battles.)

### Other tabs
| Tab | What you do |
| --- | --- |
| **Cards** | Tap a card to **Fuse** (use up other cards to give it exp), **Evolve** (needs max level plus a second copy) or **Sell**. |
| **Deck** | Your default party and leader. You can still change the party before each battle. |
| **Summon** | Spend gems on random cards. A x10 summon always includes at least one Super Rare or better. Rates are shown on screen. |
| **More** | Your attribute totals, save backup/import, a few testing buttons, and a reset. |

Fusing a card of the same faction gives 1.5x exp.

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

- Add a card: add a line to `CARD_LIST`, like `['my-card', 'My Card', 'fallen', 'SR', 'knight', 'fire']`.
  The faction is `mortal`, `immortal` or `fallen`. The last two values only pick the placeholder drawing:
  a style (`sprite`, `archer`, `knight`, `mage`, `beast`, `dragon`, `seraph`, `tyrant`) and a color scene (`fire`, `water`, `wind`, `light`, `dark`).
- Change a card's skill: the last three values of its line in `CARD_LIST`. Skill strengths: `RARITIES`.
  Trigger chances, treasure drop rates and exp per stamina: `CONFIG`. Treasure sets: `CHAPTERS`.
- Change how each faction leans: `FACTIONS`. The alignment bonus, starting ATK PWR, starting gems and starter packs: `CONFIG`.
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
