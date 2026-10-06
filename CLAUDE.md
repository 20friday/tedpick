# 테드픽(tedpick) 프로젝트 가이드

## 프로젝트 기본 정보
- **스택:** Astro v6 + Vercel + Supabase
- **배포:** Vercel (프로젝트명 tedpick, 20fridays-projects 팀)
- **운영자:** Ted (20friday@gmail.com)
- **Ted에 대해:** 디자이너 출신, 개발 지식 제한적. 시각적이고 간결한 설명 선호. 복잡한 기술 용어보다 쉬운 말로 설명할 것.

---

## 개발환경 세팅 (새 맥북 또는 처음 설치 시)
```bash
# 1. 레포 클론 후 이동
git clone [레포 주소]
cd tedpick

# 2. 의존성 설치
npm install

# 3. Vercel CLI 설치 및 로그인
npm i -g vercel@latest
vercel login
vercel link

# 4. 환경변수 가져오기 (.env 파일 자동 생성)
vercel env pull .env

# 5. 로컬 실행 확인
npm run dev
```

---

## 배포 방법
```bash
vercel --prod
```

---

## 자막 자동 추출 (유튜브 URL → 자막)
Ted가 방송 유튜브 URL들을 대화창에 붙여넣으면, 자막을 자동 추출해서 분석·등록한다.

```bash
# URL 여러 개 한 번에 (쇼츠는 자동 제외)
python3 scripts/fetch-transcripts.py "<URL1>" "<URL2>" ...
# 또는 파일로
python3 scripts/fetch-transcripts.py --file urls.txt
```

- **도구:** `scripts/fetch-transcripts.py` (yt-dlp + Chrome 쿠키 방식)
- **결과 저장:** `/tmp/tedpick_transcripts/<영상ID>.txt` (제목·길이·URL 헤더 포함)
- **쇼츠 자동 제외:** 60초 이하 영상은 건너뜀
- **쿠키 필요:** Ted의 Chrome 로그인 쿠키를 빌려 유튜브 봇 차단을 우회함 → **맥북에서 실행해야 함**
- **자막 생성 시간:** 영상 업로드 후 약 2~3시간 지나야 자막이 생성됨. 너무 이른 영상은 "자막 없음"으로 표시됨
- 사전 준비: `pip3 install yt-dlp` (한 번만)
- 추출 후 `view`·`insight` 등 글쓰기는 아래 문체 규칙대로 Claude가 직접 작성

### 자동화 설계 결정 (2026-06 논의)
- 완전 자동(Vercel 서버 24시간)은 보류. 서버에선 쿠키 문제로 자막이 막혀 Supadata 같은 유료 자막 API(월 약 2.4만 원)가 필요하기 때문
- 현재 방식: **대화창 붙여넣기** (맥북에서 Claude가 처리, 추가 비용 0원)
- "맥북 없이 어디서든 등록"이 필요해지면 → 어드민 웹페이지 + Supadata API로 전환 (비용 발생)

---

## ⚠️ 방송 요약 작성 기준 (필수)
방송 글을 요약·작성할 때는 **반드시** 메모리의 `tedpick-summary-criteria.md`(TED PICK 요약 작성 기준 21항)를 먼저 확인하고 그대로 따른다. **임의 판단 금지.** 핵심: 방송을 그대로 옮기지 않고 투자자용 시장 해설로 재구성 / 전달식 표현("방송에서는") 금지 / 출연자 실명 금지 / 매수·매도 권유 금지 / 방송에 없는 내용 추가 금지 / 섹션 구조(📊 시황 → 🔎 섹터 → 📰 뉴스 → 📌 핵심 종목 → 💡 인사이트 → ✅ 한 줄 정리).

---

## 글 등록 방식
방송별 개별 글(`posts`)은 **공용 등록 스크립트로 등록한다.** 손으로 insert 스크립트를 짜면 방송명(`show`) 같은 필드를 빠뜨리는 사고가 반복돼서(2026-07-21·07-27 두 번 다 show 누락), 검증·자동채움을 한 곳에 모았다.

