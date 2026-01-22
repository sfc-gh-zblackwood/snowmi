import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/snowflake";

function escapeForSnowflake(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { state, dashboardId = "default" } = body;
    
    if (!state) {
      return NextResponse.json({ error: "No state provided" }, { status: 400 });
    }

    const stateJson = escapeForSnowflake(JSON.stringify(state));

    await query(`USE WAREHOUSE SNOWHOUSE`);
    await query(
      `MERGE INTO temp.zblackwood.snowmi_dashboards t
       USING (SELECT CURRENT_USER() as user_id, '${dashboardId}' as dashboard_id) s
       ON t.user_id = s.user_id AND t.dashboard_id = s.dashboard_id
       WHEN MATCHED THEN UPDATE SET state = PARSE_JSON('${stateJson}'), updated_at = CURRENT_TIMESTAMP()
       WHEN NOT MATCHED THEN INSERT (user_id, dashboard_id, state) VALUES (s.user_id, s.dashboard_id, PARSE_JSON('${stateJson}'))`
    );

    console.log("Dashboard synced to Snowflake:", dashboardId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dashboardId = searchParams.get("dashboardId") || "default";

    await query(`USE WAREHOUSE SNOWHOUSE`);
    const rows = await query<{ STATE: unknown }>(
      `SELECT state FROM temp.zblackwood.snowmi_dashboards 
       WHERE user_id = CURRENT_USER() AND dashboard_id = '${dashboardId}'`
    );

    if (rows.length > 0) {
      return NextResponse.json({ state: rows[0].STATE });
    }

    return NextResponse.json({ state: null });
  } catch (error) {
    console.error("Load error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Load failed" },
      { status: 500 }
    );
  }
}
