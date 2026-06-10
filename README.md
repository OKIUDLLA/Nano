# Věky Války ⚔️

Jednoduchá **idle hra** ve stylu *Age of War* – běží přímo v prohlížeči, bez instalace
a bez závislostí. Čistý HTML + CSS + JavaScript (Canvas).

## Jak hrát

Otevři soubor `index.html` v prohlížeči (stačí na něj dvakrát kliknout) – víc není potřeba.

### Cíl

Znič nepřátelskou základnu (vpravo) dřív, než nepřítel zničí tu tvoji (vlevo).

### Mechaniky

- **Zlato** 💰 získáváš pasivně v čase a za poražené nepřátele. Utrácíš ho za najímání jednotek.
- **Zkušenosti** ⭐ získáváš za poražené nepřátele. Slouží k postupu do dalšího věku.
- **Věky** 🏛️ – postupně odemykáš 5 věků (Pravěk → Antika → Středověk → Moderní doba → Budoucnost),
  každý s lepšími jednotkami.
- **Jednotky** – každý věk nabízí tři druhy:
  - 🛡 boj zblízka (levné, rychlé),
  - 🏹 střelci (útok na dálku),
  - 🐘 tank (drahý, hodně zdraví a útoku).
- **Meteor** ☄️ – speciální útok, který zraní všechny nepřátele na bojišti (cooldown 30 s).
- **Automatické posílání** 🤖 – zaškrtni a hra bude sama posílat vybranou jednotku (idle režim).
  Jednotku pro automat vybereš hvězdičkou ★ na kartě.

## Tipy

- Z počátku stav na levné jednotky a sbírej zkušenosti na první postup.
- Kombinuj boj zblízka (drží linii) se střelci (pálí zezadu).
- Nech zapnuté automatické posílání a věnuj se postupu mezi věky a meteoru.

## Struktura projektu

```
index.html      – stránka a HUD
css/style.css   – vzhled
js/game.js      – veškerá herní logika (stav, souboj, AI, vykreslování)
```

## Vývoj

Žádný build krok není potřeba. Stačí upravit soubory a obnovit stránku v prohlížeči.
