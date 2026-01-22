import { query } from "@/lib/snowflake";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sql } = body;

    if (!sql) {
      return NextResponse.json({ error: "SQL query is required" }, { status: 400 });
    }

    await query("USE WAREHOUSE SNOWHOUSE");
    const data = await query<Record<string, unknown>>(sql);

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Query error:", error);
    return NextResponse.json(
      { error: "Failed to execute query", details: String(error) },
      { status: 500 }
    );
  }
}
