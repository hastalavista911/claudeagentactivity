// dashboard/src/components/ChatPanel.jsx
//
// A GENUINE chat -- different from the rest of the dashboard, which is
// purely a consumer/observer, this panel can START a new session & send
// follow-up messages (server/chat.js, which runs Claude Code via
// @anthropic-ai/claude-agent-sdk).
//
// Two modes:
//  - No session being watched AT ALL yet (selectedSessionId null): a
//    "start new chat" form (cwd + first prompt).
//  - A session is being watched: shows chat.message as bubbles (from the
//    same `events` array used by other panels -- not separate state), plus
//    the text currently being streamed, plus a follow-up message input box.
//
// NOTE: sending a message only makes sense for a session that was
// GENUINELY started via this chat (the server needs `cwd`, derived from
// events[0].cwd -- see useAgentStore.js sendChatMessage()). For a session
// just "watched" from an external hook, its history is still read from the
// transcript (if there's a chat.message in there -- rare, since a
// hook-based session never sends that type), but the send button is still
// there -- if it genuinely fails (no cwd), a short error message is shown,
// rather than silently failing.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAgentStore } from "../store/useAgentStore";
import { MessageSquare, Send, ActivityKindIcon } from "./icons";
import ChatMarkdown from "./ChatMarkdown";
import { findCurrentActivity, ACTIVITY_LABEL_KEY } from "../lib/stats";
import { shortenPath } from "../lib/eventToNode";
import { useI18n } from "../i18n/I18nContext";

// The max height before text is considered "long" and gets collapsed --
// roughly 8-9 lines. A +4px tolerance so text that's JUST slightly over the
// limit doesn't get collapsed just to show a button that only adds 1 line.
const COLLAPSED_MAX_HEIGHT = 160;

