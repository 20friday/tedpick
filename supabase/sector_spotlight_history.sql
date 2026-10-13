-- 섹터 돋보기 분석 기록 테이블 (섹터 돋보기 메뉴 /sector)
-- sector_spotlight 는 섹터마다 최신 1줄만 남아(덮어쓰기) 지난 분석이 사라져요.
-- 이 테이블은 분석할 때마다 "그날 분석한 섹터"를 한 줄씩 쌓아서,
-- 섹터 상세 페이지에서 "추세 → 꺾임 → 반짝" 같은 변화 흐름을 보여줄 수 있게 해요.
-- Supabase SQL Editor에 그대로 붙여넣어 실행하면 돼요. ("Run without RLS" 선택)

create table if not exists public.sector_spotlight_history (
  id            bigserial primary key,
  analyzed_on   date not null,           -- 분석한 날 (KST)
  name          text not null,           -- 섹터명
  rank          int  default 1,          -- 그날 노출 순서
  heat          text default 'rising',
  trend_state   text default 'alive',
  price_dir     text default 'flat',
  price_label   text,
  biz_dir       text default 'flat',
  biz_label     text,
  industry_type text default 'mature',
  body          text,
  caution       text,
  evidence_note text,
  evidence_href text,
  created_at    timestamptz default now(),
  unique (analyzed_on, name)              -- 같은 날 같은 섹터는 1줄 (다시 저장하면 덮어씀)
);

create index if not exists sector_spotlight_history_name_idx
  on public.sector_spotlight_history (name, analyzed_on desc);

-- 지금 있는 섹터 돋보기를 첫 기록으로 옮겨 담기 (여러 번 실행해도 중복 안 생김)
insert into public.sector_spotlight_history
  (analyzed_on, name, rank, heat, trend_state, price_dir, price_label, biz_dir, biz_label,
   industry_type, body, caution, evidence_note, evidence_href)
select (updated_at at time zone 'Asia/Seoul')::date, name, rank, heat, trend_state, price_dir, price_label,
       biz_dir, biz_label, industry_type, body, caution, evidence_note, evidence_href
from public.sector_spotlight
on conflict (analyzed_on, name) do nothing;
