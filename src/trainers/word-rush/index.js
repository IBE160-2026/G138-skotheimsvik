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
import { normaliseText, compactKey, matchWordRushEntry } from '../../core/answer.js';

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
      'Acrobatic Gymnastics', 'Aerobics', 'Aikido', 'Air Racing', 'Alpine Skiing', 'American Football',
      'Aquathlon', 'Archery', 'Arm Wrestling', 'Artistic Gymnastics', 'Artistic Swimming', 'Association Football',
      'Athletics', 'Australian Rules Football', 'Auto Racing', 'Autocross', 'Axe Throwing', 'Badminton',
      'Bandy', 'Barrel Racing', 'BASE Jumping', 'Baseball', 'Basketball', 'Basque Pelota', 'Beach Handball',
      'Beach Soccer', 'Beach Tennis', 'Beach Volleyball', 'Biathlon', 'Bicycle Motocross', 'Billiards',
      'BMX', 'BMX Racing', 'Bobsled', 'Bobsleigh', 'Bocce', 'Boccia', 'Bodybuilding', 'Bossaball',
      'Bouldering', 'Boules', 'Bowling', 'Bowls', 'Box Lacrosse', 'Boxing', 'Brazilian Jiu-Jitsu',
      'Breakdancing', 'Breaking', 'Broomball', 'Bungee Jumping', 'Cabers', 'Calisthenics', 'Camogie',
      'Canoe Polo', 'Canoe Slalom', 'Canoe Sprint', 'Canoeing', 'Capoeira', 'Caving', 'Chariot Racing',
      'Cheerleading', 'Chess', 'Clay Pigeon Shooting', 'Cliff Diving', 'Climbing', 'Coaching',
      'College Football', 'Combat Sambo', 'Competitive Eating', 'Competitive Swimming', 'Cornhole',
      'Court Tennis', 'Cricket', 'Croquet', 'Cross Country', 'Cross-Country Running', 'Cross-Country Skiing',
      'CrossFit', 'Cue Sports', 'Curling', 'Cycle Polo', 'Cycle Speedway', 'Cycling', 'Cyclo-Cross',
      'Dancesport', 'Darts', 'Decathlon', 'Demolition Derby', 'Disc Golf', 'Discus', 'Discus Throw',
      'Diving', 'Dodgeball', 'Dog Sledding', 'Downhill Skiing', 'Drag Racing', 'Dragon Boat Racing',
      'Dressage', 'Drifting', 'Duathlon', 'Eight-Ball', 'Endurance Racing', 'Enduro', 'Equestrian',
      'Equestrianism', 'Esports', 'Extreme Sports', 'Falconry', 'Fencing', 'Field Archery', 'Field Hockey',
      'Figure Skating', 'Finswimming', 'Fishing', 'Fistball', 'Five-a-Side Football', 'Flag Football',
      'Floorball', 'Flora Marathon', 'Fly Fishing', 'Flying Disc', 'Foil Fencing', 'Footbag', 'Football',
      'Footgolf', 'Formula E', 'Formula One', 'Four Square', 'Free Diving', 'Freediving', 'Freerunning',
      'Freestyle BMX', 'Freestyle Motocross', 'Freestyle Skiing', 'Freestyle Swimming', 'Freestyle Wrestling',
      'Frisbee', 'Full Contact Karate', 'Futsal', 'Gaelic Football', 'Gaelic Handball', 'Gateball',
      'Giant Slalom', 'Gliding', 'Goalball', 'Go-Karting', 'Golf', 'Greco-Roman Wrestling', 'Greyhound Racing',
      'Gridiron', 'Gymkhana', 'Gymnastics', 'Hammer Throw', 'Handball', 'Hang Gliding', 'Hapkido',
      'Harness Racing', 'Harrier', 'Heptathlon', 'High Diving', 'High Jump', 'Highland Games', 'Hiking',
      'Hill Climbing', 'Hockey', 'Horse Polo', 'Horse Racing', 'Horseback Riding', 'Horseshoes',
      'Hot Air Ballooning', 'Hurdles', 'Hurdling', 'Hurling', 'Ice Climbing', 'Ice Dancing', 'Ice Fishing',
      'Ice Hockey', 'Ice Racing', 'Ice Skating', 'Ice Cross Downhill', 'Ice Yachting', 'Indoor Cricket',
      'Indoor Football', 'Indoor Hockey', 'Indoor Rowing', 'Indoor Soccer', 'Indoor Volleyball',
      'Inline Hockey', 'Inline Skating', 'Ironman Triathlon', 'Jai Alai', 'Javelin', 'Javelin Throw',
      'Jet Skiing', 'Jiu-Jitsu', 'Jockey', 'Jogging', 'Jousting', 'Judo', 'Jujutsu', 'Jumping',
      'Kabaddi', 'Karate', 'Kart Racing', 'Karting', 'Kayaking', 'Kendo', 'Kenpo', 'Kettlebell Lifting',
      'Kickball', 'Kickboxing', 'Kiteboarding', 'Kitesurfing', 'Kneeboarding', 'Korfball', 'Krav Maga',
      'Kronum', 'Kung Fu', 'Kyudo', 'Lacrosse', 'Land Sailing', 'Land Windsurfing', 'Laser Run',
      'Lawn Bowls', 'Lawn Tennis', 'Lead Climbing', 'Lethwei', 'Lifesaving', 'Little League',
      'Long Distance Running', 'Long Jump', 'Longboarding', 'Luge', 'Lumberjack Sports', 'Marathon',
      'Marathon Swimming', 'Martial Arts', 'Middle Distance Running', 'Miniature Golf', 'Mixed Martial Arts',
      'MMA', 'Modern Pentathlon', 'Mogul Skiing', 'Monster Truck', 'Motoball', 'Motocross', 'Motor Racing',
      'Motorcycle Racing', 'Mountain Biking', 'Mountaineering', 'Muay Thai', 'Mud Bogging', 'NASCAR',
      'Netball', 'Nine-Ball', 'Nordic Combined', 'Nordic Walking', 'Obstacle Course Racing', 'Ocean Rowing',
      'Off-Road Racing', 'Olympic Weightlifting', 'Open Water Swimming', 'Orienteering', 'Outrigger Canoeing',
      'Paddle Boarding', 'Paddle Tennis', 'Paddleboarding', 'Padel', 'Paintball', 'Parachuting',
      'Paragliding', 'Paralympic Athletics', 'Paramotoring', 'Parasailing', 'Parkour', 'Pelota',
      'Pencak Silat', 'Pentathlon', 'Pesapallo', 'Petanque', 'Pickleball', 'Pilates', 'Ping Pong',
      'Platform Diving', 'Platform Tennis', 'Pocket Billiards', 'Pole Climbing', 'Pole Dance', 'Pole Vault',
      'Polo', 'Polocrosse', 'Pool', 'Powerboating', 'Powerlifting', 'Pro Wrestling', 'Pugilism',
      'Quidditch', 'Quadball', 'Race Walking', 'Racewalking', 'Racketlon', 'Racquetball', 'Rafting',
      'Rally Raid', 'Rallycross', 'Rallying', 'Rappelling', 'Real Tennis', 'Relay Race', 'Rhythmic Gymnastics',
      'Ringette', 'Rink Bandy', 'Rink Hockey', 'Road Cycling', 'Road Racing', 'Rock Climbing', 'Rodeo',
      'Ninjutsu', 'Roller Derby', 'Roller Hockey', 'Roller Skating', 'Rope Skipping', 'Rounders', 'Rowing',
      'Rugby', 'Rugby League', 'Rugby Sevens', 'Rugby Union', 'Running', 'Sabre Fencing', 'Sailing',
      'Sambo', 'Sandboarding', 'Savate', 'Schwingen', 'Scootering', 'Scrambling', 'Scuba Diving',
      'Sculling', 'Sepak Takraw', 'Shinty', 'Shooting', 'Short Track Speed Skating', 'Shot Put',
      'Show Jumping', 'Shuffleboard', 'Shuttlecock', 'Skateboarding', 'Skating', 'Skeet Shooting',
      'Skeleton', 'Ski Cross', 'Ski Jumping', 'Ski Mountaineering', 'Ski Touring', 'Skiing', 'Skimboarding',
      'Skydiving', 'Skyrunning', 'Slacklining', 'Slalom', 'Slalom Canoeing', 'Slalom Skiing', 'Sled Dog Racing',
      'Sled Hockey', 'Slowpitch Softball', 'Snooker', 'Snorkeling', 'Snow Polo', 'Snow Rugby',
      'Snow Volleyball', 'Snowboarding', 'Snowkiting', 'Snowmobiling', 'Snowshoeing', 'Soccer', 'Soft Tennis',
      'Softball', 'Spearfishing', 'Speed Climbing', 'Speed Flying', 'Speed Skating', 'Speed Skiing',
      'Speedball', 'Speedway', 'Sport Climbing', 'Sport Fishing', 'Sprint', 'Sprint Canoe', 'Sprint Cycling',
      'Sprinting', 'Squash', 'Stand Up Paddleboarding', 'Steeplechase', 'Stickball', 'Stock Car Racing',
      'Street Hockey', 'Street Luge', 'Street Workout', 'Streetball', 'Strength Athletics', 'Strongman',
      'Subbuteo', 'Sumo', 'Sumo Wrestling', 'Super-G', 'Superbike Racing', 'Supercross', 'Surf Kayaking',
      'Surf Lifesaving', 'Surfing', 'Swimming', 'Sword Fighting', 'Synchronized Skating', 'Synchronized Swimming',
      'Table Football', 'Table Hockey', 'Table Tennis', 'Taekwondo', 'Tag Rugby', 'Tai Chi', 'Tchoukball',
      'Team Handball', 'Team Pursuit', 'Tee-Ball', 'Telemark Skiing', 'Ten-Pin Bowling', 'Tennis',
      'Teqball', 'Tetherball', 'Tae Bo', 'Thai Boxing', 'Three-Day Eventing', 'Three-Point Contest',
      'Throwing', 'Time Trial', 'Toboggan', 'Touch Football', 'Touch Rugby', 'Touring Car Racing',
      'Track and Field', 'Track Cycling', 'Trail Running', 'Trampolining', 'Trap Shooting', 'Trial Biking',
      'Triathlon', 'Triple Jump', 'Tug of War', 'Tumbling', 'Ultimate', 'Ultimate Frisbee', 'Ultramarathon',
      'Underwater Football', 'Underwater Hockey', 'Underwater Ice Hockey', 'Underwater Orienteering',
      'Underwater Photography', 'Underwater Rugby', 'Underwater Target Shooting', 'Unicycling',
      'Vaulting', 'Velodrome', 'Volleyball', 'Wakeboarding', 'Wakeskating', 'Wakesurfing', 'Walking',
      'Wallball', 'Water Aerobics', 'Water Basketball', 'Water Polo', 'Water Skiing', 'Water Volleyball',
      'Wave Skiing', 'Weight Throw', 'Weightlifting', 'Wheelchair Basketball', 'Wheelchair Fencing',
      'Wheelchair Rugby', 'Wheelchair Tennis', 'Whitewater Kayaking', 'Whitewater Rafting', 'Wife Carrying',
      'Windsurfing', 'Wing Chun', 'Wingsuit Flying', 'Winter Biathlon', 'Winter Swimming', 'Wiffle Ball',
      'Women Football', 'Woodchopping', 'Wrestling', 'Wushu', 'X Games', 'Xare', 'Xtreme Martial Arts',
      'Yacht Racing', 'Yachting', 'Yoga', 'Yukigassen', 'Ziplining', 'Zorbing', 'Zumba',
      // Also include iconic athletes in Sport & Athletics so typing an athlete like "Mike Tyson" in Sports works seamlessly!
      'Aaron Donald', 'Aaron Judge', 'Aaron Rodgers', 'Abebe Bikila', 'Ada Hegerberg', 'Adam Peaty',
      'Adesanya', 'Alberto Contador', 'Alberto Tomba', 'Alex Morgan', 'Alex Ovechkin', 'Alexander Karelin',
      'Alexander Ovechkin', 'Alexander Volkanovski', 'Alexander Zverev', 'Alexis Sanchez', 'Ali',
      'Allen Iverson', 'Allyson Felix', 'Alonso', 'Amanda Nunes', 'Anderson Silva', 'Andre Agassi',
      'Andrea Pirlo', 'Andres Iniesta', 'Andy Murray', 'Angel Di Maria', 'Anja Parson', 'Annika Sorenstam',
      'Anthony Davis', 'Anthony Joshua', 'Antoine Griezmann', 'Antonio Brown', 'AP McCoy', 'Ariarne Titmus',
      'Arjen Robben', 'Armand Duplantis', 'Arnold Palmer', 'Arnold Schwarzenegger', 'Arthur Ashe',
      'Aryna Sabalenka', 'Asafa Powell', 'Ash Barty', 'Ashton Eaton', 'Ayrton Senna', 'Babe Didrikson Zaharias',
      'Babe Ruth', 'badr Hari', 'Barry Bonds', 'Barry Sanders', 'Bartolo Colon', 'Bastian Schweinsteiger',
      'Beckham', 'Ben Hogan', 'Ben Johnson', 'Ben Roethlisberger', 'Venus Williams', 'Bernard Hopkins',
      'Bernhard Langer', 'Bethany Hamilton', 'Bill Russell', 'Billie Jean King', 'Billy Jean King',
      'Birgit Fischer', 'Bjorn Borg', 'Bjorn Daehlie', 'Blake Griffin', 'Bo Jackson', 'Bob Beamon',
      'Bob Cousy', 'Bob Gibson', 'Bobby Charlton', 'Bobby Fischer', 'Bobby Hull', 'Bobby Moore',
      'Bobby Orr', 'Bode Miller', 'Bolt', 'Boris Becker', 'Brad Marchand', 'Bradley Wiggins',
      'Breanna Stewart', 'Brett Favre', 'Brian Lara', 'Brian ODriscoll', 'Brock Lesnar', 'Bruce Jenner',
      'Bruce Lee', 'Bruno Soares', 'Bryce Harper', 'Buster Douglas', 'Caeleb Dressel', 'Caitlin Clark',
      'Cal Ripken Jr', 'Cam Newton', 'Cameron Smith', 'Canelo Alvarez', 'Carl Lewis', 'Carli Lloyd',
      'Carlos Alcaraz', 'Carlos Monzon', 'Carlos Sainz', 'Carlos Tevez', 'Carmelo Anthony',
      'Caroline Wozniacki', 'Casemiro', 'Cassius Clay', 'Caster Semenya', 'Cathy Freeman',
      'Cesar Cielo', 'Charles Barkley', 'Charles Leclerc', 'Charles Oliveira', 'Chris Evert',
      'Chris Froome', 'Chris Hoy', 'Chris Paul', 'Christian Coleman', 'Christian Pulisic',
      'Christine Sinclair', 'Christiano Ronaldo', 'Chuck Liddell', 'Clara Hughes', 'Claressa Shields',
      'Claude Makelele', 'Clayton Kershaw', 'Clint Dempsey', 'Clyde Drexler', 'Coby White', 'Coco Gauff',
      'Cody Rhodes', 'Cole Palmer', 'Collin Morikawa', 'Conor McGregor', 'Connor McDavid', 'Cooper Kupp',
      'Courtney Dauwalter', 'Cristiano Ronaldo', 'Cruyff', 'Cy Young', 'Daiki Hashimoto', 'Daley Thompson',
      'Damian Lillard', 'Dan Carter', 'Dan Marino', 'Danica Patrick', 'Daniel Cormier', 'Daniel Ricciardo',
      'Daniil Medvedev', 'Dario Franchitti', 'David Beckham', 'David Ortiz', 'David Robinson',
      'David Rudisha', 'David Villa', 'Dawn Fraser', 'Deion Sanders', 'Demetrious Johnson',
      'Dennis Bergkamp', 'Dennis Rodman', 'Deontay Wilder', 'Derek Jeter', 'Derrick Henry', 'Derrick Rose',
      'Devin Booker', 'Dick Fosbury', 'Didier Drogba', 'Diego Forlan', 'Diego Maradona', 'Dina Asher-Smith',
      'Dirk Nowitzki', 'Djokovic', 'Dominik Hasek', 'Dominique Dawes', 'Don Bradman', 'Donovan Bailey',
      'Draymond Green', 'Drew Brees', 'Dustin Johnson', 'Dustin Poirier', 'Dwyane Wade', 'Earvin Magic Johnson',
      'Eddy Merckx', 'Eden Hazard', 'Edinson Cavani', 'Edwin Moses', 'Eileen Gu', 'Elaine Thompson-Herah',
      'Elena Delle Donne', 'Eli Manning', 'Eliud Kipchoge', 'Ellyse Perry', 'Emil Zatopek', 'Emma McKeon',
      'Emma Raducanu', 'Emerson Fittipaldi', 'Emmitt Smith', 'Eric Cantona', 'Eric Heiden', 'Erling Haaland',
      'Eusebio', 'Evander Holyfield', 'Evgeni Plushenko', 'Fabian Cancellara', 'Fabio Cannavaro',
      'Faith Kipyegon', 'Federer', 'Fedor Emelianenko', 'Felix Neureuther', 'Femke Bol', 'Ferenc Puskas',
      'Fernando Alonso', 'Fernando Torres', 'Filippo Inzaghi', 'Florence Griffith-Joyner', 'Floyd Mayweather',
      'Floyd Patterson', 'Fran Tarkenton', 'Francesco Totti', 'Francis Ngannou', 'Franco Baresi',
      'Frank Lampard', 'Frankie Dettori', 'Franz Beckenbauer', 'Franz Klammer', 'Frazier', 'Fred Perry',
      'Fredrik Ljungberg', 'Fury', 'Gabi Garcia', 'Gabriel Batistuta', 'Gabriel Jesus', 'Gabriela Sabatini',
      'Gareth Bale', 'Garry Kasparov', 'Gary Lineker', 'Gary Player', 'Gavin Hastings', 'Gemma Spofforth',
      'Gene Sarazen', 'Gennady Golovkin', 'George Best', 'George Foreman', 'George Russell',
      'George Weah', 'Georges St-Pierre', 'Geraint Thomas', 'Gerd Muller', 'Giacomo Agostini',
      'Gianluigi Buffon', 'Giannis Antetokounmpo', 'Gigi Buffon', 'Gilberto Silva', 'Gino Bartali',
      'Gordie Howe', 'Gordon Banks', 'Greg LeMond', 'Greg Louganis', 'Greg Norman', 'Grete Waitz',
      'Gretzky', 'Gunnar Nordahl', 'Gustavo Kuerten', 'Haaland', 'Hakeem Olajuwon', 'Haile Gebrselassie',
      'Hamilton', 'Hank Aaron', 'Hans-Gunnar Liljenwall', 'Hanyu Yuzuru', 'Hardik Pandya', 'Harry Kane',
      'Hassan Yazdani', 'Hector Camacho', 'Heike Drechsler', 'Helen Wills', 'Helio Castroneves',
      'Henrik Harlaut', 'Henrik Kristoffersen', 'Henrik Larsson', 'Henrik Lundqvist', 'Henry Armstrong',
      'Henry Cejudo', 'Hermann Maier', 'Hicham El Guerrouj', 'Hideki Matsui', 'Hideki Matsuyama',
      'Hikaru Nakamura', 'Hilary Knight', 'Hines Ward', 'Hristo Stoichkov', 'Hulk Hogan', 'Ian Botham',
      'Ian Rush', 'Ian Thorpe', 'Ibrahimovic', 'Ichiro Suzuki', 'Iga Swiatek', 'Iker Casillas',
      'Ilia Malinin', 'Imran Khan', 'Ingemar Stenmark', 'Ingebrigtsen', 'Ingrid Kristiansen',
      'Irene Schouten', 'Isaiah Thomas', 'Isiah Thomas', 'Islam Makhachev', 'Israel Adesanya',
      'Ivan Lendl', 'Iverson', 'Jack Dempsey', 'Jack Johnson', 'Jack Nicklaus', 'Jackie Joyner-Kersee',
      'Jackie Robinson', 'Jackie Stewart', 'Jacob Ingebrigtsen', 'Jacques Anquetil', 'Jacques Kallis',
      'Jadon Sancho', 'Ja Morant', 'Jairzinho', 'Jake LaMotta', 'Jake Paul', 'Jakob Ingebrigtsen',
      'Jalen Brunson', 'Jalen Hurts', 'Jamal Murray', 'James Harden', 'James Hunt', 'James Rodriguez',
      'Jamie Vardy', 'Jan Frodeno', 'Jan Ullrich', 'Jan Zelezny', 'Jan-Ove Waldner', 'Jane Torvill',
      'Janet Evans', 'Janica Kostelic', 'Jannik Sinner', 'Jaromir Jagr', 'Jason Kelce', 'Jason Kidd',
      'Javier Sotomayor', 'Javier Zanetti', 'Jaylen Brown', 'Jean-Claude Killy', 'Jeff Gordon',
      'Jenson Button', 'Jerome Boateng', 'Jerry Rice', 'Jerry West', 'Jesse Owens', 'Jessica Ennis-Hill',
      'Jimmie Johnson', 'Jimmy Butler', 'Jimmy Connors', 'Jim Brown', 'Jim Clark', 'Jim Thorpe',
      'Joakim Noah', 'Joan Benoit', 'Joao Felix', 'Joaquin Niemann', 'Joe Burrow', 'Joe Calzaghe',
      'Joe DiMaggio', 'Joe Frazier', 'Joe Greene', 'Joe Louis', 'Joe Montana', 'Joe Namath',
      'Joe Root', 'Joel Embiid', 'Johan Cruyff', 'Johannes Hoesflot Klaebo', 'Johannes Thingnes Boe',
      'John Cena', 'John Elway', 'John Higgins', 'John Madden', 'John McEnroe', 'John Stockton',
      'John Surtees', 'John Terry', 'Johnny Bench', 'Johnny Unitas', 'Johnny Weissmuller', 'Jokic',
      'Jon Jones', 'Jon Rahm', 'Jonah Lomu', 'Jonas Vingegaard', 'Jonathan Edwards', 'Jonathan Toews',
      'Jordan', 'Jordan Larson', 'Jordan Love', 'Jordan Spieth', 'Jorge Lorenzo', 'Jose Aldo',
      'Jose Mourinho', 'Joseph Schooling', 'Josh Allen', 'Joshua Cheptegei', 'Juan Manuel Fangio',
      'Juan Martin del Potro', 'Juan Soto', 'Jude Bellingham', 'Julian Alaphilippe', 'julie Ertz',
      'Julio Cesar Chavez', 'Julius Erving', 'Junior Seau', 'Jurgen Klinsmann', 'Jurgen Klopp',
      'Justin Gaethje', 'Justin Gatlin', 'Justin Jefferson', 'Justin Rose', 'Justin Thomas',
      'Justine Henin', 'Jutta Leerdam', 'Kaka', 'Kamaru Usman', 'Kamila Valieva', 'Kapil Dev',
      'Kareem Abdul-Jabbar', 'Karim Benzema', 'Karl Malone', 'Karl-Anthony Towns', 'Karoline Bjerkeli Grovdal',
      'Karsten Warholm', 'Kasparov', 'Katarina Witt', 'Katie Ledecky', 'Katie Taylor', 'Kawhi Leonard',
      'Kayla Harrison', 'Kazuchika Okada', 'Keegan Bradley', 'Keisuke Honda', 'Kelly Holmes',
      'Kelly Slater', 'Kelvin Kiptum', 'Kemba Walker', 'Ken Griffey Jr', 'Ken Norton', 'Kenenisa Bekele',
      'Kenny Dalglish', 'Kenny Smith', 'Kerri Walsh Jennings', 'Kevin De Bruyne', 'Kevin Durant',
      'Kevin Garnett', 'Kevin Harvick', 'Kevin Mayer', 'Khabib', 'Khabib Nurmagomedov', 'Khamzat Chimaev',
      'Kim Clijsters', 'Kim Yuna', 'Kimi Raikkonen', 'King Kenny', 'Kipchoge', 'Kirani James',
      'Kjetil Andre Aamodt', 'Klaebo', 'Klay Thompson', 'Klitschko', 'Kobe', 'Kobe Bryant',
      'Kohei Uchimura', 'Koji Murofushi', 'Kostya Tszyu', 'Kris Bryant', 'Kristian Blummenfelt',
      'Kristof Milak', 'Kurt Angle', 'Kurt Busch', 'Kurt Warner', 'Kylian Mbappe', 'Kyrie Irving',
      'LaDainian Tomlinson', 'Lamar Jackson', 'Lamine Yamal', 'Lando Norris', 'Lance Armstrong',
      'Landon Donovan', 'Larry Bird', 'Larry Fitzgerald', 'Larry Holmes', 'Lasha Talakhadze',
      'Laura Kenny', 'Laure Manaudou', 'Laurent Blanc', 'Laurie Hernandez', 'Leander Paes',
      'LeBron', 'LeBron James', 'Lee Chong Wei', 'Lennox Lewis', 'Leo Messi', 'Leon Edwards',
      'Leon Marchand', 'Lev Yashin', 'Lewis Hamilton', 'Lidia Valentin', 'Lilian Thuram', 'Lin Dan',
      'Lindsey Vonn', 'Lionel Messi', 'Lisa Leslie', 'Lleyton Hewitt', 'Lochte', 'Logan Paul',
      'Lolo Jones', 'Lomachenko', 'Luka Doncic', 'Luka Modric', 'Luis Figo', 'Luis Suarez',
      'Luke Littler', 'Lyoto Machida', 'Ma Long', 'MacArthur', 'Mads Pedersen', 'Magdalena Neuner',
      'Magic Johnson', 'Magnus Carlsen', 'Mahendra Singh Dhoni', 'Maki Tsukada', 'Malik Nabers',
      'Manon Rheaume', 'Manuel Neuer', 'Manny Pacquiao', 'Manu Ginobili', 'Marc Gasol', 'Marc Marquez',
      'Marcel Hirscher', 'Marcel Jacobs', 'Marcelo', 'Marco Pantani', 'Marco van Basten',
      'Marcus Rashford', 'Margaret Court', 'Maria Sharapova', 'Mariano Rivera', 'Marie-Jose Perec',
      'Mario Andretti', 'Mario Kempes', 'Mario Lemieux', 'Marion Jones', 'Marit Bjorgen',
      'Mark Cavendish', 'Mark Messier', 'Mark Selby', 'Mark Spitz', 'Mark Webber', 'Marta',
      'Martin Brodeur', 'Martin Fourcade', 'Martin Odegaard', 'Martina Hingis', 'Martina Navratilova',
      'Martina Sablikova', 'Marvin Hagler', 'Mary Lou Retton', 'Masahiko Kimura', 'Mat Fraser',
      'Matej Mohoric', 'Mathew Barzal', 'Mathieu van der Poel', 'Mats Sundin', 'Mats Wilander',
      'Matt Biondi', 'Matt Fitzpatrick', 'Matthew Stafford', 'Maurice Greene', 'Maurice Richard',
      'Max Holloway', 'Max Scherzer', 'Max Verstappen', 'Mayweather', 'Mbappe', 'McGregor',
      'Megan Rapinoe', 'Mesut Ozil', 'Messi', 'Mia Hamm', 'Micah Parsons', 'Michael Ballack',
      'Michael Bisping', 'Michael Chang', 'Michael Clarke', 'Michael Gross', 'Michael Irvin',
      'Michael Johnson', 'Michael Jordan', 'Michael Owen', 'Michael Phelps', 'Michael Schumacher',
      'Michael Smith', 'Michael Spinks', 'Michael Strahan', 'Michael van Gerwen', 'Michael Vick',
      'Michel Platini', 'Michelle Kwan', 'Michelle Wie', 'Mick Doohan', 'Mickelson', 'Mika Hakkinen',
      'Mikaela Shiffrin', 'Mike Bossy', 'Mike Krzyzewski', 'Mike Piazza', 'Mike Powell', 'Mike Schmidt',
      'Mike Singletary', 'Mike Trout', 'Mike Tyson', 'Mikhail Tal', 'Mikkel Hansen', 'Milos Raonic',
      'Miltiadis Tentoglou', 'Mirko Cro Cop', 'Miroslav Klose', 'Missy Franklin', 'Misty May-Treanor',
      'Mitch Marner', 'Mo Farah', 'Mo Salah', 'Mohamed Farah', 'Mohamed Salah', 'Mohammad Amir',
      'Mondo Duplantis', 'Monica Seles', 'Mookie Betts', 'Morgan Hamm', 'Moses Malone', 'MS Dhoni',
      'Muhammad Ali', 'Muttiah Muralitharan', 'Mutaz Essa Barshim', 'Myles Garrett', 'Nadal',
      'Nadia Comaneci', 'Nafissatou Thiam', 'Naomi Osaka', 'Nasser Al-Attiyah', 'Nastia Liukin',
      'Natalie Coughlin', 'Nathan Chen', 'Nathan MacKinnon', 'Neeraj Chopra', 'Neil Robertson',
      'Nelly Korda', 'Nelson Piquet', 'Nemanja Vidic', 'Neymar', 'Nick Faldo', 'Nick Kyrgios',
      'Nicklas Lidstrom', 'Nico Rosberg', 'Nicola Adams', 'Nicolas Anelka', 'Nigel Mansell',
      'Niki Lauda', 'Nikita Kucherov', 'Nikola Jokic', 'Nikola Karabatic', 'Nils van der Poel',
      'Nino Schurter', 'Noah Lyles', 'Nolan Ryan', 'Nonito Donaire', 'Novak Djokovic', 'Nunes',
      'Nurmagomedov', 'Nyjah Huston', 'O.J. Simpson', 'Odell Beckham Jr', 'Oksana Chusovitina',
      'Ole Einar Bjorndalen', 'Ole Gunnar Solskjaer', 'Oleksandr Usyk', 'Olga Korbut', 'Oliver Kahn',
      'Olivier Giroud', 'Ohtani', 'Omar Sivori', 'Ondrej Nepela', 'Oscar De La Hoya', 'Oscar Piastri',
      'Oscar Robertson', 'Oscar Schmidt', 'Ovechkin', 'Owen Farrell', 'Paavo Nurmi', 'Pacquiao',
      'Paddy Pimblett', 'Paige Bueckers', 'Paolo Maldini', 'Paolo Rossi', 'Pascal Siakam',
      'Pat Rafter', 'Patrick Cantlay', 'Patrick Ewing', 'Patrick Kane', 'Patrick Mahomes',
      'Patrick Roy', 'Patrick Vieira', 'Pau Gasol', 'Paul Gascoigne', 'Paul George', 'Paul Hamm',
      'Paul Pogba', 'Paul Scholes', 'Paula Radcliffe', 'Payne Stewart', 'Pedro Martinez', 'Pele',
      'Penny Oleksiak', 'Pep Guardiola', 'Pernell Whitaker', 'Pernilla Wiberg', 'Pertti Karppinen',
      'Pete Maravich', 'Pete Rose', 'Pete Sampras', 'Peter Forsberg', 'Peter Great', 'Peter Sagan',
      'Peter Schmeichel', 'Peter Shilton', 'Peter Snell', 'Peter Wright', 'Petr Cech',
      'Petra Kvitova', 'Petra Vlhova', 'Petter Northug', 'Peyton Manning', 'Phelps', 'Phil Esposito',
      'Phil Foden', 'Phil Hellmuth', 'Phil Jackson', 'Phil Mickelson', 'Phil Taylor', 'Philip Lahm',
      'Philipp Lahm', 'Pierre Gasly', 'Pierre-Emerick Aubameyang', 'Pieter van den Hoogenband',
      'Pirlo', 'PK Subban', 'primoz Roglic', 'Puskas', 'Quinton Jackson', 'Rachael Blackmore',
      'Radamel Falcao', 'Rafael Leao', 'Rafael Nadal', 'raghib Ismail', 'Raheem Sterling',
      'Ralf Schumacher', 'Randy Johnson', 'Randy Moss', 'Randy Orton', 'Raul', 'Ray Allen',
      'Ray Bourque', 'Ray Leonard', 'Ray Lewis', 'Ray Robinson', 'Raymond van Barneveld',
      'Rebecca Adlington', 'Reggie Bush', 'Reggie Jackson', 'Reggie Miller', 'Reggie White',
      'Rebeca Andrade', 'Remco Evenepoel', 'Rene Higuita', 'Rene Lacoste', 'Rens Blom',
      'Rey Mysterio', 'Ric Flair', 'Ricardo Kaka', 'Rich Froning', 'Richard Petty', 'Richie McCaw',
      'Rickey Henderson', 'Ricky Hatton', 'Ricky Ponting', 'Riddick Bowe', 'Rivaldo', 'Rob Gronkowski',
      'Robbie Keane', 'Robert Kubica', 'Robert Lewandowski', 'Robert Parish', 'Roberto Baggio',
      'Roberto Carlos', 'Roberto Clemente', 'Roberto Duran', 'Robin van Persie', 'Robinson',
      'Rockne', 'Rocky Marciano', 'Rod Laver', 'Rodman', 'Rodri', 'Rodrigo De Paul', 'Roger Bannister',
      'Roger Clemens', 'Roger Federer', 'Roger Milla', 'Roger Staubach', 'Roman Reigns', 'Romario',
      'Romelu Lukaku', 'Ron Artest', 'Ronald Koeman', 'Ronaldinho', 'Ronaldo', 'Ronda Rousey',
      'Ronan O Gara', 'Ronnie Coleman', 'Ronnie O Sullivan', 'Rory McIlroy', 'Rose Namajunas',
      'Ross Chastain', 'Roy Emerson', 'Roy Jones Jr', 'Roy Keane', 'Ruud Gullit', 'Ruud van Nistelrooy',
      'Rui Hachimura', 'Russell Westbrook', 'Russell Wilson', 'Ruta Meilutyte', 'Ruth', 'Ryan Crouser',
      'Ryan Giggs', 'Ryan Lochte', 'Ryoyu Kobayashi', 'Sabrina Ionescu', 'Sachin Tendulkar',
      'Sadio Mane', 'Saquon Barkley', 'Sarah Sjostrom', 'Saul Canelo Alvarez', 'Scott Dixon',
      'Scott Hamilton', 'Scottie Pippen', 'Scottie Scheffler', 'Sean O Malley', 'Sebastian Coe',
      'Sebastian Vettel', 'Seve Ballesteros', 'Shane Lowry', 'Shane Mosley', 'Shane Warne',
      'Shannon Miller', 'Shai Gilgeous-Alexander', 'Shakur Stevenson', 'Shaquille O Neal',
      'Shaun Livingston', 'Shaun Pollock', 'Shaun White', 'Shawn Johnson', 'Shawn Michaels',
      'Shelly-Ann Fraser-Pryce', 'Shericka Jackson', 'Shiffrin', 'Shohei Ohtani', 'Shoaib Akhtar',
      'Sidney Crosby', 'Sifan Hassan', 'Simona Halep', 'Simone Biles', 'Simone Manuel', 'Sir Chris Hoy',
      'Sixten Jernberg', 'Sky Brown', 'Sloane Stephens', 'Smokin Joe Frazier', 'Sofia Goggia',
      'Son Heung-min', 'Sonny Liston', 'Sophie Devine', 'Sourav Ganguly', 'Stamkos', 'Stan Mikita',
      'Stan Smith', 'Stan Wawrinka', 'Stefan Edberg', 'Stefan Kraft', 'Stefanie Graf', 'Steffi Graf',
      'Steph Curry', 'Stephen Curry', 'Stephen Hendry', 'Sterling Moss', 'Steve Nash', 'Steve Ovett',
      'Steve Prefontaine', 'Steve Redgrave', 'Steve Smith', 'Steve Steve', 'Steve Waugh',
      'Steve Yzerman', 'Steven Gerrard', 'Steven Stamkos', 'Stewart', 'Stipe Miocic', 'Stirling Moss',
      'Stone Cold Steve Austin', 'Stuart Broad', 'Sue Bird', 'Sugar Ray Leonard', 'Sugar Ray Robinson',
      'Summer McIntosh', 'Sun Yang', 'Sunil Chhetri', 'Sunisa Lee', 'Surya Bonaly', 'Sven Kramer',
      'Sydney McLaughlin-Levrone', 'Sylvester Stallone', 'Tadej Pogacar', 'Tai Tzu-ying',
      'Takanori Nagase', 'Takuma Sato', 'Tamika Catchings', 'Tanni Grey-Thompson', 'Tara Lipinski',
      'Tarjei Boe', 'Tyson', 'Tyson Fury', 'Tyson Gay', 'Usain Bolt', 'Usyk', 'Valentino Rossi',
      'Valerie Adams', 'Valtteri Bottas', 'Van Basten', 'Van Dijk', 'Van Nistelrooy', 'Van Persie',
      'Vasyl Lomachenko', 'Verstappen', 'Vettel', 'Victor Axelsen', 'Victor Wembanyama',
      'Victoria Azarenka', 'Vijay Singh', 'Viktor Axelsen', 'Viktor Hovland', 'Vince Carter',
      'Vince Lombardi', 'Vincent Kompany', 'Vinicius Junior', 'Virat Kohli', 'Virgil van Dijk',
      'Vitali Klitschko', 'Vitor Belfort', 'Viv Richards', 'Vladimir Klitschko', 'Vladislav Tretiak',
      'Von Miller', 'Vonn', 'Wladimir Klitschko', 'Walter Payton', 'Wanderlei Silva', 'Warren Moon',
      'Wasim Akram', 'Wayde van Niekerk', 'Wayne Gretzky', 'Wayne Rooney', 'Webb Simpson',
      'Wembanyama', 'Wendy Holdener', 'Wes Unseld', 'Westbrook', 'White', 'Wilma Rudolph',
      'Willie Mays', 'Willie Shoemaker', 'Wilson Kipketer', 'Wilt Chamberlain', 'Wout van Aert',
      'Woods', 'Xander Schauffele', 'Xavi', 'Xavi Hernandez', 'Yao Ming', 'Yaroslava Mahuchikh',
      'Yasin', 'Yasuhiro Yamashita', 'Yelena Isinbayeva', 'Yohan Blake', 'Yogi Berra', 'Yordenis Ugas',
      'Yulimar Rojas', 'Yuna Kim', 'Yuto Horigome', 'Yuzuru Hanyu', 'Zach LaVine', 'Zack Wheeler',
      'Zara Tindall', 'Zdeno Chara', 'Zico', 'Zidane', 'Zinedine Zidane', 'Zion Williamson',
      'Zlatan', 'Zlatan Ibrahimovic', 'Zoe Sadowski-Synnott',
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
      'Acai', 'Adobo', 'Affogato', 'Aioli', 'Alfalfa', 'Alfredo', 'Allspice', 'Almond', 'Amaranth',
      'Ambrosia', 'American Cheese', 'Anchovy', 'Andouille', 'Angel Hair Pasta', 'Anise', 'Antipasto',
      'Apple', 'Apple Cider', 'Apple Pie', 'Applesauce', 'Apricot', 'Arancini', 'Arepa', 'Artichoke',
      'Arugula', 'Asado', 'Asparagus', 'Aubergine', 'Avocado', 'Avocado Toast', 'Baba Ganoush',
      'Babka', 'Bacon', 'Bagel', 'Baguette', 'Baked Alaska', 'Baked Beans', 'Baked Potato', 'Baklava',
      'Balsamic Vinegar', 'Bamboo Shoot', 'Banana', 'Banana Bread', 'Bangers and Mash', 'Banh Mi',
      'Banoffee Pie', 'Bao', 'Baozi', 'Barbecue', 'Barley', 'Basil', 'Basmati Rice', 'Bay Leaf',
      'Bean', 'Bean Sprout', 'Bearnaise', 'Beef', 'Beef Jerky', 'Beef Stroganoff', 'Beef Wellington',
      'Beet', 'Beetroot', 'Beignet', 'Bell Pepper', 'Bento', 'Berries', 'Berry', 'Bhaji', 'Bibimbap',
      'Biltong', 'Birria', 'Biryani', 'Biscotti', 'Biscuit', 'Bisque', 'Black Bean', 'Black Olive',
      'Black Pepper', 'Black Pudding', 'Blackberry', 'Blackcurrant', 'Blini', 'Blood Orange',
      'Blood Sausage', 'Blue Cheese', 'Blueberry', 'Boiled Egg', 'Bok Choy', 'Bolognese', 'Borscht',
      'Bouillabaisse', 'Bourbon Biscuit', 'Boysnberry', 'Bran', 'Bratwurst', 'Brazil Nut', 'Bread',
      'Breadfruit', 'Breadstick', 'Bresaola', 'Brie', 'Brioche', 'Brisket', 'Broccoli', 'Broccolini',
      'Broth', 'Brown Bread', 'Brown Rice', 'Brown Sugar', 'Brownie', 'Brunch', 'Bruschetta',
      'Brussels Sprouts', 'Bubble Tea', 'Buckwheat', 'Buffalo Wings', 'Bulgur', 'Bulgogi', 'Bun',
      'Burger', 'Burrata', 'Burrito', 'Butter', 'Butter Chicken', 'Butterbean', 'Buttermilk',
      'Butternut Squash', 'Butterscotch', 'Cabbage', 'Cacao', 'Cacio e Pepe', 'Caesar Salad', 'Cake',
      'Calamari', 'Calzone', 'Camembert', 'Candy', 'Cannelloni', 'Cannoli', 'Cantaloupe', 'Capers',
      'Cappuccino', 'Caprese', 'Caramel', 'Caraway', 'Carbonara', 'Cardamom', 'Carpaccio', 'Carrot',
      'Carrot Cake', 'Cashew', 'Cassava', 'Casserole', 'Catfish', 'Cauliflower', 'Caviar',
      'Cayenne Pepper', 'Celeriac', 'Celery', 'Cereal', 'Ceviche', 'Chai', 'Challah', 'Chamomile',
      'Champagne', 'Chana Masala', 'Chanterelle', 'Chapati', 'Chard', 'Charcuterie', 'Cheddar',
      'Cheese', 'Cheeseburger', 'Cheesecake', 'Cheesesteak', 'Cherimoya', 'Cherry', 'Cherry Tomato',
      'Chervil', 'Chestnut', 'Chia Seed', 'Chicken', 'Chicken Nuggets', 'Chicken Parmesan',
      'Chicken Soup', 'Chicken Tikka Masala', 'Chicken Wings', 'Chickpea', 'Chicory', 'Chilaquiles',
      'Chili', 'Chili Con Carne', 'Chili Dog', 'Chili Pepper', 'Chimichanga', 'Chimichurri', 'Chips',
      'Chives', 'Chocolate', 'Chocolate Cake', 'Chocolate Chip Cookie', 'Chops', 'Chorizo', 'Chow Mein',
      'Chowder', 'Chutney', 'Churro', 'Ciabatta', 'Cider', 'Cilantro', 'Cinnamon', 'Cinnamon Roll',
      'Citron', 'Clam', 'Clam Chowder', 'Clementine', 'Clotted Cream', 'Clove', 'Club Sandwich',
      'Cobbler', 'Cobb Salad', 'Cocoa', 'Coconut', 'Coconut Milk', 'Cod', 'Coffee', 'Colby',
      'Coleslaw', 'Collard Greens', 'Compote', 'Condensed Milk', 'Confit', 'Consomme', 'Cookie',
      'Coriander', 'Corn', 'Corn Dog', 'Corn Flakes', 'Corn Tortilla', 'Cornbread', 'Corned Beef',
      'Cornish Pasty', 'Cornmeal', 'Cottage Cheese', 'Cotton Candy', 'Courgette', 'Couscous', 'Crab',
      'Crab Cake', 'Cracker', 'Cranberry', 'Crawfish', 'Crayfish', 'Cream', 'Cream Cheese',
      'Cream Puff', 'Creme Brulee', 'Crepe', 'Cress', 'Crisps', 'Croissant', 'Croque Monsieur',
      'Croquette', 'Crostini', 'Crouton', 'Crumpet', 'Cucumber', 'Cumin', 'Cupcake', 'Curd',
      'Currant', 'Curry', 'Currywurst', 'Custard', 'Cutlet', 'Daikon', 'Dal', 'Dandelion Greens',
      'Danish Pastry', 'Dark Chocolate', 'Date', 'Deviled Eggs', 'Dill', 'Dill Pickle', 'Dim Sum',
      'Dolma', 'Doner Kebab', 'Donut', 'Dorayaki', 'Dosa', 'Doughnut', 'Dragonfruit', 'Dressing',
      'Dried Fruit', 'Duck', 'Dulce de Leche', 'Dumpling', 'Durian', 'Eclair', 'Edam', 'Edamame',
      'Eel', 'Egg', 'Egg Drop Soup', 'Egg Fried Rice', 'Egg Roll', 'Egg Salad', 'Eggnog', 'Eggplant',
      'Elderberry', 'Emmental', 'Empanada', 'Enchilada', 'Endive', 'English Muffin', 'Escargot',
      'Espresso', 'Eton Mess', 'Evaporated Milk', 'Fajita', 'Falafel', 'Farfalle', 'Farro',
      'Fava Bean', 'Feijoada', 'Fennel', 'Fenugreek', 'Feta', 'Fettuccine', 'Fig', 'Filet Mignon',
      'Filo Pastry', 'Fish', 'Fish Cake', 'Fish Finger', 'Fish Sauce', 'Fish Taco', 'Fish and Chips',
      'Flan', 'Flatbread', 'Flaxseed', 'Flounder', 'Flour', 'Focaccia', 'Foie Gras', 'Fondant',
      'Fondue', 'Fontina', 'Frankfurter', 'French Bean', 'French Bread', 'French Onion Soup',
      'French Fries', 'French Toast', 'Feta Cheese', 'Fried Chicken', 'Fried Egg', 'Fried Fish',
      'Fried Noodles', 'Fried Potato', 'Fried Rice', 'Frittata', 'Fritter', 'Frog Legs', 'Frosting',
      'Frozen Yogurt', 'Fruit', 'Fruit Salad', 'Fruitcake', 'Fudge', 'Fugu', 'Funnel Cake',
      'Galangal', 'Galette', 'Game', 'Garam Masala', 'Garbanzo Bean', 'Garlic', 'Garlic Bread',
      'Gazpacho', 'Gelatin', 'Gelato', 'Genovese', 'Ghee', 'Gherkin', 'Giblets', 'Gin', 'Ginger',
      'Ginger Ale', 'Ginger Beer', 'Gingerbread', 'Ginseng', 'Glazed Donut', 'Gnocchi', 'Goat',
      'Goat Cheese', 'Goji Berry', 'Golden Syrup', 'Goose', 'Gooseberry', 'Gorgonzola', 'Gouda',
      'Goulash', 'Graham Cracker', 'Grain', 'Granita', 'Granola', 'Grape', 'Grapefruit', 'Gratin',
      'Gravy', 'Greek Salad', 'Greek Yogurt', 'Green Bean', 'Green Onion', 'Green Pepper',
      'Green Salad', 'Green Tea', 'Greens', 'Grits', 'Ground Beef', 'Grouper', 'Gruyere', 'Guacamole',
      'Guava', 'Goulash', 'Gumbo', 'Gummy Bear', 'Gyoza', 'Gyro', 'Habanero', 'Haddock', 'Haggis',
      'Hake', 'Halibut', 'Halloumi', 'Halva', 'Ham', 'Hamburger', 'Harissa', 'Hash', 'Hash Brown',
      'Hash Browns', 'Havarti', 'Hazelnut', 'Heart of Palm', 'Herb', 'Herring', 'Hibiscus',
      'Hickory', 'Hoisin Sauce', 'Hollandaise', 'Hominy', 'Honey', 'Honey Mustard', 'Honeycomb',
      'Honeydew', 'Horchata', 'Horseradish', 'Hot Cross Bun', 'Hot Chocolate', 'Hot Dog', 'Hot Pot',
      'Hot Sauce', 'Hot Wings', 'Huevos Rancheros', 'Huckleberry', 'Hummus', 'Hushpuppy', 'Ice',
      'Ice Cream', 'Ice Lolly', 'Iceberg Lettuce', 'Iced Coffee', 'Iced Tea', 'Icing', 'Irish Stew',
      'Injers', 'Injera', 'Jack Cheese', 'Jackfruit', 'Jaffa Cake', 'Jalapeno', 'Jam', 'Jambalaya',
      'Jambon', 'Jasmine Rice', 'Jellied Eels', 'Jelly', 'Jelly Bean', 'Jerk Chicken', 'Jerky',
      'Jerusalem Artichoke', 'Jicama', 'Jollof Rice', 'Jordan Almond', 'Juice', 'Jujube', 'Julienne',
      'Juniper Berry', 'Kabanos', 'Kaki', 'Kale', 'Katsu', 'Katsu Curry', 'Kebab', 'Kedgeree',
      'Kefir', 'Kelp', 'Ketchup', 'Kettle Corn', 'Key Lime', 'Key Lime Pie', 'Khachapuri', 'Khichdi',
      'Kidney Bean', 'Kielbasa', 'Kimchi', 'King Crab', 'Kipper', 'Kirsch', 'Kitfo', 'Kiwi',
      'Kiwifruit', 'Knish', 'Kofta', 'Kohlrabi', 'Kombu', 'Kombucha', 'Korma', 'Kumquat', 'Laksa',
      'Lamb', 'Lamb Chop', 'Lamb Shank', 'Langoustine', 'Lard', 'Lardon', 'Lasagna', 'Lassi',
      'Latke', 'Latte', 'Lavender', 'Lavash', 'Layer Cake', 'Leek', 'Legume', 'Lemon', 'Lemon Curd',
      'Lemon Meringue Pie', 'Lemon Tart', 'Lemonade', 'Lemongrass', 'Lentil', 'Lentil Soup',
      'Lettuce', 'Licorice', 'Lima Bean', 'Lime', 'Limoncello', 'Lingonberry', 'Linguine', 'Liquorice',
      'Liver', 'Liverwurst', 'Lo Mein', 'Lobster', 'Lobster Bisque', 'Lobster Roll', 'Loganberry',
      'Loin', 'Lollipop', 'London Broil', 'Longan', 'Loquat', 'Lotus Root', 'Lox', 'Lychee',
      'Macadamia', 'Macaron', 'Macaroni', 'Macaroni and Cheese', 'Macaroon', 'Mace', 'Mackerel',
      'Madeleine', 'Madras', 'Mahi Mahi', 'Malt', 'Manchego', 'Mandarin', 'Mango', 'Mango Chutney',
      'Mango Lassi', 'Mangosteen', 'Manicotti', 'Maple Syrup', 'Maraschino Cherry', 'Margarine',
      'Margherita Pizza', 'Marinara', 'Marjoram', 'Marmalade', 'Marmite', 'Marrow', 'Marsala',
      'Marshmallow', 'Marzipan', 'Mascarpone', 'Mash', 'Mashed Potato', 'Mashed Potatoes', 'Matcha',
      'Matzo', 'Matzo Ball Soup', 'Mayonnaise', 'Meat', 'Meat Pie', 'Meat Sauce', 'Meatball',
      'Meatloaf', 'Melba Toast', 'Melon', 'Meringue', 'Milk', 'Milk Chocolate', 'Milkshake',
      'Millet', 'Mince', 'Mince Pie', 'Mincemeat', 'Minestrone', 'Mint', 'Mirepoix', 'Mirin',
      'Miso', 'Miso Soup', 'Mocha', 'Molasses', 'Mole', 'Monkfish', 'Monterey Jack', 'Meringue',
      'Mortadella', 'Mochi', 'Moussaka', 'Mousse', 'Mozzarella', 'Mozzarella Sticks', 'Muesli',
      'Muffin', 'Muffuletta', 'Mulberry', 'Mulligatawny', 'Mung Bean', 'Munster', 'Mushroom',
      'Mushroom Soup', 'Mussel', 'Mustard', 'Mutton', 'Naan', 'Nachos', 'Napa Cabbage', 'Nashi Pear',
      'Natto', 'Navy Bean', 'Neapolitan Ice Cream', 'Nectar', 'Nectarine', 'Noodle', 'Noodle Soup',
      'Noodles', 'Nori', 'Nougat', 'Nut', 'Nutella', 'Nutmeg', 'Oat', 'Oat Milk', 'Oatcake',
      'Oatmeal', 'Octopus', 'Offal', 'Oil', 'Okonomiyaki', 'Okra', 'Olive', 'Olive Oil', 'Omelet',
      'Omelette', 'Onion', 'Onion Bhaji', 'Onion Ring', 'Onion Rings', 'Onion Soup', 'Orange',
      'Orange Chicken', 'Orange Juice', 'Oregano', 'Oreo', 'Orzo', 'Osso Buco', 'Ostrich', 'Oxtail',
      'Oyster', 'Oyster Mushroom', 'Oyster Sauce', 'Pad See Ew', 'Pad Thai', 'Paella', 'Pakora',
      'Palak Paneer', 'Palm Oil', 'Panang Curry', 'Pancake', 'Pancetta', 'Pandan', 'Paneer',
      'Panettone', 'Panini', 'Panna Cotta', 'Papadum', 'Papaya', 'Pappardelle', 'Paprika',
      'Parfait', 'Parmesan', 'Parmigiana', 'Parsley', 'Parsnip', 'Passion Fruit', 'Passionfruit',
      'Pasta', 'Pasta Salad', 'Pasteis de Nata', 'Pastrami', 'Pastry', 'Pasty', 'Pate', 'Pavlova',
      'Pea', 'Pea Soup', 'Peach', 'Peach Cobbler', 'Peanut', 'Peanut Brittle', 'Peanut Butter',
      'Pear', 'Pearl Barley', 'Pearl Onion', 'Peas', 'Pecan', 'Pecan Pie', 'Pecorino', 'Peking Duck',
      'Penne', 'Pepper', 'Peppermint', 'Pepperoni', 'Perch', 'Peri Peri', 'Persimmon', 'Pesto',
      'Pheasant', 'Philly Cheesesteak', 'Pho', 'Piccalilli', 'Pickle', 'Pickled Ginger',
      'Pickled Onion', 'Pico de Gallo', 'Pie', 'Pierogi', 'Pig', 'Pigeon', 'Pike', 'Pilaf',
      'Pimento', 'Pine Nut', 'Pineapple', 'Pinto Bean', 'Pistachio', 'Pita', 'Pita Bread', 'Pizza',
      'Plaice', 'Plantain', 'Plum', 'Poached Egg', 'Poke', 'Poke Bowl', 'Polenta', 'Polish Sausage',
      'Pollock', 'Pomegranate', 'Pomelo', 'Ponzu', 'Pop Tart', 'Popcorn', 'Poppadom', 'Poppy Seed',
      'Popover', 'Porcini', 'Pork', 'Pork Belly', 'Pork Bun', 'Pork Chop', 'Pork Rind', 'Pork Scratchings',
      'Porridge', 'Portobello', 'Pot Pie', 'Pot Roast', 'Potato', 'Potato Chips', 'Potato Salad',
      'Potato Soup', 'Potato Wedge', 'Poutine', 'Praline', 'Prawn', 'Pretzel', 'Prime Rib',
      'Profiterole', 'Prosciutto', 'Provolone', 'Prune', 'Pudding', 'Puff Pastry', 'Pulled Pork',
      'Pumpernickel', 'Pumpkin', 'Pumpkin Pie', 'Pumpkin Seed', 'Pumpkin Soup', 'Puri', 'Quail',
      'Quail Egg', 'Quark', 'Quarter Pounder', 'Quesadilla', 'Queso', 'Quiche', 'Quince', 'Quinoa',
      'Rabbit', 'Raclette', 'Radicchio', 'Radish', 'Ragu', 'Rainbow Trout', 'Raisin', 'Raita',
      'Ramen', 'Ranch Dressing', 'Raspberry', 'Ratatouille', 'Ravioli', 'Red Bean', 'Red Cabbage',
      'Red Onion', 'Red Pepper', 'Red Velvet Cake', 'Redcurrant', 'Refried Beans', 'Relish',
      'Remoulade', 'Rhubarb', 'Rib', 'Ribeye', 'Ribs', 'Rice', 'Rice Cake', 'Rice Noodle',
      'Rice Paper', 'Rice Krispies', 'Rice Pudding', 'Ricotta', 'Rigatoni', 'Risotto', 'Roast',
      'Roast Beef', 'Roast Chicken', 'Roast Duck', 'Roast Lamb', 'Roast Pork', 'Roast Potato',
      'Roast Turkey', 'Roasted Garlic', 'Rock Cake', 'Rocket', 'Rocky Road', 'Roe', 'Roll',
      'Romaine', 'Romesco', 'Root Beer', 'Roquefort', 'Rose Water', 'Rosemary', 'Rosti', 'Roti',
      'Rotisserie Chicken', 'Roulade', 'Rueben', 'Reuben Sandwich', 'Rum Baba', 'Rump Steak',
      'Rusk', 'Rutabaga', 'Rye', 'Rye Bread', 'Saffron', 'Sage', 'Sago', 'Salad', 'Salami',
      'Salisbury Steak', 'Salmon', 'Salsa', 'Salt', 'Salt Beef', 'Salt Cod', 'Saltine', 'Sambal',
      'Samosa', 'Samphire', 'Sandwich', 'Sangria', 'Sardine', 'Sashimi', 'Satay', 'Satsuma',
      'Sauce', 'Sauerkraut', 'Sausage', 'Sausage Roll', 'Savory', 'Savoy Cabbage', 'Scallion',
      'Scallop', 'Scalloped Potatoes', 'Scampi', 'Schnitzel', 'Scone', 'Scotch Bonnet', 'Scotch Egg',
      'Scrambled Eggs', 'Sea Bass', 'Sea Salt', 'Seafood', 'Seaweed', 'Seed', 'Seitan', 'Semolina',
      'Serrano Ham', 'Sesame', 'Sesame Oil', 'Sesame Seed', 'Seviche', 'Shallot', 'Shark Fin Soup',
      'Shawarma', 'Shepherd Pie', 'Shepherds Pie', 'Sherbet', 'Sherry', 'Shiitake', 'Shortbread',
      'Shortcake', 'Shortening', 'Short Rib', 'Shrimp', 'Sirloin', 'Skewer', 'Slaw', 'Slider',
      'Sloppy Joe', 'Smoked Fish', 'Smoked Salmon', 'Smoothie', 'Smore', 'Snack', 'Snail', 'Snap Pea',
      'Snapper', 'Snickerdoodle', 'Snow Pea', 'Soba', 'Soda', 'Soda Bread', 'Soft Pretzel',
      'Soft Serve', 'Sole', 'Som Tam', 'Sorbet', 'Sorghum', 'Sorrel', 'Souffle', 'Soup', 'Sour Cream',
      'Sourdough', 'Soursop', 'Soy', 'Soy Milk', 'Soy Sauce', 'Soybean', 'Spaghetti',
      'Spaghetti Bolognese', 'Spam', 'Spanakopita', 'Spare Ribs', 'Spatzle', 'Spearmint', 'Spelt',
      'Spice', 'Spicy Tuna', 'Spinach', 'Split Pea', 'Split Pea Soup', 'Sponge Cake', 'Spring Onion',
      'Spring Roll', 'Sprinkles', 'Sprout', 'Squab', 'Squash', 'Squid', 'Star Anise', 'Starfruit',
      'Steak', 'Steak Tartare', 'Steamed Bun', 'Stew', 'Sticky Rice', 'Sticky Toffee Pudding',
      'Stilton', 'Stir Fry', 'Stock', 'Stracciatella', 'Strawberry', 'Strawberry Shortcake',
      'Streusel', 'String Bean', 'String Cheese', 'Stroganoff', 'Stromboli', 'Stroopwafel', 'Strudel',
      'Stuffed Pepper', 'Stuffing', 'Sturgeon', 'Succotash', 'Suet', 'Sugar', 'Sugar Snap Pea',
      'Sultana', 'Sumac', 'Summer Roll', 'Sundae', 'Sunflower Oil', 'Sunflower Seed', 'Supreme Pizza',
      'Surf and Turf', 'Sushi', 'Swede', 'Sweet Corn', 'Sweet Sour Chicken', 'Sweet Potato',
      'Sweet Potato Fries', 'Sweetbread', 'Sweetener', 'Swiss Chard', 'Swiss Cheese', 'Swiss Roll',
      'Swordfish', 'Syrup', 'Szechuan Chicken', 'Tabasco', 'Tabbouleh', 'Taco', 'Taco Salad',
      'Taffy', 'Tagine', 'Tagliatelle', 'Tahini', 'Takoyaki', 'Taleggio', 'Tamago', 'Tamale',
      'Tamarillo', 'Tamarind', 'Tandoori', 'Tandoori Chicken', 'Tangelo', 'Tangerine', 'Tapas',
      'Tapenade', 'Tapioca', 'Taramasalata', 'Taro', 'Tarragon', 'Tart', 'Tartar Sauce',
      'Tarte Tatin', 'Tater Tots', 'Tea', 'Tea Cake', 'Tempeh', 'Tempura', 'Tenderloin', 'Tequila',
      'Teriyaki', 'Terrine', 'Texas Toast', 'Thai Curry', 'Thousand Island', 'Thyme', 'Tikka',
      'Tikka Masala', 'Tilapia', 'Tiramisu', 'Toad in the Hole', 'Toast', 'Toasted Sandwich',
      'Toastie', 'Toffee', 'Tofu', 'Tom Yum', 'Tomatillo', 'Tomato', 'Tomato Paste', 'Tomato Sauce',
      'Tomato Soup', 'Tonkatsu', 'Tonkotsu Ramen', 'Torte', 'Tortellini', 'Tortilla', 'Tortilla Chip',
      'Tortilla Soup', 'Tostada', 'Trail Mix', 'Treacle', 'Tres Leches Cake', 'Trifle', 'Tripe',
      'Trout', 'Truffle', 'Tuna', 'Tuna Melt', 'Tuna Salad', 'Turbot', 'Turducken', 'Turkey',
      'Turkish Delight', 'Turmeric', 'Turnip', 'Turnover', 'Tzatziki', 'Ube', 'Udon', 'Ugli Fruit',
      'Umeboshi', 'Uni', 'Upside Down Cake', 'Vanilla', 'Vanilla Extract', 'Vanilla Ice Cream',
      'Veal', 'Vegan Burger', 'Vegetable', 'Vegetable Oil', 'Vegetable Soup', 'Vegemite',
      'Vegetarian Pizza', 'Veggie Burger', 'Veloute', 'Venison', 'Vermicelli', 'Vichyssoise',
      'Victoria Sponge', 'Vinaigrette', 'Vindaloo', 'Vinegar', 'Wafer', 'Waffle', 'Waffle Fries',
      'Wagyu', 'Waldorf Salad', 'Walnut', 'Wasabi', 'Water', 'Water Chestnut', 'Watercress',
      'Watermelon', 'Wedge Salad', 'Welsh Rarebit', 'Western Omelet', 'Wheat', 'Wheat Bread',
      'Whelk', 'Whey', 'Whipped Cream', 'Whisky', 'White Bean', 'White Bread', 'White Chocolate',
      'White Pepper', 'White Rice', 'Whitebait', 'Whole Wheat Bread', 'Whoopie Pie', 'Wild Boar',
      'Wild Mushroom', 'Wild Rice', 'Wine', 'Wonton', 'Wonton Soup', 'Worcestershire Sauce', 'Wrap',
      'Xacuti', 'Xanthan Gum', 'Xiaolongbao', 'Xigua', 'Ximenia', 'Xnipec', 'Yakitori', 'Yakisoba',
      'Yam', 'Yeast', 'Yellow Pepper', 'Yellowfin Tuna', 'Yoghurt', 'Yogurt', 'Yorkshire Pudding',
      'Yuca', 'Yuzu', 'Zabaglione', 'Zaatar', 'Zest', 'Ziti', 'Zucchini', 'Zucchini Bread', 'Zwieback',
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
 * Built-in comprehensive A–Z rosters for Athletes, Actors & Filmmakers, and Musicians & Singers
 * so that even before/alongside `people.json` and online search, players have hundreds of iconic
 * names across every letter of the alphabet (including full names and surname aliases).
 */
