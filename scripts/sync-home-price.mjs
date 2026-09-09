import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const HOME_DATA_PATH = 'data/home-price.json';
const RECONSTRUCTION_DATA_PATH = 'data/reconstruction.json';
const CANDIDATE_DATA_PATH = 'data/candidates.json';
const SYNC_STATUS_DATA_PATH = 'data/sync-status.json';
const MAP_CONFIG_DATA_PATH = 'data/map-config.json';
const RECONSTRUCTION_SNAPSHOT_PATH = 'data/reconstruction-projects.json';
const CANDIDATE_TREND_MONTHS = 36;
const SERVICE_URL = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade';
const RECONSTRUCTION_API_URL = 'https://api.odcloud.kr/api/15160169/v1/uddi:4d7f16a9-b0fd-4d07-b266-d0ad82aeaf34';
const RECONSTRUCTION_CSV_URL = 'https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003667489&fileDetailSn=1&insertDataPrcus=N';
const RECONSTRUCTION_SOURCE_URL = 'https://www.data.go.kr/data/15160169/fileData.do';
const NAVER_GEOCODE_URL = 'https://maps.apigw.ntruss.com/map-geocode/v2/geocode';
const SOUTHERN_GYEONGGI_CITIES = new Set([
  '수원장안구', '수원권선구', '수원팔달구', '수원영통구',
  '용인처인구', '용인기흥구', '용인수지구',
  '성남수정구', '성남중원구', '성남분당구',
  '안양만안구', '안양동안구', '안산상록구', '안산단원구',
  '화성병점구', '과천시', '군포시', '의왕시', '오산시',
  '평택시', '광명시', '시흥시'
]);
const SEOUL_DISTRICTS = new Set([
  '종로구', '중구', '용산구', '성동구', '광진구', '동대문구', '중랑구',
  '성북구', '강북구', '도봉구', '노원구', '은평구', '서대문구', '마포구',
  '양천구', '강서구', '구로구', '금천구', '영등포구', '동작구', '관악구',
  '서초구', '강남구', '송파구', '강동구'
]);
const REGION_LAWD_CODES = new Map([
  ['수원장안구', '41111'], ['수원권선구', '41113'], ['수원팔달구', '41115'], ['수원영통구', '41117'],
  ['성남수정구', '41131'], ['성남중원구', '41133'], ['성남분당구', '41135'],
  ['안양만안구', '41171'], ['안양동안구', '41173'], ['안산상록구', '41271'], ['안산단원구', '41273'],
  ['용인처인구', '41461'], ['용인기흥구', '41463'], ['용인수지구', '41465'],
  ['과천시', '41290'], ['군포시', '41410'], ['의왕시', '41430'], ['오산시', '41370'],
  ['평택시', '41220'], ['광명시', '41210'], ['시흥시', '41390'], ['화성병점구', '41595'],
  ['서울특별시|종로구', '11110'], ['서울특별시|중구', '11140'], ['서울특별시|용산구', '11170'],
  ['서울특별시|성동구', '11200'], ['서울특별시|광진구', '11215'], ['서울특별시|동대문구', '11230'],
  ['서울특별시|중랑구', '11260'], ['서울특별시|성북구', '11290'], ['서울특별시|강북구', '11305'],
  ['서울특별시|도봉구', '11320'], ['서울특별시|노원구', '11350'], ['서울특별시|은평구', '11380'],
  ['서울특별시|서대문구', '11410'], ['서울특별시|마포구', '11440'], ['서울특별시|양천구', '11470'],
  ['서울특별시|강서구', '11500'], ['서울특별시|구로구', '11530'], ['서울특별시|금천구', '11545'],
  ['서울특별시|영등포구', '11560'], ['서울특별시|동작구', '11590'], ['서울특별시|관악구', '11620'],
  ['서울특별시|서초구', '11650'], ['서울특별시|강남구', '11680'], ['서울특별시|송파구', '11710'],
  ['서울특별시|강동구', '11740']
]);
const HOME_APARTMENT = {
  name: '힐스테이트 푸르지오 수원',
  address: '경기도 수원시 팔달구 효원로93번길 33',
  lawdCd: process.env.MOLIT_LAWD_CD || '41115',
  matchNames: ['힐스테이트푸르지오수원'],
  areaLabel: '전용 59㎡형',
  areaRangeSqm: { min: 59, max: 60 }
};
const MOVE_CANDIDATES = [
  {
    id: 'maegyo-prugio-sk',
    name: '매교역푸르지오SKVIEW',
    displayName: '매교역푸르지오SKVIEW',
    location: '수원시 팔달구 매교동',
    lawdCd: '41115',
    dongNames: ['매교동'],
    matchNames: ['매교역푸르지오SKVIEW'],
    requestedAreaTypes: [74, 84],
    households: 3603,
    completionYear: 2023,
    evaluation: {
      transit: 24,
      living: 18,
      complex: 20,
      strengths: ['매교역 도보권', '3,603세대 대단지', '2023년 준공 신축'],
      watchouts: ['수원역 생활권 교통량', '타입별 가격 차이 확인 필요']
    }
  },
  {
    id: 'yeongtong-sk-view',
    name: '영통SKVIEW',
    displayName: '망포동 영통SKVIEW',
    location: '수원시 영통구 망포동',
    lawdCd: '41117',
    dongNames: ['망포동'],
    matchNames: ['영통SKVIEW', '영통SK뷰'],
    households: 710,
    completionYear: 2016,
    evaluation: {
      transit: 21,
      living: 18,
      complex: 16,
      strengths: ['망포 생활권', '비교적 준신축', '영통권 통근 접근성'],
      watchouts: ['매교 후보보다 작은 단지', '세부 동·향별 가격 편차']
    }
  },
  {
    id: 'yeongtong-hyundai',
    name: '현대',
    displayName: '영통동 현대',
    location: '수원시 영통구 영통동',
    lawdCd: '41117',
    dongNames: ['영통동'],
    matchNames: ['현대'],
    households: 612,
    completionYear: 1998,
    evaluation: {
      transit: 22,
      living: 19,
      complex: 11,
      strengths: ['영통 중심 생활권', '교통·학원가 접근성', '상대적인 예산 여유 가능성'],
      watchouts: ['1998년 준공', '수리비와 장기수선 상태 확인 필요']
    }
  }
];
const RECOMMENDATION_TARGETS = [
  { id: 'rec-ipark-castle-1', name: '영통아이파크캐슬1단지', location: '수원시 영통구 망포동', lawdCd: '41117', dongNames: ['망포동'], matchNames: ['영통아이파크캐슬1단지'], households: 1783, completionYear: 2019 },
  { id: 'rec-ipark-castle-2', name: '영통아이파크캐슬2단지', location: '수원시 영통구 망포동', lawdCd: '41117', dongNames: ['망포동'], matchNames: ['영통아이파크캐슬2단지'], households: 1162, completionYear: 2019 },
  { id: 'rec-hillstate-yeongtong', name: '힐스테이트영통', location: '수원시 영통구 망포동', lawdCd: '41117', dongNames: ['망포동'], matchNames: ['힐스테이트영통'], households: 2140, completionYear: 2017 },
  { id: 'rec-raemian-markone-2', name: '래미안영통마크원2단지', location: '수원시 영통구 신동', lawdCd: '41117', dongNames: ['신동'], matchNames: ['래미안영통마크원2단지'], households: 963, completionYear: 2013 },
  { id: 'rec-lotte-elclass-1', name: '영통롯데캐슬엘클래스1단지', location: '수원시 영통구 망포동', lawdCd: '41117', dongNames: ['망포동'], matchNames: ['영통롯데캐슬엘클래스1단지'], households: 642, completionYear: 2022 },
  { id: 'rec-cheongmyeong-daewoo', name: '청명마을대우', location: '수원시 영통구 영통동', lawdCd: '41117', dongNames: ['영통동'], matchNames: ['청명마을대우'], households: 1200, completionYear: 1998 },
  { id: 'rec-gwanggyo-hoban', name: '광교호반베르디움', location: '수원시 영통구 원천동', lawdCd: '41117', dongNames: ['원천동'], matchNames: ['광교호반베르디움'], households: 1330, completionYear: 2014 },
  { id: 'rec-suji-woncheon-prugio', name: '원천마을푸르지오', location: '용인시 수지구 동천동', lawdCd: '41465', dongNames: ['동천동'], matchNames: ['원천마을푸르지오'] },
  { id: 'rec-suji-manhyeon-seongwon', name: '만현마을3단지성원쌍떼빌', location: '용인시 수지구 상현동', lawdCd: '41465', dongNames: ['상현동'], matchNames: ['만현마을3단지성원쌍떼빌'] },
  { id: 'rec-suji-sunny-valley', name: '써니벨리', location: '용인시 수지구 동천동', lawdCd: '41465', dongNames: ['동천동'], matchNames: ['써니벨리'] },
  { id: 'rec-bundang-maehwa-public-2', name: '매화마을공무원2', location: '성남시 분당구 야탑동', lawdCd: '41135', dongNames: ['야탑동'], matchNames: ['매화마을공무원2'], completionYear: 1995 },
  { id: 'rec-bundang-maehwa-public-1', name: '매화마을공무원1', location: '성남시 분당구 야탑동', lawdCd: '41135', dongNames: ['야탑동'], matchNames: ['매화마을공무원1'], completionYear: 1995 },
  { id: 'rec-bundang-rainbow-3', name: '무지개(3단지)(건영)', location: '성남시 분당구 구미동', lawdCd: '41135', dongNames: ['구미동'], matchNames: ['무지개(3단지)(건영)'] },
  { id: 'rec-bundang-sk-view', name: 'SK-VIEW', location: '성남시 분당구 야탑동', lawdCd: '41135', dongNames: ['야탑동'], matchNames: ['SK-VIEW'] },
  { id: 'rec-old-seongnam-gold-5', name: 'e편한세상금빛그랑메종5단지', location: '성남시 중원구 금광동', lawdCd: '41133', dongNames: ['금광동'], matchNames: ['e편한세상금빛그랑메종5단지'], completionYear: 2022 },
  { id: 'rec-old-seongnam-sky-2', name: '신흥역하늘채랜더스원2단지', location: '성남시 중원구 중앙동', lawdCd: '41133', dongNames: ['중앙동'], matchNames: ['신흥역하늘채랜더스원2단지'], completionYear: 2022 },
  { id: 'rec-old-seongnam-hoban', name: '판교밸리호반써밋', location: '성남시 수정구 고등동', lawdCd: '41131', dongNames: ['고등동'], matchNames: ['판교밸리호반써밋'], completionYear: 2019, households: 768 },
  { id: 'rec-old-seongnam-kolon', name: '코오롱하늘채', location: '성남시 수정구 단대동', lawdCd: '41131', dongNames: ['단대동'], matchNames: ['코오롱하늘채'] },
  { id: 'rec-giheung-central-prugio', name: '기흥역센트럴푸르지오', location: '용인시 기흥구 구갈동', lawdCd: '41463', dongNames: ['구갈동'], matchNames: ['기흥역센트럴푸르지오'], completionYear: 2018, households: 1316 }
];
const CURATED_RECONSTRUCTION_TARGETS = [
  {
    id: 'yeongtong-2',
    name: '영통2구역 · 매탄주공4단지',
    location: '수원시 영통구 매탄동',
    regionName: '수원영통구',
    mapPoint: { latitude: 37.2588, longitude: 127.0396, accuracy: '단지명 기준 추정 위치' },
    mapQuery: '매탄주공4단지',
    lawdCd: '41117',
    matchNames: ['매탄주공4단지', '매탄주공4'],
    stage: '이주 · 철거 단계',
    milestone: '이주·철거 마무리 단계 보도',
    remainingEstimate: '준공까지 약 2~4년 추정',
    sourceUrl: 'https://wonnam.co.kr/yeongtong-2-district-xi-ipark-2026-location-analysis/',
    sourceLabel: '진행 정보 보기',
    projectType: '재건축(공동주택)',
    supplyHouseholds: null
  },
  {
    id: 'gwacheon-10',
    name: '과천주공10단지',
    location: '과천시 중앙동',
    regionName: '과천시',
    mapPoint: { latitude: 37.4322, longitude: 126.9917, accuracy: '단지명 기준 추정 위치' },
    mapQuery: '과천주공10단지',
    lawdCd: '41290',
    matchNames: ['과천주공10단지', '주공10단지'],
    stage: '조합 운영 · 이주 준비',
    milestone: '2027년 5월 이주 계획 보도',
    remainingEstimate: '이주까지 약 1년 · 입주는 이후 일정 확인',
    sourceUrl: 'https://realty.chosun.com/site/data/html_dir/2025/04/03/2025040301944.html',
    sourceLabel: '진행 정보 보기',
    projectType: '재건축(공동주택)',
    supplyHouseholds: 1339,
    officialZoneName: '주공10단지구역'
  },
  {
    id: 'sanbon-11',
    name: '산본11구역 · 산본주공11단지',
    location: '군포시 산본동',
    regionName: '군포시',
    mapPoint: { latitude: 37.3566, longitude: 126.9298, accuracy: '단지명 기준 추정 위치' },
    mapQuery: '산본주공11단지',
    lawdCd: '41410',
    matchNames: ['산본주공11단지', '주공11단지'],
    stage: '주민대표회의 구성 승인',
    milestone: '2026년 6월 구성 승인 보도',
    remainingEstimate: '준공까지 약 6~8년 이상 추정',
    sourceUrl: 'https://newstown.co.kr/news/articleView.html?idxno=705409',
    sourceLabel: '진행 정보 보기',
    projectType: '재건축(공동주택)',
    supplyHouseholds: 3892,
    officialZoneName: '군포산본11'
  },
  {
    id: 'bundang-yangji',
    name: '분당 양지마을 통합 · 금호1단지',
    location: '성남시 분당구 수내동',
    regionName: '성남분당구',
    mapPoint: { latitude: 37.3751, longitude: 127.1166, accuracy: '단지명 기준 추정 위치' },
    mapQuery: '분당 양지마을 금호1단지',
    lawdCd: '41135',
    matchNames: ['양지마을1단지금호', '금호1단지'],
    stage: '통합 재건축 계획 조율',
    milestone: '단지별 통합 방식 조율 진행',
    remainingEstimate: '준공까지 약 7~10년 이상 추정',
    sourceUrl: 'https://v.daum.net/v/prfWglQ9Ww',
    sourceLabel: '진행 정보 보기',
    projectType: '재건축(공동주택)',
    supplyHouseholds: null
  }
];

