/**
 * Word Rush — 2-minute daily category + starting-letter word challenge.
 *
 * Every day, everyone gets the same category (or subcategory) and a valid starting
 * letter that has a healthy pool of answers (never an impossible letter like 'X'
 * in Food). Players have 2 minutes (120 seconds) to name as many matching entries
 * as possible. When the timer hits 0, all possible answers are revealed, and scores
 * are posted to the daily and all-time leaderboards.
 */

import { createRng, seedFor, practiceSeed } from '../../core/rng.js';
import { normaliseText } from '../../core/answer.js';

export const WORD_RUSH_DURATION_SECONDS = 120;
export const MIN_WORDS_FOR_LETTER = 5;

/**
 * Rich, curated categories & subcategories for Word Rush.
 * Dynamic categories (Countries, Capitals, Famous People, Actors, Musicians, Athletes)
 * are augmented at runtime from the validated Geography and People datasets.
 */
export const STATIC_CATEGORIES = Object.freeze({
  sport: {
    id: 'sport',
    label: 'Sports & Athletics',
    group: 'Sport',
    items: [
      'Archery', 'Athletics', 'Auto Racing', 'Badminton', 'Baseball', 'Basketball', 'Biathlon',
      'Billiards', 'Bobsleigh', 'Bodybuilding', 'Bowling', 'Boxing', 'Breakdancing', 'Canoeing',
      'Cheerleading', 'Chess', 'Climbing', 'Cricket', 'Croquet', 'CrossFit', 'Curling', 'Cycling',
      'Darts', 'Decathlon', 'Diving', 'Dodgeball', 'Dressage', 'Equestrian', 'Esports', 'Fencing',
      'Field Hockey', 'Figure Skating', 'Fishing', 'Floorball', 'Football', 'Formula One', 'Frisbee',
      'Futsal', 'Gaelic Football', 'Golf', 'Gymnastics', 'Handball', 'Hang Gliding', 'Heptathlon',
      'High Jump', 'Hockey', 'Horse Racing', 'Hurling', 'Ice Hockey', 'Ice Skating', 'Javelin',
      'Jiu-Jitsu', 'Judo', 'Karate', 'Karting', 'Kayaking', 'Kickboxing', 'Kitesurfing', 'Kung Fu',
      'Lacrosse', 'Long Jump', 'Luge', 'Marathon', 'Martial Arts', 'Mixed Martial Arts', 'Motocross',
      'Mountaineering', 'Muay Thai', 'Netball', 'Orienteering', 'Padel', 'Paragliding', 'Parkour',
      'Pentathlon', 'Pickleball', 'Polo', 'Powerlifting', 'Racquetball', 'Rallying', 'Rock Climbing',
      'Rodeo', 'Roller Skating', 'Rowing', 'Rugby', 'Running', 'Sailing', 'Sambo', 'Scuba Diving',
      'Shooting', 'Shot Put', 'Skateboarding', 'Skeleton', 'Ski Jumping', 'Skiing', 'Skydiving',
      'Snooker', 'Snowboarding', 'Soccer', 'Softball', 'Speed Skating', 'Sprint', 'Squash',
      'Sumo Wrestling', 'Surfing', 'Swimming', 'Synchronized Swimming', 'Table Tennis', 'Taekwondo',
      'Tennis', 'Track and Field', 'Trampolining', 'Triathlon', 'Tug of War', 'Ultimate Frisbee',
      'Volleyball', 'Wakeboarding', 'Walking', 'Water Polo', 'Water Skiing', 'Weightlifting',
      'Windsurfing', 'Wrestling', 'Wushu', 'Yachting', 'Yoga',
    ],
  },
  gaming: {
    id: 'gaming',
    label: 'Video Games',
    group: 'Gaming',
    items: [
      'Alan Wake', 'Among Us', 'Animal Crossing', 'Apex Legends', 'Ark Survival Evolved', 'Armored Core',
      'Assassins Creed', 'Astro Bot', 'Baldurs Gate', 'Banjo Kazooie', 'Battlefield', 'Bayonetta',
      'Beat Saber', 'BioShock', 'Bloodborne', 'Borderlands', 'Braid', 'Brawlhalla', 'Brawl Stars',
      'Burnout', 'Call of Duty', 'Candy Crush', 'Castlevania', 'Celeste', 'Chrono Trigger',
      'Cities Skylines', 'Civilization', 'Clash of Clans', 'Clash Royale', 'Control', 'Counter-Strike',
      'Crash Bandicoot', 'Cuphead', 'Cyberpunk 2077', 'Dark Souls', 'DayZ', 'Dead by Daylight',
      'Dead Cells', 'Dead Space', 'Deathloop', 'Death Stranding', 'Destiny', 'Detroit Become Human',
      'Deus Ex', 'Devil May Cry', 'Diablo', 'Dishonored', 'Donkey Kong', 'Doom', 'Dota 2',
      'Dragon Age', 'Dragon Quest', 'Dying Light', 'Elden Ring', 'Elder Scrolls', 'Elite Dangerous',
      'Escape from Tarkov', 'Eve Online', 'Fable', 'Factorio', 'Fall Guys', 'Fallout', 'Far Cry',
      'FIFA', 'Final Fantasy', 'Fire Emblem', 'Five Nights at Freddys', 'For Honor', 'Fortnite',
      'Forza Horizon', 'Frostpunk', 'Garrys Mod', 'Gears of War', 'Genshin Impact', 'Ghost of Tsushima',
      'Goat Simulator', 'God of War', 'GoldenEye 007', 'Gran Turismo', 'Grand Theft Auto', 'Grounded',
      'Guitar Hero', 'Hades', 'Half-Life', 'Halo', 'Hearthsone', 'Helldivers', 'Hitman', 'Hogwarts Legacy',
      'Hollow Knight', 'Horizon Zero Dawn', 'Hotline Miami', 'Human Fall Flat', 'Inside', 'It Takes Two',
      'Jak and Daxter', 'Just Cause', 'Just Dance', 'Kerbal Space Program', 'Kingdom Hearts', 'Kirby',
      'League of Legends', 'Left 4 Dead', 'Lethal Company', 'Life is Strange', 'Limbo', 'LittleBigPlanet',
      'Little Nightmares', 'Luigi Mansion', 'Madden NFL', 'Mafia', 'Mario Kart', 'Mario Party',
      'Mass Effect', 'Max Payne', 'Mega Man', 'Metal Gear Solid', 'Metroid', 'Minecraft', 'Mirrors Edge',
      'Monster Hunter', 'Mortal Kombat', 'Need for Speed', 'NieR Automata', 'No Mans Sky', 'Overcooked',
      'Overwatch', 'Outer Wilds', 'Pac-Man', 'Palworld', 'Payday', 'Persona', 'Phasmophobia', 'Pikmin',
      'Plants vs Zombies', 'Pokemon', 'Portal', 'Prey', 'Prince of Persia', 'PUBG', 'Quake',
      'Rainbow Six Siege', 'Ratchet and Clank', 'Rayman', 'Red Dead Redemption', 'Resident Evil',
      'Returnal', 'RimWorld', 'Risk of Rain', 'Roblox', 'Rocket League', 'Runescape', 'Rust',
      'Sackboy', 'Satisfactory', 'Sea of Thieves', 'Sekiro', 'Shadow of the Colossus', 'Shenmue',
      'Silent Hill', 'SimCity', 'Sims', 'Skate', 'Skyrim', 'Slay the Spire', 'Sleeping Dogs',
      'Smash Bros', 'Sniper Elite', 'Sonic the Hedgehog', 'Soulcalibur', 'Space Invaders', 'Spider-Man',
      'Splatoon', 'Spore', 'Spyro', 'StarCraft', 'Stardew Valley', 'Starfield', 'Star Wars Jedi',
      'Street Fighter', 'Streets of Rage', 'Subnautica', 'Super Mario', 'Super Meat Boy', 'System Shock',
      'Team Fortress 2', 'Tekken', 'Terraria', 'Tetris', 'The Last of Us', 'The Sims', 'The Witcher',
      'Thief', 'Titanfall', 'Tomb Raider', 'Tony Hawk', 'Total War', 'TrackMania', 'Trials',
      'Tropico', 'Uncharted', 'Undertale', 'Until Dawn', 'Valorant', 'Vampire Survivors', 'Warframe',
      'Warhammer', 'Watch Dogs', 'Wii Sports', 'Wolfenstein', 'World of Warcraft', 'Worms', 'XCOM',
      'Yakuza', 'Zelda',
    ],
  },
  'fortnite-weapons': {
    id: 'fortnite-weapons',
    label: 'Weapons & Items in Fortnite',
    group: 'Gaming',
    items: [
      'Assault Rifle', 'Auto Shotgun', 'Bandage Bazooka', 'Batarang', 'Bolt-Action Sniper Rifle',
      'Boogie Bomb', 'Boom Bow', 'Bounce Pad', 'Burst Assault Rifle', 'Bush', 'Campfire',
      'Charge Shotgun', 'Chug Jug', 'Chug Splash', 'Clinger', 'Combat Assault Rifle', 'Combat Pistol',
      'Combat Shotgun', 'Combat SMG', 'Compact SMG', 'Crash Pad', 'Crossbow', 'Cuddle Fish',
      'Cybertron Cannon', 'Damage Trap', 'Decoy', 'Drum Gun', 'Drum Shotgun', 'Dual Pistols',
      'Dynamite', 'Ex-Caliber Rifle', 'Explosive Goo Gun', 'Firefly Jar', 'Flare Gun', 'Flint-Knock Pistol',
      'FlowBerry Fizz', 'Gatekeeper Shotgun', 'Grapple Blade', 'Grappler', 'Grenade', 'Grenade Launcher',
      'Guided Missile', 'Guzzle Juice', 'Hammer Assault Rifle', 'Hand Cannon', 'Harpoon Gun',
      'Havoc Pump Shotgun', 'Heavy Assault Rifle', 'Heavy Shotgun', 'Heavy Sniper Rifle',
      'Hop Rock Dualies', 'Hoverboard', 'Hunter Bolt-Action Sniper', 'Hunting Rifle', 'Impulse Grenade',
      'Infantry Rifle', 'Infinity Blade', 'Jetpack', 'Junk Rift', 'Kinetic Blade', 'Kinetic Boomerang',
      'Kinetic Hammer', 'Launch Pad', 'Lever Action Rifle', 'Lever Action Shotgun', 'Light Machine Gun',
      'Lock On Pistol', 'Mammoth Pistol', 'Maven Auto Shotgun', 'Med-Mist', 'Medkit', 'Minigun',
      'Mini Shield Potion', 'MK-Seven Assault Rifle', 'Mythic Goldfish', 'Nemesis AR', 'Nitro Fists',
      'Port-A-Bunker', 'Port-A-Fort', 'Port-A-Fortress', 'Primal Rifle', 'Primal Shotgun',
      'Proximity Grenade Launcher', 'Pulse Rifle', 'Pump Shotgun', 'Pumpkin Launcher', 'Quad Launcher',
      'Rail Gun', 'Hammer Pump Shotgun', 'Ranger Assault Rifle', 'Ranger Pistol', 'Ranger Shotgun',
      'Rapid Fire SMG', 'Reaper Sniper Rifle', 'Recon Scanner', 'Red-Eye Assault Rifle', 'Remote Explosives',
      'Revolver', 'Rift-To-Go', 'Rocket Launcher', 'Rocket Ram', 'Scar', 'Scoped Assault Rifle',
      'Scoped Revolver', 'Shadow Bomb', 'Sharp Tooth Shotgun', 'Shield Bubble', 'Shield Keg',
      'Shield Potion', 'Shockwave Bow', 'Shockwave Grenade', 'Shockwave Hammer', 'Sidearm Pistol',
      'Silenced Pistol', 'Silenced Scar', 'Six Shooter', 'Slap Juice', 'Slurpfish', 'Slurp Juice',
      'Smart Pistol', 'SMG', 'Sovereign Shotgun', 'Spider-Man Web Shooters', 'Stinger SMG',
      'Stink Bomb', 'Striker AR', 'Striker Burst Rifle', 'Striker Pump Shotgun', 'Submachine Gun',
      'Suppressed Assault Rifle', 'Suppressed Pistol', 'Suppressed SMG', 'Suppressed Sniper Rifle',
      'Tactical Assault Rifle', 'Tactical Pistol', 'Tactical Shotgun', 'Tactical SMG', 'Thermal Scoped AR',
      'Thunder Burst SMG', 'Thunder Shotgun', 'Twin Mag AR', 'Twin Mag SMG', 'Two-Shot Shotgun',
      'Zapotron',
    ],
  },
  'rockstar-games': {
    id: 'rockstar-games',
    label: 'Rockstar Games & GTA Universe',
    group: 'Gaming',
    items: [
      'Agent', 'Alderney', 'Algonquin', 'Arthur Morgan', 'Austin', 'Ballas', 'Beaterator',
      'Big Smoke', 'Bifta', 'Blackwater', 'Blaine County', 'Bohan', 'Body Harvest', 'Broker',
      'Brucie Kibbutz', 'Bully', 'Banshee', 'Cayo Perico', 'Carl Johnson', 'Catalina', 'Cesar Vialpando',
      'Chinatown Wars', 'Claude', 'Cheetah', 'Cluckin Bell', 'Comet', 'Cris Formage', 'Deluxo',
      'Devin Weston', 'Dodo', 'Dukes', 'Dutch van der Linde', 'Elegy', 'Epsilon Program', 'FIB',
      'Faggio', 'Franklin Clinton', 'Futo', 'Grove Street', 'Grand Theft Auto', 'GTA Online',
      'GTA San Andreas', 'GTA Vice City', 'GTA Liberty City', 'Guarma', 'Hosea Matthews', 'Hydra',
      'Infernus', 'IAA', 'Jack Marston', 'Jimmy Hopkins', 'John Marston', 'Johnny Klebitz',
      'Karin Kuruma', 'Ken Rosenberg', 'Kifflom', 'kuruma', 'L.A. Noire', 'Lamar Davis', 'Lance Vance',
      'Las Venturas', 'Lazer', 'Lazlow Jones', 'Lester Crest', 'Liberty City', 'Lifeinvader',
      'Little Jacob', 'Los Santos', 'Luis Lopez', 'Manhunt', 'Max Payne', 'Maze Bank', 'Michael De Santa',
      'Midnight Club', 'Micah Bell', 'Mount Chiliad', 'Niko Bellic', 'North Yankton', 'oni',
      'Oppressor', 'Oni', 'Packie McReary', 'Paleto Bay', 'Pay N Spray', 'Pegassi Zentorno',
      'Phil Cassidy', 'Pisswasser', 'Red Dead Online', 'Red Dead Redemption', 'Red Dead Revolver',
      'Rhino Tank', 'Roman Bellic', 'Rockstar Table Tennis', 'Ryder', 'Sadie Adler', 'Saint Denis',
      'San Andreas', 'San Fierro', 'Sandy Shores', 'Sentinel', 'Smugglers Run', 'Sonny Forelli',
      'Sprunk', 'State of Emergency', 'Sultan', 'Sweet Johnson', 'The Lost and Damned',
      'The Ballad of Gay Tony', 'The Warriors', 'Tommy Vercetti', 'Toreador', 'Trevor Philips',
      'Turismo', 'Vagos', 'Valentine', 'Vice City', 'Vinewood', 'Zentorno',
    ],
  },
  food: {
    id: 'food',
    label: 'Food, Dishes & Ingredients',
    group: 'Food',
    items: [
      'Almond', 'Anchovy', 'Apple', 'Apple Pie', 'Apricot', 'Artichoke', 'Asparagus', 'Avocado',
      'Bacon', 'Bagel', 'Baguette', 'Baklava', 'Banana', 'Barbecue', 'Basil', 'Beef', 'Beef Stroganoff',
      'Beetroot', 'Biryani', 'Biscuit', 'Blackberry', 'Blueberry', 'Bolognese', 'Bratwurst', 'Bread',
      'Brie', 'Brisket', 'Broccoli', 'Brownie', 'Bruschetta', 'Burger', 'Burrito', 'Butter',
      'Cabbage', 'Caesar Salad', 'Cake', 'Calamari', 'Camembert', 'Cannoli', 'Cantaloupe', 'Caprese',
      'Caramel', 'Carbonara', 'Carrot', 'Cashew', 'Cassava', 'Cauliflower', 'Caviar', 'Celery',
      'Ceviche', 'Cheddar', 'Cheese', 'Cheeseburger', 'Cheesecake', 'Cherry', 'Chestnut', 'Chicken',
      'Chickpea', 'Chili Con Carne', 'Chimichanga', 'Chips', 'Chocolate', 'Chorizo', 'Chowder',
      'Churro', 'Cilantro', 'Cinnamon', 'Clam', 'Clementine', 'Cobbler', 'Coconut', 'Cod', 'Coleslaw',
      'Cookie', 'Corn', 'Cornbread', 'Couscous', 'Crab', 'Cranberry', 'Crepe', 'Croissant', 'Cucumber',
      'Cupcake', 'Curry', 'Custard', 'Date', 'Dim Sum', 'Donut', 'Dragonfruit', 'Duck', 'Dumpling',
      'Durian', 'Edamame', 'Egg', 'Eggplant', 'Empanada', 'Enchilada', 'Escargot', 'Espresso',
      'Fajita', 'Falafel', 'Fennel', 'Feta', 'Fig', 'Filet Mignon', 'Fish and Chips', 'Flan',
      'Focaccia', 'Fondue', 'French Fries', 'French Toast', 'Fried Chicken', 'Fried Rice', 'Fudge',
      'Garlic', 'Gazpacho', 'Gelato', 'Ginger', 'Gnocchi', 'Goat Cheese', 'Gouda', 'Goulash',
      'Granola', 'Grape', 'Grapefruit', 'Gravy', 'Greek Salad', 'Green Bean', 'Guacamole', 'Guava',
      'Gumbo', 'Gyro', 'Haddock', 'Haggis', 'Halibut', 'Halloumi', 'Ham', 'Hamburger', 'Hash Browns',
      'Hazelnut', 'Herring', 'Honey', 'Honeydew', 'Hot Dog', 'Hummus', 'Ice Cream', 'Jackfruit',
      'Jalapeno', 'Jam', 'Jambalaya', 'Jelly', 'Jerky', 'Kale', 'Kebab', 'Ketchup', 'Key Lime Pie',
      'Kimchi', 'Kiwi', 'Kohlrabi', 'Kombucha', 'Lamb', 'Lasagna', 'Leek', 'Lemon', 'Lentil',
      'Lettuce', 'Licorice', 'Lime', 'Linguine', 'Lobster', 'Lychee', 'Macaron', 'Macaroni',
      'Mango', 'Maple Syrup', 'Marzipan', 'Mashed Potatoes', 'Matcha', 'Mayonnaise', 'Meatball',
      'Meatloaf', 'Melon', 'Meringue', 'Milkshake', 'Minestrone', 'Mint', 'Miso Soup', 'Molasses',
      'Moussaka', 'Mozzarella', 'Muffin', 'Mushroom', 'Mussel', 'Mustard', 'Naan', 'Nachos',
      'Nectarine', 'Noodles', 'Nougat', 'Nutmeg', 'Oatmeal', 'Octopus', 'Okra', 'Olive', 'Omelette',
      'Onion', 'Orange', 'Oregano', 'Oyster', 'Pad Thai', 'Paella', 'Pancake', 'Paneer', 'Papaya',
      'Paprika', 'Parmesan', 'Parsley', 'Parsnip', 'Passionfruit', 'Pasta', 'Pastrami', 'Peach',
      'Peanut', 'Peanut Butter', 'Pear', 'Peas', 'Pecan', 'Peking Duck', 'Pepper', 'Pepperoni',
      'Persimmon', 'Pesto', 'Pho', 'Pickle', 'Pie', 'Pineapple', 'Pistachio', 'Pita', 'Pizza',
      'Plantain', 'Plum', 'Polenta', 'Pomegranate', 'Popcorn', 'Pork', 'Porridge', 'Potato',
      'Poutine', 'Prawn', 'Pretzel', 'Prosciutto', 'Prune', 'Pudding', 'Pumpkin', 'Quesadilla',
      'Quiche', 'Quinoa', 'Radish', 'Raisin', 'Ramen', 'Raspberry', 'Ratatouille', 'Ravioli',
      'Red Cabbage', 'Rhubarb', 'Ribs', 'Rice', 'Ricotta', 'Risotto', 'Roast Beef', 'Rosemary',
      'Saffron', 'Salad', 'Salami', 'Salmon', 'Salsa', 'Salt', 'Samosa', 'Sandwich', 'Sardine',
      'Sashimi', 'Satay', 'Sauerkraut', 'Sausage', 'Scallop', 'Scone', 'Seaweed', 'Sesame',
      'Shallot', 'Shawarma', 'Shepherds Pie', 'Sherbet', 'Shrimp', 'Smoothie', 'Snapper', 'Soba',
      'Sorbet', 'Souffle', 'ourdough', 'Soup', 'Sour Cream', 'Soy Sauce', 'Spaghetti', 'Spinach',
      'Spring Roll', 'Squash', 'Squid', 'Steak', 'Strawberry', 'Strudel', 'Sushi', 'Sweet Potato',
      'Swordfish', 'Syrup', 'Taco', 'Tahini', 'Tamale', 'Tangerine', 'Tapas', 'Tapioca', 'Taro',
      'Tart', 'Tempura', 'Teriyaki', 'Thyme', 'Tiramisu', 'Toast', 'Tofu', 'Tomatillo', 'Tomato',
      'Tortellini', 'Tortilla', 'Trout', 'Truffle', 'Tuna', 'Turkey', 'Turmeric', 'Turnip',
      'Udon', 'Vanilla', 'Veal', 'Venison', 'Vinegar', 'Waffle', 'Walnut', 'Wasabi', 'Watercress',
      'Watermelon', 'Whipped Cream', 'Wonton', 'Yam', 'Yogurt', 'Zucchini',
    ],
  },
  music: {
    id: 'music',
    label: 'Music, Bands & Genres',
    group: 'Music',
    items: [
      'ABBA', 'AC/DC', 'Accordion', 'Acoustic Guitar', 'Adele', 'Aerosmith', 'Afrobeats', 'Album',
      'Alice in Chains', 'Alt-J', 'Alternative Rock', 'Ambient', 'Amy Winehouse', 'Anthrax',
      'Aphex Twin', 'Arcade Fire', 'Arctic Monkeys', 'Aretha Franklin', 'Ariana Grande', 'Avicii',
      'Backstreet Boys', 'Bad Bunny', 'Bagpipes', 'Balalaika', 'Ballad', 'Banjo', 'Baritone',
      'Bass Guitar', 'Bassoon', 'Beach Boys', 'Beastie Boys', 'Beatbox', 'Beatles', 'Bebop',
      'Beck', 'Beethoven', 'Bell', 'Benny Goodman', 'Beyonce', 'Billie Eilish', 'Billie Holiday',
      'Billy Joel', 'Bongos', 'Bjork', 'Black Eyed Peas', 'Black Sabbath', 'Blink-182', 'Blondie',
      'Bluegrass', 'Blues', 'Blur', 'Bob Dylan', 'Bob Marley', 'Bon Iver', 'Bon Jovi', 'Bossa Nova',
      'Britney Spears', 'Britpop', 'Bruce Springsteen', 'Bruno Mars', 'Bugle', 'Calvin Harris',
      'Camila Cabello', 'Cardi B', 'Carly Rae Jepsen', 'Cello', 'celine Dion', 'Chamber Music',
      'Chant', 'Charli XCX', 'Cher', 'Chic', 'Childish Gambino', 'Choir', 'Chopin', 'Chorus',
      'Chris Brown', 'Chvrches', 'Clarinet', 'Classical', 'Clave', 'Coldplay', 'Coltrane',
      'Composer', 'Concert', 'Conductor', 'Conga', 'Contralto', 'Cornet', 'Country', 'Cowbell',
      'Cranberries', 'Cream', 'Creedence Clearwater Revival', 'Cure', 'Cymbals', 'Cypress Hill',
      'Daft Punk', 'Dancehall', 'David Bowie', 'David Guetta', 'De La Soul', 'Deadmau5',
      'Death Cab for Cutie', 'Death Metal', 'Debussy', 'Deep Purple', 'Def Leppard', 'Deftones',
      'Demi Lovato', 'Depeche Mode', 'Destiny Child', 'Didgeridoo', 'Dio', 'Dire Straits', 'Disco',
      'DJ', 'Doja Cat', 'Dolly Parton', 'Donovan', 'Doors', 'Double Bass', 'Dr Dre', 'Drake',
      'Dream Theater', 'Drum and Bass', 'Drums', 'Dua Lipa', 'Dubstep', 'Duran Duran', 'Eagles',
      'Earth Wind and Fire', 'Ed Sheeran', 'EDM', 'Electric Guitar', 'Electro', 'Ella Fitzgerald',
      'Ellie Goulding', 'Elton John', 'Elvis Costello', 'Elvis Presley', 'Eminem', 'Emo', 'Encore',
      'Ennio Morricone', 'Enya', 'Eric Clapton', 'Eurythmics', 'anescence', 'Fall Out Boy',
      'Falsetto', 'Fatboy Slim', 'Fela Kuti', 'Fiddle', 'Fifty Cent', 'Fleetwood Mac', 'Flute',
      'Florence and the Machine', 'Folk', 'Foo Fighters', 'Foreigner', 'Foster the People',
      'Frank Ocean', 'Frank Sinatra', 'Frank Zappa', 'Franz Ferdinand', 'Freddie Mercury',
      'French Horn', 'Fugees', 'Funk', 'Future', 'Garage Rock', 'Garth Brooks', 'Genesis',
      'George Michael', 'Gershwin', 'Glockenspiel', 'Gorillaz', 'Gospel', 'Gotye', 'Grateful Dead',
      'Green Day', 'Gregorian Chant', 'Grime', 'Grunge', 'Guitar', 'Guns N Roses', 'Gwen Stefani',
      'Haim', 'Hall and Oates', 'Handel', 'Hans Zimmer', 'Hard Rock', 'Hardcore', 'Harmonica',
      'Harmony', 'Harp', 'Harpsichord', 'Harry Styles', 'Heavy Metal', 'Herbie Hancock', 'Hip Hop',
      'Hoobastank', 'Hozier', 'House Music', 'Ice Cube', 'Iggy Pop', 'Imagine Dragons', 'Indie',
      'Industrial', 'Interpol', 'INXS', 'Iron Maiden', 'Isaac Hayes', 'J Cole', 'Jack White',
      'Jackson 5', 'Jacques Brel', 'James Blake', 'James Brown', 'Jamiroquai', 'Janis Joplin',
      'Janet Jackson', 'Jay-Z', 'Jazz', 'Jeff Buckley', 'Jefferson Airplane', 'Jennifer Lopez',
      'Jethro Tull', 'Jimi Hendrix', 'Jimmy Page', 'Joan Baez', 'Joan Jett', 'John Cage',
      'John Denver', 'John Legend', 'John Lennon', 'John Mayer', 'John Williams', 'Johnny Cash',
      'Joni Mitchell', 'Journey', 'Joy Division', 'Judas Priest', 'Juice WRLD', 'Julian Casablancas',
      'Justin Bieber', 'Justin Timberlake', 'K-Pop', 'Kanye West', 'Kasabian', 'Kate Bush',
      'Katy Perry', 'kazoo', 'Keane', 'Keith Richards', 'Kelly Clarkson', 'Kendrick Lamar',
      'Kenny Rogers', 'Keyboard', 'Khalid', 'Kid Cudi', 'Killers', 'King Crimson', 'Kings of Leon',
      'Kinks', 'Kiss', 'Korn', 'Kraftwerk', 'Kylie Minogue', 'Lady Gaga', 'Lana Del Rey',
      'Lauryn Hill', 'LCD Soundsystem', 'Led Zeppelin', 'Leonard Cohen', 'Lenny Kravitz',
      'Lewis Capaldi', 'Liam Gallagher', 'Lil Nas X', 'Lil Wayne', 'Limp Bizkit', 'Linkin Park',
      'Lionel Richie', 'Lizzo', 'Lorde', 'Lou Reed', 'Louis Armstrong', 'Lute', 'Lynyrd Skynyrd',
      'Mac DeMarco', 'Mac Miller', 'Macklemore', 'Madness', 'Madonna', 'Mandolin', 'Manic Street Preachers',
      'Maracas', 'Mariah Carey', 'Marilyn Manson', 'Marimba', 'Maroon 5', 'Marshmello', 'Marvin Gaye',
      'Massive Attack', 'Mastodon', 'Meat Loaf', 'Megadeth', 'Melody', 'Metallica', 'Metronome',
      'MF DOOM', 'MGMT', 'Michael Buble', 'Michael Jackson', 'Mick Jagger', 'Miley Cyrus',
      'Miles Davis', 'Misfits', 'Missy Elliott', 'Mitski', 'Moby', 'Modest Mouse', 'Motley Crue',
      'Motorhead', 'Motown', 'Mozart', 'Mumford and Sons', 'Muse', 'My Bloody Valentine',
      'My Chemical Romance', 'Nas', 'Nat King Cole', 'Neil Diamond', 'Neil Young', 'Nelly',
      'New Order', 'New Wave', 'Ne-Yo', 'Nick Cave', 'Nicki Minaj', 'Nickelback', 'Nina Simone',
      'Nine Inch Nails', 'Nirvana', 'No Doubt', 'Noel Gallagher', 'Norah Jones', 'Notorious BIG',
      'NSYNC', 'Oasis', 'Oboe', 'Ocarina', 'Offspring', 'Olivia Rodrigo', 'One Direction',
      'OneRepublic', 'Opera', 'Orchestra', 'Organ', 'Otis Redding', 'OutKast', 'Ozzy Osbourne',
      'Paganini', 'Pan Flute', 'Panic at the Disco', 'Pantera', 'Papa Roach', 'Paramore',
      'Patti Smith', 'Paul McCartney', 'Paul Simon', 'Pavarotti', 'Pearl Jam', 'Percussion',
      'Pet Shop Boys', 'Peter Gabriel', 'Pharrell Williams', 'Phil Collins', 'Phoenix', 'Piano',
      'Piccolo', 'Pink', 'Pink Floyd', 'Pixies', 'PJ Harvey', 'Placebo', 'Pluck', 'Police',
      'Polka', 'Polyphony', 'Pop', 'Portishead', 'Post Malone', 'Primal Scream', 'Prince',
      'Prodigy', 'Progressive Rock', 'Psy', 'Psychedelic Rock', 'Public Enemy', 'Pulp', 'Punk Rock',
      'Pussycat Dolls', 'Queen', 'Queens of the Stone Age', 'Quincy Jones', 'R&B', 'Rachmaninoff',
      'Radiohead', 'Rage Against the Machine', 'Ragtime', 'Rammstein', 'Ramones', 'Rap', 'Ravel',
      'Ray Charles', 'Recorder', 'Red Hot Chili Peppers', 'Reggae', 'Reggaeton', 'REM', 'Rhythm',
      'Rihanna', 'Ringo Starr', 'Robbie Williams', 'Robert Johnson', 'Robert Plant', 'Rock',
      'Rockabilly', 'Rod Stewart', 'Rolling Stones', 'Rosalia', 'Roxette', 'Roxy Music', 'Roy Orbison',
      'Run-DMC', 'Rush', 'Sade', 'Salsa', 'Sam Cooke', 'Sam Smith', 'Samba', 'Santana', 'Saxophone',
      'Scissor Sisters', 'Scorpions', 'Scratching', 'Seal', 'Sean Paul', 'Selena', 'Selena Gomez',
      'Sepultura', 'Serge Gainsbourg', 'Sex Pistols', 'Shakira', 'Shamisen', 'Shawn Mendes',
      'Sheryl Crow', 'ShoeGaze', 'Sia', 'Sigur Ros', 'Simon and Garfunkel', 'Simple Minds',
      'Simply Red', 'Sinatra', 'Siouxsie and the Banshees', 'Sitar', 'Ska', 'Skrillex', 'Slayer',
      'Slipknot', 'Sly and the Family Stone', 'Smashing Pumpkins', 'Smiths', 'Snoop Dogg',
      'Snare Drum', 'Snow Patrol', 'Solange', 'Sonata', 'Sonic Youth', 'Soprano', 'Soul',
      'Soundgarden', 'Spice Girls', 'St Vincent', 'Status Quo', 'Steely Dan', 'Steppenwolf',
      'Stereophonics', 'Steve Miller Band', 'Stevie Nicks', 'Stevie Wonder', 'Sting', 'Stone Roses',
      'Stone Temple Pilots', 'Stravinsky', 'Strokes', 'Sublime', 'Sede', 'Sufjan Stevens',
      'Sugababes', 'Sum 41', 'Supertramp', 'Supremes', 'Surf Rock', 'Suede', 'Swing', 'Symphony',
      'Synthesizer', 'System of a Down', 'SZA', 'T-Pain', 'T-Rex', 'Take That', 'Talking Heads',
      'Tambourine', 'Tame Impala', 'Tango', 'Taylor Swift', 'Tchaikovsky', 'Tears for Fears',
      'Techno', 'Tempo', 'Temptations', 'Tenor', 'The 1975', 'The Clash', 'The Cure', 'The Doors',
      'The Killers', 'The Kinks', 'The National', 'The Police', 'The Smiths', 'The Strokes',
      'The Verve', 'The Weeknd', 'The White Stripes', 'The Who', 'The xx', 'Thin Lizzy', 'Thom Yorke',
      'Three Days Grace', 'Tiesto', 'Timbaland', 'Timbales', 'Timpani', 'Tina Turner', 'TLC',
      'Tom Petty', 'Tom Waits', 'Toni Braxton', 'Tool', 'Tori Amos', 'Toto', 'Tracy Chapman',
      'Trance', 'Travis', 'Travis Scott', 'Triangle', 'Tribe Called Quest', 'Trip Hop', 'Trombone',
      'Trumpet', 'Tuba', 'Tupac Shakur', 'Twenty One Pilots', 'Tyler the Creator', 'U2', 'UB40',
      'Ukulele', 'Underworld', 'Usher', 'Vampire Weekend', 'Van Halen', 'Van Morrison', 'Vangelis',
      'Velvet Underground', 'Verve', 'Vibraphone', 'Viola', 'Violin', 'Vivaldi', 'Vocaloid',
      'Wagner', 'Warpaint', 'Weezer', 'Wham', 'White Stripes', 'Whitney Houston', 'Wilco',
      'Willie Nelson', 'Wiz Khalifa', 'Wolf Alice', 'Wolfgang Amadeus Mozart', 'Wu-Tang Clan',
      'Xylophone', 'Yardbirds', 'Yeah Yeah Yeahs', 'Yes', 'Yo-Yo Ma', 'Zayn', 'Zedd', 'Zither',
      'ZZ Top',
    ],
  },
  movies: {
    id: 'movies',
    label: 'Movies & Cinema',
    group: 'Movies',
    items: [
      '12 Angry Men', '1917', '2001 A Space Odyssey', 'A Beautiful Mind', 'A Clockwork Orange',
      'A Quiet Place', 'Aladdin', 'Alien', 'Aliens', 'Amadeus', 'Amelie', 'American Beauty',
      'American History X', 'American Psycho', 'Anchorman', 'Arrival', 'Apocalypse Now', 'Aquaman',
      'Argo', 'Avatar', 'Avengers', 'Back to the Future', 'Bad Boys', 'Bambi', 'Barbie', 'Batman',
      'Beetlejuice', 'Ben-Hur', 'Big Fish', 'Birdman', 'Black Panther', 'Black Swan', 'Blade',
      'Blade Runner', 'Braveheart', 'Breakfast Club', 'Brokeback Mountain', 'Casablanca', 'Casino',
      'Casino Royale', 'Cast Away', 'Catch Me If You Can', 'Cars', 'Chinatown', 'Cinderella',
      'Citizen Kane', 'City of God', 'Clueless', 'Coco', 'Collateral', 'Con Air', 'Conjuring',
      'Constantine', 'Contagion', 'Coraline', 'Creed', 'Crimson Tide', 'Crouching Tiger Hidden Dragon',
      'Cruella', 'Dallas Buyers Club', 'Dances with Wolves', 'Dark Knight', 'Dawn of the Dead',
      'Dead Poets Society', 'Deadpool', 'Deliverance', 'Departed', 'Despicable Me', 'Die Hard',
      'District 9', 'Django Unchained', 'Doctor Strange', 'Dog Day Afternoon', 'Donnie Darko',
      'Dracula', 'Drive', 'Dumbo', 'Dune', 'Dunkirk', 'E.T.', 'Edge of Tomorrow', 'Edward Scissorhands',
      'Elf', 'Encanto', 'Eternal Sunshine', 'Ex Machina', 'Exorcist', 'Fantasia', 'Fargo',
      'Fast and Furious', 'Ferris Buellers Day Off', 'Fight Club', 'Finding Nemo', 'First Man',
      'Ford v Ferrari', 'Forrest Gump', 'Frankenstein', 'Free Guy', 'Friday the 13th', 'Frozen',
      'Full Metal Jacket', 'Fury', 'Fury Road', 'Gandhi', 'Gangs of New York', 'Gattaca',
      'Get Out', 'Ghost', 'Ghostbusters', 'Gladiator', 'Godfather', 'Godzilla', 'Goldfinger',
      'Gone Girl', 'Gone with the Wind', 'Good Will Hunting', 'Goodfellas', 'Gran Torino', 'Gravity',
      'Grease', 'Green Book', 'Green Mile', 'Gremlins', 'Groundhog Day', 'Guardians of the Galaxy',
      'Hacksaw Ridge', 'Halloween', 'Hamilton', 'Hangover', 'Hannibal', 'Harry Potter', 'Heat',
      'Hellboy', 'Her', 'Hercules', 'Hereditary', 'Highlander', 'Hitchcock', 'Home Alone', 'Hook',
      'Hot Fuzz', 'Hotel Rwanda', 'How to Train Your Dragon', 'Hunger Games', 'Hugo', 'I Am Legend',
      'Ice Age', 'Incredibles', 'Inception', 'Independence Day', 'Indiana Jones', 'Inglourious Basterds',
      'Inside Out', 'Interstellar', 'Into the Wild', 'Iron Giant', 'Iron Man', 'It', 'Jaws',
      'John Wick', 'Jojo Rabbit', 'Joker', 'Jumanji', 'Juno', 'Jurassic Park', 'Karate Kid',
      'Kill Bill', 'King Kong', 'Kingsman', 'Knives Out', 'Kong Skull Island', 'Kung Fu Panda',
      'L.A. Confidential', 'La La Land', 'Labyrinth', 'Lady Bird', 'Lawrence of Arabia', 'Leon',
      'Lethal Weapon', 'Life of Pi', 'Lilo and Stitch', 'Lincoln', 'Lion King', 'Little Mermaid',
      'Little Miss Sunshine', 'Little Women', 'Logan', 'Looper', 'Lord of the Rings', 'Lost in Translation',
      'Luca', 'Lucy', 'Mad Max', 'Madagascar', 'Maleficent', 'Mamma Mia', 'Man of Steel',
      'Manchester by the Sea', 'Marriage Story', 'Martian', 'Mary Poppins', 'Mask', 'Matrix',
      'Mean Girls', 'Megamind', 'Memento', 'Men in Black', 'Metropolis', 'Midsommar', 'Million Dollar Baby',
      'Minions', 'Minority Report', 'Misery', 'Mission Impossible', 'Moana', 'Moneyball',
      'Monsters Inc', 'Monty Python', 'Moonlight', 'Moulin Rouge', 'Mulan', 'Mummy', 'My Neighbor Totoro',
      'Mystic River', 'Narnia', 'National Treasure', 'Network', 'Nightcrawler', 'Nightmare Before Christmas',
      'No Country for Old Men', 'Nope', 'North by Northwest', 'Notebook', 'Notting Hill', 'Oblivion',
      'Oceans Eleven', 'Oldboy', 'Once Upon a Time in Hollywood', 'Oppenheimer', 'Paddington',
      'Pans Labyrinth', 'Parasite', 'Passengers', 'Patton', 'Pearl Harbor', 'Peter Pan', 'Phantom Thread',
      'Pianist', 'Pinocchio', 'Pirates of the Caribbean', 'Pitch Perfect', 'Planet of the Apes',
      'Platoon', 'Pocahontas', 'Predator', 'Prestige', 'Pretty Woman', 'Princess Bride', 'Prisoners',
      'Prometheus', 'Psycho', 'Pulp Fiction', 'Quiet Place', 'Raging Bull', 'Raiders of the Lost Ark',
      'Rain Man', 'Rambo', 'Rango', 'Ratatouille', 'Ready Player One', 'Rear Window', 'Rebecca',
      'Rebel Without a Cause', 'Red Dragon', 'Requiem for a Dream', 'Reservoir Dogs', 'Revenant',
      'Ring', 'Rio', 'Robocop', 'Robin Hood', 'Rocketman', 'Rocky', 'Rogue One', 'Roma',
      'Roman Holiday', 'Romeo and Juliet', 'Room', 'Rosemarys Baby', 'Rush', 'Rush Hour',
      'Saving Private Ryan', 'Saw', 'Scarface', 'Schindlers List', 'Scooby-Doo', 'Scott Pilgrim',
      'Scream', 'Selma', 'Seven', 'Seven Samurai', 'Seventh Seal', 'Shaun of the Dead',
      'Shawshank Redemption', 'Sherlock Holmes', 'Shining', 'Shrek', 'Shutter Island', 'Sicario',
      'Signs', 'Silence of the Lambs', 'Singin in the Rain', 'Sinister', 'Sixth Sense', 'Skyfall',
      'Slumdog Millionaire', 'Snatch', 'Snow White', 'Social Network', 'Solaris', 'Some Like It Hot',
      'Sonic', 'Soul', 'Sound of Music', 'South Park', 'Spartacus', 'Speed', 'Spider-Man',
      'Spirited Away', 'Split', 'Spotlight', 'Stand by Me', 'Star Trek', 'Star Wars', 'Stargate',
      'Starship Troopers', 'Step Brothers', 'Stranger Things', 'Suicide Squad', 'Sunset Boulevard',
      'Superbad', 'Superman', 'Suspiria', 'Sweeney Todd', 'Taken', 'Tangled', 'Tarzan', 'Taxi Driver',
      'Ted', 'Tenet', 'Terminator', 'Texas Chainsaw Massacre', 'The Abyss', 'The Artist',
      'The Avengers', 'The Batman', 'The Big Lebowski', 'The Birds', 'The Bourne Identity',
      'The Conjuring', 'The Crow', 'The Dark Knight', 'The Departed', 'The Exorcist', 'The Fifth Element',
      'The Fly', 'The Godfather', 'The Goonies', 'The Grand Budapest Hotel', 'The Great Escape',
      'The Great Gatsby', 'The Green Mile', 'The Hangover', 'The Hobbit', 'The Hunger Games',
      'The Hurt Locker', 'The Incredibles', 'The Irishman', 'The Iron Giant', 'The Lion King',
      'The Little Mermaid', 'The Lord of the Rings', 'The Martian', 'The Matrix', 'The Mummy',
      'The Notebook', 'The Omen', 'The Pianist', 'The Prestige', 'The Princess Bride', 'The Revenant',
      'The Ring', 'The Rock', 'The Room', 'The Shawshank Redemption', 'The Shining', 'The Sixth Sense',
      'The Social Network', 'The Sound of Music', 'The Terminator', 'The Thing', 'The Truman Show',
      'The Usual Suspects', 'The Whale', 'The Witch', 'The Wizard of Oz', 'The Wolf of Wall Street',
      'There Will Be Blood', 'Thor', 'Three Billboards', 'Titanic', 'Tombstone', 'Top Gun',
      'Total Recall', 'Toy Story', 'Trainspotting', 'Transformers', 'Treasure Planet', 'Tron',
      'Tropic Thunder', 'True Grit', 'True Lies', 'Truman Show', 'Twilight', 'Twister', 'Uncut Gems',
      'Unforgiven', 'Up', 'Us', 'Usual Suspects', 'V for Vendetta', 'Van Helsing', 'Venom',
      'Vertigo', 'WALL-E', 'Walk the Line', 'War of the Worlds', 'Warrior', 'Watchmen', 'Waterworld',
      'Wayne World', 'West Side Story', 'Whiplash', 'Who Framed Roger Rabbit', 'Wicked',
      'Wild Strawberries', 'Willow', 'Willy Wonka', 'Wind River', 'Wizard of Oz', 'Wolf of Wall Street',
      'Wolverine', 'Wonder Woman', 'Wonka', 'World War Z', 'Wreck-It Ralph', 'X-Men', 'Yesterday',
      'Zodiac', 'Zombieland', 'Zoolander', 'Zootopia',
    ],
  },
});

