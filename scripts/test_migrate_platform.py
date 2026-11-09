from contextlib import closing
import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('migration', Path(__file__).with_name('migrate-platform.py'))
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.vault = self.root / 'vault'
        self.old = 'Clippings/科技数码/旧标题.md'
        self.path = self.vault / self.old
        self.path.parent.mkdir(parents=True)
        self.text = '---\n原文链接: "https://m.toutiao.com/is/example/"\n收藏时间: 2026-11-08T15:59:59Z\n分类: "科技数码"\n---\n正文😀\n![[Attachments/旧目录/image001.jpg]]\n'
        self.path.write_text(self.text, encoding='utf-8')
        self.database = self.root / 'tasks.sqlite'
        db = sqlite3.connect(self.database)
        db.executescript('CREATE TABLE tasks(id TEXT,url TEXT,createdAt TEXT,file TEXT,category TEXT,result TEXT); CREATE TABLE notes(key TEXT,file TEXT,category TEXT);')
        db.execute('INSERT INTO tasks VALUES(?,?,?,?,?,?)', ('id', 'https://m.toutiao.com/is/example/', '2026-11-08T15:59:59Z', self.old, '科技数码', json.dumps({'file': self.old})))
        db.execute('INSERT INTO notes VALUES(?,?,?)', ('url', self.old, '科技数码'))
        db.commit()
        db.close()

    def test_preview_apply_and_repeat_preserve_body_and_update_all_paths(self):
        report = migration.migrate(self.vault, self.database, timezone='UTC')
        self.assertTrue(self.path.exists())
        self.assertEqual(report['moves'][0]['new'], 'Clippings/头条/2026-11-08 155959 - 旧标题.md')
        migration.migrate(self.vault, self.database, self.root / 'backup', True, 'UTC')
        new = self.vault / report['moves'][0]['new']
        text = new.read_text(encoding='utf-8')
        self.assertEqual(text.split('---', 2)[2], self.text.split('---', 2)[2])
        self.assertIn('aliases: ["旧标题"]', text)
        self.assertFalse(self.path.exists())
        with closing(sqlite3.connect(self.database)) as db:
            file, result = db.execute('SELECT file,result FROM tasks').fetchone()
            self.assertEqual(file, report['moves'][0]['new'])
            self.assertEqual(json.loads(result)['file'], file)
            self.assertEqual(db.execute('SELECT file FROM notes').fetchone()[0], file)
        self.assertEqual(migration.migrate(self.vault, self.database, timezone='UTC')['moves'], [])

    def test_database_failure_restores_original_files_and_indexes(self):
        with closing(sqlite3.connect(self.database)) as db:
            db.execute("CREATE TRIGGER reject_update BEFORE UPDATE ON tasks BEGIN SELECT RAISE(ABORT,'test failure'); END")
        with self.assertRaises(sqlite3.IntegrityError):
            migration.migrate(self.vault, self.database, self.root / 'backup', True, 'UTC')
        self.assertEqual(self.path.read_text(encoding='utf-8'), self.text)
        with closing(sqlite3.connect(self.database)) as db:
            self.assertEqual(db.execute('SELECT file FROM notes').fetchone()[0], self.old)
        self.assertEqual(len(list((self.vault / 'Clippings').rglob('*.md'))), 1)

    def test_unknown_dates_are_skipped_and_non_platform_domains_are_web(self):
        self.path.write_text(self.text.replace('2026-11-08T15:59:59Z', 'unknown'), encoding='utf-8')
        report = migration.migrate(self.vault, self.database, timezone='UTC')
        self.assertEqual(report['moves'], [])
        self.assertEqual(report['skipped'], [self.old])
        self.assertEqual(migration.platform('https://nottoutiao.com/'), '网页')
        self.assertEqual(migration.platform('https://mp.weixin.qq.com/s/id'), '微信')


if __name__ == '__main__':
    unittest.main()
