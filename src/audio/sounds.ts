// THE ONE LIST OF SOUND FILES. Every sound of every game is registered here, and nowhere else.
//
// Folder convention:   assets/sounds/<gameKey>/<file>.wav        (<gameKey> = the game's folder name in
//                      src/gameThemes/, e.g. russianRoulette, pianoTiles)
// To add a sound:      1. put the file in its game's folder
//                      2. add one line below (Metro needs a literal `require('...')` for every file)
//                      3. play it:  const { play } = useGameSounds('<gameKey>');  play('<name>')
// To add a game:       add a new key below with its sounds. TypeScript then knows the game and its names,
//                      so a misspelt sound name is an error in the editor, not silence on the phone.
export const SOUNDS = {
  russianRoulette: {
    load: require('../../assets/sounds/russianRoulette/roulette-load.wav'),
    spin: require('../../assets/sounds/russianRoulette/roulette-spin.wav'),
    close: require('../../assets/sounds/russianRoulette/roulette-close.wav'),
    click: require('../../assets/sounds/russianRoulette/roulette-click.wav'),
    bang: require('../../assets/sounds/russianRoulette/roulette-bang.wav'),
    shield: require('../../assets/sounds/russianRoulette/roulette-shield.wav'),
  },
  pianoTiles: {
    note1: require('../../assets/sounds/pianoTiles/piano-1.wav'),
    note2: require('../../assets/sounds/pianoTiles/piano-2.wav'),
    note3: require('../../assets/sounds/pianoTiles/piano-3.wav'),
    note4: require('../../assets/sounds/pianoTiles/piano-4.wav'),
    note5: require('../../assets/sounds/pianoTiles/piano-5.wav'),
    note6: require('../../assets/sounds/pianoTiles/piano-6.wav'),
    note7: require('../../assets/sounds/pianoTiles/piano-7.wav'),
    note8: require('../../assets/sounds/pianoTiles/piano-8.wav'),
  },
  battleships: {
    aim: require('../../assets/sounds/battleships/battleships-aim.wav'),
    fire: require('../../assets/sounds/battleships/battleships-fire.wav'),
    hitEnemy: require('../../assets/sounds/battleships/battleships-hit-enemy.wav'),
    hitOwn: require('../../assets/sounds/battleships/battleships-hit-own.wav'),
    miss: require('../../assets/sounds/battleships/battleships-miss.wav'),
  },
  karuta: {
    target: require('../../assets/sounds/karuta/karuta-target.wav'),
    grab: require('../../assets/sounds/karuta/karuta-grab.wav'),
    rackOpen: require('../../assets/sounds/karuta/karuta-rack-open.wav'),
    rackClose: require('../../assets/sounds/karuta/karuta-rack-close.wav'),
  },
  fortune: {
    // 'turnVoice' = the announcer saying "Ikkaime, Sutaato". The file here is a PLACEHOLDER gong: replace it with your recording.
    turnVoice: require('../../assets/sounds/fortune/fortune-turn-voice.wav'),
    templeChoose: require('../../assets/sounds/fortune/fortune-temple-choose.wav'),
    correct: require('../../assets/sounds/fortune/fortune-correct.wav'),
    wrong: require('../../assets/sounds/fortune/fortune-wrong.wav'),
  },
  wordle: {
    key: require('../../assets/sounds/wordle/wordle-key.wav'),
    erase: require('../../assets/sounds/wordle/wordle-erase.wav'),
    tileGreen: require('../../assets/sounds/wordle/wordle-tile-green.wav'),
    tileYellow: require('../../assets/sounds/wordle/wordle-tile-yellow.wav'),
    tileGray: require('../../assets/sounds/wordle/wordle-tile-gray.wav'),
    invalid: require('../../assets/sounds/wordle/wordle-invalid.wav'),
    solved: require('../../assets/sounds/wordle/wordle-solved.wav'),
    failed: require('../../assets/sounds/wordle/wordle-failed.wav'),
  },
  humanCalculator: {
    term: require('../../assets/sounds/humanCalculator/calculator-term.wav'),
    count: require('../../assets/sounds/humanCalculator/calculator-count.wav'),
    tick: require('../../assets/sounds/humanCalculator/calculator-tick.wav'),
    key: require('../../assets/sounds/humanCalculator/calculator-key.wav'),
    send: require('../../assets/sounds/humanCalculator/calculator-send.wav'),
    correct: require('../../assets/sounds/humanCalculator/calculator-correct.wav'),
    wrong: require('../../assets/sounds/humanCalculator/calculator-wrong.wav'),
    timeUp: require('../../assets/sounds/humanCalculator/calculator-timeup.wav'),
  },
  magicalBanana: {
    beat: require('../../assets/sounds/magicalBanana/banana-beat.wav'),
    count: require('../../assets/sounds/magicalBanana/banana-count.wav'),
    turn: require('../../assets/sounds/magicalBanana/banana-turn.wav'),
    send: require('../../assets/sounds/magicalBanana/banana-send.wav'),
    judge: require('../../assets/sounds/magicalBanana/banana-judge.wav'),
    vote: require('../../assets/sounds/magicalBanana/banana-vote.wav'),
    ok: require('../../assets/sounds/magicalBanana/banana-ok.wav'),
    draw: require('../../assets/sounds/magicalBanana/banana-draw.wav'),
    no: require('../../assets/sounds/magicalBanana/banana-no.wav'),
    out: require('../../assets/sounds/magicalBanana/banana-out.wav'),
    win: require('../../assets/sounds/magicalBanana/banana-win.wav'),
  },
} satisfies Record<string, Record<string, number>>;

export type SoundGame = keyof typeof SOUNDS;
export type SoundName<G extends SoundGame> = keyof (typeof SOUNDS)[G] & string;