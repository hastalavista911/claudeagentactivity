// dashboard/src/components/FlowCanvas.jsx
//
// Renders the event stream as a timeline of nodes (doc section 9: React
// Flow node mapping from an event type). Node positions are computed
// automatically by dagre (lib/layout.js) every time the event list
// changes -- see the note in layoutTimeline() for why it's fully
// recomputed each time, not incrementally.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, useReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import ActivityNode from "./ActivityNode";
import { describeEvent } from "../lib/eventToNode";
import { layoutTimeline } from "../lib/layout";
import { STATUS_COLOR } from "../lib/statusColors";
import { isTurnOpen } from "../lib/stats";
import { useI18n } from "../i18n/I18nContext";

const nodeTypes = { activity: ActivityNode };

function minimapNodeColor(node) {
  return STATUS_COLOR[node.data?.variant] ?? STATUS_COLOR.info;
}

function buildGraph(events, explicitSelectedIndex) {
  // The turn hasn't closed yet (no agent.complete/agent.error yet) -- used
  // so the LAST node keeps pulsing even once its own concrete event is
  // "done" (e.g. "Terminal Done"), since Claude Code is often still
  // thinking BETWEEN one tool call and the next with no event for that at
  // all (see findCurrentActivity() in lib/stats.js). Without this, Activity
  // Flow would look like nothing is running even though it's actually
  // still active.
  const turnOpen = isTurnOpen(events);

  const rawNodes = events.map((event, index) => {
    const info = describeEvent(event);
    const isCurrent = index === events.length - 1;
    return {
      id: `${index}`,
      type: "activity",
      position: { x: 0, y: 0 }, // overwritten by layoutTimeline() below
      data: {
        ...info,
        timestamp: event.timestamp,
        // Deliberately uses explicitSelectedIndex (NOT the effectiveIndex
        // fallback) -- the "SELECTED" ring/badge only shows up if the user
        // GENUINELY clicked something, it doesn't automatically stick to
        // the last node just because that's what the Details panel shows
        // by default (that already has its own "CURRENT" badge -- two
        // badges at once there with no click at all would just be
        // noisy/confusing).
        isSelected: explicitSelectedIndex === index,
        isCurrent,
        stillWorking: isCurrent && turnOpen,
      },
    };
  });

  const rawEdges = events.slice(1).map((_, i) => ({
    id: `e${i}-${i + 1}`,
    source: `${i}`,
    target: `${i + 1}`,
    animated: false,
    style: { stroke: "var(--edge-color)" },
  }));

  return layoutTimeline(rawNodes, rawEdges, "LR");
}

