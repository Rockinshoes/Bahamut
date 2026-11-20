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
| **Mortal** | Humans only: knights, archers, mages, warriors. Balanced; each card costs 1 less in your party. |
| **Immortal** | Gods, angels, fairies, celestial beasts and celestial dragons. Higher DEF, lower ATK. |
| **Fallen** | Demons, monsters, undead and chaos dragons. Higher ATK, lower DEF. |

Dragons follow the original: they belong to the gods (its Bahamut "stood with the gods", and Qinglong was a God card)
or to the demons (Tiamat, Jormungand and Hydra were Demon cards), never to humans.

## Cards

There are 42 cards, 14 per faction, named after public-domain gods, heroes and monsters or with generic titles.
Rarities follow the original: **Normal, High Normal, Rare, High Rare, S Rare, SS Rare and Legend**. Most cards
are **Attack type** (more ATK) or **Defense type** (more DEF), with a few Balanced.

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
   monsters sometimes drop a card or a **treasure piece**. As in the original, every section drops one card of
   **each faction**, and the quest list shows which three. After **3 monsters** a **treasure chest** opens (gold and a
   likely card) and the section is cleared. The **boss** always drops a card and an **Ambrosia** (refills all your stamina).
5. **A lost battle costs nothing.** Change your party, level up your cards, and try again.

Cleared sections can be replayed to farm cards and gold. First clears also give gems.

### Card skills
Every card has a skill that can trigger at the start of a battle and lasts the whole fight. Skills are worded
like the original's: a **Boost** raises your cards ("Big Boost to Immortal Defense"), a **Hit** lowers the
enemy's ("Medium Hit to Foes Defense (All)"). The strength word follows rarity: Small (N, HN), Medium (R),
Big (HR), Great (SR), Massive (SSR), Absolute (Legend). Skills aimed at one faction are 1.5x stronger, which
rewards building around your alignment; a Hit aimed at one faction only weakens enemies of that faction.

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

- Add a card: add a line to `CARD_LIST`, like
  `['my-card', 'My Card', 'fallen', 'SR', 'atk', 'knight', 'fire', 'Skill Name', 'boost', 'atk', 'fallen']`:
  id, name, faction (`mortal`/`immortal`/`fallen`), rarity (`N`, `HN`, `R`, `HR`, `SR`, `SSR`, `L`), type (`atk`/`def`/`bal`),
  art style, art color scene (`fire`, `water`, `wind`, `light`, `dark`), and the skill: name, kind (`boost`/`hit`),
  stat (`atk`/`def`/`both`), target (`all` or a faction).
  Art styles: humans use `archer`, `knight`, `mage`, `warrior`, `lancer`; Immortal versions get a halo and wings automatically,
  Fallen versions get horns. Immortal can also use `sprite` (fairy), `beast`, `seraph`, `serpent` (celestial dragon);
  Fallen can use `sprite` (imp), `beast`, `tyrant`, `dragon` (chaos dragon).
- Change which cards a section drops: `drops` and `bossDrops` in `CHAPTERS`.
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
