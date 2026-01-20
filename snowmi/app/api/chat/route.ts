import { query } from "@/lib/snowflake";
import { NextResponse } from "next/server";

interface ChatRequest {
  message: string;
  context?: {
    currentWidgets: string[];
  };
}

interface QueryTemplate {
  pattern: RegExp;
  sql: string;
  description: string;
  widgetType?: string;
}

const QUERY_TEMPLATES: QueryTemplate[] = [
  {
    pattern: /data\s*freshness|stale|pipeline|health/i,
    sql: `
      SELECT 
        'cortex_code_account_day_fact' as table_name, 
        MAX(ds) as latest_date, 
        DATEDIFF(day, MAX(ds), CURRENT_DATE()) as days_stale 
      FROM snowscience.llm.cortex_code_account_day_fact
      UNION ALL
      SELECT 'si_company_day_fact', MAX(ds), DATEDIFF(day, MAX(ds), CURRENT_DATE()) 
      FROM snowscience.llm.si_company_day_fact
      UNION ALL
      SELECT 'si_user_day_fact', MAX(ds), DATEDIFF(day, MAX(ds), CURRENT_DATE()) 
      FROM snowscience.llm.si_user_day_fact
      UNION ALL
      SELECT 'sis_company_fact', MAX(ds), DATEDIFF(day, MAX(ds), CURRENT_DATE())
      FROM streamlit.sis.sis_company_fact
      ORDER BY table_name
    `,
    description: "Checking data freshness across key tables...",
    widgetType: "dataFreshness",
  },
  {
    pattern: /credit\s*(change|mov|spike)|top\s*movers?|account.*credit/i,
    sql: `
      WITH credit_changes AS (
        SELECT 
          salesforce_account_name,
          SUM(CASE WHEN general_date >= CURRENT_DATE - 7 THEN total_credits ELSE 0 END) as credits_last_7d,
          SUM(CASE WHEN general_date < CURRENT_DATE - 7 AND general_date >= CURRENT_DATE - 14 THEN total_credits ELSE 0 END) as credits_prior_7d
        FROM snowscience.northstar.ns_credits_breakdown
        WHERE general_date >= CURRENT_DATE - 14
        GROUP BY salesforce_account_name
      )
      SELECT 
        salesforce_account_name as account_name,
        credits_last_7d,
        credits_prior_7d,
        credits_last_7d - credits_prior_7d as credit_change,
        ROUND((credits_last_7d - credits_prior_7d) * 100.0 / NULLIF(credits_prior_7d, 0), 1) as pct_change
      FROM credit_changes
      WHERE credits_last_7d > 1000 OR credits_prior_7d > 1000
      ORDER BY ABS(credit_change) DESC
      LIMIT 15
    `,
    description: "Finding top accounts by credit change...",
    widgetType: "creditChanges",
  },
  {
    pattern: /SI|snowflake\s*intelligence|intelligence\s*usage/i,
    sql: `
      WITH yesterday AS (
        SELECT 
          SUM(num_total_requests) as requests,
          SUM(total_credits) as credits,
          COUNT(DISTINCT salesforce_account_name) as accounts
        FROM snowscience.llm.si_company_day_fact
        WHERE ds = CURRENT_DATE - 1
          AND is_internal_organization = FALSE
          AND agreement_type != 'Trial'
      ),
      week_ago AS (
        SELECT 
          SUM(num_total_requests) as requests,
          SUM(total_credits) as credits
        FROM snowscience.llm.si_company_day_fact
        WHERE ds = CURRENT_DATE - 8
          AND is_internal_organization = FALSE
          AND agreement_type != 'Trial'
      )
      SELECT 
        yesterday.requests as requests_yesterday,
        week_ago.requests as requests_week_ago,
        yesterday.requests - week_ago.requests as requests_change,
        ROUND((yesterday.requests - week_ago.requests) * 100.0 / NULLIF(week_ago.requests, 0), 1) as requests_pct_change,
        yesterday.credits as credits_yesterday,
        yesterday.accounts as active_accounts
      FROM yesterday, week_ago
    `,
    description: "Fetching Snowflake Intelligence metrics...",
    widgetType: "siMetrics",
  },
  {
    pattern: /SiS|streamlit|views/i,
    sql: `
      WITH yesterday AS (
        SELECT 
          SUM(total_views) as views,
          SUM(total_sis_credits) as credits,
          COUNT(DISTINCT salesforce_account_name) as accounts
        FROM streamlit.sis.sis_company_fact
        WHERE ds = CURRENT_DATE - 1
          AND is_internal_organization = FALSE
          AND agreement_type != 'Trial'
      ),
      week_ago AS (
        SELECT 
          SUM(total_views) as views,
          SUM(total_sis_credits) as credits
        FROM streamlit.sis.sis_company_fact
        WHERE ds = CURRENT_DATE - 8
          AND is_internal_organization = FALSE
          AND agreement_type != 'Trial'
      )
      SELECT 
        yesterday.views as views_yesterday,
        week_ago.views as views_week_ago,
        yesterday.views - week_ago.views as views_change,
        ROUND((yesterday.views - week_ago.views) * 100.0 / NULLIF(week_ago.views, 0), 1) as views_pct_change,
        yesterday.credits as credits_yesterday,
        yesterday.accounts as active_accounts
      FROM yesterday, week_ago
    `,
    description: "Fetching Streamlit in Snowflake metrics...",
    widgetType: "sisMetrics",
  },
  {
    pattern: /150\s*mau|mau.*milestone|milestone/i,
    sql: `
      WITH mau_28d AS (
        SELECT 
          cf.salesforce_account_name,
          COUNT(DISTINCT CONCAT(cf.account_id, cf.deployment, uf.user_id)) as mau_28d,
          SUM(cf.num_total_requests) as total_requests_28d
        FROM snowscience.llm.si_company_day_fact cf
        LEFT JOIN snowscience.llm.si_user_day_fact uf
          ON cf.ds = uf.ds AND cf.account_id = uf.account_id AND cf.deployment = uf.deployment
        WHERE cf.ds >= CURRENT_DATE - 28
          AND cf.is_internal_organization = FALSE
          AND cf.agreement_type != 'Trial'
        GROUP BY cf.salesforce_account_name
      )
      SELECT 
        salesforce_account_name as account_name,
        mau_28d,
        total_requests_28d as requests,
        CASE 
          WHEN mau_28d >= 150 THEN 'ACHIEVED'
          WHEN mau_28d >= 120 THEN 'CLOSE (120+)'
          WHEN mau_28d >= 100 THEN 'APPROACHING (100+)'
          ELSE 'BELOW 100'
        END as mau_status
      FROM mau_28d
      WHERE mau_28d >= 80
      ORDER BY mau_28d DESC
      LIMIT 15
    `,
    description: "Checking 150 MAU milestone progress...",
    widgetType: "mauMilestone",
  },
  {
    pattern: /top\s*account|biggest|largest|most\s*active/i,
    sql: `
      SELECT 
        salesforce_account_name as account_name,
        SUM(CASE WHEN ds >= CURRENT_DATE - 7 THEN total_daily_requests ELSE 0 END) as requests_last_7d,
        SUM(CASE WHEN ds < CURRENT_DATE - 7 AND ds >= CURRENT_DATE - 14 THEN total_daily_requests ELSE 0 END) as requests_prior_7d,
        ROUND((requests_last_7d - requests_prior_7d) * 100.0 / NULLIF(requests_prior_7d, 0), 1) as pct_change
      FROM snowscience.llm.cortex_code_account_day_fact
      WHERE ds >= CURRENT_DATE - 14
      GROUP BY salesforce_account_name
      ORDER BY requests_last_7d DESC
      LIMIT 20
    `,
    description: "Finding top accounts by Cortex Code usage...",
    widgetType: "topAccounts",
  },
  {
    pattern: /spike|anomal|unusual|sudden|jump/i,
    sql: `
      WITH weekly_usage AS (
        SELECT 
          salesforce_account_name,
          SUM(CASE WHEN ds >= CURRENT_DATE - 7 THEN num_total_requests ELSE 0 END) as requests_last_7d,
          SUM(CASE WHEN ds < CURRENT_DATE - 7 AND ds >= CURRENT_DATE - 14 THEN num_total_requests ELSE 0 END) as requests_prior_7d
        FROM snowscience.llm.si_company_day_fact
        WHERE ds >= CURRENT_DATE - 14
          AND is_internal_organization = FALSE
          AND agreement_type != 'Trial'
        GROUP BY salesforce_account_name
      )
      SELECT 
        salesforce_account_name as account_name,
        requests_last_7d,
        requests_prior_7d,
        requests_last_7d - requests_prior_7d as change,
        ROUND((requests_last_7d - requests_prior_7d) * 100.0 / NULLIF(requests_prior_7d, 0), 1) as pct_change
      FROM weekly_usage
      WHERE requests_last_7d > 100 
        AND (requests_last_7d - COALESCE(requests_prior_7d, 0)) > 50
        AND COALESCE(requests_prior_7d, 0) > 0
      ORDER BY pct_change DESC
      LIMIT 15
    `,
    description: "Detecting usage spikes and anomalies...",
    widgetType: "anomalies",
  },
  {
    pattern: /vnext|vNext|container|spcs/i,
    sql: `
      WITH last_7d AS (
        SELECT 
          SUM(total_vnext_views) as vnext_views,
          SUM(total_warehouse_views) as warehouse_views,
          SUM(total_views) as total_views
        FROM streamlit.sis.sis_company_fact
        WHERE ds >= CURRENT_DATE - 7
          AND is_internal_organization = FALSE
          AND agreement_type != 'Trial'
      ),
      prior_7d AS (
        SELECT 
          SUM(total_vnext_views) as vnext_views,
          SUM(total_views) as total_views
        FROM streamlit.sis.sis_company_fact
        WHERE ds < CURRENT_DATE - 7 AND ds >= CURRENT_DATE - 14
          AND is_internal_organization = FALSE
          AND agreement_type != 'Trial'
      )
      SELECT 
        last_7d.vnext_views as vnext_views_last_7d,
        prior_7d.vnext_views as vnext_views_prior_7d,
        last_7d.vnext_views - prior_7d.vnext_views as vnext_change,
        ROUND((last_7d.vnext_views - prior_7d.vnext_views) * 100.0 / NULLIF(prior_7d.vnext_views, 0), 1) as vnext_pct_change,
        ROUND(last_7d.vnext_views * 100.0 / NULLIF(last_7d.total_views, 0), 1) as vnext_pct_of_total,
        last_7d.warehouse_views as warehouse_views_last_7d,
        last_7d.total_views as total_views_last_7d
      FROM last_7d, prior_7d
    `,
    description: "Checking vNext (SPCS) adoption...",
    widgetType: "vnextAdoption",
  },
];

