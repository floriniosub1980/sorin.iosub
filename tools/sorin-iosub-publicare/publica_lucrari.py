#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Asistent interactiv de publicare a lucrărilor lui Sorin Iosub.

Funcționează offline cu --catalogue PATH sau citește implicit catalogul public R2.
Publicarea directă în Cloudflare R2 este opțională și necesită confirmare.
"""

from __future__ import annotations

import argparse
import getpass
import io
import json
import os
import re
import sys
import warnings
import zipfile
from collections import Counter
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from PIL import Image, ImageCms, ImageOps
from validate_artworks import CatalogueValidationError, validate_catalogue, validate_file, no_duplicate_keys

ROOT = Path(__file__).resolve().parent
PUBLIC_BASE = "https://media.soriniosub.com"
CATALOG_URL = PUBLIC_BASE + "/data/artworks.json"
BUCKET = "sorin-iosub-media"
EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".webp"}
CATEGORIES = {"1": ("paintings", "Painting / Pictură"),
              "2": ("graphics", "Graphic art / Desen și grafică"),
              "3": ("frescoes", "Frescoes / Fresce și lucrări monumentale")}
ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
Image.MAX_IMAGE_PIXELS = 120_000_000
warnings.simplefilter("error", Image.DecompressionBombWarning)


def say(message=""):
    print(message, flush=True)


def prompt(message, default=None):
    suffix = f" [{default}]" if default is not None else ""
    reply = input(f"{message}{suffix}: ").strip()
    return reply if reply else (default if default is not None else "")


def yesno(message, default=False):
    default_label = "D/n" if default else "d/N"
    while True:
        reply = prompt(f"{message} ({default_label})").casefold()
        if not reply:
            return default
        if reply in ("d", "da", "y", "yes"):
            return True
        if reply in ("n", "nu", "no"):
            return False
        say("Răspunde cu d sau n.")


def clean_id(value):
    value = re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")
    if not ID_PATTERN.fullmatch(value):
        raise ValueError("Nu pot obține un ID valid din numele fișierului.")
    return value


def number_or_none(label, integer=False):
    while True:
        raw = prompt(label + " (Enter = necunoscut)")
        if not raw:
            return None
        try:
            value = int(raw) if integer else float(raw.replace(",", "."))
        except ValueError:
            say("Introdu un număr valid sau apasă Enter.")
            continue
        valid = (1000 <= value <= 2200) if integer else (0 < value < 100000)
        if valid:
            return value
        say("Valoarea este în afara intervalului acceptat.")


def bilingual(label, default_ro="", default_en=""):
    ro = prompt(f"{label} (RO)", default_ro)
    en = prompt(f"{label} (EN)", default_en)
    return {"ro": ro or "", "en": en or ""}


def choose_category():
    say("  1. Painting — pictură")
    say("  2. Graphic art — desen / grafică")
    say("  3. Fresco — fresce / proiecte monumentale")
    say("  0. Omite fotografia")
    while True:
        choice = prompt("În ce categorie publicăm fotografia?")
        if choice == "0":
            return None
        if choice in CATEGORIES:
            return CATEGORIES[choice][0]
        say("Alege 1, 2, 3 sau 0.")


def collect_record(path, category, identifier, old_record=None):
    """Prefer metadata already curated on republishing; never fabricate artist information."""
    if old_record is not None:
        record = dict(old_record)
        record["category"] = category
        record["slug"] = identifier
        say("  Păstrez titlul, anul, tehnica, dimensiunile și descrierile existente.")
        if yesno("  Vrei să editezi și metadatele existente?"):
            edit_metadata(record, identifier)
    else:
        record = {
            "id": identifier,
            "slug": identifier,
            "title": {"ro": f"{identifier.upper()} (titlu provizoriu)",
                      "en": f"{identifier.upper()} (provisional title)"},
            "category": category,
            "year": None,
            "technique": {"ro": None, "en": None},
            "dimensionsCm": {"width": None, "height": None},
            "description": {"ro": "", "en": ""},
            "alt": {"ro": f"Lucrare {identifier.upper()}",
                    "en": f"Artwork {identifier.upper()}"},
            "availability": "unconfirmed",
            "metadataStatus": "pending_artist_confirmation",
            "published": True,
        }
        if yesno("  Vrei să completezi acum titlul, anul, tehnica sau descrierea?"):
            edit_metadata(record, identifier)
    record["images"] = {
        "thumbnail": f"{PUBLIC_BASE}/artworks/{category}/{identifier}/thumbnail.webp",
        "full": f"{PUBLIC_BASE}/artworks/{category}/{identifier}/full.webp",
    }
    return record


def edit_metadata(record, identifier):
    titles = record.get("title") or {}
    record["title"] = bilingual("  Titlul", titles.get("ro") or identifier,
                                 titles.get("en") or identifier)
    say("  Anul, tehnica, dimensiunile și descrierea pot rămâne necompletate.")
    if yesno("  Actualizezi anul?"):
        record["year"] = number_or_none("  Anul realizării", integer=True)
    if yesno("  Actualizezi tehnica?"):
        technique = record.get("technique") or {}
        text = bilingual("  Tehnică", technique.get("ro") or "", technique.get("en") or "")
        record["technique"] = {key: value or None for key, value in text.items()}
    if yesno("  Actualizezi dimensiunile în centimetri?"):
        record["dimensionsCm"] = {"width": number_or_none("  Lățime (cm)"),
                                  "height": number_or_none("  Înălțime (cm)")}
    if yesno("  Actualizezi descrierea vizibilă?"):
        desc = record.get("description") or {}
        record["description"] = bilingual("  Descriere", desc.get("ro") or "", desc.get("en") or "")
    if yesno("  Actualizezi textul alternativ pentru accesibilitate?"):
        alt = record.get("alt") or {}
        record["alt"] = bilingual("  Text alternativ", alt.get("ro") or "", alt.get("en") or "")


def prepare_rgb(image):
    image = ImageOps.exif_transpose(image)
    if image.mode in ("I;16", "I;16B", "I;16L", "I"):
        image = image.convert("I").point(lambda p: max(0, min(255, p / 257))).convert("L")
    # Preserve consistent display of artist colours when an embedded ICC profile is available.
    icc = image.info.get("icc_profile")
    if icc and image.mode in ("RGB", "CMYK", "L"):
        try:
            source_profile = ImageCms.ImageCmsProfile(io.BytesIO(icc))
            image = ImageCms.profileToProfile(
                image, source_profile, ImageCms.createProfile("sRGB"), outputMode="RGB")
        except (OSError, ValueError, TypeError) as exc:
            say(f"  Atenție: profil ICC incompatibil ({exc}); conversie RGB standard.")
            image = image.convert("RGB")
    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        rgba = image.convert("RGBA")
        background = Image.new("RGBA", rgba.size, (246, 244, 239, 255))
        background.alpha_composite(rgba)
        return background.convert("RGB")
    return image.convert("RGB")


def convert_image(source, destination, max_side, quality):
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as source_image:
        source_image.seek(0)
        image = prepare_rgb(source_image)
        input_size = image.size
        image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS, reducing_gap=3.0)
        image.save(destination, "WEBP", quality=quality, method=6)
        return input_size, image.size


def load_base_catalog(path):
    if path is not None:
        data = validate_file(path)
        say(f"Catalog local valid: {path} ({len(data['artworks'])} lucrări).")
        return data
    say(f"Citesc catalogul public: {CATALOG_URL}")
    req = Request(CATALOG_URL, headers={"User-Agent": "SorinIosubPublisher/1.0",
                                        "Cache-Control": "no-cache"})
    try:
        with urlopen(req, timeout=20) as response:
            raw = response.read(8_000_001)
            if len(raw) > 8_000_000:
                raise RuntimeError("Catalogul public este neobișnuit de mare (>8 MB).")
            data = json.loads(raw.decode("utf-8-sig"), object_pairs_hook=no_duplicate_keys)
    except (HTTPError, URLError, TimeoutError, OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise RuntimeError(
            f"Nu am putut încărca un catalog valid din R2: {exc}.\n"
            "STOP pentru a evita pierderea lucrărilor existente.\n"
            "Descarcă versiunea curentă data/artworks.json și rulează cu --catalogue CALE_FISIER.") from exc
    problems = validate_catalogue(data)
    if problems:
        raise CatalogueValidationError("Catalogul public este invalid:\n" + "\n".join(problems))
    say(f"Catalog public valid: {len(data['artworks'])} lucrări.")
    return data


def normalize_catalog(data):
    return json.dumps(data, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def ask_files(source_dir):
    folder = source_dir
    if folder is None:
        folder = ROOT / "incoming"
        if not folder.exists() or not any(p.is_file() and p.suffix.lower() in EXTENSIONS
                                          for p in folder.iterdir()):
            folder = Path(prompt("Folderul cu fotografiile originale (cale completă)" ).strip('"'))
    folder = folder.expanduser().resolve()
    if not folder.is_dir():
        raise RuntimeError(f"Folderul nu există: {folder}")
    # Only files at the top level: no accidental re-import of staged outputs.
    files = sorted((p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in EXTENSIONS),
                   key=lambda p: p.name.casefold())
    if not files:
        raise RuntimeError(f"Nu există fotografii JPG/JPEG/PNG/TIFF/BMP/WebP în {folder}")
    return files


def check_records(catalogue):
    issues = validate_catalogue(catalogue)
    if issues:
        raise CatalogueValidationError("Publicarea oprită. Catalog invalid:\n" + "\n".join(issues))


def atomic_write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    try:
        tmp.write_bytes(data)
        tmp.replace(path)
    finally:
        if tmp.exists():
            tmp.unlink()


def r2_client():
    try:
        import boto3
        from botocore.config import Config
    except ImportError as exc:
        raise RuntimeError("Pentru încărcarea R2, instalează boto3: py -m pip install -r requirements.txt") from exc
    account = os.getenv("R2_ACCOUNT_ID") or prompt("Cloudflare R2 Account ID")
    access = os.getenv("R2_ACCESS_KEY_ID") or prompt("R2 Access Key ID")
    secret = os.getenv("R2_SECRET_ACCESS_KEY") or getpass.getpass("R2 Secret Access Key (nu se afișează): ")
    if not (account and access and secret):
        raise RuntimeError("Lipsește Account ID sau una dintre cheile R2.")
    return boto3.client("s3", region_name="auto",
                        endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
                        aws_access_key_id=access, aws_secret_access_key=secret,
                        config=Config(signature_version="s3v4",
                                      retries={"max_attempts": 4, "mode": "standard"}))


def publish_to_r2(s3, base_catalogue, merged_catalogue, assets, json_bytes, stage):
    """Fail closed on remote changes and upload JSON last; no credentials written to disk."""
    from botocore.exceptions import ClientError
    try:
        obj = s3.get_object(Bucket=BUCKET, Key="data/artworks.json")
        remote_bytes = obj["Body"].read()
    except ClientError as exc:
        raise RuntimeError("Nu am putut citi catalogul existent în R2. Oprire fără modificări: " + str(exc)) from exc
    try:
        remote_catalogue = json.loads(remote_bytes.decode("utf-8-sig"), object_pairs_hook=no_duplicate_keys)
        check_records(remote_catalogue)
    except (ValueError, UnicodeError) as exc:
        raise RuntimeError("Catalogul existent în R2 nu poate fi validat; nimic nu a fost publicat: " + str(exc)) from exc
    if normalize_catalog(remote_catalogue) != normalize_catalog(base_catalogue):
        raise RuntimeError(
            "Catalogul R2 diferă de cel folosit ca bază (posibil actualizat între timp). "
            "NIMIC nu a fost încărcat. Repornește scriptul pentru a evita pierderea modificărilor.")
    backup = stage / "backup_catalog_r2_before_upload.json"
    backup.write_bytes(remote_bytes)
    check_records(merged_catalogue)
    say(f"Backup local al catalogului R2: {backup}")
    say(f"Încarc {len(assets)} imagini WebP în R2 (catalogul va fi publicat ultimul)...")
    for key, path in assets:
        s3.upload_file(str(path), BUCKET, key,
                       ExtraArgs={"ContentType": "image/webp", "CacheControl": "public, max-age=3600"})
        say(f"  OK: {key}")
    # Publish the manifest last so the site never points to images that have not been uploaded.
    s3.put_object(Bucket=BUCKET, Key="data/artworks.json", Body=json_bytes,
                  ContentType="application/json; charset=utf-8", CacheControl="no-cache")
    say("Catalogul a fost publicat în R2 după imagini.")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, help="Folder cu fotografii; implicit incoming sau întrebare interactivă")
    parser.add_argument("--catalogue", type=Path, help="Catalog JSON local, dacă nu vrei citire publică din R2")
    parser.add_argument("--output", type=Path, default=ROOT / "output", help="Folder pentru pachetele generate")
    parser.add_argument("--validate-only", type=Path, metavar="JSON", help="Validează un fișier JSON fără conversie")
    args = parser.parse_args(argv)
    if args.validate_only:
        data = validate_file(args.validate_only)
        say(f"OK: JSON valid ({len(data['artworks'])} lucrări).")
        return 0

    say("=" * 66)
    say("  SORIN IOSUB — Asistent de publicare WebP / JSON / Cloudflare R2")
    say("=" * 66)
    images = ask_files(args.input)
    say(f"Fotografii identificate: {len(images)}")
    baseline = load_base_catalog(args.catalogue)
    old_indexes = {w["id"]: i for i, w in enumerate(baseline["artworks"])}
    merged = dict(baseline)
    merged["artworks"] = [dict(w) for w in baseline["artworks"]]
    tasks = []
    chosen_ids = set()

    for counter, source in enumerate(images, 1):
        say(f"\n[{counter}/{len(images)}] Fotografie: {source.name}")
        category = choose_category()
        if category is None:
            say("  Omisă.")
            continue
        proposed_id = clean_id(source.stem)
        while True:
            identifier = prompt("  ID lucrare (poți corecta numele propus)", proposed_id).lower()
            if not ID_PATTERN.fullmatch(identifier):
                say("  ID invalid: doar litere mici, cifre și cratimă (ex. si-0033).")
                continue
            if identifier in chosen_ids:
                say("  Acest ID a fost deja folosit în lotul curent.")
                continue
            break
        old = merged["artworks"][old_indexes[identifier]] if identifier in old_indexes else None
        if old is not None:
            say(f"  ID existent în catalog: {identifier} / {old.get('category', '?')}.")
            if not yesno("  Confirmi înlocuirea imaginilor acestei lucrări și păstrarea metadatelor?"):
                say("  Omisă.")
                continue
            if old.get("category") != category:
                say("  ATENȚIE: schimbi categoria unei lucrări existente. Imaginile vechi din R2 nu vor fi șterse.")
                if not yesno("  Confirmi schimbarea categoriei?"):
                    continue
        chosen_ids.add(identifier)
        record = collect_record(source, category, identifier, old)
        if old is None:
            merged["artworks"].append(record)
            old_indexes[identifier] = len(merged["artworks"]) - 1
        else:
            merged["artworks"][old_indexes[identifier]] = record
        tasks.append((source, identifier, category))
        say(f"  Pregătită: {identifier} → {category}")

    if not tasks:
        say("Nu ai selectat nicio lucrare. Niciun fișier nu a fost modificat.")
        return 0
    check_records(merged)

    run_name = datetime.now().strftime("publicare_%Y%m%d_%H%M%S")
    stage = args.output.expanduser().resolve() / run_name
    if stage.exists():
        raise RuntimeError("Folderul acestui lot există deja; reîncearcă după câteva secunde: " + str(stage))
    stage.mkdir(parents=True)
    assets = []
    for source, identifier, category in tasks:
        prefix = f"artworks/{category}/{identifier}"
        full_key = f"{prefix}/full.webp"
        thumb_key = f"{prefix}/thumbnail.webp"
        full_path, thumb_path = stage / full_key, stage / thumb_key
        original_size, full_size = convert_image(source, full_path, 2600, 88)
        _, thumb_size = convert_image(source, thumb_path, 640, 82)
        assets.extend(((full_key, full_path), (thumb_key, thumb_path)))
        say(f"  {source.name}: {original_size} → full {full_size}, thumbnail {thumb_size} (fără crop)")

    catalogue_bytes = (json.dumps(merged, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    result_json = stage / "data" / "artworks.json"
    atomic_write(result_json, catalogue_bytes)
    result_data = validate_file(result_json)
    if normalize_catalog(result_data) != normalize_catalog(merged):
        raise RuntimeError("Catalogul scris diferă de cel verificat: oprire.")
    say(f"\nVALIDARE OK: {len(merged['artworks'])} lucrări în catalog.")
    counts = Counter(w["category"] for w in merged["artworks"] if w.get("published") is not False)
    say("Categorii publicate: " + ", ".join(f"{k}: {counts[k]}" for k in ("paintings", "graphics", "frescoes")))
    zip_path = stage / "pachet_pentru_R2.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for key, path in assets:
            archive.write(path, arcname=key)
        archive.write(result_json, arcname="data/artworks.json")
    with zipfile.ZipFile(zip_path) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("Arhiva ZIP nu a trecut testul de integritate.")
    say(f"\nJSON: {result_json}")
    say(f"ZIP:  {zip_path}")
    say("NOTĂ: un ZIP pentru R2 se dezarhivează înaintea încărcării manuale.")

    if yesno("Dorești publicare automată în Cloudflare R2 acum?"):
        s3 = r2_client()
        if not yesno(f"Confirmi încărcarea a {len(assets)} imagini și înlocuirea data/artworks.json în {BUCKET}?"):
            say("Publicarea R2 a fost anulată. Pachetul local rămâne disponibil.")
            return 0
        publish_to_r2(s3, baseline, merged, assets, catalogue_bytes, stage)
    else:
        say("Fără încărcare în R2. Poți folosi ZIP-ul sau publica ulterior manual.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (KeyboardInterrupt, EOFError):
        say("\nOperațiune întreruptă de utilizator; nu publicăm catalogul.")
        sys.exit(130)
    except (CatalogueValidationError, ValueError, OSError, RuntimeError) as exc:
        print(f"\nEROARE: {exc}", file=sys.stderr)
        sys.exit(1)
