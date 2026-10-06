-- 섹터 돋보기 테이블 (홈 맨 아래 코너)
-- 지금 방송에서 주목받는 섹터를, 주가와 업황을 "나눠서" 보여주고
-- 길게 투자할 가치가 있는 산업인지(산업 성격)까지 테드픽이 정리해 저장해요.
-- 핵심: 반짝 상승(pop)과 진짜 추세(alive)를 구분하고, 방송 근거를 함께 연결해요.
-- Supabase SQL Editor에 그대로 붙여넣어 실행하면 돼요.
-- 등록 스크립트는 서비스롤 키로 접근하므로 RLS 정책은 필요 없어요.

create table if not exists public.sector_spotlight (
  name          text primary key,        -- 섹터명 (예: 반도체, 유통·백화점)
  rank          int  default 1,          -- 홈 노출 순서 (작을수록 위, 상위 3개만 노출)
  heat          text default 'rising',   -- 주목도 배지: hot(가장 뜨는) | rising(새로 주목) | steady(꾸준히 관심)
  trend_state   text default 'alive',    -- 추세 상태: alive(추세 살아있음) | fading(기세 꺾이는 중) | pop(반짝 반등 주의)
  price_dir     text default 'flat',     -- 주가 방향: up(강세) | down(조정) | flat(횡보)
  price_label   text,                    -- 주가 짧은 말 (예: "조정 중", "급등")
  biz_dir       text default 'flat',     -- 업황 방향: up(양호) | down(둔화) | flat(일시 개선·혼조)
  biz_label     text,                    -- 업황 짧은 말 (예: "양호", "일시 개선")
  industry_type text default 'mature',   -- 산업 성격: growth(구조적 성장) | mature(성숙·역풍) | decline(사양·쇠퇴) | turnaround(턴어라운드)
  body          text,                    -- 풀이 문단 (친구에게 설명하듯 2~4문장, ~해요체)
  caution       text,                    -- ⚠️ 체크포인트 (길게 투자할 때 조심할 점)
  evidence_note text,                    -- 근거 한 줄 (예: "방송 4곳 중 3곳이 긍정적으로 봤어요")
  evidence_href text,                    -- 근거 보기 링크 (비우면 /feed 로 연결)
  updated_at    timestamptz default now()
);

-- price_dir / biz_dir: up(빨강·강세) | down(파랑·약세) | flat(노랑·중립)
-- 반짝 상승은 trend_state='pop' + industry_type='mature|decline' 조합으로 걸러져요.
