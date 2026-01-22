# Snowmi: Dynamic AI-Powered Dashboard

## Problem Statement
Static dashboards don't serve diverse users well. A PM needs product metrics, an engineer needs pipeline health, an exec needs KPIs. Today, everyone gets the same dashboard or maintains separate tools.

Snowmi is a **dynamic, personalized dashboard** where every user's view is unique—shaped by their role, their interests, and their questions. The chat interface isn't a feature; it's the primary interaction model.

## Goals
- **Dynamic by default**: No two users see the same dashboard
- **NL → SQL → Chart**: User says "show me weekly MAU trend" and a card appears
- **Learn from behavior**: Surface relevant content based on query history
- **Zero-config start**: Role-based templates get users productive immediately

## Non-Goals
- Not a BI tool replacement (no complex joins, no report scheduling)
- Not a data catalog (doesn't help discover what data exists)
- Not multi-tenant SaaS (single-user local app for now)

## Requirements

### Must Have (MVP)
- [ ] **Chat-driven card creation**: "Add a card showing X" → generates SQL → renders chart
- [ ] **Card management via chat**: show/hide, reorder, resize cards through conversation
- [ ] **4 chart types**: single metric, trend lines, bar charts, tables
- [ ] **Role templates**: PM, Data Engineer, Executive, General starting points
- [ ] **LocalStorage persistence**: dashboard state survives refresh
- [ ] **Collapsible SQL**: users can inspect/tweak generated queries
- [ ] **Full Snowflake access**: query any table user has SELECT on

### Nice to Have (v2)
- [ ] Query history analysis for proactive suggestions
- [ ] Shareable dashboard configs
- [ ] Card templates library
- [ ] Anomaly detection ("alert me when X drops below Y")

## Technical Approach

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Chat Panel  │  │ Card Grid   │  │ Card Components     │  │
│  │ (primary UI)│  │ (dynamic)   │  │ (MetricCard, Chart, │  │
│  │             │  │             │  │  Table, etc.)       │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────┘  │
│         │                │                                   │
│         ▼                ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Dashboard State (LocalStorage)             ││
│  │  { cards: [...], layout: {...}, preferences: {...} }    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ /api/chat   │  │ /api/query  │  │ /api/schema         │  │
│  │ NL→Intent   │  │ Execute SQL │  │ Table discovery     │  │
│  │ →SQL→Chart  │  │             │  │                     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         ▼                ▼                     ▼             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    LLM (Claude)                         ││
│  │  - Parse user intent                                    ││
│  │  - Generate SQL from natural language                   ││
│  │  - Choose appropriate chart type                        ││
│  │  - Suggest card configurations                          ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Snowflake                              │
│  - Any table user has SELECT access to                      │
│  - PAT auth via ~/.snowflake/config.toml                    │
└─────────────────────────────────────────────────────────────┘
```

### Card Schema
```typescript
interface DashboardCard {
  id: string;
  title: string;
  type: 'metric' | 'trend' | 'bar' | 'table' | 'distribution';
  sql: string;
  config: {
    xAxis?: string;      // column name for x-axis
    yAxis?: string;      // column name for y-axis
    groupBy?: string;    // column for series/grouping
    format?: 'number' | 'currency' | 'percent';
    comparison?: 'wow' | 'mom' | 'yoy';
  };
  position: { x: number; y: number; w: number; h: number };
  visible: boolean;
  createdAt: string;
  source: 'template' | 'user' | 'suggested';
}
```

### Chat Intent Classification
The chat system recognizes these intents:
1. **ADD_CARD**: "show me", "add a card", "I want to see"
2. **MODIFY_CARD**: "change the X card to", "update", "make it show"
3. **REMOVE_CARD**: "hide", "remove", "I don't need"
4. **REORDER**: "move X above Y", "put X first"
5. **QUERY**: "what was", "how many" (answers in chat, doesn't create card)
6. **STYLE**: "make it bigger", "use a bar chart instead"

### Role Templates

**PM Template**
- MAU trend (7-day)
- Feature adoption rates
- User segments breakdown
- Key conversion metrics

**Data Engineer Template**  
- Pipeline health status
- Query performance P50/P99
- Failed jobs last 24h
- Warehouse utilization

**Executive Template**
- Revenue/credits trend
- MAU with YoY comparison
- Top-line growth metrics
- Anomaly alerts

**General Template**
- Minimal starting point
- One example card
- Prominent "Ask me anything" prompt

## Open Questions
- How to handle SQL generation errors gracefully? (Show error in card? Toast?)
- Rate limiting for LLM calls?
- Should we cache query results? For how long?
- How to handle schema changes in saved SQL?

## Success Metrics
- Time to first custom card < 30 seconds
- User can describe any metric and see it visualized
- Dashboard feels "alive" - not a static report

## Timeline
- **Phase 1**: Chat → Card creation with 4 chart types
- **Phase 2**: Role templates + persistence  
- **Phase 3**: Query history integration + suggestions