const PROJECT_TRADE_OVERRIDES = new Map([
  ['평택시|합정주공', { lawdCd: '41220', matchNames: ['합정주공'] }],
  ['평택시|송원,현대연립', { lawdCd: '41220', matchNames: ['송원연립', '현대연립'] }],
  ['의왕시|부곡다구역(우성5차아파트)', { lawdCd: '41430', matchNames: ['우성5차'] }],
  ['과천시|주공8,9단지구역', { lawdCd: '41290', matchNames: ['주공8단지', '주공9단지'] }],
  ['과천시|주공10단지구역', { lawdCd: '41290', matchNames: ['과천주공10단지', '주공10단지'] }],
  ['과천시|주공4단지구역', { lawdCd: '41290', matchNames: ['과천주공4단지', '주공4단지'] }],
  ['평택시|서정3(송탄서정주공3단지아파트)', { lawdCd: '41220', matchNames: ['송탄서정주공3단지', '서정주공3단지'] }],
  ['과천시|과천주공5단지', { lawdCd: '41290', matchNames: ['과천주공5단지', '주공5단지'] }],
  ['군포시|군포산본9-2', { lawdCd: '41410', matchNames: ['산본주공9단지2차', '주공9단지2차'] }],
  ['군포시|군포산본11', { lawdCd: '41410', matchNames: ['산본주공11단지', '주공11단지'] }],
  ['오산시|오산원동주공아파트재건축정비구역', { lawdCd: '41370', matchNames: ['원동주공'] }]
]);

function kstDate(date = new Date()) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
}

function formatKstTimestamp(date = new Date()) {
  const kst = kstDate(date);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  const hours = String(kst.getUTCHours()).padStart(2, '0');
  const minutes = String(kst.getUTCMinutes()).padStart(2, '0');
  return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ' KST';
}

function recentMonths(monthCount = 3) {
  const now = kstDate();
  return Array.from({ length: monthCount }, (_, offset) => {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    return month.getUTCFullYear() + String(month.getUTCMonth() + 1).padStart(2, '0');
  });
}

function cutoffDate(monthCount = 3) {
  const now = kstDate();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (monthCount - 1), 1));
}

function decodeXml(value = '') {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
}

