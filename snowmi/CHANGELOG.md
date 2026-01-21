# Snowmi Changelog

## 2025-01-21: Cortex Code Data Source Fix

### Problem
The dashboard was incorrectly querying Snowflake Intelligence (SI) tables (`SI_COMPANY_DAY_FACT`, `SI_USER_DAY_FACT`) instead of Cortex Code tables. This meant:
- The "Desktop Cortex Code Usage Trend" card was showing SI data, not Cortex Code data
- Chat-generated cards were using the wrong schema
- Template cards referenced incorrect tables

### Root Cause
The LLM system prompt in `app/api/chat/route.ts` contained outdated schema context that referenced SI tables instead of Cortex Code tables.

### Solution
Updated the system prompt with:
1. **Correct table references** from the official `cortex_code_semantic_view.sql`:
   - `SNOWSCIENCE.LLM.CORTEX_CODE_ACCOUNT_DAY_FACT` (daily account metrics)
   - `SNOWSCIENCE.LLM.CORTEX_CODE_USER_DAY_FACT` (daily user metrics)
   - `SNOWSCIENCE.LLM.CORTEX_CODE_TOOL_USAGE` (tool invocation logs)

2. **Critical SQL rules** to prevent common errors:
   - Never SUM `total_active_users` (already a count distinct per day)
   - Default filter: `SNOWFLAKE_ACCOUNT_TYPE IN ('Customer', 'Partner')`
   - Default time range: last 28 days

3. **Example queries** from verified VQRs to guide SQL generation

4. **Full column inventory** so the LLM knows available dimensions/metrics

### Files Changed
- `app/api/chat/route.ts` - Updated SCHEMA_CONTEXT with correct Cortex Code tables and SQL guidance
- `lib/dashboard-state.ts` - Updated template cards to use CORTEX_CODE_ tables

### Verification
- Cleared localStorage and refreshed dashboard
- Template card "Active Accounts (Yesterday)" now shows correct data (525 accounts)
- Chat-generated trend charts now query CORTEX_CODE_ACCOUNT_DAY_FACT

### Reference
Schema sourced from: `datascience-airflow/product/dbt/models/product_semantic_views/cortex_code_semantic_view.sql`
