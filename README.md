# Fleet Dozor Dashboard

Webová aplikace pro správu vozového parku postavená na GPS Dozor API.

## Pro koho a proč

Dashboard pro **dispečera nebo fleet manažera** — člověka, který potřebuje na jednom místě vidět, kde jsou vozidla, jak se pohybují, kolik spotřebovávají paliva a mít rychlý přehled o jízdách. Cílem bylo vytvořit intuitivní rozhraní, které reálně nahrazuje nebo doplňuje základní pohled v GPS Dozor portálu — bez nutnosti proklikávat různé sekce. Aplikace zpřístupňuje data přehledně a rychle, s důrazem na praktické využití v běžném provozu.

## Funkce

- **Live mapa** — všechna vozidla flotily na mapě s auto-refreshem (30s), přepínač LIVE/TRASA pro zobrazení historických tras
- **Detail vozidla** — rychlost, stav, celkový nájezd, aktuální množství paliva, max. rychlost dnes, počet jízd, relay stav motoru
- **Kniha jízd** — přehled jízd za zvolené období (defaultně posledních 7 dní) s možností rozkliknout detail každé jízdy, měsíční přehled po dnech s grafem
- **Spotřeba paliva** — analýza spotřeby s denním přehledem, grafem průměrné spotřeby (l/100km), trendem a KPI kartami
- **Počasí** — integrace OpenWeatherMap API zobrazující aktuální počasí na pozici vybraného vozidla
- **Vyhledávání** — rychlé filtrování vozidel podle jména nebo SPZ s tlačítkem "Zpět"
- **Responsivní layout** — mobilní i desktopové zobrazení

## AI workflow

Celý vývoj probíhal s **Claude (claude.ai)** v průběhu několika dnů:

1. **Analýza zadání** — Claude načetl PDF s požadavky a API dokumentaci, navrhl architekturu - schváleno
2. **Prototyp** — vygeneroval funkční Vue 3 aplikaci s živými daty pro rychlé ověření konceptu
3. **Iterativní vývoj** — každá komponenta (VehicleList, MapView, TripBook, FuelAnalysis, VehicleDetail) byla postupně vylepšována podle mojí zpětné vazby
4. **Responsivita** — mobilní layout s přeuspořádáním sekcí (mapa dole, data nahoře)
5. **Integrace API** — přidání OpenWeatherMap, senzory paliva, validace dat

## Problémy a řešení

**CORS:** GPS Dozor API vrací správné hlavičky pro demo přístupy → funguje přímo z frontendu. Pro produkci s vlastními credentials by byl potřeba backend proxy (Vite dev server proxy / Netlify Functions).
Vyřešeno nakopírováním chybových hlášení z konzole prohlížeče do Claude, který navrhnul opravu.

**Eco Driving:** Původně zobrazeno, ale data byla dostupná jen u jednoho vozidla, což nevypadalo dobře. Nahrazeno **spotřebou paliva** (FuelAnalysis komponenta) — praktičtější a data jsou dostupná u všech vozidel.

**Palivo v detailu:** Nejdříve pokus o zachycení hodnoty sensoru `FuelActualVolume`, ale ne všechna vozidla ho měla. Řešení: fallback na poslední jízdu (`FuelConsumed` z trips).

Dále drobné opravy/vylepšení původního návrhu, které se v průběhu vytváření ukázaly jako lepší, například korekce barev a velikosti písma, přejmenování některých výrazů, zadávání datumu v kalendáři apod.

## Co bych přidal v budoucnu

**Funkce a UX/UI:**

- Skrývání/přidávání panelů (customizace dashboardu podle požadavků konkrétního uživatele, nejlépe drag & drop)
- Pokročilejší filtry (datum, řidič, typ jízdy)
- Eco-driving skóre a porovnání řidičů napříč flotilou
- Výpočet nákladů na palivo (cena/litr × spotřeba)
- Editace jízd (účel, poznámky, kategorie výdajů)
- Push notifikace při překročení rychlosti / opuštění geozóny
- Export dat (PDF/CSV knihy jízd, reporty)
- Animace, mikroanimace pro lepší uživatelský zážitek
- atd.

**Technické:**

- Zakomponování více error hlášení, některá demo data se nezobrazují korektně a není jasné, jestli je to chyba aplikace nebo data nejsou zadána
- Backend proxy pro bezpečné API credentials
- Cache pro zrychlení opakovaných dotazů

**Tech stack**

- Vue 3 + Vite
- Leaflet.js — interaktivní mapa
- Chart.js — grafy spotřeby a jízd
- OpenWeatherMap API — aktuální počasí
- CSS Variables — design systém bez UI frameworku
- Vite Proxy — CORS řešení pro dev prostředí

Funkční demo zde:
https://fleet-dozor-demo.netlify.app/