export const STATIC_ATHLETES = Object.freeze([
  'Aaron Donald', 'Aaron Judge', 'Aaron Rodgers', 'Abebe Bikila', 'Ada Hegerberg', 'Adam Peaty',
  'Alberto Contador', 'Alberto Tomba', 'Alex Morgan', 'Alexander Karelin', 'Alexander Ovechkin',
  'Alexander Volkanovski', 'Alexander Zverev', 'Alexis Sanchez', 'Allen Iverson', 'Allyson Felix',
  'Amanda Nunes', 'Anderson Silva', 'Andre Agassi', 'Andrea Pirlo', 'Andres Iniesta', 'Andy Murray',
  'Angel Di Maria', 'Anja Parson', 'Annika Sorenstam', 'Anthony Davis', 'Anthony Edwards',
  'Anthony Joshua', 'Antoine Griezmann', 'Antonio Brown', 'Ariarne Titmus', 'Arjen Robben',
  'Armand Duplantis', 'Arnold Palmer', 'Arthur Ashe', 'Aryna Sabalenka', 'Asafa Powell', 'Ash Barty',
  'Ashton Eaton', 'Auston Matthews', 'Ayrton Senna', 'Babe Didrikson Zaharias', 'Babe Ruth',
  'Badr Hari', 'Barry Bonds', 'Barry Sanders', 'Bastian Schweinsteiger', 'Ben Hogan', 'Ben Johnson',
  'Ben Roethlisberger', 'Ben Shelton', 'Bernard Hopkins', 'Bernhard Langer', 'Bethany Hamilton',
  'Bill Russell', 'Billie Jean King', 'Birgit Fischer', 'Bjorn Borg', 'Bjorn Daehlie', 'Blake Griffin',
  'Bo Jackson', 'Bob Beamon', 'Bob Cousy', 'Bob Gibson', 'Bobby Charlton', 'Bobby Fischer',
  'Bobby Hull', 'Bobby Moore', 'Bobby Orr', 'Bode Miller', 'Boris Becker', 'Brad Marchand',
  'Bradley Wiggins', 'Breanna Stewart', 'Brett Favre', 'Brian Lara', 'Brock Lesnar', 'Brooks Koepka',
  'Bruce Lee', 'Bryce Harper', 'Bukayo Saka', 'Buster Douglas', 'Caeleb Dressel', 'Caitlin Clark',
  'Cal Ripken Jr', 'Cale Makar', 'Cam Newton', 'Cameron Smith', 'Canelo Alvarez', 'Carl Lewis',
  'Carli Lloyd', 'Carlos Alcaraz', 'Carlos Monzon', 'Carlos Sainz', 'Carlos Tevez', 'Carmelo Anthony',
  'Caroline Wozniacki', 'Casemiro', 'Cassius Clay', 'Caster Semenya', 'Cathy Freeman', 'Cesar Cielo',
  'Charles Barkley', 'Charles Leclerc', 'Charles Oliveira', 'Chris Evert', 'Chris Froome', 'Chris Hoy',
  'Chris Paul', 'Christian Coleman', 'Christian McCaffrey', 'Christian Pulisic', 'Christine Sinclair',
  'Chuck Liddell', 'Clara Hughes', 'Claressa Shields', 'Claude Makelele', 'Clayton Kershaw',
  'Clint Dempsey', 'Clyde Drexler', 'Coco Gauff', 'Cole Palmer', 'Collin Morikawa', 'Conor McGregor',
  'Connor Bedard', 'Connor McDavid', 'Cooper Kupp', 'Courtney Dauwalter', 'Cristiano Ronaldo',
  'Cy Young', 'Daiki Hashimoto', 'Daley Thompson', 'Damian Lillard', 'Dan Carter', 'Dan Marino',
  'Danica Patrick', 'Daniel Cormier', 'Daniel Ricciardo', 'Daniil Medvedev', 'David Beckham',
  'David Ortiz', 'David Pastrnak', 'David Robinson', 'David Rudisha', 'David Villa', 'Dawn Fraser',
  'Deion Sanders', 'Demetrious Johnson', 'Dennis Bergkamp', 'Dennis Rodman', 'Deontay Wilder',
  'Derek Jeter', 'Derrick Henry', 'Derrick Rose', 'Devin Booker', 'Dick Fosbury', 'Didier Drogba',
  'Diego Forlan', 'Diego Maradona', 'Dina Asher-Smith', 'Dirk Nowitzki', 'Dominik Hasek',
  'Dominique Dawes', 'Don Bradman', 'Donovan Bailey', 'Donovan Mitchell', 'Draymond Green',
  'Drew Brees', 'Dricus Du Plessis', 'Dustin Johnson', 'Dustin Poirier', 'Dwyane Wade', 'Eddy Merckx',
  'Eden Hazard', 'Edinson Cavani', 'Edwin Moses', 'Eileen Gu', 'Elaine Thompson-Herah',
  'Elena Delle Donne', 'Eli Manning', 'Eliud Kipchoge', 'Ellyse Perry', 'Emil Zatopek',
  'Emiliano Martinez', 'Emma McKeon', 'Emma Raducanu', 'Emerson Fittipaldi', 'Emmitt Smith',
  'Eric Cantona', 'Eric Heiden', 'Erling Haaland', 'Eusebio', 'Evander Holyfield', 'Evgeni Plushenko',
  'Fabian Cancellara', 'Fabio Cannavaro', 'Faith Kipyegon', 'Fedor Emelianenko', 'Femke Bol',
  'Ferenc Puskas', 'Fernando Alonso', 'Fernando Tatis Jr', 'Fernando Torres', 'Filippo Inzaghi',
  'Florence Griffith-Joyner', 'Floyd Mayweather', 'Floyd Patterson', 'Fran Tarkenton',
  'Francesco Bagnaia', 'Francesco Totti', 'Francis Ngannou', 'Franco Baresi', 'Frank Lampard',
  'Frankie Dettori', 'Franz Beckenbauer', 'Franz Klammer', 'Fred Perry', 'Fredrik Ljungberg',
  'Gabriel Batistuta', 'Gabriel Jesus', 'Gabriela Sabatini', 'Gareth Bale', 'Garry Kasparov',
  'Gary Lineker', 'Gary Payton', 'Gary Player', 'Gennady Golovkin', 'George Best', 'George Foreman',
  'George Gervin', 'George Kittle', 'George Russell', 'George Weah', 'Georges St-Pierre',
  'Geraint Thomas', 'Gerd Muller', 'Gervonta Davis', 'Giacomo Agostini', 'Gianluigi Buffon',
  'Giannis Antetokounmpo', 'Gilberto Silva', 'Gino Bartali', 'Gordie Howe', 'Gordon Banks',
  'Greg LeMond', 'Greg Louganis', 'Greg Norman', 'Grete Waitz', 'Gunnar Nordahl', 'Gustavo Kuerten',
  'Hakeem Olajuwon', 'Haile Gebrselassie', 'Hank Aaron', 'Harry Kane', 'Hassan Yazdani',
  'Hector Camacho', 'Heike Drechsler', 'Helen Wills', 'Helio Castroneves', 'Henrik Kristoffersen',
  'Henrik Larsson', 'Henrik Lundqvist', 'Henry Armstrong', 'Henry Cejudo', 'Hermann Maier',
  'Hicham El Guerrouj', 'Hideki Matsui', 'Hideki Matsuyama', 'Hikaru Nakamura', 'Hilary Knight',
  'Hristo Stoichkov', 'Hulk Hogan', 'Ian Botham', 'Ian Rush', 'Ian Thorpe', 'Ichiro Suzuki',
  'Iga Swiatek', 'Iker Casillas', 'Ilia Malinin', 'Ilia Topuria', 'Imran Khan', 'Ingemar Stenmark',
  'Ingrid Kristiansen', 'Irene Schouten', 'Isiah Thomas', 'Islam Makhachev', 'Israel Adesanya',
  'Ivan Lendl', 'Ja Morant', 'Jack Dempsey', 'Jack Eichel', 'Jack Grealish', 'Jack Hughes',
  'Jack Johnson', 'Jack Nicklaus', 'Jackie Joyner-Kersee', 'Jackie Robinson', 'Jackie Stewart',
  'Jacques Anquetil', 'Jacques Kallis', 'Jadon Sancho', 'Jairzinho', 'Jake LaMotta', 'Jake Paul',
  'Jakob Ingebrigtsen', 'Jalen Brunson', 'Jalen Hurts', 'Jamal Murray', 'James Harden', 'James Hunt',
  'James Rodriguez', 'Jamie Vardy', 'Jan Frodeno', 'Jan Ullrich', 'Jan Zelezny', 'Jan-Ove Waldner',
  'Janet Evans', 'Janica Kostelic', 'Jannik Sinner', 'Jaromir Jagr', 'Jason Kelce', 'Jason Kidd',
  'Javier Sotomayor', 'Javier Zanetti', 'Jaylen Brown', 'Jayson Tatum', 'Jean-Claude Killy',
  'Jeff Gordon', 'Jenson Button', 'Jerome Boateng', 'Jerry Rice', 'Jerry West', 'Jesse Owens',
  'Jessica Ennis-Hill', 'Jim Brown', 'Jim Clark', 'Jim Courier', 'Jim Thorpe', 'Jimmie Johnson',
  'Jimmy Butler', 'Jimmy Connors', 'Joan Benoit', 'Joao Felix', 'Joe Burrow', 'Joe Calzaghe',
  'Joe DiMaggio', 'Joe Frazier', 'Joe Louis', 'Joe Montana', 'Joe Namath', 'Joe Root', 'Joel Embiid',
  'Johan Cruyff', 'Johannes Hoesflot Klaebo', 'Johannes Thingnes Boe', 'John Cena', 'John Elway',
  'John Higgins', 'John Madden', 'John McEnroe', 'John Stockton', 'John Surtees', 'John Terry',
  'Johnny Bench', 'Johnny Unitas', 'Johnny Weissmuller', 'Jon Jones', 'Jon Rahm', 'Jonah Lomu',
  'Jonas Vingegaard', 'Jonathan Edwards', 'Jonathan Toews', 'Jordan Love', 'Jordan Spieth',
  'Jorge Lorenzo', 'Jose Aldo', 'Jose Mourinho', 'Joseph Schooling', 'Josh Allen', 'Joshua Cheptegei',
  'Jrue Holiday', 'Juan Manuel Fangio', 'Juan Martin del Potro', 'Juan Soto', 'Jude Bellingham',
  'Julian Alaphilippe', 'Julio Cesar Chavez', 'Julius Erving', 'Jurgen Klinsmann', 'Jurgen Klopp',
  'Justin Gaethje', 'Justin Gatlin', 'Justin Jefferson', 'Justin Rose', 'Justin Thomas',
  'Justine Henin', 'Jutta Leerdam', 'Kaka', 'Kamaru Usman', 'Kapil Dev', 'Kareem Abdul-Jabbar',
  'Karim Benzema', 'Karl Malone', 'Karl-Anthony Towns', 'Karsten Warholm', 'Katarina Witt',
  'Katie Ledecky', 'Katie Taylor', 'Kawhi Leonard', 'Kayla Harrison', 'Kazuchika Okada',
  'Keisuke Honda', 'Kelly Holmes', 'Kelly Slater', 'Kelvin Kiptum', 'Ken Griffey Jr', 'Ken Norton',
  'Kenenisa Bekele', 'Kenny Dalglish', 'Kerri Walsh Jennings', 'Kevin De Bruyne', 'Kevin Durant',
  'Kevin Garnett', 'Kevin Harvick', 'Kevin Mayer', 'Khabib Nurmagomedov', 'Khamzat Chimaev',
  'Kim Clijsters', 'Kim Yuna', 'Kimi Raikkonen', 'Kirani James', 'Kjetil Andre Aamodt',
  'Klay Thompson', 'Kobe Bryant', 'Kohei Uchimura', 'Koji Murofushi', 'Kostya Tszyu',
  'Kristian Blummenfelt', 'Kristof Milak', 'Kurt Angle', 'Kurt Warner', 'Kylian Mbappe',
  'Kyrie Irving', 'LaDainian Tomlinson', 'Lamar Jackson', 'Lamine Yamal', 'Lando Norris',
  'Lance Armstrong', 'Landon Donovan', 'Larry Bird', 'Larry Fitzgerald', 'Larry Holmes',
  'Lasha Talakhadze', 'Laura Kenny', 'Laure Manaudou', 'Laurent Blanc', 'Laurie Hernandez',
  'Leander Paes', 'LeBron James', 'Lee Chong Wei', 'Lennox Lewis', 'Leon Edwards', 'Leon Marchand',
  'Lev Yashin', 'Lewis Hamilton', 'Lidia Valentin', 'Lilian Thuram', 'Lin Dan', 'Lindsey Vonn',
  'Lionel Messi', 'Lisa Leslie', 'Lleyton Hewitt', 'Logan Paul', 'Lolo Jones', 'Luka Doncic',
  'Luka Modric', 'Luis Figo', 'Luis Suarez', 'Luke Littler', 'Lyoto Machida', 'Ma Long',
  'Mads Pedersen', 'Magdalena Neuner', 'Magic Johnson', 'Magnus Carlsen', 'Mahendra Singh Dhoni',
  'Manuel Neuer', 'Manny Pacquiao', 'Manu Ginobili', 'Marc Gasol', 'Marc Marquez', 'Marcel Hirscher',
  'Marcel Jacobs', 'Marcelo', 'Marco Pantani', 'Marco van Basten', 'Marcus Rashford',
  'Margaret Court', 'Maria Sharapova', 'Mariano Rivera', 'Marie-Jose Perec', 'Mario Andretti',
  'Mario Kempes', 'Mario Lemieux', 'Marion Jones', 'Marit Bjorgen', 'Mark Cavendish', 'Mark Messier',
  'Mark Selby', 'Mark Spitz', 'Mark Webber', 'Marta', 'Martin Brodeur', 'Martin Fourcade',
  'Martin Odegaard', 'Martina Hingis', 'Martina Navratilova', 'Martina Sablikova', 'Marvin Hagler',
  'Mary Lou Retton', 'Masahiko Kimura', 'Mat Fraser', 'Matej Mohoric', 'Mathew Barzal',
  'Mathieu van der Poel', 'Mats Sundin', 'Mats Wilander', 'Matt Biondi', 'Matt Fitzpatrick',
  'Matthew Stafford', 'Maurice Greene', 'Maurice Richard', 'Max Holloway', 'Max Scherzer',
  'Max Verstappen', 'Megan Rapinoe', 'Mesut Ozil', 'Mia Hamm', 'Micah Parsons', 'Michael Ballack',
  'Michael Bisping', 'Michael Chang', 'Michael Clarke', 'Michael Gross', 'Michael Irvin',
  'Michael Johnson', 'Michael Jordan', 'Michael Owen', 'Michael Phelps', 'Michael Schumacher',
  'Michael Smith', 'Michael Spinks', 'Michael Strahan', 'Michael van Gerwen', 'Michael Vick',
  'Michel Platini', 'Michelle Kwan', 'Michelle Wie', 'Mick Doohan', 'Mika Hakkinen',
  'Mikaela Shiffrin', 'Mike Bossy', 'Mike Krzyzewski', 'Mike Piazza', 'Mike Powell', 'Mike Schmidt',
  'Mike Singletary', 'Mike Trout', 'Mike Tyson', 'Mikhail Tal', 'Mikkel Hansen', 'Milos Raonic',
  'Miltiadis Tentoglou', 'Mirko Cro Cop', 'Miroslav Klose', 'Missy Franklin', 'Misty May-Treanor',
  'Mitch Marner', 'Mo Farah', 'Mo Salah', 'Mohamed Farah', 'Mohamed Salah', 'Mondo Duplantis',
  'Monica Seles', 'Mookie Betts', 'Moses Malone', 'MS Dhoni', 'Muhammad Ali', 'Muttiah Muralitharan',
  'Mutaz Essa Barshim', 'Myles Garrett', 'Nadia Comaneci', 'Nafissatou Thiam', 'Naomi Osaka',
  'Nasser Al-Attiyah', 'Nastia Liukin', 'Natalie Coughlin', 'Nathan Chen', 'Nathan MacKinnon',
  'Neeraj Chopra', 'Neil Robertson', 'Nelly Korda', 'Nelson Piquet', 'Nemanja Vidic', 'Neymar',
  'Nick Faldo', 'Nick Kyrgios', 'Nicklas Lidstrom', 'Nico Rosberg', 'Nicola Adams', 'Nicolas Anelka',
  'Nigel Mansell', 'Niki Lauda', 'Nikita Kucherov', 'Nikola Jokic', 'Nikola Karabatic',
  'Nils van der Poel', 'Nino Schurter', 'Noah Lyles', 'Nolan Ryan', 'Nonito Donaire',
  'Novak Djokovic', 'Nyjah Huston', 'Odell Beckham Jr', 'Oksana Chusovitina', 'Ole Einar Bjorndalen',
  'Ole Gunnar Solskjaer', 'Oleksandr Usyk', 'Olga Korbut', 'Oliver Kahn', 'Olivier Giroud',
  'Omar Sivori', 'Oscar De La Hoya', 'Oscar Piastri', 'Oscar Robertson', 'Oscar Schmidt',
  'Owen Farrell', 'Paavo Nurmi', 'Paddy Pimblett', 'Paige Bueckers', 'Paolo Maldini', 'Paolo Rossi',
  'Pascal Siakam', 'Pat Rafter', 'Patrick Cantlay', 'Patrick Ewing', 'Patrick Kane',
  'Patrick Mahomes', 'Patrick Roy', 'Patrick Vieira', 'Pau Gasol', 'Paul Gascoigne', 'Paul George',
  'Paul Pogba', 'Paul Scholes', 'Paula Radcliffe', 'Payne Stewart', 'Pedro Martinez', 'Pele',
  'Penny Oleksiak', 'Pep Guardiola', 'Pernell Whitaker', 'Pernilla Wiberg', 'Pete Maravich',
  'Pete Rose', 'Pete Sampras', 'Peter Forsberg', 'Peter Sagan', 'Peter Schmeichel', 'Peter Shilton',
  'Peter Snell', 'Peter Wright', 'Petr Cech', 'Petra Kvitova', 'Petra Vlhova', 'Petter Northug',
  'Peyton Manning', 'Phil Esposito', 'Phil Foden', 'Phil Jackson', 'Phil Mickelson', 'Phil Taylor',
  'Philipp Lahm', 'Pierre Gasly', 'Pierre-Emerick Aubameyang', 'Pieter van den Hoogenband',
  'PK Subban', 'Primoz Roglic', 'Quinton Jackson', 'Rachael Blackmore', 'Radamel Falcao',
  'Rafael Leao', 'Rafael Nadal', 'Raheem Sterling', 'Ralf Schumacher', 'Randy Johnson', 'Randy Moss',
  'Randy Orton', 'Raul', 'Ray Allen', 'Ray Bourque', 'Ray Lewis', 'Raymond van Barneveld',
  'Rebecca Adlington', 'Rebeca Andrade', 'Reggie Bush', 'Reggie Jackson', 'Reggie Miller',
  'Reggie White', 'Remco Evenepoel', 'Rene Higuita', 'Rene Lacoste', 'Rey Mysterio', 'Ric Flair',
  'Rich Froning', 'Richard Petty', 'Richie McCaw', 'Rickey Henderson', 'Ricky Hatton',
  'Ricky Ponting', 'Riddick Bowe', 'Rivaldo', 'Rob Gronkowski', 'Robbie Keane', 'Robert Kubica',
  'Robert Lewandowski', 'Robert Parish', 'Roberto Baggio', 'Roberto Carlos', 'Roberto Clemente',
  'Roberto Duran', 'Robin van Persie', 'Rocky Marciano', 'Rod Laver', 'Rodri', 'Rodrigo De Paul',
  'Roger Bannister', 'Roger Clemens', 'Roger Federer', 'Roger Milla', 'Roger Staubach',
  'Roman Reigns', 'Romario', 'Romelu Lukaku', 'Ronald Koeman', 'Ronaldinho', 'Ronda Rousey',
  'Ronnie Coleman', 'Ronnie OSullivan', 'Rory McIlroy', 'Rose Namajunas', 'Roy Emerson',
  'Roy Jones Jr', 'Roy Keane', 'Ruud Gullit', 'Ruud van Nistelrooy', 'Rui Hachimura',
  'Russell Westbrook', 'Russell Wilson', 'Ruta Meilutyte', 'Ryan Crouser', 'Ryan Giggs',
  'Ryan Lochte', 'Ryoyu Kobayashi', 'Sabrina Ionescu', 'Sachin Tendulkar', 'Sadio Mane',
  'Saquon Barkley', 'Sarah Sjostrom', 'Saul Canelo Alvarez', 'Scott Dixon', 'Scott Hamilton',
  'Scottie Pippen', 'Scottie Scheffler', 'Sean OMalley', 'Sebastian Coe', 'Sebastian Vettel',
  'Serena Williams', 'Sergio Aguero', 'Sergio Busquets', 'Sergio Perez', 'Sergio Ramos',
  'Seve Ballesteros', 'Shane Lowry', 'Shane Mosley', 'Shane Warne', 'Shannon Miller',
  'Shai Gilgeous-Alexander', 'Shakur Stevenson', 'Shaquille ONeal', 'Shaun White', 'Shawn Johnson',
  'Shawn Michaels', 'Shelly-Ann Fraser-Pryce', 'Shericka Jackson', 'Shohei Ohtani', 'Shoaib Akhtar',
  'Sidney Crosby', 'Sifan Hassan', 'Simona Halep', 'Simone Biles', 'Simone Manuel', 'Sir Chris Hoy',
  'Sky Brown', 'Sloane Stephens', 'Sofia Goggia', 'Son Heung-min', 'Sonny Liston', 'Sourav Ganguly',
  'Stan Mikita', 'Stan Smith', 'Stan Wawrinka', 'Stefan Edberg', 'Stefan Kraft', 'Steffi Graf',
  'Stephen Curry', 'Stephen Hendry', 'Steve Nash', 'Steve Ovett', 'Steve Prefontaine',
  'Steve Redgrave', 'Steve Smith', 'Steve Waugh', 'Steve Yzerman', 'Steven Gerrard',
  'Steven Stamkos', 'Stipe Miocic', 'Stirling Moss', 'Stone Cold Steve Austin', 'Stuart Broad',
  'Sue Bird', 'Sugar Ray Leonard', 'Sugar Ray Robinson', 'Summer McIntosh', 'Sun Yang',
  'Sunil Chhetri', 'Sunisa Lee', 'Surya Bonaly', 'Sven Kramer', 'Sydney McLaughlin-Levrone',
  'Tadej Pogacar', 'Tai Tzu-ying', 'Takanori Nagase', 'Takuma Sato', 'Tamika Catchings',
  'Tanni Grey-Thompson', 'Tara Lipinski', 'Tarjei Boe', 'Teddy Riner', 'Teofimo Lopez',
  'Terence Crawford', 'Thierry Henry', 'Thomas Hearns', 'Thomas Muller', 'Tadej Pogacar',
  'Tiger Woods', 'Tim Duncan', 'Tim Tebow', 'Timo Boll', 'Tirunesh Dibaba', 'Tito Ortiz',
  'TJ Dillashaw', 'Tobin Heath', 'Tom Brady', 'Tom Daley', 'Tom Finney', 'Tom Kim', 'Tom Seaver',
  'Tom Watson', 'Tommy Fleetwood', 'Tommy Hearns', 'Toni Kroos', 'Tony Gwynn', 'Tony Hawk',
  'Tony Parker', 'Tony Romo', 'Torvill and Dean', 'Tracy Austin', 'Tracy McGrady', 'Trae Young',
  'Travis Kelce', 'Trent Alexander-Arnold', 'Trevor Lawrence', 'Triple H', 'Troy Aikman',
  'Troy Polamalu', 'Tua Tagovailoa', 'Ty Cobb', 'Tyreek Hill', 'Tyson Fury', 'Tyson Gay',
  'Uli Hoeness', 'Ulrich Salchow', 'Umar Nurmagomedov', 'Unai Emery', 'Usain Bolt', 'Uta Abe',
  'Uwe Seeler', 'Valentino Rossi', 'Valerie Adams', 'Valtteri Bottas', 'Vasyl Lomachenko',
  'Venus Williams', 'Victor Osimhen', 'Victor Wembanyama', 'Victoria Azarenka', 'Vijay Singh',
  'Viktor Axelsen', 'Viktor Gyokeres', 'Viktor Hovland', 'Vince Carter', 'Vince Lombardi',
  'Vincent Kompany', 'Vinicius Junior', 'Virat Kohli', 'Virgil van Dijk', 'Vitali Klitschko',
  'Vitor Belfort', 'Viv Richards', 'Vladimir Klitschko', 'Vladislav Tretiak', 'Von Miller',
  'Wladimir Klitschko', 'Walter Payton', 'Wanderlei Silva', 'Warren Moon', 'Wasim Akram',
  'Wayde van Niekerk', 'Wayne Gretzky', 'Wayne Rooney', 'Wendy Holdener', 'Wes Unseld',
  'Wilma Rudolph', 'Willie Mays', 'Willie Shoemaker', 'Wilson Kipketer', 'Wilt Chamberlain',
  'Wout van Aert', 'Xabi Alonso', 'Xander Schauffele', 'Xavi', 'Xavi Hernandez', 'Xherdan Shaqiri',
  'Yao Ming', 'Yaroslava Mahuchikh', 'Yasuhiro Yamashita', 'Yelena Isinbayeva', 'Yohan Blake',
  'Yogi Berra', 'Yordenis Ugas', 'Yulimar Rojas', 'Yuna Kim', 'Yuto Horigome', 'Yuzuru Hanyu',
  'Zach LaVine', 'Zack Wheeler', 'Zara Tindall', 'Zdeno Chara', 'Zico', 'Zinedine Zidane',
  'Zion Williamson', 'Zlatan Ibrahimovic', 'Zoe Sadowski-Synnott',
]);

