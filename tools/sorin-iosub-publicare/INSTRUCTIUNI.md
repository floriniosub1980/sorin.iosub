# Sorin Iosub — publicare incrementală în Cloudflare R2

Python 3.10+ (inclusiv 3.14), Windows 10/11. Un singur catalog public: `https://media.soriniosub.com/data/artworks.json`.

## Instalare / actualizare

1. Descarcă arhiva din `tools/sorin-iosub-publicare/Sorin_Iosub_Automatizare_Publicare_R2.zip` din GitHub.
2. **Fă o copie de siguranță a folderului actual de publicare.** Dezarhivează pachetul peste fișierele de program existente, fără să ștergi directoarele `incoming`, `state`, `logs` și `output`. Nu șterge fotografiile originale.
3. La prima instalare rulează `INSTALEAZA_DEPENDINTE.bat`; pentru rulările ulterioare este suficient `PORNESTE_PUBLICAREA.bat`.
4. Dacă Python este deja instalat și funcționează cu `python --version`, fișierul BAT îl detectează automat.

## Cum folosești scriptul

1. Copiază fotografiile noi în folderul **`incoming`**, alături de cele vechi. Nu este nevoie să ștergi sau să muți imaginile anterioare.
2. Rulează **`PORNESTE_PUBLICAREA.bat`**.
3. Scriptul citește catalogul public R2 și compară fiecare fotografie cu **registrul local al imaginilor publicate** (amprentă SHA-256). Fotografiile deja publicate și ID-urile care există în catalog sunt **omise automat**, fără conversie și fără reupload.
4. Numai pentru fotografiile noi, alege categoria: `1 = Painting`, `2 = Graphic art`, `3 = Frescoes`, `0 = omite`. Confirmă ID-ul sugerat din numele fișierului; poți să-l corectezi.
5. Opțional completează titlul, anul, tehnica, dimensiunile, descrierea RO/EN și textul alternativ.
6. Sunt generate câte două fișiere fără crop: `full.webp` (latura maximă 2600 px) și `thumbnail.webp` (640 px). Se actualizează și validează `data/artworks.json`.
7. Confirmă publicarea R2 (imaginile se încarcă înaintea JSON-ului). După succes, fotografiile sunt înregistrate ca publicate.

## Fișiere de istoric și jurnal

Acestea **rămân local pe calculator** și **nu se încarcă în Cloudflare R2**:

| Fișier | Ce conține |
|---|---|
| `state/publicate.json` | ID-ul lucrării, numele fotografiei, categoria, amprenta SHA-256, data UTC și sesiunea de publicare. Folosit pentru evitarea duplicatelor. |
| `logs/publicari.csv` | Jurnal simplu, deschis în Excel: dată/ora UTC, fișier, ID, categorie, etapă, rezultat/eroare. |
| `logs/publicari.jsonl` | Aceleași evenimente, în format JSON pentru diagnostic / analiză automată. |
| `output/publicare_.../backup_catalog_r2_before_upload.json` | Copia catalogului live dinaintea fiecărei publicări efectuate. |

**Nu șterge `state/publicate.json`**. Dacă îl pierzi, scriptul încă recunoaște majoritatea imaginilor existente după ID, dar nu mai poate recunoaște automat aceeași fotografie cu un nume diferit. Nu sunt salvate în registru cheile sau parola R2.

## Comportament la rulări repetate

- Dacă `incoming` este gol: scriptul se încheie normal, fără niciun upload.
- Dacă toate imaginile sunt deja publicate: nu creează WebP-uri noi, nu modifică JSON-ul și nu contactează R2 pentru upload.
- Dacă ai adăugat două fotografii: pregătește și publică **doar cele două fotografii**, păstrând întreg catalogul existent.
- Dacă două fișiere au același conținut, chiar cu nume diferite, este procesat doar unul (SHA-256).
- Imaginile vechi publicate **înainte de instalarea acestui upgrade** sunt recunoscute după ID-ul din numele fișierului și catalogul R2. De exemplu, `si-0004.jpg` este ignorat când există `si-0004` în catalog.
- Excepție cunoscută: dacă ai încă `si-0003.jpg` dar în catalog lucrarea se numește `si-0033`, la prima rulare selectează categoria, corectează ID-ul în `si-0033`, apoi confirmă că este deja publicată. Scriptul reține amprenta fișierului și nu îl mai întreabă la rulările următoare.
- Dacă ai generat doar un ZIP și ai ales **Nu** pentru încărcare R2, acele fotografii **nu** sunt marcate ca publicate. Este intenționat: pregătirea locală nu garantează publicarea.

## Publicare întreruptă / erori

Dacă upload-ul unei imagini sau al JSON-ului eșuează, scriptul înregistrează eroarea în jurnal și **nu marchează lotul ca publicat**. La următoarea rulare îl poți relua. Dacă JSON-ul a fost încărcat cu succes, dar înregistrarea locală a eșuat (ex. disc plin), la următoarea rulare scriptul va recunoaște ID-urile existente în catalog și nu le va suprascrie.

JSON-ul live este verificat la început și imediat înaintea actualizării. Dacă a fost modificat între timp, publicarea este oprită înainte de upload.

## Actualizarea intenționată a unei lucrări existente

Implicit, scriptul **nu înlocuiește** imaginile deja publicate. Pentru corectarea explicită a unei lucrări poți rula în CMD:

```cmd
python publica_lucrari.py --replace-existing
```

În acest mod se cer confirmări pentru înlocuire. Este recomandat să păstrezi o copie a originalelor și să verifici categoria.

## Argumente și verificare

```cmd
python publica_lucrari.py --input "D:\\Fotografii\\SorinIosub" --output "D:\\Publicari"
python publica_lucrari.py --validate-only "D:\\SorinIosub\\artworks.json"
```

`--catalogue` permite un JSON local în locul celui public pentru pregătire offline; la publicarea efectivă în R2, catalogul local trebuie să coincidă cu cel live, altfel operația se oprește.

## Chei Cloudflare R2

Sunt folosite variabilele `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` sau introducerea interactivă, cu cheia secretă ascunsă. **Nu publica aceste chei în GitHub.** Bucket-ul implicit este `sorin-iosub-media`.
