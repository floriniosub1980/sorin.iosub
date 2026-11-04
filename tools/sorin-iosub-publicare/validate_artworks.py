#!/usr/bin/env python3
"""Validate the Sorin Iosub R2 artwork catalogue, without changing any files.

Examples (Windows):
    py validate_artworks.py artwork.json
    py validate_artworks.py output/data/artworks.json

Returns exit code 0 for a valid catalogue, 1 for an invalid one.
"""
import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

MEDIA_HOST = 'media.soriniosub.com'
CATEGORIES = {'paintings', 'frescoes', 'graphics'}
SLUG_PATTERN = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')


class CatalogueValidationError(ValueError):
    """Actionable error in catalogue structure or syntax."""


def no_duplicate_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise CatalogueValidationError(f'Cheie JSON duplicată: {key!r}.')
        result[key] = value
    return result


def read_json(path):
    path = Path(path)
    try:
        raw = path.read_text(encoding='utf-8-sig')
    except (OSError, UnicodeError) as exc:
        raise CatalogueValidationError(f'Nu pot citi {path}: {exc}') from exc
    try:
        return json.loads(raw, object_pairs_hook=no_duplicate_keys,
                          parse_constant=lambda v: (_ for _ in ()).throw(
                              CatalogueValidationError(f'Valoare JSON invalidă: {v}.')))
    except json.JSONDecodeError as exc:
        lines = raw.splitlines()
        snippet = lines[exc.lineno - 1].strip() if exc.lineno <= len(lines) else ''
        raise CatalogueValidationError(
            f'Sintaxă JSON invalidă în {path}, linia {exc.lineno}, coloana {exc.colno}: '
            f'{exc.msg}.\n  {snippet}\n'
            '  Verifică ghilimelele din jurul valorilor text, virgulele și acoladele.'
        ) from exc


def expect(condition, message, errors):
    if not condition:
        errors.append(message)


def bilingual(value, name, errors, required=False):
    if not isinstance(value, dict):
        errors.append(f'{name}: trebuie să fie un obiect cu cheile "ro" și "en".')
        return
    for lang in ('ro', 'en'):
        v = value.get(lang)
        valid = isinstance(v, str) or (v is None and not required)
        expect(valid, f'{name}.{lang}: trebuie să fie text între ghilimele' +
               (' (nevid)' if required else ' sau null') + '.', errors)
        if required and isinstance(v, str):
            expect(bool(v.strip()), f'{name}.{lang}: titlul nu poate fi gol.', errors)


def media_url(value, field, errors):
    if not isinstance(value, str):
        errors.append(f'{field}: adresa trebuie să fie text HTTPS.')
        return
    parts = urlsplit(value)
    if not (parts.scheme == 'https' and parts.hostname == MEDIA_HOST
            and parts.port is None and not parts.username and not parts.password
            and parts.path.lower().endswith('.webp') and not parts.query and not parts.fragment):
        errors.append(f'{field}: folosește URL WebP sub https://{MEDIA_HOST}/, fără parametri.')


def validate_catalogue(data):
    """Return all validation errors. No I/O, no mutation of data."""
    errors = []
    if not isinstance(data, dict):
        return ['Rădăcina JSON trebuie să fie un obiect {...}.']
    expect(type(data.get('schemaVersion')) is int and data['schemaVersion'] == 1,
           'schemaVersion trebuie să fie numărul 1, nu textul "1".', errors)
    works = data.get('artworks')
    if not isinstance(works, list):
        return errors + ['artworks trebuie să fie o listă [...].']

    ids = set()
    slugs = set()
    for number, work in enumerate(works, 1):
        name = f'artworks[{number}]'
        if not isinstance(work, dict):
            errors.append(f'{name}: fiecare lucrare trebuie să fie un obiect {{...}}.')
            continue

        identifier = work.get('id')
        if not isinstance(identifier, str) or not SLUG_PATTERN.fullmatch(identifier):
            errors.append(f'{name}.id: ID obligatoriu cu litere mici, cifre și cratimă (ex.: si-0002).')
        elif identifier in ids:
            errors.append(f'{name}.id: ID duplicat {identifier!r}.')
        else:
            ids.add(identifier)

        slug = work.get('slug')
        if slug is not None:
            if not isinstance(slug, str) or not SLUG_PATTERN.fullmatch(slug):
                errors.append(f'{name}.slug: format invalid; folosește litere mici, cifre și cratimă.')
            elif slug in slugs:
                errors.append(f'{name}.slug: slug duplicat {slug!r}.')
            else:
                slugs.add(slug)

        category = work.get('category')
        expect(category in CATEGORIES if isinstance(category, str) else False,
               f'{name}.category: trebuie să fie paintings, frescoes sau graphics.', errors)
        bilingual(work.get('title'), f'{name}.title', errors, required=True)
        for field in ('description', 'alt', 'technique'):
            if field in work:
                bilingual(work[field], f'{name}.{field}', errors)

        year = work.get('year')
        expect(year is None or (type(year) is int and 1000 <= year <= 2200),
               f'{name}.year: folosește un an numeric (ex.: 2010) sau null.', errors)
        dims = work.get('dimensionsCm')
        if dims is not None:
            if not isinstance(dims, dict):
                errors.append(f'{name}.dimensionsCm: folosește {{"width": ..., "height": ...}} sau null.')
            else:
                for key in ('width', 'height'):
                    val = dims.get(key)
                    expect(val is None or (type(val) in (int, float) and 0 < val < 100000),
                           f'{name}.dimensionsCm.{key}: număr pozitiv sau null.', errors)

        if 'published' in work:
            expect(type(work['published']) is bool,
                   f'{name}.published: folosește true sau false, fără ghilimele.', errors)

        images = work.get('images')
        if not isinstance(images, dict):
            errors.append(f'{name}.images: trebuie să fie un obiect cu thumbnail și full.')
        else:
            for kind in ('thumbnail', 'full'):
                media_url(images.get(kind), f'{name}.images.{kind}', errors)

    return errors


def validate_file(path):
    data = read_json(path)
    problems = validate_catalogue(data)
    if problems:
        raise CatalogueValidationError('Catalog invalid:\n' + '\n'.join(
            f'  {i}. {problem}' for i, problem in enumerate(problems, 1)))
    return data


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('catalogue', type=Path, help='Calea la fișierul artworks.json de validat')
    args = parser.parse_args(argv)
    try:
        data = validate_file(args.catalogue)
    except CatalogueValidationError as exc:
        print(f'EROARE — publicarea trebuie oprită.\n{exc}', file=sys.stderr)
        return 1
    print(f'OK — JSON valid: {args.catalogue} ({len(data["artworks"])} lucrări).')
    print('Notă: validarea nu verifică dacă fișierele WebP există efectiv în R2.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