export const STATIC_ACTORS = Object.freeze([
  'Aaron Paul', 'Aaron Taylor-Johnson', 'Adam Driver', 'Adam Sandler', 'Adrien Brody', 'Al Pacino',
  'Alan Rickman', 'Alec Baldwin', 'Alec Guinness', 'Alfred Hitchcock', 'Alicia Vikander',
  'Amanda Seyfried', 'Amy Adams', 'Ana de Armas', 'Andrew Garfield', 'Andy Serkis', 'Angela Bassett',
  'Angelina Jolie', 'Anjelica Huston', 'Anna Kendrick', 'Anne Hathaway', 'Anthony Hopkins',
  'Anthony Mackie', 'Antonio Banderas', 'Anya Taylor-Joy', 'Arnold Schwarzenegger', 'Aubrey Plaza',
  'Audrey Hepburn', 'Austin Butler', 'Ava Gardner', 'awkwafina', 'Barbara Stanwyck', 'Barry Keoghan',
  'Ben Affleck', 'Ben Kingsley', 'Ben Stiller', 'Benedict Cumberbatch', 'Benicio del Toro',
  'Bette Davis', 'Betty White', 'Bill Hader', 'Bill Murray', 'Bill Nighy', 'Bill Skarsgard',
  'Billy Bob Thornton', 'Billy Crystal', 'Billy Wilder', 'Blake Lively', 'Bob Odenkirk',
  'Bong Joon-ho', 'Brad Pitt', 'Bradley Cooper', 'Brendan Fraser', 'Brendan Gleeson', 'Brie Larson',
  'Brigitte Bardot', 'Bruce Lee', 'Bruce Willis', 'Bryan Cranston', 'Burt Lancaster', 'Burt Reynolds',
  'Buster Keaton', 'Cameron Diaz', 'Carey Mulligan', 'Cary Grant', 'Casey Affleck', 'Cate Blanchett',
  'Catherine Deneuve', 'Catherine Zeta-Jones', 'Chadwick Boseman', 'Channing Tatum',
  'Charlie Chaplin', 'Charlie Sheen', 'Charlize Theron', 'Charlton Heston', 'Chevy Chase',
  'Chiwetel Ejiofor', 'Chloe Grace Moretz', 'Chow Yun-fat', 'Chris Evans', 'Chris Hemsworth',
  'Chris Pine', 'Chris Pratt', 'Chris Rock', 'Chris Tucker', 'Christian Bale', 'Christina Applegate',
  'Christina Ricci', 'Christoph Waltz', 'Christopher Lee', 'Christopher Lloyd', 'Christopher Nolan',
  'Christopher Plummer', 'Christopher Walken', 'Cillian Murphy', 'Claire Danes', 'Claire Foy',
  'Clark Gable', 'Clint Eastwood', 'Clive Owen', 'Colin Farrell', 'Colin Firth', 'Colman Domingo',
  'Courteney Cox', 'Cuba Gooding Jr', 'Cary Elwes', 'Daisy Edgar-Jones', 'Daisy Ridley',
  'Dakota Fanning', 'Dakota Johnson', 'Dan Aykroyd', 'Daniel Brühl', 'Daniel Craig',
  'Daniel Day-Lewis', 'Daniel Kaluuya', 'Daniel Radcliffe', 'Danny DeVito', 'Danny Glover',
  'Danny Trejo', 'Darren Aronofsky', 'Dave Bautista', 'David Cronenberg', 'David Fincher',
  'David Harbour', 'David Lynch', 'David Tennant', 'Debbie Reynolds', 'Demi Moore',
  'Denis Villeneuve', 'Denise Richards', 'Dennis Hopper', 'Dennis Quaid', 'Denzel Washington',
  'Dev Patel', 'Diane Keaton', 'Diane Kruger', 'Diane Lane', 'Dick Van Dyke', 'Diego Luna',
  'Dolph Lundgren', 'Domhnall Gleeson', 'Donald Glover', 'Donald Sutherland', 'Don Cheadle',
  'Donnie Yen', 'Doris Day', 'Drew Barrymore', 'Dustin Hoffman', 'Dwayne Johnson', 'Ed Harris',
  'Ed Helms', 'Eddie Murphy', 'Eddie Redmayne', 'Edward Norton', 'Eiza Gonzalez', 'Elijah Wood',
  'Elizabeth Banks', 'Elizabeth Olsen', 'Elizabeth Taylor', 'Elle Fanning', 'Ellen Burstyn',
  'Elliott Gould', 'Emily Blunt', 'Emma Mackey', 'Emma Roberts', 'Emma Stone', 'Emma Thompson',
  'Emma Watson', 'Emilio Estevez', 'Ewan McGregor', 'Ethan Hawke', 'Eva Green', 'Eva Longoria',
  'Eva Mendes', 'Evan Peters', 'Faye Dunaway', 'Federico Fellini', 'Felicity Jones', 'Finn Wolfhard',
  'Florence Pugh', 'Forest Whitaker', 'Frances McDormand', 'Francis Ford Coppola', 'Frank Capra',
  'Frank Darabont', 'Fred Astaire', 'Freddie Highmore', 'Gael Garcia Bernal', 'Gal Gadot',
  'Gary Cooper', 'Gary Oldman', 'Gemma Arterton', 'Gemma Chan', 'Gene Hackman', 'Gene Kelly',
  'Gene Wilder', 'Geoffrey Rush', 'George Clooney', 'George C. Scott', 'George Lucas',
  'George Miller', 'Gerard Butler', 'Gerard Depardieu', 'Gillian Anderson', 'Giancarlo Esposito',
  'Ginger Rogers', 'Glen Powell', 'Glenn Close', 'Goldie Hawn', 'Gong Li', 'Grace Kelly',
  'Gregory Peck', 'Greta Garbo', 'Greta Gerwig', 'Guillermo del Toro', 'Guy Pearce', 'Guy Ritchie',
  'Gwyneth Paltrow', 'Hailee Steinfeld', 'Halle Berry', 'Harrison Ford', 'Harvey Keitel',
  'Hayao Miyazaki', 'Hayden Christensen', 'Heath Ledger', 'Helen Hunt', 'Helen Mirren',
  'Helena Bonham Carter', 'Henry Cavill', 'Henry Fonda', 'Hilary Swank', 'Holly Hunter',
  'Hugh Bonneville', 'Hugh Dancy', 'Hugh Grant', 'Hugh Jackman', 'Hugh Laurie', 'Humphrey Bogart',
  'Hunter Schafer', 'Ian Holm', 'Ian McKellen', 'Ian McShane', 'Idris Elba', 'Imelda Staunton',
  'Ingmar Bergman', 'Ingrid Bergman', 'Irrfan Khan', 'Isabelle Huppert', 'Isla Fisher',
  'J.K. Simmons', 'Jack Black', 'Jack Lemmon', 'Jack Nicholson', 'Jack Quaid', 'Jackie Chan',
  'Jacob Elordi', 'Jada Pinkett Smith', 'Jade Pettyjohn', 'Jake Gyllenhaal', 'James Caan',
  'James Cameron', 'James Coburn', 'James Cromwell', 'James Dean', 'James Earl Jones',
  'James Franco', 'James Gandolfini', 'James Garner', 'James Gunn', 'James Marsden',
  'James McAvoy', 'James Stewart', 'Jamie Bell', 'Jamie Dornan', 'Jamie Foxx', 'Jamie Lee Curtis',
  'Jane Campion', 'Jane Fonda', 'Jane Lynch', 'Jane Seymour', 'Janet Leigh', 'Jared Harris',
  'Jared Leto', 'Javier Bardem', 'Jason Bateman', 'Jason Clarke', 'Jason Isaacs', 'Jason Momoa',
  'Jason Segel', 'Jason Statham', 'Jason Sudeikis', 'Jean Reno', 'Jean-Claude Van Damme',
  'Jean-Luc Godard', 'Jeff Bridges', 'Jeff Daniels', 'Jeff Goldblum', 'Jeffrey Wright',
  'Jenna Ortega', 'Jennifer Aniston', 'Jennifer Connelly', 'Jennifer Coolidge', 'Jennifer Garner',
  'Jennifer Hudson', 'Jennifer Jason Leigh', 'Jennifer Lawrence', 'Jennifer Lopez', 'Jeremy Allen White',
  'Jeremy Irons', 'Jeremy Renner', 'Jeremy Strong', 'Jerry Lewis', 'Jesse Eisenberg',
  'Jesse Plemons', 'Jessica Alba', 'Jessica Biel', 'Jessica Chastain', 'Jessica Lange',
  'Jet Li', 'Jim Broadbent', 'Jim Carrey', 'Jodie Comer', 'Jodie Foster', 'Joe Pesci',
  'Joel Coen', 'Joey King', 'John Boyega', 'John Candy', 'John Carpenter', 'John Cassavetes',
  'John Cena', 'John Cleese', 'John Cusack', 'John David Washington', 'John Ford', 'John Goodman',
  'John Hurt', 'John Krasinski', 'John Leguizamo', 'John Lithgow', 'John Malkovich',
  'John Singleton', 'John Travolta', 'John Turturro', 'John Wayne', 'Johnny Depp', 'Jon Bernthal',
  'Jon Favreau', 'Jon Hamm', 'Jon Voight', 'Jonah Hill', 'Jonathan Bailey', 'Jonathan Majors',
  'Jonathan Pryce', 'Jordan Peele', 'Joseph Cotten', 'Joseph Gordon-Levitt', 'Josh Brolin',
  'Josh Duhamel', 'Josh Gad', 'Josh Hartnett', 'Josh Hutcherson', 'Jude Law', 'Judi Dench',
  'Judy Garland', 'Julia Garner', 'Julia Louis-Dreyfus', 'Julia Roberts', 'Julianne Moore',
  'Julie Andrews', 'Julie Christie', 'Julie Delpy', 'Juliette Binoche', 'Kaley Cuoco',
  'Karen Gillan', 'Karl Urban', 'Kate Beckinsale', 'Kate Blanchett', 'Kate Hudson', 'Kate Mara',
  'Kate Winslet', 'Katharine Hepburn', 'Katheryn Winnick', 'Kathy Bates', 'Katie Holmes',
  'Keanu Reeves', 'Keira Knightley', 'Ke Huy Quan', 'Keith David', 'Kelly Macdonald',
  'Kelvin Harrison Jr', 'Ken Jeong', 'Ken Watanabe', 'Kenneth Branagh', 'Keri Russell',
  'Kerry Washington', 'Kevin Bacon', 'Kevin Costner', 'Kevin Hart', 'Kevin James', 'Kevin Kline',
  'Kevin Spacey', 'Kiefer Sutherland', 'Kieran Culkin', 'Kim Basinger', 'Kim Novak',
  'Kirsten Dunst', 'Kit Harington', 'Kodi Smit-McPhee', 'Kristen Bell', 'Kristen Stewart',
  'Kristen Wiig', 'Kurt Russell', 'Kyle MacLachlan', 'LaKeith Stanfield', 'Lana Wachowski',
  'Lance Reddick', 'Lars von Trier', 'Laura Dern', 'Laura Linney', 'Laurence Fishburne',
  'Laurence Olivier', 'Lauren Bacall', 'Lea Seydoux', 'Lee Byung-hun', 'Lee Pace',
  'lena Headey', 'Leonardo DiCaprio', 'Leslie Nielsen', 'Letitia Wright', 'Liam Hemsworth',
  'Liam Neeson', 'Lily Collins', 'Lily Gladstone', 'Lily James', 'Lily-Rose Depp',
  'Lin-Manuel Miranda', 'Linda Hamilton', 'Lindsay Lohan', 'Lisa Kudrow', 'Liv Tyler',
  'Liv Ullmann', 'Logan Lerman', 'Lucy Liu', 'Luke Evans', 'Luke Wilson', 'Lupita Nyongo',
  'Macaulay Culkin', 'Mackenzie Davis', 'Mads Mikkelsen', 'Maggie Gyllenhaal', 'Maggie Smith',
  'Mahershala Ali', 'Malcolm McDowell', 'Mandy Patinkin', 'Marcello Mastroianni', 'Margot Robbie',
  'Maria Bakalova', 'Marion Cotillard', ' Marisa Tomei', 'Mark Hamill', 'Mark Ruffalo',
  'Mark Rylance', 'MarkStrong', 'Mark Wahlberg', 'Marlene Dietrich', 'Marlon Brando',
  'Marlon Wayans', 'Martin Freeman', 'Martin Lawrence', 'Martin Scorsese', 'Martin Sheen',
  'Mary Elizabeth Winstead', 'Mary Pickford', 'Matt Damon', 'Matt Dillon', 'Matt LeBlanc',
  'Matt Smith', 'Matthew Broderick', 'Matthew Lillard', 'Matthew Macfadyen', 'Matthew McConaughey',
  'Matthew Perry', 'Maureen OHara', 'Max von Sydow', 'Maya Hawke', 'Maya Rudolph', 'Meg Ryan',
  'Megan Fox', 'Mel Brooks', 'Mel Gibson', 'Melissa McCarthy', 'Meryl Streep', 'Mia Farrow',
  'Mia Goth', 'Michael Bay', 'Michael B. Jordan', 'Michael Caine', 'Michael Cera',
  'Michael Clarke Duncan', 'Michael Douglas', 'Michael Fassbender', 'Michael Gambon',
  'Michael J. Fox', 'Michael Keaton', 'Michael Mann', 'Michael Pena', 'Michael Rooker',
  'Michael Shannon', 'Michael Sheen', 'Michelle Monaghan', 'Michelle Pfeiffer',
  'Michelle Rodriguez', 'Michelle Williams', 'Michelle Yeoh', 'Mickey Rourke', 'Mila Kunis',
  'Miles Teller', 'Millie Bobby Brown', 'Milla Jovovich', 'Milo Ventimiglia', 'Mindy Kaling',
  'Minnie Driver', 'mira Sorvino', 'Miranda Otto', 'Monica Bellucci', 'Montgomery Clift',
  'Morgan Freeman', 'Nadine Labaki', 'Naomi Watts', 'Naomie Harris', 'Natalia Dyer',
  'Natalie Dormer', 'Natalie Portman', 'Natalie Wood', 'Nathan Fillion', 'Nathan Lane',
  'Neil Patrick Harris', 'Nia Long', 'Nicholas Hoult', 'Nick Frost', 'Nick Nolte', 'Nick Offerman',
  'Nicolas Cage', 'Nicole Kidman', 'Noah Baumbach', 'Noah Centineo', 'Noomi Rapace',
  'Norman Reedus', 'Octavia Spencer', 'Oleg Yankovsky', 'Olga Kurylenko', 'Oliver Platt',
  'Oliver Reed', 'Oliver Stone', 'Olivia Colman', 'Olivia Cooke', 'Olivia de Havilland',
  'Olivia Newton-John', 'Olivia Wilde', 'Omar Sy', 'Orlando Bloom', 'Orson Welles', 'Oscar Isaac',
  'Owen Wilson', 'Paddy Considine', 'Pamela Anderson', 'Park Chan-wook', 'Patricia Arquette',
  'Patricia Clarkson', 'Patrick Dempsey', 'Patrick Stewart', 'Patrick Swayze', 'Patrick Wilson',
  'Paul Bettany', 'Paul Dano', 'Paul Giamatti', 'Paul Greengrass', 'Paul Mescal', 'Paul Newman',
  'Paul Rudd', 'Paul Thomas Anderson', 'Paul Verhoeven', 'Paul Walker', 'Pedro Almodovar',
  'Pedro Pascal', 'Penelope Cruz', 'Penn Badgley', 'Peter Capaldi', 'Peter Cushing',
  'Peter Dinklage', 'Peter Falk', 'Peter Jackson', 'Peter Lorre', 'Peter OToole', 'Peter Sellers',
  'Peter Weir', 'Philip Seymour Hoffman', 'Phoebe Waller-Bridge', 'Pierce Brosnan',
  'Quentin Tarantino', 'Queen Latifah', 'Quinta Brunson', 'Rachel McAdams', 'Rachel Weisz',
  'Rachel Zegler', 'Rainn Wilson', 'Ralph Fiennes', 'Ralph Macchio', 'Rami Malek',
  'Randall Park', 'Raquel Welch', 'Ray Liotta', 'Ray Romano', 'Rebecca Ferguson', 'Rebecca Hall',
  'Reese Witherspoon', 'Regina Hall', 'Regina King', 'Renee Zellweger', 'Rhys Ifans',
  'Richard Attenborough', 'Richard Burton', 'Richard Dreyfuss', 'Richard Gere', 'Richard Harris',
  'Richard Linklater', 'Richard Madden', 'Ricky Gervais', 'Ridley Scott', 'Rinko Kikuchi',
  'Rita Hayworth', 'Rita Moreno', 'River Phoenix', 'Riz Ahmed', 'Rob Reiner', 'Rob Lowe',
  'Robert Aldrich', 'Robert Altman', 'Robert Carlyle', 'Robert De Niro', 'Robert Downey Jr',
  'Robert Duvall', 'RobertEggers', 'Robert Mitchum', 'Robert Pattinson', 'Robert Redford',
  'Robert Rodriguez', 'Robert Shaw', 'Robert Zemeckis', 'Robin Williams', 'Robin Wright',
  'Rock Hudson', 'Rod Steiger', 'Roger Moore', 'Roman Polanski', 'Ron Howard', 'Ron Perlman',
  'Rooney Mara', 'Rosamund Pike', 'Rosario Dawson', 'Rose Byrne', 'Rowan Atkinson', 'Roy Scheider',
  'Ruby Dee', 'Rupert Grint', 'Russell Crowe', 'Rutger Hauer', 'Ruth Negga', 'Ryan Coogler',
  'Ryan Gosling', 'Ryan O Neal', 'Ryan Phillippe', 'Ryan Reynolds', 'Sacha Baron Cohen',
  'Sadie Sink', 'Sally Field', 'Sally Hawkins', 'Salma Hayek', 'Sam Claflin', 'Sam Elliott',
  'Sam Mendes', 'Sam Neill', 'Sam Raimi', 'Sam Rockwell', 'Sam Worthington', 'Samuel L. Jackson',
  'Sandra Bullock', 'Sandra Hüller', 'Sandra Oh', 'Saoirse Ronan', 'Sarah Jessica Parker',
  'Sarah Michelle Gellar', 'Sarah Paulson', 'Sarah Snook', 'Scarlett Johansson', 'Scott Eastwood',
  'Scott Glenn', 'Sean Astin', 'Sean Bean', 'Sean Connery', 'Sean Penn', 'Sebastian Stan',
  'Selma Blair', 'Sergio Leone', 'Seth MacFarlane', 'Seth Rogen', 'Shailene Woodley',
  'Sharon Stone', 'Shaun Toub', 'Shia LaBeouf', 'Shirley MacLaine', 'Shirley Temple',
  'Sidney Lumet', 'Sidney Poitier', 'Sienna Miller', 'Sigourney Weaver', 'Simon Pegg',
  'Simone Signoret', 'Sissy Spacek', 'Sofia Coppola', 'Sofia Vergara', 'Song Kang-ho',
  'Sophia Loren', 'Sophie Marceau', 'Sophie Turner', 'Spike Jonze', 'Spike Lee', 'Stan Lee',
  'Stanley Kubrick', 'Stanley Tucci', 'Stellan Skarsgard', 'Stephen Chow', 'Stephen Graham',
  'Steve Buscemi', 'Steve Carell', 'Steve Martin', 'Steve McQueen', 'Steven Spielberg',
  'Steven Yeun', 'Stockard Channing', 'Susan Sarandon', 'Sydney Pollack', 'Sydney Sweeney',
  'Sylvester Stallone', 'Taika Waititi', 'Takeshi Kitano', 'Taron Egerton', 'Taraji P. Henson',
  'Tilda Swinton', 'Tim Allen', 'Tim Burton', 'Tim Curry', 'Tim Robbins', 'Tim Roth',
  'Timothy Dalton', 'Timothy Olyphant', 'Timothy Spall', 'Timothee Chalamet', 'Tina Fey',
  'Tobey Maguire', 'Toby Jones', 'Todd Phillips', 'Tom Cruise', 'Tom Felton', 'Tom Glynn-Carney',
  'Tom Hanks', 'Tom Hardy', 'Tom Hiddleston', 'Tom Holland', 'Tom Hopper', 'Tom Wilkinson',
  'Tommy Lee Jones', 'Toni Collette', 'Tony Chiu-Wai Leung', 'Tony Curtis', 'Tony Scott',
  'Tony Shalhoub', 'Topher Grace', 'Toshiro Mifune', 'Tracee Ellis Ross', 'Trevante Rhodes',
  'Tye Sheridan', 'Tyrese Gibson', 'Udo Kier', 'Uma Thurman', 'Utkarsh Ambudkar', 'Val Kilmer',
  'Vanessa Hudgens', 'Vanessa Kirby', 'Vanessa Redgrave', 'Vera Farmiga', 'Veronica Lake',
  'Viggo Mortensen', 'Vin Diesel', 'Vince Vaughn', 'Vincent Cassel', 'Vincent DOnofrio',
  'Vincent Price', 'Viola Davis', 'Vivien Leigh', 'Walton Goggins', 'Wanda Sykes', 'Warren Beatty',
  'Werner Herzog', 'Wes Anderson', 'Wes Craven', 'Wesley Snipes', 'Whoopi Goldberg',
  'Will Arnett', 'Will Ferrell', 'Will Poulter', 'Will Smith', 'Willem Dafoe', 'William Defoe',
  'William Friedkin', 'William Holden', 'William H. Macy', 'William Hurt', 'William Shatner',
  'William Wyler', 'Winona Ryder', 'Wong Kar-wai', 'Woody Allen', 'Woody Harrelson',
  'Xavi', 'Xavier Dolan', 'Xolo Mariduena', 'Yahya Abdul-Mateen II', 'Yorgos Lanthimos',
  'Yul Brynner', 'Zach Braff', 'Zach Galifianakis', 'Zachary Levi', 'Zachary Quinto',
  'Zack Snyder', 'Zazie Beetz', 'Zendaya', 'Zhang Ziyi', 'Zoe Kravitz', 'Zoe Saldana',
  'Zooey Deschanel',
]);