function tagValue(source, names) {
  for (const name of names) {
    const match = source.match(new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>'));
    if (match) return decodeXml(match[1]);
  }
  return '';
}

function apiErrorDetail(response, body) {
  const resultCode = tagValue(body, ['resultCode']);
  const resultMessage = tagValue(body, ['resultMsg', 'resultMessage']);
  if (resultCode || resultMessage) return [resultCode, resultMessage].filter(Boolean).join(' · ');
  const plainBody = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return plainBody.slice(0, 160) || response.statusText || '응답 내용 없음';
}

function normalizedName(name = '') {
  return name.replace(/[\s·ㆍ-]/g, '').toLowerCase();
}

function matchesTarget(name, target) {
  const normalized = normalizedName(name);
  return target.matchNames.some((candidate) => {
    const expected = normalizedName(candidate);
    if (normalized === expected || normalized.includes(expected)) return true;
    if (!expected.includes(normalized)) return false;
    const nameNumbers = normalized.match(/\d+/g) || [];
    const expectedNumbers = expected.match(/\d+/g) || [];
    if (nameNumbers.join(',') !== expectedNumbers.join(',')) return false;
    const minimumLength = nameNumbers.length ? 3 : 4;
    return normalized.length >= minimumLength && normalized.length / expected.length >= 0.8;
  });
}

function parseTransactions(xml) {
  const records = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const match of itemMatches) {
    const item = match[1];
    const name = tagValue(item, ['aptNm', 'aptName']);
    const year = tagValue(item, ['dealYear', 'contractYear']);
    const month = tagValue(item, ['dealMonth', 'contractMonth']).padStart(2, '0');
    const day = tagValue(item, ['dealDay', 'contractDay']).padStart(2, '0');
    const priceManwon = Number(tagValue(item, ['dealAmount', 'dealAmt']).replace(/[^0-9]/g, ''));
    const areaSqm = Number(tagValue(item, ['excluUseAr', 'excluUseArea']));
    const floor = Number(tagValue(item, ['floor']));
    const cancellationType = tagValue(item, ['cdealType']);
    const cancellationDate = tagValue(item, ['cdealDay']);
    const contractDate = year && month && day ? year + '-' + month + '-' + day : '';
    if (!contractDate || !Number.isFinite(priceManwon) || cancellationType === 'O' || cancellationDate) continue;
    records.push({
      apartmentName: name,
      buildYear: Number(tagValue(item, ['buildYear'])) || null,
      dongName: tagValue(item, ['umdNm', 'legalDong', 'dong']),
      jibun: tagValue(item, ['jibun']),
      contractDate,
      priceManwon,
      areaSqm: Number.isFinite(areaSqm) ? areaSqm : null,
      floor: Number.isFinite(floor) ? floor : null
    });
  }
  return records.sort((left, right) => right.contractDate.localeCompare(left.contractDate));
}

function summarizeTransactions(records) {
  const prices = records.map((record) => record.priceManwon);
  return records.length ? {
    count: records.length,
    averagePriceManwon: Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length),
    minPriceManwon: Math.min(...prices),
    maxPriceManwon: Math.max(...prices),
    latestPriceManwon: records[0].priceManwon
  } : null;
}

const districtMonthCache = new Map();

function decodedServiceKey(serviceKey) {
  let decodedKey;
  try {
    decodedKey = decodeURIComponent(serviceKey.trim());
  } catch {
    throw new Error('MOLIT_SERVICE_KEY 형식이 올바르지 않습니다. 일반 인증키(Decoding)를 다시 등록해 주세요.');
  }
  return decodedKey;
}

async function requestDistrictPage(serviceKey, lawdCd, yearMonth, pageNo) {
  const url = new URL(SERVICE_URL);
  url.searchParams.set('serviceKey', decodedServiceKey(serviceKey));
  url.searchParams.set('LAWD_CD', lawdCd);
  url.searchParams.set('DEAL_YMD', yearMonth);
  url.searchParams.set('numOfRows', '1000');
  url.searchParams.set('pageNo', String(pageNo));
  const response = await fetch(url);
  const body = await response.text();
  const resultCode = tagValue(body, ['resultCode']);
  if (!response.ok) throw new Error('국토교통부 API HTTP ' + response.status + ': ' + apiErrorDetail(response, body));
  if (!['00', '000'].includes(resultCode)) throw new Error('국토교통부 API 오류: ' + apiErrorDetail(response, body));
  return {
    records: parseTransactions(body),
    totalCount: Number(tagValue(body, ['totalCount'])) || 0
  };
}

function fetchDistrictMonth(serviceKey, lawdCd, yearMonth) {
  const cacheKey = lawdCd + '-' + yearMonth;
  if (districtMonthCache.has(cacheKey)) return districtMonthCache.get(cacheKey);
  const request = (async () => {
    const first = await requestDistrictPage(serviceKey, lawdCd, yearMonth, 1);
    const pageCount = Math.ceil(first.totalCount / 1000);
    if (pageCount <= 1) return first.records;
    const remaining = await Promise.all(Array.from({ length: pageCount - 1 }, (_, index) => requestDistrictPage(serviceKey, lawdCd, yearMonth, index + 2)));
    return [first.records, ...remaining.map((page) => page.records)].flat();
  })();
  districtMonthCache.set(cacheKey, request);
  return request;
}

function targetTransactions(records, target, cutoff) {
  return records.filter((record) => {
    if (target.exactName && normalizedName(record.apartmentName) !== normalizedName(target.name)) return false;
    if (target.jibun && record.jibun !== target.jibun) return false;
    if (!matchesTarget(record.apartmentName, target)) return false;
    if (target.dongNames?.length && !target.dongNames.some((dong) => normalizedName(record.dongName) === normalizedName(dong))) return false;
    const parsedDate = new Date(record.contractDate + 'T00:00:00Z');
    if (parsedDate < cutoff) return false;
    const areaRange = target.areaRangeSqm;
    return !areaRange || (Number.isFinite(record.areaSqm) && record.areaSqm >= areaRange.min && record.areaSqm < areaRange.max);
  });
}

function areaTypeFor(areaSqm, requestedTypes) {
  if (!Number.isFinite(areaSqm)) return null;
  const commonTypes = requestedTypes?.length ? requestedTypes : [39, 49, 59, 74, 84, 99, 101, 110, 114, 124, 134, 149];
  const nearest = commonTypes.reduce((best, type) => Math.abs(type - areaSqm) < Math.abs(best - areaSqm) ? type : best, commonTypes[0]);
  if (Math.abs(nearest - areaSqm) <= 1.5) return nearest;
  return requestedTypes?.length ? null : Math.round(areaSqm);
}

function medianPrice(records) {
  const prices = records.map((record) => record.priceManwon).filter(Number.isFinite).sort((left, right) => left - right);
  if (!prices.length) return null;
  const middle = Math.floor(prices.length / 2);
  return Math.round(prices.length % 2 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2);
}

function shiftDateMonths(dateString, monthOffset) {
  const date = new Date(dateString + 'T00:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + monthOffset);
  return date.toISOString().slice(0, 10);
}

function monthDistance(startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  return Math.max(0, Math.round((end - start) / (30.4375 * 24 * 60 * 60 * 1000)));
}

function percentChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return Number(((current / previous - 1) * 100).toFixed(1));
}

function analyzePriceGrowth(records) {
  const sorted = [...records].sort((left, right) => left.contractDate.localeCompare(right.contractDate));
  const firstDate = sorted[0]?.contractDate;
  const latestDate = sorted.at(-1)?.contractDate;
  if (!firstDate || !latestDate) return { status: 'insufficient', message: '분석할 거래가 부족합니다.' };

  const observedMonths = monthDistance(firstDate, latestDate);
  const baselineEnd = shiftDateMonths(firstDate, 6);
  const recentStart = shiftDateMonths(latestDate, -6);
  const previousStart = shiftDateMonths(latestDate, -12);
  const baselineRecords = sorted.filter((record) => record.contractDate <= baselineEnd);
  const recentRecords = sorted.filter((record) => record.contractDate >= recentStart);
  const previousRecords = sorted.filter((record) => record.contractDate >= previousStart && record.contractDate < recentStart);

  if (observedMonths < 18 || baselineRecords.length < 3 || recentRecords.length < 3) {
    return {
      status: 'insufficient',
      message: '비교 가능한 장기 거래가 부족합니다.',
      observedMonths,
      transactionCount: sorted.length
    };
  }

  const baselineMedianPriceManwon = medianPrice(baselineRecords);
  const recentMedianPriceManwon = medianPrice(recentRecords);
  const previousMedianPriceManwon = medianPrice(previousRecords);
  const longTermChangePercent = percentChange(recentMedianPriceManwon, baselineMedianPriceManwon);
  const recentMomentumPercent = percentChange(recentMedianPriceManwon, previousMedianPriceManwon);
  const confidence = observedMonths >= 30 && baselineRecords.length >= 8 && recentRecords.length >= 8 && sorted.length >= 40
    ? 'high'
    : (observedMonths >= 24 && baselineRecords.length >= 4 && recentRecords.length >= 4 && sorted.length >= 16 ? 'medium' : 'limited');

  return {
    status: Number.isFinite(longTermChangePercent) ? 'ok' : 'insufficient',
    score: null,
    observedMonths,
    periodStart: firstDate,
    periodEnd: latestDate,
    transactionCount: sorted.length,
    baselineSampleCount: baselineRecords.length,
    recentSampleCount: recentRecords.length,
    baselineMedianPriceManwon,
    recentMedianPriceManwon,
    longTermChangePercent,
    recentMomentumPercent,
    confidence
  };
}

