/**
 * Land border adjacency graph for sovereign countries + BFS shortest-path solver
 * for Border Hop.
 *
 * Every land border is symmetric: normalizeBorders() guarantees that if A
 * borders B, B also borders A. Only countries belonging to connected land
 * components with paths of length >= 2 steps are chosen as start/target pairs.
 */

const RAW_BORDERS = {
  // Europe
  Portugal: ['Spain'],
  Spain: ['Portugal', 'France', 'Andorra'],
  Andorra: ['France', 'Spain'],
  France: ['Spain', 'Andorra', 'Monaco', 'Belgium', 'Luxembourg', 'Germany', 'Switzerland', 'Italy'],
  Monaco: ['France'],
  Belgium: ['France', 'Luxembourg', 'Germany', 'Netherlands'],
  Netherlands: ['Belgium', 'Germany'],
  Luxembourg: ['Belgium', 'France', 'Germany'],
  Germany: ['Netherlands', 'Belgium', 'Luxembourg', 'France', 'Switzerland', 'Austria', 'Czechia', 'Poland', 'Denmark'],
  Denmark: ['Germany'],
  Switzerland: ['France', 'Germany', 'Austria', 'Liechtenstein', 'Italy'],
  Liechtenstein: ['Switzerland', 'Austria'],
  Italy: ['France', 'Switzerland', 'Austria', 'Slovenia', 'San Marino', 'Vatican City'],
  'San Marino': ['Italy'],
  'Vatican City': ['Italy'],
  Austria: ['Germany', 'Czechia', 'Slovakia', 'Hungary', 'Slovenia', 'Italy', 'Switzerland', 'Liechtenstein'],
  Czechia: ['Germany', 'Poland', 'Slovakia', 'Austria'],
  Poland: ['Germany', 'Czechia', 'Slovakia', 'Ukraine', 'Belarus', 'Lithuania', 'Russia'],
  Slovakia: ['Czechia', 'Poland', 'Ukraine', 'Hungary', 'Austria'],
  Hungary: ['Austria', 'Slovakia', 'Ukraine', 'Romania', 'Serbia', 'Croatia', 'Slovenia'],
  Slovenia: ['Italy', 'Austria', 'Hungary', 'Croatia'],
  Croatia: ['Slovenia', 'Hungary', 'Serbia', 'Bosnia and Herzegovina', 'Montenegro'],
  'Bosnia and Herzegovina': ['Croatia', 'Serbia', 'Montenegro'],
  Montenegro: ['Croatia', 'Bosnia and Herzegovina', 'Serbia', 'Kosovo', 'Albania'],
  Albania: ['Montenegro', 'Kosovo', 'North Macedonia', 'Greece'],
  'North Macedonia': ['Albania', 'Kosovo', 'Serbia', 'Bulgaria', 'Greece'],
  Greece: ['Albania', 'North Macedonia', 'Bulgaria', 'Turkey'],
  Bulgaria: ['Romania', 'Serbia', 'North Macedonia', 'Greece', 'Turkey'],
  Serbia: ['Hungary', 'Romania', 'Bulgaria', 'North Macedonia', 'Kosovo', 'Montenegro', 'Bosnia and Herzegovina', 'Croatia'],
  Romania: ['Hungary', 'Ukraine', 'Moldova', 'Bulgaria', 'Serbia'],
  Moldova: ['Romania', 'Ukraine'],
  Ukraine: ['Poland', 'Slovakia', 'Hungary', 'Romania', 'Moldova', 'Russia', 'Belarus'],
  Belarus: ['Poland', 'Lithuania', 'Latvia', 'Russia', 'Ukraine'],
  Lithuania: ['Poland', 'Belarus', 'Latvia', 'Russia'],
  Latvia: ['Lithuania', 'Belarus', 'Russia', 'Estonia'],
  Estonia: ['Latvia', 'Russia'],
  Norway: ['Sweden', 'Finland', 'Russia'],
  Sweden: ['Norway', 'Finland'],
  Finland: ['Sweden', 'Norway', 'Russia'],
  Russia: ['Norway', 'Finland', 'Estonia', 'Latvia', 'Lithuania', 'Poland', 'Belarus', 'Ukraine', 'Georgia', 'Azerbaijan', 'Kazakhstan', 'China', 'Mongolia', 'North Korea'],
  'United Kingdom': ['Ireland'],
  Ireland: ['United Kingdom'],

  // Middle East & Caucasus & Central Asia
  Turkey: ['Greece', 'Bulgaria', 'Georgia', 'Armenia', 'Azerbaijan', 'Iran', 'Iraq', 'Syria'],
  Georgia: ['Russia', 'Turkey', 'Armenia', 'Azerbaijan'],
  Armenia: ['Georgia', 'Turkey', 'Iran', 'Azerbaijan'],
  Azerbaijan: ['Russia', 'Georgia', 'Armenia', 'Iran', 'Turkey'],
  Syria: ['Turkey', 'Iraq', 'Jordan', 'Israel', 'Lebanon'],
  Lebanon: ['Syria', 'Israel'],
  Israel: ['Lebanon', 'Syria', 'Jordan', 'Palestine', 'Egypt'],
  Palestine: ['Israel', 'Jordan', 'Egypt'],
  Jordan: ['Syria', 'Iraq', 'Saudi Arabia', 'Israel', 'Palestine'],
  Iraq: ['Turkey', 'Iran', 'Kuwait', 'Saudi Arabia', 'Jordan', 'Syria'],
  Kuwait: ['Iraq', 'Saudi Arabia'],
  'Saudi Arabia': ['Jordan', 'Iraq', 'Kuwait', 'Qatar', 'United Arab Emirates', 'Oman', 'Yemen'],
  Qatar: ['Saudi Arabia'],
  'United Arab Emirates': ['Saudi Arabia', 'Oman'],
  Oman: ['United Arab Emirates', 'Saudi Arabia', 'Yemen'],
  Yemen: ['Saudi Arabia', 'Oman'],
  Iran: ['Turkey', 'Armenia', 'Azerbaijan', 'Turkmenistan', 'Afghanistan', 'Pakistan', 'Iraq'],
  Kazakhstan: ['Russia', 'China', 'Kyrgyzstan', 'Uzbekistan', 'Turkmenistan'],
  Uzbekistan: ['Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Afghanistan', 'Turkmenistan'],
  Turkmenistan: ['Kazakhstan', 'Uzbekistan', 'Afghanistan', 'Iran'],
  Kyrgyzstan: ['Kazakhstan', 'China', 'Tajikistan', 'Uzbekistan'],
  Tajikistan: ['Kyrgyzstan', 'China', 'Afghanistan', 'Uzbekistan'],
  Afghanistan: ['Turkmenistan', 'Uzbekistan', 'Tajikistan', 'China', 'Pakistan', 'Iran'],

  // South, East & Southeast Asia
  Pakistan: ['Iran', 'Afghanistan', 'China', 'India'],
  India: ['Pakistan', 'China', 'Nepal', 'Bhutan', 'Bangladesh', 'Myanmar'],
  Nepal: ['China', 'India'],
  Bhutan: ['China', 'India'],
  Bangladesh: ['India', 'Myanmar'],
  Myanmar: ['India', 'Bangladesh', 'China', 'Laos', 'Thailand'],
  Thailand: ['Myanmar', 'Laos', 'Cambodia', 'Malaysia'],
  Laos: ['Myanmar', 'China', 'Vietnam', 'Cambodia', 'Thailand'],
  Cambodia: ['Thailand', 'Laos', 'Vietnam'],
  Vietnam: ['China', 'Laos', 'Cambodia'],
  Malaysia: ['Thailand', 'Brunei', 'Indonesia'],
  Brunei: ['Malaysia'],
  Indonesia: ['Malaysia', 'Timor-Leste', 'Papua New Guinea'],
  'Timor-Leste': ['Indonesia'],
  'Papua New Guinea': ['Indonesia'],
  China: ['Russia', 'Mongolia', 'North Korea', 'Vietnam', 'Laos', 'Myanmar', 'India', 'Bhutan', 'Nepal', 'Pakistan', 'Afghanistan', 'Tajikistan', 'Kyrgyzstan', 'Kazakhstan'],
  Mongolia: ['Russia', 'China'],
  'North Korea': ['China', 'Russia', 'South Korea'],
  'South Korea': ['North Korea'],

  // Africa
  Egypt: ['Palestine', 'Israel', 'Sudan', 'Libya'],
  Libya: ['Egypt', 'Sudan', 'Chad', 'Niger', 'Algeria', 'Tunisia'],
  Tunisia: ['Libya', 'Algeria'],
  Algeria: ['Tunisia', 'Libya', 'Niger', 'Mali', 'Mauritania', 'Morocco'],
  Morocco: ['Algeria', 'Mauritania'],
  Mauritania: ['Morocco', 'Algeria', 'Mali', 'Senegal'],
  Mali: ['Algeria', 'Niger', 'Burkina Faso', 'Ivory Coast', 'Guinea', 'Senegal', 'Mauritania'],
  Senegal: ['Mauritania', 'Mali', 'Guinea', 'Guinea-Bissau', 'Gambia'],
  Gambia: ['Senegal'],
  'Guinea-Bissau': ['Senegal', 'Guinea'],
  Guinea: ['Guinea-Bissau', 'Senegal', 'Mali', 'Ivory Coast', 'Liberia', 'Sierra Leone'],
  'Sierra Leone': ['Guinea', 'Liberia'],
  Liberia: ['Sierra Leone', 'Guinea', 'Ivory Coast'],
  'Ivory Coast': ['Liberia', 'Guinea', 'Mali', 'Burkina Faso', 'Ghana'],
  'Burkina Faso': ['Mali', 'Niger', 'Benin', 'Togo', 'Ghana', 'Ivory Coast'],
  Ghana: ['Ivory Coast', 'Burkina Faso', 'Togo'],
  Togo: ['Ghana', 'Burkina Faso', 'Benin'],
  Benin: ['Togo', 'Burkina Faso', 'Niger', 'Nigeria'],
  Niger: ['Algeria', 'Libya', 'Chad', 'Nigeria', 'Benin', 'Burkina Faso', 'Mali'],
  Nigeria: ['Benin', 'Niger', 'Chad', 'Cameroon'],
  Chad: ['Libya', 'Sudan', 'Central African Republic', 'Cameroon', 'Nigeria', 'Niger'],
  Sudan: ['Egypt', 'Eritrea', 'Ethiopia', 'South Sudan', 'Central African Republic', 'Chad', 'Libya'],
  Eritrea: ['Sudan', 'Djibouti', 'Ethiopia'],
  Djibouti: ['Eritrea', 'Ethiopia', 'Somalia'],
  Somalia: ['Djibouti', 'Ethiopia', 'Kenya'],
  Ethiopia: ['Eritrea', 'Djibouti', 'Somalia', 'Kenya', 'South Sudan', 'Sudan'],
  'South Sudan': ['Sudan', 'Ethiopia', 'Kenya', 'Uganda', 'Democratic Republic of the Congo', 'Central African Republic'],
  'Central African Republic': ['Chad', 'Sudan', 'South Sudan', 'Democratic Republic of the Congo', 'Republic of the Congo', 'Cameroon'],
  Cameroon: ['Nigeria', 'Chad', 'Central African Republic', 'Republic of the Congo', 'Gabon', 'Equatorial Guinea'],
  'Equatorial Guinea': ['Cameroon', 'Gabon'],
  Gabon: ['Equatorial Guinea', 'Cameroon', 'Republic of the Congo'],
  'Republic of the Congo': ['Gabon', 'Cameroon', 'Central African Republic', 'Democratic Republic of the Congo', 'Angola'],
  'Democratic Republic of the Congo': ['Republic of the Congo', 'Central African Republic', 'South Sudan', 'Uganda', 'Rwanda', 'Burundi', 'Tanzania', 'Zambia', 'Angola'],
  Uganda: ['South Sudan', 'Kenya', 'Tanzania', 'Rwanda', 'Democratic Republic of the Congo'],
  Kenya: ['South Sudan', 'Ethiopia', 'Somalia', 'Tanzania', 'Uganda'],
  Rwanda: ['Uganda', 'Tanzania', 'Burundi', 'Democratic Republic of the Congo'],
  Burundi: ['Rwanda', 'Tanzania', 'Democratic Republic of the Congo'],
  Tanzania: ['Kenya', 'Uganda', 'Rwanda', 'Burundi', 'Democratic Republic of the Congo', 'Zambia', 'Malawi', 'Mozambique'],
  Angola: ['Republic of the Congo', 'Democratic Republic of the Congo', 'Zambia', 'Namibia'],
  Zambia: ['Democratic Republic of the Congo', 'Tanzania', 'Malawi', 'Mozambique', 'Zimbabwe', 'Botswana', 'Namibia', 'Angola'],
  Malawi: ['Tanzania', 'Mozambique', 'Zambia'],
  Mozambique: ['Tanzania', 'Malawi', 'Zambia', 'Zimbabwe', 'South Africa', 'Eswatini'],
  Zimbabwe: ['Zambia', 'Mozambique', 'South Africa', 'Botswana'],
  Botswana: ['Namibia', 'Zambia', 'Zimbabwe', 'South Africa'],
  Namibia: ['Angola', 'Zambia', 'Botswana', 'South Africa'],
  'South Africa': ['Namibia', 'Botswana', 'Zimbabwe', 'Mozambique', 'Eswatini', 'Lesotho'],
  Eswatini: ['Mozambique', 'South Africa'],
  Lesotho: ['South Africa'],

  // North & Central America
  Canada: ['United States'],
  'United States': ['Canada', 'Mexico'],
  Mexico: ['United States', 'Guatemala', 'Belize'],
  Belize: ['Mexico', 'Guatemala'],
  Guatemala: ['Mexico', 'Belize', 'Honduras', 'El Salvador'],
  'El Salvador': ['Guatemala', 'Honduras'],
  Honduras: ['Guatemala', 'El Salvador', 'Nicaragua'],
  Nicaragua: ['Honduras', 'Costa Rica'],
  'Costa Rica': ['Nicaragua', 'Panama'],
  Panama: ['Costa Rica', 'Colombia'],

  // South America
  Colombia: ['Panama', 'Venezuela', 'Brazil', 'Peru', 'Ecuador'],
  Venezuela: ['Colombia', 'Brazil', 'Guyana'],
  Guyana: ['Venezuela', 'Brazil', 'Suriname'],
  Suriname: ['Guyana', 'Brazil'],
  Ecuador: ['Colombia', 'Peru'],
  Peru: ['Ecuador', 'Colombia', 'Brazil', 'Bolivia', 'Chile'],
  Brazil: ['Venezuela', 'Guyana', 'Suriname', 'Colombia', 'Peru', 'Bolivia', 'Paraguay', 'Argentina', 'Uruguay'],
  Bolivia: ['Peru', 'Brazil', 'Paraguay', 'Argentina', 'Chile'],
  Paraguay: ['Bolivia', 'Brazil', 'Argentina'],
  Chile: ['Peru', 'Bolivia', 'Argentina'],
  Argentina: ['Chile', 'Bolivia', 'Paraguay', 'Brazil', 'Uruguay'],
  Uruguay: ['Brazil', 'Argentina'],
};

