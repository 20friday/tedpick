// 섹터 돋보기 공용 — 홈(상위 3개)·섹터 목록(/sector)·섹터 상세(/sector/[name])가 같이 쓴다.
//
// 데이터 출처
//  · sector_spotlight_history : 분석할 때마다 쌓이는 기록 (analyzed_on + name 당 1줄)
//  · sector_spotlight          : 섹터별 최신 1줄 (예전 방식, 기록 테이블이 없을 때 대신 씀)
// "지금 주목 섹터" = 가장 최근 분석일(analyzed_on)에 분석된 섹터들(rank 순).

import type { SupabaseClient } from '@supabase/supabase-js';

export type SectorRecord = {
  name: string;
  analyzed_on: string;      // YYYY-MM-DD
  rank: number;
  heat: string;
  trend_state: string;
  price_dir: string;
  price_label: string | null;
  biz_dir: string;
  biz_label: string | null;
  industry_type: string;
  body: string | null;
  caution: string | null;
  evidence_note: string | null;
  evidence_href: string | null;
};

export type SectorSummary = {
  latest: SectorRecord;     // 가장 최근 분석
  count: number;            // 지금까지 분석 횟수
};

export const HEAT: Record<string, { label: string; cls: string }> = {
  hot: { label: '🔥 가장 뜨는 섹터', cls: 'heat-hot' },
  rising: { label: '새로 주목', cls: 'heat-mute' },
  steady: { label: '꾸준히 관심', cls: 'heat-mute' },
};
export const TREND: Record<string, { label: string; cls: string }> = {
  alive: { label: '추세 살아있음', cls: 'trend-alive' },
  fading: { label: '기세 꺾이는 중', cls: 'trend-fading' },
  pop: { label: '반짝 반등 주의', cls: 'trend-pop' },
};
export const INDUSTRY: Record<string, { label: string; cls: string }> = {
  growth: { label: '구조적 성장', cls: 'ind-growth' },
  mature: { label: '성숙·역풍', cls: 'ind-mute' },
  decline: { label: '사양·쇠퇴', cls: 'ind-decline' },
  turnaround: { label: '턴어라운드', cls: 'ind-turn' },
};
export function dirArrow(d: string) { return d === 'up' ? '↑' : d === 'down' ? '↓' : '→'; }
export const heatOf = (s: SectorRecord) => HEAT[s.heat] ?? HEAT.rising;
export const trendOf = (s: SectorRecord) => TREND[s.trend_state] ?? TREND.alive;
export const industryOf = (s: SectorRecord) => INDUSTRY[s.industry_type] ?? INDUSTRY.mature;

export const sectorHref = (name: string) => '/sector/' + encodeURIComponent(name);

// "10.12" 같은 짧은 날짜
export function shortDate(iso: string) {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}.${d}`;
}

const kstDate = (ts: string) => new Date(new Date(ts).getTime() + 9 * 3600e3).toISOString().slice(0, 10);

// 모든 분석 기록 (최신순). 기록 테이블이 아직 없거나 비어 있으면 최신 1줄 테이블로 대신한다.
export async function loadSectorRecords(supabase: SupabaseClient): Promise<SectorRecord[]> {
  const { data: hist, error } = await supabase
    .from('sector_spotlight_history').select('*')
    .order('analyzed_on', { ascending: false })
    .order('rank', { ascending: true });
  if (!error && hist?.length) return hist as SectorRecord[];

  const { data: cur } = await supabase
    .from('sector_spotlight').select('*')
    .order('rank', { ascending: true });
  return (cur ?? []).map((r: any) => ({ ...r, analyzed_on: kstDate(r.updated_at) }));
}

// 지금 주목 섹터(최근 분석일) + 지난 분석 섹터(그 외, 최근 분석 순)
export function groupSectors(records: SectorRecord[]) {
  const byName = new Map<string, SectorSummary>();
  for (const r of records) {   // 최신순이라 첫 기록이 latest
    const s = byName.get(r.name);
    if (s) s.count++;
    else byName.set(r.name, { latest: r, count: 1 });
  }
  const latestDay = records[0]?.analyzed_on;
  const all = [...byName.values()];
  const current = all
    .filter((s) => s.latest.analyzed_on === latestDay)
    .sort((a, b) => a.latest.rank - b.latest.rank);
  const past = all
    .filter((s) => s.latest.analyzed_on !== latestDay)
    .sort((a, b) => b.latest.analyzed_on.localeCompare(a.latest.analyzed_on));
  return { current, past, latestDay };
}