/**
 * Build the complete map of categories, combining static categories with
 * dynamic datasets from Geography (countries, capitals) and People (actors, musicians, athletes, all people).
 */
export function buildWordRushCategories({ countries = [], people = [] } = {}) {
  const categories = {};

  for (const [id, def] of Object.entries(STATIC_CATEGORIES)) {
    categories[id] = {
      id,
      label: def.label,
      group: def.group,
      items: def.items.map((label) => ({ label, alternatives: [] })),
    };
  }

  if (countries.length > 0) {
    categories.countries = {
      id: 'countries',
      label: 'Countries of the World',
      group: 'Geography',
      items: countries.map((c) => ({
        label: c.name,
        alternatives: c.alternatives ?? [],
      })),
    };
    categories.capitals = {
      id: 'capitals',
      label: 'World Capitals',
      group: 'Geography',
      items: countries.map((c) => ({
        label: c.capital,
        alternatives: [],
      })),
    };
  }

  if (people.length > 0) {
    const actors = people.filter((p) => p.category === 'film');
    const musicians = people.filter((p) => p.category === 'music');
    const athletes = people.filter((p) => p.category === 'sport');

    if (actors.length >= 20) {
      categories.actors = {
        id: 'actors',
        label: 'Actors & Filmmakers',
        group: 'Movies',
        items: actors.map((p) => ({ label: p.name, alternatives: p.alternatives ?? [] })),
      };
    }
    if (musicians.length >= 20) {
      categories.musicians = {
        id: 'musicians',
        label: 'Musicians & Singers',
        group: 'Music',
        items: musicians.map((p) => ({ label: p.name, alternatives: p.alternatives ?? [] })),
      };
    }
    if (athletes.length >= 20) {
      categories.athletes = {
        id: 'athletes',
        label: 'Famous Athletes',
        group: 'Sport',
        items: athletes.map((p) => ({ label: p.name, alternatives: p.alternatives ?? [] })),
      };
    }
  }

  return categories;
}