function relativeRank(value, values) {
  const validValues = values.filter(Number.isFinite);
  if (!Number.isFinite(value) || !validValues.length) return 0;
  if (validValues.length === 1) return 0.5;
  const lowerCount = validValues.filter((candidate) => candidate < value).length;
  const equalCount = validValues.filter((candidate) => candidate === value).length;
  return (lowerCount + (equalCount - 1) / 2) / (validValues.length - 1);
}

function assignGrowthScores(items) {
  const analyses = items.flatMap((item) => (item.areaPrices || []).map((area) => area.growthAnalysis)).filter((analysis) => analysis?.status === 'ok');
  const changes = analyses.map((analysis) => analysis.longTermChangePercent);
  const momentums = analyses.map((analysis) => analysis.recentMomentumPercent).filter(Number.isFinite);
  const liquidities = analyses.map((analysis) => Math.log1p(analysis.transactionCount));
  analyses.forEach((analysis) => {
    const trendRank = relativeRank(analysis.longTermChangePercent, changes);
    const momentumRank = Number.isFinite(analysis.recentMomentumPercent) ? relativeRank(analysis.recentMomentumPercent, momentums) : 0;
    const liquidityRank = relativeRank(Math.log1p(analysis.transactionCount), liquidities);
    analysis.score = Math.round((trendRank * 0.55 + momentumRank * 0.25 + liquidityRank * 0.2) * 100);
  });
}

function summarizeAreaPrices(records, requestedTypes, options = {}) {
  const groups = new Map();
  records.forEach((record) => {
    const areaTypeSqm = areaTypeFor(record.areaSqm, requestedTypes);
    if (!Number.isFinite(areaTypeSqm)) return;
    if (!groups.has(areaTypeSqm)) groups.set(areaTypeSqm, []);
    groups.get(areaTypeSqm).push(record);
  });
  return [...groups.entries()].map(([areaTypeSqm, group]) => {
    const summaryCutoff = options.summaryMonthCount ? cutoffDate(options.summaryMonthCount) : null;
    const summaryRecords = summaryCutoff
      ? group.filter((record) => new Date(record.contractDate + 'T00:00:00Z') >= summaryCutoff)
      : group;
    const sorted = [...summaryRecords].sort((left, right) => right.contractDate.localeCompare(left.contractDate));
    if (!sorted.length) return null;
    const summary = summarizeTransactions(sorted);
    const representativeAreaSqm = sorted.reduce((total, record) => total + record.areaSqm, 0) / sorted.length;
    return {
      areaTypeSqm,
      areaLabel: '전용 ' + areaTypeSqm + '㎡ · 약 ' + Math.round(areaTypeSqm / 3.3058) + '평',
      representativeAreaSqm: Number(representativeAreaSqm.toFixed(2)),
      count: summary.count,
      averagePriceManwon: summary.averagePriceManwon,
      minPriceManwon: summary.minPriceManwon,
      maxPriceManwon: summary.maxPriceManwon,
      latestPriceManwon: summary.latestPriceManwon,
      latestContractDate: sorted[0].contractDate,
      recentTransactions: sorted.slice(0, 3),
      ...(options.analyzeGrowth ? { growthAnalysis: analyzePriceGrowth(group) } : {})
    };
  }).filter(Boolean).sort((left, right) => left.areaTypeSqm - right.areaTypeSqm);
}

async function fetchTransactions(serviceKey, target, monthCount = 3, options = {}) {
  const cutoff = cutoffDate(monthCount);
  const responses = await Promise.all(recentMonths(monthCount).map((yearMonth) => fetchDistrictMonth(serviceKey, target.lawdCd, yearMonth)));
  const records = targetTransactions(responses.flat(), target, cutoff).sort((left, right) => right.contractDate.localeCompare(left.contractDate));
  return {
    status: records.length ? 'ok' : 'empty',
    message: records.length ? '' : '최근 ' + monthCount + '개월 내 ' + (target.areaLabel ? target.areaLabel + ' ' : '') + '신고 거래가 없어요.',
    periodLabel: '최근 ' + monthCount + '개월 계약일 기준' + (target.areaLabel ? ' · ' + target.areaLabel : '') + ' · ' + records.length + '건',
    summary: summarizeTransactions(records),
    areaPrices: summarizeAreaPrices(records, target.requestedAreaTypes, options),
    records
  };
}

function normalizeListing(item) {
  const priceManwon = Number(item.priceManwon ?? item.priceInManwon ?? item.price ?? item.dealOrWarrantPrc);
  return {
    title: String(item.title ?? item.articleName ?? item.articleNo ?? '현재 매물'),
    tradeType: String(item.tradeType ?? item.tradeTypeName ?? item.tradeTypeCode ?? '매매'),
    priceManwon: Number.isFinite(priceManwon) ? priceManwon : null,
    areaSqm: Number(item.areaSqm ?? item.exclusiveArea ?? item.area1) || null,
    floor: Number(item.floor ?? item.floorInfo) || null
  };
}

async function fetchCurrentListings() {
  const endpoint = process.env.LISTINGS_API_URL;
  if (!endpoint) return { status: 'not_configured', sourceName: '허용된 매물 데이터 제공자 연결 대기', message: '반복 수집이 허용된 매물 데이터 API를 연결하면 최신 매물가를 표시합니다.', syncedAt: null, items: [] };
  try {
    const headers = { Accept: 'application/json' };
    if (process.env.LISTINGS_API_TOKEN) headers.Authorization = 'Bearer ' + process.env.LISTINGS_API_TOKEN;
    const response = await fetch(endpoint, { headers });
    if (!response.ok) throw new Error('매물 데이터 요청에 실패했습니다.');
    const payload = await response.json();
    const rawItems = Array.isArray(payload) ? payload : (payload.items ?? payload.listings ?? []);
    const items = rawItems.map(normalizeListing).filter((item) => item.priceManwon && item.areaSqm >= HOME_APARTMENT.areaRangeSqm.min && item.areaSqm < HOME_APARTMENT.areaRangeSqm.max);
    return { status: items.length ? 'ok' : 'empty', sourceName: process.env.LISTINGS_SOURCE_NAME || '연결된 매물 데이터 제공자', message: items.length ? '' : '전용 59㎡형 매물이 없습니다.', syncedAt: formatKstTimestamp(), items };
  } catch (error) {
    return { status: 'error', sourceName: process.env.LISTINGS_SOURCE_NAME || '연결된 매물 데이터 제공자', message: '현재 매물 정보를 가져오지 못했어요. 다음 동기화 때 다시 시도합니다.', syncedAt: null, items: [] };
  }
}

function marketPriceEok(payload, prefix) {
  const eok = Number(payload[prefix + 'PriceEok']);
  if (Number.isFinite(eok) && eok > 0) return eok;
  const manwon = Number(payload[prefix + 'PriceManwon']);
  if (Number.isFinite(manwon) && manwon > 0) return manwon / 10000;
  const won = Number(payload[prefix + 'PriceWon']);
  return Number.isFinite(won) && won > 0 ? won / 100000000 : Number.NaN;
}

