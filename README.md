# Fleet Dozor

Aplikace pro správu vozového parku postavená nad GPS Dozor API.

## Pro koho a proč

Dashboard pro **dispečera nebo fleet manažera** — člověka, který potřebuje na jednom místě vidět kde jsou jeho vozidla, jak se řidiči chovají za volantem a mít rychlý přehled o jízdách. Cílem bylo vytvořit appku, která reálně nahrazuje nebo doplňuje základní pohled v GPS Dozor portálu pro situace, kdy chcete data rychle přečíst bez nutnosti proklikávat různé sekce.

## Funkce

- **Live mapa** — všechna vozidla flotily na mapě s auto-refreshem (30s)
- **Kniha jízd** — přehled jízd za zvolené období s řidičem, vzdáleností a průměrnou rychlostí
- **Eco Driving** — sloupcový graf stylu jízdy (brzdění, akcelerace, průjezdy zatáčkami)
- **GPS trasa** — přepínač LIVE/TRASA zobrazí historickou trasu vozidla na mapě
- **Vyhledávání** vozidel podle jména nebo SPZ

## Použité API endpointy

| Endpoint | Použití |
|---|---|
| `/groups` | Načtení skupiny flotily |
| `/vehicles/group/{code}` | Live seznam vozidel |
| `/vehicle/{code}/trips` | Kniha jízd |
| `/vehicle/{code}/eco-driving-events` | Eco driving data |
| `/vehicles/history/{codes}` | GPS trasa na mapě |

## Tech stack

- **Vue 3** + Vite
- **Leaflet.js** — mapa
- **Chart.js** — eco driving graf
- **CSS Variables** — design systém bez UI frameworku

## AI workflow

Celý vývoj probíhal s **Claude (claude.ai)**:

1. Načetl jsem API dokumentaci a popsal záměr → Claude navrhl architekturu
2. Claude vygeneroval funkční HTML prototyp s živými daty pro rychlé ověření konceptu
3. Prototyp byl přestrukturován do Vue 3 komponent (VehicleList, MapView, TripBook, EcoDriving, VehicleDetail)
4. Každá komponenta byla iterována samostatně

**Co fungovalo dobře:** Rychlé přepsání HTML prototypu do Vue komponent, návrh struktury `api/gpsdozor.js` jako single source of truth pro všechny API volání.

**Na co jsem narazil:** CORS — GPS Dozor API vrací správné hlavičky pro demo přístupy, takže to funguje přímo z frontendu. Pro produkci s vlastními credentials by bylo lepší použít backend proxy (např. Netlify Functions).

## Instalace

```bash
cp .env.example .env   # vyplň credentials
npm install
npm run dev
```

## Co bych přidal s více času

- **Upozornění** — push notifikace při překročení rychlosti nebo opuštění geozóny
- **Srovnání řidičů** — eco driving skóre napříč celou flotilou
- **Export** — PDF/CSV export knihy jízd
- **Tmavý/světlý režim** přepínač
- Backend proxy pro bezpečné skrytí API credentials
