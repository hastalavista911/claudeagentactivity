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
  // Set right before WE move `el.scrollTop` ourselves (scroll-to-selection
  // effect below) -- lets the scroll listener tell "the user just scrolled
  // by hand" apart from "that scroll was our own doing", see both effects below.
  const suppressScrollRecalcRef = useRef(false);

  // Updates "is the user near the bottom" on every REAL scroll -- as soon
  // as they scroll up to read older history, auto-scroll STOPS
  // interrupting until they scroll back down themselves (by hand OR by
  // clicking the last row again, see the effects below).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function handleScroll() {
      // This scroll event was fired by OUR OWN `el.scrollTop = ...` in the
      // scroll-to-selection effect, not the user's hand -- skip recomputing
      // once, so it can't silently overwrite whatever isNearBottomRef was
      // already correctly set to. Without this, clicking an OLDER row that
      // happens to land near the bottom would flip isNearBottomRef back to
      // true, and the very next live event would immediately drag the list
      // back down before the user got to see the row they just clicked.
      if (suppressScrollRecalcRef.current) {
        suppressScrollRecalcRef.current = false;
        return;
      }
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      isNearBottomRef.current = distanceFromBottom < 60;
    }
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll to the bottom if: (a) this just got filled in for the
  // first time from empty (starting to watch a new session -- always
  // scroll, ignore any old follow status), or (b) the user is currently
  // near the bottom when a new event arrives -- purely based on the REAL
  // physical scroll position (isNearBottomRef), nothing else. Previously
  // this also permanently blocked auto-scroll for as long as an OLDER row
  // stayed selected (even long after the user scrolled back down by hand),
  // so a newly running "current" activity could stay invisible until a
  // manual scroll -- user report 2026-09-04. isNearBottomRef alone is now
  // reliable (see suppressScrollRecalcRef above), so that extra guard isn't
  // needed anymore.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const isFreshLoad = prevLengthRef.current === 0 && indexes.length > 0;
    if (isFreshLoad || isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      isNearBottomRef.current = true;
    }
    prevLengthRef.current = indexes.length;
  }, [indexes.length, events.length]);

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
      suppressScrollRecalcRef.current = true; // this scroll is US, not the user -- see the listener above
      el.scrollTop = rowTop - el.clientHeight / 2 + rowEl.offsetHeight / 2; // center it, not flush against the edge
    }
    // If the selected one is the LAST event, treat the user as having gone
    // back to "following" live -- otherwise leave isNearBottomRef exactly
    // as it already was (the click itself didn't change the real scroll
    // position, so it shouldn't force-flip the follow state either way).
    if (explicitSelectedIndex === events.length - 1) isNearBottomRef.current = true;
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
              {/* Hidden when this row is CURRENT -- the "current" badge sits
                  in the same narrow row and the two were overlapping/
                  getting cut off against each other at this row width (user
                  report 2026-09-04, screenshot showed the badge run over by
                  the timestamp). The full timestamp is still available via
                  the row's `title` tooltip above. */}
              {!isLast && <span className="event-list__time">{formatTimeMaybeDate(event.timestamp)}</span>}
            </button>
          );
        })
      )}
    </div>
  );
}