async function fetchKbMarketPrice() {
  const endpoint = process.env.KB_MARKET_API_URL;
  if (!endpoint) {
    return {
      status: 'not_available',
      sourceName: 'KB부동산',
      message: 'KB 시세 공개 API가 없어 현재는 직접 입력합니다.',
      syncedAt: null
    };
  }
  try {
    const headers = { Accept: 'application/json' };
    if (process.env.KB_MARKET_API_TOKEN) headers.Authorization = 'Bearer ' + process.env.KB_MARKET_API_TOKEN;
    const response = await fetch(endpoint, { headers });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const payload = await response.json();
    const market = payload.marketPrice || payload.kbMarketPrice || payload;
    const lowPriceEok = marketPriceEok(market, 'low');
    const highPriceEok = marketPriceEok(market, 'high');
    if (!Number.isFinite(lowPriceEok) || !Number.isFinite(highPriceEok)) throw new Error('상·하한 시세 필드 없음');
    return {
      status: 'ok',
      sourceName: process.env.KB_MARKET_SOURCE_NAME || '계약된 KB 시세 데이터 제공자',
      message: '',
      syncedAt: formatKstTimestamp(),
      lowPriceEok,
      highPriceEok
    };
  } catch (error) {
    return {
      status: 'error',
      sourceName: process.env.KB_MARKET_SOURCE_NAME || '계약된 KB 시세 데이터 제공자',
      message: '연결된 시세 API를 확인해 주세요: ' + error.message,
      syncedAt: null
    };
  }
}

function preservePreviousOnError(current, previous, hasUsableData) {
  if (current.status !== 'error' || !hasUsableData(previous)) return current;
  return {
    ...previous,
    status: 'stale',
    message: current.message + ' 마지막 정상 동기화 값을 유지합니다.',
    lastAttemptAt: formatKstTimestamp(),
    lastAttemptStatus: 'error'
  };
}

async function readExistingData(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return {};
  }
}

function parseCsvLine(line) {
  const cells = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      cells.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }
  cells.push(value.trim());
  return cells;
}

function parseReconstructionCsv(csv) {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  const headers = parseCsvLine(lines.shift() || '');
  return lines.map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
  });
}

function withoutCode(value = '') {
  return String(value).trim().replace(/^\d+\)\s*/, '');
}

function remainingEstimateForStage(stage = '') {
  if (/준공|이전고시/.test(stage)) return '사업 완료 또는 입주 단계';
  if (/착공/.test(stage)) return '준공까지 약 2~4년 추정';
  if (/관리처분/.test(stage)) return '준공까지 약 3~6년 추정';
  if (/사업시행자지정/.test(stage)) return '준공까지 약 6~10년 추정';
  if (/사업시행/.test(stage)) return '준공까지 약 4~7년 추정';
  if (/조합설립/.test(stage)) return '준공까지 약 6~10년 추정';
  if (/추진위/.test(stage)) return '준공까지 약 8~12년 추정';
  if (/정비구역/.test(stage)) return '준공까지 약 9~13년 추정';
  return '사업 단계에 따라 10년 이상 걸릴 수 있음';
}

function stageOrder(stage = '') {
  if (/준공|이전고시/.test(stage)) return 8;
  if (/착공/.test(stage)) return 7;
  if (/관리처분/.test(stage)) return 6;
  if (/사업시행자지정/.test(stage)) return 4;
  if (/사업시행/.test(stage)) return 5;
  if (/조합설립/.test(stage)) return 4;
  if (/추진위/.test(stage)) return 3;
  if (/정비구역/.test(stage)) return 2;
  return 1;
}

function administrativeRegionFor(provinceName, regionName) {
  if (provinceName === '서울특별시') {
    return {
      provinceName,
      cityName: '서울특별시',
      districtName: regionName,
      location: '서울특별시 ' + regionName
    };
  }
  const districtMatch = regionName.match(/^(수원|용인|성남|안양|안산|화성)(.+구)$/);
  if (districtMatch) {
    return {
      provinceName,
      cityName: districtMatch[1] + '시',
      districtName: districtMatch[2],
      location: provinceName + ' ' + districtMatch[1] + '시 ' + districtMatch[2]
    };
  }
  return {
    provinceName,
    cityName: regionName,
    districtName: '',
    location: provinceName + ' ' + regionName
  };
}

function regionDataKey(provinceName, regionName) {
  return provinceName === '서울특별시' ? provinceName + '|' + regionName : regionName;
}

function projectIdFor(provinceName, regionName, zoneName) {
  const source = [provinceName, regionName, zoneName].join('|');
  const hash = Array.from(source).reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 17).toString(36);
  return 'official-' + normalizedName(source).slice(0, 60) + '-' + hash;
}

function isVerifiedMapPoint(point) {
  return Number.isFinite(point?.latitude)
    && Number.isFinite(point?.longitude)
    && point.source === 'naver-geocode';
}

function strongTransactionMatch(record, target) {
  const actual = normalizedName(record?.apartmentName);
  if (!actual) return false;
  return (target.matchNames || []).some((candidate) => {
    const expected = normalizedName(candidate);
    if (actual === expected || actual.includes(expected)) return true;
    return expected.includes(actual) && actual.length / expected.length >= 0.8;
  });
}

function reconstructionGeocodeQueries(item) {
  const queries = [];
  const add = (query, basis) => {
    const normalized = String(query || '').replace(/\s+/g, ' ').trim();
    if (normalized && !queries.some((entry) => entry.query === normalized)) queries.push({ query: normalized, basis });
  };
  add([item.location, item.apartmentName].filter(Boolean).join(' '), 'project-name');
  (item.matchNames || []).slice(0, 2).forEach((name) => add([item.location, name].join(' '), 'project-name'));
  if (item.latestTransaction?.dongName && item.latestTransaction?.jibun && strongTransactionMatch(item.latestTransaction, item)) {
    add([item.location, item.latestTransaction.dongName, item.latestTransaction.jibun].join(' '), 'transaction-jibun');
  }
  return queries;
}

function geocodeAddressText(address) {
  return [
    address.roadAddress,
    address.jibunAddress,
    ...(address.addressElements || []).map((element) => element.longName)
  ].filter(Boolean).join(' ');
}

function geocodeAddressMatchesRegion(address, item) {
  const fullAddress = geocodeAddressText(address);
  return String(item.location || '').split(/\s+/).filter(Boolean).every((token) => fullAddress.includes(token));
}

function geocodeAddressMatchesProject(address, item) {
  const addressName = normalizedName(geocodeAddressText(address));
  return [item.apartmentName, ...(item.matchNames || [])]
    .map((name) => normalizedName(name).replace(/재건축정비구역|재건축사업|정비구역|재건축|아파트|단지|구역/g, ''))
    .filter((name) => name.length >= 4)
    .some((name) => addressName.includes(name));
}

function geocodedDongName(address) {
  return address.addressElements?.find((element) => element.types?.includes('DONGMYUN'))?.longName || '';
}

async function requestNaverGeocode(clientId, clientSecret, item, entry) {
  const url = new URL(NAVER_GEOCODE_URL);
  url.searchParams.set('query', entry.query);
  url.searchParams.set('count', '5');
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'x-ncp-apigw-api-key-id': clientId,
      'x-ncp-apigw-api-key': clientSecret
    }
  });
  if (!response.ok) {
    const error = new Error('NAVER Geocoding HTTP ' + response.status);
    error.status = response.status;
    throw error;
  }
  const payload = await response.json();
  const address = (payload.addresses || []).find((candidate) => (
    geocodeAddressMatchesRegion(candidate, item)
    && (entry.basis === 'transaction-jibun' || geocodeAddressMatchesProject(candidate, item))
  ));
  if (!address) return null;
  const longitude = Number(address.x);
  const latitude = Number(address.y);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const dongName = geocodedDongName(address);
  return {
    mapPoint: {
      latitude,
      longitude,
      accuracy: entry.basis === 'transaction-jibun' ? '실거래 지번 · NAVER Geocoding' : '단지명 · NAVER Geocoding',
      source: 'naver-geocode'
    },
    geocodeStatus: 'ok',
    geocodeQuery: entry.query,
    geocodeAddress: address.roadAddress || address.jibunAddress || '',
    geocodedDongName: dongName,
    ...(dongName ? { dongNames: [...new Set([...(item.dongNames || []), dongName])] } : {})
  };
}

function preserveVerifiedCoordinate(item, previousItem, status, message, signature) {
  if (isVerifiedMapPoint(previousItem?.mapPoint)) {
    const dongName = previousItem.geocodedDongName || '';
    return {
      ...item,
      mapPoint: previousItem.mapPoint,
      geocodeStatus: 'ok',
      geocodeQuery: previousItem.geocodeQuery,
      geocodeAddress: previousItem.geocodeAddress,
      geocodedDongName: dongName,
      geocodeSignature: previousItem.geocodeSignature || signature,
      ...(dongName ? { dongNames: [...new Set([...(item.dongNames || []), dongName])] } : {})
    };
  }
  return { ...item, mapPoint: null, geocodeStatus: status, geocodeMessage: message, geocodeSignature: signature };
}

