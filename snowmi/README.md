# Snowmi - Snowflake Morning Intelligence

A "Good Morning Dashboard" for Snowflake users, providing a personalized daily briefing on key metrics.

## Current Status

**Working Features:**
- Real-time data from `SNOWSCIENCE.LLM.CORTEX_CODE_ACCOUNT_DAY_FACT`
- 14-day trend visualization for requests and accounts
- Day-over-day change indicators
- Suggested actions based on metric changes
- Clean, minimal UI (Linear/Vercel aesthetic)

**Tech Stack:**
- Next.js 16 with App Router
- TypeScript + Tailwind CSS + shadcn/ui
- Recharts for visualizations
- snowflake-sdk with PAT auth (local) / OAuth (SPCS)

## Data Sources

| Metric | Source Table | Fields Used |
|--------|--------------|-------------|
| Daily Requests | `CORTEX_CODE_ACCOUNT_DAY_FACT` | `TOTAL_DAILY_REQUESTS`, `UI_DAILY_REQUESTS`, `CLI_DAILY_REQUESTS` |
| Active Accounts | `CORTEX_CODE_ACCOUNT_DAY_FACT` | `COUNT(DISTINCT ACCOUNT_ID)` |

## Running Locally

```bash
cd snowmi
SNOWFLAKE_CONNECTION_NAME=dev npm run dev -- --port 3456
```

Open http://localhost:3456

## Roadmap

- [ ] User preferences/customization (metric selection, layout)
- [ ] Additional data sources (SI metrics, pipeline health)
- [ ] Anomaly detection alerts
- [ ] SPCS deployment
