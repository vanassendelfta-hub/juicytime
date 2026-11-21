# Juicy Time bestelsite

Statische bestelsite (HTML/CSS/JS, geen build) voor Juicy Time, cocktails to go in Rotterdam.

Instellingen staan bovenin `app.js` (`CONFIG`): WhatsApp-nummer, bezorgkosten, tijdsloten.
Bestellingen gaan als ingevuld WhatsApp-bericht naar de zaak (Instagram-DM als terugval zolang er geen nummer is).

## Beheer

De zaak past de site zelf aan via `/beheer/` (link onderaan de site), met het Mijn Flowsmid-account (`juicytime`).
Daar staan: melding bovenaan de site, cocktails (naam, omschrijving, label, uitverkocht/verbergen), prijzen en bezorgkosten,
bestel- en bezorgtijden per dag (en tijdelijk gesloten) en contactgegevens.

- `beheer/site.js`: welke onderdelen er in het beheer staan en de beginwaarden (= wat nu in `app.js` staat).
- `beheer/beheer.js` en `beheer/beheer.css`: het gedeelde Flowsmid-beheer (gelijk voor alle voorbeeldsites).
- `fs-inhoud.js`: haalt de opgeslagen inhoud op (`flowsmid.site_inhoud_publiek`) en zet de melding op de site; `app.js` past de rest toe.

Opslag: tabel `flowsmid.site_inhoud` in het Supabase-project van Flowsmid. Zonder verbinding toont de site gewoon de waarden uit `app.js`.