async function geocodeReconstructionTargets(targets, previous, clientId, clientSecret) {
  const previousItems = new Map((previous.items || []).map((item) => [item.id, item]));
  if (!clientId || !clientSecret) {
    const items = targets.map((item) => preserveVerifiedCoordinate(
      item,
      previousItems.get(item.id),
      'not_configured',
      'NAVER Geocoding 설정 대기',
      ''
    ));
    return {
      items,
      summary: {
        status: 'not_configured',
        mappedCount: items.filter((item) => isVerifiedMapPoint(item.mapPoint)).length,
        totalCount: items.length,
        message: 'Geocoding API와 NAVER_MAPS_CLIENT_SECRET 설정이 필요합니다.'
      }
    };
  }

  let fatalError = null;
  const items = [];
  for (let index = 0; index < targets.length; index += 4) {
    const batch = targets.slice(index, index + 4);
    const results = await Promise.all(batch.map(async (item) => {
      const previousItem = previousItems.get(item.id);
      const queries = reconstructionGeocodeQueries(item);
      const signature = 'v1|' + queries.map((entry) => entry.query).join('|');
      if (isVerifiedMapPoint(previousItem?.mapPoint)) return preserveVerifiedCoordinate(item, previousItem, 'ok', '', signature);
      if (previousItem?.geocodeStatus === 'not_found' && previousItem.geocodeSignature === signature) {
        return preserveVerifiedCoordinate(item, previousItem, 'not_found', '주소 검색 결과 없음', signature);
      }
      if (fatalError) return preserveVerifiedCoordinate(item, previousItem, 'error', fatalError.message, signature);
      try {
        for (const entry of queries) {
          const result = await requestNaverGeocode(clientId, clientSecret, item, entry);
          if (result) return { ...item, ...result, geocodeSignature: signature, geocodeCheckedAt: formatKstTimestamp() };
        }
        return preserveVerifiedCoordinate(item, previousItem, 'not_found', '주소 검색 결과 없음', signature);
      } catch (error) {
        if ([401, 403, 429].includes(error.status)) fatalError = error;
        return preserveVerifiedCoordinate(item, previousItem, 'error', error.message, signature);
      }
    }));
    items.push(...results);
    if (index + 4 < targets.length && !fatalError) await new Promise((resolve) => setTimeout(resolve, 120));
  }
  const mappedCount = items.filter((item) => isVerifiedMapPoint(item.mapPoint)).length;
  return {
    items,
    summary: {
      status: fatalError ? 'error' : (mappedCount === items.length ? 'ok' : 'partial'),
      mappedCount,
      totalCount: items.length,
      message: fatalError ? fatalError.message : 'NAVER 주소 검색으로 확인된 좌표만 표시합니다.'
    }
  };
}

function deriveProjectMatchNames(zoneName) {
  const candidates = [];
  const addCandidate = (value) => {
    const cleaned = String(value || '')
      .replace(/재건축정비구역|재건축사업|정비구역|재건축|구역$/g, '')
      .replace(/아파트$/g, '')
      .trim();
    const paired = cleaned.match(/^(.+?)(\d+)\s*[,·ㆍ]\s*(\d+)(단지)?/);
    if (paired) {
      const suffix = paired[4] || '단지';
      addCandidate(paired[1] + paired[2] + suffix);
      addCandidate(paired[1] + paired[3] + suffix);
      return;
    }
    if (normalizedName(cleaned).length >= 4) candidates.push(cleaned);
  };

  for (const match of zoneName.matchAll(/\(([^)]+)\)/g)) {
    match[1].split(/[+·ㆍ/]/).forEach(addCandidate);
  }
  const withoutParentheses = zoneName.replace(/\([^)]*\)/g, '').trim();
  addCandidate(withoutParentheses);
  return [...new Set(candidates)];
}

function deriveApartmentDisplayName(zoneName) {
  const parentheticalNames = [...zoneName.matchAll(/\(([^)]+)\)/g)]
    .flatMap((match) => match[1].split(/[+·,]/))
    .map((name) => name.trim())
    .filter((name) => /아파트|주공|단지|연립|맨션|빌라/.test(name));
  if (parentheticalNames.length) return parentheticalNames.join(' · ');
  if (/아파트|주공|단지|연립|맨션|빌라/.test(zoneName)) return zoneName.replace(/구역$/, '');
  return zoneName + (/구역|촉진|계획|재건축|정비$/.test(zoneName) ? '' : ' 정비구역');
}

function officialReconstructionTargets(rows) {
  const targets = rows
    .filter((row) => {
      const provinceName = String(row['시도']).trim();
      const regionName = String(row['시군구']).trim();
      const isSupportedRegion = (provinceName === '경기도' && SOUTHERN_GYEONGGI_CITIES.has(regionName))
        || (provinceName === '서울특별시' && SEOUL_DISTRICTS.has(regionName));
      return isSupportedRegion && String(row['사업유형']).includes('재건축');
    })
    .map((row) => {
      const provinceName = String(row['시도']).trim();
      const regionName = String(row['시군구']).trim();
      const administrativeRegion = administrativeRegionFor(provinceName, regionName);
      const zoneName = String(row['구역명칭']).trim();
      const override = PROJECT_TRADE_OVERRIDES.get(regionName + '|' + zoneName) || {};
      const stage = withoutCode(row['현 사업추진단계']);
      const projectType = withoutCode(row['사업유형']);
      const operator = withoutCode(row['사업시행자']);
      const supplyHouseholds = Number(String(row['공급 예정 세대수']).replace(/[^0-9]/g, '')) || null;
      const matchNames = override.matchNames || deriveProjectMatchNames(zoneName);
      const apartmentName = override.apartmentName || deriveApartmentDisplayName(zoneName);
      return {
        id: projectIdFor(provinceName, regionName, zoneName),
        name: zoneName,
        apartmentName,
        officialZoneName: zoneName,
        location: administrativeRegion.location,
        provinceName: administrativeRegion.provinceName,
        cityName: administrativeRegion.cityName,
        districtName: administrativeRegion.districtName,
        regionName,
        mapPoint: null,
        mapQuery: [administrativeRegion.location, apartmentName].join(' '),
        lawdCd: override.lawdCd || REGION_LAWD_CODES.get(regionDataKey(provinceName, regionName)) || null,
        matchNames,
        matchMethod: override.matchNames ? 'verified' : (matchNames.length ? 'name-derived' : 'not-mapped'),
        stage,
        milestone: [projectType, operator].filter(Boolean).join(' · '),
        remainingEstimate: remainingEstimateForStage(stage),
        sourceUrl: RECONSTRUCTION_SOURCE_URL,
        sourceLabel: '국토교통부 공식 데이터',
        projectType,
        supplyHouseholds
      };
    });

  const merged = targets.map((target) => {
    const curated = CURATED_RECONSTRUCTION_TARGETS.find((item) => item.regionName === target.regionName && item.officialZoneName === target.officialZoneName);
    if (!curated) return target;
    return {
      ...target,
      id: curated.id,
      name: curated.name,
      apartmentName: curated.matchNames?.[0] || curated.name,
      location: curated.location,
      lawdCd: curated.lawdCd,
      matchNames: curated.matchNames,
      matchMethod: 'verified'
    };
  });
  CURATED_RECONSTRUCTION_TARGETS.forEach((target) => {
    if (!target.officialZoneName || !targets.some((item) => item.regionName === target.regionName && item.officialZoneName === target.officialZoneName)) {
      const administrativeRegion = administrativeRegionFor('경기도', target.regionName);
      merged.push({
        ...target,
        apartmentName: target.matchNames?.[0] || target.name,
        provinceName: administrativeRegion.provinceName,
        cityName: administrativeRegion.cityName,
        districtName: administrativeRegion.districtName,
        matchMethod: 'verified'
      });
    }
  });
  return merged.sort((left, right) => stageOrder(right.stage) - stageOrder(left.stage) || left.location.localeCompare(right.location, 'ko'));
}

async function fetchWithRetry(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: 'text/csv,*/*' } });
      if (response.ok) return response;
      lastError = new Error('HTTP ' + response.status);
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
  }
  throw lastError || new Error('요청 실패');
}

async function fetchReconstructionFallback() {
  try {
    const response = await fetchWithRetry(RECONSTRUCTION_CSV_URL);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { rows: parseReconstructionCsv(new TextDecoder('euc-kr').decode(bytes)), transport: '공식 CSV' };
  } catch (csvError) {
    console.warn('[reconstruction] 공식 CSV 사용 불가, 저장된 공식 데이터로 대체: ' + csvError.message);
    const snapshot = JSON.parse(await readFile(RECONSTRUCTION_SNAPSHOT_PATH, 'utf8'));
    if (!Array.isArray(snapshot.rows) || !snapshot.rows.length) throw csvError;
    return { rows: snapshot.rows, transport: '저장된 공식 데이터', datasetDate: snapshot.datasetDate };
  }
}