function findMatchingQuery(message: string): QueryTemplate | null {
  for (const template of QUERY_TEMPLATES) {
    if (template.pattern.test(message)) {
      return template;
    }
  }
  return null;
}

function generateResponse(message: string, data: Record<string, unknown>[], template: QueryTemplate): string {
  const rows = data as Array<Record<string, string | number>>;
  
  if (template.widgetType === "dataFreshness") {
    const stale = rows.filter((r) => Number(r.DAYS_STALE) > 1);
    if (stale.length === 0) {
      return `All ${rows.length} tables are fresh (data within 1 day). Pipeline health is good.`;
    }
    return `Found ${stale.length} stale table(s): ${stale.map((r) => `${r.TABLE_NAME} (${r.DAYS_STALE} days old)`).join(", ")}. Other tables are healthy.`;
  }

  if (template.widgetType === "creditChanges") {
    const top3 = rows.slice(0, 3);
    const summary = top3
      .map((r) => {
        const change = Number(r.CREDIT_CHANGE);
        const pct = Number(r.PCT_CHANGE);
        const direction = change > 0 ? "+" : "";
        return `**${r.ACCOUNT_NAME}**: ${direction}${Math.round(change).toLocaleString()} credits (${direction}${pct}%)`;
      })
      .join("\n");
    return `Top credit movers (WoW):\n${summary}\n\nI can add a credit changes widget to your dashboard if you'd like.`;
  }

  if (template.widgetType === "siMetrics") {
    const r = rows[0];
    const pct = Number(r.REQUESTS_PCT_CHANGE);
    const direction = pct >= 0 ? "+" : "";
    return `Snowflake Intelligence yesterday: **${Number(r.REQUESTS_YESTERDAY).toLocaleString()} requests** (${direction}${pct}% WoW) across ${r.ACTIVE_ACCOUNTS} accounts. Credits: ${Math.round(Number(r.CREDITS_YESTERDAY)).toLocaleString()}`;
  }

  if (template.widgetType === "sisMetrics") {
    const r = rows[0];
    const pct = Number(r.VIEWS_PCT_CHANGE);
    const direction = pct >= 0 ? "+" : "";
    return `Streamlit in Snowflake yesterday: **${Number(r.VIEWS_YESTERDAY).toLocaleString()} views** (${direction}${pct}% WoW) across ${r.ACTIVE_ACCOUNTS} accounts. Credits: ${Math.round(Number(r.CREDITS_YESTERDAY)).toLocaleString()}`;
  }

  if (template.widgetType === "mauMilestone") {
    const achieved = rows.filter((r) => r.MAU_STATUS === "ACHIEVED");
    const close = rows.filter((r) => r.MAU_STATUS === "CLOSE (120+)");
    const approaching = rows.filter((r) => r.MAU_STATUS === "APPROACHING (100+)");
    
    let response = `**150 MAU Milestone Progress:**\n`;
    response += `- ✅ Achieved (150+): ${achieved.length} accounts`;
    if (achieved.length > 0) {
      response += ` (${achieved.slice(0, 3).map((r) => r.ACCOUNT_NAME).join(", ")})`;
    }
    response += `\n- 🔶 Close (120-149): ${close.length} accounts`;
    response += `\n- 📈 Approaching (100-119): ${approaching.length} accounts`;
    return response;
  }

  if (template.widgetType === "topAccounts") {
    const top5 = rows.slice(0, 5);
    const summary = top5
      .map((r, i) => `${i + 1}. **${r.ACCOUNT_NAME}**: ${Number(r.REQUESTS_LAST_7D).toLocaleString()} requests`)
      .join("\n");
    return `Top Cortex Code accounts (last 7 days):\n${summary}`;
  }

  if (template.widgetType === "anomalies") {
    if (rows.length === 0) {
      return "No significant usage spikes detected in the last week.";
    }
    const top3 = rows.slice(0, 3);
    const summary = top3
      .map((r) => `- **${r.ACCOUNT_NAME}**: ${Number(r.REQUESTS_LAST_7D).toLocaleString()} requests (+${r.PCT_CHANGE}%)`)
      .join("\n");
    return `Detected ${rows.length} accounts with usage spikes:\n${summary}\n\nWant me to add an anomaly tracking widget?`;
  }

  if (template.widgetType === "vnextAdoption") {
    const r = rows[0];
    const pct = Number(r.VNEXT_PCT_CHANGE);
    const direction = pct >= 0 ? "+" : "";
    return `**vNext Adoption:**\n- Views (last 7d): ${Number(r.VNEXT_VIEWS_LAST_7D).toLocaleString()} (${direction}${pct}% WoW)\n- % of total SiS: ${r.VNEXT_PCT_OF_TOTAL}%\n- Warehouse views: ${Number(r.WAREHOUSE_VIEWS_LAST_7D).toLocaleString()}`;
  }

  return `Found ${rows.length} results. Would you like me to add this as a widget?`;
}

