-- 「道途」健康修仙模拟器 · 数据库 Schema
-- Target: Supabase (Postgres 15+)
-- Version: 0.1 · 2026-07-07

-- ============================================
-- 1. 用户表 (users)
-- ============================================
create table users (
  id           uuid primary key default gen_random_uuid(),
  -- 微信生态
  wechat_openid text unique,
  -- 个人信息
  dao_name     text not null default '道友',  -- 道号
  gender       text check (gender in ('male', 'female', 'other')),
  birthday     date,
  -- 境界
  current_realm text not null default 'refining' check (
                 current_realm in ('refining', 'foundation', 'golden_core',
                                   'nascent_soul', 'divine_spirit', 'tribulation')
               ),
  realm_entered_at timestamptz,                -- 当前境界何时进入
  total_xiuwei numeric(10, 2) default 0,        -- 累计修为(从0)
  -- 元数据
  is_anonymous boolean default false,           -- 是否匿名模式(DND)
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ============================================
-- 2. 修炼记录表 (cultivation_logs)
-- 核心数据 - 每次"完成一次修炼"是一条记录
-- ============================================
create table cultivation_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  -- 修炼类型 (与 GDD 对应)
  cultivation_type text not null check (
                   cultivation_type in (
                     'meditation_focus',  -- 悟道
                     'meditation_short',  -- 打坐
                     'body_forge',        -- 锻体
                     'body_labor',        -- 搬砖
                     'breath_qi',         -- 行气
                     'sleep_rest',        -- 静修
                     'expedition'         -- 历练
                   )),
  -- 时长(分钟)
  duration_min integer not null check (duration_min > 0 and duration_min < 1440),
  -- 修为奖励
  xiuwei_gained numeric(5, 2) not null,
  -- 时间记录
  started_at   timestamptz not null,
  completed_at timestamptz not null,
  recorded_at  timestamptz default now(),
  -- 用户备注(可选)
  user_note    text,
  -- 补录标记
  is_backfill  boolean default false,  -- 是否事后补录
  -- 元数据
  created_at   timestamptz default now()
);

create index idx_cult_logs_user_date on cultivation_logs(user_id, completed_at desc);
create index idx_cult_logs_user_type on cultivation_logs(user_id, cultivation_type);

-- ============================================
-- 3. 境界系统配置表 (realm_config)
-- 静态数据 - 七大境界定义
-- ============================================
create table realm_config (
  realm_code   text primary key,
  realm_name   text not null,                -- 中文名
  realm_name_en text not null,               -- 英文
  required_xiuwei numeric(10, 2) not null,   -- 进境所需修为
  realm_order  integer not null unique,     -- 1=炼气 2=筑基 3=金丹 ...
  realm_color  text not null,                -- 主题色
  realm_glyph  text,                          -- 境界图标 URL
  description  text not null,                -- "筑基,稳固根基,修道之始"
  -- 解锁内容
  unlocked_skill text,                       -- 达到此境界可解锁的功法名
  created_at   timestamptz default now()
);

-- 初始数据
insert into realm_config
  (realm_code, realm_name, realm_name_en, required_xiuwei, realm_order,
   realm_color, realm_glyph, description, unlocked_skill) values
  ('refining',    '炼气期', 'Refining Qi',       0,    1, '#8b9d83', '/icon/realm/refining.svg', '吐纳天地灵气,初窥道途', null),
  ('foundation',  '筑基',   'Foundation',      50,    2, '#c9a961', '/icon/realm/foundation.svg', '稳固根基,修道之始', '《太清静心诀》'),
  ('golden_core', '金丹',   'Golden Core',    200,    3, '#d8a847', '/icon/realm/golden_core.svg', '凝聚金丹,神识初成', '《九转还丹诀》'),
  ('nascent_soul','元婴',   'Nascent Soul',   600,    4, '#9a7fcf', '/icon/realm/nascent_soul.svg', '阴神出窍,神游太虚', '《阴阳元婴功》'),
  ('divine_spirit','化神',  'Divine Spirit', 1500,    5, '#5fa5b5', '/icon/realm/divine_spirit.svg', '炼神返虚,通达神明', '《通天神化诀》'),
  ('tribulation', '渡劫',   'Tribulation',   3000,    6, '#c14a4a', '/icon/realm/tribulation.svg', '渡过天劫,飞升在即', '《九霄雷音真经》');

-- ============================================
-- 4. 用户境界历史表 (realm_history)
-- 记录每次境界切换
-- ============================================
create table realm_history (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  from_realm   text,                          -- 之前的境界,null=首次进入
  to_realm     text not null,
  total_xiuwei_at_switch numeric(10, 2) not null,
  switched_at  timestamptz not null default now(),
  ceremony_done boolean default true          -- 是否完成突破仪式
);

create index idx_realm_hist_user on realm_history(user_id, switched_at desc);

-- ============================================
-- 5. 功法卷轴表 (user_scrolls)
-- 用户解锁的"功法"奖励
-- ============================================
create table user_scrolls (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  scroll_code  text not null,                 -- 功法代码(对应realm_config的unlocked_skill)
  unlocked_at  timestamptz not null default now(),
  -- 阅读状态
  is_read      boolean default false,
  read_at      timestamptz,
  -- 唯一性:每个用户每个功法只能解锁一次
  unique(user_id, scroll_code)
);