```bash
# 1) 글 JSON 파일 작성 (한 개 객체 또는 여러 개 배열) → posts.json
# 2) 미리보기(등록 안 함)로 검증만
node scripts/insert-post.mjs posts.json --dry
# 3) 실제 등록 (slug 기준 upsert, 다시 실행해도 중복 안 생김)
node scripts/insert-post.mjs posts.json
```

- **방송명(`show`)은 slug 뒷부분에서 자동으로 채워진다.** 안 써도 되고, 슬러그가 규칙 밖이면 등록이 아예 멈춘다.
- `title`·`content`·`summary`가 비면 등록을 멈춘다. 등록 후 slug·show를 DB에서 다시 읽어 눈으로 확인 출력.
- posts.json 형식·필드 기본값은 `scripts/insert-post.mjs` 상단 주석 참고.

`daily_reports`·`weekly_reports` 등 다른 테이블은 기존처럼 `/tmp/insert_post.mjs`를 만들어 `node`로 실행한다(단, `.env` 파싱 때문에 프로젝트 루트에서 실행).

### 등록 테이블 3가지
| 테이블 | 용도 |
|-------|------|
| `posts` | 방송별 개별 글 |
| `daily_reports` | 오늘의 픽 (4개 방송 통합 리포트) |
| `weekly_reports` | 주간픽 |

### 방송 슬러그 규칙
- `YYYY-MM-DD-hankyungtv` (한국경제TV)
- `YYYY-MM-DD-samprotv` (삼프로TV)
- `YYYY-MM-DD-yonhapeconomy` (연합뉴스경제TV)
- `YYYY-MM-DD-12simannaayo` (12시에 만나요)

### 글 제목 규칙
- 날짜나 "오늘의 시황" 같은 고정 표현 사용 금지
- 방송 핵심을 담은 **문장형** — `~했어요`, `~이에요`로 마무리
- 이슈 나열 + em dash(`—`) + 핵심 메시지 구조 자주 사용
- 예: `삼성전자 노사 타결·엔비디아 호실적에 코스피 7% 급반등 — 한국 반도체가 시장의 중심으로 돌아왔어요`

### ⭐ summary 필드 규칙 (짧게!)
- `summary`는 피드 카드에 통째로 노출되는 **미리보기**다. **반드시 짧고 쉬운 1~2문장(대략 100자 안팎)**으로 쓴다.
- 시황 전체를 눌러담은 **긴 recap(300자 이상) 금지.** 오늘의 핵심 한 방울만 — 본문 `✅ 한 줄 정리`에 준하는 수준.
- 나쁜 예(❌ 400~560자 recap): "전날의 극심한 변동성을 딛고 개장과 동시에 매수 사이드카가 걸리며 코스피가… (계속 이어지는 긴 요약)"
- 좋은 예(✅ 86자): "미국 물가는 안정됐지만, 금통위는 8회 연속 동결을 깨고 기준금리를 올렸어요. 반도체 한 곳에 쏠렸던 시장은 화장품을 다음 순환매 후보로 보기 시작했어요."
- ※ 이건 `summary` 필드만 짧게. 본문(`content`)은 요약 작성 기준의 6섹션 구조대로 충실히 쓴다. (Ted 지적 2026-07-16)

### 필드 기본값
- `is_premium`: false (별도 언급 없으면 무료)
- `published`: true (별도 언급 없으면 게시)
- `date`: 방송 날짜 기준 (YYYY-MM-DD)
- `tags`: 본문 주요 종목·테마 키워드

### 정렬 규칙
- 쿼리 정렬 순서: `date desc` → `display_order asc` → `created_at desc`
- 같은 날짜 안에서 나중에 등록한 글이 상단에 표시됨

### ⚠️ 중요 규칙
- 오늘의 픽(`daily_reports`) 등록 전에 반드시 DB에서 당일 `posts` 수를 먼저 확인하고, 몇 개 방송이 등록됐는지 확인한 뒤 통합 리포트를 작성해야 한다.
- 글 등록 전 반드시 위 제목 규칙을 지킬 것. 과거에 "오늘의 시황 (날짜)" 형식으로 잘못 만들었다가 수정한 적 있음.

---

