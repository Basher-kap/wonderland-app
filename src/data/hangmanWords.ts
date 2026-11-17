
// Hangman answers: proper nouns only (letters A-Z and spaces, no digits or punctuation).
// Categories: famous brands, NBA teams, celebrities, famous events, movies,
// anime, games, landmarks, artifacts and artwork, natural wonders,
// fictional characters, historical places, mythology, and literature.

export type HangmanEntry = { text: string; category: string };

const list = (category: string, items: string[]): HangmanEntry[] =>
  items.map((text) => ({ text, category }));

export const HANGMAN_WORDS: HangmanEntry[] = [
  ...list('Brand', [
    // Technology and Electronics
    'Huawei', 'Xiaomi', 'Oppo', 'Vivo', 'Realme',
    'OnePlus', 'Motorola', 'Asus', 'Acer', 'Dell',
    'HP', 'Razer', 'Logitech', 'Canon', 'Nikon',
    'Panasonic', 'Toshiba', 'Sharp', 'Philips', 'JBL',
    'Bose', 'Beats', 'Garmin', 'Fitbit', 'GoPro',
    'Nintendo', 'Seagate', 'Western Digital', 'Kingston',
    'Corsair',

    // Fashion and Luxury
    'Chanel', 'Dior', 'Versace', 'Burberry', 'Balenciaga',
    'Givenchy', 'Fendi', 'Hermes', 'Armani', 'Calvin Klein',
    'Tommy Hilfiger', 'Ralph Lauren', 'Lacoste', 'Converse',
    'Vans', 'New Balance', 'Under Armour', 'Reebok',
    'Asics', 'Skechers', 'Crocs', 'Timberland', 'Champion',
    'Fila', 'H and M', 'Zara', 'Gap', 'Forever Twenty One',
    'Pull and Bear', 'Bershka',

    // Food and Beverages
    'KFC', 'McDonalds', 'Burger King', 'Wendys', 'Subway',
    'Dominos', 'Pizza Hut', 'Popeyes', 'Dunkin', 'Krispy Kreme',
    'Tim Hortons', 'Five Guys', 'Taco Bell', 'Chipotle',
    'Panda Express', 'Texas Roadhouse', 'Red Lobster',
    'Cinnabon', 'Auntie Annes', 'Jamba Juice',
    'Mountain Dew', 'Dr Pepper', 'Sprite', 'Fanta',
    'Gatorade', 'Powerade', 'Nescafe', 'Milo', 'Ovaltine',
    'Hersheys', 'Snickers', 'Mars', 'Twix', 'M and M',
    'Ferrero Rocher', 'Toblerone', 'Cadbury', 'KitKat',
    'Chupa Chups', 'Mentholatum',

    // Filipino Brands
    'Bench', 'Penshoppe', 'Human Nature', 'Bayo',
    'Kultura', 'National Book Store', 'Fully Booked',
    'Mercury Drug', 'Watsons', 'SM Supermalls',
    'Robinsons', 'Puregold', 'Rustans', 'Landmark',
    'Goldilocks', 'Red Ribbon', 'Mang Inasal',
    'Maxs Restaurant', 'Andoks', 'Greenwich',
    'Potato Corner', 'Lola Nena', 'Contis',
    'Mary Grace', 'The Generics Pharmacy',
    'Cebu Pacific', 'Philippine Airlines',
    'Globe Telecom', 'Smart Communications',
    'PLDT', 'Converge',

    // Automotive
    'Mitsubishi', 'Nissan', 'Mazda', 'Subaru',
    'Suzuki', 'Isuzu', 'Hyundai', 'Kia', 'Chevrolet',
    'Ford', 'Jeep', 'Dodge', 'Cadillac', 'Porsche',
    'Bugatti', 'Rolls Royce', 'Bentley', 'Aston Martin',
    'McLaren', 'Maserati', 'Volvo', 'Volkswagen',
    'Audi', 'BMW', 'Mini Cooper', 'Land Rover',
    'Jaguar', 'Lexus', 'Infiniti', 'Acura',

    // Beauty and Personal Care
    'Maybelline', 'Loreal', 'Mac Cosmetics', 'Estee Lauder',
    'Clinique', 'Lancome', 'Sephora', 'Fenty Beauty',
    'Rare Beauty', 'Nars', 'Nyx', 'Revlon', 'Olay',
    'Dove', 'Nivea', 'Vaseline', 'Garnier', 'Cetaphil',
    'Neutrogena', 'The Body Shop', 'Bath and Body Works',
    'Head and Shoulders', 'Pantene', 'Sunsilk',
    'TRESemme', 'Johnson and Johnson',

    // Entertainment and Online Services
    'Twitch', 'Discord', 'Reddit', 'Pinterest',
    'Snapchat', 'Tiktok', 'LinkedIn', 'Telegram',
    'WhatsApp', 'Viber', 'Zoom', 'Dropbox',
    'PayPal', 'Visa', 'American Express',
    'Uber', 'Grab', 'Airbnb', 'Shopee', 'Lazada',
    'Alibaba', 'eBay', 'Etsy', 'Temu', 'Shein',
    'Canva', 'Adobe', 'Autodesk', 'Steam',
    'Epic Games', 'Riot Games'
  ]),


  ...list('NBA team', [
    'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets',
    'Charlotte Hornets', 'Chicago Bulls', 'Cleveland Cavaliers',
    'Dallas Mavericks', 'Denver Nuggets', 'Detroit Pistons',
    'Golden State Warriors', 'Houston Rockets', 'Indiana Pacers',
    'Los Angeles Clippers', 'Los Angeles Lakers',
    'Memphis Grizzlies', 'Miami Heat', 'Milwaukee Bucks',
    'Minnesota Timberwolves', 'New Orleans Pelicans',
    'New York Knicks', 'Oklahoma City Thunder', 'Orlando Magic',
    'Phoenix Suns', 'Portland Trail Blazers', 'Sacramento Kings',
    'San Antonio Spurs', 'Toronto Raptors', 'Utah Jazz',
    'Washington Wizards'
  ]),

  ...list('Celebrity', [
    'Taylor Swift', 'Michael Jordan', 'Lionel Messi',
    'Cristiano Ronaldo', 'Lebron James', 'Stephen Curry',
    'Kobe Bryant', 'Beyonce', 'Rihanna', 'Justin Bieber',
    'Ariana Grande', 'Billie Eilish', 'Bruno Mars', 'Elon Musk',
    'Bill Gates', 'Jackie Chan', 'Bruce Lee', 'Tom Cruise',
    'Brad Pitt', 'Leonardo DiCaprio', 'Will Smith',
    'Keanu Reeves', 'Robert Downey', 'Emma Watson',
    'Manny Pacquiao', 'Lea Salonga', 'Kathryn Bernardo',
    'Jose Rizal', 'Albert Einstein', 'Barack Obama',
    'Oprah Winfrey', 'Kim Kardashian', 'Ed Sheeran',
    'Lady Gaga', 'Dua Lipa', 'Harry Styles', 'Zendaya',
    'Tom Holland', 'Scarlett Johansson', 'Morgan Freeman',
    'Serena Williams', 'Roger Federer', 'Usain Bolt',
    'Michael Phelps', 'Tiger Woods', 'Neymar', 'Kylian Mbappe',
    'Jennifer Lopez', 'Johnny Depp', 'Shakira'
  ]),

  ...list('Famous event', [
    'World War Two', 'Moon Landing', 'Fall of the Berlin Wall',
    'Chernobyl Disaster', 'Olympic Games', 'World Cup',
    'Super Bowl', 'Boston Tea Party', 'French Revolution',
    'Industrial Revolution', 'Cold War', 'Great Depression',
    'Pearl Harbor', 'People Power Revolution',
    'Battle of Mactan', 'Eruption of Mount Pinatubo',
    'Black Death', 'Hurricane Katrina', 'Great Fire of London',
    'Sinking of the Titanic', 'Woodstock Festival',
    'Battle of Waterloo', 'Renaissance', 'Independence Day',
    'Black Friday'
  ]),

  ...list('Movie', [
    'Titanic', 'Avatar', 'Inception', 'Interstellar',
    'Gladiator', 'The Godfather', 'Jurassic Park', 'Jaws',
    'The Avengers', 'Iron Man', 'Black Panther',
    'Doctor Strange', 'Thor', 'Captain America',
    'Spider Man', 'The Dark Knight', 'Joker',
    'Deadpool', 'Transformers', 'Fast and Furious',
    'Mission Impossible', 'The Hunger Games',
    'The Lord of the Rings', 'The Hobbit',
    'Pirates of the Caribbean', 'Home Alone', 'The Lion King',
    'Frozen', 'Moana', 'Finding Nemo', 'Toy Story', 'Shrek',
    'Kung Fu Panda', 
  ]),

  ...list('Series', [
       'Harry Potter', 'Alice in Wonderland', 'The Lord of the Rings', 'The Hobbit',
    'Squid Game', 'Friends', 'Game of Thrones', 'Breaking Bad',
    'The Office', 'Stranger Things', 'The Mandalorian',
    'The Witcher', 'The Crown', 'The Simpsons',
    'Rick and Morty', 'The Big Bang Theory',
    'How I Met Your Mother', 'Grey\'s Anatomy',
    'The Walking Dead', 'Westworld', 'Black Mirror',
    'Better Call Saul', 'Narcos', 'Money Heist',
    'Peaky Blinders', 'Vikings', 'Suits', 'House of Cards',
    'The Umbrella Academy', 'Lucifer', 'The Boys'
  ]),

  ...list('Anime', [
    'Naruto', 'One Piece', 
    'Dragon Ball', 'Bleach', 'Attack on Titan', 'Demon Slayer',
    'Jujutsu Kaisen', 'My Hero Academia', 'Death Note',
    'Hunter x Hunter', 'Tokyo Ghoul', 'Fullmetal Alchemist',
    'Sword Art Online', 'One Punch Man', 'Spy x Family',
    'Chainsaw Man', 'Haikyuu', 'Blue Lock', 'Fairy Tail',
    'Black Clover', 'Dr Stone', 'JoJo Bizarre Adventure',
    'Code Geass', 'Steins Gate', 'Your Lie in April',
    'Violet Evergarden', 'Frieren', 'Solo Leveling',
    'Berserk', 'Sailor Moon', 'Detective Conan',
    'Inuyasha', 'Initial D', 'Bocchi the Rock',
    'Tokyo Revengers'
  ]),

  ...list('Game', [
    'Super Mario', 'Pikachu', 'Minecraft',
    'Fortnite', 'Mobile Legends','Grand Theft Auto', 'Call of Duty', 'Counter Strike',
    'Valorant', 'League of Legends', 'Dota Two', 'Roblox',
    'Among Us', 'Clash of Clans', 'Clash Royale',
    'Genshin Impact', 'Honkai Star Rail', 'Elden Ring',
    'Dark Souls', 'The Witcher', 'Red Dead Redemption',
    'God of War', 'The Last of Us', 'Resident Evil',
    'Silent Hill', 'Assassins Creed', 'Far Cry', 'The Sims',
    'Animal Crossing', 'Stardew Valley', 'Terraria',
    'Subnautica', 'Fall Guys', 'Overwatch', 'Apex Legends',
    'Rocket League', 'Street Fighter', 'Mortal Kombat',
    'Tekken', 'Five Nights at Freddys'
  ]),

  ...list('Landmark', [
    'Mount Everest', 'Eiffel Tower', 'Great Wall of China',
    'Statue of Liberty', 'Taj Mahal','Burj Khalifa', 'Colosseum', 'Leaning Tower of Pisa',
    'Christ the Redeemer', 'Sydney Opera House',
    'Empire State Building', 'Notre Dame Cathedral',
    'Petronas Towers', 'Angkor Wat', 'Acropolis of Athens',
    'Brandenburg Gate', 'Arc de Triomphe', 'Tower Bridge',
    'Buckingham Palace', 'Westminster Abbey', 'Mount Rushmore',
    'Golden Gate Bridge', 'One World Trade Center',
    'Louvre Museum', 'Forbidden City', 'Neuschwanstein Castle',
    'Hagia Sophia', 'Sagrada Familia', 'Chichen Itza',
    'St Basils Cathedral', 'Lincoln Memorial',
    'Washington Monument', 'Gateway Arch', 'Edinburgh Castle', 'Amazon River', 'Pacific Ocean', 'Sahara Desert',
    'Niagara Falls', 'Big Ben', 'Machu Picchu', 'Grand Canyon',
    'Chocolate Hills', 'Banaue Rice Terraces', 'Mayon Volcano',
    'Manila Bay', 'Times Square', 'Hollywood', 'Silicon Valley'
  ]),

  ...list('Artifact and Artwork', [
    'Mona Lisa','Rosetta Stone', 'Terracotta Army', 'The Thinker',
    'Venus de Milo', 'David', 'The Last Supper',
    'Starry Night', 'The Scream', 'Girl with a Pearl Earring',
    'The Creation of Adam', 'Guernica',
    'The Persistence of Memory',
    'The Great Wave off Kanagawa', 'The Birth of Venus',
    'Winged Victory of Samothrace', 'Mask of Tutankhamun',
    'Shroud of Turin', 'Dead Sea Scrolls', 'Crown Jewels',
    'Holy Grail', 'Excalibur', 'Ark of the Covenant',
    'Antikythera Mechanism', 'Code of Hammurabi',
    'Book of Kells', 'Faberge Egg', 'Peking Man'
  ]),

  ...list('Natural Wonder', [
    'Mount Fuji', 'Victoria Falls', 'Great Barrier Reef',
    'Northern Lights', 'Dead Sea', 'Lake Baikal',
    'Grand Prismatic Spring', 'Yellowstone National Park',
    'Antelope Canyon', 'Death Valley', 'Mount Kilimanjaro',
    'K2', 'Matterhorn', 'Mount Elbrus', 'Galapagos Islands',
    'Bora Bora', 'Maldives', 'Santorini', 'Iguazu Falls',
    'Angel Falls', 'Cliffs of Moher', 'Giant Causeway',
    'Amazon Rainforest', 'Atacama Desert', 'Gobi Desert',
    'Arctic Ocean', 'Red Sea', 'Lake Como', 'Plitvice Lakes',
    'Jeju Island'
  ]),

  ...list('Fictional Character', [
    'Batman', 'Spiderman',
    'Mickey Mouse', 'Darth Vader', 'Luke Skywalker', 'Yoda',
    'Obi Wan Kenobi', 'Hulk', 'Black Widow', 'Wolverine',
    'Wonder Woman', 'Superman', 'Harley Quinn', 'Aquaman',
    'Sherlock Holmes', 'James Bond', 'Indiana Jones',
    'Jack Sparrow', 'Dumbledore', 'Voldemort',
    'Hermione Granger', 'Ron Weasley', 'Gandalf',
    'Frodo Baggins', 'Legolas', 'Gollum',
    'Wednesday Addams', 'Walter White', 'Eleven',
    'Doraemon', 'Anpanman'
  ]),

  ...list('Historical Place', [
    'Ancient Egypt', 'Ancient Greece', 'Roman Empire',
    'Babylon', 'Pompeii', 'Atlantis', 'Petra', 'Troy',
    'Jerusalem', 'Mecca', 'Medina', 'Constantinople',
    'Alexandria', 'Sparta', 'Athens', 'Thebes',
    'Persepolis', 'Mohenjo Daro', 'Great Zimbabwe',
    'Easter Island', 'Tikal', 'Teotihuacan',
    'Valley of the Kings', 'Silk Road'
  ]),

  ...list('Mythology', [
    'Zeus', 'Poseidon', 'Hades', 'Athena', 'Aphrodite',
    'Apollo', 'Artemis', 'Hercules', 'Achilles', 'Medusa',
    'Minotaur', 'Cerberus', 'Pegasus', 'Odin', 'Thor',
    'Loki', 'Ragnarok', 'Valhalla', 'Asgard', 'Anubis',
    'Ra', 'Osiris', 'Cleopatra', 'Gilgamesh',
    'King Arthur', 'Merlin', 'Robin Hood',
    'Loch Ness Monster', 'Bigfoot', 'Kraken'
  ]),

  ...list('Literature', [
    'The Great Gatsby', 'Pride and Prejudice',
    'The Little Prince', 'The Odyssey', 'The Iliad',
    'Don Quixote', 'Les Miserables', 'Dracula',
    'Frankenstein', 'The Chronicles of Narnia',
    'Animal Farm', 'Nineteen Eighty Four',
    'To Kill a Mockingbird', 'The Divine Comedy',
    'The Alchemist', 'The Maze Runner',
    'The Fault in Our Stars', 'Percy Jackson',
    'The Da Vinci Code', 'The Jungle Book',
    'Treasure Island'
  ])
];
