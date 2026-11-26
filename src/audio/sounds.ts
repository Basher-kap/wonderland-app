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
} satisfies Record<string, Record<string, number>>;

export type SoundGame = keyof typeof SOUNDS;
export type SoundName<G extends SoundGame> = keyof (typeof SOUNDS)[G] & string;
