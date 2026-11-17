// Hangman answers: proper nouns only (letters A-Z and spaces, no digits or punctuation).
// Categories (hidden note): famous brands, NBA teams, celebrities, famous events, other
// well-known proper nouns. The category is shown as a hint on the screen.
export type HangmanEntry = { text: string; category: string };

const list = (category: string, items: string[]): HangmanEntry[] => items.map((text) => ({ text, category }));

export const HANGMAN_WORDS: HangmanEntry[] = [
  ...list('Brand', [
    'Toyota', 'Selecta', 'Jollibee', 'Chowking', 'Nike', 'Adidas', 'Puma', 'Coca Cola', 'Pepsi', 'Samsung',
    'Apple', 'Google', 'Amazon', 'Netflix', 'Spotify', 'Youtube', 'Instagram', 'Facebook', 'Microsoft', 'Tesla',
    'Honda', 'Ferrari', 'Lamborghini', 'Mercedes Benz', 'Rolex', 'Gucci', 'Prada', 'Louis Vuitton', 'Nintendo', 'PlayStation',
    'Sony', 'Lego', 'Ikea', 'Nestle', 'Oreo', 'Kitkat', 'Pringles', 'Doritos', 'Colgate', 'Heineken',
    'Starbucks', 'McDonalds', 'Red Bull', 'Uniqlo', 'Levis', 'Lenovo', 'Nvidia', 'Disney', 'Mastercard', 'Hello Kitty',
  ]),
  ...list('NBA team', [
    'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets', 'Chicago Bulls', 'Cleveland Cavaliers',
    'Dallas Mavericks', 'Denver Nuggets', 'Detroit Pistons', 'Golden State Warriors', 'Houston Rockets', 'Indiana Pacers',
    'Los Angeles Clippers', 'Los Angeles Lakers', 'Memphis Grizzlies', 'Miami Heat', 'Milwaukee Bucks',
    'Minnesota Timberwolves', 'New Orleans Pelicans', 'New York Knicks', 'Oklahoma City Thunder', 'Orlando Magic',
    'Phoenix Suns', 'Portland Trail Blazers', 'Sacramento Kings', 'San Antonio Spurs', 'Toronto Raptors', 'Utah Jazz',
    'Washington Wizards',
  ]),
  ...list('Celebrity', [
    'Taylor Swift', 'Michael Jordan', 'Lionel Messi', 'Cristiano Ronaldo', 'Lebron James', 'Stephen Curry', 'Kobe Bryant',
    'Beyonce', 'Rihanna', 'Justin Bieber', 'Ariana Grande', 'Billie Eilish', 'Bruno Mars', 'Elon Musk', 'Bill Gates',
    'Jackie Chan', 'Bruce Lee', 'Tom Cruise', 'Brad Pitt', 'Leonardo DiCaprio', 'Will Smith', 'Keanu Reeves',
    'Robert Downey', 'Emma Watson', 'Manny Pacquiao', 'Lea Salonga', 'Kathryn Bernardo', 'Jose Rizal', 'Albert Einstein',
    'Barack Obama', 'Oprah Winfrey', 'Kim Kardashian', 'Ed Sheeran', 'Lady Gaga', 'Dua Lipa', 'Harry Styles', 'Zendaya',
    'Tom Holland', 'Scarlett Johansson', 'Morgan Freeman', 'Serena Williams', 'Roger Federer', 'Usain Bolt',
    'Michael Phelps', 'Tiger Woods', 'Neymar', 'Kylian Mbappe', 'Jennifer Lopez', 'Johnny Depp', 'Shakira',
  ]),
  ...list('Famous event', [
    'World War Two', 'Moon Landing', 'Fall of the Berlin Wall', 'Chernobyl Disaster', 'Olympic Games', 'World Cup',
    'Super Bowl', 'Boston Tea Party', 'French Revolution', 'Industrial Revolution', 'Cold War', 'Great Depression',
    'Pearl Harbor', 'People Power Revolution', 'Battle of Mactan', 'Eruption of Mount Pinatubo', 'Black Death',
    'Hurricane Katrina', 'Great Fire of London', 'Sinking of the Titanic', 'Woodstock Festival', 'Battle of Waterloo',
    'Renaissance', 'Independence Day', 'Black Friday',
  ]),
  ...list('Proper noun', [
    'Mount Everest', 'Eiffel Tower', 'Great Wall of China', 'Statue of Liberty', 'Taj Mahal', 'Mona Lisa', 'Amazon River',
    'Pacific Ocean', 'Sahara Desert', 'Niagara Falls', 'Big Ben', 'Machu Picchu', 'Grand Canyon', 'Chocolate Hills',
    'Banaue Rice Terraces', 'Mayon Volcano', 'Manila Bay', 'Times Square', 'Hollywood', 'Silicon Valley', 'Harry Potter',
    'Super Mario', 'Pikachu', 'Minecraft', 'Fortnite', 'Mobile Legends', 'Batman', 'Spiderman', 'Mickey Mouse',
    'Alice in Wonderland', 'Game of Thrones', 'Squid Game', 'Stranger Things', 'Naruto', 'One Piece', 'Dragon Ball',
  ]),
];
