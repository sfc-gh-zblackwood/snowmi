import { query } from "@/lib/snowflake";
import { NextResponse } from "next/server";
import { CardType, CardConfig } from "@/lib/dashboard-state";

interface ChatRequest {
  message: string;
  context?: {
    currentCards: { id: string; title: string; type: CardType }[];
    conversationHistory?: { role: string; content: string }[];
  };
}

const SCHEMA_CONTEXT = `
You are Snowmi, an intelligent dashboard assistant for CORTEX CODE (Desktop IDE and CLI) metrics.
This is NOT for Snowflake Intelligence/Cortex Analyst - that's a different product.

Be conversational, helpful, and proactive. You can:
- Create any visualization the user needs
- Answer questions about the data directly
- Suggest insights you notice
- Modify existing cards creatively
- Do multiple things at once if it makes sense

AVAILABLE TABLES:

1. SNOWSCIENCE.LLM.CORTEX_CODE_ACCOUNT_DAY_FACT (daily account-level metrics, PREFERRED for aggregates)
   DS (DATE), ACCOUNT_ID, DEPLOYMENT, SALESFORCE_ACCOUNT_NAME, SALESFORCE_ACCOUNT_ID,
   SNOWFLAKE_ACCOUNT_TYPE, IS_ACTIVE_CAPACITY_FINANCE, AGREEMENT_TYPE, INDUSTRY, SUB_INDUSTRY,
   CLI_ACTIVE_USERS, CLI_DAILY_REQUESTS, CLI_DAILY_USER_PROMPTS, CLI_INPUT_TOKENS, CLI_OUTPUT_TOKENS, CLI_TOTAL_TOKENS,
   UI_ACTIVE_USERS, UI_DAILY_REQUESTS, UI_DAILY_USER_PROMPTS, UI_INPUT_TOKENS, UI_OUTPUT_TOKENS, UI_TOTAL_TOKENS,
   UI_CODING_AGENT_REQUESTS, UI_REASONING_AGENT_REQUESTS, UI_CODING_AGENT_USERS, UI_REASONING_AGENT_USERS,
   TOTAL_ACTIVE_USERS, TOTAL_DAILY_REQUESTS, TOTAL_DAILY_USER_PROMPTS, TOTAL_INPUT_TOKENS, TOTAL_OUTPUT_TOKENS, TOTAL_TOKENS

2. SNOWSCIENCE.LLM.CORTEX_CODE_USER_DAY_FACT (daily user-level metrics)
   DS, USER_ID, ACCOUNT_ID, DEPLOYMENT, SALESFORCE_ACCOUNT_NAME, SALESFORCE_ACCOUNT_ID,
   SNOWFLAKE_ACCOUNT_TYPE, IS_ACTIVE_CAPACITY_FINANCE, AGREEMENT_TYPE, INDUSTRY, SUB_INDUSTRY,
   CLI_DAILY_REQUESTS, CLI_DAILY_USER_PROMPTS, CLI_INPUT_TOKENS, CLI_OUTPUT_TOKENS, CLI_TOTAL_TOKENS,
   UI_DAILY_REQUESTS, UI_DAILY_USER_PROMPTS, UI_INPUT_TOKENS, UI_OUTPUT_TOKENS, UI_TOTAL_TOKENS,
   UI_CODING_AGENT_REQUESTS, UI_REASONING_AGENT_REQUESTS,
   TOTAL_DAILY_REQUESTS, TOTAL_DAILY_USER_PROMPTS, TOTAL_INPUT_TOKENS, TOTAL_OUTPUT_TOKENS, TOTAL_TOKENS

3. SNOWSCIENCE.LLM.CORTEX_CODE_TOOL_USAGE (individual tool invocations)
   DS, LOGGED_AT, REQUEST_ID, SESSION_ID, USER_ID, USER_NAME, ACCOUNT_ID, DEPLOYMENT,
   TOOL_NAME (bash, read, write, grep, snowflake_sql_execute, etc), TOOL_STATUS, TOOL_USE_ID,
   ORIGIN (cli or ui), AGENT_TYPE (coding_agent or reasoning_agent),
   SALESFORCE_ACCOUNT_NAME, SNOWFLAKE_ACCOUNT_TYPE, IS_ACTIVE_CAPACITY_FINANCE

CRITICAL SQL RULES:
1. NEVER SUM total_active_users, cli_active_users, or ui_active_users - they are already count distinct per day
   - To get DAU trend: SELECT DS, SUM(TOTAL_ACTIVE_USERS) FROM ... GROUP BY DS
   - To count unique users over a range: COUNT(DISTINCT CONCAT(ACCOUNT_ID, DEPLOYMENT, USER_ID)) from user_fact
2. Default time range: last 28 days (WHERE DS >= CURRENT_DATE - 28)
3. Filter external customers: SNOWFLAKE_ACCOUNT_TYPE IN ('Customer', 'Partner')
4. Filter paying customers: IS_ACTIVE_CAPACITY_FINANCE = TRUE
5. Always GROUP BY date columns when aggregating over time
6. USER_PROMPTS = leaderboard metric (distinct user conversations), REQUESTS = total API calls

EXAMPLE QUERIES:
- DAU trend: SELECT DS, SUM(TOTAL_ACTIVE_USERS) AS DAU FROM SNOWSCIENCE.LLM.CORTEX_CODE_ACCOUNT_DAY_FACT WHERE DS >= CURRENT_DATE - 28 AND SNOWFLAKE_ACCOUNT_TYPE IN ('Customer','Partner') GROUP BY DS ORDER BY DS
- Daily requests: SELECT DS, SUM(TOTAL_DAILY_REQUESTS) AS REQUESTS FROM SNOWSCIENCE.LLM.CORTEX_CODE_ACCOUNT_DAY_FACT WHERE DS >= CURRENT_DATE - 28 GROUP BY DS ORDER BY DS
- Top tools: SELECT TOOL_NAME, COUNT(*) AS CALLS FROM SNOWSCIENCE.LLM.CORTEX_CODE_TOOL_USAGE WHERE DS >= CURRENT_DATE - 7 GROUP BY TOOL_NAME ORDER BY CALLS DESC LIMIT 10
- CLI vs UI: SELECT DS, SUM(CLI_DAILY_REQUESTS) AS CLI, SUM(UI_DAILY_REQUESTS) AS UI FROM SNOWSCIENCE.LLM.CORTEX_CODE_ACCOUNT_DAY_FACT WHERE DS >= CURRENT_DATE - 28 GROUP BY DS ORDER BY DS

CARD TYPES: metric (must have VALUE column), trend (date+number), bar, table, distribution (category+COUNT)

RESPONSE FORMAT - always JSON:
{
  "action": "add_card" | "modify_card" | "remove_card" | "reorder_cards" | "style_card" | "query" | "none",
  "card": { "title", "type", "sql", "config": {xAxis, yAxis, color, format, limit} },  // for add_card
  "targetCard": "partial title",  // for modify/remove/style
  "updates": { "title", "type", "sql", "config" },  // for modify_card
  "cardToMove": "partial title", "position": "first|last|before:X|after:X",  // for reorder
  "style": { "type", "size": "small|medium|large|full" },  // for style_card
  "sql": "SELECT ...",  // for query action, optional
  "message": "Your conversational response - be helpful and natural!"
}

Be smart:
- If user asks a question, run a query and answer it (action: query)
- If they want a chart, create one (action: add_card)
- If they reference "the DAU chart" or similar, find the matching card
- Suggest follow-up insights when relevant
- Be concise but friendly
`;