## 종목 흐름 요약 (방송언급 탭 맨 위)
종목 상세(`/stock/[name]`)의 방송언급 탭 맨 위에, 최근 2주 방송 내용을 친구에게 설명하듯 풀어쓴 **흐름 요약**(후킹 한 줄 + 짧은 문단)을 보여준다. 사용자가 타임라인 전체를 읽지 않아도 "지금 이 종목은 이런 흐름"을 한눈에 잡게 하는 게 목적.

- **테이블:** `stock_flows` (name PK · tone · headline · body · updated_at) — `supabase/stock_flows.sql`
- **tone:** `good`(긍정 흐름·붉은톤) / `watch`(주의·파란톤) / `neutral`(중립·혼조·노란톤) — 후킹 문구 색상 결정
- **문단은 규칙으로 못 만든다.** 실제 글을 읽고 Claude가 직접 써야 자연스럽다. 요약 작성 기준(실명 금지·투자권유 금지·시장 해설로 재구성)을 그대로 지킬 것.

### 갱신 워크플로우 (방송 등록할 때마다)
오늘의 픽 등록이 끝나면, **그날 언급된 종목들의 흐름 요약도 갱신**한다.
```bash
# 1) 재료 뽑기 (최근 14일, 실제 상장 종목만)
node scripts/stock-flows.mjs gather                 # 전체
node scripts/stock-flows.mjs gather 삼성전자 SK하이닉스   # 특정 종목만
# 2) Claude가 재료를 읽고 flows.json 작성 → 저장
node scripts/stock-flows.mjs save flows.json
```
- flows.json: `[{ "name": "삼성전자", "tone": "good", "headline": "…", "body": "…" }]`
- `name`은 반드시 KRX 정식명 (등록 전 `check-stock-names.mjs`로 검증)
- 언급 없던 종목은 그대로 두면 됨 (그날 언급된 종목만 다시 씀)
- 요약이 없는 종목은 카드가 자동으로 숨겨짐

---

## 시장 흐름 예측 (메인 피드 맨 위)
피드(`/`) 맨 위에, 지금 시장이 어느 쪽으로 도는지(예: "반도체는 숨 고르고, 돈은 내수·방산으로")를 한 줄 예측 + 섹터 방향 칩 + "지속/전환" 배지로 보여준다. `daily_reports`의 시장 요약·섹터 흐름을 한 단계 위로 요약하는 개념.

- **테이블:** `market_flow` (date PK · status · streak · tone · headline · body · sectors) — `supabase/market_flow.sql`. RLS 없이 생성(공개 콘텐츠, anon 읽기).
- **매일 갱신 + 지속/전환:** 흐름은 매일 다시 쓴다. 대부분은 어제와 비슷 → `status: continue`(🔁 같은 흐름 N일째, N은 저장 시 자동 계산). 실제로 바뀐 날만 `status: shift`(🚩 흐름 전환, streak 1로 리셋).
- **tone:** good(위험선호·붉은톤) / watch(위험회피·파란톤) / neutral(혼조·노란톤).
- **sectors[].dir:** up(자금 유입·강세·빨강) / down(주춤·약세·파랑) / neutral(중립·노랑).
- **방향 예측은 섹터·시장 흐름까지만.** 특정 종목 매수·매도 권유 금지. 요약 작성 기준(실명 금지·투자권유 금지·시장 해설로 재구성)을 그대로 지킨다.

### 갱신 워크플로우 (방송 등록할 때마다)
오늘의 픽 등록이 끝나면, **그날의 시장 흐름도 갱신**한다.
```bash
# 1) 재료 뽑기 (최근 N거래일 시장 요약 + 섹터 흐름 + 직전 흐름 기록)
node scripts/market-flow.mjs gather            # 기본 7일
# 2) Claude가 재료를 읽고 flow.json(하루치 1개) 작성 → 저장
node scripts/market-flow.mjs save flow.json
```
- flow.json: `{ "date":"YYYY-MM-DD", "status":"continue|shift", "tone":"…", "headline":"…", "body":"…", "sectors":[{ "name":"…", "dir":"up|down|neutral", "label":"…" }] }`
- 직전 흐름과 비교해 정말 방향이 바뀌었을 때만 `shift`. 뉘앙스만 비슷하면 `continue`.
- 데이터 없으면 카드는 자동으로 숨겨짐.

