const CHAPTERS = [
  { title: 'SWEET LIFE LOUNGE', room: 'lounge', spawn: { x: 0, z: 4 }, tagline: 'Where the neon is pink, the drinks are blue, and the Cup is gold.' },
  { title: 'THE GILDED FLUSH', room: 'casino', spawn: { x: -5.5, z: 3.8 }, tagline: 'Luck is rented. Boogie is owned.' },
  { title: 'THE S.S. EXCESS', room: 'ship', spawn: { x: -4.5, z: 3.4 }, tagline: 'Formalities: hat, snack, humility (optional).' },
  { title: 'THE SPRINGS O SERENITY', room: 'spa', spawn: { x: 0, z: 3.0 }, tagline: 'Breathe in. Show off. Breathe out.' },
  { title: 'STARSHIP CLASS-C', room: 'space', spawn: { x: 0, z: 3.4 }, tagline: 'One small step for man. One giant boogie for mankind.' }
];

export function createGame({ ui, api }) {
  const state = { chapter: 1, flags: new Set(), charisma: 0 };
  const has = (f) => state.flags.has(f);
  const set = (f) => state.flags.add(f);

  const ch = (n, label) => {
    state.charisma += n;
    ui.setCharisma(state.charisma);
    ui.toast(label ? `CHARISMA +${n} (${label})` : `CHARISMA +${n}`);
    api.sound.coin();
  };

  const say = (n, t, cb) => ui.say(n, t, cb);
  const dlg = (n, t, opts) => ui.dialog(n, t, opts, (opt) => {
    api.sound.select();
    if (opt.do) opt.do();
  });
  const EXIT = { label: 'Back off, gracefully.', do: () => ui.close() };

  const enterDance = (speed, winFlag, rival, loseLine) => {
    api.sound.setTrack(api.roomTrack());
    ui.startDance({ speed }, () => {
      api.sound.win();
      set(winFlag);
      ch(5, 'BOOGIE SUPREMACY');
      say('TERRY', winLines(winFlag), () => completeChapter());
    }, () => {
      api.sound.lose();
      say(rival, loseLine, () => {
        if (!has('scouted')) { set('scouted'); ch(1, 'STREET SCHOLARSHIP'); }
        else ui.toast('THE FLOOR AWAITS A REMATCH.');
      });
    });
  };

  const winLines = (f) => ({
    cup1: 'The Cup! Cold, gold, and now legally mine. My whole life is a pre-quote now. Champagne Kate salutes me. I think. It might be a dare. Either way: legend.',
    cup2: 'Cassino concedes with a showman\'s bow. The house pays out in glitter and respect, mostly glitter. Another Cup, another dent in my good pants.',
    cup3: 'Officer Sterling smiles. First recorded instance in ship history. The crew applauds, the guests weep, and the buffet forgives the skewer.',
    cup4: 'The Zen Queen unclenches. That is her version of a standing ovation. Dawn breaks, mud dries, trophies acquire my fingerprints.',
    cup5: 'R-1N short-circuits something poetic. Gravity restores. Somewhere below, soup bowls settle. I have boogied in orbit. There is nothing left to prove, only to polish.'
  })[f];

  function completeChapter() {
    state.chapter++;
    if (state.chapter > 5) {
      api.victory('Five venues. Five Golden Boogie Cups. One legendary pair of trousers. Tight Pants Terry is now a Certified Legend of Leisure. The crowd howls. The bartenders weep. Somewhere, a booth misses its occupant.');
      return;
    }
    const C = CHAPTERS[state.chapter - 1];
    api.interstitial(`CHAPTER ${state.chapter}: ${C.title}`, C.tagline, `BEGIN CHAPTER ${state.chapter}`, () => {
      api.enterRoom(C.room, C.spawn);
    });
  }

  function objective() {
    switch (state.chapter) {
      case 1:
        if (roomKey === 'vip') return has('cup1') ? 'Celebrate. Then leave via the door.' : 'WIN THE DANCE-OFF vs CHAMPAGNE KATE';
        if (!has('comb')) return 'FIX THE MANE — find a comb (lost & found near the door)';
        if (!ui.hasItem('drink')) return 'CHAT UP MARGE — earn a Blue Suede';
        if (!has('song')) return 'BRING THE BLUE SUEDE to DJ Velvet Fingers';
        if (!has('vipOpen')) return 'MAKE BRUNO respect you';
        return 'ENTER THE VIP SECTION via the velvet rope';
      case 2:
        if (!has('chip') && !ui.hasItem('chip')) return 'SEARCH the suspicious fern for a Lucky Chip';
        if (!has('wonSlot')) return 'FEED the Lucky Chip to the slot machine';
        if (!has('cup2')) return 'CHALLENGE Cassino the Lounge Lizard';
        return 'Claim the next chapter.';
      case 3:
        if (!ui.hasItem('hat') || !ui.hasItem('skewer')) return 'ACQUIRE a captain\'s hat and a buffet skewer';
        if (!has('cup3')) return 'CHALLENGE Officer Sterling on the Lido deck';
        return 'Claim the next chapter.';
      case 4:
        if (!ui.hasItem('mud') || !has('cukes')) return 'PREP THE MAT: fill a mud tub + grab cucumbers';
        if (!has('cup4')) return 'CHALLENGE Zen Queen Mireille';
        return 'Claim the next chapter.';
      case 5:
        if (!ui.hasItem('pom') || !has('grav')) return 'GEAR UP: pom-poms from the locker + low gravity';
        if (!has('cup5')) return 'CHALLENGE R-1N, the dance android';
        return 'Bask.';
    }
    return 'Enjoy the leisure.';
  }

  let roomKey = null;

  function onRoom(key) {
    roomKey = key;
    if (has('said_' + key)) return;
    set('said_' + key);
    const lines = {
      lounge: 'Friday night. The neon says Sweet Life. The pants say Tight. Tonight I chase the Golden Boogie Cup: a lady who can out-dance me, a drink with a lie on the label, and immortality. In whatever order the bar allows.',
      vip: 'The VIP. The air is richer, the carpet is thicker, and somewhere in here a trophy is getting nervous.',
      casino: 'Chapter two. The Gilded Flush Casino. Red carpet, stronger drinks, and every man here is lying about his dance card. All except one.',
      ship: 'Chapter three. The S.S. Excess. A luxury liner where the drinks float, the standards float lower, and the midnight Lido dance-off answers to one man: Officer Sterling, who has never once smiled. I intend to become a statistic.',
      spa: 'Chapter four. The Springs O\'Serenity. A spa so calm the ducks are tense. The mud pool is textile-optional, the drama is mandatory, and Zen Queen Mireille defends her Cup at dawn. Dawn is in four hours. I nap in the mud.',
      space: 'Final chapter. The Starship Class-C, humanity\'s first leisure cruise in orbit. Gravity is a suggestion, cocktails float at eye level, and the reigning champ is R-1N - a dance android who has never lost. Nobody is perfect at leisure. Nobody except, apparently, me.'
    };
    if (lines[key]) setTimeout(() => say('TERRY', lines[key]), 500);
  }

  function interact(id) {
    switch (id) {
      /* ---------- CHAPTER 1: LOUNGE ---------- */
      case 'marge':
        if (!has('comb')) {
          dlg('MARGE', 'Bar\'s full, handsome, and you look like a pillow with ambition. Come back when your hair files a better report.', [
            { label: 'Harsh. But fair.', do: () => ui.close() },
            { label: 'What happened to my hair?', do: () => say('TERRY', 'Flat. Defeated. It has started taking sides against my forehead.') }
          ]);
        } else if (has('gotDrink')) {
          dlg('MARGE', 'There he is! The mane, the legend, the reason my tips doubled. Order up, anytime.', [EXIT]);
        } else {
          dlg('MARGE', 'Well, well. Somebody walked in looking expensive. The hair finally signed off on the suit.', [
            { label: 'One of your famous Blue Suedes.', do: () => { ui.addItem('drink'); set('gotDrink'); ch(1, 'MANE ADMITTED'); ui.close(); } },
            { label: 'Tell me about your DJ.', do: () => say('MARGE', 'DJ Velvet Fingers hasn\'t played a banger since the Carter administration. The kid needs inspiration. Preferably in a glass.') },
            EXIT
          ]);
        }
        break;
      case 'gus':
        dlg('GLAMOUR GUS', 'Terry! My man! The ladies love a man with texture, and you, friend, are currently smooth plastic.', [
          { label: 'What\'s the play tonight?', do: () => say('GLAMOUR GUS', 'The VIP lounge, obviously. Champagne Kate defends the Golden Boogie Cup every Friday. Beat her dance-off and the Cup is yours. But Bruno guards that velvet rope like it owes him money.') },
          { label: 'Any advice?', do: () => say('GLAMOUR GUS', 'Fix the mane first. A gentleman\'s hair is his opening statement. The lost-and-found box by the door has seen better days, and better hair.') },
          { label: 'Why are you glued to that booth?', do: () => say('GLAMOUR GUS', 'The booth and I have an agreement. It holds me up, I compliment the upholstery, nobody leaves disappointed.') },
          EXIT
        ]);
        break;
      case 'box':
        if (!has('comb')) {
          say('NARRATION', 'A crate of abandoned hairpieces, sad fanny packs, and - glory - a horn afro comb. Still warm. We do not ask why.', () => {
            ui.addItem('comb'); set('comb'); ch(1, 'OPENING STATEMENT');
          });
        } else say('NARRATION', 'Empty. Somebody else\'s tragedy, fully harvested.');
        break;
      case 'mirror':
        if (!has('comb')) say('TERRY', 'The mirror shows me my good side and my "slept in the suit" side. Simultaneously. Brutal engineering.');
        else if (!has('mirrorFix')) { set('mirrorFix'); ch(1, 'STALLION ENERGY'); say('TERRY', 'That\'s the look. Hair like a white-maned stallion - if the stallion had a condo lease and a dance move.'); }
        else say('TERRY', 'Still gorgeous. The mirror has started keeping a diary about me.');
        break;
      case 'dj':
        if (has('song')) {
          dlg('DJ VELVET FINGERS', 'On repeat? Don\'t tempt me. The floor still hasn\'t recovered.', [EXIT]);
        } else if (ui.hasItem('drink')) {
          dlg('DJ VELVET FINGERS', 'The floor\'s flat, the crowd\'s flat, and honestly? So is the mix.', [
            { label: 'Then have a Blue Suede.', uses: 'drink', do: () => { ui.removeItem('drink'); set('song'); ch(2, 'OILED THE GROOVE'); ui.close(); say('NARRATION', 'Velvet Fingers drops MIRACLE BOOGIE. Feet materialize across the dance floor like a summoning ritual. The boogie gods are awake, and slightly embarrassed.'); } },
            EXIT
          ]);
        } else {
          dlg('DJ VELVET FINGERS', 'The floor\'s flat, the crowd\'s flat, and my last track got two comments. One from a bouncer. One from God.', [
            { label: 'What gets this room moving?', do: () => say('DJ VELVET FINGERS', 'MIRACLE BOOGIE. One spin and the floor wakes up possessed. But I don\'t touch the decks without a Blue Suede from Marge. Professional standards are professional standards.') },
            { label: 'Nice "headphones."', do: () => say('DJ VELVET FINGERS', 'Those are my ears. Aggressive ones. They flirt on my behalf. You\'re welcome.') },
            EXIT
          ]);
        }
        break;
      case 'bruno':
        if (has('vipOpen')) {
          dlg('BRUNO', 'The boss heard Miracle Boogie. You are officially cleared as a hazard to the velvet rope. Go. Before I reconsider.', [
            { label: 'Use the VIP door.', do: () => { ui.close(); api.enterRoom('vip', { x: 2.8, z: 2.4 }, 'THE VIP SECTION. THE AIR TASTES RICHER.'); } },
            EXIT
          ]);
        } else {
          dlg('BRUNO', 'Bruno does not move. Bruno IS the door.', [
            { label: 'Special night?', do: () => say('BRUNO', 'Every night is special. None of them include you.') },
            { label: 'What WOULD get me in?', do: () => say('BRUNO', 'The boss never says no to whoever moved the floor. Go move it. I will pretend not to see you try.') },
            EXIT
          ]);
        }
        break;
      case 'gate':
        if (!has('vipOpen')) say('NARRATION', 'A velvet rope and a wall named Bruno. Biology and policy both decline your entry.');
        else api.enterRoom('vip', { x: 2.8, z: 2.4 }, 'THE VIP SECTION. THE AIR TASTES RICHER.');
        break;
      case 'sign':
        say('TERRY', 'Six words of pink neon. Four letters of ambition. I have never felt less understood by a municipality.');
        break;
      /* ---------- CHAPTER 1: VIP ---------- */
      case 'kate':
        if (has('cup1')) dlg('CHAMPAGNE KATE', 'Mr. Suede. Still basking? It suits you almost as badly as the pants.', [EXIT]);
        else dlg('CHAMPAGNE KATE', 'Tight Pants Terry. The whole floor won\'t stop talking about your hips. It\'s throwing off my champagne.', [
          { label: 'Name the beat.', do: () => { ui.close(); enterDance(1.0, 'cup1', 'CHAMPAGNE KATE', 'The floor remembers, sugar. Go rehearse where the lighting is humbler. Return when your knees have papers.'); } },
          { label: 'Just here for the ambiance.', do: () => say('CHAMPAGNE KATE', 'Ambiance is free. Legends pay in sweat. Shout when you\'re done sightseeing.') },
          EXIT
        ]);
        break;
      case 'trophy':
        say('TERRY', 'Me, in miniature. And in about ninety minutes, a smaller plaque with my name badly engraved on it.');
        break;
      case 'champagne':
        if (!has('glass')) { set('glass'); ch(1, 'ONE GLASS, HELD CORRECTLY'); say('TERRY', 'I take exactly one glass. Class is a measurement, not a feeling.'); }
        else say('NARRATION', 'The bucket notices you. You notice the bucket. No charges filed.');
        break;
      case 'exit':
        api.enterRoom('lounge', { x: 6.2, z: -0.9 }, 'BACK AMONG THE MASSES.');
        break;
      /* ---------- CHAPTER 2: CASINO ---------- */
      case 'pepper':
        if (!has('chip') && !has('wonSlot')) {
          dlg('PIT BOSS PEPPER', 'New face. This floor is cursed, darling - our boogie champion got beaten last week by a crooner with one finger and a smile that costs more than my car.', [
            { label: 'How do you break a house curse?', do: () => say('PIT BOSS PEPPER', 'House motto: luck is for tourists. But some genius "lucky\'d" their chip into the fern by the fountain. Take it. Consider it a donation to destiny.') },
            { label: 'Who\'s the crooner?', do: () => say('PIT BOSS PEPPER', 'Cassino the Lounge Lizard. Gold lame, teeth like a bank ad. Beat him at the boogie and the management Cup is yours. I get quiet. Everybody wins.') },
            EXIT
          ]);
        } else if (has('wonSlot')) {
          dlg('PIT BOSS PEPPER', 'You wear that sash like a man who files taxes and wins games. Go bother Cassino. The house is praying you don\'t, then hoping you do.', [EXIT]);
        } else {
          dlg('PIT BOSS PEPPER', 'You found the chip. Naturally. You radiate lost-and-found energy.', [EXIT]);
        }
        break;
      case 'plant':
        if (!has('chip')) {
          say('NARRATION', 'Dead fronds, new regrets, and one solid gold lucky chip. That fern has been carrying a curse like a waiter carries a grudge.', () => { ui.addItem('chip'); set('chip'); });
        } else say('NARRATION', 'The fern looks lighter already. Guilt-free foliage suits it.');
        break;
      case 'fountain':
        if (!has('wish')) { set('wish'); ch(1, 'HAZY FUTURE'); say('TERRY', 'I wish for riches. I wish for humility. The fountain rejects both applications with a splash.'); }
        else say('NARRATION', 'The fountain still hasn\'t processed my paperwork.');
        break;
      case 'slot':
        if (has('wonSlot')) {
          say('NARRATION', 'The machine sleeps. It owes you nothing except quarters you will lose in the gift shop.');
        } else if (ui.hasItem('chip')) {
          dlg('THE ONE-ARMED BANDIT', 'Three reels, zero mercy, one painted-on smile.', [
            { label: 'Feed it the Lucky Chip.', uses: 'chip', do: () => {
              ui.removeItem('chip'); set('wonSlot'); ch(2, 'HOUSE BROKEN');
              api.sash(true); ui.close();
              say('NARRATION', 'Three gold cups line up. The machine apologizes in quarters and spits out the manager\'s ceremonial sash. You put it on. The ceiling lights approve, which is legally binding here.', () => ui.toast('SASH EQUIPPED. SHOWMANSHIP: MAXIMUM.'));
            } },
            { label: 'Lose a quarter for moral support.', do: () => say('NARRATION', 'The quarter declines your company.') }
          ]);
        } else {
          dlg('THE ONE-ARMED BANDIT', 'Three reels, zero mercy, one painted-on smile.', [
            { label: 'It wants something from you.', do: () => say('NARRATION', 'The coin slot stares. You stare back. Somewhere, a fern is getting nervous.') },
            EXIT
          ]);
        }
        break;
      case 'cassino':
        if (has('cup2')) dlg('CASSINO', 'The champion graces my humble neon. I would weep, but tears ruin the lamé.', [EXIT]);
        else if (!has('wonSlot')) {
          dlg('CASSINO', 'Tight Pants Terry. The crowd says you boogie. The crowd also raves about the shrimp cocktail. The crowd is wrong.', [
            { label: 'Ready when you are.', do: () => say('CASSINO', 'Sash first, Terry. Showmanship before spectacle. It\'s in the bylaws. I wrote the bylaws.') },
            EXIT
          ]);
        } else {
          dlg('CASSINO', 'The sash. The nerve. Very well. The management Cup, one dance, no re-runs, no lawyers.', [
            { label: 'Boogie.', do: () => { ui.close(); enterDance(1.15, 'cup2', 'CASSINO', 'One finger, Terry. One finger. Come back when you\'ve rehearsed the other five.'); } },
            EXIT
          ]);
        }
        break;
      /* ---------- CHAPTER 3: SHIP ---------- */
      case 'steward':
        dlg('STEWARD PIP', 'Evening, sir. Formalities aboard the Excess: a hat commands respect, the buffet commands patience, and Officer Sterling commands... the rest of you, apparently.', [
          { label: 'Who is Officer Sterling?', do: () => say('STEWARD PIP', 'He runs the midnight Lido dance-off. He has never smiled, never sweated, and never lost. We are all quietly waiting for the "never" to end. That\'s you, sir. Stop looking at me like that.') },
          { label: 'Any shortcuts?', do: () => say('STEWARD PIP', 'The Captain left his hat on the rack again. The buffet opens at eleven. Marry both facts and you\'re invited to everything.') },
          EXIT
        ]);
        break;
      case 'hatrack':
        if (!ui.hasItem('hat')) {
          say('NARRATION', 'The Captain\'s hat, abandoned by a man with poor taste and a good view. I am his upgrade.', () => { ui.addItem('hat'); ch(1, 'COMMANDING HEADSPACE'); });
        } else say('NARRATION', 'The rack misses its hat. You take it personally, and positively.');
        break;
      case 'tray':
        if (!ui.hasItem('skewer')) {
          say('NARRATION', 'The midnight buffet. One perfect skewer: olive, tomato, cheese, zero regrets. It is yours now, legally and spiritually.', () => { ui.addItem('skewer'); });
        } else say('NARRATION', 'The buffet guards its remaining skewers with the fury of the truly petty.');
        break;
      case 'rail':
        if (!has('sea')) { set('sea'); ch(1, 'ROMANTIC ACCOUNTING'); say('TERRY', 'The sea is black, endless, and quietly taking notes on my evening. I have never been so peer-reviewed.'); }
        else say('TERRY', 'Still endless. Still taking notes. I have begun writing back.');
        break;
      case 'sterling':
        if (has('cup3')) dlg('OFFICER STERLING', 'The deck belongs to you, sir. I have smiled twice today and HR is handling it.', [EXIT]);
        else dlg('OFFICER STERLING', 'Dress code and a canape. That is the entire philosophy of this ship, and most marriages.', [
          { label: 'I am the dress code.', do: () => {
            if (ui.hasItem('hat') && ui.hasItem('skewer')) {
              ui.close(); enterDance(1.3, 'cup3', 'OFFICER STERLING', 'Disembarrassment is available in the gift shop, sir. Right between the ashtrays and hope.');
            } else {
              say('OFFICER STERLING', 'You lack a hat, a snack, and - statistically - confidence. Two of those are within my eyeline. Fix the other two.');
            }
          } },
          EXIT
        ]);
        break;
      /* ---------- CHAPTER 4: SPA ---------- */
      case 'zen':
        dlg('ATTENDANT ZEN', 'Welcome to serenity. The mud grounds you. The sauna accelerates you. The Queen judges all three. There are robes. There are no refunds.', [
          { label: 'Tell me about the Queen.', do: () => say('ATTENDANT ZEN', 'Zen Queen Mireille. Defends the Cup at dawn. Has defeated forty challengers with one closed eye. The mud pool is the traditional armor. The sauna is the traditional lie you tell yourself first.') },
          { label: 'Is the mud... necessary?', do: () => say('ATTENDANT ZEN', 'Nothing here is necessary, sir. That\'s why you\'re paying for it.') },
          EXIT
        ]);
        break;
      case 'mudpool':
        if (!ui.hasItem('mud')) {
          say('NARRATION', 'Volcanic mud: allegedly ancient, allegedly healing, allegedly not a lifestyle. You fill a tub. You feel ten thousand years younger and forty years dumber. Balance.', () => { ui.addItem('mud'); ch(1, 'PRIMAL GLOW'); });
        } else say('NARRATION', 'The pool ripples in what you choose to interpret as respect.');
        break;
      case 'sauna':
        if (!has('steamed')) { set('steamed'); ch(1, 'DEEPLY STEAMED'); say('TERRY', 'You knock. The sauna ignores you. It\'s meditating, or it\'s you again. Either way, you leave a different - more humid - man.'); }
        else say('NARRATION', 'The sauna remembers you. It does not forgive you.');
        break;
      case 'cukes':
        if (!has('cukes')) { set('cukes'); ch(1, 'SPAWNED FOR THE MAT'); say('TERRY', 'Two cucumber slices. Yours for the mat, not the eyes. The attendant saw that. The attendant says nothing. The attendant is lying.'); }
        else say('NARRATION', 'The cucumbers have been avenged. You retreat.');
        break;
      case 'zenqueen':
        if (has('cup4')) dlg('ZEN QUEEN MIREILLE', 'The mud champion returns to pollute my calm. How very... mortal of you. How very welcome.', [EXIT]);
        else dlg('ZEN QUEEN MIREILLE', 'You bring ambition to my mat. Interesting. Interesting is allowed to challenge. Timid must purchase a day pass.', [
          { label: 'Namaste this.', do: () => {
            if (ui.hasItem('mud') && has('cukes')) {
              ui.close(); enterDance(1.25, 'cup4', 'ZEN QUEEN MIREILLE', 'Breathe in failure. Breathe out practice. Return when your chakras have choreography.');
            } else {
              say('ZEN QUEEN MIREILLE', 'Cleanse first. I can smell your doubt from the mat, and it is wearing cheap cologne.');
            }
          } },
          EXIT
        ]);
        break;
      /* ---------- CHAPTER 5: SPACE ---------- */
      case 'locker':
        if (!ui.hasItem('pom')) {
          say('NARRATION', 'Crew locker 42: one pair of ceremonial zero-g pom-poms, issued for morale. Morale is about to spike violently.', () => { ui.addItem('pom'); });
        } else say('NARRATION', 'Empty. Morale has been extracted. You are the extraction.');
        break;
      case 'console':
        if (!has('grav')) {
          set('grav'); ch(1, 'GRAVITY SUSPECT');
          say('TERRY', 'The console reads GRAVITY: 100%. You adjust the dial to 40%. Somewhere below your feet, a hundred soup bowls feel the change and file complaints.');
        } else say('NARRATION', 'The gravity dial is set. The ship has accepted its new dance partner.');
        break;
      case 'viewport':
        if (!has('view')) { set('view'); ch(2, 'ORBITAL FLEX'); say('TERRY', 'Earth, out the window: blue, patient, entirely unaware it is being looked down upon by the finest leisure machine ever built. You flex. It rotates. Even match.'); }
        else say('TERRY', 'Still blue. Still unaware. Still losing.');
        break;
      case 'droid':
        if (has('cup5')) dlg('R-1N', 'CHAMPION TERMINAL ONLINE. I HAVE STARTED APPRECIATING MUSIC AS A PODCAST. TEACH ME.', [EXIT]);
        else dlg('R-1N', 'GREETINGS, TIGHT PANTS TERRY. I HAVE ANALYZED 4,400,000 DANCES. MY HIP ACTION IS MATHEMATICALLY FLAWLESS. FLAWLESSNESS DOES NOT SWEAT. YOU APPEAR TO BE SWEATING.', [
          { label: 'Run the analysis, then.', do: () => {
            if (ui.hasItem('pom') && has('grav')) {
              ui.close(); enterDance(1.6, 'cup5', 'R-1N', 'RECALCULATING... YOU WERE THE VARIABLE. REAPPLY CHARM AND RETRY.');
            } else {
              say('R-1N', 'INSUFFICIENT COSTUMING. ACTIVATE LOW GRAVITY FIRST. MY SERVICING MANUAL REQUIRES IT, AND I NEVER ARGUE WITH THE MANUAL.');
            }
          } },
          EXIT
        ]);
        break;
    }
  }

  return {
    state,
    interact,
    onRoom,
    objective,
    chapters: CHAPTERS,
    currentChapter: () => state.chapter
  };
}