function FlowInner({ events, explicitSelectedIndex, onSelectEvent, selectedSessionId, sessionId }) {
  const { t } = useI18n();
  const { nodes, edges } = useMemo(() => buildGraph(events, explicitSelectedIndex), [events, explicitSelectedIndex]);
  const { fitView } = useReactFlow();
  // The `nodes` length that was LAST actually finished being fitted (not
  // just a boolean), so an effect that re-fires with no real data change
  // (StrictMode double-invoke, or `fitView`'s identity changing between
  // renders) doesn't overwrite an already-correct fit result with the
  // wrong "follow latest node" action.
  const lastFittedLength = useRef(0);
  // The last index that's ALREADY been panned/zoomed to via the click
  // effect below -- different from lastFittedLength (which is about the
  // node count), this is about "which explicit index was last requested by the user".
  const lastFittedSelection = useRef(null);

  // On mobile/tablet layouts, the graph container only gets its DEFINITE
  // height once the responsive breakpoint (`.flow-panel__body` becoming a
  // column) finishes being recomputed by the browser -- if the FIRST
  // fitView (either from React Flow's own built-in `fitView` prop below,
  // or the effect above) happens to run WHILE the container is still
  // ~0px, its camera gets "lost" (a transform outside any sane range) and
  // does NOT recover on its own even once the container later gets a real
  // size -- the graph looks completely empty, including its Background dot
  // pattern (user report 2026-09-03, on a non-desktop view).
  //
  // A CALLBACK ref (not a plain useRef+useEffect) -- this wrapper only
  // exists in the "has nodes" branch (see the nodes.length===0 early
  // return below), so as soon as the panel STARTS empty and later fills in
  // with events (the most common scenario: dashboard just opened, backfill
  // still running), its div only mounts LATER -- a regular useEffect
  // (depending on `fitView`, whose identity is stable) wouldn't re-run to
  // catch that moment. A callback ref is called EXACTLY every time the
  // element attaches/detaches, so the observer is always correct even if
  // the wrapper mounts later.
  const hasRefitAfterResize = useRef(false);
  const resizeObserverRef = useRef(null);
  const graphWrapperRef = useCallback(
    (el) => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (!el || typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        if (width > 10 && height > 10 && !hasRefitAfterResize.current) {
          hasRefitAfterResize.current = true;
          fitView({ duration: 0, padding: 0.15 });
        }
      });
      observer.observe(el);
      resizeObserverRef.current = observer;
    },
    [fitView]
  );

  useEffect(() => {
    if (nodes.length === 0) {
      lastFittedLength.current = 0;
      lastFittedSelection.current = null;
      return;
    }
    const targetLength = nodes.length;
    const timer = setTimeout(() => {
      if (lastFittedLength.current === targetLength) return; // already fitted, no real change

      // The user deliberately clicked an OLDER node (not the last one) --
      // do NOT drag the viewport back to the newest node every time a new
      // event comes in, that's what makes a just-clicked node "disappear"
      // from the screen and looks like the click had no effect (a reported
      // bug). The layout still gets recomputed (node positions can shift a
      // bit), but the camera stays put until the user clicks the newest
      // node again or goes back to the default.
      const hasOlderSelection = explicitSelectedIndex != null && explicitSelectedIndex !== events.length - 1;
      // The first load (including after a page refresh, when backfill
      // arrives all at once, e.g. 0->159) & a new-session reset used to
      // show the WHOLE timeline first -- changed (user request 2026-09-03):
      // auto-follow to the LATEST ACTIVITY ONLY, same as the existing
      // "follow the newest node" behavior for new events arriving later --
      // not just once already watching, but also on the VERY FIRST
      // open/refresh.
      if (!hasOlderSelection) {
        // Fit to the newest node + one before it (not just a single node)
        // -- see the long note in the click effect below for why the
        // window is more than one node in this narrow graph container.
        const tailWindow = [nodes[nodes.length - 2], nodes[nodes.length - 1]].filter(Boolean);
        fitView({ nodes: tailWindow, duration: 300, padding: 0.3, minZoom: 0.4, maxZoom: 0.85 });
      }
      lastFittedLength.current = targetLength;
    }, 50);
    return () => clearTimeout(timer);
  }, [nodes, fitView, explicitSelectedIndex, events.length]);

  // An EXPLICIT click (list OR graph, via explicitSelectedIndex -- NOT the
  // default fallback to the last event, see App.jsx's effectiveIndex vs
  // selectedEventIndex) -- pan/zoom the camera to that node. Without this,
  // a click just adds a thin 2px outline that can easily be completely
  // invisible if the graph is zoomed out to fit many events (e.g. a long
  // session with hundreds of them) -- looks like the click had no effect
  // (a reported bug). Different from the "follow latest" effect above --
  // this ALWAYS runs whenever the user clicks something new, whatever the node is.
  useEffect(() => {
    if (explicitSelectedIndex == null || nodes.length === 0) return;
    if (lastFittedSelection.current === explicitSelectedIndex) return; // already panned there
    const idx = nodes.findIndex((n) => n.id === String(explicitSelectedIndex));
    if (idx === -1) return;
    lastFittedSelection.current = explicitSelectedIndex;
    // Fit to the clicked node PLUS one neighbor on each side -- NOT just
    // the node itself. This graph container is NARROW (verified directly:
    // ~400x250px), while one node is 240px wide -- fitting to a SINGLE
    // node nearly fills the whole container, leaving almost no neighbor
    // visible/clickable. That makes the NEXT click on another node easy to
    // miss and land on empty canvas (does nothing, no error) -- looking
    // like "the second click did nothing" when it actually just missed.
    // This 3-node window gives room to click a neighbor directly without
    // needing to zoom out manually first.
    const windowNodes = [nodes[idx - 1], nodes[idx], nodes[idx + 1]].filter(Boolean);
    const timer = setTimeout(() => {
      fitView({ nodes: windowNodes, duration: 300, padding: 0.3, minZoom: 0.4, maxZoom: 0.85 });
    }, 60);
    return () => clearTimeout(timer);
  }, [explicitSelectedIndex, nodes, fitView]);

  if (nodes.length === 0) {
    // Three DIFFERENT conditions that all used to show the same message
    // ("Enter a session_id...") -- when really only the first one actually
    // matches that message:
    //  1. No session_id at all yet -> prompt to fill in the box above.
    //  2. A session_id HAS been entered & "Watch this session" HAS been
    //     clicked, the REST backfill is still in flight (sessionId hasn't
    //     been filled in yet -- see backfill() in useAgentStore.js,
    //     sessionId only gets filled AFTER the request finishes) -> can't
    //     conclude validity yet, don't rush to call it wrong.
    //  3. Backfill has ALREADY finished (sessionId is filled in) but events
    //     is still empty -> this is what the user is validating: tell them
    //     explicitly there's no data for that session_id (a typo, OR it
    //     genuinely never sent any event), not silently look like condition #1 again.
    let content;
    if (!selectedSessionId) {
      content = (
        <p className="flow-empty__text">
          {t("activityFlow.emptyGraphPrefix")} <code>session_id</code> {t("activityFlow.emptyGraphSuffix")}
        </p>
      );
    } else if (!sessionId) {
      content = <p className="flow-empty__text">{t("activityFlow.emptyLoading")}</p>;
    } else {
      content = (
        <p className="flow-empty__text">
          {t("activityFlow.emptyInvalidPrefix")} <code>{sessionId}</code> {t("activityFlow.emptyInvalidSuffix")}
        </p>
      );
    }
    return <div className="flow-empty">{content}</div>;
  }

  return (
    <div ref={graphWrapperRef} style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onNodeClick={(_, node) => onSelectEvent?.(Number(node.id))}
        fitView
        minZoom={0.2}
        proOptions={{ hideAttribution: true }}
        // This dashboard is ALWAYS dark (there's no light mode, see
        // index.css color-scheme:dark) -- but React Flow has ITS OWN
        // light/dark color variant, selected via a ".dark" class on its
        // root element, which does NOT automatically follow our theme.
        // Without this, it falls back to its default light variant: white
        // Controls buttons (+/-) (#fefefe) + icon color "inherit" (which
        // becomes our app's light text color) -- white on white, so the
        // icons become invisible (user report 2026-09-03).
        colorMode="dark"
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={minimapNodeColor}
          maskColor="rgba(15, 23, 42, 0.6)"
          style={{ backgroundColor: "var(--bg-elevated)" }}
        />
      </ReactFlow>
    </div>
  );
}

export default function FlowCanvas({ events, explicitSelectedIndex, onSelectEvent, selectedSessionId, sessionId }) {
  return (
    <ReactFlowProvider>
      <FlowInner
        events={events}
        explicitSelectedIndex={explicitSelectedIndex}
        onSelectEvent={onSelectEvent}
        selectedSessionId={selectedSessionId}
        sessionId={sessionId}
      />
    </ReactFlowProvider>
  );
}
