import { useEffect, useMemo, useRef, useState } from "react";
import { useAgentStore } from "./store/useAgentStore";
import StatusBar from "./components/StatusBar";
import NotificationBanner from "./components/NotificationBanner";
import PermissionRequestCard from "./components/PermissionRequestCard";
import ServerSwitchNotice from "./components/ServerSwitchNotice";
import OverviewPanel from "./components/OverviewPanel";
import ActivityFlowPanel from "./components/ActivityFlowPanel";
import DetailsPanel from "./components/DetailsPanel";
import TerminalLogPanel from "./components/TerminalLogPanel";
import GitPanel from "./components/GitPanel";
import InsightsPanel from "./components/InsightsPanel";
import ChatPanel from "./components/ChatPanel";
import Legend from "./components/Legend";
import ScrollToTopButton from "./components/ScrollToTopButton";
import AppPreloader from "./components/AppPreloader";
import { findPendingNotification } from "./lib/notifications";
import "./App.css";

export default function App() {
  const connect = useAgentStore((s) => s.connect);
  const disconnect = useAgentStore((s) => s.disconnect);
  const resumeLastSession = useAgentStore((s) => s.resumeLastSession);
  const initializing = useAgentStore((s) => s.initializing);
  const connectionStatus = useAgentStore((s) => s.connectionStatus);
  const sessionId = useAgentStore((s) => s.sessionId);
  const status = useAgentStore((s) => s.status);
  const activeFile = useAgentStore((s) => s.activeFile);
  const events = useAgentStore((s) => s.events);
  const usage = useAgentStore((s) => s.usage);
  const selectedSessionId = useAgentStore((s) => s.selectedSessionId);
  const watchSession = useAgentStore((s) => s.watchSession);
  const stopWatching = useAgentStore((s) => s.stopWatching);
  const selectedEventIndex = useAgentStore((s) => s.selectedEventIndex);
  const selectEvent = useAgentStore((s) => s.selectEvent);
  const pendingPermission = useAgentStore((s) => s.pendingPermission);
  const approvalGateMode = useAgentStore((s) => s.approvalGateMode);
  const setApprovalGateMode = useAgentStore((s) => s.setApprovalGateMode);

  useEffect(() => {
    connect();
    resumeLastSession();
    return () => disconnect();
  }, [connect, disconnect, resumeLastSession]);

  // `initializing` (store) can flip to false ALMOST SIMULTANEOUSLY with
  // initializingProgress:100 in the same set() call (see
  // resumeLastSession()) -- if the overlay were dropped the instant that
  // happens, the CSS bar transition (0.6s, see App.css) wouldn't have had
  // time to actually visually reach 100%, so it'd look cut off.
  // showPreloader here is DELIBERATELY different from the raw `initializing`
  // -- delays slightly BEFORE dropping it, BUT only if some process
  // actually took a while (elapsed > 80ms since mount). If there's no
  // stored session at all, resumeLastSession() finishes almost instantly --
  // an extra delay there would just add friction to the most common case
  // (an empty dashboard) with no animation that actually needs "waiting to finish".
  const mountedAtRef = useRef(performance.now());
  const [showPreloader, setShowPreloader] = useState(true);
  useEffect(() => {
    if (initializing) return;
    const elapsed = performance.now() - mountedAtRef.current;
    const delay = elapsed > 80 ? 500 : 0;
    const timer = setTimeout(() => setShowPreloader(false), delay);
    return () => clearTimeout(timer);
  }, [initializing]);

  // The "active" event shown in the Details/Terminal/Code panel: whichever
  // one the user selected, or defaults to the last event if nothing's selected.
  const effectiveIndex = selectedEventIndex ?? (events.length > 0 ? events.length - 1 : null);
  const selectedEvent = effectiveIndex != null ? events[effectiveIndex] : null;
  const isSelectionCurrent = effectiveIndex === events.length - 1;

  const pendingNotification = useMemo(() => findPendingNotification(events), [events]);
  // GitPanel needs to know which project folder to inspect -- the session's
  // currently active file (activeFile), or the session's own cwd if no file
  // has been touched yet at all (e.g. a chat session that just started).
  const sessionCwd = events[0]?.cwd ?? null;

  return (
    <div className="app">
      {showPreloader ? <AppPreloader /> : null}

      <StatusBar
        connectionStatus={connectionStatus}
        sessionId={sessionId}
        status={status}
        activeFile={activeFile}
        eventCount={events.length}
        events={events}
        usage={usage}
        selectedSessionId={selectedSessionId}
        onWatchSession={watchSession}
        onStopWatching={stopWatching}
        approvalGateMode={approvalGateMode}
        onSetApprovalGateMode={setApprovalGateMode}
      />

      <ServerSwitchNotice />
      <PermissionRequestCard request={pendingPermission} />
      <NotificationBanner notification={pendingNotification} />

      <div className="app__content">
        <div className="app__body">
          <main className="app__grid">
            <OverviewPanel events={events} usage={usage} />
            <ActivityFlowPanel
              events={events}
              explicitSelectedIndex={selectedEventIndex}
              onSelectEvent={selectEvent}
              connectionStatus={connectionStatus}
              selectedSessionId={selectedSessionId}
              sessionId={sessionId}
            />
            <DetailsPanel event={selectedEvent} isCurrent={isSelectionCurrent} />
          </main>

          <div className="app__grid app__grid--bottom">
            <TerminalLogPanel events={events} selectedEvent={selectedEvent} />
            <GitPanel activeFile={activeFile} sessionCwd={sessionCwd} />
            <InsightsPanel events={events} usage={usage} onSelectEvent={selectEvent} />
          </div>
        </div>

        <ChatPanel />
      </div>

      <Legend />
      <ScrollToTopButton />
    </div>
  );
}
