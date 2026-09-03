// dashboard/src/components/EventListView.jsx
//
// The compact event list (left column of the Activity Flow panel) -- a
// list version of the same nodes shown in FlowCanvas, clickable to select
// and show in the Details panel.
//
// `visibleIndexes` is optional: if provided (the filter/search result from
// ActivityFlowPanel), only those indexes get rendered -- but `onSelect` is
// still called with the ORIGINAL index into the full `events` array, so
// Details/the graph keep referring to the correct event.

import { useEffect, useRef } from "react";
import { describeEvent, labelFor } from "../lib/eventToNode";
import { CategoryIcon } from "./icons";
import { useI18n } from "../i18n/I18nContext";
import { formatTimeMaybeDate, formatDateTime } from "../lib/timeFormat";

export default function EventListView({ events, explicitSelectedIndex, onSelect, visibleIndexes }) {
  const { t } = useI18n();
  const indexes = visibleIndexes ?? events.map((_, i) => i);

  // IMPORTANT: this container MUST always be rendered (it can't be swapped
  // for a different element while empty) -- otherwise its ref keeps
  // pointing at different nodes and the scroll listener below (an effect
  // with a [] dep -- attaches only once) could fail to ever attach
  // permanently if the list is still empty on the very first mount (events
  // only arrive later).
  const containerRef = useRef(null);
  // Starts `true` -- an empty/freshly opened list is assumed to be
  // "following" the latest event by default, same as FlowCanvas.
  const isNearBottomRef = useRef(true);
  const prevLengthRef = useRef(0);

  // Updates "is the user near the bottom" every time they scroll manually
  // -- as soon as they scroll up to read older history, auto-scroll STOPS
  // interrupting until they scroll back down themselves.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function handleScroll() {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      isNearBottomRef.current = distanceFromBottom < 60;
    }
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll to the bottom if: (a) this just got filled in for the
  // first time from empty (starting to watch a new session -- always
  // scroll, ignore any old follow status), or (b) the user genuinely is
  // near the bottom when a new event arrives.
  //
  // `explicitSelectedIndex` is checked DIRECTLY here (not just trusting
  // isNearBottomRef) -- the root cause of a bug where "the first click
  // scrolls, the next click does nothing": the scroll-to-selection effect
  // below sets `el.scrollTop` programmatically to highlight the newly
  // selected row, BUT that also triggers a REAL browser 'scroll' event
  // (the listener above can't tell a programmatic scroll apart from the
  // user's own hand-scrolling) -- if the highlighted row happened to be
  // near the bottom of the list AT THAT MOMENT, that listener would
  // silently flip isNearBottomRef back to true, and the NEXT live event
  // (this kind of session very often gets a new event every 1-2 seconds)
  // would immediately drag the list back down before the user even got to
  // see the result of their click -- looking like "the next click didn't
  // scroll" when it actually DID scroll and then got reset. Checking the
  // prop directly (the source of truth, which the scroll listener can't
  // "hijack") removes this race entirely.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const isFreshLoad = prevLengthRef.current === 0 && indexes.length > 0;
    const hasOlderExplicitSelection = explicitSelectedIndex != null && explicitSelectedIndex !== events.length - 1;
    if (!hasOlderExplicitSelection && (isFreshLoad || isNearBottomRef.current)) {
      el.scrollTop = el.scrollHeight;
      isNearBottomRef.current = true;
    }
    prevLengthRef.current = indexes.length;
  }, [indexes.length, explicitSelectedIndex, events.length]);

  // The selection changed -- either via clicking THIS ROW ITSELF, OR via
  // clicking a node in FlowCanvas (both go through the same store
  // selectEvent(), so this prop changes regardless of the source) -- make
  // sure the matching row is also visible in this list. Without this,
  // clicking a node in the graph would NOT scroll this list at all, its
  // related row could stay off-screen even though the node itself is
  // clearly highlighted in the graph (a reported bug).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || explicitSelectedIndex == null) return;
    const rowEl = el.querySelector(`[data-index="${explicitSelectedIndex}"]`);
    if (!rowEl) return; // currently filtered out/not in the list view -- nothing to scroll to
    const rowTop = rowEl.offsetTop;
    const rowBottom = rowTop + rowEl.offsetHeight;
    const viewTop = el.scrollTop;
    const viewBottom = viewTop + el.clientHeight;
    if (rowTop < viewTop || rowBottom > viewBottom) {
      el.scrollTop = rowTop - el.clientHeight / 2 + rowEl.offsetHeight / 2; // center it, not flush against the edge
    }
    // If the selected one is the LAST event, treat the user as having gone back to "following" live.
    isNearBottomRef.current = explicitSelectedIndex === events.length - 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explicitSelectedIndex]);

  return (
    <div className="event-list" ref={containerRef}>
      {indexes.length === 0 ? (
        <div className="event-list--empty">{t("activityFlow.list.empty")}</div>
      ) : (
        indexes.map((index) => {
          const event = events[index];
          const info = describeEvent(event);
          // explicitSelectedIndex (NOT falling back to the last event) --
          // the blue ring only attaches if the user GENUINELY clicked,
          // consistent with FlowCanvas.jsx.
          const isSelected = explicitSelectedIndex === index;
          const isLast = index === events.length - 1;
          // Clicking an OLDER row (not the last one) means the user
          // deliberately wants to look at it -- auto-scroll-to-bottom MUST
          // stop first, so that new incoming events don't "drag" the list
          // back down and make the row they just selected disappear off
          // screen (a reported bug: looked like the click did nothing).
          // Clicking the LAST row = treat it as the user wanting to go
          // back to "following" live again.
          function handleClick() {
            isNearBottomRef.current = isLast;
            onSelect(index);
          }
          return (
            <button
              key={index}
              type="button"
              data-index={index}
              className={`event-list__row event-list__row--${info.variant}${isSelected ? " event-list__row--selected" : ""}`}
              onClick={handleClick}
              title={formatDateTime(event.timestamp)}
            >
              <CategoryIcon category={info.category} size={13} className="event-list__icon" />
              <span className="event-list__label">
                {labelFor(t, info)}
                {info.auto ? <span className="badge-auto">{t("event.autoBadge")}</span> : null}
                {isLast ? <span className="event-list__current-badge">{t("activityFlow.current")}</span> : null}
              </span>
              <span className="event-list__time">{formatTimeMaybeDate(event.timestamp)}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