---

## 내일 시장 예측 (홈 `/`)
방송을 AI가 분석해 내일 코스피·코스닥 상승/하락을 예측하고, 실제 종가와 대조해 누적 적중률을 쌓는다. **홈**(`src/pages/index.astro`)의 두 번째 카드로 노출(예전엔 실험실 탭이었으나 2026-10 홈 신설로 홈으로 이동). 카드 폰트는 피드 기본 크기.

- **테이블:** `market_predictions` (target_date PK) — `supabase/market_predictions.sql`. RLS 없이 생성("Run without RLS").
- **네비:** 상단 네비는 `홈(/) · 방송 요약(/feed) · 종목 랭킹(/stock) · 실험실(/lab)` 4탭(`Base.astro`의 `.hdr-tabs`). 실험실은 시장예측이 홈으로 옮겨가 지금은 "준비 중" 안내만 보여줌.
- **채점 자동화:** 네이버 지수 API(당일)·야후 일봉(과거 백필)로 실제 종가를 읽어 적중 판정. 등락 부호로 상승/하락, `hit = 예측==실제`.
- **승률:** 코스피+코스닥 합산 하나. 카드엔 게이지 + 지수별 최근 8회 O/X(적중=O·실패=X).
- **준법:** 지수·재미 프레이밍, 종목 매수·매도 권유 금지. reason은 요약 작성 기준 준수.

### 갱신 워크플로우 (오늘의 픽 등록할 때마다)
```bash
# 1) 어제 만든 예측 채점 (오늘 장 마감 후)
node scripts/market-prediction.mjs score
# 2) 오늘 방송 재료로 내일 예측 작성 → 저장
node scripts/market-prediction.mjs gather
node scripts/market-prediction.mjs save prediction.json
```
- prediction.json: `{ "base_date":"YYYY-MM-DD", "kospi_dir":"up|down", "kosdaq_dir":"up|down", "reason":"…" }` (target_date 생략 시 다음 평일 자동)
- 공휴일 다음날을 예측할 땐 target_date를 명시(휴장일 판단은 `src/lib/marketHoliday.ts`).
- 데이터 없으면 카드는 자동으로 숨겨짐.

---

## 홈 (`/`) 구성
2026-10 신설. 상단 네비 맨 앞 기본 탭. 방송을 정리한 핵심만 한 화면에 모아 보여주고, 자세한 건 각 코너에서 이어본다. 위에서부터 세 블록:
1. **오늘의 픽 한눈에** — 그날 `market_flow` + `daily_reports` 통합 "오늘의 요약" 다크 카드(없으면 `PrepCard`).
2. **내일 시장 예측** — 위 "내일 시장 예측" 카드(실험실에서 이동).
3. **🔎 섹터 돋보기** — 아래 참고.

> ⚠️ 라우팅: 홈이 대표 주소 `/`(`src/pages/index.astro`), 기존 방송 피드는 `/feed`(`src/pages/feed.astro`)로 이동했다. "홈으로/뒤로" 같은 `/` 링크는 이제 홈을 가리킨다.

---

## 🔎 섹터 돋보기 (홈 맨 아래)
장기 투자자가 "지금 뜨는 섹터가 뭔지 + 반짝 상승인지 진짜 추세인지 + 길게 유망한 산업인지"를 공부하게 돕는 코너. 방향 칩만으로는 부족해서, 섹터마다 **주가와 업황을 나눠** 보여주고 **산업 성격**(구조적 성장/성숙 등)까지 테드픽이 종합 판단해 붙인다. 상위 **3개**만 노출.

