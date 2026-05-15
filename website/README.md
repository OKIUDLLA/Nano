# Zahradnictví Jiřina — Žatčany (web)

Statický web pro **Zahradnictví Jiřina** v Žatčanech (provozovatel Jiřina Franklová).
Pět stránek, žádné závislosti, otevře se z disku i z libovolného statického hostingu.

## Otevření

Otevřete `index.html` ve webovém prohlížeči, nebo spusťte lokální server:

```bash
cd website
python3 -m http.server 8080
# pak: http://localhost:8080
```

## Struktura

```
website/
├── index.html        ← úvodní stránka (hero, otevírací doba, sezónní tip)
├── sortiment.html    ← sazenice, květiny, trvalky, pokojovky, keramika
├── sluzby.html       ← zahradní služby, vazba, advent, svatba, dušičky
├── zoo.html          ← malá ZOO v areálu zahradnictví
├── kontakt.html      ← kontakt, otevírací doba, mapa, externí profily
├── css/style.css     ← všechny styly (responsivní, mobile-first)
└── js/main.js        ← otevírací doba "živě", mobilní menu, rok v patičce
```

## Zdroje informací

Data o firmě byla získána z veřejných zdrojů:

- https://ujezdubrna.cz/spol/zahradnictvi-franklova-jirina
- https://zahradnictvi-zatcany.webnode.cz/
- https://www.firmy.cz/detail/2473196-zahradnictvi-jirina-zatcany.html
- https://obeczatcany.cz/ (články o nabídce zahradnictví)
- https://www.ceskestavby.cz/firmy/jirina-franklova.html
- https://www.nej-firmy.cz/firma/131192-zahradnictvi-zatcany-br-jirina-franklova

## Kontakt firmy

- **Adresa:** Žatčany 28, 664 53 Žatčany
- **Telefon:** 776 030 447
- **E-mail:** jirina.franklova@seznam.cz
- **IČO:** 75140276

## Otevírací doba

| Den           | Hodiny                  |
|---------------|-------------------------|
| Pondělí–Pátek | 9:00–11:00 a 13:00–17:00 |
| Sobota        | 8:00–17:00              |
| Neděle        | zavřeno                 |

Mimo otevírací dobu po telefonické domluvě.

## Poznámky pro úpravy

- **Otevírací doba** je řízena polem `SCHEDULE` v `js/main.js` — měnit jen tam,
  HTML se vygeneruje automaticky.
- **Sortiment ZOO** v `zoo.html` je odhadnutý dle dostupných veřejných informací
  (zmiňována jen "malá Zoo"); konkrétní seznam zvířat doporučujeme ověřit
  s majitelkou a upravit přímo v `zoo.html`.
- **Soc. sítě:** Vlastní Facebook/Instagram firmy se ve veřejných zdrojích nepodařilo
  dohledat. Až bude existovat, doplňte odkazy do patičky všech stránek a do
  `kontakt.html` sekce „Najdete nás taky".
