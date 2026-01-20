import { query } from "@/lib/snowflake";
import { NextResponse } from "next/server";

interface CortexCodeMetric {
  DS: string;
  TOTAL_DAILY_REQUESTS: number;
  UI_DAILY_REQUESTS: number;
  CLI_DAILY_REQUESTS: number;
  ACCOUNT_COUNT: number;
}

interface DailyMetric {
  date: string;
  totalRequests: number;
  uiRequests: number;
  cliRequests: number;
  accountCount: number;
}

export async function GET() {
  try {
    await query("USE WAREHOUSE SNOWHOUSE");
    const rows = await query<CortexCodeMetric>(`
      SELECT 
        DS,
        SUM(TOTAL_DAILY_REQUESTS) as TOTAL_DAILY_REQUESTS,
        SUM(UI_DAILY_REQUESTS) as UI_DAILY_REQUESTS,
        SUM(CLI_DAILY_REQUESTS) as CLI_DAILY_REQUESTS,
        COUNT(DISTINCT ACCOUNT_ID) as ACCOUNT_COUNT
      FROM SNOWSCIENCE.LLM.CORTEX_CODE_ACCOUNT_DAY_FACT
      WHERE DS >= CURRENT_DATE - 14
      GROUP BY DS
      ORDER BY DS DESC
    `);

    const metrics: DailyMetric[] = rows.map((row) => ({
      date: new Date(row.DS).toISOString().split("T")[0],
      totalRequests: Number(row.TOTAL_DAILY_REQUESTS) || 0,
      uiRequests: Number(row.UI_DAILY_REQUESTS) || 0,
      cliRequests: Number(row.CLI_DAILY_REQUESTS) || 0,
      accountCount: Number(row.ACCOUNT_COUNT) || 0,
    }));

    const today = metrics[0];
    const yesterday = metrics[1];
    const weekAgo = metrics[7];

    const summary = {
      todayRequests: today?.totalRequests || 0,
      yesterdayRequests: yesterday?.totalRequests || 0,
      weekAgoRequests: weekAgo?.totalRequests || 0,
      todayAccounts: today?.accountCount || 0,
      requestsChange: yesterday?.totalRequests
        ? ((today?.totalRequests - yesterday?.totalRequests) / yesterday.totalRequests) * 100
        : 0,
      accountsChange: yesterday?.accountCount
        ? ((today?.accountCount - yesterday?.accountCount) / yesterday.accountCount) * 100
        : 0,
    };

    return NextResponse.json({ metrics, summary });
  } catch (error) {
    console.error("Failed to fetch metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