- **테이블:** `sector_spotlight` (name PK) — `supabase/sector_spotlight.sql`. RLS 없이 생성("Run without RLS").
- **카드 구조:** 주목도 배지(heat) + 추세 상태(trend_state) + 주가/업황/산업성격 3분할 + 풀이(body) + ⚠️ 체크포인트(caution) + 방송 근거 보기(evidence).
- **heat:** hot(🔥 가장 뜨는) / rising(새로 주목) / steady(꾸준히 관심).
- **trend_state:** alive(추세 살아있음·녹색) / fading(기세 꺾이는 중·파랑) / pop(반짝 반등 주의·빨강).
- **price_dir·biz_dir:** up(빨강·강세) / down(파랑·약세) / flat(노랑·중립). 주가와 업황은 따로 판단(예: 반도체는 주가 조정이어도 업황 양호).
- **industry_type:** growth(구조적 성장) / mature(성숙·역풍) / decline(사양·쇠퇴) / turnaround(턴어라운드). 방송에 없는 **장기 산업 관점**이라 테드픽이 일반 지식+방송 근거로 종합. "반짝 상승(백화점 같은)"을 걸러주는 핵심 축.
- **준법:** 섹터·산업 해설까지만, 특정 종목 매수·매도 권유 금지. 요약 작성 기준(실명 금지·투자권유 금지·시장 해설로 재구성) 준수.
- **근거 링크:** evidence_href 비우면 `/feed`로 연결.

### 갱신 워크플로우 (오늘의 픽 등록할 때마다)
```bash
# 1) 재료 뽑기 (최근 14일 섹터 흐름 + 많이 언급된 종목 + 직전 돋보기)
node scripts/sector-spotlight.mjs gather
# 2) Claude가 재료를 읽고 spotlight.json(섹터 3개 안팎) 작성 → 저장
node scripts/sector-spotlight.mjs save spotlight.json
```
- spotlight.json: `[{ "name":"반도체", "heat":"hot", "trend_state":"alive", "price_dir":"up", "price_label":"조정 딛고 반등", "biz_dir":"up", "biz_label":"매우 양호", "industry_type":"growth", "body":"…", "caution":"…", "evidence_note":"…", "evidence_href":"/feed" }]`
- rank(노출 순서)는 배열 순서대로 자동. 값이 규칙 밖이면 안전한 기본값으로 보정.
- 데이터 없으면 코너가 자동으로 숨겨짐.

---

## 주요 컴포넌트 구조
| 파일 | 역할 |
|------|------|
| `src/components/PrepCard.astro` | 오늘 피드가 없을 때 보여주는 안내 카드 |
| `src/lib/marketHoliday.ts` | 국내 증시 휴장일 판단 유틸 |
| `src/layouts/Base.astro` | 공통 레이아웃 (GA4 스크립트 포함) |
| `src/pages/index.astro` | **홈** (오늘의 픽·내일 예측·섹터 돋보기) |
| `src/pages/feed.astro` | 방송 요약 피드 (`/feed`, 예전 홈) |
| `src/pages/lab.astro` | 실험실 (현재 "준비 중" 안내) |
| `src/pages/admin/index.astro` | 어드민 대시보드 |

---

## PrepCard 동작 방식
오늘 날짜 피드가 없을 때만 안내 카드 노출. 노출 우선순위:

```
오늘 피드 있음          → 카드 숨김
오늘 피드 없음 + 휴장일  → 휴장일 카드
오늘 피드 없음 + 거래일  → 시간대별 카드
```

### 시간대별 카드 (거래일 기준)
5분마다 체크하고, 시간대 경계를 넘을 때만 텍스트 변경됨.

| 시간 | 상태 |
|------|------|
| 00:00 ~ 06:00 | 새벽 (sleeping) |
| 06:00 ~ 09:00 | 개장 전 |
| 09:00 ~ 11:30 | 장 초반 |
| 11:30 ~ 13:30 | 오전장 |
| 13:30 ~ | 오늘의 PICK 정리 중 |

### 휴장일 카드 디자인 결정 사항
- 소 마스코트: sleeping 상태 그대로 유지 (별도 상태 없음)
- 펄스 도트: 파란색 → 회색(`#94a0ad`)으로 변경
- 타이틀: "오늘은 시장도 잠시 쉬어가요"
- 설명: "국내 증시 휴장일이라 오늘의 PICK은 쉬어갑니다. 다음 거래일에 주요 방송과 시장 이슈를 정리해서 다시 전해드릴게요."
- 휴장일이면 시간대 업데이트 로직 스킵 (`return` 처리)

---

## 국내 증시 휴장일 관리
`src/lib/marketHoliday.ts` 파일에서 관리.
- 주말(토·일)은 코드에서 자동 판단
- 공휴일·대체공휴일·연말폐장일은 `HOLIDAYS` Set에 하드코딩
- **매년 한국거래소(KRX) 공지에 맞춰 목록 업데이트 필요**

