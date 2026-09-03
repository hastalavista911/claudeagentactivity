// dashboard/src/components/ActivityFlowPanel.jsx
//
// Middle panel: a compact event list (left) + a React Flow graph (right),
// two views of the same data, both clickable to select an event.
//
// Search + the filter chips only affect the LIST (left column) -- the
// graph on the right still shows every event so the shape of the workflow
// stays intact, not re-laid-out every time the filter changes.

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import EventListView from "./EventListView";
import FlowCanvas from "./FlowCanvas";
import { ACTIVITY_FILTERS, matchesFilter, matchesSearch } from "../lib/eventToNode";
import { useI18n } from "../i18n/I18nContext";

export default function ActivityFlowPanel({ events, explicitSelectedIndex, onSelectEvent, connectionStatus, selectedSessionId, sessionId }) {
  const { t } = useI18n();
  const [filterKey, setFilterKey] = useState("all");
  const [searchText, setSearchText] = useState("");

  const visibleIndexes = useMemo(() => {
    return events
      .map((_, i) => i)
      .filter((i) => matchesFilter(events[i], filterKey) && matchesSearch(events[i], searchText, t));
  }, [events, filterKey, searchText, t]);

  return (
    <section className="panel panel--flow">
      <div className="panel__header">
        <h2 className="panel__title">
          {t("activityFlow.title")} <span className="panel__title-count">({events.length})</span>
        </h2>
        {connectionStatus === "open" && (
          <span className="live-badge">
            <span className="pulse-dot" /> {t("activityFlow.live")}
          </span>
        )}
      </div>

      <div className="flow-search">
        <Search size={13} className="flow-search__icon" strokeWidth={2} />
        <input
          type="text"
          className="flow-search__input"
          placeholder={t("activityFlow.searchPlaceholder")}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>
      <div className="flow-filters">
        {ACTIVITY_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`flow-filter${filterKey === f.key ? ` flow-filter--active flow-filter--${f.key}` : ""}`}
            onClick={() => setFilterKey(f.key)}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      <div className="flow-panel__body">
        <EventListView
          events={events}
          explicitSelectedIndex={explicitSelectedIndex}
          onSelect={onSelectEvent}
          visibleIndexes={visibleIndexes}
        />
        <div className="flow-panel__graph">
          <FlowCanvas
            events={events}
            explicitSelectedIndex={explicitSelectedIndex}
            onSelectEvent={onSelectEvent}
            selectedSessionId={selectedSessionId}
            sessionId={sessionId}
          />
        </div>
      </div>
    </section>
  );
}
