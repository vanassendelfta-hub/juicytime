/* Basis beheer van Juicy Time: welke onderdelen de zaak zelf kan aanpassen, en de huidige inhoud van de site als beginwaarde. */
window.FS_BEHEER = {
  slug: 'juicytime',
  naam: 'Juicy Time',
  site: '/',
  secties: ['overzicht', 'melding', 'menu', 'instellingen', 'tijden', 'contact'],
  titels: { menu: 'Cocktails', tijden: 'Bestel- en bezorgtijden' },
  tijden: {
    uitleg: 'Tussen deze tijden kunnen klanten een ophaal- of bezorgmoment kiezen. Op gesloten dagen kan niet worden besteld.',
    geslotenHulp: 'Als dit aan staat, kan niemand bestellen en zien bezoekers deze tekst bij het afrekenen.'
  },
  menu: {
    prijs: false, label: true, toevoegen: false,
    uitleg: 'Pas namen, omschrijvingen en labels aan. Uitverkocht = zichtbaar maar niet te bestellen; verbergen = tijdelijk van de site. De prijs geldt voor alle cocktails en stel je in bij Prijzen en bezorgen.'
  },
  instellingen: [
    { sleutel: 'prijs1', label: 'Prijs per cocktail', soort: 'euro', verplicht: true },
    { sleutel: 'prijs3', label: 'Prijs voor 3 cocktails', soort: 'euro', verplicht: true, hulp: 'De korting wordt automatisch berekend.' },
    { sleutel: 'bezorgkosten', label: 'Bezorgkosten', soort: 'euro', leeg: 'in overleg', hulp: 'Leeg laten = "in overleg".' },
    { sleutel: 'feestVanaf', label: 'Feestprijs vanaf (aantal)', soort: 'getal', min: 5, max: 500, hulp: 'Vanaf dit aantal vragen klanten een prijs op maat aan.' },
    { sleutel: 'voorbereiding', label: 'Minimaal vooruit bestellen (minuten)', soort: 'getal', min: 0, max: 1440, stap: 15 },
    { sleutel: 'tijdvak', label: 'Tijdvak (minuten)', soort: 'getal', min: 15, max: 120, stap: 15 }
  ],
  contact: [
    { sleutel: 'whatsapp', label: 'WhatsApp-nummer', soort: 'tel', voorbeeld: '06 12345678', hulp: 'Bestellingen komen dan via WhatsApp binnen. Leeg = alleen via Instagram.' },
    { sleutel: 'instagram', label: 'Instagram-naam', voorbeeld: 'jjuicytime' },
    { sleutel: 'email', label: 'E-mailadres', soort: 'email', voorbeeld: 'info@juicytime.nl', hulp: 'Optioneel: bestellingen ook per mail.' },
    { sleutel: 'gebied', label: 'Werkgebied', voorbeeld: 'Rotterdam en omgeving' }
  ],
  standaard: {
    melding: { aan: false, tekst: '' },
    tijden: {
      gesloten: false, geslotenTekst: '',
      dagen: [0, 1, 2, 3, 4, 5, 6].map(function () { return { open: true, van: '12:00', tot: '22:00' }; })
    },
    menu: [{ naam: '', items: [
      { id: 'juicy-lychee', naam: 'Juicy Lychee', label: 'Nieuw', omschrijving: 'Zacht en fruitig met lychee, afgemaakt met munt en een eetbaar bloemetje.' },
      { id: 'sangria', naam: 'Sangría', label: '', omschrijving: 'Rode wijn met sinaasappel en aardbei. Hiervoor hoef je niet naar Spanje.' },
      { id: 'sex-on-the-beach', naam: 'Sex on the Beach', label: 'Favoriet', omschrijving: 'De zomerklassieker: vodka, perzik, sinaasappel en cranberry.' },
      { id: 'pornstar-martini', naam: 'Pornstar Martini', label: '', omschrijving: 'Passievrucht en vanille met vodka. Zoet, fris en een tikje exotisch.' }
    ] }],
    instellingen: { prijs1: 4.5, prijs3: 10, bezorgkosten: null, feestVanaf: 20, voorbereiding: 60, tijdvak: 30 },
    contact: { whatsapp: '', instagram: 'jjuicytime', email: '', gebied: 'Rotterdam en omgeving' }
  }
};
