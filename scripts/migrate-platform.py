"""Offline migration. Stop Link2Obsidian first. Defaults to a read-only preview.

python3 scripts/migrate-platform.py --vault /vault --db data/tasks.sqlite
Add --apply --backup /separate/private/backup-directory to migrate.
"""
import argparse
import datetime as dt
import json
import os
import re
import shutil
import sqlite3
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo


def platform(url):
    host = (urlparse(url).hostname or '').lower()
    for domain, folder in [('toutiao.com', '头条'), ('toutiaocdn.com', '头条'),
                           ('weixin.qq.com', '微信'), ('zhihu.com', '知乎'),
                           ('x.com', 'X'), ('twitter.com', 'X'), ('instagram.com', 'Instagram')]:
        if host == domain or host.endswith('.' + domain):
            return folder
    return '网页'


def scalar(text, name):
    match = re.search(r'^' + re.escape(name) + r':\s*([^\r\n]+)$', text, re.M)
    if not match:
        return None
    value = match[1].strip()
    if value.startswith('"'):
        try:
            return json.loads(value)
        except ValueError:
            return None
    return value.strip("'")


def plan(vault, db, timezone):
    root = vault / 'Clippings'
    if root.is_symlink():
        raise ValueError('Clippings must not be a symlink')
    tasks = {row['file']: dict(row) for row in db.execute(
        'SELECT file,url,createdAt FROM tasks WHERE file IS NOT NULL ORDER BY createdAt DESC')}
    notes = {row['file']: row['key'] for row in db.execute('SELECT file,key FROM notes')}
    occupied, moves, skipped = set(), [], []
    for directory, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = sorted(d for d in dirs if not (Path(directory) / d).is_symlink())
        for name in sorted(files):
            source = Path(directory) / name
            if source.is_symlink() or source.suffix != '.md':
                continue
            relative = source.relative_to(vault).as_posix()
            text = source.read_text(encoding='utf-8')
            header = re.match(r'\A---\r?\n(.*?)\r?\n---(?:\r?\n|$)', text, re.S)
            if not header:
                skipped.append(relative)
                continue
            url = scalar(header[1], '原文链接') or scalar(header[1], 'url') or tasks.get(relative, {}).get('url') or notes.get(relative, '')
            if urlparse(url).scheme not in ('http', 'https'):
                skipped.append(relative)
                continue
            saved = scalar(header[1], '收藏时间') or tasks.get(relative, {}).get('createdAt')
            try:
                date = dt.datetime.fromisoformat(saved.replace('Z', '+00:00'))
                if date.tzinfo is None:
                    date = date.replace(tzinfo=timezone)
            except (AttributeError, ValueError):
                # Unknown collection dates stay untouched for manual review.
                skipped.append(relative)
                continue
            prefix = date.astimezone(timezone).strftime('%Y-%m-%d %H%M%S')
            title = re.sub(r'^\d{4}-\d{2}-\d{2} \d{6} - ', '', source.stem)
            title = title.encode('utf-8')[:200].decode('utf-8', errors='ignore')
            folder = platform(url)
            if (root / folder).is_symlink():
                raise ValueError('Platform directory must not be a symlink')
            destination = root / folder / (prefix + ' - ' + title + '.md')
            number = 2
            while destination != source and (destination.exists() or destination in occupied):
                destination = root / folder / (prefix + ' - ' + title + f' ({number}).md')
                number += 1
            occupied.add(destination)
            if destination == source:
                continue
            new_header = re.sub(r'^分类:[^\r\n]*', '分类: ' + json.dumps(folder, ensure_ascii=False), header[1], flags=re.M)
            if not re.search(r'^分类:', new_header, re.M):
                new_header += '\n分类: ' + json.dumps(folder, ensure_ascii=False)
            # Keep the old basename available to Obsidian wikilinks. Existing
            # user-authored aliases are preserved verbatim instead of reparsed.
            if not re.search(r'^aliases:', new_header, re.M):
                new_header += '\naliases: ' + json.dumps([source.stem], ensure_ascii=False)
            updated = text[:header.start(1)] + new_header + text[header.end(1):]
            assert updated.split('---', 2)[2] == text.split('---', 2)[2]
            moves.append({'old': relative, 'new': destination.relative_to(vault).as_posix(), 'category': folder, 'content': updated})
    return moves, skipped


def migrate(vault, database, backup=None, apply=False, timezone='Asia/Shanghai'):
    vault = Path(vault).resolve()
    database = Path(database).resolve()
    db = sqlite3.connect(database.as_uri() + '?mode=rw', uri=True)
    db.row_factory = sqlite3.Row
    try:
        moves, skipped = plan(vault, db, dt.timezone.utc if timezone == 'UTC' else ZoneInfo(timezone))
        report = {'moves': [{k: v for k, v in m.items() if k != 'content'} for m in moves], 'skipped': skipped}
        if not apply:
            return report
        backup = Path(backup).resolve()
        if backup == vault or vault in backup.parents or backup.exists():
            raise ValueError('Backup must be a NEW directory outside the Vault')
        backup.mkdir(parents=True, mode=0o700)
        snapshot = sqlite3.connect(backup / 'tasks.sqlite')
        db.backup(snapshot)
        snapshot.close()
        (backup / 'manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        completed = []
        try:
            db.execute('BEGIN IMMEDIATE')
            for item in moves:
                old, new = vault / item['old'], vault / item['new']
                copy = backup / 'originals' / item['old']
                copy.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(old, copy)
                new.parent.mkdir(parents=True, exist_ok=True)
                # Exclusive creation makes retries and collisions safe.
                with new.open('x', encoding='utf-8', newline='') as handle:
                    handle.write(item['content'])
                completed.append(item)
                old.unlink()
                db.execute('UPDATE notes SET file=?,category=? WHERE file=?', (item['new'], item['category'], item['old']))
                rows = list(db.execute('SELECT id,result FROM tasks WHERE file=?', (item['old'],)))
                for row in rows:
                    result = json.loads(row['result']) if row['result'] else None
                    if result:
                        result.update(file=item['new'], category=item['category'])
                    db.execute('UPDATE tasks SET file=?,category=?,result=? WHERE id=?',
                               (item['new'], item['category'], json.dumps(result, ensure_ascii=True) if result else None, row['id']))
            db.commit()
        except BaseException:
            db.rollback()
            for item in reversed(completed):
                old, new = vault / item['old'], vault / item['new']
                old.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(backup / 'originals' / item['old'], old)
                new.unlink(missing_ok=True)
            raise
        # Only remove now-empty topic folders, never folders containing user files.
        for directory, _, _ in os.walk(vault / 'Clippings', topdown=False, followlinks=False):
            path = Path(directory)
            if path != vault / 'Clippings' and not path.is_symlink():
                try:
                    path.rmdir()
                except OSError:
                    pass
        return report
    finally:
        db.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vault', required=True)
    parser.add_argument('--db', required=True)
    parser.add_argument('--timezone', default='Asia/Shanghai')
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--backup')
    args = parser.parse_args()
    if args.apply and not args.backup:
        parser.error('--apply requires --backup')
    print(json.dumps(migrate(args.vault, args.db, args.backup, args.apply, args.timezone), ensure_ascii=True, indent=2))