const HELP_RESPONSE = `Here's what I can help you with:

**Data & Pipeline Health**
- "Check data freshness" - verify pipeline health
- "Are there any stale tables?"

**Usage Metrics**
- "Show SI metrics" - Snowflake Intelligence usage
- "How's Streamlit doing?" - SiS views and credits
- "vNext adoption" - SPCS-based Streamlit stats

**Account Analysis**
- "Top accounts by usage"
- "Credit changes" - WoW credit movement
- "150 MAU progress" - milestone tracking
- "Find usage spikes" - anomaly detection

**Dashboard Customization**
- "Add credit changes widget"
- "Remove the trend chart"
- "Show me a weekly comparison"

Just ask naturally - I'll run the right queries!`;

export async function POST(request: Request) {
  try {
    const body: ChatRequest = await request.json();
    const { message } = body;

    if (/help|what can you|how do i/i.test(message)) {
      return NextResponse.json({
        response: HELP_RESPONSE,
        data: null,
        widgetType: null,
      });
    }

    const template = findMatchingQuery(message);
    
    if (!template) {
      return NextResponse.json({
        response: `I'm not sure how to help with that. Try asking about:\n- Data freshness or pipeline health\n- Credit changes or top movers\n- SI or SiS metrics\n- 150 MAU milestone\n- Usage spikes or anomalies\n- Top accounts\n\nOr type "help" for more options.`,
        data: null,
        widgetType: null,
      });
    }

    await query("USE WAREHOUSE SNOWHOUSE");
    const data = await query<Record<string, unknown>>(template.sql);
    const response = generateResponse(message, data, template);

    return NextResponse.json({
      response,
      data,
      widgetType: template.widgetType,
      description: template.description,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Failed to process request", details: String(error) },
      { status: 500 }
    );
  }
}