/**
 * Filter a category's items to those starting with `letter` (case/diacritic insensitive).
 * Also checks whether a surname or alternative starts with that letter when appropriate,
 * but canonical display is grouped cleanly by first letter of the label or alternative.
 */
export function wordsForCategoryAndLetter(category, letter) {
  const target = normaliseText(letter).charAt(0);
  if (!target || !category?.items) return [];

  const matched = [];
  const seen = new Set();

  for (const entry of category.items) {
    const label = typeof entry === 'string' ? entry : entry.label;
    const norm = normaliseText(label);
    if (!norm) continue;
    const alts = typeof entry === 'object' && Array.isArray(entry.alternatives) ? entry.alternatives : [];
    const startsPrimary = norm.charAt(0) === target;
    const startsAlt = alts.some((a) => normaliseText(a).charAt(0) === target);

    if ((startsPrimary || startsAlt) && !seen.has(norm)) {
      seen.add(norm);
      matched.push({
        label,
        alternatives: alts,
      });
    }
  }

  return matched.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Compute all valid letters for a category that have at least `minWords` possible answers.
 * Ensures impossible combinations (e.g. Food + X) are never selected.
 */
export function validLettersForCategory(category, minWords = MIN_WORDS_FOR_LETTER) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const valid = [];

  for (const letter of alphabet) {
    const words = wordsForCategoryAndLetter(category, letter);
    if (words.length >= minWords) {
      valid.push({ letter, words });
    }
  }

  // Fallback if a small custom category has < minWords for every letter
  if (valid.length === 0) {
    for (const letter of alphabet) {
      const words = wordsForCategoryAndLetter(category, letter);
      if (words.length > 0) valid.push({ letter, words });
    }
  }

  return valid;
}