export const STATIC_MUSICIANS = Object.freeze([
  '50 Cent', 'Aaliyah', 'ABBA', 'AC/DC', 'Adam Lambert', 'Adam Levine', 'Adele', 'Aerosmith',
  'Akon', 'Al Green', 'Alan Jackson', 'Alan Walker', 'Alanis Morissette', 'Alejandro Sanz',
  'Alessia Cara', 'Alex Turner', 'Alice Cooper', 'Alice in Chains', 'Alicia Keys',
  'Alison Krauss', 'Allman Brothers', 'Amy Lee', 'Amy Winehouse', 'Anderson .Paak',
  'Andrea Bocelli', 'Andre 3000', 'Andrew Lloyd Webber', 'Angus Young', 'Anitta', 'Annie Lennox',
  'Anthrax', 'Antonio Vivaldi', 'Aphex Twin', 'Arcade Fire', 'Arctic Monkeys', 'Aretha Franklin',
  'Ariana Grande', 'Armin van Buuren', 'ASAP Rocky', 'Ashanti', 'Avenged Sevenfold', 'Avicii',
  'Avril Lavigne', 'Axl Rose', 'B.B. King', 'Baby Keem', 'Backstreet Boys', 'Bad Bunny',
  'Bad Religion', 'Barbra Streisand', 'Barry Gibb', 'Barry Manilow', 'Barry White',
  'Bastille', 'Beach Boys', 'Beastie Boys', 'Beatles', 'Beabadoobee', 'Bebe Rexha', 'Beck',
  'Bee Gees', 'Beethoven', 'Belinda Carlisle', 'Ben E. King', 'Ben Folds', 'Ben Howard',
  'Benny Blanco', 'Benny Goodman', 'Benson Boone', 'Berry Gordy', 'Bette Midler', 'Beyonce',
  'Big Sean', 'Biggie Smalls', 'Bill Evans', 'Bill Withers', 'Billie Eilish', 'Billie Holiday',
  'Billie Joe Armstrong', 'Billy Corgan', 'Billy Idol', 'Billy Joel', 'Billy Ocean',
  'Billy Ray Cyrus', 'Bing Crosby', 'Bjork', 'Black Eyed Peas', 'Black Sabbath', 'BLACKPINK',
  'Blake Shelton', 'Blink-182', 'Blondie', 'Blur', 'Bo Burnham', 'Bob Dylan', 'Bob Geldof',
  'Bob Marley', 'Bob Seger', 'Bobby Brown', 'Bobby Darin', 'Bobby McFerrin', 'Bon Iver',
  'Bon Jovi', 'Bonnie Raitt', 'Bonnie Tyler', 'Bono', 'Boy George', 'Boyz II Men', 'Brad Paisley',
  'Brandon Flowers', 'Brandy', 'Brendon Urie', 'Brian Eno', 'Brian May', 'Brian Wilson',
  'Bring Me The Horizon', 'Britney Spears', 'Bruce Dickinson', 'Bruce Hornsby',
  'Bruce Springsteen', 'Bruno Mars', 'Bryan Adams', 'Bryan Ferry', 'BTS', 'Buddy Guy',
  'Buddy Holly', 'Burna Boy', 'Busta Rhymes', 'Cage the Elephant', 'Calvin Harris',
  'Camila Cabello', 'Cannibal Corpse', 'Cardi B', 'Carlos Santana', 'Carly Rae Jepsen',
  'Carly Simon', 'Carole King', 'Carrie Underwood', 'Cat Stevens', 'Celine Dion', 'Central Cee',
  'Cesaria Evora', 'Chad Kroeger', 'Chainsmokers', 'Chaka Khan', 'Chance the Rapper',
  'Chappell Roan', 'Charli XCX', 'Charlie Parker', 'Charlie Puth', 'Charlie Watts',
  'Chet Baker', 'Cher', 'Chester Bennington', 'Childish Gambino', 'Chopin', 'Chris Brown',
  'Chris Cornell', 'Chris Isaak', 'Chris Martin', 'Chris Rea', 'Chris Stapleton',
  'Christina Aguilera', 'Christine McVie', 'Christopher Cross', 'Chuck Berry', 'Chvrches',
  'Ciara', 'Clairo', 'Claude Debussy', 'Cliff Richard', 'Cocteau Twins', 'Coldplay',
  'Cole Porter', 'Colin Hay', 'Common', 'Conan Gray', 'Coolio', 'Corey Taylor',
  'Counting Crows', 'Courtney Love', 'Craig David', 'Cranberries', 'Cream',
  'Creedence Clearwater Revival', 'Crosby Stills and Nash', 'Culture Club', 'Curtis Mayfield',
  'Cyndi Lauper', 'Cypress Hill', 'Daft Punk', 'Damon Albarn', 'Dan Reynolds', 'Daniel Caesar',
  'Danny Elfman', 'Darius Rucker', 'Darryl McDaniels', 'Daryl Hall', 'Dave Brubeck',
  'Dave Gahan', 'Dave Grohl', 'Dave Matthews', 'Dave Mustaine', 'David Bowie', 'David Byrne',
  'David Crosby', 'David Gilmour', 'David Guetta', 'David Lee Roth', 'De La Soul', 'Deadmau5',
  'Dean Martin', 'Debbie Harry', 'Debussy', 'Deep Purple', 'Def Leppard', 'Deftones',
  'Delta Goodrem', 'Demi Lovato', 'Denzel Curry', 'Depeche Mode', 'Derek and the Dominos',
  'Destinys Child', 'Diana Krall', 'Diana Ross', 'Dido', 'Dio', 'Dionne Warwick', 'Dire Straits',
  'Disclosure', 'Dizzy Gillespie', 'DJ Khaled', 'DJ Shadow', 'DJ Snake', 'DMX', 'Doja Cat',
  'Dolly Parton', 'Don Henley', 'Don McLean', 'Donald Fagen', 'Donna Summer', 'Donovan',
  'Doobie Brothers', 'Doors', 'Dr. Dre', 'Drake', 'Dream Theater', 'Dua Lipa', 'Duke Ellington',
  'Duran Duran', 'Dusty Springfield', 'Dvorak', 'Dwight Yoakam', 'Eagles', 'Earl Sweatshirt',
  'Earth Wind and Fire', 'Eazy-E', 'Ed O Brien', 'Ed Sheeran', 'Eddie Van Halen', 'Eddie Vedder',
  'Edith Piaf', 'Edward Elgar', 'Electric Light Orchestra', 'Ella Fitzgerald', 'Ellie Goulding',
  'Elliott Smith', 'Elton John', 'Elvis Costello', 'Elvis Presley', 'Eminem', 'Emmylou Harris',
  'empire of the Sun', 'Ennio Morricone', 'Enrique Iglesias', 'Enya', 'Erasure', 'Eric Burdon',
  'Eric Clapton', 'Eric Prydz', 'Erykah Badu', 'Estelle', 'Etta James', 'Eurythmics',
  'Evanescence', 'Eve', 'Ezra Koenig', 'Fabolous', 'Faith Evans', 'Faith Hill', 'Faith No More',
  'Fall Out Boy', 'Fat Joe', 'Fatboy Slim', 'Fats Domino', 'Fela Kuti', 'Fergie', 'Fetty Wap',
  'Fiona Apple', 'Five Finger Death Punch', 'Flaming Lips', 'Flea', 'Fleet Foxes',
  'Fleetwood Mac', 'Flo Rida', 'Florence Welch', 'Florence and the Machine', 'Flying Lotus',
  'Foals', 'Foo Fighters', 'Foreigner', 'Foster the People', 'Four Tops', 'FKA twigs',
  'Frank Black', 'Frank Iero', 'Frank Ocean', 'Frank Sinatra', 'Frank Zappa', 'Frankie Valli',
  'Franz Ferdinand', 'Franz Liszt', 'Franz Schubert', 'Fred Again', 'Fred Durst',
  'Freddie Mercury', 'Fugees', 'Fun.', 'Future', 'G-Eazy', 'Garbage', 'Garth Brooks',
  'Gary Barlow', 'Gary Moore', 'Gary Numan', 'Gavin Rossdale', 'Gene Krupa', 'Gene Simmons',
  'Genesis', 'George Benson', 'George Clinton', 'George Ezra', 'George Gershwin',
  'George Harrison', 'George Michael', 'George Strait', 'Geri Halliwell', 'Ghostface Killah',
  'Gil Scott-Heron', 'Ginuwine', 'Giorgio Moroder', 'Giveon', 'Gladys Knight', 'Glass Animals',
  'Glen Campbell', 'Glenn Frey', 'Glenn Miller', 'Gloria Estefan', 'Gloria Gaynor', 'Gnarls Barkley',
  'Gojira', 'Goldfrapp', 'Goo Goo Dolls', 'Good Charlotte', 'Gorillaz', 'Gotye', 'Grace Jones',
  'Graham Coxon', 'Grandmaster Flash', 'Grateful Dead', 'Green Day', 'Gregg Allman', 'Grimes',
  'Gucci Mane', 'Guns N Roses', 'Gunna', 'Gustavo Dudamel', 'Guy-Manuel de Homem-Christo',
  'Gwen Stefani', 'HAIM', 'Hall and Oates', 'Halsey', 'Hank Williams', 'Hans Zimmer',
  'Hardwell', 'Harry Belafonte', 'Harry Connick Jr', 'Harry Nilsson', 'Harry Styles',
  'Hayley Williams', 'Heart', 'Henry Mancini', 'Herbie Hancock', 'Hilary Duff', 'Hoobastank',
  'Hootie and the Blowfish', 'Howlin Wolf', 'Hozier', 'Huey Lewis', 'Ice Cube', 'Ice Spice',
  'Ice-T', 'Idina Menzel', 'Iggy Azalea', 'Iggy Pop', 'Igor Stravinsky', 'Imagine Dragons',
  'Imogen Heap', 'Incubus', 'Indila', 'Interpol', 'INXS', 'Iron Maiden', 'Iron and Wine',
  'Isaac Hayes', 'Itzhak Perlman', 'IU', 'J Balvin', 'J. Cole', 'Jack Antonoff', 'Jack Harlow',
  'Jack Johnson', 'Jack White', 'Jackie Wilson', 'Jackson 5', 'Jackson Browne', 'Jacques Brel',
  'Jadakiss', 'Jagged Edge', 'Jake Bugg', 'James Arthur', 'James Bay', 'James Blake',
  'James Blunt', 'James Brown', 'James Hetfield', 'James Horner', 'James Taylor', 'Jamie Cullum',
  'Jamie xx', 'Jamiroquai', 'Jane Addiction', 'Janelle Monae', 'Janet Jackson', 'Janis Joplin',
  'Jarvis Cocker', 'Jason Derulo', 'Jason Mraz', 'Jay Sean', 'Jay-Z', 'Jean-Michel Jarre',
  'Jeezy', 'Jeff Beck', 'Jeff Buckley', 'Jeff Lynne', 'Jefferson Airplane', 'Jelly Roll',
  'Jennifer Hudson', 'Jennifer Lopez', 'Jerry Garcia', 'Jerry Lee Lewis', 'Jethro Tull',
  'Jhene Aiko', 'Jim Morrison', 'Jimi Hendrix', 'Jimmy Buffett', 'Jimmy Cliff', 'Jimmy Eat World',
  'Jimmy Page', 'Jisoo', 'Joan Armatrading', 'Joan Baez', 'Joan Jett', 'Joe Bonamassa',
  'Joe Cocker', 'Joe Jonas', 'Joe Perry', 'Joe Satriani', 'Joe Strummer', 'Joe Walsh',
  'Joey Ramone', 'Johann Sebastian Bach', 'Johannes Brahms', 'John Bonham', 'John Cage',
  'John Coltrane', 'John Deacon', 'John Denver', 'John Fogerty', 'John Frusciante',
  'John Lee Hooker', 'John Legend', 'John Lennon', 'John Lydon', 'John Mayer', 'John Mellencamp',
  'John Newman', 'John Oats', 'John Paul Jones', 'John Prine', 'John Williams', 'Johnny Cash',
  'Johnny Marr', 'Johnny Mathis', 'Johnny Ramone', 'Joji', 'Jon Bon Jovi', 'Jonas Brothers',
  'Joni Mitchell', 'Jonny Greenwood', 'Jordin Sparks', 'Jorja Smith', 'Jose Carreras',
  'Josh Groban', 'Josh Homme', 'Joss Stone', 'Journey', 'Joy Division', 'Juanes', 'Judas Priest',
  'Juice WRLD', 'Julian Casablancas', 'Julie London', 'Julio Iglesias', 'Jungkook',
  'Justice', 'Justin Bieber', 'Justin Hawkins', 'Justin Timberlake', 'Justin Vernon',
  'Kacey Musgraves', 'Kali Uchis', 'Kanye West', 'Karol G', 'Kasabian', 'Kate Bush',
  'Katy Perry', 'Kaytranada', 'Keane', 'Kehlani', 'Keith Moon', 'Keith Jarrett', 'Keith Richards',
  'Keith Urban', 'Kelis', 'Kelly Clarkson', 'Kelly Rowland', 'Kendrick Lamar', 'Kenny Chesney',
  'Kenny G', 'Kenny Loggins', 'Kenny Rogers', 'Kesha', 'Kevin Parker', 'Khalid', 'Kid Cudi',
  'Kid Rock', 'Kim Deal', 'Kim Gordon', 'Kim Petras', 'King Crimson', 'King Krule',
  'Kings of Leon', 'Kinks', 'Kirk Hammett', 'Kiss', 'Kodak Black', 'Koffee', 'Kool and the Gang',
  'Korn', 'Kraftwerk', 'Kris Kristofferson', 'Kurt Cobain', 'Kygo', 'Kylie Minogue', 'L.L. Cool J',
  'Labrinth', 'Lady Antebellum', 'Lady Gaga', 'Lamb of God', 'Lana Del Rey', 'Lang Lang',
  'Lars Ulrich', 'Lauv', 'Laura Marling', 'Laura Nyro', 'Lauren Hill', 'Lauryn Hill',
  'Layne Staley', 'LCD Soundsystem', 'LeAnn Rimes', 'Led Zeppelin', 'Lee Scratch Perry',
  'Left Eye', 'Lemmy Kilmister', 'Lenny Kravitz', 'Leonard Bernstein', 'Leonard Cohen',
  'Leona Lewis', 'Leon Bridges', 'Les Paul', 'Lewis Capaldi', 'Liam Gallagher', 'Liam Payne',
  'Lil Baby', 'Lil Durk', 'Lil Jon', 'Lil Kim', 'Lil Nas X', 'Lil Peep', 'Lil Tecca',
  'Lil Uzi Vert', 'Lil Wayne', 'Lil Yachty', 'Lily Allen', 'Limp Bizkit', 'Linda Ronstadt',
  'Lindsey Buckingham', 'Linkin Park', 'Lionel Richie', 'Lisa', 'Lisa Loeb', 'Little Mix',
  'Little Richard', 'Little Simz', 'Lizzo', 'LL Cool J', 'LMFAO', 'Logic', 'London Grammar',
  'Lorde', 'Loretta Lynn', 'Lou Reed', 'Louis Armstrong', 'Louis Tomlinson', 'Luciano Pavarotti',
  'Ludacris', 'Ludovico Einaudi', 'Ludwig van Beethoven', 'Luis Fonsi', 'Luke Bryan',
  'Luke Combs', 'Lykke Li', 'Lynyrd Skynyrd', 'M.I.A.', 'Mac DeMarco', 'Mac Miller', 'Macklemore',
  'Madlib', 'Madness', 'Madonna', 'Maggie Rogers', 'Mahalia', 'Mahalia Jackson', 'Major Lazer',
  'Maluma', 'Mamas and the Papas', 'Maneskin', 'Manic Street Preachers', 'Marc Anthony',
  'Marc Bolan', 'Marcus Mumford', 'Maria Callas', 'Mariah Carey', 'Marilyn Manson',
  'Marina', 'Mario', 'Mark Hoppus', 'Mark Knopfler', 'Mark Lanegan', 'Mark Ronson',
  'Maroon 5', 'Marshmello', 'Martha Argerich', 'Martin Garrix', 'Martina McBride', 'Marvin Gaye',
  'Mary J. Blige', 'Massive Attack', 'Mastodon', 'Matisyahu', 'Matt Bellamy', 'Matt Berninger',
  'Matt Healy', 'Maurice Ravel', 'Max Martin', 'Maxwell', 'Maynard James Keenan', 'Mazzy Star',
  'MC Hammer', 'Meat Loaf', 'Meg White', 'Megadeth', 'Megan Thee Stallion', 'Meghan Trainor',
  'Mel B', 'Mel C', 'Melanie Martinez', 'Melissa Etheridge', 'Memphis Minnie', 'Men at Work',
  'Merle Haggard', 'Metallica', 'Method Man', 'Metro Boomin', 'MF DOOM', 'MGMT', 'Michael Bolton',
  'Michael Buble', 'Michael Hutchence', 'Michael Jackson', 'Michael Kiwanuka', 'Michael McDonald',
  'Michael Stipe', 'Michelle Branch', 'Mick Fleetwood', 'Mick Jagger', 'Mick Jones', 'Mick Mars',
  'Miguel', 'Mika', 'Mike Oldfield', 'Mike Patton', 'Mike Posner', 'Mike Shinoda', 'Miley Cyrus',
  'Miles Davis', 'Minnie Riperton', 'Miranda Lambert', 'Misfits', 'Missy Elliott', 'Mitski',
  'Moby', 'Modern Talking', 'Modest Mouse', 'Mogwai', 'Moliere', 'Moloko', 'Monica',
  'Monsta X', 'Monster Magnet', 'Moody Blues', 'Morgan Wallen', 'Morrissey', 'Mos Def',
  'Motley Crue', 'Motorhead', 'Mötley Crüe', 'Mozart', 'Muddy Waters', 'Mumford and Sons',
  'Muse', 'My Bloody Valentine', 'My Chemical Romance', 'Myles Kennedy', 'N.W.A', 'Nancy Sinatra',
  'Nas', 'Nat King Cole', 'Natasha Bedingfield', 'Nate Dogg', 'Nathaniel Rateliff', 'Ne-Yo',
  'Neil Diamond', 'Neil Finn', 'Neil Peart', 'Neil Tennant', 'Neil Young', 'Nelly',
  'Nelly Furtado', 'Nena', 'Neutral Milk Hotel', 'New Edition', 'New Kids on the Block',
  'New Order', 'Niall Horan', 'Nick Cave', 'Nick Drake', 'Nick Jonas', 'Nick Mason',
  'Nicki Minaj', 'Nickelback', 'Nico', 'Nicole Scherzinger', 'Nightwish', 'Nile Rodgers',
  'Nina Nesbitt', 'Nina Persson', 'Nina Simone', 'Nine Inch Nails', 'Nirvana', 'No Doubt',
  'Noah Kahan', 'Noel Gallagher', 'Noname', 'Norah Jones', 'Norman Cook', 'Notorious B.I.G.',
  'NSYNC', 'Oasis', 'Offset', 'Of Monsters and Men', 'Ol Dirty Bastard', 'Olafur Arnalds',
  'Oliver Tree', 'Olivia Newton-John', 'Olivia Rodrigo', 'Omar Apollo', 'One Direction',
  'OneRepublic', 'Opeth', 'Ornette Coleman', 'Otis Redding', 'OutKast', 'Owl City',
  'Ozuna', 'Ozzy Osbourne', 'P.J. Harvey', 'Paco de Lucia', 'Paloma Faith', 'Panic at the Disco',
  'Pantera', 'Paolo Nutini', 'Papa Roach', 'Paramore', 'Passenger', 'Pat Benatar', 'Pat Metheny',
  'Patti LaBelle', 'Patti Smith', 'Patsy Cline', 'Paul Anka', 'Paul Banks', 'Paul Kalkbrenner',
  'Paul McCartney', 'Paul Oakenfold', 'Paul Simon', 'Paul Stanley', 'Paul van Dyk', 'Paul Weller',
  'Paula Abdul', 'Pavement', 'Pavarotti', 'Peaches', 'Pearl Jam', 'Peggy Lee', 'Pendulum',
  'Pentatonix', 'Per Gessle', 'Percy Sledge', 'Perry Farrell', 'Peso Pluma', 'Pet Shop Boys',
  'Pete Doherty', 'Pete Seeger', 'Pete Townshend', 'Pete Wentz', 'Peter Cetera', 'Peter Frampton',
  'Peter Gabriel', 'Peter Green', 'Peter Hook', 'Peter Tosh', 'Pharrell Williams', 'Phil Anselmo',
  'Phil Collins', 'Phil Lynott', 'Phil Spector', 'Philip Glass', 'Phoebe Bridgers', 'Phoenix',
  'Pink', 'Pink Floyd', 'Pitbull', 'Pixies', 'PJ Harvey', 'Placebo', 'Placido Domingo',
  'Playboi Carti', 'Poison', 'Police', 'Polo G', 'Polyphia', 'Pop Smoke', 'Poppy',
  'Porcupine Tree', 'Porter Robinson', 'Portishead', 'Post Malone', 'Prefabsprout',
  'Primal Scream', 'Primus', 'Prince', 'Prodigy', 'Psy', 'Public Enemy', 'Pulp', 'Pusha T',
  'Pussycat Dolls', 'Pyotr Ilyich Tchaikovsky', 'Q-Tip', 'Quavo', 'Queen', 'Queen Latifah',
  'Queens of the Stone Age', 'Quincy Jones', 'R.E.M.', 'Rachmaninoff', 'Radiohead',
  'Rae Sremmurd', 'Rag n Bone Man', 'Rage Against the Machine', 'Rammstein', 'Ramones',
  'Randy Newman', 'Randy Rhoads', 'Ravel', 'Ray Charles', 'Ray Davies', 'Ray LaMontagne',
  'Ray Manzarek', 'Raye', 'Razorlight', 'Red Hot Chili Peppers', 'Red Velvet', 'Regina Spektor',
  'Rema', 'Rene Fleming', 'Rex Orange County', 'Richard Ashcroft', 'Richard Clayderman',
  'Richard Marx', 'Richard Strauss', 'Richard Wagner', 'Richard Wright', 'Richie Sambora',
  'Rick Astley', 'Rick James', 'Rick Ross', 'Rick Rubin', 'Rick Wakeman', 'Ricky Martin',
  'Rihanna', 'Rina Sawayama', 'Ringo Starr', 'Rise Against', 'Rita Ora', 'Ritchie Blackmore',
  'Ritchie Valens', 'Rivers Cuomo', 'Rob Halford', 'Rob Thomas', 'Rob Zombie', 'Robbie Robertson',
  'Robbie Williams', 'Robert Fripp', 'Robert Johnson', 'Robert Palmer', 'Robert Plant',
  'Robert Schumann', 'Robert Smith', 'Roberta Flack', 'Robin Gibb', 'Robin Thicke', 'Robyn',
  'Rod Stewart', 'Roddy Ricch', 'Rodrigo y Gabriela', 'Roger Daltrey', 'Roger Taylor',
  'Roger Waters', 'Rolling Stones', 'Ronan Keating', 'Ronnie Spector', 'Ronnie Van Zant',
  'Ronnie Wood', 'Rory Gallagher', 'Rosalia', 'Rose', 'Rosanne Cash', 'Rostropovich',
  'Roxette', 'Roxy Music', 'Roy Ayers', 'Roy Hargrove', 'Roy Orbison', 'Royal Blood',
  'Rozalla', 'Run the Jewels', 'Run-DMC', 'RuPaul', 'Rush', 'RZA', 'S Club 7', 'Sabaton',
  'Sabrina Carpenter', 'Sade', 'Saint-Saens', 'Salt-N-Pepa', 'Sam Cooke', 'Sam Fender',
  'Sam Hunt', 'Sam Smith', 'Sammy Davis Jr', 'Sammy Hagar', 'Santana', 'Santigold',
  'Sara Bareilles', 'Sarah Brightman', 'Sarah McLachlan', 'Satie', 'Savage Garden', 'Saweetie',
  'ScHoolboy Q', 'Scissor Sisters', 'Scooter', 'Scorpions', 'Scott Joplin', 'Scott Stapp',
  'Scott Weiland', 'Seal', 'Sean Kingston', 'Sean Paul', 'Sebastian Bach', 'Seether',
  'Selena', 'Selena Gomez', 'Sepultura', 'Serge Gainsbourg', 'Sergei Prokofiev',
  'Sergei Rachmaninoff', 'Serj Tankian', 'Sex Pistols', 'Shabba Ranks', 'Shaggy', 'Shakira',
  'Shania Twain', 'Shane MacGowan', 'Sharon Van Etten', 'Shawn Mendes', 'Sheena Easton',
  'Sheila E.', 'Sheryl Crow', 'Shinedown', 'Shania Twain', 'Sia', 'Sid Vicious', 'Sigrid',
  'Sigur Ros', 'Silk Sonic', 'Silverchair', 'Simon Le Bon', 'Simon and Garfunkel', 'Simple Minds',
  'Simple Plan', 'Simply Red', 'Sinatra', 'Sinead O Connor', 'Siouxsie Sioux',
  'Siouxsie and the Banshees', 'Sir Mix-a-Lot', 'Sister Sledge', 'SZA', 'Skepta', 'Skillet',
  'Skrillex', 'Slash', 'Slayer', 'Sleater-Kinney', 'Slick Rick', 'Slipknot', 'Slowdive',
  'Sly Stone', 'Sly and the Family Stone', 'Smash Mouth', 'Smashing Pumpkins', 'Smino',
  'Smiths', 'Smokey Robinson', 'Snoop Dogg', 'Snow Patrol', 'Soft Cell', 'Solange',
  'Solomon Burke', 'Sonic Youth', 'Sonny Bono', 'Sonny Rollins', 'Sophie Ellis-Bextor',
  'Soulja Boy', 'Soundgarden', 'Spandau Ballet', 'Spice Girls', 'St. Vincent', 'Staind',
  'Stan Getz', 'Status Quo', 'Steely Dan', 'Stefflon Don', 'Stephen Malkmus', 'Stephen Sondheim',
  'Stephen Stills', 'Steppenwolf', 'Stereolab', 'Stereophonics', 'Steve Aoki', 'Steve Earle',
  'Steve Hackett', 'Steve Harris', 'Steve Lacy', 'Steve Lukather', 'Steve Miller',
  'Steve Perry', 'Steve Reich', 'Steve Vai', 'Steve Winwood', 'Steven Tyler', 'Stevie Nicks',
  'Stevie Ray Vaughan', 'Stevie Wonder', 'Sting', 'Stone Roses', 'Stone Temple Pilots',
  'Stormzy', 'Stravinsky', 'Stray Kids', 'Stromae', 'Strokes', 'Sturgill Simpson', 'Styx',
  'Sublime', 'Suede', 'Sufjan Stevens', 'Sugababes', 'Sugarhill Gang', 'Sum 41', 'Summer Walker',
  'Sun Ra', 'Supergrass', 'Supertramp', 'Supremes', 'Survivor', 'Susan Boyle', 'Suzanne Vega',
  'Suzi Quatro', 'Swae Lee', 'Swedish House Mafia', 'System of a Down', 'T-Bone Walker',
  'T-Pain', 'T.I.', 'T. Rex', 'Taio Cruz', 'Take That', 'Takeoff', 'Talib Kweli', 'Talk Talk',
  'Talking Heads', 'Tammi Terrell', 'Tame Impala', 'Tanita Tikaram', 'Tate McRae', 'Taylor Hawkins',
  'Taylor Momsen', 'Taylor Swift', 'Tchaikovsky', 'Tears for Fears', 'Technotronic',
  'Ted Nugent', 'Teddy Pendergrass', 'Teddy Swims', 'Tegan and Sara', 'Telemann', 'Tems',
  'Temptations', 'Tenacious D', 'Terence Trent DArby', 'Texas', 'Thaiboy Digital', 'The 1975',
  'The Animals', 'The B-52s', 'TheBand', 'The Beach Boys', 'The Beatles', 'The Black Keys',
  'The Byrds', 'The Calling', 'The Cardigans', 'The Carpenters', 'The Chainsmokers',
  'The Charlatans', 'The Chemical Brothers', 'The Clash', 'The Corrs', 'The Cranberries',
  'The Cult', 'The Cure', 'The Darkness', 'The Doors', 'The Drifters', 'The Everly Brothers',
  'The Flaming Lips', 'The Fray', 'The Game', 'TheGo-Gos', 'The Hollies', 'The Human League',
  'The Isley Brothers', 'The Jam', 'The Jesus and Mary Chain', 'The Kid LAROI', 'The Killers',
  'The Kinks', 'The Libertines', 'The Lumineers', 'The Mamas and the Papas', 'The Mars Volta',
  'The Monkees', 'The Moody Blues', 'The National', 'The Neighbourhood', 'The Notorious B.I.G.',
  'The Offspring', 'The Police', 'The Postal Service', 'The Pretenders', 'The Prodigy',
  'The Psychedelic Furs', 'The Raconteurs', 'The Ramones', 'The Replacements', 'The Righteous Brothers',
  'The Rolling Stones', 'The Roots', 'The Runaways', 'The Script', 'The Shadows', 'The Shangri-Las',
  'The Shins', 'The Sisters of Mercy', 'The Smashing Pumpkins', 'The Smiths', 'The Specials',
  'The Stone Roses', 'The Stooges', 'The Stranglers', 'The Streets', 'The Strokes', 'The Supremes',
  'The Temptations', 'The Ting Tings', 'The Tragically Hip', 'The Turtles', 'The Velvet Underground',
  'The Verve', 'The Vines', 'The Walkmen', 'The War on Drugs', 'The Waterboys', 'The Weeknd',
  'The White Stripes', 'The Who', 'The Wombats', 'The xx', 'The Yardbirds', 'The Zombies',
  'Thelonious Monk', 'Them Crooked Vultures', 'Thin Lizzy', 'Third Eye Blind', 'Thirty Seconds to Mars',
  'Thom Yorke', 'Thomas Bangalter', 'Thomas Newman', 'Thomas Rhett', 'Three Days Grace',
  'Three Dog Night', 'Three 6 Mafia', 'Thrice', 'Thundercat', 'Tiesto', 'Tierra Whack',
  'Tinashe', 'Tim Bergling', 'Tim McGraw', 'Timbaland', 'Tina Charles', 'Tina Turner', 'Tinie Tempah',
  'Tito Puente', 'TLC', 'Toby Keith', 'Todd Rundgren', 'Tom Chaplin', 'Tom DeLonge', 'Tom Jones',
  'Tom Morello', 'Tom Odell', 'Tom Petty', 'Tom Waits', 'Tom Yorke', 'Tommy Dorsey', 'Tommy James',
  'Tommy Lee', 'Toni Braxton', 'Tony Bennett', 'Tony Hadley', 'Tony Iommi', 'Tool', 'Toots Hibbert',
  'Tori Amos', 'Tori Kelly', 'Toto', 'Tove Lo', 'Townes Van Zandt', 'Trace Adkins', 'Tracy Chapman',
  'Train', 'Travis', 'Travis Barker', 'Travis Scott', 'Trent Reznor', 'Trey Anastasio',
  'Trey Songz', 'Tribe Called Quest', 'Tricky', 'Trisha Yearwood', 'Trivium', 'Troye Sivan',
  'Tupac Shakur', 'Turnstile', 'TV on the Radio', 'Twenty One Pilots', 'Twista', 'Twisted Sister',
  'Two Door Cinema Club', 'Ty Dolla Sign', 'Tyga', 'Tyler Childers', 'Tyler Joseph',
  'Tyler the Creator', 'Type O Negative', 'U2', 'UB40', 'Ultravox', 'Umberto Tozzi', 'Underworld',
  'Uriah Heep', 'Usher', 'utada Hikaru', 'Vampire Weekend', 'Van Halen', 'Van Morrison',
  'Vanessa Carlton', 'Vanessa Mae', 'Vanessa Paradis', 'Vangelis', 'Vanilla Ice',
  'Vaughan Williams', 'Velvet Revolver', 'Velvet Underground', 'Vengaboys', 'Verdi', 'Verve',
  'Vic Mensa', 'Vicente Fernandez', 'Victoria Beckham', 'Viktor Tsoi', 'Village People',
  'Vince Clarke', 'Vince Gill', 'Vince Neil', 'Vince Staples', 'Violent Femmes', 'Vivaldi',
  'Volbeat', 'Vulfpeck', 'W.A.S.P.', 'Wagner', 'Wale', 'Walk the Moon', 'Wallows', 'Wanda Jackson',
  'Wang Chung', 'War', 'Warren G', 'Warren Zevon', 'Washed Out', 'Waylon Jennings', 'Wayne Coyne',
  'Wayne Shorter', 'Ween', 'Weezer', 'Weird Al Yankovic', 'Wet Leg', 'Westlife', 'Wham!',
  'White Lies', 'White Stripes', 'White Zombie', 'Whitesnake', 'Whitney Houston', 'Who',
  'Wilco', 'Wild Beasts', 'Will.i.am', 'Will Smith', 'William Orbit', 'Willie Colon',
  'Willie Dixon', 'Willie Nelson', 'Willow Smith', 'Wilson Pickett', 'Wings', 'Win Butler',
  'Within Temptation', 'Wiz Khalifa', 'Wizkid', 'Wolf Alice', 'Wolfgang Amadeus Mozart',
  'Wolfmother', 'Wombats', 'Woody Guthrie', 'Wu-Tang Clan', 'Wyclef Jean', 'Wynonna Judd',
  'X Ambassadors', 'X-Ray Spex', 'Xavier Cugat', 'XJapan', 'XTC', 'XXXTentacion', 'Yanni',
  'Yardbirds', 'Yaz', 'Yazoo', 'Yeah Yeah Yeahs', 'Years and Years', 'Yeat', 'Yellowcard',
  'Yes', 'YG', 'Yngwie Malmsteen', 'Yo La Tengo', 'Yo-Yo Ma', 'Yoko Ono', 'Yolanda Adams',
  'Young Jeezy', 'Young Thug', 'YoungBoy Never Broke Again', 'Yungblud', 'Yusuf Islam',
  'Zac Brown Band', 'Zach Bryan', 'Zack de la Rocha', 'Zara Larsson', 'Zayn', 'Zayn Malik',
  'Zedd', 'Zero 7', 'Ziggy Marley', 'Zola Jesus', 'Zombies', 'Zucchero', 'Zwan', 'ZZ Top',
]);