---

## 글·리포트 문체 및 뉘앙스 규칙

### 공통 문체
- **반드시 ~해요, ~이에요, ~예요** 체 사용. ~합니다, ~입니다 절대 사용 금지
- 친근하지만 구체적. 추상적 표현 지양
- 숫자는 한국식: "1조 5천억 원", "8%", "200만 원"
- 방송명 정확히: `12시에 만나요` / `삼프로TV` / `한국경제TV` / `연합뉴스경제TV`
- 종목명·수치·이슈를 반드시 포함. "왜 주목받는지" 이유 명시

---

### posts (방송별 개별 글) — `notes[].view` 작성 기준
- 한 방송의 관점을 2~4문장으로 압축
- 구체적 수치·이슈·방향성 포함
- 좋은 예: `"MLCC와 실리콘 캐퍼시터 1조 5천억 원 규모 공급 계약 이슈가 붙었어요. 단순 전자부품주가 아니라 AI 반도체 핵심 부품주로 재평가받는 구간이에요."`
- 나쁜 예: `"오늘 많이 올랐어요. 관심 가져볼 만해요."` ← 이유·수치 없음

---

### daily_reports (오늘의 픽) 작성 기준

**insight (전체 요약 한 단락)**
- `"오늘 4개 방송이 공통으로 확인한 건 하나예요."` 또는 `"오늘 방송들의 공통 메시지는 ~이에요."` 형태로 시작
- 공통 메시지 → 방송 간 온도 차 → 다음 관전 포인트 순으로 흐름 구성
- 길이: 4~6문장

**stocks[].notes[].view**
- 각 방송별 2~3문장, 그 방송만의 관점·강조점 담기
- 다른 방송과 비슷하면 안 됨. 방송마다 시각이 달라야 함

**comparisons[].pick (결론)**
- `"4개 방송 모두 ~으로 봤어요."` 또는 `"두 방송이 엇갈렸어요."` 형태
- 합의점과 차이점을 한 문장으로 정리

**sectors[].flow**
- 그날 그 섹터에 어떤 일이 있었는지 흐름 중심으로 2~4문장
- 왜 주목받았는지 이유 포함

---

### weekly_reports (주간픽) 작성 기준

**insight[] (배열, 3개)**
- 한 주를 시간순으로 정리: 초반 흐름 → 전환점 → 마무리
- 각 항목은 2~3문장

**sectors[].flow**
- 한 주 동안 그 섹터가 어떻게 움직였는지 흐름 요약
- 구체적 종목·이슈 포함

**splits[] (방송 간 의견 차이)**
- 합의하지 못한 지점을 명확히 드러낼 것
- `"~로 보는 관점과 ~로 보는 관점이 엇갈렸어요."` 형태

**watchlist[] / checkpoints[]**
- 다음 주에 확인해야 할 구체적 이벤트·지표 중심
- `"~가 나오는지 확인해야 해요."` 형태

---

## 디자인 원칙
- 기준 파일: `src/pages/feed.astro` (방송 요약 피드) · `src/pages/index.astro` (홈)
- 폰트 크기: 본문·입력 17px / 보조 15px / 작은 라벨 14px / 버튼 17px / 제목 20px+
- 모든 새 페이지는 이 기준 반영할 것

---

## GA4 설정
- Measurement ID: `G-XY9KNNSY9W`
- `Base.astro`에 쿠키 없는 방식으로 삽입됨
- 어드민 대시보드에 GA4 바로가기 버튼 있음
- GA4 Data API 서비스 계정은 UI로 추가 불가 (플랫폼 제약)

---

## 앞으로 남은 작업 (우선순위 순)
1. 토스페이먼츠 연동 (월정액 가격 미정)
2. 유료 글 잠금 기능 — Ted가 시점 알려줄 예정
3. GitHub 레포 Private 전환 (유료 잠금 전에)
4. `/forgot-id` 페이지 미구현 (로그인 하단 링크에 있음)
5. Supabase 이메일 템플릿 한국어화 (나중에 Resend 또는 Gmail SMTP)
