/**
 * Capital Guesser enrichment data for all 195 sovereign countries:
 *   1. city: Nearest / major other city in the same country (or nearby landmark/district for city-states)
 *   2. fact: A distinctive fun fact about the capital city (without giving away the capital's name)
 */

export const CAPITAL_HINTS = Object.freeze({
  // Africa
  Algeria: {
    city: 'Oran',
    fact: 'Known as "El Bahdja" (The White) for its dazzling whitewashed hillside buildings overlooking the Mediterranean.',
  },
  Angola: {
    city: 'Huambo',
    fact: 'Founded by Portuguese explorer Paulo Dias de Novais in 1576 along the Atlantic coast.',
  },
  Benin: {
    city: 'Cotonou',
    fact: 'Although it is the official capital, the country’s largest city and seat of government is nearby Cotonou.',
  },
  Botswana: {
    city: 'Francistown',
    fact: 'Named after Chief Kgosi Gaborone of the Tlokwa people and built from scratch in the 1960s near the South African border.',
  },
  'Burkina Faso': {
    city: 'Bobo-Dioulasso',
    fact: 'Hosts FESPACO, the largest biennial pan-African film and television festival on the continent.',
  },
  Burundi: {
    city: 'Bujumbura',
    fact: 'Became the official political capital in 2019, replacing the Lake Tanganyika port city of Bujumbura.',
  },
  'Cabo Verde': {
    city: 'Mindelo',
    fact: 'Located on Santiago Island, its historic center sits atop a plateau locally called the "Platô".',
  },
  Cameroon: {
    city: 'Douala',
    fact: 'Nicknamed the "City of Seven Hills" and sits at a cool elevation of roughly 750 metres above sea level.',
  },
  'Central African Republic': {
    city: 'Bimbo',
    fact: 'Founded in 1889 as a French trading post on the northern banks of the Ubangi River.',
  },
  Chad: {
    city: 'Moundou',
    fact: 'Sits at the confluence of the Chari and Logone rivers, directly across the river from Kousséri in Cameroon.',
  },
  Comoros: {
    city: 'Mutsamudu',
    fact: 'Located at the foot of Mount Karthala, one of the world’s largest active shield volcanoes.',
  },
  'Democratic Republic of the Congo': {
    city: 'Lubumbashi',
    fact: 'Faces another national capital directly across the Congo River, making the two the closest pair of capitals outside Rome/Vatican.',
  },
  'Republic of the Congo': {
    city: 'Pointe-Noire',
    fact: 'Sits on the north bank of the Congo River, directly facing the megacity capital of its neighbour.',
  },
  Djibouti: {
    city: 'Ali Sabieh',
    fact: 'A strategic port on the Gulf of Tadjoura near the Bab-el-Mandeb strait, housing over 70% of the country’s population.',
  },
  Egypt: {
    city: 'Alexandria',
    fact: 'Nicknamed "The City of a Thousand Minarets" and sits just northeast of the ancient Giza pyramid complex.',
  },
  'Equatorial Guinea': {
    city: 'Bata',
    fact: 'Unusually located on Bioko Island in the Gulf of Guinea rather than on the country’s larger mainland territory.',
  },
  Eritrea: {
    city: 'Keren',
    fact: 'A UNESCO World Heritage site renowned for its remarkably preserved early-20th-century Italian modernist architecture.',
  },
  Eswatini: {
    city: 'Manzini',
    fact: 'Serves as the administrative capital in the Mdzimba Mountains while Lobamba serves as the royal and legislative capital.',
  },
  Ethiopia: {
    city: 'Dire Dawa',
    fact: 'Its name means "New Flower" in Amharic, and it serves as the headquarters of the African Union.',
  },
  Gabon: {
    city: 'Port-Gentil',
    fact: 'Founded in 1849 as a settlement for freed slaves and patterned after Freetown.',
  },
  Gambia: {
    city: 'Serekunda',
    fact: 'Built on St Mary’s Island where the Gambia River enters the Atlantic Ocean, connected to the mainland by bridge.',
  },
  Ghana: {
    city: 'Kumasi',
    fact: 'Home to Black Star Square (Independence Square) and the historic Jamestown fishing district on the Gulf of Guinea.',
  },
  Guinea: {
    city: 'Nzérékoré',
    fact: 'Built out along the narrow Kaloum Peninsula jutting into the Atlantic Ocean.',
  },
  'Guinea-Bissau': {
    city: 'Bafatá',
    fact: 'Sits on the Geba River estuary and is famous for its vibrant annual carnival and colonial-era Fortaleza de São José da Amura.',
  },
  'Ivory Coast': {
    city: 'Abidjan',
    fact: 'Home to the Basilica of Our Lady of Peace, recognized by Guinness World Records as the largest church building in the world.',
  },
  Kenya: {
    city: 'Mombasa',
    fact: 'The only capital city in the world with a full safari National Park bordering its urban skyline.',
  },
  Lesotho: {
    city: 'Teyateyaneng',
    fact: 'Sits on the Caledon River directly on the South African border in the only country lying entirely above 1,000 metres.',
  },
  Liberia: {
    city: 'Gbarnga',
    fact: 'One of only two national capitals in the world named after a United States President (James Monroe).',
  },
  Libya: {
    city: 'Benghazi',
    fact: 'Its name comes from the ancient Greek "Oea" and later "Tripolis", meaning "Three Cities".',
  },
  Madagascar: {
    city: 'Toamasina',
    fact: 'Known locally as "Tana", it sits in the central highlands and is crowned by the royal Rova palace complex.',
  },
  Malawi: {
    city: 'Blantyre',
    fact: 'Replaced Zomba as the national capital in 1975 and is named after the nearby river that flows through it.',
  },
  Mali: {
    city: 'Sikasso',
    fact: 'Straddles the Niger River and its name comes from the Bambara word meaning "crocodile back".',
  },
  Mauritania: {
    city: 'Nouadhibou',
    fact: 'Its name means "Place of the Winds" in Berber; it grew from a small desert fishing village in 1958 into a coastal metropolis.',
  },
  Mauritius: {
    city: 'Curepipe',
    fact: 'Named in honour of French King Louis XV and home to the 19th-century Aapravasi Ghat UNESCO World Heritage site.',
  },
  Morocco: {
    city: 'Casablanca',
    fact: 'Home to the 12th-century Hassan Tower and the cliffside Kasbah of the Udayas overlooking the Atlantic.',
  },
  Mozambique: {
    city: 'Beira',
    fact: 'Known as Lourenço Marques until 1976 and famous for its central railway station designed by associates of Gustave Eiffel.',
  },
  Namibia: {
    city: 'Walvis Bay',
    fact: 'Located in the central Khomas Highland plateau and famed for its German colonial architecture and nearby Christuskirche.',
  },
  Niger: {
    city: 'Zinder',
    fact: 'Built along the eastern bank of the Niger River and famous for its Grand Mosque and artisan markets.',
  },
  Nigeria: {
    city: 'Lagos',
    fact: 'A purpose-built city in the geographic center of the country that officially replaced Lagos in 1991, dominated by Aso Rock.',
  },
  Rwanda: {
    city: 'Butare',
    fact: 'Spread across lush ridges and valleys, it is widely celebrated as one of the cleanest cities in Africa with monthly community "Umuganda" cleanups.',
  },
  'Sao Tome and Principe': {
    city: 'Santo António',
    fact: 'Founded by Portuguese settlers in 1493 around a 16th-century cathedral and Fort São Sebastião on the equator.',
  },
  Senegal: {
    city: 'Touba',
    fact: 'Located on the Cap-Vert peninsula — the westernmost point of the entire African mainland — and former finish of the Paris–Dakar Rally.',
  },
  Seychelles: {
    city: 'Anse Boileau',
    fact: 'Situated on Mahé Island, it is one of the smallest capitals in the world and features a silver miniature Big Ben clocktower at its center.',
  },
  'Sierra Leone': {
    city: 'Bo',
    fact: 'Founded in 1792 by formerly enslaved African Americans and known for its historic Cotton Tree symbol.',
  },
  Somalia: {
    city: 'Hargeisa',
    fact: 'A historic Indian Ocean trading port along the Benadir coast known locally as "Xamar".',
  },
  'South Africa': {
    city: 'Johannesburg',
    fact: 'Nicknamed the "Jacaranda City" for its tens of thousands of purple-blossoming trees and serves as the country’s executive capital.',
  },
  'South Sudan': {
    city: 'Wau',
    fact: 'Sits on the White Nile and became the world’s newest national capital upon independence in July 2011.',
  },
  Sudan: {
    city: 'Omdurman',
    fact: 'Located at the dramatic "Mogran" confluence where the Blue Nile and the White Nile merge into the Nile River.',
  },
  Tanzania: {
    city: 'Dar es Salaam',
    fact: 'Centrally located inland, it officially replaced coastal Dar es Salaam as the legislative capital in the 1970s.',
  },
  Togo: {
    city: 'Sokodé',
    fact: 'Its western boulevard runs directly along the international border with Ghana.',
  },
  Tunisia: {
    city: 'Sfax',
    fact: 'Encompasses the ancient ruins of Carthage and the blue-and-white cliffside village of Sidi Bou Said.',
  },
  Uganda: {
    city: 'Entebbe',
    fact: 'Originally built across seven hills near the northern shore of Lake Victoria; its name comes from "Kasozi ka Mpala" (Hill of the Impala).',
  },
  Zambia: {
    city: 'Ndola',
    fact: 'Sits on a high plateau at 1,280 metres and replaced Livingstone as capital in 1935 due to its central railway location.',
  },
  Zimbabwe: {
    city: 'Bulawayo',
    fact: 'Known as Salisbury until 1982, its Shona name translates roughly to "He who does not sleep".',
  },

  // Asia
  Afghanistan: {
    city: 'Kandahar',
    fact: 'Nestled in a high mountain valley in the Hindu Kush at nearly 1,800 metres above sea level, along the ancient Silk Road.',
  },
  Armenia: {
    city: 'Gyumri',
    fact: 'Nicknamed the "Pink City" because its buildings are constructed from naturally rose-colored volcanic tuff stone, with Mount Ararat on the horizon.',
  },
  Azerbaijan: {
    city: 'Ganja',
    fact: 'Situated 28 metres below sea level on the Caspian Sea, making it the lowest-lying national capital in the world.',
  },
  Bahrain: {
    city: 'Riffa',
    fact: 'Its name means "The Place of Dreams" or "Sleeping Place" in Arabic, and its skyline is famous for the twin-sail World Trade Center.',
  },
  Bangladesh: {
    city: 'Chittagong',
    fact: 'Known as the "Rickshaw Capital of the World", with ratusan thousands of brightly painted cycle rickshaws on the Buriganga River.',
  },
  Bhutan: {
    city: 'Paro',
    fact: 'Famously the only national capital in the world that has no traffic lights, relying instead on white-gloved police officers in ornate booths.',
  },
  Brunei: {
    city: 'Kuala Belait',
    fact: 'Home to Istana Nurul Iman, the world’s largest residential palace, and the historic Kampong Ayer water village.',
  },
  Cambodia: {
    city: 'Siem Reap',
    fact: 'Sits at the confluence of the Mekong, Bassac, and Tonlé Sap rivers and was once called the "Pearl of Asia".',
  },
  China: {
    city: 'Shanghai',
    fact: 'Home to the Forbidden City imperial palace complex and the Temple of Heaven.',
  },
  Cyprus: {
    city: 'Limassol',
    fact: 'Surrounded by 16th-century Venetian walls shaped like a 11-pointed star, it is the world’s last divided capital city.',
  },
  Georgia: {
    city: 'Batumi',
    fact: 'Its name derives from the Old Georgian word for "warm" because of the natural sulfuric hot springs along the Kura River.',
  },
  India: {
    city: 'Mumbai',
    fact: 'Designed by British architects Edwin Lutyens and Herbert Baker in the early 20th century, centered on India Gate and Rashtrapati Bhavan.',
  },
  Indonesia: {
    city: 'Surabaya',
    fact: 'A sprawling megacity on the northwest coast of Java, formerly known as Sunda Kelapa and Batavia.',
  },
  Iran: {
    city: 'Isfahan',
    fact: 'Sits directly at the foot of the towering snow-capped Alborz mountain range and Mount Damavand, and features the iconic Azadi and Milad towers.',
  },
  Iraq: {
    city: 'Basra',
    fact: 'Founded in the 8th century as the circular "City of Peace" along the Tigris River and center of the Islamic Golden Age.',
  },
  Israel: {
    city: 'Tel Aviv',
    fact: 'Its ancient limestone Old City is divided into four historic quarters and is sacred to Judaism, Christianity, and Islam.',
  },
  Japan: {
    city: 'Osaka',
    fact: 'Known as Edo until 1868, it is the core of the most populous metropolitan area on Earth.',
  },
  Jordan: {
    city: 'Zarqa',
    fact: 'Known in antiquity as Philadelphia, its hilltop Citadel features the Roman Temple of Hercules and the Umayyad Palace.',
  },
  Kazakhstan: {
    city: 'Almaty',
    fact: 'Replaced Almaty in 1997; its futuristic skyline on the Ishim River was master-planned by Japanese architect Kisho Kurokawa.',
  },
  Kuwait: {
    city: 'Al Ahmadi',
    fact: 'Famous for its trio of blue-sphere-clad water and observation towers overlooking the Persian Gulf.',
  },
  Kyrgyzstan: {
    city: 'Osh',
    fact: 'Known as Frunze during the Soviet era and framed by the dramatic snow-covered Kyrgyz Ala-Too mountain range.',
  },
  Laos: {
    city: 'Luang Prabang',
    fact: 'Sits on a bend of the Mekong River directly on the border with Thailand and is home to the golden Pha That Luang stupa.',
  },
  Lebanon: {
    city: 'Tripoli',
    fact: 'Inhabited for over 5,000 years on a Mediterranean peninsula and renowned for its Raouché (Pigeon Rocks) sea arches.',
  },
  Malaysia: {
    city: 'George Town',
    fact: 'Its name means "Muddy Confluence", and its skyline is defined by the 452-metre twin Petronas Towers.',
  },
  Maldives: {
    city: 'Addu City',
    fact: 'Covering an entire coral island of just a few square kilometres, it is one of the most densely populated islands on Earth.',
  },
  Mongolia: {
    city: 'Erdenet',
    fact: 'Founded in 1639 as a nomadic Buddhist monastic center that changed location 28 times before settling permanently; it is the coldest national capital in the world.',
  },
  Myanmar: {
    city: 'Yangon',
    fact: 'A purpose-built inland capital with 20-lane boulevards that officially replaced Yangon in 2005.',
  },
  Nepal: {
    city: 'Pokhara',
    fact: 'Sits in a bowl-shaped Himalayan valley at 1,400 metres and is home to seven UNESCO World Heritage monument zones including Swayambhunath.',
  },
  'North Korea': {
    city: 'Hamhung',
    fact: 'Bisected by the Taedong River and dominated by the 105-story pyramid-shaped Ryugyong Hotel.',
  },
  Oman: {
    city: 'Salalah',
    fact: 'Ringed by jagged volcanic Hajar mountains and two 16th-century Portuguese forts (Al Jalali and Al Mirani) guarding its harbour.',
  },
  Pakistan: {
    city: 'Karachi',
    fact: 'Purpose-built in the 1960s at the foot of the Margalla Hills to replace Karachi, featuring the giant tent-shaped Faisal Mosque.',
  },
  Palestine: {
    city: 'Gaza City',
    fact: 'Located in the central West Bank hills at nearly 900 metres elevation, serving as the de facto administrative seat.',
  },
  Philippines: {
    city: 'Quezon City',
    fact: 'Home to the 16th-century walled district of Intramuros and the oldest Chinatown in the world (Binondo, established 1594).',
  },
  Qatar: {
    city: 'Al Rayyan',
    fact: 'Famous for its Museum of Islamic Art designed by I. M. Pei and the Pearl artificial island on the Persian Gulf.',
  },
  'Saudi Arabia': {
    city: 'Jeddah',
    fact: 'Located on the central Najd plateau; its name derives from the plural of the Arabic word "rawdah", meaning gardens or meadows.',
  },
  Singapore: {
    city: 'Jurong',
    fact: 'A sovereign island city-state whose name comes from the Sanskrit "Simhapura", meaning "Lion City".',
  },
  'South Korea': {
    city: 'Busan',
    fact: 'Bisected by the Han River and home to five grand Joseon-dynasty royal palaces including Gyeongbokgung.',
  },
  'Sri Lanka': {
    city: 'Kandy',
    fact: 'Its parliamentary complex sits on an island in Diyawanna Oya lake just east of the commercial hub of Colombo.',
  },
  Syria: {
    city: 'Aleppo',
    fact: 'Often cited as the oldest continuously inhabited capital in the world, famous for the 8th-century Umayyad Mosque.',
  },
  Tajikistan: {
    city: 'Khujand',
    fact: 'Its name literally means "Monday" in Persian, named after the popular weekly bazaar that once met at this crossroads village.',
  },
  Thailand: {
    city: 'Chiang Mai',
    fact: 'Its ceremonial Thai name is the longest city name in the world at 168 letters, beginning with "Krung Thep Maha Nakhon".',
  },
  'Timor-Leste': {
    city: 'Baucau',
    fact: 'Overlooked by the 27-metre Cristo Rei statue atop Cape Fatucama on the northern coast of Timor island.',
  },
  Turkey: {
    city: 'Istanbul',
    fact: 'Known in antiquity as Ancyra, it was chosen by Mustafa Kemal Atatürk in 1923 to replace Istanbul due to its central Anatolian location.',
  },
  Turkmenistan: {
    city: 'Türkmenabat',
    fact: 'Holds the Guinness World Record for the highest concentration of white-marble-clad buildings on Earth.',
  },
  'United Arab Emirates': {
    city: 'Dubai',
    fact: 'Sits on a T-shaped island in the Persian Gulf and is home to the Sheikh Zayed Grand Mosque and the Louvre museum dome.',
  },
  Uzbekistan: {
    city: 'Samarkand',
    fact: 'Its name means "Stone City", and after a 1966 earthquake it was rebuilt with grand boulevards and ornate metro stations.',
  },
  Vietnam: {
    city: 'Ho Chi Minh City',
    fact: 'Celebrated its 1,000th anniversary in 2010 and is centered around the scenic Hoan Kiem ("Returned Sword") Lake.',
  },
  Yemen: {
    city: 'Aden',
    fact: 'Lying at 2,250 metres elevation, its Old City is famous for multi-story rammed-earth and brick tower houses decorated with white gypsum patterns.',
  },

  // Europe
  Albania: {
    city: 'Durrës',
    fact: 'Known for its colourful painted apartment blocks, Skanderbeg Square, and the concrete Pyramid cultural center.',
  },
  Andorra: {
    city: 'Escaldes-Engordany',
    fact: 'At 1,023 metres in the Pyrenees, it is the highest capital city in Europe.',
  },
  Austria: {
    city: 'Graz',
    fact: 'Known as the "City of Music" — home to Mozart, Beethoven, and Strauss — and famous for Schönbrunn Palace and the giant Prater Ferris wheel.',
  },
  Belarus: {
    city: 'Gomel',
    fact: 'Almost completely rebuilt after World War II in monumental Stalinist Empire style along Independence Avenue.',
  },
  Belgium: {
    city: 'Antwerp',
    fact: 'Serves as the de facto headquarters of the European Union and NATO, and is famous for the Grand-Place, Atomium, and Manneken Pis.',
  },
  'Bosnia and Herzegovina': {
    city: 'Banja Luka',
    fact: 'Hosted the 1984 Winter Olympics and is where Archduke Franz Ferdinand was assassinated in 1914 near the Latin Bridge.',
  },
  Bulgaria: {
    city: 'Plovdiv',
    fact: 'Sits at the foot of Vitosha Mountain and is named after the 4th-century Hagia Sophia church (not the Alexander Nevsky Cathedral!).',
  },
  Croatia: {
    city: 'Split',
    fact: 'Formed in 1850 by uniting the twin medieval hill towns of Kaptol and Gradec, where the Grič cannon still fires every day at noon.',
  },
  Czechia: {
    city: 'Brno',
    fact: 'Nicknamed the "City of a Hundred Spires", famous for the 14th-century Charles Bridge and its medieval Astronomical Clock.',
  },
  Denmark: {
    city: 'Aarhus',
    fact: 'Home to Tivoli Gardens (opened in 1843), the colourful Nyhavn waterfront, and the Little Mermaid statue.',
  },
  Estonia: {
    city: 'Tartu',
    fact: 'Boasts one of the best-preserved medieval Hanseatic Old Towns in Europe, crowned by Toompea Hill overlooking the Gulf of Finland.',
  },
  Finland: {
    city: 'Tampere',
    fact: 'Nicknamed the "Daughter of the Baltic" and guarded by the 18th-century sea fortress of Suomenlinna across six islands.',
  },
  France: {
    city: 'Marseille',
    fact: 'Bisected by the River Seine and divided into 20 clockwise spiral districts called arrondissements.',
  },
  Germany: {
    city: 'Munich',
    fact: 'Has more bridges than Venice along the Spree and Landwehr waterways, and is symbolised by the 18th-century Brandenburg Gate.',
  },
  Greece: {
    city: 'Thessaloniki',
    fact: 'Named after the goddess of wisdom and crowned by the 5th-century BC Parthenon atop the Acropolis.',
  },
  Hungary: {
    city: 'Debrecen',
    fact: 'Created in 1873 by uniting three cities across the Danube River and famous for its thermal baths and neo-Gothic Parliament.',
  },
  Iceland: {
    city: 'Akureyri',
    fact: 'The world’s northernmost capital of a sovereign state, powered almost entirely by geothermal energy and home to the Hallgrímskirkja church.',
  },
  Ireland: {
    city: 'Cork',
    fact: 'Bisected by the River Liffey, its name comes from the Irish "Dubh Linn" meaning "Black Pool".',
  },
  Italy: {
    city: 'Milan',
    fact: 'Known as the "Eternal City", built on seven hills and uniquely completely enclosing another sovereign state within its borders.',
  },
  Latvia: {
    city: 'Daugavpils',
    fact: 'Located at the mouth of the Daugava River and famous for having the largest concentration of Art Nouveau buildings in the world.',
  },
  Liechtenstein: {
    city: 'Schaan',
    fact: 'Overlooked by a 12th-century alpine castle that is still the private residence of the ruling Prince.',
  },
  Lithuania: {
    city: 'Kaunas',
    fact: 'Famous for its huge Baroque Old Town and the self-declared bohemian "Republic of Užupis" neighbourhood.',
  },
  Luxembourg: {
    city: 'Esch-sur-Alzette',
    fact: 'Dramatically perched atop sheer sandstone cliffs and deep gorges cut by the Alzette and Pétrusse rivers.',
  },
  Malta: {
    city: 'Birkirkara',
    fact: 'Built by the Knights of St John in the 1560s on a fortified peninsula between Grand Harbour and Marsamxett Harbour.',
  },
  Moldova: {
    city: 'Bălți',
    fact: 'Built on seven hills along the Bîc River and surrounded by some of the largest underground wine cellars in the world (Mileștii Mici & Cricova).',
  },
  Monaco: {
    city: 'Monte Carlo',
    fact: 'A sovereign Mediterranean microstate famous for its Formula One street circuit and Belle Époque casino.',
  },
  Montenegro: {
    city: 'Nikšić',
    fact: 'Was known as Titograd from 1946 to 1992; its name literally means "Under the Little Hill" (Gorica).',
  },
  Netherlands: {
    city: 'Rotterdam',
    fact: 'Built on millions of wooden piles across concentric 17th-century canals; although it is the constitutional capital, the government sits in The Hague.',
  },
  'North Macedonia': {
    city: 'Bitola',
    fact: 'Birthplace of Mother Teresa and spanned by the 15th-century Ottoman Stone Bridge across the Vardar River.',
  },
  Norway: {
    city: 'Bergen',
    fact: 'Was called Christiania (and Kristiania) for 300 years until 1925, and hosts the Nobel Peace Prize ceremony every December.',
  },
  Poland: {
    city: 'Kraków',
    fact: 'Its heraldic symbol is a sword-wielding mermaid (Syrenka) along the Vistula River, and its Old Town was meticulously reconstructed from Canaletto paintings after WWII.',
  },
  Portugal: {
    city: 'Porto',
    fact: 'Built on seven steep hills where the Tagus River meets the Atlantic, famous for yellow vintage trams and the 16th-century Belém Tower.',
  },
  Romania: {
    city: 'Cluj-Napoca',
    fact: 'Once nicknamed "Little Paris of the East" and home to the colossal Palace of the Parliament, the heaviest building in the world.',
  },
  Russia: {
    city: 'Saint Petersburg',
    fact: 'Built in concentric ring roads radiating outward from the red brick walls of the Kremlin and Red Square.',
  },
  'San Marino': {
    city: 'Serravalle',
    fact: 'Perched high atop the three peaks of Monte Titano in the world’s oldest surviving sovereign republic (founded 301 AD).',
  },
  Serbia: {
    city: 'Novi Sad',
    fact: 'Its name means "White City", and its ancient Kalemegdan Fortress overlooks the confluence of the Sava and Danube rivers.',
  },
  Slovakia: {
    city: 'Košice',
    fact: 'The only national capital in the world that directly borders two other sovereign countries (Austria and Hungary).',
  },
  Slovenia: {
    city: 'Maribor',
    fact: 'Symbolised by emerald-green dragons on its Dragon Bridge and shaped by visionary architect Jože Plečnik.',
  },
  Spain: {
    city: 'Barcelona',
    fact: 'Located in the geographic center of the Iberian Peninsula at 650m elevation, home to the Prado Museum and Retiro Park.',
  },
  Sweden: {
    city: 'Gothenburg',
    fact: 'Spread across 14 islands where Lake Mälaren meets the Baltic Sea, and home to the Vasa 17th-century warship museum.',
  },
  Switzerland: {
    city: 'Zurich',
    fact: 'Its medieval sandstone Old Town sits in a sharp horseshoe bend of the turquoise Aare River and takes its name from the bear on its coat of arms.',
  },
  Ukraine: {
    city: 'Lviv',
    fact: 'Set atop steep hills along the Dnieper River and famous for the golden domes of Saint Sophia Cathedral and the Pechersk Lavra.',
  },
  'United Kingdom': {
    city: 'Manchester',
    fact: 'Founded by the Romans as Londinium on the River Thames and home to the world’s oldest underground railway (1863).',
  },
  'Vatican City': {
    city: 'St. Peter’s Square',
    fact: 'The world’s smallest independent state (49 hectares), entirely enclosed by another capital city and centred on St. Peter’s Basilica.',
  },

  // North America
  'Antigua and Barbuda': {
    city: 'All Saints',
    fact: 'Dominated by the white Baroque twin towers of its 1845 cathedral overlooking a Caribbean cruise harbour.',
  },
  Bahamas: {
    city: 'Freeport',
    fact: 'Located on New Providence Island, it was once a legendary 18th-century stronghold for Caribbean pirates including Blackbeard.',
  },
  Barbados: {
    city: 'Speightstown',
    fact: 'Its historic garrison and Carlisle Bay waterfront are a UNESCO World Heritage site on the southwestern coast.',
  },
  Belize: {
    city: 'Belize City',
    fact: 'A planned inland capital built after Hurricane Hattie devastated coastal Belize City in 1961 — the smallest capital in the continental Americas.',
  },
  Canada: {
    city: 'Toronto',
    fact: 'Chosen by Queen Victoria in 1857; in winter its Rideau Canal freezes into the world’s largest natural skating rink.',
  },
  'Costa Rica': {
    city: 'Alajuela',
    fact: 'Located in the lush Central Valley (Meseta Central) ringed by volcanoes and home to the ornate 1897 National Theatre.',
  },
  Cuba: {
    city: 'Santiago de Cuba',
    fact: 'Famous for its 8-kilometre Malecón seawall drive, pastel colonial plazas, and 1950s classic American cars.',
  },
  Dominica: {
    city: 'Portsmouth',
    fact: 'Sits on the southwestern coast where the Roseau River enters the Caribbean Sea, surrounded by rainforest waterfalls and boiling springs.',
  },
  'Dominican Republic': {
    city: 'Santiago de los Caballeros',
    fact: 'Founded in 1496, its Zona Colonial is the oldest permanent European settlement in the Americas, with the continent’s first cathedral and university.',
  },
  'El Salvador': {
    city: 'Santa Ana',
    fact: 'Sits in the "Valley of the Hammocks" (Valle de las Hamacas) at the foot of the Quetzaltepec volcano.',
  },
  Grenada: {
    city: 'Gouyave',
    fact: 'Curved around a picturesque horseshoe harbour inside an old volcanic crater, scented with nutmeg and cacao.',
  },
  Guatemala: {
    city: 'Quetzaltenango',
    fact: 'Founded in 1776 after an earthquake destroyed the former colonial capital of Antigua; it is the most populous city in Central America.',
  },
  Haiti: {
    city: 'Cap-Haïtien',
    fact: 'Sits at the apex of the Gulf of Gonâve on the island of Hispaniola.',
  },
  Honduras: {
    city: 'San Pedro Sula',
    fact: 'Paired with its sister city Comayagüela across the Choluteca River in a highland basin surrounded by pine-clad mountains.',
  },
  Jamaica: {
    city: 'Montego Bay',
    fact: 'Backed by the Blue Mountains and home to the Bob Marley Museum and historic Port Royal.',
  },
  Mexico: {
    city: 'Guadalajara',
    fact: 'Built at 2,240 metres elevation over the island ruins of the Aztec capital Tenochtitlan in the former Lake Texcoco.',
  },
  Nicaragua: {
    city: 'León',
    fact: 'Lies on the southern shore of Lake Xolotlán and was chosen in 1852 to end the fierce rivalry between León and Granada.',
  },
  Panama: {
    city: 'Colón',
    fact: 'The only capital city in the world that has a tropical rainforest (Metropolitan Natural Park) within its city limits, right beside the Pacific entrance to its famous canal.',
  },
  'Saint Kitts and Nevis': {
    city: 'Charlestown',
    fact: 'Founded by the French in 1627 ("Low Land"), it is one of the oldest towns in the Eastern Caribbean.',
  },
  'Saint Lucia': {
    city: 'Vieux Fort',
    fact: 'Named after Eugène de La Croix, Marquis de Castries, and guarded by the hilltop fortress of Morne Fortune.',
  },
  'Saint Vincent and the Grenadines': {
    city: 'Georgetown',
    fact: 'Nicknamed the "City of Arches" for its ratusan stone colonial arcades and home to the oldest botanical gardens in the Western Hemisphere (1765).',
  },
  'Trinidad and Tobago': {
    city: 'San Fernando',
    fact: 'Famous for the Queen’s Park Savannah — the world’s largest roundabout — and its explosive pre-Lenten steelpan Carnival.',
  },
  'United States': {
    city: 'New York City',
    fact: 'Laid out by Pierre Charles L’Enfant on the Potomac River in a federal district that belongs to none of the 50 states.',
  },

  // South America
  Argentina: {
    city: 'Córdoba',
    fact: 'Known for the wide 9 de Julio Avenue, the colourful Caminito in La Boca, and being the birthplace of the tango.',
  },
  Bolivia: {
    city: 'Santa Cruz de la Sierra',
    fact: 'While this whitewashed UNESCO city is the constitutional and judicial capital, La Paz at 3,650m is the seat of government.',
  },
  Brazil: {
    city: 'São Paulo',
    fact: 'Inaugurated in 1960 after 41 months of construction; its airplane-shaped layout was designed by Lúcio Costa and Oscar Niemeyer.',
  },
  Chile: {
    city: 'Valparaíso',
    fact: 'Founded in 1541 in a central valley dramatically framed by the snow-capped Andes to the east and the Coastal Range to the west.',
  },
  Colombia: {
    city: 'Medellín',
    fact: 'Sits on a high Andean plateau (the Sabana) at 2,640 metres above sea level and is home to the world-famous Gold Museum (Museo del Oro).',
  },
  Ecuador: {
    city: 'Guayaquil',
    fact: 'At 2,850 metres on the slopes of Pichincha volcano, it is the closest national capital in the world to the Equator (just 25 km south).',
  },
  Guyana: {
    city: 'Linden',
    fact: 'Sits below high-tide level at the mouth of the Demerara River, protected by a Dutch-built sea wall, and features the tall wooden St. George’s Cathedral.',
  },
  Paraguay: {
    city: 'Ciudad del Este',
    fact: 'Founded in 1537 on the eastern bank of the Paraguay River, earning the nickname "Mother of Cities".',
  },
  Peru: {
    city: 'Arequipa',
    fact: 'Founded by Francisco Pizarro in 1535 as the "City of Kings" on the arid Pacific coast.',
  },
  Suriname: {
    city: 'Lelydorp',
    fact: 'Located on the Suriname River, its UNESCO historic inner city is famous for ornate Dutch wooden architecture.',
  },
  Uruguay: {
    city: 'Salto',
    fact: 'Home to nearly half of the country’s entire population and famous for its 22-kilometre waterfront Rambla along the Río de la Plata.',
  },
  Venezuela: {
    city: 'Maracaibo',
    fact: 'Nestled in a lush northern mountain valley separated from the Caribbean Sea by the 2,700-metre Cerro El Ávila.',
  },

  // Oceania
  Australia: {
    city: 'Sydney',
    fact: 'A planned inland garden city designed by Walter Burley Griffin and chosen in 1908 as a compromise between rivals Sydney and Melbourne.',
  },
  Fiji: {
    city: 'Lautoka',
    fact: 'Located on the southeastern peninsula of Viti Levu island, it replaced the historic whaling port of Levuka in 1882.',
  },
  Kiribati: {
    city: 'Betio',
    fact: 'Strung along a ribbon-thin coral atoll lagoon in the central Pacific near the International Date Line.',
  },
  'Marshall Islands': {
    city: 'Ebeye',
    fact: 'Spread across a 64-island coral atoll whose road-connected islets are often only a single city block wide between lagoon and ocean.',
  },
  Micronesia: {
    city: 'Weno',
    fact: 'A small woodland valley on Pohnpei Island that replaced Kolonia as the federal capital in 1989.',
  },
  Nauru: {
    city: 'Denigomodu',
    fact: 'Because this tiny 21 km² phosphate island has no official capital city, its parliament and airport sit in this southern coastal district.',
  },
  'New Zealand': {
    city: 'Auckland',
    fact: 'The world’s southernmost capital of a sovereign state, famous for its steep cable car, "Beehive" parliament building, and windy Cook Strait.',
  },
  Palau: {
    city: 'Koror',
    fact: 'Located in Melekeok State on Babeldaob Island; with fewer than 400 residents, it is the least populous national capital in the world.',
  },
  'Papua New Guinea': {
    city: 'Lae',
    fact: 'Located on the southeastern coast of New Guinea island and named by Captain John Moresby in 1873 after his father, Admiral Sir Fairfax Moresby.',
  },
  Samoa: {
    city: 'Salelologa',
    fact: 'Located on the northern coast of Upolu Island; Scottish author Robert Louis Stevenson spent his final years at Villa Vailima on the hill above it.',
  },
  'Solomon Islands': {
    city: 'Gizo',
    fact: 'Built on the northern coast of Guadalcanal Island after World War II; its name comes from "Naho-ni-ara", meaning "facing the east wind".',
  },
  Tonga: {
    city: 'Neiafu',
    fact: 'Located on the flat coral island of Tongatapu; its name translates to "The Abode of Love" and features the seaside Royal Palace.',
  },
  Tuvalu: {
    city: 'Savave',
    fact: 'A narrow coral atoll ribbon whose airport runway doubles as the community town square and sports field when no planes are landing.',
  },
  Vanuatu: {
    city: 'Luganville',
    fact: 'Set around a natural harbour on Efate Island where both French and English street names reflect its unique former Anglo-French Condominium history.',
  },
});
