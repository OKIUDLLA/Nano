# Balanc – metodika a výsledky simulací

Jádro hry je deterministické a běží v Node, takže balanc neodhadujeme, ale **měříme**:
`node tools/sim.mjs [her] [maxMinut] [classic|smart|all] [obtížnost|all]` odehraje N her pro každou
kombinaci *skriptovaná strategie hráče × AI × obtížnost* a vypíše win-rate, délku a dosažený věk.
Stejný seed = stejná hra, takže každý výsledek lze reprodukovat.

## Skriptované strategie hráče (tools/sim.mjs)

| Strategie | Co dělá | K čemu slouží |
|---|---|---|
| `spam` | pořád posílá nejdražší dostupnou jednotku, evolvuje hned, 1 věž | "nováček, který klikal na nejdražší kartu" |
| `turtle` | 4 sloty, nejlepší věže, levné jednotky, bez šetření | obranný hráč bez plánu |
| `balanced` | mix jednotek podle složení soupeře, 2 věže | průměrný hráč |
| `pro` | známá meta originálu: Vaječný automat hned, farmit věžemi, 4 sloty s nejlepší věží věku, nepushovat, v Budoucnosti šetřit na 2 Super vojáky + výplň | "zkušený hráč" – kalibrace vyhratelnosti |
| `idle` | jen jedna věž, nic víc | sanity: každá AI musí vyhrát |

## Výstup klasické AI (jednotky zdarma)

Klasická AI originálu neplatí za jednotky; trénuje s pravděpodobností 30 % každou sekundu, když
netrénuje a má < 6 jednotek naživu. Odhad hodnoty vyslaných jednotek (průměrná cena ÷ (výcvik + ~3.3 s čekání)):

| Věk | Průměrná cena jednotky | Tempo | ≈ zlato/s "zdarma" |
|---|---|---|---|
| 0 | 47 | ~4.8 s | ~10 |
| 1 | 208 | ~5.6 s | ~37 |
| 2 | 533 | ~6.6 s | ~80 |
| 3 | 3 500 | ~7 s | ~500 |
| 4 | 10 333 | ~7 s | ~1 500 |

Limit 6 živých jednotek to v praxi snižuje (když jednotky přežívají, netrénuje).

## Chytrá AI – proč má pevný příjem

Ekonomika originálu dává zlato **jen za zabité jednotky**. AI, která by hrála přesně podle pravidel
hráče, proti pasivnímu hráči vyhladoví (nemá koho zabíjet → nemá zlato → nemůže útočit), a dvě
„želvy“ se čtyřmi věžemi skončí patem. Proto chytrá AI dostává pevný příjem zhruba v polovině
hodnoty jednotek, které klasická AI posílá zdarma, a utrácí ho rozumně (vlny, věže, special):

| Obtížnost | Reakce | Odměna za kill | Start | Příjem podle věku (zlato/s) | Max věží |
|---|---|---|---|---|---|
| Normální | 1.5 s | ×1.0 | 175 | 5 / 15 / 35 / 200 / 600 | 2 |
| Těžší | 1.0 s | ×1.3 | 300 | 8 / 24 / 55 / 320 / 950 | 3 |
| Nemožná | 0.5 s | ×1.8 | 600 | 12 / 38 / 90 / 500 / 1500 | 4 |

Po 15. minutě roste příjem o 4 % za minutu (anti-pat). Statistiky jednotek se **nenásobí** (férový souboj).

## Výsledky (8 her na kombinaci, limit 45 min, seedy 2000–2007)

### Klasická AI (věrný originál)
| Obtížnost | spam | turtle | balanced | pro | idle |
|---|---|---|---|---|---|
| Normální | 70 % | 60 % | 0 % (pat) | **100 %, ~20 min** | 0 % (prohra ~3 min) |
| Těžší | 0 % | 0 % | 0 % | **100 %, ~23 min** | 0 % |
| Nemožná | 0 % | 0 % | 0 % | 0 % (prohra ~11 min) | 0 % |

Interpretace: odpovídá reputaci originálu – Normal/Harder se dají vyhrát známou meta strategií
(věže → Super vojáci), Impossible (×2 HP a dmg) rozdrtí turtle; bez Super vojáků proti jednotkám
zdarma vyhrát nelze (výměna jednotek je vždy prodělečná).

### Chytrá AI
| Obtížnost | spam | turtle | balanced | pro | idle |
|---|---|---|---|---|---|
| Normální | 13 % | pat | pat | **100 %, ~37 min** | 0 % (prohra ~1 min) |
| Těžší | 0 % | pat | pat | **88 %, ~29 min** | 0 % |
| Nemožná | 0 % | pat | pat | 25 % | 0 % |

Interpretace: pasivní a bezhlavé hráče porazí, zkušeného na Normální/Těžší pustí k výhře, Nemožná
je výzva. Pat „želva vs. želva“ zůstává strukturální vlastností ekonomiky (hráč, který nikdy
nezaútočí, nemůže vyhrát ani prohrát) – řeší ho eskalace příjmu AI a kolony Super vojáků v Budoucnosti.

## Pozorování z tras (tools/sim.mjs + ruční trasování)
- Jednotky se řadí do zástupu (originál): velké jednotky (Tank 174 px, Válečný stroj 117 px) blokují
  vše za sebou → masa 15 jednotek na středu bojiště nic nevyřeší, rozhoduje, kdo prorazí k základně.
- 4 Iontové paprsky (960 DPS) zabijí Super vojáka (4000 HP) za ~4 s; na proražení hradby jsou potřeba
  ≥ 2–3 SS v koloně s výplní vpředu. Proto chytrá AI v Budoucnosti při přebytku posílá [výplň, SS, SS, SS, výplň].
- Balistické střely (prak, katapulty) míří přímo na cíl bez předsazení – pohyblivé cíle míjejí,
  stojící (u základny) trefují spolehlivě. To je autentické chování originálu.
