# E.T. the Extra-Terrestrial (Atari 2600 remake)

A browser remake of Howard Scott Warshaw’s 1982 Atari 2600 game. Rules, map wrapping, energy, scoring, and playfields for the original cart come from the cartridge and Dennis Debro’s labeled disassembly, plus the 1982 Atari manual.

A second world plays **every sequence of the 1982 film** as its own 2600-style site (34 sites), using the same sprites, energy bar, and humans. Original screens 0–5 are not rewritten.

## Play

Open `index.html` in a browser, or serve this folder and load it from there.

- **Move:** arrow keys or WASD
- **Fire:** Space or Z
  - Fire + direction = run (uses more energy)
  - Fire while standing in a power zone = use that power (neck stretch)
  - Fire + Up in a well = levitate out
  - On Halloween / bike sites, hold Fire for the sheet or to lift off
- **World map:** beside the screen (above it on a narrow window). Cart layout matches wrap tables; movie world lists all 34 beats. Green cell = you are here; the dot is E.T.’s position on that site. Click a movie beat to jump.
- **Sequence:** jump to any film beat (Movie world)
- **Reset:** Reset / Start button
- **Variation 1–3:** Elliott+FBI+Scientist, Elliott+FBI, or Elliott only
- **Difficulty:** human speed (A fast / B slow) and whether Elliott blocks the ship

## 1982 cart goal

Find the three phone pieces (often in wells), assemble them, call the ship from a call-ship zone, then stand on the forest landing pad before the timer runs out. Candy restores energy. The FBI steals pieces; the scientist carries E.T. to Washington.

## Movie world

Each sequence is one site. Typical wins: collect items, reach an edge, survive Keys, stand in a glow, heal the flower (Fire with neck extended), touch Elliott, call the ship and land. Sites follow film order from specimen night through Come / Stay.

Do not add the ROM or 1982 PDF to public git; they stay local.
