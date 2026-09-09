# Requirements Log

## 2026-07-17

1. Create a Markdown rules file and record the project rules in it.
2. Record every requirement in Markdown files.
3. Add tabs to the left side of the website.
4. Add a cute 2D logo reading "Happy House 이사 대작전" to the top of the left side.
5. Put a Home tab below the logo and summarize important information from other tabs there.
6. Put a Budget Management tab below the Home tab.
7. In Budget Management, show monthly loan repayment estimates.
8. Merge the completed work to the remote repository.
9. Redesign the overall website with a clean, white-first visual style.
10. Create a GitHub Action that runs once a day at 14:00 KST.
11. Use the action to sync real estate information and add it to a new tab.
12. Name the new tab "우리집 가격".
13. Show the last three months of prices, current listings prices, and the sync date for "힐스테이트 푸르지오 수원".
14. Prefer an official or otherwise suitable real estate data source over Naver Real Estate when available.
15. Apply an image to the left side of the Chrome tab.
16. Add a separate guide explaining how to obtain required tokens and keys.
17. Remove unnecessary marketing copy and simplify the overall design.
18. Show left tabs as emoji plus title only, with larger tab text.
19. Use a consistent type scale, a white-first palette, and color only as an accent.
20. Replace the sidebar icon with a cuter icon.
21. Rename Budget Management to Loan Management.
22. Model the company loan limit as the minimum of 500 million KRW, 70% of the purchase price, and 70% of the average KB lower and upper prices.
23. Model the company loan as a three-year grace period followed by ten years of repayment, with 1.5% personal interest and 3.1% company interest support that is taxable to the individual.
24. Show monthly payments and estimated actual monthly out-of-pocket cost from the loan execution date.
25. Include additional credit-loan monthly payments in the overall monthly-cost calculation.
26. Estimate apartment-purchase taxes together with the loan plan.
27. Apply all reported company-loan terms without making the user select them individually.
28. Reflect an annual pre-tax salary of approximately 100 million KRW when estimating tax on company-supported interest.
29. Reflect a remaining mortgage balance of approximately 500 million KRW on the current home and calculate sale equity as sale price minus the mortgage.
30. Calculate the new-home budget from the company loan, current-home sale proceeds, and additional credit loan.
31. Show total move-related cost including purchase taxes and both sale and purchase brokerage-fee caps.
32. Keep the Home tab simple and use it for high-level moving-budget, cost, and monthly-payment summaries only.
33. Remove move countdown and contract-status content that was not requested.
34. Add a Map tab with a Google Maps marker for Hillstate Prugio Suwon.
35. Add a Reconstruction tab for selected ongoing reconstruction projects in southern metropolitan areas, including latest official transaction data when the scheduled sync is configured and an approximate remaining timeline.
36. Increase the top-left logo size and place the brand text below the image.
37. Research comparable home-affordability and mortgage-calculator services, then redesign the interface using proven interaction patterns.
38. Improve usability with a clear input hierarchy, prominent budget and monthly-payment results, consistent spacing and typography, and a responsive layout.
39. Reverify the official authentication-key source and update the guide with the exact application, key-selection, GitHub registration, and troubleshooting steps.
40. Diagnose the successful Action run that left Home Price empty, expose safe API diagnostics, and prevent failed syncs from overwriting price data.
41. Add credit-loan repayment options for equal principal-and-interest payments and interest-only payments with principal due at maturity.
42. Investigate KB market-price API availability and connect it to the scheduled Action only through an officially supported or licensed API.
43. Limit the home-price dashboard for Hillstate Prugio Suwon to the user's 59-square-meter exclusive-area type.
44. Expand the Reconstruction tab with the official nationwide urban-renewal dataset and show more southern Gyeonggi reconstruction projects.
45. Redesign the responsive layout so the service is comfortable to use on a mobile phone.
46. Add useful filters to the Reconstruction tab.
47. Fix the unexpectedly small reconstruction dataset and substantially expand the number of displayed projects.
48. Show Reconstruction-tab projects as distinct pins on the Map tab.
49. Fetch official recent transaction prices for reconstruction apartments, group the results by exclusive-area type, and refresh them in the daily GitHub Action.
50. Add reconstruction price sorting so the list can be ordered by recent transaction price in either direction.
51. Add an "이사 후보지" tab immediately below "우리집 가격" in the navigation.
52. In the candidate tab, show evaluation scores and recent official transaction prices for 매교역푸르지오SKVIEW 74/84 types, 망포동 영통SKVIEW, and 영통동 현대, refreshed daily by GitHub Actions.
53. Recommend additional apartment complexes whose recent transaction prices fit the moving budget calculated in the loan-management tab.
54. Show the Reconstruction-tab project details directly from reconstruction pins on the Map tab and provide a shortcut to the matching reconstruction card.
55. Pre-fill the current-home expected sale price with the latest official transaction price for Hillstate Prugio Suwon 59-square-meter units without overwriting a user-edited value.
56. Break down each post-move monthly payment estimate into principal, personally paid interest, credit-loan interest, and estimated income tax on company-supported interest.
57. Use the latest transaction price, rather than the 12-month average, for candidate-apartment prices, budget-fit scores, and recommendations.
58. Enable mouse-wheel map zoom and provide clear desktop and mobile gesture guidance.
59. Add an interest-only credit-loan option that pays no principal during the term, make it enabled by default, and show the principal as due at maturity.
60. Pre-fill the company-loan KB lower and upper market-price fields with the latest manually verified KB values for MaeGyo Station Prugio SK View 84.97-square-meter units.
61. Include official Seoul reconstruction projects alongside the existing southern Gyeonggi projects.
62. Show an approximate apartment or complex name directly on Reconstruction cards and Map pins without requiring a click.
63. Show each project's latest official transaction price and add minimum and maximum transaction-price filters.
64. Replace the flat district filter with dependent city and district filters, such as selecting Suwon first and then Paldal-gu.
65. Refresh every time-sensitive real-estate dataset through the daily GitHub Action, preserve the last successful optional-provider data on transient failures, and record each source's sync status.
66. Replace the primary map with NAVER Web Dynamic Map while preserving all home and reconstruction markers, filters, labels, and detail popups; fall back safely when NAVER Maps is not configured or authentication fails.
67. In the Move Candidates tab, add budget-compatible apartment recommendations ranked by a transparent three-year appreciation-potential signal using official transaction trend, recent momentum, and liquidity, refresh it daily, and clearly state that it does not guarantee future prices.
68. Ensure NAVER Maps configuration changes are not hidden by stale browser or CDN caches, and accept the public Client ID from either the recommended repository variable or a same-named repository secret.
69. Audit every reconstruction map coordinate, remove district-center pseudo-pins, and publish only region-validated NAVER Geocoding results while preserving the last verified coordinates across sync failures.
70. Show each mapped reconstruction project's latest official transaction price and exclusive area directly below its apartment name on the map label.
71. Add a concise reconstruction process guide to the Reconstruction tab showing the usual stage order, what happens at each stage, typical duration benchmarks, acceleration targets, major delay factors, and official reference links without making the page visually busy.
72. Add a separate Recommendation tab that lists Suwon-area apartments with the latest official transaction price between KRW 900 million and KRW 1.1 billion, refreshes from the existing daily transaction sync, and provides useful filters, sorting, transparent comparison scores, qualifying unit types, strengths, and cautions in a clean desktop and mobile layout.
73. Fix the Map tab showing no reconstruction pins by diagnosing NAVER Geocoding configuration, using the current official endpoint, adding an accurate browser fallback for projects with reported transaction addresses, preserving strict region validation, and correcting the Client Secret setup guide without restoring inaccurate district-center pins.
74. Expand the KRW 900 million to KRW 1.1 billion Recommendation tab beyond Suwon to Suji, Bundang, old Seongnam, and other suitable areas, prioritizing balanced commuting for the user's Samsung Digital City workplace and the spouse's Seoul City Hall Station workplace, with regional and commute filters backed by the daily official transaction sync.

## 2026-09-09

75. Review the current implementation and accumulated requirements, then propose a prioritized product plan that helps the user choose a better home. Record the assessment, decision criteria, proposed features, data dependencies, and delivery sequence in [the decision-support proposal](docs/DECISION_SUPPORT_PLAN.md). The features in that document are proposals, not yet accepted implementation requirements.
76. Prioritize managing monthly financial burden while improving asset value. Compare against retaining the current home; evaluate commuting to the spouse's actual workplace near Seoul City Hall Station and either the central or main entrance of Samsung Digital City. Transportation modes and commute times remain unspecified. Keep newly collected precise workplace and household details in private user settings rather than public datasets.
