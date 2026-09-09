# Real Estate Price Sync

한국어 키 발급 및 GitHub Secret 등록 방법은 [API_KEYS_SETUP.md](API_KEYS_SETUP.md)를 참고하세요.

## Schedule

`.github/workflows/sync-home-price.yml` runs once a day at 14:00 KST (`05:00 UTC`) and can also be run manually from the GitHub Actions page.

The same run refreshes every time-sensitive source used by the site:

| Source | Output | Authentication |
| --- | --- | --- |
| Home transactions | `data/home-price.json` | `MOLIT_SERVICE_KEY` |
| Candidate and recommendation transactions | `data/candidates.json` | `MOLIT_SERVICE_KEY` |
| Reconstruction project metadata | `data/reconstruction.json` | `RECONSTRUCTION_SERVICE_KEY`, official CSV, or stored official snapshot |
| Reconstruction apartment transactions | `data/reconstruction.json` | `MOLIT_SERVICE_KEY` |
| Current listings | `data/home-price.json` | Optional contracted listings API secrets |
| KB market range | `data/home-price.json` | Optional licensed KB provider secrets |

Per-source status and counts are written to `data/sync-status.json` and to the GitHub Actions run summary. A required transaction API failure stops the run before data files are replaced. A transient optional-provider failure preserves the last usable value with a `stale` status.

## Official recent transaction prices

The workflow uses the Ministry of Land, Infrastructure and Transport apartment transaction API for the last three months of reported apartment sales. It also refreshes the latest reported transaction from the last 12 months for each Reconstruction target. Add the following GitHub Actions secret before the first successful sync:

- `MOLIT_SERVICE_KEY`: The `General authentication key (Decoding)` shown under `My Page > Data Utilization > Open API > Application Status` after applying for Public Data Portal dataset `15126469`.

The target apartment is `힐스테이트 푸르지오 수원` in `경기도 수원시 팔달구` (`LAWD_CD=41115`). Only the user's exclusive-area 59-square-meter type (`59㎡ <= area < 60㎡`) is included in home summaries and connected listings.

## Reconstruction projects

The workflow also reads the Ministry of Land, Infrastructure and Transport nationwide urban-renewal dataset (`15160169`), selects reconstruction projects in Seoul and southern Gyeonggi cities, and displays their official stage, project type, operator, and planned household count. Register the approved Public Data Portal key as `RECONSTRUCTION_SERVICE_KEY`. The Open API is preferred, followed by the official CSV and the versioned official-data snapshot in `data/reconstruction-projects.json`. A stage-based range is shown because the dataset does not include a completion date.

Where a redevelopment-zone name can be safely matched to a transaction apartment and district code, the latest 12-month official transaction is added. Unmatched projects remain in the list with their official project information instead of showing a potentially incorrect apartment price.

## Candidate discovery

The same daily job reuses the 36-month district transaction cache to discover additional complexes outside the fixed shortlist. In each already-tracked district, it includes up to 12 additional complexes with a 59-100 square-meter type whose latest transaction within 12 months is KRW 850 million to KRW 1.2 billion. Display filters default to KRW 900 million to KRW 1.1 billion. Grouping uses legal neighborhood, lot address, and exact apartment name; it does not merge similarly named homes. District retrieval failures preserve previous discovered records. This is a bounded discovery pool, not an exhaustive market or listings API.

## Current listings

The official Naver Developers API catalog does not provide a Naver Real Estate listings API. Do not configure an unauthorized crawler for Naver Real Estate. Configure a separately contracted provider that allows automated retrieval instead:

- `LISTINGS_API_URL`: HTTPS endpoint returning either an array or an object with `items` or `listings`.
- `LISTINGS_API_TOKEN`: Optional bearer token for the endpoint.
- `LISTINGS_SOURCE_NAME`: Name displayed in the website.

Each listings item should contain `priceManwon` and can optionally contain `title`, `tradeType`, `areaSqm`, and `floor`.

## KB market price

There is no public per-apartment KB upper/lower price API configured by default. If a licensed provider supplies one, configure `KB_MARKET_API_URL`, optional `KB_MARKET_API_TOKEN`, and `KB_MARKET_SOURCE_NAME`. The response can provide `lowPriceEok` and `highPriceEok`, their `Manwon` equivalents, or their `Won` equivalents. Without a provider, the loan form keeps the documented manually verified reference values and reports the source as `not_available`.