/**
 * Build a symmetric adjacency map restricted to known country names.
 * @param {Set<string>} validCountryNames
 * @returns {Map<string, Set<string>>}
 */
export function buildBorderGraph(validCountryNames) {
  const graph = new Map();
  for (const [country, neighbors] of Object.entries(RAW_BORDERS)) {
    if (validCountryNames && !validCountryNames.has(country)) continue;
    if (!graph.has(country)) graph.set(country, new Set());
    for (const neighbor of neighbors) {
      if (validCountryNames && !validCountryNames.has(neighbor)) continue;
      graph.get(country).add(neighbor);
      if (!graph.has(neighbor)) graph.set(neighbor, new Set());
      graph.get(neighbor).add(country);
    }
  }
  return graph;
}

/**
 * Find the shortest path between `start` and `target` using BFS.
 * Returns the full array `[start, ...intermediate, target]` or `null` if unreachable.
 *
 * @param {Map<string, Set<string>>} graph
 * @param {string} start
 * @param {string} target
 * @returns {string[]|null}
 */
export function findShortestBorderPath(graph, start, target) {
  if (start === target) return [start];
  if (!graph.has(start) || !graph.has(target)) return null;

  const queue = [[start]];
  const visited = new Set([start]);

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];
    const neighbors = graph.get(current) ?? [];

    for (const next of neighbors) {
      if (next === target) {
        return [...path, next];
      }
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }

  return null;
}

