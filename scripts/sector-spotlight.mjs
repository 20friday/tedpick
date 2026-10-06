#!/usr/bin/env node
/**
 * 섹터 돋보기 도구 (홈 맨 아래 코너)
 *
 * 홈에 보여줄 "지금 주목받는 섹터" 카드 재료를 모으고(gather), 테드픽이 쓴 JSON을
 * 저장(save)한다. 카드는 섹터마다 주가/업황을 나눠 보여주고, 길게 투자할 산업인지
 * (산업 성격)와 체크포인트, 방송 근거까지 담는다. 문단은 규칙으로 못 만드니,
 * gather 재료(최근 방송 섹터 흐름·많이 언급된 종목)를 읽고 Claude가 직접 쓴다.
 *
 * ── 사용법 ────────────────────────────────────────────────
 * 1) 재료 뽑기 (최근 N일 섹터 흐름 + 많이 언급된 종목 + 직전 돋보기)
 *      node scripts/sector-spotlight.mjs gather            # 기본 14일
 *      node scripts/sector-spotlight.mjs gather --days 21
 *
 * 2) 돋보기 저장 (Claude가 쓴 JSON을 upsert) — 상위 3개만 홈에 노출돼요
 *      node scripts/sector-spotlight.mjs save spotlight.json
 *    spotlight.json 형식 (섹터 배열):
 *      [
 *        {
 *          "name": "반도체",
 *          "heat": "hot",               // hot | rising | steady
 *          "trend_state": "alive",      // alive(추세) | fading(꺾임) | pop(반짝 주의)
 *          "price_dir": "down",         // up | down | flat
 *          "price_label": "조정 중",
 *          "biz_dir": "up",             // up | down | flat
 *          "biz_label": "양호",
 *          "industry_type": "growth",   // growth | mature | decline | turnaround
 *          "body": "주가는 차익실현에 밀려 빠지고 있지만 …",
 *          "caution": "밸류 부담과 외국인 차익실현은 눌러둘 필요가 있어요.",
 *          "evidence_note": "방송 4곳 중 3곳이 긍정적으로 봤어요",
 *          "evidence_href": "/feed"     // 생략하면 /feed 로 연결
 *        }
 *      ]
 *    · rank(노출 순서)는 배열 순서대로 1,2,3… 자동으로 매겨져요.
 *    · 값이 규칙 밖이면 안전한 기본값으로 보정돼요.
 *    · 홈은 rank 상위 3개만 보여줘요. 더 써도 되지만 노출은 3개까지.
 *
 * ⚠️ 저장 전 sector_spotlight 테이블이 있어야 한다 (supabase/sector_spotlight.sql 실행).
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// .env 에서 Supabase 접속 정보 읽기 (node는 .env를 자동 로드하지 않음)
function loadEnv() {
  const env = {};
  try {
    const raw = readFileSync(join(__dirname, '../.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* .env 없으면 process.env 사용 */ }
  return { ...env, ...process.env };
}
const ENV = loadEnv();
const SUPABASE_URL = ENV.SUPABASE_URL || ENV.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ .env 에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 가 필요해요. (vercel env pull .env)');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function isoDaysAgo(n) {
  return new Date(Date.now() + 9 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
}

