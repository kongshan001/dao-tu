"""
「道途」健康修仙模拟器 · 后端服务
Version 0.1 · 2026-07-07

零依赖: Python stdlib + 内置 sqlite3
符合 GDD 决策: 本地优先 (可在浏览器中直接打开,不需云端)
"""
import json
import sqlite3
import threading
import os
import signal
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get('PORT', '8765'))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'data', 'dao_tu.db')
STATIC_DIR = os.path.join(BASE_DIR, 'static')
TEMPLATES_DIR = os.path.join(BASE_DIR, 'templates')

db_lock = threading.Lock()


# ===========================================
# 数据层 — SQLite schema (与 db_schema.sql 等价)
# ===========================================
def init_db():
    with db_lock:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        # 用户表
        cur.execute('''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT UNIQUE NOT NULL,
            dao_name TEXT NOT NULL DEFAULT '道友',
            current_realm TEXT NOT NULL DEFAULT 'refining',
            realm_entered_at TEXT,
            total_xiuwei REAL DEFAULT 0,
            is_anonymous INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )''')
        # 修炼记录
        cur.execute('''CREATE TABLE IF NOT EXISTS cultivation_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            cultivation_type TEXT NOT NULL,
            duration_min INTEGER NOT NULL,
            xiuwei_gained REAL NOT NULL,
            started_at TEXT NOT NULL,
            completed_at TEXT NOT NULL,
            recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,
            user_note TEXT,
            is_backfill INTEGER DEFAULT 0
        )''')
        # 境界配置 (6 个境界预置)
        cur.execute('''CREATE TABLE IF NOT EXISTS realm_config (
            realm_code TEXT PRIMARY KEY,
            realm_name TEXT NOT NULL,
            realm_name_en TEXT NOT NULL,
            required_xiuwei REAL NOT NULL,
            realm_order INTEGER NOT NULL UNIQUE,
            realm_color TEXT NOT NULL,
            description TEXT NOT NULL,
            unlocked_skill TEXT
        )''')
        # 预置 6 个境界
        cur.execute('SELECT COUNT(*) FROM realm_config')
        if cur.fetchone()[0] == 0:
            for r in [
                ('refining',    '炼气期', 0,   1, '#8b9d83', '吐纳天地灵气,初窥道途', None),
                ('foundation',  '筑基',   50,  2, '#c9a961', '稳固根基,修道之始',   '《太清静心诀》'),
                ('golden_core', '金丹',   200, 3, '#d8a847', '凝聚金丹,神识初成',   '《九转还丹诀》'),
                ('nascent_soul','元婴',   600, 4, '#9a7fcf', '阴神出窍,神游太虚',   '《阴阳元婴功》'),
                ('divine_spirit','化神',  1500,5, '#5fa5b5', '炼神返虚,通达神明',   '《通天神化诀》'),
                ('tribulation', '渡劫',   3000,6, '#c14a4a', '渡过天劫,飞升在即',   '《九霄雷音真经》')
            ]:
                realm_code, name, xiu, order, color, desc, skill = r
                cur.execute('''INSERT INTO realm_config
                    (realm_code, realm_name, realm_name_en, required_xiuwei,
                     realm_order, realm_color, description, unlocked_skill)
                    VALUES (?,?,?,?,?,?,?,?)''',
                    (realm_code, name, 'en', xiu, order, color, desc, skill))
        # 境界历史
        cur.execute('''CREATE TABLE IF NOT EXISTS realm_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            from_realm TEXT,
            to_realm TEXT NOT NULL,
            total_xiuwei_at_switch REAL NOT NULL,
            switched_at TEXT DEFAULT CURRENT_TIMESTAMP,
            ceremony_done INTEGER DEFAULT 1
        )''')
        # 功法卷轴
        cur.execute('''CREATE TABLE IF NOT EXISTS user_scrolls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            scroll_code TEXT NOT NULL,
            unlocked_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_read INTEGER DEFAULT 0,
            UNIQUE(user_id, scroll_code)
        )''')
        conn.commit()
        conn.close()