function buildPersonEntry(name, extraAlternatives = []) {
  const clean = String(name ?? '').trim();
  const alts = new Set(extraAlternatives.map((a) => String(a ?? '').trim()).filter(Boolean));
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    const surname = parts[parts.length - 1];
    if (surname.length >= 3 && !/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(surname)) {
      alts.add(surname);
    }
  }
  return { label: clean, alternatives: [...alts] };
}

function mergePersonEntries(baseNames = [], peopleSubset = []) {
  const map = new Map();
  for (const name of baseNames) {
    const entry = buildPersonEntry(name);
    const k = compactKey(entry.label);
    if (k && !map.has(k)) map.set(k, entry);
  }
  for (const p of peopleSubset) {
    const entry = buildPersonEntry(p.name, p.alternatives ?? []);
    const k = compactKey(entry.label);
    if (!k) continue;
    const prev = map.get(k);
    if (prev) {
      const mergedAlts = new Set([...(prev.alternatives ?? []), ...(entry.alternatives ?? [])]);
      prev.alternatives = [...mergedAlts];
    } else {
      map.set(k, entry);
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

const LEARNED_WORDS_STORAGE_KEY = 'learninghub.v2.learnedWords';
const globalLearnedWords = [];

function readLocalLearnedWords() {
  try {
    const raw = globalThis.localStorage?.getItem?.(LEARNED_WORDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed?.data)
      ? parsed.data
      : Array.isArray(parsed)
        ? parsed
        : [];
    return list.filter((w) => w && typeof w.categoryId === 'string' && typeof w.label === 'string');
  } catch {
    return [];
  }
}

function writeLocalLearnedWords(list) {
  try {
    globalThis.localStorage?.setItem?.(
      LEARNED_WORDS_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, data: list }),
    );
  } catch {
    /* ignore */
  }
}

export function applyLearnedWordToCategories(categoriesMap, wordRecord) {
  if (!categoriesMap || !wordRecord?.categoryId || !wordRecord?.label) return false;
  const cat = categoriesMap[wordRecord.categoryId];
  if (!cat || !Array.isArray(cat.items)) return false;
  const k = compactKey(wordRecord.label);
  if (!k) return false;
  const exists = cat.items.some((item) => {
    const lbl = typeof item === 'string' ? item : item?.label;
    return compactKey(lbl) === k;
  });
  if (exists) return false;
  cat.items.push({
    label: wordRecord.label,
    alternatives: Array.isArray(wordRecord.alternatives) ? wordRecord.alternatives : [],
  });
  return true;
}

export function registerLearnedWord(categoriesMap, { categoryId, label, alternatives = [], sync = true, fetchImpl = globalThis.fetch }) {
  if (!categoryId || !label) return null;
  const cleanLabel = String(label).trim();
  const cleanCat = String(categoryId).trim().toLowerCase();
  if (!cleanLabel || !cleanCat) return null;

  const record = {
    categoryId: cleanCat,
    label: cleanLabel,
    alternatives: Array.isArray(alternatives)
      ? alternatives.map((a) => String(a ?? '').trim()).filter((a) => a && a.toLowerCase() !== cleanLabel.toLowerCase())
      : [],
  };

  applyLearnedWordToCategories(categoriesMap, record);
  const CROSS_CATEGORY_PAIRS = [
    ['athletes', 'sport'],
    ['musicians', 'music'],
    ['actors', 'movies'],
  ];
  for (const [catA, catB] of CROSS_CATEGORY_PAIRS) {
    if (cleanCat === catA && categoriesMap?.[catB]) {
      applyLearnedWordToCategories(categoriesMap, { ...record, categoryId: catB });
    } else if (cleanCat === catB && categoriesMap?.[catA]) {
      applyLearnedWordToCategories(categoriesMap, { ...record, categoryId: catA });
    }
  }

  const key = `${cleanCat}|${compactKey(cleanLabel)}`;
  const stored = [...readLocalLearnedWords(), ...globalLearnedWords];
  const map = new Map();
  for (const item of [...stored, record]) {
    const ik = `${item.categoryId}|${compactKey(item.label)}`;
    if (!map.has(ik)) map.set(ik, item);
  }
  const merged = [...map.values()];
  globalLearnedWords.length = 0;
  globalLearnedWords.push(...merged);
  writeLocalLearnedWords(merged);

  if (sync && typeof fetchImpl === 'function') {
    fetchImpl('/api/leaderboard', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ learnedWord: record }),
    })
      .then((r) => (r?.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.learnedWords)) {
          for (const w of data.learnedWords) {
            applyLearnedWordToCategories(categoriesMap, w);
          }
        }
      })
      .catch(() => {});
  }

  return record;
}

