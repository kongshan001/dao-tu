# 「道途」— 健康修仙模拟器

> 把"专注、运动、睡眠、冥想"等真实健康行为,包装成"修仙修炼",用东方修仙文化叙事 + 数字水墨 UI,把现代人最讨厌的"健康打卡"变成"修仙旅程"。

![Version](https://img.shields.io/badge/version-0.2.0-c9a961)
![License](https://img.shields.io/badge/license-MIT-green)
![零依赖](https://img.shields.io/badge/依赖-零-blue)

---

## ✨ 项目亮点

- **零依赖后端**: 纯 Python stdlib(http.server + sqlite3),180 行代码搞定
- **本地优先**: 默认纯本地存储,响应在毫秒级,**微信扫码即开**无需备案
- **修仙文化**: 6 大境界(炼气→筑基→金丹→元婴→化神→渡劫)+ 7 种修炼类型 + 自动境界仪式
- **水墨视觉**: 墨绿+米白+金粉 + 思源宋体 + 不放 emoji 完全中文化
- **仪式感设计**: 突破境界时全屏仪式动画 + 解锁功法卷轴

## 🚀 5 分钟跑起来

### 最快方式
```bash
cd /root/health-cultivation-simulator
python3 app.py 8765
```

打开浏览器: **http://localhost:8765**

### 端口冲突
```bash
PORT=8888 python3 app.py 8888
```

### 自检(确保服务正常)
```bash
# 服务起来后,另开终端:
curl -s http://localhost:8765/api/me -H "X-Device-Id: test-dev"
# 应返回 JSON,包含 user 对象和当前境界
```

---

## 🧘 核心玩法

### 修炼类型(7 种)
| 类型 | 场景 | 修为/min | 最小时长 |
|---|---|---|---|
| 悟道 (meditation_focus) | 深度专注/学习 | 0.025 | 20 min |
| 打坐 (meditation_short) | 番茄钟/小憩 | 0.04 | 5 min |
| 锻体 (body_forge) | 跑步/健身 | 0.01 | 30 min |
| 搬砖 (body_labor) | 家务/购物 | 0.005 | 30 min |
| 行气 (breath_qi) | 5 分钟呼吸 | 0.02 | 5 min |
| 静修 (sleep_rest) | 睡眠 | 0.0036 | 360 min |
| 历练 (expedition) | 远足/旅行 | 0.0042 | 120 min |

### 六大境界(修为阈值)
| 境界 | 累计修为 | 解锁功法 |
|---|---|---|
| 炼气期 | 0 | — |
| 筑基 | 50 | 《太清静心诀》|
| 金丹 | 200 | 《九转还丹诀》|
| 元婴 | 600 | 《阴阳元婴功》|
| 化神 | 1500 | 《通天神化诀》|
| 渡劫 | 3000 | 《九霄雷音真经》|

---

## 📂 项目结构

```
health-cultivation-simulator/
├── app.py              # 后端: Python stdlib HTTP + SQLite
├── gdd.md              # Game Design Doc (产品文档)
├── db_schema.sql       # Postgres schema (Supabase 版)
├── templates/
│   └── index.html      # 单页前端
├── static/
│   ├── css/style.css   # 水墨沉兰视觉
│   └── js/app.js       # 前端逻辑
├── assets/
│   ├── concept_home.jpg       # 首页概念图
│   ├── concept_practice.jpg   # 修炼中概念图
│   └── concept_breakthrough.jpg  # 突破仪式概念图
└── data/
    └── dao_tu.db       # SQLite 数据库(运行时生成)
```

---

## 🔌 API 文档(给开发者)

### GET /api/me
当前用户状态(从 `X-Device-Id` header 识别)

**Response**:
```json
{
  "user": {
    "id": 1, "dao_name": "清虚子", "current_realm": "refining",
    "total_xiuwei": 0.5,
    "realm": { "realm_code": "refining", "realm_name": "炼气期", "description": "..." }
  },
  "next_realm": { "realm_name": "筑基", "required_xiuwei": 50 },
  "progress_pct": 1.0
}
```

### POST /api/cultivate
提交一次修炼

**Request Body**:
```json
{
  "cultivation_type": "meditation_focus",
  "duration_min": 20,
  "xiuwei_gained": 0.5,
  "started_at": "2026-07-07T15:30:00",
  "completed_at": "2026-07-07T15:50:00",
  "user_note": "整理思路"
}
```

**Response**: 同 `/api/me`,额外包含 `breakthrough`(如果有境界突破则含完整 realm 对象)

### GET /api/history
最近 50 条修炼记录(不含超时)

### GET /api/scrolls
已解锁功法卷轴

### GET /api/stats
统计数据(累计修为/日志数/7日折线)

### POST /api/rename
设置道号(JSON: `{"dao_name": "清虚子"}`)

---

## 🛠️ 技术栈

- **后端**: Python 3.10+ stdlib(http.server + sqlite3 + threading)
- **前端**: 原生 HTML + CSS + JS,无框架
- **字体**: Noto Serif SC / Ma Shan Zheng(Google Fonts CDN)
- **存储**: SQLite 单文件,Postgres schema 见 `db_schema.sql`
- **零 pip 依赖**

---

## 🔮 路线图

| 阶段 | 内容 | 时间 |
|---|---|---|
| 0.2.0 | **当前**: 本地 + 8 项 e2e 测试通过 | 2026-07-07 |
| 0.3.0 | 数据导出/导入 JSON | 本周 |
| 0.4.0 | 微信小程序版(Taro 迁移) | 2 周 |
| 1.0.0 | 公开 + 小范围种子用户(10人) | 4 周 |
| 1.1.0 | 集成 HealthKit/华为健康,可选云同步 | 6-8 周 |

---

## 📄 文档

- **`gdd.md`** — Game Design Doc(产品设计 v0.2)
- **`db_schema.sql`** — 完整 Postgres schema(规划未来 Supabase 迁移)

---

## ⚖️ License

MIT(对应原视频 66吖66 系列项目的开放精神)

---

## 🙏 Credits

灵感来自 UP 主 **66吖66** 的"修仙模拟器"系列(v0.5迭代作者迭代 5 期的成果)。
本项目是基于其玩法设计,**从零构建的独立实现**,采用更精简的本地优先策略。