def execute_query(query, params=(), fetch=False, lastrowid=False):
    """线程安全的 SQLite 操作"""
    with db_lock:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cur = conn.execute(query, params)
        result = None
        if fetch:
            result = [dict(r) for r in cur.fetchall()]
        else:
            conn.commit()
        if lastrowid:
            result = cur.lastrowid
        conn.close()
        return result


# 修为 -> 境界推进
def check_realm_progression(user_id):
    """修为 > 阈值则自动晋级
    重要: 此函数假设调用方已持有 db_lock (在 do_POST 内),使用非锁原语
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    user_row = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if not user_row:
        conn.close()
        return None
    user = dict(user_row)
    if user['current_realm'] == 'tribulation':
        conn.close()
        return None
    order_map = {'refining': 1, 'foundation': 2, 'golden_core': 3,
                 'nascent_soul': 4, 'divine_spirit': 5, 'tribulation': 6}
    cur_order = order_map.get(user['current_realm'], 1)
    next_row = conn.execute(
        'SELECT * FROM realm_config WHERE realm_order = ?',
        (cur_order + 1,)).fetchone()
    if not next_row:
        conn.close()
        return None
    next_realm = dict(next_row)
    if user['total_xiuwei'] >= next_realm['required_xiuwei']:
        conn.execute(
            'INSERT INTO realm_history (user_id, from_realm, to_realm, total_xiuwei_at_switch) VALUES (?,?,?,?)',
            (user_id, user['current_realm'], next_realm['realm_code'], user['total_xiuwei']))
        if next_realm['unlocked_skill']:
            try:
                conn.execute(
                    'INSERT INTO user_scrolls (user_id, scroll_code) VALUES (?, ?)',
                    (user_id, next_realm['unlocked_skill']))
            except Exception:
                pass
        conn.execute(
            'UPDATE users SET current_realm = ?, realm_entered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            (next_realm['realm_code'], user_id))
        conn.commit()
        conn.close()
        return next_realm
    conn.close()
    return None


# ===========================================
# HTTP Handlers
# ===========================================
class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # 静默 log

    def _json(self, data, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(204)
        for k, v in {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }.items():
            self.send_header(k, v)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/' or parsed.path == '/index.html':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            with open(os.path.join(TEMPLATES_DIR, 'index.html'), 'rb') as f:
                self.wfile.write(f.read())
        elif parsed.path.startswith('/static/'):
            # Serve static files
            self.send_response(200)
            ext = parsed.path.rsplit('.', 1)[-1]
            mime = {'css': 'text/css', 'js': 'application/javascript', 'jpg': 'image/jpeg',
                    'jpeg': 'image/jpeg', 'png': 'image/png', 'svg': 'image/svg+xml'}.get(ext, 'text/plain')
            self.send_header('Content-Type', f'{mime}; charset=utf-8')
            self.end_headers()
            full = os.path.join(BASE_DIR, parsed.path[1:])
            if os.path.exists(full):
                with open(full, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.wfile.write(b'not found')
        elif parsed.path.startswith('/ceremony_videos/'):
            # 提供已生成的突破视频下载
            self.send_response(200)
            self.send_header('Content-Type', 'video/mp4')
            self.send_header('Content-Disposition', 'attachment; filename="breakthrough.mp4"')
            full = os.path.join(BASE_DIR, parsed.path[1:])
            if os.path.exists(full):
                with open(full, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.wfile.write(b'video not ready yet')
        elif parsed.path == '/api/me':
            device = self.headers.get('X-Device-Id', 'demo-device')
            users = execute_query('SELECT * FROM users WHERE device_id = ?', (device,), fetch=True)
            if not users:
                execute_query('INSERT INTO users (device_id) VALUES (?)', (device,))
                users = execute_query('SELECT * FROM users WHERE device_id = ?', (device,), fetch=True)
            u = users[0]
            realm = execute_query('SELECT * FROM realm_config WHERE realm_code = ?',
                                  (u['current_realm'],), fetch=True)[0]
            next_realm_list = execute_query(
                'SELECT * FROM realm_config WHERE realm_order = ?',
                (realm['realm_order'] + 1,), fetch=True)
            next_realm = next_realm_list[0] if next_realm_list else None
            return self._json({
                'user': {**u, 'realm': realm},
                'next_realm': next_realm,
                'progress_pct': round(u['total_xiuwei'] / (next_realm['required_xiuwei'] if next_realm else 1) * 100, 1)
            })
        elif parsed.path == '/api/history':
            device = self.headers.get('X-Device-Id', 'demo-device')
            users = execute_query('SELECT * FROM users WHERE device_id = ?', (device,), fetch=True)
            if not users:
                return self._json({'logs': []})
            logs = execute_query('SELECT * FROM cultivation_logs WHERE user_id = ? ORDER BY completed_at DESC LIMIT 50',
                                  (users[0]['id'],), fetch=True)
            return self._json({'logs': logs})
        elif parsed.path == '/api/scrolls':
            device = self.headers.get('X-Device-Id', 'demo-device')
            users = execute_query('SELECT * FROM users WHERE device_id = ?', (device,), fetch=True)
            if not users:
                return self._json({'scrolls': []})
            scrolls = execute_query('SELECT * FROM user_scrolls WHERE user_id = ? ORDER BY unlocked_at DESC',
                                    (users[0]['id'],), fetch=True)
            return self._json({'scrolls': scrolls})
        elif parsed.path == '/api/stats':
            device = self.headers.get('X-Device-Id', 'demo-device')
            users = execute_query('SELECT * FROM users WHERE device_id = ?', (device,), fetch=True)
            if not users:
                return self._json({})
            user_id = users[0]['id']
            # 7 天折线
            by_day = execute_query('''
                SELECT date(completed_at) as d, sum(xiuwei_gained) as xi
                FROM cultivation_logs
                WHERE user_id = ? AND completed_at >= date('now', '-7 days')
                GROUP BY date(completed_at)
                ORDER BY d
            ''', (user_id,), fetch=True)
            return self._json({
                'total_logs': execute_query('SELECT COUNT(*) c FROM cultivation_logs WHERE user_id = ?',
                                            (user_id,), fetch=True)[0]['c'],
                'total_xiuwei': users[0]['total_xiuwei'],
                'by_day': by_day,
            })
        else:
            self._json({'error': 'not found'}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        body_len = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(body_len)) if body_len > 0 else {}

        if parsed.path == '/api/cultivate':
            # 提交一次修炼
            device = self.headers.get('X-Device-Id', 'demo-device')
            users = execute_query('SELECT * FROM users WHERE device_id = ?', (device,), fetch=True)
            if not users:
                execute_query('INSERT INTO users (device_id) VALUES (?)', (device,))
                users = execute_query('SELECT * FROM users WHERE device_id = ?', (device,), fetch=True)
            user = users[0]

            ctype = body.get('cultivation_type')
            duration = body.get('duration_min', 0)
            xi = body.get('xiuwei_gained', 0)
            started = body.get('started_at')
            completed = body.get('completed_at')
            note = body.get('user_note', '')

            if not all([ctype, duration > 0, xi > 0, started, completed]):
                return self._json({'error': 'missing fields'}, 400)

            # 1) 写入日志
            new_id = execute_query(
                '''INSERT INTO cultivation_logs
                (user_id, cultivation_type, duration_min, xiuwei_gained, started_at, completed_at, user_note)
                VALUES (?, ?, ?, ?, ?, ?, ?)''',
                (user['id'], ctype, duration, xi, started, completed, note),
                lastrowid=True)

            # 2) 累加修为
            execute_query('UPDATE users SET total_xiuwei = total_xiuwei + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                          (xi, user['id']))

            # 3) 检查晋级
            new_realm = check_realm_progression(user['id'])

            # 4) 返回最终状态
            updated = execute_query('SELECT * FROM users WHERE id = ?', (user['id'],), fetch=True)[0]
            realm = execute_query('SELECT * FROM realm_config WHERE realm_code = ?',
                                  (updated['current_realm'],), fetch=True)[0]
            nxt_list = execute_query(
                'SELECT * FROM realm_config WHERE realm_order = ?',
                (realm['realm_order'] + 1,), fetch=True)
            nxt = nxt_list[0] if nxt_list else None

            return self._json({
                'log_id': new_id,
                'breakthrough': new_realm,  # None or realm dict
                'user': {**updated, 'realm': realm},
                'next_realm': nxt,
                'progress_pct': round(updated['total_xiuwei'] / (nxt['required_xiuwei'] if nxt else 1) * 100, 1)
            })

        elif parsed.path == '/api/rename':
            device = self.headers.get('X-Device-Id', 'demo-device')
            new_name = body.get('dao_name', '').strip()
            if not new_name or len(new_name) > 20:
                return self._json({'error': '道号长度需 1-20 字'}, 400)
            execute_query('UPDATE users SET dao_name = ?, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?',
                          (new_name, device))
            return self._json({'ok': True, 'dao_name': new_name})

        elif parsed.path == '/api/ceremony_video':
            # 为某境界生成/获取已存在的突破视频
            device = self.headers.get('X-Device-Id', 'demo-device')
            realm = body.get('realm_code')
            users = execute_query('SELECT * FROM users WHERE device_id = ?', (device,), fetch=True)
            if not users:
                return self._json({'error': 'no user'}, 400)

            target = os.path.join(CEREMONY_VIDEO_DIR, f'{realm}_breakthrough.mp4')
            if os.path.exists(target) and os.path.getsize(target) > 100_000:
                return self._json({
                    'status': 'ready',
                    'video_url': f'/ceremony_videos/{realm}_breakthrough.mp4',
                    'size_mb': round(os.path.getsize(target) / 1024 / 1024, 1),
                })

            # 后台启动生成 (现成脚本)
            import subprocess
            subprocess.Popen(
                ['python3', os.path.join(BASE_DIR, 'ceremony_video.py'), realm],
                cwd=BASE_DIR, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
            return self._json({'status': 'generating', 'realm': realm,
                               'message': '视频生成中,约 3-5 分钟,请稍后刷新'})

        elif parsed.path == '/api/ceremony_status':
            # 检查视频是否已准备好
            realm = body.get('realm_code') or ''
            target = os.path.join(CEREMONY_VIDEO_DIR, f'{realm}_breakthrough.mp4')
            exists = os.path.exists(target) and os.path.getsize(target) > 100_000
            return self._json({
                'ready': exists,
                'video_url': f'/ceremony_videos/{realm}_breakthrough.mp4' if exists else None,
                'size_mb': round(os.path.getsize(target)/1024/1024, 1) if exists else 0,
            })

        else:
            self._json({'error': 'not found'}, 404)


CEREMONY_VIDEO_DIR = os.path.join(BASE_DIR, 'ceremony_videos')
os.makedirs(CEREMONY_VIDEO_DIR, exist_ok=True)


def main():
    init_db()
    print(f'🥋 「道途」已启动 → http://localhost:{PORT}', flush=True)
    print(f'   数据库: {DB_PATH}', flush=True)
    from socketserver import ThreadingMixIn
    class ReuseThreadingHTTPServer(ThreadingMixIn, HTTPServer):
        allow_reuse_address = True
        daemon_threads = True
    server = ReuseThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    # 多线程 max —— 避免 SQLite 锁导致线程堆积
    import threading
    threading.current_thread().name = 'daotu-main'
    signal.signal(signal.SIGTERM, lambda s, f: server.shutdown())
    signal.signal(signal.SIGINT, lambda s, f: server.shutdown())
    try:
        server.serve_forever()
    except SystemExit:
        pass


if __name__ == '__main__':
    main()