-- ============================================
-- 6. 设置表 (user_settings)
-- 用户偏好
-- ============================================
create table user_settings (
  user_id      uuid primary key references users(id) on delete cascade,
  -- 通知
  notify_enabled       boolean default false,  -- 默认关闭
  notify_daily_summary boolean default true,   -- 是否需要每日总结
  notify_breakthrough  boolean default true,   -- 境界突破时通知
  -- 隐私
  is_anonymous         boolean default false,
  -- 备份
  last_backup_at       timestamptz,
  -- 主题
  theme_variant        text default 'ink_green' check (
                       theme_variant in ('ink_green', 'ink_ink', 'ink_gold')
                     ),
  -- 时区(用于判定"今日"边界)
  timezone             text default 'Asia/Shanghai',
  updated_at           timestamptz default now()
);

-- ============================================
-- 7. 仪式记录表 (ceremony_logs)
-- 仅记录渡劫/飞升等大仪式
-- ============================================
create table ceremony_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  ceremony_type text not null check (ceremony_type in ('realm_break', 'tribulation', 'ascension')),
  realm_code   text not null,
  -- 用户视角的留念
  user_note    text,
  -- 截图证据(可选)
  screenshot_url text,
  completed_at timestamptz not null default now()
);

-- ============================================
-- 8. 每日统计视图 (daily_summary)
-- 用于首页快速查询
-- ============================================
create view daily_summary as
select
  user_id,
  date_trunc('day', completed_at at time zone 'Asia/Shanghai') as day,
  count(*) as cultivation_count,
  sum(xiuwei_gained) as daily_xiuwei,
  count(distinct cultivation_type) as type_variety,
  sum(case when cultivation_type = 'sleep_rest' then duration_min else 0 end) as sleep_minutes
from cultivation_logs
group by user_id, date_trunc('day', completed_at at time zone 'Asia/Shanghai');

-- ============================================
-- 9. 触发器:修为达到阈值自动晋级
-- ============================================
create or replace function check_realm_progression()
returns trigger as $$
declare
  v_user users%rowtype;
  v_next_realm realm_config%rowtype;
begin
  select * into v_user from users where id = new.user_id;
  -- 找下一个境界
  select * into v_next_realm from realm_config
    where realm_order = (
      select realm_order from realm_config where realm_code = v_user.current_realm
    ) + 1;
  if not found then return new; end if;

  if v_user.total_xiuwei >= v_next_realm.required_xiuwei then
    -- 触发晋级
    insert into realm_history (user_id, from_realm, to_realm, total_xiuwei_at_switch)
      values (v_user.id, v_user.current_realm, v_next_realm.realm_code, v_user.total_xiuwei);
    -- 解锁功法
    if v_next_realm.unlocked_skill is not null then
      insert into user_scrolls (user_id, scroll_code)
        values (v_user.id, v_next_realm.unlocked_skill)
        on conflict do nothing;
    end if;
    -- 更新用户
    update users
      set current_realm = v_next_realm.realm_code,
          realm_entered_at = now(),
          updated_at = now()
      where id = v_user.id;
    -- 仪式记录
    if v_next_realm.realm_code = 'tribulation' then
      insert into ceremony_logs (user_id, ceremony_type, realm_code)
        values (v_user.id, 'tribulation', v_next_realm.realm_code);
    else
      insert into ceremony_logs (user_id, ceremony_type, realm_code)
        values (v_user.id, 'realm_break', v_next_realm.realm_code);
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

-- 累积修为 trigger
create or replace function add_xiuwei()
returns trigger as $$
begin
  update users
    set total_xiuwei = total_xiuwei + new.xiuwei_gained,
        updated_at = now()
    where id = new.user_id;
  return new;
end;
$$ language plpgsql;

create trigger trg_add_xiuwei
  after insert on cultivation_logs
  for each row execute function add_xiuwei();

create trigger trg_check_realm
  after update of total_xiuwei on users
  for each row when (old.total_xiuwei is distinct from new.total_xiuwei)
  execute function check_realm_progression();

-- ============================================
-- 10. RLS (Row-Level Security) — 多用户隔离
-- ============================================
alter table users enable row level security;
alter table cultivation_logs enable row level security;
alter table realm_history enable row level security;
alter table user_scrolls enable row level security;
alter table user_settings enable row level security;
alter table ceremony_logs enable row level security;

-- 简化策略:用户只能访问自己的数据
create policy "users own data" on users for all using (auth.uid() = id);
create policy "logs own data" on cultivation_logs for all using (auth.uid() = user_id);
create policy "history own data" on realm_history for all using (auth.uid() = user_id);
create policy "scrolls own data" on user_scrolls for all using (auth.uid() = user_id);
create policy "settings own data" on user_settings for all using (auth.uid() = user_id);
create policy "ceremony own data" on ceremony_logs for all using (auth.uid() = user_id);

-- ============================================
-- 11. 初始化:测试用户
-- ============================================
-- insert into users (dao_name) values ('测试道友') returning *;
-- insert into cultivation_logs (user_id, cultivation_type, duration_min, xiuwei_gained, started_at, completed_at)
--   select id, 'meditation_focus', 20, 0.5, now() - interval '1 hour', now()
--   from users where dao_name = '测试道友';
