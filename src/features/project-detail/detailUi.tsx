import type { ReactNode } from "react";
import type { DetailTab } from "./detailTypes";

export function DetailTabs({
  activeTab,
  onChange,
  openFollowUps,
  checklistPercent,
  decisionScore,
  decisionRecommendation
}: {
  activeTab: DetailTab;
  onChange: (tab: DetailTab) => void;
  openFollowUps: number;
  checklistPercent: number;
  decisionScore: number;
  decisionRecommendation: string;
}) {
  const tabs: Array<{
    id: DetailTab;
    label: string;
    meta: string;
  }> = [
    { id: "cockpit", label: "Cockpit", meta: `${decisionScore}/100 · ${decisionRecommendation}` },
    { id: "interview", label: "Interjú", meta: "Gyors / teljes flow" },
    { id: "overview", label: "Alapadatok", meta: "Projekt és kapcsolat" },
    { id: "checklist", label: "Checklist", meta: `${checklistPercent}% kész` },
    { id: "followups", label: "Nyitott kérdések", meta: `${openFollowUps} aktív` },
    { id: "decision", label: "Döntés", meta: "Go / No-Go" }
  ];

  return (
    <nav className="detail-tabs" aria-label="Projekt szerkesztési nézetek">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`detail-tab ${activeTab === tab.id ? "active" : ""}`}
          type="button"
          aria-current={activeTab === tab.id ? "page" : undefined}
          onClick={() => onChange(tab.id)}
        >
          <span>{tab.label}</span>
          <small>{tab.meta}</small>
        </button>
      ))}
    </nav>
  );
}

export function SectionTitle({
  title,
  actions
}: {
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {actions}
    </div>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
