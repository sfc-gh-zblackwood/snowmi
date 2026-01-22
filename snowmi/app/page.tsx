"use client";

import { useEffect, useCallback, useState } from "react";
import { useDashboard, DashboardCard, generateCardId, ROLE_TEMPLATES, CardType, CardConfig } from "@/lib/dashboard-state";
import { DynamicCardRenderer } from "@/components/dynamic-card";
import { ChatPanel, ChatToggleButton } from "@/components/chat-panel";
import { Onboarding } from "@/components/onboarding";
import { Clock, CheckCircle, Trash2, Sparkles } from "lucide-react";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const STORAGE_KEY_ONBOARDED = "snowmi-onboarded";

export default function Home() {
  const { state, initialized, addCard, removeCard, updateCard, reorderCards, setRole, clearCards } = useDashboard();
  const [chatOpen, setChatOpen] = useState(false);
  const [loadingCards, setLoadingCards] = useState<Set<string>>(new Set());
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    const onboarded = localStorage.getItem(STORAGE_KEY_ONBOARDED);
    setHasOnboarded(!!onboarded);
  }, []);

  useEffect(() => {
    if (!initialized) return;

    state.cards.forEach((card) => {
      if (!card.data && !card.loading && !card.error) {
        fetchCardData(card.id, card.sql);
      }
    });
  }, [initialized, state.cards]);

  const fetchCardData = async (cardId: string, sql: string) => {
    setLoadingCards((prev) => new Set(prev).add(cardId));
    updateCard(cardId, { loading: true });

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql }),
      });
      const json = await res.json();

      if (json.error) {
        updateCard(cardId, { loading: false, error: json.error });
      } else {
        updateCard(cardId, { loading: false, data: json.data });
      }
    } catch (err) {
      updateCard(cardId, { loading: false, error: String(err) });
    } finally {
      setLoadingCards((prev) => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    }
  };

  const handleOnboardingComplete = (starterId: string) => {
    localStorage.setItem(STORAGE_KEY_ONBOARDED, "true");
    setHasOnboarded(true);
    
    if (starterId !== "blank") {
      setRole(starterId as "pm" | "engineer" | "executive" | "general");
    } else {
      clearCards();
    }
    
    setChatOpen(true);
  };

  const handleChatAction = useCallback(
    (action: {
      type: string;
      card?: Partial<DashboardCard>;
      targetCard?: string;
      cardToMove?: string;
      position?: string;
      updates?: Partial<DashboardCard> & { data?: Record<string, unknown>[] };
      style?: { type?: CardType; size?: string };
    }) => {
      if (action.type === "add_card" && action.card) {
        const newCard: DashboardCard = {
          id: generateCardId(),
          title: action.card.title || "New Card",
          type: action.card.type || "metric",
          sql: action.card.sql || "",
          config: action.card.config || {},
          position: { x: 0, y: state.cards.length, w: 1, h: 1 },
          visible: true,
          createdAt: new Date().toISOString(),
          source: "user",
          data: action.card.data as Record<string, unknown>[] | undefined,
        };
        addCard(newCard);
      }

      if (action.type === "remove_card" && action.targetCard) {
        const target = state.cards.find(
          (c) => c.title.toLowerCase().includes(action.targetCard!.toLowerCase())
        );
        if (target) {
          removeCard(target.id);
        }
      }

      if (action.type === "modify_card" && action.targetCard && action.updates) {
        const target = state.cards.find(
          (c) => c.title.toLowerCase().includes(action.targetCard!.toLowerCase())
        );
        if (target) {
          updateCard(target.id, {
            ...action.updates,
            data: action.updates.data,
          });
        }
      }

      if (action.type === "reorder_cards" && action.cardToMove && action.position) {
        const cardToMoveIndex = state.cards.findIndex(
          (c) => c.title.toLowerCase().includes(action.cardToMove!.toLowerCase())
        );
        if (cardToMoveIndex === -1) return;

        let toIndex = 0;
        if (action.position === "first") {
          toIndex = 0;
        } else if (action.position === "last") {
          toIndex = state.cards.length - 1;
        } else if (action.position.startsWith("before:")) {
          const refTitle = action.position.slice(7);
          toIndex = state.cards.findIndex((c) =>
            c.title.toLowerCase().includes(refTitle.toLowerCase())
          );
          if (toIndex === -1) toIndex = 0;
        } else if (action.position.startsWith("after:")) {
          const refTitle = action.position.slice(6);
          toIndex = state.cards.findIndex((c) =>
            c.title.toLowerCase().includes(refTitle.toLowerCase())
          );
          if (toIndex === -1) toIndex = state.cards.length - 1;
          else toIndex += 1;
        }
        
        reorderCards(cardToMoveIndex, toIndex);
      }

      if (action.type === "style_card" && action.targetCard && action.style) {
        const target = state.cards.find(
          (c) => c.title.toLowerCase().includes(action.targetCard!.toLowerCase())
        );
        if (target) {
          const updates: Partial<DashboardCard> = {};
          if (action.style.type) {
            updates.type = action.style.type;
          }
          if (action.style.size) {
            const sizeMap: Record<string, { w: number; h: number }> = {
              small: { w: 1, h: 1 },
              medium: { w: 1, h: 1 },
              large: { w: 2, h: 1 },
              full: { w: 2, h: 2 },
            };
            updates.position = { ...target.position, ...sizeMap[action.style.size] };
          }
          updateCard(target.id, updates);
        }
      }
    },
    [addCard, removeCard, updateCard, reorderCards, state.cards]
  );

  const handleResetDashboard = () => {
    localStorage.removeItem(STORAGE_KEY_ONBOARDED);
    localStorage.removeItem("snowmi-dashboard");
    setHasOnboarded(false);
    setChatOpen(false);
  };

  const visibleCards = state.cards.filter((c) => c.visible);

  if (hasOnboarded === null || !initialized) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!hasOnboarded) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  const currentCardsContext = visibleCards.map(c => ({
    id: c.id,
    title: c.title,
    type: c.type as CardType,
  }));

  return (
    <main className="min-h-screen bg-slate-950">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <header className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                {getGreeting()}
              </h1>
              <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> AI Dashboard
              </span>
            </div>
            <p className="text-slate-500 text-sm">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              {" · "}
              {visibleCards.length} card{visibleCards.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={handleResetDashboard}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-400 hover:text-red-400 hover:border-red-500/50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Reset
          </button>
        </header>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span className="text-sm font-medium text-slate-200">Your Dashboard</span>
          </div>
          {loadingCards.size === 0 && visibleCards.length > 0 && (
            <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3" /> All Data Loaded
            </span>
          )}
          {loadingCards.size > 0 && (
            <span className="text-xs px-3 py-1.5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center gap-1.5">
              <div className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
              Loading {loadingCards.size} card(s)...
            </span>
          )}
        </div>

        {visibleCards.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-500/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Ready to build your dashboard</h3>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              Chat with AI to create custom visualizations. Describe what you want to see and I'll generate it for you.
            </p>
            <button
              onClick={() => setChatOpen(true)}
              className="px-6 py-3 rounded-xl bg-cyan-500 text-slate-900 font-medium hover:bg-cyan-400 transition-colors"
            >
              Start Building
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {visibleCards.map((card) => (
              <DynamicCardRenderer
                key={card.id}
                card={card}
                onRemove={() => removeCard(card.id)}
                onUpdate={(updates) => updateCard(card.id, updates)}
              />
            ))}
          </div>
        )}

        <div className="h-24" />
      </div>

      {!chatOpen && <ChatToggleButton onClick={() => setChatOpen(true)} />}
      <ChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        onAction={handleChatAction}
        currentCards={currentCardsContext}
      />
    </main>
  );
}