async function fetchReconstructionDataset(serviceKey) {
  if (!serviceKey) {
    console.warn('[reconstruction] RECONSTRUCTION_SERVICE_KEY 미설정, 공식 CSV로 대체합니다.');
    return fetchReconstructionFallback();
  }
  try {
    const url = new URL(RECONSTRUCTION_API_URL);
    url.searchParams.set('serviceKey', decodeURIComponent(serviceKey.trim()));
    url.searchParams.set('page', '1');
    url.searchParams.set('perPage', '2000');
    url.searchParams.set('returnType', 'JSON');
    const response = await fetch(url);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const payload = await response.json();
    if (!Array.isArray(payload.data) || !payload.data.length) throw new Error('응답 데이터 없음');
    return { rows: payload.data, transport: 'Open API' };
  } catch (error) {
    console.warn('[reconstruction] Open API 사용 불가, 공식 CSV로 대체: ' + error.message);
    return fetchReconstructionFallback();
  }
}

async function syncReconstruction(serviceKey, reconstructionServiceKey, previous, naverClientId, naverClientSecret) {
  let dataset;
  try {
    dataset = await fetchReconstructionDataset(reconstructionServiceKey);
  } catch (error) {
    console.warn('[reconstruction] 전국 정비사업 데이터를 불러오지 못함: ' + error.message);
    if (previous.items?.length) return previous;
    return {
      status: 'error',
      sync: { lastSuccessfulAt: null, message: '전국 정비사업 데이터를 불러오지 못했습니다.' },
      items: []
    };
  }

  let targets = officialReconstructionTargets(dataset.rows);
  if (dataset.transport === '저장된 공식 데이터' && previous.items?.length > targets.length) {
    console.warn('[reconstruction] 저장된 목록이 기존 목록보다 작아 기존 사업 범위를 유지합니다.');
    targets = previous.items.map(({ priceStatus, priceMessage, latestTransaction, areaPrices, ...target }) => target);
  }
  const geocodeSeedTargets = targets.map((target) => ({
    ...target,
    latestTransaction: previous.items?.find((item) => item.id === target.id)?.latestTransaction || null
  }));
  const initialGeocoding = await geocodeReconstructionTargets(geocodeSeedTargets, previous, naverClientId, naverClientSecret);
  targets = initialGeocoding.items;
  let items = [];
  for (const target of targets) {
    const previousItem = previous.items?.find((item) => item.id === target.id);
    if (!target.lawdCd || !target.matchNames?.length) {
      items.push({
        ...target,
        priceStatus: 'not_mapped',
        priceMessage: '정비구역과 실거래 단지 자동 매칭 준비 중',
        latestTransaction: previousItem?.latestTransaction || null,
        areaPrices: previousItem?.areaPrices || []
      });
      continue;
    }
    try {
      const trades = await fetchTransactions(serviceKey, target, 12);
      items.push({
        ...target,
        priceStatus: trades.status,
        priceMessage: trades.message,
        latestTransaction: trades.records[0] || null,
        areaPrices: trades.areaPrices
      });
    } catch (error) {
      console.warn('[MOLIT] ' + target.name + ': ' + error.message);
      items.push({
        ...target,
        priceStatus: 'error',
        priceMessage: '최근 실거래가를 불러오지 못했어요.',
        latestTransaction: previousItem?.latestTransaction || null,
        areaPrices: previousItem?.areaPrices || []
      });
    }
  }
  const finalGeocoding = await geocodeReconstructionTargets(items, { items: initialGeocoding.items }, naverClientId, naverClientSecret);
  items = finalGeocoding.items;
  const hasError = items.some((item) => item.priceStatus === 'error');
  return {
    status: hasError ? 'partial' : 'ok',
    source: { name: '국토교통부 전국 도시정비사업 통합 데이터', transport: dataset.transport, datasetDate: dataset.datasetDate || null, url: RECONSTRUCTION_SOURCE_URL },
    sync: { lastSuccessfulAt: formatKstTimestamp(), message: hasError ? '사업 목록은 갱신했고 일부 실거래가는 기존 값을 유지합니다.' : '' },
    geocoding: finalGeocoding.summary,
    items
  };
}

async function syncPriceTarget(serviceKey, target, previousItem) {
  try {
    const trades = await fetchTransactions(serviceKey, target, CANDIDATE_TREND_MONTHS, { analyzeGrowth: true, summaryMonthCount: 12 });
    return {
      ...target,
      priceStatus: trades.status,
      priceMessage: trades.message,
      latestTransaction: trades.records[0] || null,
      areaPrices: trades.areaPrices
    };
  } catch (error) {
    console.warn('[candidate] ' + target.name + ': ' + error.message);
    return {
      ...target,
      priceStatus: 'error',
      priceMessage: '최근 실거래가를 불러오지 못했어요.',
      latestTransaction: previousItem?.latestTransaction || null,
      areaPrices: previousItem?.areaPrices || []
    };
  }
}

async function syncCandidates(serviceKey, previous) {
  const candidates = [];
  for (const target of MOVE_CANDIDATES) {
    const previousItem = previous.candidates?.find((item) => item.id === target.id);
    candidates.push(await syncPriceTarget(serviceKey, target, previousItem));
  }
  const recommendationPool = [];
  for (const target of RECOMMENDATION_TARGETS) {
    const previousItem = previous.recommendationPool?.find((item) => item.id === target.id);
    recommendationPool.push(await syncPriceTarget(serviceKey, target, previousItem));
  }
  const discovery = await discoverCandidates(serviceKey, [...MOVE_CANDIDATES, ...RECOMMENDATION_TARGETS], previous);
  recommendationPool.push(...discovery.items);
  assignGrowthScores([...candidates, ...recommendationPool]);
  const hasError = [...candidates, ...recommendationPool].some((item) => item.priceStatus === 'error');
  return {
    status: hasError ? 'partial' : 'ok',
    source: {
      name: '국토교통부 아파트 매매 실거래자료',
      url: 'https://www.data.go.kr/data/15126469/openapi.do',
      period: '최근 12개월 가격 · 최근 36개월 상승 흐름'
    },
    sync: {
      schedule: '매일 14:00 KST',
      lastSuccessfulAt: formatKstTimestamp(),
      message: hasError ? '일부 단지는 이전 동기화 가격을 유지합니다.' : ''
    },
    discovery: { districtCount: discovery.districtCount, perDistrictLimit: 12, message: '추적 지역의 최근 신고 거래에서 59~100㎡, 8.5~12억원 후보 자동 발견. 전체 시장 목록은 아닙니다.' },
    candidates,
    recommendationPool
  };
}

async function discoverCandidates(serviceKey, configured, previous, fetchMonth = fetchDistrictMonth) {
  const districts = new Map(configured.map(item => [item.lawdCd, item.location.split(' ').slice(0, 2).join(' ')]));
  const discovered = [];
  for (const [lawdCd, location] of districts) {
    try {
      const responses = await Promise.all(recentMonths(36).map(month => fetchMonth(serviceKey, lawdCd, month)));
      const groups = new Map();
      for (const record of responses.flat()) {
        if (!record.apartmentName || !record.dongName || !record.jibun) continue;
        if (configured.some(t => t.lawdCd === lawdCd && (!t.dongNames?.length || t.dongNames.includes(record.dongName)) && matchesTarget(record.apartmentName, t))) continue;
        const key = [record.dongName, record.jibun, record.apartmentName].join('|');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(record);
      }
      const choices = [...groups.entries()].map(([key, records]) => {
        const areaPrices = summarizeAreaPrices(records, null, { summaryMonthCount:12, analyzeGrowth:true });
        const matching = areaPrices.filter(a => a.areaTypeSqm >= 59 && a.areaTypeSqm <= 100 && a.latestPriceManwon >= 85000 && a.latestPriceManwon <= 120000);
        if (!matching.length) return null;
        const latest = [...records].sort((a,b)=>b.contractDate.localeCompare(a.contractDate))[0];
        return { id:'auto-'+lawdCd+'-'+encodeURIComponent(key),name:latest.apartmentName,location:location+' '+latest.dongName,lawdCd,
          dongNames:[latest.dongName],jibun:latest.jibun,matchNames:[latest.apartmentName],exactName:true,discovered:true,
          completionYear:latest.buildYear||null,priceStatus:'ok',priceMessage:'',latestTransaction:latest,areaPrices,
          discoveryCount:matching.reduce((total,a)=>total+a.count,0) };
      }).filter(Boolean).sort((a,b)=>b.discoveryCount-a.discoveryCount || b.latestTransaction.contractDate.localeCompare(a.latestTransaction.contractDate)).slice(0,12);
      discovered.push(...choices);
    } catch (error) {
      console.warn('[discovery] '+lawdCd+': '+error.message);
      discovered.push(...(previous.recommendationPool||[]).filter(i=>i.discovered&&i.lawdCd===lawdCd).map(i=>({...i,priceStatus:'error',priceMessage:'이전 정상 거래 유지'})));
    }
  }
  return {items:discovered,districtCount:districts.size};
}

