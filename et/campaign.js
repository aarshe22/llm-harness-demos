/**
 * One 2600-style site per movie sequence (Ultimate Guide beat sheet).
 * Original cart screens 0–5 are untouched; campaign uses ID.CAMP playfields.
 */
(function () {
  "use strict";

  function rowFill(n) {
    const a = new Array(64).fill(0);
    for (let y = 0; y < 64; y++) a[y] = n(y) & 255;
    return a;
  }

  function clonePF(a, b) {
    const g = window.ET_GFX.pf;
    return { pf1: g[a].slice(), pf2: g[b].slice() };
  }

  function pfKitchen() {
    return {
      pf1: rowFill((y) => (y < 8 ? 0x0f : y > 54 ? 0x07 : y > 18 && y < 26 ? 0x03 : 0)),
      pf2: rowFill((y) => (y < 8 ? 0xe0 : y > 54 ? 0xc0 : y > 36 && y < 46 ? 0x70 : 0)),
    };
  }

  function pfCloset() {
    return {
      pf1: rowFill((y) => (y < 8 ? 0x0a : y > 52 ? 0x0f : (y & 7) === 0 ? 0x01 : 0)),
      pf2: rowFill((y) => (y < 8 ? 0x50 : y > 52 ? 0xf0 : y > 20 && y < 28 ? 0x80 : 0)),
    };
  }

  function pfBedroom() {
    return {
      pf1: rowFill((y) => (y < 6 ? 0x0c : y > 56 ? 0x0f : y > 24 && y < 32 ? 0x06 : 0)),
      pf2: rowFill((y) => (y < 6 ? 0x30 : y > 56 ? 0xf0 : y > 40 && y < 50 ? 0xc0 : 0)),
    };
  }

  function pfShed() {
    return {
      pf1: rowFill((y) => (y < 12 ? 0 : y < 16 ? 0x0f : y > 50 ? 0x0f : y > 28 && y < 36 ? 0x08 : 0)),
      pf2: rowFill((y) => (y < 12 ? 0 : y < 16 ? 0xf0 : y > 50 ? 0xf0 : y > 28 && y < 36 ? 0x10 : 0)),
    };
  }

  function pfSchool() {
    return {
      pf1: rowFill((y) => {
        if (y > 56) return 0x0f;
        if ((y > 14 && y < 18) || (y > 30 && y < 34) || (y > 44 && y < 48)) return 0x07;
        return 0;
      }),
      pf2: rowFill((y) => {
        if (y > 56) return 0xf0;
        if ((y > 14 && y < 18) || (y > 30 && y < 34) || (y > 44 && y < 48)) return 0xe0;
        return 0;
      }),
    };
  }

  function pfLab() {
    return {
      pf1: rowFill((y) => (y < 4 || y > 58 ? 0x0f : (y % 10) < 2 ? 0x05 : 0x01)),
      pf2: rowFill((y) => (y < 4 || y > 58 ? 0xf0 : (y % 10) < 2 ? 0xa0 : 0x80)),
    };
  }

  function pfStreet() {
    return {
      pf1: rowFill((y) => (y < 8 ? 0x02 : y > 40 && y < 46 ? 0x0a : y > 50 ? 0x0f : 0)),
      pf2: rowFill((y) => (y < 8 ? 0x40 : y > 40 && y < 46 ? 0x50 : y > 50 ? 0xf0 : 0)),
    };
  }

  function pfYard() {
    return {
      pf1: rowFill((y) => (y > 48 ? 0x07 : y > 20 && y < 24 ? 0x01 : 0)),
      pf2: rowFill((y) => (y > 48 ? 0xe0 : y < 14 ? 0x80 : 0)),
    };
  }

  function pfHouse() {
    return clonePF("washPF1", "washPF2");
  }

  function pfForest() {
    return clonePF("forestPF1", "forestPF2");
  }

  function pfTunnel() {
    return {
      pf1: rowFill((y) => (y < 18 || y > 46 ? 0x0f : 0x01)),
      pf2: rowFill((y) => (y < 18 || y > 46 ? 0xf0 : 0x80)),
    };
  }

  function pfDitch() {
    return {
      pf1: rowFill((y) => (y > 36 && y < 52 ? 0x0f : y > 8 && y < 12 ? 0x02 : 0)),
      pf2: rowFill((y) => (y > 36 && y < 52 ? 0xf0 : 0)),
    };
  }

  function it(list) {
    return () => list.map((x) => Object.assign({ got: false }, x));
  }

  const scenes = [
    {
      id: "specimens",
      title: "1  SPECIMEN NIGHT",
      hint: "The botanists collect Earth plants. Pick 4 specimens before the trucks come.",
      pal: { bg: 0x80, pf: 0xc0 },
      pf: pfForest,
      spawn: { x: 24, y: 20 },
      mothershipDrop: true,
      items: it([
        { x: 20, y: 36, kind: "plant" },
        { x: 44, y: 28, kind: "plant" },
        { x: 70, y: 40, kind: "plant" },
        { x: 96, y: 32, kind: "plant" },
      ]),
      need: 4,
      win: "collect",
    },
    {
      id: "keys-fog",
      title: "2  KEYS IN THE FOG",
      hint: "Adults from the waist down. Dodge Keys. Flee south through the fog.",
      pal: { bg: 0x72, pf: 0xc2 },
      pf: pfForest,
      spawn: { x: 60, y: 12 },
      keys: true,
      win: "reach-south",
    },
    {
      id: "abandoned",
      title: "3  LEFT BEHIND",
      hint: "The ship lifts off without you. Stay alive until it clears the trees.",
      pal: { bg: 0x84, pf: 0xc0 },
      pf: pfForest,
      spawn: { x: 58, y: 36 },
      mothershipDrop: true,
      win: "survive",
      need: 180,
    },
    {
      id: "yard",
      title: "4  ELLIOTT'S YARD",
      hint: "Pizza on the roof, something in the shed. Grab the ball, walk to the shed.",
      pal: { bg: 0xd4, pf: 0xc0 },
      pf: pfYard,
      spawn: { x: 20, y: 30 },
      items: it([{ x: 50, y: 24, kind: "candy" }]),
      need: 1,
      win: "collect-east",
    },
    {
      id: "reese",
      title: "5  REESE'S TRAIL",
      hint: "Hansel and Gretel: a trail of candy leads E.T. to the shed.",
      pal: { bg: 0xd4, pf: 0xc0 },
      pf: pfForest,
      spawn: { x: 16, y: 44 },
      items: it([
        { x: 28, y: 44, kind: "candy" },
        { x: 40, y: 40, kind: "candy" },
        { x: 52, y: 36, kind: "candy" },
        { x: 64, y: 32, kind: "candy" },
        { x: 76, y: 30, kind: "candy" },
        { x: 88, y: 28, kind: "candy" },
        { x: 100, y: 34, kind: "candy" },
      ]),
      need: 7,
      win: "collect",
    },
    {
      id: "shed",
      title: "6  THE SHED",
      hint: "Meet cute. Wait for Elliott. Touch him. I'll be right here.",
      pal: { bg: 0x22, pf: 0x2a },
      pf: pfShed,
      spawn: { x: 30, y: 40 },
      elliott: true,
      win: "touch-elliott",
    },
    {
      id: "house-door",
      title: "7  INTO THE HOUSE",
      hint: "Sneak past Mom (Keys). Reach the stairs on the right.",
      pal: { bg: 0x84, pf: 0x0a },
      pf: pfHouse,
      spawn: { x: 18, y: 48 },
      keys: true,
      win: "reach-east",
    },
    {
      id: "closet",
      title: "8  CLOSET MUSEUM",
      hint: "Star Wars, Pez, cars. Show E.T. three toys.",
      pal: { bg: 0x1a, pf: 0x2a },
      pf: pfCloset,
      spawn: { x: 22, y: 42 },
      items: it([
        { x: 36, y: 20, kind: "toy" },
        { x: 58, y: 34, kind: "toy" },
        { x: 84, y: 22, kind: "toy" },
      ]),
      need: 3,
      win: "collect",
    },
    {
      id: "fridge",
      title: "9  FRIDGE RAID",
      hint: "Coke and a smorgasbord. Eat 4 snacks. Don't let Mom catch you.",
      pal: { bg: 0x84, pf: 0x0a },
      pf: pfKitchen,
      spawn: { x: 20, y: 40 },
      keys: true,
      items: it([
        { x: 40, y: 18, kind: "candy" },
        { x: 62, y: 22, kind: "candy" },
        { x: 84, y: 40, kind: "candy" },
        { x: 52, y: 48, kind: "candy" },
      ]),
      need: 4,
      win: "collect",
    },
    {
      id: "right-here",
      title: "10  I'LL BE RIGHT HERE",
      hint: "Stay in the closet glow until Elliott comes back (stand still in the light).",
      pal: { bg: 0x1a, pf: 0x2a },
      pf: pfCloset,
      spawn: { x: 56, y: 36 },
      hotspots: [{ x: 44, y: 28, w: 32, h: 20, zone: 10 }],
      win: "stay-landing",
      need: 90,
    },
    {
      id: "fever",
      title: "11  FAKE FEVER",
      hint: "Elliott stays home. Lie in the bed (top of the room) until the clock runs.",
      pal: { bg: 0x3a, pf: 0x2a },
      pf: pfBedroom,
      spawn: { x: 30, y: 44 },
      hotspots: [{ x: 70, y: 8, w: 36, h: 18, zone: 10 }],
      win: "stay-landing",
      need: 70,
    },
    {
      id: "family",
      title: "12  MEET THE FAMILY",
      hint: "I'm keeping him. Touch Elliott so Michael and Gertie share the secret.",
      pal: { bg: 0x3a, pf: 0x2a },
      pf: pfBedroom,
      spawn: { x: 24, y: 40 },
      elliott: true,
      win: "touch-elliott",
    },
    {
      id: "solar",
      title: "13  HIS UNIVERSE",
      hint: "Telekinesis: collect 3 floating orbs. He points far beyond.",
      pal: { bg: 0x80, pf: 0x9a },
      pf: pfCloset,
      spawn: { x: 24, y: 44 },
      items: it([
        { x: 40, y: 16, kind: "orb" },
        { x: 64, y: 10, kind: "orb" },
        { x: 88, y: 18, kind: "orb" },
      ]),
      need: 3,
      win: "collect",
    },
    {
      id: "heal-plant",
      title: "14  GERTIE'S FLOWER",
      hint: "A dying plant. Stand on it and Fire — the glowing finger.",
      pal: { bg: 0x1a, pf: 0x2a },
      pf: pfCloset,
      spawn: { x: 30, y: 40 },
      flower: { x: 88, y: 46 },
      win: "heal-flower",
    },
    {
      id: "sesame",
      title: "15  B AND PHONE",
      hint: "Sesame Street. Stand at the TV (left) until E.T. learns to speak.",
      pal: { bg: 0x3a, pf: 0x2a },
      pf: pfBedroom,
      spawn: { x: 80, y: 40 },
      hotspots: [{ x: 8, y: 16, w: 28, h: 24, zone: 8 }],
      win: "stay-call",
      need: 80,
    },
    {
      id: "beer",
      title: "16  COORS LINK",
      hint: "Toddler without a sitter. Drink the beer. Get woozy. Then grab the can.",
      pal: { bg: 0x84, pf: 0x0a },
      pf: pfKitchen,
      spawn: { x: 18, y: 42 },
      beer: { x: 42, y: 18 },
      items: it([{ x: 42, y: 18, kind: "candy" }]),
      need: 1,
      win: "collect",
    },
    {
      id: "frogs",
      title: "17  SET THEM FREE",
      hint: "Science class. The frogs look like family. Free all 8. Avoid the teacher.",
      pal: { bg: 0x96, pf: 0x0e },
      pf: pfSchool,
      spawn: { x: 16, y: 50 },
      scientist: true,
      items: it([
        { x: 28, y: 12, kind: "frog" },
        { x: 48, y: 12, kind: "frog" },
        { x: 68, y: 12, kind: "frog" },
        { x: 88, y: 12, kind: "frog" },
        { x: 28, y: 28, kind: "frog" },
        { x: 52, y: 28, kind: "frog" },
        { x: 76, y: 28, kind: "frog" },
        { x: 96, y: 44, kind: "frog" },
      ]),
      need: 8,
      win: "collect",
    },
    {
      id: "kiss",
      title: "18  THE KISS",
      hint: "Pandemonium frees Elliott too. Reach the girl at the top of the class.",
      pal: { bg: 0x96, pf: 0x0e },
      pf: pfSchool,
      spawn: { x: 20, y: 50 },
      elliott: true,
      win: "touch-elliott",
    },
    {
      id: "ouch",
      title: "19  OUCH",
      hint: "Elliott cuts his finger. Stand by him and Fire. Heal. Ouch.",
      pal: { bg: 0x3a, pf: 0x2a },
      pf: pfBedroom,
      spawn: { x: 24, y: 40 },
      elliott: true,
      win: "heal-elliott",
    },
    {
      id: "speakspell",
      title: "20  SPEAK & SPELL",
      hint: "Umbrella, circular saw, Speak & Spell. Assemble the communicator.",
      pal: { bg: 0x22, pf: 0x2a },
      pf: pfCloset,
      spawn: { x: 20, y: 42 },
      items: it([
        { x: 40, y: 20, kind: "part" },
        { x: 70, y: 36, kind: "part" },
        { x: 96, y: 24, kind: "part" },
      ]),
      need: 3,
      win: "collect",
    },
    {
      id: "halloween",
      title: "21  HALLOWEEN",
      hint: "Hold Fire for the sheet. Trick-or-treat past Keys. Reach the north woods.",
      pal: { bg: 0x72, pf: 0x0a },
      pf: pfHouse,
      spawn: { x: 60, y: 50 },
      keys: true,
      ghostFire: true,
      win: "reach-north",
    },
    {
      id: "yoda",
      title: "22  YODA",
      hint: "One alien recognizes another. Find the little Jedi in the crowd.",
      pal: { bg: 0x72, pf: 0x0a },
      pf: pfStreet,
      spawn: { x: 20, y: 36 },
      items: it([{ x: 90, y: 20, kind: "toy" }]),
      need: 1,
      win: "collect",
    },
    {
      id: "bike-woods",
      title: "23  BASKET ON THE BIKE",
      hint: "Time is of the essence. Ride east to the forest.",
      pal: { bg: 0xd4, pf: 0x08 },
      pf: pfStreet,
      spawn: { x: 12, y: 36 },
      win: "reach-east",
    },
    {
      id: "moon",
      title: "24  OVER THE MOON",
      hint: "Hold Fire. Lift the bike. Three laps across the moon.",
      pal: { bg: 0x80, pf: 0x0e },
      pf: pfStreet,
      spawn: { x: 16, y: 40 },
      flyFire: true,
      wrapRightLap: true,
      need: 3,
      win: "laps",
    },
    {
      id: "phone-home",
      title: "25  E.T. PHONE HOME",
      hint: "Build the signal in the clearing. Call-ship zone, then stand on the pad.",
      pal: { bg: 0xd4, pf: 0xc0 },
      pf: pfForest,
      spawn: { x: 60, y: 36 },
      hotspots: [
        { x: 16, y: 8, w: 32, h: 16, zone: 9 },
        { x: 50, y: 24, w: 28, h: 18, zone: 10 },
      ],
      phonesReady: true,
      win: "land-ship",
    },
    {
      id: "gone",
      title: "26  HE'S GONE",
      hint: "Elliott wakes. E.T. is missing. Search the creek. Go south.",
      pal: { bg: 0xd4, pf: 0xc0 },
      pf: pfForest,
      spawn: { x: 60, y: 16 },
      win: "reach-south",
    },
    {
      id: "ditch",
      title: "27  WHITE CREEK",
      hint: "Michael finds a dying E.T. Crawl out of the ditch (go north) with almost no energy.",
      pal: { bg: 0x9a, pf: 0x0a },
      pf: pfDitch,
      spawn: { x: 60, y: 48 },
      drain: 2,
      elliott: true,
      win: "touch-elliott",
    },
    {
      id: "raid",
      title: "28  THE RAID",
      hint: "Plastic tunnels. Keys' men. Reach Elliott, then run left out of the house.",
      pal: { bg: 0x0a, pf: 0x0e },
      pf: pfTunnel,
      spawn: { x: 96, y: 30 },
      elliott: true,
      keys: true,
      win: "elliott-escape",
    },
    {
      id: "lab",
      title: "29  THE LAB",
      hint: "Sterile light. No privacy. Energy bleeds. Touch Elliott to share the heart-light.",
      pal: { bg: 0x0e, pf: 0x0a },
      pf: pfLab,
      spawn: { x: 90, y: 30 },
      elliott: true,
      scientist: true,
      drain: 1,
      win: "touch-elliott",
    },
    {
      id: "flower-lives",
      title: "30  THE FLOWER LIVES",
      hint: "Gertie's plant stands up. Heal it with Fire. E.T. is alive.",
      pal: { bg: 0x1a, pf: 0x3a },
      pf: pfLab,
      spawn: { x: 40, y: 36 },
      flower: { x: 80, y: 44 },
      win: "heal-flower",
    },
    {
      id: "escape-van",
      title: "31  THE VAN",
      hint: "Masters of the house. Ride the van east before Keys seals the street.",
      pal: { bg: 0x00, pf: 0x08 },
      pf: pfStreet,
      spawn: { x: 16, y: 36 },
      keys: true,
      win: "reach-east",
    },
    {
      id: "chase",
      title: "32  BMX CHASE",
      hint: "Boys on bikes. Vans behind. Fire to lift off. Two streets.",
      pal: { bg: 0x80, pf: 0x08 },
      pf: pfStreet,
      spawn: { x: 16, y: 36 },
      keys: true,
      flyFire: true,
      wrapRightLap: true,
      need: 2,
      win: "laps",
    },
    {
      id: "cops",
      title: "33  OVER THE COPS",
      hint: "Hold Fire. Fly north over the roadblock.",
      pal: { bg: 0x80, pf: 0x08 },
      pf: pfStreet,
      spawn: { x: 40, y: 44 },
      keys: true,
      flyFire: true,
      win: "reach-north",
    },
    {
      id: "goodbye",
      title: "34  COME / STAY",
      hint: "Be good. Ouch. Stand on the pad with the living plant. Board the ship.",
      pal: { bg: 0xd4, pf: 0xc0 },
      pf: pfForest,
      spawn: { x: 36, y: 40 },
      flower: { x: 24, y: 46 },
      hotspots: [
        { x: 16, y: 8, w: 24, h: 14, zone: 9 },
        { x: 50, y: 20, w: 32, h: 22, zone: 10 },
      ],
      phonesReady: true,
      elliott: true,
      win: "land-ship",
    },
  ];

  window.ET_CAMPAIGN = { scenes, count: scenes.length };
})();