/**
 * Precompute all pairs of countries whose shortest path has a specific number of intermediate countries.
 * @param {Map<string, Set<string>>} graph
 * @param {number} minIntermediates
 * @param {number} maxIntermediates
 */
export function findRoutePairs(graph, minIntermediates = 1, maxIntermediates = 4) {
  const countries = [...graph.keys()].sort();
  const pairs = [];

  for (let i = 0; i < countries.length; i += 1) {
    const start = countries[i];
    // BFS from `start`
    const dist = new Map([[start, 0]]);
    const parent = new Map();
    const queue = [start];

    while (queue.length > 0) {
      const curr = queue.shift();
      const d = dist.get(curr);
      if (d >= maxIntermediates + 1) continue;
      for (const next of graph.get(curr) ?? []) {
        if (!dist.has(next)) {
          dist.set(next, d + 1);
          parent.set(next, curr);
          queue.push(next);
        }
      }
    }

    for (const [end, d] of dist.entries()) {
      const intermediates = d - 1;
      if (end > start && intermediates >= minIntermediates && intermediates <= maxIntermediates) {
        const path = [];
        let node = end;
        while (node !== undefined) {
          path.unshift(node);
          node = parent.get(node);
        }
        pairs.push({
          start,
          target: end,
          shortestPath: path,
          minSteps: intermediates,
        });
      }
    }
  }

  return pairs;
}