function ChatBubble({ role, text }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const textRef = useRef(null);

  // scrollHeight still measures the FULL content height even while the
  // element is collapsed (overflow:hidden) -- so this is safe to call
  // whenever the text changes, no special render ordering needed.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > COLLAPSED_MAX_HEIGHT + 4);
  }, [text]);

  const isCollapsed = overflowing && !expanded;

  return (
    <div className={`chat-bubble chat-bubble--${role}`}>
      <div className="chat-bubble__role">{role === "user" ? t("chat.you") : t("chat.assistant")}</div>
      <div className="chat-bubble__text-wrap">
        <div ref={textRef} className={`chat-bubble__text${isCollapsed ? " chat-bubble__text--collapsed" : ""}`}>
          <ChatMarkdown text={text} />
        </div>
        {/* While collapsed, the button "floats" in the middle of the
            gradient area (stuck to the text) -- while expanded, the
            gradient's gone, so the button goes back to being a plain link
            below the full text. */}
        {overflowing ? (
          <button
            type="button"
            className={`chat-bubble__toggle${isCollapsed ? " chat-bubble__toggle--overlay" : ""}`}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? t("chat.showLess") : t("chat.showMore")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

// The "working" indicator -- reuses the same findCurrentActivity() used by
// the Current Activity card in OverviewPanel, so the label stays consistent
// (Thinking/Editing File/Running Command) and automatically follows REAL
// incoming events, rather than static text that never changes for the
// whole duration of a turn.
function ChatTypingIndicator({ events }) {
  const { t } = useI18n();
  const activity = findCurrentActivity(events);
  // findCurrentActivity() can be null even while chatBusy is still true --
  // e.g. right after starting a new chat (the last event is just a
  // "chat.message" from the user, no agent.thinking/tool call yet). Treat
  // that as "Thinking" too, since chatBusy=true means the turn genuinely is still running.
  const kind = activity?.kind ?? "thinking";
  const Icon = ActivityKindIcon[kind];
  const detail = activity?.file
    ? shortenPath(activity.file, 30)
    : activity?.command
      ? activity.command.slice(0, 40)
      : null;

  return (
    <div className="chat-panel__typing">
      <span className="chat-spinner" />
      {Icon ? <Icon size={12} strokeWidth={2} /> : null}
      <span>
        {t(ACTIVITY_LABEL_KEY[kind])}
        {detail ? <span className="chat-panel__typing-detail"> — {detail}</span> : null}
        …
      </span>
    </div>
  );
}

function StartChatForm() {
  const { t } = useI18n();
  const startChat = useAgentStore((s) => s.startChat);
  const chatBusy = useAgentStore((s) => s.chatBusy);
  const chatError = useAgentStore((s) => s.chatError);
  const [cwd, setCwd] = useState("");
  const [prompt, setPrompt] = useState("");
  const [enableApproval, setEnableApproval] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!cwd.trim() || !prompt.trim() || chatBusy) return;
    startChat(cwd, prompt, enableApproval);
  }

  return (
    <form className="chat-start-form" onSubmit={handleSubmit}>
      <p className="chat-start-form__hint">{t("chat.startForm.hint")}</p>
      <label className="chat-start-form__label">{t("chat.startForm.folderLabel")}</label>
      <input
        className="chat-start-form__input"
        type="text"
        placeholder={t("chat.startForm.folderPlaceholder")}
        value={cwd}
        onChange={(e) => setCwd(e.target.value)}
        disabled={chatBusy}
      />
      <label className="chat-start-form__label">{t("chat.startForm.promptLabel")}</label>
      <textarea
        className="chat-start-form__textarea"
        placeholder={t("chat.startForm.promptPlaceholder")}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={chatBusy}
        rows={3}
      />
      <label className="chat-start-form__checkbox">
        <input type="checkbox" checked={enableApproval} onChange={(e) => setEnableApproval(e.target.checked)} disabled={chatBusy} />
        {t("chat.startForm.approvalCheckbox")}
      </label>
      <p className="chat-start-form__hint chat-start-form__hint--warn">{t("chat.startForm.warnHint")}</p>

      <button type="submit" className="chat-start-form__button" disabled={chatBusy || !cwd.trim() || !prompt.trim()}>
        {chatBusy ? t("chat.startForm.starting") : t("chat.startForm.startButton")}
      </button>
      {chatError ? <div className="chat-start-form__error">{chatError}</div> : null}
    </form>
  );
}

export default function ChatPanel() {
  const { t } = useI18n();
  const selectedSessionId = useAgentStore((s) => s.selectedSessionId);
  const events = useAgentStore((s) => s.events);
  const chatStreamingText = useAgentStore((s) => s.chatStreamingText);
  const chatBusy = useAgentStore((s) => s.chatBusy);
  const chatError = useAgentStore((s) => s.chatError);
  const sendChatMessage = useAgentStore((s) => s.sendChatMessage);
  const [draft, setDraft] = useState("");
  const listRef = useRef(null);

  const chatMessages = events.filter((e) => e.type === "chat.message");

  // Auto-scroll to the bottom every time there's a new bubble/stream text
  // -- this chat panel is always assumed to be "actively followed," there's
  // no "read old history" mode to protect like Activity Flow (a chat
  // conversation is naturally read linearly).
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages.length, chatStreamingText]);

  function handleSend(e) {
    e.preventDefault();
    if (!draft.trim() || chatBusy) return;
    sendChatMessage(draft);
    setDraft("");
  }

  return (
    <section className="chat-panel">
      <div className="panel__header chat-panel__header">
        <h2 className="panel__title">
          <MessageSquare size={15} strokeWidth={2} /> {t("chat.title")}
        </h2>
      </div>

      {!selectedSessionId || (chatMessages.length === 0 && !chatStreamingText) ? (
        // These two conditions are deliberately COMBINED, not just an empty
        // session currently being watched: startChat() (called by this
        // form) calls watchSession() itself internally, so it does NOT
        // need a session to already be selected first -- this is in fact
        // the ONE AND ONLY way to get a session_id from scratch without
        // going out to a terminal/VS Code. Previously, having no session at
        // all just showed a static "enter a session_id" message with no
        // way out via this route (a gap reported by the user, 2026-09-03).
        // The other case still covered here: a session IS being watched but
        // has no chat.message yet -- either because it's observed from an
        // external hook (it'll never have one), or the first message just
        // hasn't been sent yet. The form is short, so it's wrapped in
        // .chat-panel__body to look DELIBERATELY centered, not like
        // content that's "cut off"/empty in the rest of a tall panel (see App.css).
        <div className="chat-panel__body">
          <StartChatForm />
        </div>
      ) : (
        <>
          <div className="chat-panel__list" ref={listRef}>
            {chatMessages.map((event, i) => (
              <ChatBubble key={i} role={event.payload.role} text={event.payload.text} />
            ))}
            {chatStreamingText ? <ChatBubble role="assistant" text={chatStreamingText} /> : null}
            {chatBusy && !chatStreamingText ? <ChatTypingIndicator events={events} /> : null}
          </div>

          <form className="chat-panel__input-row" onSubmit={handleSend}>
            <input
              className="chat-panel__input"
              type="text"
              placeholder={t("chat.inputPlaceholder")}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={chatBusy}
            />
            <button type="submit" className="chat-panel__send" disabled={chatBusy || !draft.trim()}>
              <Send size={14} strokeWidth={2} />
            </button>
          </form>
          {chatError ? <div className="chat-start-form__error">{chatError}</div> : null}
        </>
      )}
    </section>
  );
}