/**
 * Build the complete map of categories, combining static categories with
 * dynamic datasets from Geography (countries, capitals) and People (actors, musicians, athletes, all people),
 * plus any persisted learned words from storage or server.
 */
export function buildWordRushCategories({ countries = [], people = [] } = {}) {
  const categories = {};

  for (const [id, def] of Object.entries(STATIC_CATEGORIES)) {
    categories[id] = {
      id,
      label: def.label,
      group: def.group,
      items: def.items.map((label) => buildPersonEntry(label)),
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

  const actors = people.filter((p) => p.category === 'film');
  const musicians = people.filter((p) => p.category === 'music');
  const athletes = people.filter((p) => p.category === 'sport');

  const mergedActors = mergePersonEntries(STATIC_ACTORS, actors);
  const mergedMusicians = mergePersonEntries(STATIC_MUSICIANS, musicians);
  const mergedAthletes = mergePersonEntries(STATIC_ATHLETES, athletes);

  categories.actors = {
    id: 'actors',
    label: 'Actors & Filmmakers',
    group: 'Movies',
    items: mergedActors,
  };

  categories.musicians = {
    id: 'musicians',
    label: 'Musicians & Singers',
    group: 'Music',
    items: mergedMusicians,
  };

  categories.athletes = {
    id: 'athletes',
    label: 'Famous Athletes',
    group: 'Sport',
    items: mergedAthletes,
  };

  if (categories.music) {
    categories.music.items = mergePersonEntries(STATIC_CATEGORIES.music.items, [
      ...musicians,
      ...STATIC_MUSICIANS.map((name) => ({ name })),
    ]);
  }
  if (categories.sport) {
    categories.sport.items = mergePersonEntries(STATIC_CATEGORIES.sport.items, [
      ...athletes,
      ...STATIC_ATHLETES.map((name) => ({ name })),
    ]);
  }
  if (categories.movies) {
    categories.movies.items = mergePersonEntries(STATIC_CATEGORIES.movies.items, [
      ...actors,
      ...STATIC_ACTORS.map((name) => ({ name })),
    ]);
  }

  // Apply any locally stored or in-memory learned words so they are immediately in the fasit
  for (const learned of [...readLocalLearnedWords(), ...globalLearnedWords]) {
    applyLearnedWordToCategories(categories, learned);
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

/**
 * Keywords per category group / category ID used by the live public-API word verifier
 * when a player types a valid word that isn't yet in our local static list.
 */
const CATEGORY_VERIFY_KEYWORDS = Object.freeze({
  food: [
    'food', 'dish', 'cuisine', 'fruit', 'vegetable', 'meat', 'cheese', 'bread', 'pastry',
    'dessert', 'ingredient', 'sauce', 'soup', 'snack', 'beverage', 'drink', 'spice', 'herb',
    'meal', 'seafood', 'fish', 'pasta', 'noodle', 'cake', 'pie', 'cookie', 'candy', 'sausage',
    'sandwich', 'salad', 'stew', 'curry', 'baked', 'fried', 'edible', 'culinary', 'cooking',
    'condiment', 'grain', 'cereal', 'nut', 'legume', 'mushroom', 'delicacy', 'confectionery',
    'cocktail', 'wine', 'beer', 'tea', 'coffee', 'dairy', 'yogurt', 'ice cream', 'pudding',
  ],
  sport: [
    'sport', 'athletic', 'athlete', 'olympic', 'ball game', 'martial art', 'racing', 'competition',
    'exercise', 'gymnastics', 'skating', 'skiing', 'swimming', 'wrestling', 'tournament',
    'boxer', 'boxing', 'heavyweight', 'middleweight', 'welterweight', 'lightweight', 'featherweight',
    'ufc', 'mixed martial artist', 'mma', 'kickboxer', 'judo', 'karate', 'taekwondo', 'fencer',
    'footballer', 'soccer player', 'basketball player', 'nba', 'nfl', 'mlb', 'nhl', 'quarterback',
    'wide receiver', 'running back', 'linebacker', 'baseball player', 'pitcher', 'outfielder',
    'ice hockey', 'tennis player', 'grand slam', 'wimbledon', 'golfer', 'pga', 'cricketer',
    'rugby', 'sprinter', 'marathon', 'decathlon', 'track and field', 'runner', 'hurdler',
    'jumper', 'thrower', 'cyclist', 'tour de france', 'formula one', 'racing driver', 'nascar',
    'motogp', 'rally driver', 'swimmer', 'diver', 'rower', 'sailor', 'weightlifter', 'powerlifter',
    'bodybuilder', 'snooker', 'darts', 'chess grandmaster', 'skateboarder', 'surfer', 'snowboarder',
    'biathlete', 'cross-country skier', 'alpine skier', 'figure skater', 'speed skater',
    'handball player', 'volleyball player', 'badminton player', 'table tennis', 'water polo',
    'equestrian', 'jockey', 'triathlete', 'world champion', 'gold medalist', 'olympian',
  ],
  gaming: [
    'video game', 'computer game', 'arcade game', 'playstation', 'xbox', 'nintendo', 'pc game',
    'multiplayer', 'role-playing game', 'first-person shooter', 'franchise', 'esports',
    'action-adventure game', 'platform game', 'platformer', 'strategy game', 'simulation game',
    'fighting game', 'racing game', 'puzzle game', 'survival horror', 'sandbox game', 'roguelike',
    'metroidvania', 'visual novel', 'mobile game', 'indie game', 'mmorpg', 'battle royale',
    'game developer', 'published by', 'gameplay', 'expansion pack', 'dlc', 'steam', 'game boy',
    'sega', 'atari', 'capcom', 'konami', 'ubisoft', 'activision', 'electronic arts', 'square enix',
    'bandai namco', 'bethesda', 'fromsoftware', 'valve', 'blizzard', 'riot games', 'epic games',
  ],
  'fortnite-weapons': [
    'fortnite', 'battle royale', 'epic games', 'weapon', 'shotgun', 'rifle', 'smg', 'sniper',
    'pistol', 'explosive', 'consumable', 'shield potion', 'chug', 'slurp', 'mythic', 'exotic',
    'harvesting tool', 'pickaxe', 'back bling', 'glider', 'emote', 'tilted towers', 'jonesy',
    'peely', 'loot llama', 'battle bus', 'v-bucks', 'save the world', 'chapter',
  ],
  'rockstar-games': [
    'grand theft auto', 'gta', 'red dead', 'rockstar games', 'rockstar north', 'bully',
    'max payne', 'l.a. noire', 'manhunt', 'midnight club', 'vice city', 'san andreas',
    'liberty city', 'los santos', 'arthur morgan', 'john marston', 'trevor philips',
    'michael de santa', 'franklin clinton', 'cj', 'carl johnson', 'tommy vercetti', 'niko bellic',
    'dutch van der linde', 'dan houser', 'sam houser',
  ],
  music: [
    'music', 'musician', 'singer', 'band', 'songwriter', 'rapper', 'composer', 'instrument',
    'musical genre', 'album', 'orchestra', 'rock band', 'pop', 'hip hop', 'jazz', 'vocalist',
    'guitarist', 'drummer', 'bassist', 'pianist', 'violinist', 'cellist', 'conductor', 'dj',
    'record producer', 'discography', 'single by', 'song by', 'studio album', 'ep by',
    'symphony', 'concerto', 'opera', 'sonata', 'grammy', 'billboard', 'punk rock', 'heavy metal',
    'country music', 'r&b', 'soul music', 'electronic music', 'folk music', 'blues', 'reggae',
    'classical music', 'boy band', 'girl group', 'supergroup', 'musical duo',
  ],
  movies: [
    'film', 'movie', 'cinema', 'animated film', 'motion picture', 'directed by', 'starring',
    'box office', 'screenplay', 'thriller', 'comedy film', 'drama film', 'action film',
    'horror film', 'science fiction film', 'fantasy film', 'documentary film', 'romantic comedy',
    'crime film', 'western film', 'biographical film', 'musical film', 'mystery film',
    'adventure film', 'war film', 'noir', 'sequel', 'prequel', 'trilogy', 'academy award',
    'oscar', 'cannes', 'sundance', 'pixar', 'disney', 'dreamworks', 'studio ghibli', 'marvel',
    'dc comics', 'feature film', 'short film', 'miniseries', 'television series',
  ],
  actors: [
    'actor', 'actress', 'filmmaker', 'director', 'screenwriter', 'starring', 'cinema',
    'film director', 'television actor', 'stage actor', 'voice actor', 'comedian', 'producer',
    'academy award', 'golden globe', 'emmy', 'bafta', 'hollywood', 'broadway', 'filmography',
  ],
  musicians: [
    'singer', 'musician', 'rapper', 'songwriter', 'composer', 'vocalist', 'guitarist',
    'band', 'rock band', 'pop group', 'hip hop', 'record producer', 'dj', 'drummer', 'bassist',
    'pianist', 'multi-instrumentalist', 'frontman', 'lead vocalist', 'solo artist', 'grammy',
  ],
  athletes: [
    'player', 'athlete', 'olympic', 'footballer', 'basketball', 'tennis', 'champion', 'sprinter',
    'boxer', 'boxing', 'heavyweight', 'middleweight', 'welterweight', 'lightweight', 'ufc',
    'mixed martial artist', 'mma', 'wrestler', 'golfer', 'cricketer', 'rugby', 'swimmer',
    'cyclist', 'racing driver', 'formula one', 'nascar', 'motogp', 'marathon', 'track and field',
    'decathlete', 'gymnast', 'skier', 'skater', 'snowboarder', 'surfer', 'skateboarder',
    'weightlifter', 'biathlete', 'rower', 'quarterback', 'wide receiver', 'running back',
    'pitcher', 'ice hockey', 'nhl', 'nba', 'nfl', 'mlb', 'world cup', 'ballon d\'or',
    'grand slam', 'gold medalist', 'olympian', 'world record', 'chess grandmaster', 'darts', 'snooker',
  ],
  countries: ['country', 'sovereign state', 'nation', 'republic', 'kingdom', 'principality', 'emirate', 'commonwealth'],
  capitals: ['capital city', 'capital of', 'largest city', 'municipality', 'seat of government', 'national capital'],
});

const liveVerifiedCache = new Map();

function matchesCandidateTitle(candidateTitle, cleanedInput, reqLetter, strictFirstLetter = false) {
  if (!candidateTitle) return false;
  const cleanTitle = String(candidateTitle).replace(/\s*\([^)]*\)\s*$/, '').trim();
  const normTitle = normaliseText(cleanTitle);
  const normInput = normaliseText(cleanedInput);
  if (!normTitle || !normInput) return false;

  const titleKey = compactKey(cleanTitle);
  const inputKey = compactKey(cleanedInput);
  if (!titleKey || !inputKey) return false;

  // Check if the candidate starts with the required letter (either full title or surname when allowed)
  const titleParts = normTitle.split(' ').filter(Boolean);
  const lastPart = titleParts.length > 1 ? titleParts[titleParts.length - 1] : '';
  const startsWithReq =
    !reqLetter ||
    normTitle.charAt(0) === reqLetter ||
    (!strictFirstLetter && lastPart && lastPart.charAt(0) === reqLetter);
  if (!startsWithReq) return false;

  // Exact compact match
  if (titleKey === inputKey) return true;

  // Match without leading "The " / "A "
  const strippedTitleKey = compactKey(cleanTitle.replace(/^(the|a|an)\s+/i, ''));
  if (strippedTitleKey && strippedTitleKey === inputKey) return true;

  // Match if user typed surname of a person whose surname starts with reqLetter
  if (
    !strictFirstLetter &&
    lastPart &&
    compactKey(lastPart) === inputKey &&
    (!reqLetter || lastPart.charAt(0) === reqLetter)
  ) {
    return true;
  }

  // Or if title contains the exact input words as a prefix/suffix
  if (normTitle.startsWith(normInput) || normInput.startsWith(normTitle)) {
    const minLen = Math.min(titleKey.length, inputKey.length);
    const maxLen = Math.max(titleKey.length, inputKey.length);
    if (minLen >= 4 && minLen / maxLen >= 0.65) return true;
  }

  return false;
}

function inputMatchesLetterRule(norm, reqLetter, strictFirstLetter = false) {
  if (!reqLetter) return true;
  if (norm.charAt(0) === reqLetter) return true;
  if (strictFirstLetter) return false;
  const parts = norm.split(' ').filter(Boolean);
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.charAt(0) === reqLetter) return true;
  }
  return false;
}

/**
 * Live engine word verifier: if a player submits a word that starts with the
 * required letter and is not yet in our local static list, query public APIs
 * (TheMealDB for food, iTunes Search API for music/musicians, Datamuse dictionary,
 * Wikidata Entity Search, and Wikipedia REST + Search APIs) to verify whether it is a genuine entry.
 *
 * @param {{ word: string, letter: string, categoryId: string, categoryGroup?: string, strictFirstLetter?: boolean, fetchImpl?: typeof fetch }} opts
 * @returns {Promise<{ approved: boolean, canonicalLabel?: string }>}
 */
export async function verifyWordRushCandidateOnline({
  word,
  letter,
  categoryId,
  categoryGroup = '',
  strictFirstLetter = false,
  fetchImpl = globalThis.fetch,
}) {
  const cleaned = String(word ?? '').trim().replace(/\s+/g, ' ');
  const norm = normaliseText(cleaned);
  const reqLetter = normaliseText(letter).charAt(0);

  if (!norm || norm.length < 2 || !inputMatchesLetterRule(norm, reqLetter, strictFirstLetter)) {
    return { approved: false };
  }
  if (typeof fetchImpl !== 'function') {
    return { approved: false };
  }

  const cacheKey = `${categoryId}:${reqLetter}:${strictFirstLetter ? 'strict' : 'flex'}:${compactKey(cleaned)}`;
  if (liveVerifiedCache.has(cacheKey)) {
    return liveVerifiedCache.get(cacheKey);
  }

  const titleCase = cleaned
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');

  const keywords =
    CATEGORY_VERIFY_KEYWORDS[categoryId] ??
    CATEGORY_VERIFY_KEYWORDS[String(categoryGroup).toLowerCase()] ??
    null;
  if (!keywords || keywords.length === 0) {
    return { approved: false };
  }

  const textMatchesCategory = (text) => {
    if (!text) return false;
    const lower = String(text).toLowerCase();
    return keywords.some((kw) => lower.includes(kw));
  };

  const pickCanonicalLabel = (candidateLabel) => {
    const cleanCandidate = String(candidateLabel || titleCase).replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (!cleanCandidate) return titleCase;
    const candNorm = normaliseText(cleanCandidate);
    if (inputMatchesLetterRule(candNorm, reqLetter, strictFirstLetter)) {
      return cleanCandidate;
    }
    return titleCase;
  };

  try {
    // 1. For Food category, check TheMealDB public API first (meals & ingredients)
    if (categoryId === 'food' || String(categoryGroup).toLowerCase() === 'food') {
      try {
        const mealRes = await fetchImpl(
          `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(cleaned)}`,
        );
        if (mealRes.ok) {
          const mealData = await mealRes.json();
          if (Array.isArray(mealData?.meals) && mealData.meals.length > 0) {
            const matchMeal = mealData.meals.find((m) =>
              inputMatchesLetterRule(normaliseText(m.strMeal), reqLetter, strictFirstLetter),
            );
            if (matchMeal) {
              const result = { approved: true, canonicalLabel: matchMeal.strMeal || titleCase };
              liveVerifiedCache.set(cacheKey, result);
              return result;
            }
          }
        }
      } catch {
        // Continue to next source
      }
    }

    // 1b. For Music / Musicians, check iTunes Search API for verified music artists
    if (
      categoryId === 'music' ||
      categoryId === 'musicians' ||
      String(categoryGroup).toLowerCase() === 'music'
    ) {
      try {
        const itunesRes = await fetchImpl(
          `https://itunes.apple.com/search?term=${encodeURIComponent(cleaned)}&entity=musicArtist&limit=5`,
        );
        if (itunesRes.ok) {
          const itunesData = await itunesRes.json();
          if (Array.isArray(itunesData?.results)) {
            for (const artist of itunesData.results) {
              const artistName = artist?.artistName ?? '';
              if (matchesCandidateTitle(artistName, cleaned, reqLetter, strictFirstLetter)) {
                const result = { approved: true, canonicalLabel: pickCanonicalLabel(artistName) };
                liveVerifiedCache.set(cacheKey, result);
                return result;
              }
            }
          }
        }
      } catch {
        // Continue to next source
      }
    }

    // 2. Check Datamuse dictionary & semantic tags (`md=d` returns definitions)
    try {
      const dmRes = await fetchImpl(
        `https://api.datamuse.com/words?sp=${encodeURIComponent(cleaned)}&md=d&max=5`,
      );
      if (dmRes.ok) {
        const dmItems = await dmRes.json();
        if (Array.isArray(dmItems)) {
          for (const item of dmItems) {
            if (!matchesCandidateTitle(item.word, cleaned, reqLetter, strictFirstLetter)) continue;
            const defs = Array.isArray(item.defs) ? item.defs.join(' ') : '';
            if (textMatchesCategory(defs)) {
              const result = { approved: true, canonicalLabel: titleCase };
              liveVerifiedCache.set(cacheKey, result);
              return result;
            }
          }
        }
      }
    } catch {
      // Continue to Wikipedia / Wikidata fallback
    }

    // 3. Check Wikipedia REST Page Summary API for direct page hit (spaces converted to underscores)
    try {
      const wikiSlug = encodeURIComponent(titleCase.replace(/\s+/g, '_'));
      const wikiRes = await fetchImpl(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${wikiSlug}`,
      );
      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        const combinedText = `${wikiData?.description ?? ''} ${wikiData?.extract ?? ''}`;
        if (textMatchesCategory(combinedText)) {
          const cleanWikiTitle = wikiData?.title
            ? wikiData.title.replace(/\s*\([^)]*\)\s*$/, '').trim()
            : titleCase;
          const result = { approved: true, canonicalLabel: pickCanonicalLabel(cleanWikiTitle) };
          liveVerifiedCache.set(cacheKey, result);
          return result;
        }
      }
    } catch {
      // Continue to Wikipedia search & Wikidata
    }

    // 4. Check Wikidata Entity Search API (handles casing, aliases, nicknames, and descriptions cleanly)
    try {
      const wdUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(cleaned)}&language=en&limit=5&format=json&origin=*`;
      const wdRes = await fetchImpl(wdUrl);
      if (wdRes.ok) {
        const wdData = await wdRes.json();
        if (Array.isArray(wdData?.search)) {
          for (const entity of wdData.search) {
            const label = entity?.label ?? '';
            const aliases = Array.isArray(entity?.aliases) ? entity.aliases : [];
            const titleMatches =
              matchesCandidateTitle(label, cleaned, reqLetter, strictFirstLetter) ||
              aliases.some((a) => matchesCandidateTitle(a, cleaned, reqLetter, strictFirstLetter));
            if (!titleMatches) continue;

            const desc = `${entity?.description ?? ''} ${label} ${aliases.join(' ')}`;
            if (textMatchesCategory(desc)) {
              const result = { approved: true, canonicalLabel: pickCanonicalLabel(label) };
              liveVerifiedCache.set(cacheKey, result);
              return result;
            }
          }
        }
      }
    } catch {
      // Continue to Wikipedia query search
    }

    // 5. Check Wikipedia Search API (`action=query&list=search`) for partial names, stage names, or disambiguations
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleaned)}&srlimit=5&format=json&origin=*`;
      const searchRes = await fetchImpl(searchUrl);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const hits = searchData?.query?.search;
        if (Array.isArray(hits)) {
          for (const hit of hits) {
            if (!matchesCandidateTitle(hit.title, cleaned, reqLetter, strictFirstLetter)) continue;
            const snippet = String(hit.snippet ?? '').replace(/<[^>]+>/g, ' ');
            const combined = `${hit.title ?? ''} ${snippet}`;
            if (textMatchesCategory(combined)) {
              const result = { approved: true, canonicalLabel: pickCanonicalLabel(hit.title) };
              liveVerifiedCache.set(cacheKey, result);
              return result;
            }
          }
        }
      }
    } catch {
      // Ignore network errors
    }
  } catch {
    // Network error — decline gracefully
  }

  const declined = { approved: false };
  liveVerifiedCache.set(cacheKey, declined);
  return declined;
}

export function createWordRushTrainer({ countries = [], people = [] } = {}) {
  const categoriesMap = buildWordRushCategories({ countries, people });
  const categoryKeys = Object.keys(categoriesMap);
  const variantLabels = {
    daily: 'Daily Challenge (Shared)',
    ...Object.fromEntries(categoryKeys.map((k) => [k, categoriesMap[k].label])),
  };

  // Sync any community-verified learned words from the server in the background
  if (typeof globalThis.fetch === 'function' && typeof window !== 'undefined') {
    globalThis
      .fetch('/api/leaderboard', { method: 'GET', headers: { Accept: 'application/json' } })
      .then((r) => (r?.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.learnedWords)) {
          for (const w of data.learnedWords) {
            applyLearnedWordToCategories(categoriesMap, w);
          }
        }
      })
      .catch(() => {});
  }

  return {
    id: 'word-rush',
    categoryId: 'word-rush',
    name: 'Word Rush',
    description:
      'Name as many words as possible in today’s category starting with today’s letter. You have 30 seconds per word (timer resets on each valid word). Every possible answer is revealed when time runs out!',
    roundMode: 'lives',
    noLives: true,
    promptTimeLimitSeconds: 30,
    variantKind: 'pool',
    variants: ['daily'],
    variantLabels,
    scoreDirection: 'higher',
    headlineScore: 'correct',
    renderer: 'word-rush',
    scoreLabel: 'Words found',
    modeParam: 1,
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

    /**
     * Live online verification hook for words not yet in the local dictionary.
     * When approved, permanently adds the word to the category library / fasit and persists it.
     */
    async verifyCandidateOnline(word, prompt, fetchImpl) {
      const res = await verifyWordRushCandidateOnline({
        word,
        letter: prompt?.letter ?? '',
        categoryId: prompt?.topicId ?? '',
        categoryGroup: prompt?.categoryGroup ?? '',
        fetchImpl,
      });
      if (res?.approved) {
        const canonical = res.canonicalLabel ?? String(word).trim();
        const catId = prompt?.topicId ?? '';
        const entry = buildPersonEntry(canonical, [String(word).trim()]);
        registerLearnedWord(categoriesMap, {
          categoryId: catId,
          label: entry.label,
          alternatives: entry.alternatives,
          sync: fetchImpl === globalThis.fetch,
          fetchImpl,
        });
      }
      return res;
    },

    createGenerator({ puzzleDate, variantKey, practice = false, filters = null }) {
      const challenge = resolveWordRushChallenge(categoriesMap, {
        puzzleDate,
        variantKey,
        practice,
        filters,
      });
      const foundWords = [];
      const foundCompact = new Set();

      return {
        next(context) {
          // Record the word that was just submitted if it was correct
          if (context?.lastCorrect && context?.lastSubmission) {
            const matched = matchWordRushEntry(
              {
                validWords: challenge.validWords,
                foundWords: [],
                letter: challenge.letter,
              },
              context.lastSubmission,
            );
            const canonicalLabel = matched.matchedEntry?.label ?? String(context.lastSubmission).trim();
            const key = compactKey(canonicalLabel);
            if (key && !foundCompact.has(key)) {
              foundCompact.add(key);
              foundWords.push(canonicalLabel);
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