/**
 * Deterministically pick the daily challenge (category + valid starting letter)
 * for a given date and variantKey.
 *
 * When variantKey is 'daily' (the shared daily challenge), the RNG picks both the
 * category and the starting letter from the date seed so every user gets the exact
 * same category and letter on that day.
 */
export function resolveWordRushChallenge(categoriesMap, { puzzleDate, variantKey = 'daily', practice = false, filters = null }) {
  const rng = createRng(practice ? practiceSeed() : seedFor('word-rush', variantKey, puzzleDate));
  const categoryIds = Object.keys(categoriesMap);

  let chosenCategoryId = variantKey;
  if (practice && filters?.category && categoriesMap[filters.category]) {
    chosenCategoryId = filters.category;
  } else if (variantKey === 'daily' || !categoriesMap[chosenCategoryId]) {
    chosenCategoryId = rng.pick(categoryIds);
  }

  const category = categoriesMap[chosenCategoryId];
  const validLetters = validLettersForCategory(category);
  const picked = rng.pick(validLetters);

  return {
    categoryId: category.id,
    categoryLabel: category.label,
    categoryGroup: category.group,
    letter: picked.letter,
    validWords: picked.words,
    allCategoryWords: category.items,
  };
}

export function createWordRushTrainer({ countries = [], people = [] } = {}) {
  const categoriesMap = buildWordRushCategories({ countries, people });
  const categoryKeys = Object.keys(categoriesMap);
  const variantLabels = {
    daily: 'Daily Challenge (Shared)',
    ...Object.fromEntries(categoryKeys.map((k) => [k, categoriesMap[k].label])),
  };

  return {
    id: 'word-rush',
    categoryId: 'word-rush',
    name: 'Word Rush',
    description:
      '2 minutes to name as many words as possible in today’s category starting with today’s letter. Every possible answer is revealed when time runs out!',
    roundMode: 'timed',
    variantKind: 'pool',
    variants: ['daily', ...categoryKeys],
    variantLabels,
    scoreDirection: 'higher',
    headlineScore: 'correct',
    renderer: 'word-rush',
    scoreLabel: 'Words found',
    modeParam: WORD_RUSH_DURATION_SECONDS,
    topics: categoryKeys.map((id) => ({ id, label: categoriesMap[id].label })),

    practiceFilters: {
      category: {
        label: 'Category',
        kind: 'single',
        options: categoryKeys.map((id) => ({ id, label: categoriesMap[id].label })),
        default: categoryKeys[0],
      },
    },

    /** Expose challenge inspection for briefing & leaderboards. */
    getChallenge(puzzleDate, variantKey = 'daily') {
      return resolveWordRushChallenge(categoriesMap, { puzzleDate, variantKey, practice: false });
    },

    createGenerator({ puzzleDate, variantKey, practice = false, filters = null }) {
      const challenge = resolveWordRushChallenge(categoriesMap, {
        puzzleDate,
        variantKey,
        practice,
        filters,
      });
      const foundWords = [];
      const foundNorm = new Set();

      return {
        next(context) {
          // Record the word that was just submitted if it was correct
          if (context?.lastCorrect && context?.lastSubmission) {
            const subNorm = normaliseText(context.lastSubmission);
            const matchedEntry = challenge.validWords.find((entry) => {
              const forms = [entry.label, ...(entry.alternatives ?? [])].map(normaliseText);
              return forms.includes(subNorm);
            });
            if (matchedEntry && !foundNorm.has(normaliseText(matchedEntry.label))) {
              foundNorm.add(normaliseText(matchedEntry.label));
              foundWords.push(matchedEntry.label);
            }
          }

          // If the player found every single valid word before the 2 minutes are up, end the round!
          if (foundWords.length >= challenge.validWords.length) {
            return null;
          }

          return {
            kind: 'word-rush',
            key: `word-rush:${challenge.categoryId}:${challenge.letter}:${foundWords.length}`,
            topicId: challenge.categoryId,
            topicLabel: challenge.categoryLabel,
            categoryGroup: challenge.categoryGroup,
            question: `${challenge.categoryLabel} starting with "${challenge.letter}"`,
            letter: challenge.letter,
            answer: challenge.validWords[0]?.label ?? '',
            validWords: challenge.validWords,
            foundWords: [...foundWords],
            totalPossible: challenge.validWords.length,
          };
        },
      };
    },
  };
}
