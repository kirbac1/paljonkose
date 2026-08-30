/**
 * i18n-ui.mjs — käyttöliittymän tekstit.
 *
 * Funktiot ottavat argumentteja siellä, missä teksti sisältää lukuja.
 * Näin kielikohtainen sanajärjestys säilyy — merkkijonojen liimaaminen
 * yhteen toimii suomeksi ja hajoaa englanniksi tai päinvastoin.
 */

export const LANGS = ["fi", "en"];
export const DEFAULT_LANG = "fi";

/* Polut kielittäin. Englanninkieliset sivut elävät /en/-etuliitteen alla
   ja käyttävät englanninkielisiä slugeja, jotta osoite on luettava. */
export const PATHS = {
  fi: { root: "",    p: "p", overruns: "ylitykset", receipt: "kuitti", sum: "summa" },
  en: { root: "/en", p: "p", overruns: "overruns",  receipt: "tax-receipt", sum: "sum" }
};

export const T = {
  fi: {
    locale: "fi-FI",
    siteName: "Paljonko se on?",
    langName: "Suomeksi",
    otherLangName: "In English",

    yourShare: "Sinun osuutesi:",
    perPerson: (who) => `${who} kohden`,
    ifEveryone: "Jos jokainen suomalainen ostaisi tämän kerran:",
    showCalc: "Näytä laskutoimitus",
    copyLink: "Kopioi linkki",
    copied: "Kopioitu ✓",
    copyFailed: "Kopiointi ei onnistunut",
    downloadImage: "Lataa kuva",
    sameSum: "Sama summa toisin mitattuna",
    unitPrice: "yksikköhinta",
    residents: (scope) => `asukasta (${scope})`,
    wholeCountry: "koko maa",
    leftOver: (n) => `jää yli ${n} €`,

    numerator: "Osoittaja.",
    denominator: "Nimittäjä.",
    retrieved: "haettu",
    originalSource: "alkuperäinen lähde:",
    edited: (orig, used) =>
      `Huom: yksikköhintaa on muutettu. Alkuperäinen arvio oli ${orig} €, tässä on käytetty ${used} €.`,

    caveatTitle: "Mitä tämä ei kerro.",
    caveatState: (unit) =>
      `Jakolasku olettaa että euro on euro. Oikeasti raha on sidottu momenttiin ja hallinnonalaan, eikä ${unit} makseta samasta pussista. Luku kertoo mittasuhteen, ei toteutettavaa vaihtoehtoa.`,
    caveatCity:
      "Tämä on kaupungin omaa rahaa, joten vertailu on lähempänä aitoa vaihtoehtoa kuin valtion menoissa — päiväkodit ja koulut maksetaan samasta budjetista. Silti: investointi ja käyttötalous ovat eri momentteja, iso hanke rahoitetaan yleensä lainalla ja jaksotetaan vuosille, eikä sote-palveluita enää makseta kaupungin kassasta vaan hyvinvointialueelta.",

    rivalTitle: "Tässä vertailu on aito.",
    rivalBody: "Samasta ratarahasta kilpailevat myös:",
    rivalTail:
      "Näiden välillä valinta on todellinen — toisin kuin vertailussa kokonaan eri hallinnonalojen välillä.",

    forecastTitle: "Tämä on arvio, ei toteutunut hinta.",
    forecastBody: (n, kerroin, hinta, maara, unit) =>
      `${n} vertailukelpoista suomalaista suurhanketta maksoi lopulta mediaanissa ${kerroin}× arvionsa. Jos sama toistuu, hinta olisi ${hinta} — eli ${maara} ${unit}.`,
    forecastTail: "Yksi hankkeista alitti budjettinsa, joten tämä ei ole luonnonlaki.",

    /* Ylitysrekisteri */
    overrunsTitle: "Arvio vs. toteutunut",
    overrunsLede:
      "Suomalaisten suurhankkeiden alkuperäiset kustannusarviot ja lopulliset hinnat. Kaikki hankkeet, joista molemmat luvut ovat saatavilla — myös ne, jotka alittivat budjettinsa.",
    colProject: "Hanke", colEstimate: "Arvio", colActual: "Toteutunut",
    colDiff: "Erotus", colRatio: "Kerroin",
    medianLine: (m, n) => `<strong>Mediaani ${m}×</strong> (${n} hanketta). Mediaani eikä keskiarvo, jottei yksi karkaava hanke vääristä kuvaa.`,
    overrunsCaveat:
      "Vertailukelpoisuus on tulkinnanvaraista: hankkeen sisältö, laajuus ja hintataso muuttuvat suunnittelun aikana, eikä jokainen ylitys ole virhe. Osa eroista selittyy inflaatiolla, osa laajennuksilla, joista on päätetty erikseen. Alkuperäisen arvion vuosi on merkitty jokaisen hankkeen kohdalle. Otos on pieni.",

    /* Verokuitti */
    receiptTitle: "Verokuitti",
    receiptLede:
      "Syötä vuosiansiosi, niin näet arvion maksamastasi verosta ja siitä, mihin valtion osuus siitä jakautuu. Karkea suuruusluokka-arvio — ei veroneuvo.",
    grossIncome: "Vuosiansio, brutto",
    calculate: "Laske",
    stateTax: "Valtion tulovero",
    municipalTax: "Kunnallisvero",
    municipalNote: (p) => `${p} % — vaihtelee kunnittain`,
    contributions: "Eläke- ja työttömyysvakuutusmaksut",
    contributionsNote: "ei veroa, mutta palkasta",
    total: "Yhteensä",
    whereItWent: "Mihin valtion tuloverosi meni",
    colMainClass: "Pääluokka", colShare: "Osuus", colYourEuros: "Sinun euroistasi",
    receiptCaveat: (p) =>
      `Laskelma käyttää valtion tuloveroasteikkoa ja ${p} %:n kunnallisveroa, eikä huomioi vähennyksiä, pääomatuloja, kirkollisveroa tai kotikuntasi todellista veroprosenttia — todellinen veroprosenttisi poikkeaa tästä. Jako pääluokkiin on laskennallinen: verot menevät yhteiseen kassaan, eikä yksittäistä euroa voi jäljittää tiettyyn menoon. Kunnallisveroa ei ole jaettu tässä lainkaan.`,

    /* Vapaa summa */
    sumTitle: "Mitä sillä sais?",
    sumLede: "Mitä tällä summalla saisi? Syötä mikä tahansa luku — vaikka uutisesta poimittu.",
    sumEmpty: "Syötä summa yllä.",
    sumPerCapita: (e) => `Koko maan mitassa tämä on <strong>${e}</strong> jokaista suomalaista kohden.`,
    sumCaveat:
      "Jakolasku ei ole päätös. Yksikköhinnat ovat keskiarvoja, ja oikeassa hankkeessa hinta riippuu paikasta, laajuudesta ja ajankohdasta. Raha ei myöskään ole vapaasti siirrettävissä menokohteesta toiseen."
  },

  en: {
    locale: "en-GB",
    siteName: "What would that buy?",
    langName: "In English",
    otherLangName: "Suomeksi",

    yourShare: "Your share:",
    perPerson: (who) => `per ${who}`,
    ifEveryone: "If everyone in Finland bought this once:",
    showCalc: "Show the calculation",
    copyLink: "Copy link",
    copied: "Copied ✓",
    copyFailed: "Copying failed",
    downloadImage: "Download image",
    sameSum: "The same sum, measured differently",
    unitPrice: "unit price",
    residents: (scope) => `residents (${scope})`,
    wholeCountry: "whole country",
    leftOver: (n) => `${n} € left over`,

    numerator: "Numerator.",
    denominator: "Denominator.",
    retrieved: "retrieved",
    originalSource: "original source:",
    edited: (orig, used) =>
      `Note: the unit price has been changed. The original estimate was ${orig} €; ${used} € was used here.`,

    caveatTitle: "What this does not tell you.",
    caveatState: (unit) =>
      `The division assumes a euro is a euro. In reality the money is tied to a specific budget line and administrative branch, and ${unit} are not paid from the same pot. The figure shows a sense of scale, not a workable alternative.`,
    caveatCity:
      "This is the city's own money, so the comparison is closer to a real alternative than with central government spending — daycare centres and schools are paid from the same budget. Even so: investment and operating budgets are separate lines, a large project is usually financed with debt and spread over several years, and health and social services are no longer paid from the city's coffers but by the wellbeing services county.",

    rivalTitle: "Here the comparison is a real one.",
    rivalBody: "The same rail funding is also being sought by:",
    rivalTail:
      "The choice between these is genuine — unlike a comparison across entirely different branches of government.",

    forecastTitle: "This is an estimate, not a final cost.",
    forecastBody: (n, kerroin, hinta, maara, unit) =>
      `${n} comparable Finnish megaprojects ended up costing a median of ${kerroin}× their estimate. If that repeats, the cost would be ${hinta} — that is ${maara} ${unit}.`,
    forecastTail: "One of the projects came in under budget, so this is not a law of nature.",

    overrunsTitle: "Estimate vs. actual",
    overrunsLede:
      "Original cost estimates and final prices for Finnish megaprojects. Every project for which both figures are available — including those that came in under budget.",
    colProject: "Project", colEstimate: "Estimate", colActual: "Actual",
    colDiff: "Difference", colRatio: "Ratio",
    medianLine: (m, n) => `<strong>Median ${m}×</strong> (${n} projects). Median rather than mean, so that one runaway project does not distort the picture.`,
    overrunsCaveat:
      "Comparability is a matter of judgement: a project's content, scope and price level change during planning, and not every overrun is a mistake. Some of the difference is inflation, some is expansions decided separately. The year of the original estimate is noted for each project. The sample is small.",

    receiptTitle: "Tax receipt",
    receiptLede:
      "Enter your annual earnings to see an estimate of the tax you pay and how the state's share of it is divided. A rough sense of scale — not tax advice.",
    grossIncome: "Annual earnings, gross",
    calculate: "Calculate",
    stateTax: "State income tax",
    municipalTax: "Municipal tax",
    municipalNote: (p) => `${p} % — varies by municipality`,
    contributions: "Pension and unemployment insurance contributions",
    contributionsNote: "not tax, but taken from pay",
    total: "Total",
    whereItWent: "Where your state income tax went",
    colMainClass: "Main class", colShare: "Share", colYourEuros: "Of your euros",
    receiptCaveat: (p) =>
      `The calculation uses the state income tax scale and a municipal tax rate of ${p} %, and ignores deductions, capital income, church tax and your own municipality's actual rate — your real tax rate will differ. The split by main class is notional: taxes go into a common pot, and no individual euro can be traced to a particular expenditure. Municipal tax is not allocated here at all.`,

    sumTitle: "What would that buy?",
    sumLede: "What would this sum buy? Enter any figure — one picked out of the news, for instance.",
    sumEmpty: "Enter a sum above.",
    sumPerCapita: (e) => `Across the whole country this is <strong>${e}</strong> per person in Finland.`,
    sumCaveat:
      "A division is not a decision. Unit prices are averages, and in a real project the price depends on location, scope and timing. Money is also not freely transferable from one purpose to another."
  }
};

export const t = (lang) => T[lang] || T[DEFAULT_LANG];
export const paths = (lang) => PATHS[lang] || PATHS[DEFAULT_LANG];