// ── gather: 최근 N일 섹터 흐름 + 많이 언급된 종목 모으기 ─────
async function gather(days) {
  const from = isoDaysAgo(days);
  const to = isoDaysAgo(0);

  const { data: reports } = await supabase
    .from('daily_reports')
    .select('date, headline, insight, sectors, stocks')
    .eq('published', true).gte('date', from).lte('date', to)
    .order('date', { ascending: false });

  if (!reports?.length) { console.log(`(${from} ~ ${to}) 일일 리포트가 없어요.`); return; }

  // 직전 돋보기(현재 등록된 것)도 같이 보여줘 흐름 연속성 판단을 돕는다
  const { data: prev } = await supabase
    .from('sector_spotlight')
    .select('name, rank, heat, trend_state, industry_type, updated_at')
    .order('rank', { ascending: true });

  console.log(`\n🔎 최근 ${days}일 섹터 돋보기 재료 (${from} ~ ${to})\n`);

  if (prev?.length) {
    console.log('── 지금 등록된 섹터 돋보기 (연속성 판단용) ──');
    for (const s of prev) {
      console.log(`  #${s.rank} ${s.name} · ${s.heat}/${s.trend_state}/${s.industry_type} (갱신 ${String(s.updated_at).slice(0, 10)})`);
    }
    console.log('');
  }

  // 섹터별로 날짜 흐름을 모으기 + 전체 언급 종목 집계
  const sectorFlows = {};   // name -> [{date, flow}]
  const mentionCount = {};  // stock -> 횟수
  for (const r of reports) {
    for (const s of r.sectors ?? []) {
      if (!s?.name) continue;
      (sectorFlows[s.name] ??= []).push({ date: r.date, flow: s.flow ?? '' });
    }
    for (const st of r.stocks ?? []) {
      if (!st?.name) continue;
      mentionCount[st.name] = (mentionCount[st.name] ?? 0) + (st.shows?.length ?? 1);
    }
  }

  console.log('── 섹터별 최근 흐름 (방송 리포트 기준) ──');
  const sortedSectors = Object.entries(sectorFlows)
    .sort((a, b) => b[1].length - a[1].length);
  for (const [name, rows] of sortedSectors) {
    console.log(`\n  ■ ${name}  (${rows.length}일 언급)`);
    for (const row of rows) console.log(`     [${row.date}] ${row.flow}`);
  }

  const topStocks = Object.entries(mentionCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log('\n── 많이 언급된 종목 (섹터 감 잡기용) ──');
  console.log('  ' + topStocks.map(([n, c]) => `${n}(${c})`).join(', '));

  console.log('\n\n위 재료로 상위 섹터 3개 안팎을 골라 spotlight.json 을 써 주세요.');
  console.log('(주가 vs 업황을 나누고, 산업 성격·체크포인트·반짝 여부까지 테드픽이 종합 판단)\n');
}

// ── save: 돋보기 JSON upsert (rank 자동 매김) ────────────────
async function save(file) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const list = Array.isArray(raw) ? raw : [raw];
  if (!list.length) { console.error('❌ 섹터가 비어 있어요.'); process.exit(1); }

  const validHeat = ['hot', 'rising', 'steady'];
  const validTrend = ['alive', 'fading', 'pop'];
  const validDir = ['up', 'down', 'flat'];
  const validIndustry = ['growth', 'mature', 'decline', 'turnaround'];

  const now = new Date().toISOString();
  const rows = list.map((s, i) => {
    if (!s?.name || !s.body) {
      console.error(`❌ [${i}] name 과 body 는 필수예요.`); process.exit(1);
    }
    return {
      name: String(s.name),
      rank: Number.isFinite(s.rank) ? s.rank : i + 1,
      heat: validHeat.includes(s.heat) ? s.heat : 'rising',
      trend_state: validTrend.includes(s.trend_state) ? s.trend_state : 'alive',
      price_dir: validDir.includes(s.price_dir) ? s.price_dir : 'flat',
      price_label: String(s.price_label ?? ''),
      biz_dir: validDir.includes(s.biz_dir) ? s.biz_dir : 'flat',
      biz_label: String(s.biz_label ?? ''),
      industry_type: validIndustry.includes(s.industry_type) ? s.industry_type : 'mature',
      body: String(s.body),
      caution: String(s.caution ?? ''),
      evidence_note: String(s.evidence_note ?? ''),
      evidence_href: s.evidence_href ? String(s.evidence_href) : null,
      updated_at: now,
    };
  });

  const { error } = await supabase
    .from('sector_spotlight').upsert(rows, { onConflict: 'name' });
  if (error) { console.error('❌ 저장 실패:', error.message); process.exit(1); }

  console.log(`✅ 섹터 돋보기 ${rows.length}개 저장 완료 (홈엔 rank 상위 3개 노출)`);
  for (const r of rows.sort((a, b) => a.rank - b.rank)) {
    console.log(`   #${r.rank} ${r.name} · ${r.heat}/${r.trend_state}/${r.industry_type}`);
    console.log(`      주가 ${r.price_dir}(${r.price_label}) · 업황 ${r.biz_dir}(${r.biz_label})`);
  }
}

// ── 진입 ────────────────────────────────────────────────────
const [, , cmd, ...args] = process.argv;
if (cmd === 'gather') {
  let days = 14;
  const di = args.indexOf('--days');
  if (di >= 0) { days = parseInt(args[di + 1], 10) || 14; }
  await gather(days);
} else if (cmd === 'save') {
  if (!args[0]) { console.error('사용법: node scripts/sector-spotlight.mjs save spotlight.json'); process.exit(1); }
  await save(args[0]);
} else {
  console.log('사용법:\n  node scripts/sector-spotlight.mjs gather [--days 14]\n  node scripts/sector-spotlight.mjs save spotlight.json');
}
