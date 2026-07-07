# 「道途」— 健康修仙模拟器

> 把"专注、运动、睡眠、冥想"等真实健康行为,包装成"修仙修炼",用东方修仙文化叙事 + 数字水墨 UI,把现代人最讨厌的"健康打卡"变成"修仙旅程"。

**🎮 在线体验**: https://kongshan001.github.io/dao-tu/ *(GitHub Pages 静态版,数据存浏览器 localStorage)*

---

## 📦 这个仓库包含两个版本

### 1. **静态版 (Pages)** — `docs/pages-static/`
- **零依赖,直接访问**: https://kongshan001.github.io/dao-tu/
- 数据存储: 浏览器 `localStorage` (可导出 JSON 备份)
- 适合: 道友之间快速分享

### 2. **Python stdlib 完整版** — `app.py` + `templates/` + `static/`
- 后端: 零依赖 Python,SQLite 数据库
- 功能更全(视频生成接口 / API 模式)
- 适合: 本地开发、调试、与前端联调

---

## 🚀 5 分钟跑起来(完整版)

```bash
git clone https://github.com/kongshan001/dao-tu.git
cd dao-tu
python3 app.py 8765
# 浏览器打开 http://localhost:8765
```

启动参数:
- `python3 app.py 8888` — 改端口
- `python3 app.py --cors` — 启用 CORS(API 模式)

---

## 🧘 核心玩法

### 修炼分类(7 类)
| 类型 | 场景 | 修为/min | 最小时长 |
|---|---|---|---|
| 悟道 | 学习/深度工作 | 0.025 | 20min |
| 打坐 | 番茄钟 | 0.04 | 5min |
| 锻体 | 跑步/健身 | 0.01 | 30min |
| 搬砖 | 家务/购物 | 0.005 | 30min |
| 行气 | 呼吸练习 | 0.02 | 5min |
| 静修 | 睡眠 | 0.0036 | 6h |
| 历练 | 远足/旅行 | 0.0042 | 2h |

### 六大境界
炼气期 → 筑基 (50 修为) → 金丹 (200) → 元婴 (600) → 化神 (1500) → 渡劫 (3000)

每个境界突破时:
- ✨ 全屏仪式动画
- 📜 自动解锁新功法卷轴
- 🎬 可生成 30 秒分享视频(需 backend)

---

## 🛠️ 技术栈

- **静态版**: Vanilla JS + localStorage + Ma Shan Zheng/Noto Serif SC 字体
- **完整版**: Python 3.10+ stdlib + SQLite + Pollinations + edge-tts + ffmpeg
- **零 pip 依赖**(完整版)

---

## 📂 项目结构

```
dao-tu/
├── README.md                       ← 这份文档
├── index.html(可选,如果 Pages 不在 docs 下)
├── docs/pages-static/              ← GitHub Pages 部署目录
│   ├── index.html
│   ├── css/style.css
│   ├── js/app.js
│   └── .nojekyll
├── app.py                          ← Python 后端 (stdlib + SQLite)
├── templates/index.html            ← 完整版前端(给 app.py 用)
├── static/
│   ├── css/style.css               ← 共用的水墨视觉样式
│   ├── js/app.js                   ← 完整版 JS(用 backend)
│   └── app-static.js               ← 静态版 JS(用 localStorage)
├── ceremony_video.py               ← 境界视频生成器(复用 video-auto-pipeline)
├── ceremony_videos/                ← 5 个境界 × 10 秒短视频
├── gdd.md                          ← Game Design Doc
├── db_schema.sql                   ← Postgres schema(Supabase 迁移用)
├── pipeline.py                     ← 视频生成流水线(从 video-auto-pipeline 引用)
└── LICENSE
```

---

## 🔮 路线图

- ✅ **v0.3.0** (current) — 静态版部署到 GitHub Pages
- ✅ v0.2.0 — 8 项 e2e 测试通过
- 📋 v0.4.0 — HealthKit 集成
- 📋 v1.0.0 — 公开 + 5 个种子用户验证

详见 `gdd.md`。

---

## 🤝 Credits

灵感来自 B 站 UP 主 **66吖66** 的"修仙模拟器"系列。
构建时复用了 [video-auto-pipeline](https://github.com/kongshan001/video-auto-pipeline) 的视频生成流水线。

MIT License.
