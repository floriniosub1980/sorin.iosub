# Sorin Iosub — automatizare publicare lucrări

Script pentru Windows 10/11, Python 3.10+, cu întrebări **pentru fiecare fotografie**.

## Instalare (o singură dată)

1. Instalează Python (cu opțiunea *Add Python to PATH*, dacă folosești `python`).
2. Descarcă pachetul și dezarhivează-l într-un folder local, de exemplu `D:\SorinIosub\Publicare`.
3. Dublu-click pe `INSTALEAZA_DEPENDINTE.bat`. Se instalează Pillow și boto3.

## Flux simplu

1. Copiază fotografiile `.jpg`, `.jpeg`, `.png`, `.tif`, `.tiff`, `.bmp` sau `.webp` în subfolderul `incoming` (fără subfoldere).
2. Dublu-click pe `PORNESTE_PUBLICAREA.bat`.
3. Scriptul citește **catalogul public curent** din `https://media.soriniosub.com/data/artworks.json` și îl validează; dacă nu îl poate accesa, se oprește pentru a evita pierderea lucrărilor existente.
4. Pentru **fiecare imagine**, alege:
    - `1` Painting (pictură) → `artworks/paintings/<id>/`
    - `2` Graphic art (grafică/desen) → `artworks/graphics/<id>/`
    - `3` Fresco (frescă) → `artworks/frescoes/<id>/`
    - `0` pentru a sări peste fișier.
5. Confirmă sau corectează ID-ul sugerat (ex. `si-0003` poate fi corectat la `si-0033`).
6. Opțional, introdu titlul în română/engleză, anul, tehnica, dimensiunile, descrierea și textul `alt`. **Nu se inventează metadate.**
7. Scriptul produce **full.webp** (latura maximă 2600 px) și **thumbnail.webp** (latura maximă 640 px), cu proporțiile păstrate, fără decupare, plus `data/artworks.json` validat.
8. Primești o arhivă `pachet_pentru_R2.zip`. Poți alege să publici direct în R2 sau să încarci manual fișierele din arhivă după dezarhivare.

## Unde sunt rezultatele

`output/publicare_AAAALLZZ_OOMMSS/`

- `artworks/graphics/si-0007/full.webp`
- `artworks/graphics/si-0007/thumbnail.webp`
- `data/artworks.json` — catalogul complet, nu doar fotografiile nou introduse
- `pachet_pentru_R2.zip` — imaginile noi + catalogul complet

**Important la încărcarea manuală:** încarcă **mai întâi imaginile** în bucket-ul `sorin-iosub-media` păstrând structura exactă și **abia apoi** înlocuiește `data/artworks.json`.

## Încărcare automată Cloudflare R2 (opțional)

Ai nevoie de token S3 R2 cu drepturi **Object Read & Write** pentru bucket-ul `sorin-iosub-media`, precum și de `Account ID` din Cloudflare. Scriptul solicită aceste valori, fără să le salveze. Poți configura și variabilele de mediu:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

La publicare, scriptul recitește catalogul R2 și verifică dacă acesta nu s-a modificat față de varianta de plecare. Salvează un **backup local** al catalogului R2, încarcă imaginile și **publică JSON-ul ultimul**. Dacă nu poate citi catalogul, se oprește înainte de orice încărcare.

**Atenție:** dacă întrerupi upload-ul după ce imaginile au fost trimise, unele fișiere imagine pot exista deja în bucket; catalogul public rămâne neschimbat până la ultimul pas.

## Folosire avansată (PowerShell)

```powershell
py -3 -m pip install -r requirements.txt
py -3 publica_lucrari.py --input "D:\Fotografii\Artist" --output "D:\Publicari"
```

Dacă vrei să pornești de la un JSON local, descărcat din R2:

```powershell
py -3 publica_lucrari.py --input "D:\Fotografii\Artist" --catalogue "D:\SorinIosub\artworks.json"
```

**Nu folosi catalogul demonstrativ inclus** ca înlocuitor automat pentru cel live; acesta reprezintă doar stadiul cu 6 lucrări și poate fi depășit.

Verificare JSON fără conversii:

```powershell
py -3 validate_artworks.py "D:\SorinIosub\artworks.json"
```


## Siguranță și limitări

- Nu modifică fotografiile originale și nu le decupează.
- Nu reîncarcă în R2 fără două confirmări explicite.
- Dacă un ID există deja, cere confirmare înainte de înlocuirea imaginilor și păstrează metadatele.
- Nu verifică automat existența publică a imaginilor din lucrări mai vechi în R2; verifică sintaxa, structura și adresele HTTPS.
- Nu creează versiuni R2 la nivelul bucket-ului. Pentru restaurare păstrează backup-ul local al catalogului.