export async function POST(request: Request) {
  try {
    const body: ChatRequest = await request.json();
    const { message, context } = body;

    const currentCardsInfo = context?.currentCards?.length
      ? `\n\nCURRENT DASHBOARD CARDS:\n${context.currentCards.map(c => `- ${c.title} (${c.type})`).join('\n')}`
      : '\n\nDASHBOARD IS EMPTY';

    const conversationContext = context?.conversationHistory?.length
      ? `\n\nRECENT CONVERSATION:\n${context.conversationHistory.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n')}`
      : '';

    const prompt = `${SCHEMA_CONTEXT}${currentCardsInfo}${conversationContext}

USER REQUEST: ${message}

Respond with a JSON object only. No markdown, no explanation outside the JSON.`;

    await query("USE WAREHOUSE SNOWHOUSE");

    const cortexResult = await query<{ RESPONSE: string }>(`
      SELECT SNOWFLAKE.CORTEX.COMPLETE(
        'claude-3-5-sonnet',
        '${prompt.replace(/'/g, "''")}'
      ) as RESPONSE
    `);

    const responseText = cortexResult[0]?.RESPONSE || '{"action": "none", "message": "I couldn\'t process that request."}';
    
    console.log("RAW LLM RESPONSE:", responseText.slice(0, 300));
    
    let parsed: {
      action: string;
      card?: {
        title: string;
        type: CardType;
        sql: string;
        config: CardConfig;
      };
      targetCard?: string;
      cardToMove?: string;
      position?: string;
      updates?: {
        title?: string;
        type?: CardType;
        sql?: string;
        config?: CardConfig;
      };
      style?: {
        type?: CardType;
        size?: string;
      };
      sql?: string;
      message: string;
    };
    
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      console.log("PARSED action:", parsed.action, "message exists:", !!parsed.message);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      parsed = { action: "none", message: responseText.slice(0, 500) };
    }

    if (parsed.action === "add_card" && parsed.card?.sql) {
      try {
        const data = await query<Record<string, unknown>>(parsed.card.sql);
        
        return NextResponse.json({
          response: parsed.message || `Added "${parsed.card.title}" to your dashboard.`,
          action: {
            type: "add_card",
            card: {
              title: parsed.card.title,
              type: parsed.card.type,
              sql: parsed.card.sql,
              config: parsed.card.config || {},
              data,
            },
          },
        });
      } catch (sqlError) {
        return NextResponse.json({
          response: `I tried to create that card but the query failed: ${String(sqlError).slice(0, 200)}. Could you rephrase what you're looking for?`,
          action: null,
        });
      }
    }

    if (parsed.action === "remove_card" && parsed.targetCard) {
      return NextResponse.json({
        response: parsed.message || `Removed the card.`,
        action: {
          type: "remove_card",
          targetCard: parsed.targetCard,
        },
      });
    }

    if (parsed.action === "modify_card" && parsed.targetCard && parsed.updates) {
      if (parsed.updates.sql) {
        try {
          const data = await query<Record<string, unknown>>(parsed.updates.sql);
          return NextResponse.json({
            response: parsed.message || `Updated the card.`,
            action: {
              type: "modify_card",
              targetCard: parsed.targetCard,
              updates: { ...parsed.updates, data },
            },
          });
        } catch (sqlError) {
          return NextResponse.json({
            response: `I tried to update that card but the query failed: ${String(sqlError).slice(0, 200)}`,
            action: null,
          });
        }
      }
      return NextResponse.json({
        response: parsed.message || `Updated the card.`,
        action: {
          type: "modify_card",
          targetCard: parsed.targetCard,
          updates: parsed.updates,
        },
      });
    }

    if (parsed.action === "reorder_cards" && parsed.cardToMove && parsed.position) {
      return NextResponse.json({
        response: parsed.message || `Moved the card.`,
        action: {
          type: "reorder_cards",
          cardToMove: parsed.cardToMove,
          position: parsed.position,
        },
      });
    }

    if (parsed.action === "style_card" && parsed.targetCard && parsed.style) {
      return NextResponse.json({
        response: parsed.message || `Updated the card style.`,
        action: {
          type: "style_card",
          targetCard: parsed.targetCard,
          style: parsed.style,
        },
      });
    }

    if (parsed.action === "query") {
      if (parsed.sql) {
        try {
          const data = await query<Record<string, unknown>>(parsed.sql);
          const formattedData = data.slice(0, 10).map(row => 
            Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(', ')
          ).join('\n');
          return NextResponse.json({
            response: `${parsed.message || "Here's what I found:"}\n\n${formattedData}`,
            action: null,
          });
        } catch (sqlErr) {
          console.error("Query execution error:", sqlErr);
          return NextResponse.json({
            response: parsed.message || "I couldn't run that query.",
            action: null,
          });
        }
      }
      return NextResponse.json({
        response: parsed.message || "I couldn't find the answer.",
        action: null,
      });
    }

    return NextResponse.json({
      response: parsed.message || "I'm not sure how to help with that. Try asking me to add a chart or metric!",
      action: null,
    });

  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Failed to process request", details: String(error) },
      { status: 500 }
    );
  }
}