function buildSyncStatus(homeData, reconstruction, candidates) {
  const reconstructionItems = reconstruction.items || [];
  const candidateItems = [...(candidates.candidates || []), ...(candidates.recommendationPool || [])];
  const projectTransport = reconstruction.source?.transport || '확인 불가';
  const sources = [
    {
      id: 'home-transactions',
      label: '우리집 실거래가',
      status: homeData.recentTransactions.status,
      itemCount: homeData.recentTransactions.records?.length || 0,
      optional: false,
      syncedAt: homeData.sync?.lastSuccessfulAt || null,
      message: homeData.recentTransactions.message || '최근 3개월 거래 갱신 완료'
    },
    {
      id: 'candidate-transactions',
      label: '이사 후보지 실거래가',
      status: candidates.status,
      itemCount: candidateItems.filter((item) => item.priceStatus === 'ok').length,
      totalCount: candidateItems.length,
      optional: false,
      syncedAt: candidates.sync?.lastSuccessfulAt || null,
      message: candidates.sync?.message || '최근 12개월 가격과 36개월 상승 흐름 갱신 완료'
    },
    {
      id: 'reconstruction-projects',
      label: '재건축 사업 원본',
      status: projectTransport === '저장된 공식 데이터' ? 'fallback' : (reconstructionItems.length ? 'ok' : 'error'),
      itemCount: reconstructionItems.length,
      optional: false,
      syncedAt: reconstruction.sync?.lastSuccessfulAt || null,
      message: projectTransport + (reconstruction.source?.datasetDate ? ' · ' + reconstruction.source.datasetDate + ' 데이터' : '')
    },
    {
      id: 'reconstruction-transactions',
      label: '재건축 단지 실거래가',
      status: reconstruction.status,
      itemCount: reconstructionItems.filter((item) => item.latestTransaction).length,
      totalCount: reconstructionItems.length,
      optional: false,
      syncedAt: reconstruction.sync?.lastSuccessfulAt || null,
      message: reconstruction.sync?.message || '매칭 가능한 단지 가격 갱신 완료'
    },
    {
      id: 'reconstruction-geocoding',
      label: '재건축 지도 좌표',
      status: reconstruction.geocoding?.status || 'not_configured',
      itemCount: reconstruction.geocoding?.mappedCount || 0,
      totalCount: reconstruction.geocoding?.totalCount || reconstructionItems.length,
      optional: false,
      syncedAt: reconstruction.sync?.lastSuccessfulAt || null,
      message: reconstruction.geocoding?.message || 'NAVER Geocoding 설정 대기'
    },
    {
      id: 'current-listings',
      label: '현재 매물',
      status: homeData.currentListings.status,
      itemCount: homeData.currentListings.items?.length || 0,
      optional: true,
      syncedAt: homeData.currentListings.syncedAt || null,
      message: homeData.currentListings.message || '현재 매물 갱신 완료'
    },
    {
      id: 'kb-market-price',
      label: 'KB 시세',
      status: homeData.kbMarketPrice.status,
      itemCount: ['ok', 'stale'].includes(homeData.kbMarketPrice.status) ? 1 : 0,
      optional: true,
      syncedAt: homeData.kbMarketPrice.syncedAt || null,
      message: homeData.kbMarketPrice.message || 'KB 상·하한 시세 갱신 완료'
    }
  ];
  const hasDegradedSource = sources.some((source) => ['error', 'partial', 'stale', 'fallback'].includes(source.status));
  const hasUnconfiguredSource = sources.some((source) => ['not_available', 'not_configured'].includes(source.status));
  return {
    generatedAt: formatKstTimestamp(),
    schedule: '매일 14:00 KST',
    overallStatus: hasDegradedSource ? 'partial' : (hasUnconfiguredSource ? 'needs_configuration' : 'ok'),
    sources
  };
}

function markdownCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

async function writeGithubSummary(syncStatus) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const rows = syncStatus.sources.map((source) => {
    const count = source.totalCount == null ? source.itemCount : source.itemCount + '/' + source.totalCount;
    return '| ' + markdownCell(source.label) + ' | `' + markdownCell(source.status) + '` | ' + count + ' | ' + markdownCell(source.message) + ' |';
  });
  const summary = [
    '## 부동산 데이터 동기화',
    '',
    '- 실행 시각: ' + syncStatus.generatedAt,
    '- 전체 상태: `' + syncStatus.overallStatus + '`',
    '',
    '| 데이터 | 상태 | 건수 | 설명 |',
    '| --- | --- | ---: | --- |',
    ...rows,
    ''
  ].join('\n');
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, 'utf8');
}

async function main() {
  const previousHome = await readExistingData(HOME_DATA_PATH);
  const previousReconstruction = await readExistingData(RECONSTRUCTION_DATA_PATH);
  const previousCandidates = await readExistingData(CANDIDATE_DATA_PATH);
  const serviceKey = process.env.MOLIT_SERVICE_KEY?.trim();
  const reconstructionServiceKey = process.env.RECONSTRUCTION_SERVICE_KEY?.trim();
  const naverClientId = process.env.NAVER_MAPS_CLIENT_ID?.trim();
  const naverClientSecret = process.env.NAVER_MAPS_CLIENT_SECRET?.trim();
  if (!serviceKey) throw new Error('MOLIT_SERVICE_KEY GitHub Secret이 비어 있습니다. 저장소 Actions Secret을 확인해 주세요.');
  const recentTransactions = await fetchTransactions(serviceKey, HOME_APARTMENT);
  console.log('[MOLIT] ' + HOME_APARTMENT.name + ': 최근 거래 ' + recentTransactions.records.length + '건 동기화');

  const reconstruction = await syncReconstruction(serviceKey, reconstructionServiceKey, previousReconstruction, naverClientId, naverClientSecret);
  const candidates = await syncCandidates(serviceKey, previousCandidates);
  const listingsAttempt = await fetchCurrentListings();
  const kbAttempt = await fetchKbMarketPrice();
  const currentListings = preservePreviousOnError(listingsAttempt, previousHome.currentListings, (value) => Boolean(value?.items?.length));
  const kbMarketPrice = preservePreviousOnError(kbAttempt, previousHome.kbMarketPrice, (value) => Number.isFinite(value?.lowPriceEok) && Number.isFinite(value?.highPriceEok));
  const homeData = {
    apartment: HOME_APARTMENT,
    sync: { schedule: '매일 14:00 KST', lastSuccessfulAt: formatKstTimestamp() },
    recentTransactions,
    currentListings,
    kbMarketPrice
  };
  const syncStatus = buildSyncStatus(homeData, reconstruction, candidates);
  const mapConfig = {
    naverMapsClientId: process.env.NAVER_MAPS_CLIENT_ID?.trim() || ''
  };
  await mkdir('data', { recursive: true });
  await writeFile(HOME_DATA_PATH, JSON.stringify(homeData, null, 2) + '\n', 'utf8');
  await writeFile(RECONSTRUCTION_DATA_PATH, JSON.stringify(reconstruction, null, 2) + '\n', 'utf8');
  await writeFile(CANDIDATE_DATA_PATH, JSON.stringify(candidates, null, 2) + '\n', 'utf8');
  await writeFile(SYNC_STATUS_DATA_PATH, JSON.stringify(syncStatus, null, 2) + '\n', 'utf8');
  await writeFile(MAP_CONFIG_DATA_PATH, JSON.stringify(mapConfig, null, 2) + '\n', 'utf8');
  await writeGithubSummary(syncStatus);
  console.log('[sync-status] ' + syncStatus.overallStatus + ' · ' + syncStatus.sources.map((source) => source.id + '=' + source.status).join(', '));
}

export { discoverCandidates, parseTransactions, targetTransactions };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('[sync-home-price] ' + error.message);
    process.exitCode = 1;
  });
}
