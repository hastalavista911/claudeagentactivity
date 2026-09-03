// dashboard/src/components/PermissionRequestCard.jsx
//
// A GENUINE approve/deny card (Option B, agreed on 2026-08-31) -- different
// from NotificationBanner (Option A), which is just a read-only mirror.
// Clicking here REALLY controls whether Claude Code proceeds/cancels
// running a tool (via hooks/request-permission.js + server/permission-store.js,
// which holds that hook open until it's answered or times out).
//
// If the timeout runs out BEFORE the user clicks anything, the server
// broadcasts "permission.resolved" with decision "ask" -- this card
// disappears automatically (see handleMessage in useAgentStore.js), and
// Claude Code falls back to its own built-in permission prompt in your
// terminal/VS Code.

import { useEffect, useState } from "react";
import { useAgentStore } from "../store/useAgentStore";
import { categorizeCommand } from "../lib/commandCategory";
import { shortenPath } from "../lib/eventToNode";
import { ShieldAlert, Check, X } from "./icons";
import { useI18n } from "../i18n/I18nContext";

function describeToolInput(toolName, toolInput) {
  if (!toolInput) return "";
  if (toolName === "Bash") return toolInput.command ?? "";
  if (toolName === "Edit" || toolName === "Write") return toolInput.file_path ? shortenPath(toolInput.file_path, 70) : "";
  return JSON.stringify(toolInput).slice(0, 120);
}

export default function PermissionRequestCard({ request }) {
  const { t } = useI18n();
  const decidePermission = useAgentStore((s) => s.decidePermission);
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!request) return;
    const timer = setInterval(() => forceTick((n) => n + 1), 500);
    return () => clearInterval(timer);
  }, [request?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!request) return null;

  const remainingMs = Math.max(request.requestedAt + request.timeoutMs - Date.now(), 0);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const detail = describeToolInput(request.toolName, request.toolInput);
  const category = request.toolName === "Bash" ? categorizeCommand(request.toolInput?.command) : null;

  return (
    <div className="permission-card" role="alert">
      <ShieldAlert size={16} className="permission-card__icon" strokeWidth={2} />
      <div className="permission-card__body">
        <div className="permission-card__title">
          {t("permission.titlePrefix")} <strong>{request.toolName}</strong>
          {category ? <span className={`category-badge category-badge--${category.key}`}>{category.label}</span> : null}
        </div>
        {detail ? (
          <div className="permission-card__detail" title={detail}>
            {detail}
          </div>
        ) : null}
      </div>
      <div className="permission-card__timeout">
        {remainingSec}s <span className="permission-card__timeout-label">{t("permission.timeoutLabel")}</span>
      </div>
      <div className="permission-card__actions">
        <button
          type="button"
          className="permission-card__button permission-card__button--deny"
          onClick={() => decidePermission(request.id, "deny")}
        >
          <X size={14} strokeWidth={2.5} /> {t("permission.deny")}
        </button>
        <button
          type="button"
          className="permission-card__button permission-card__button--allow"
          onClick={() => decidePermission(request.id, "allow")}
        >
          <Check size={14} strokeWidth={2.5} /> {t("permission.allow")}
        </button>
      </div>
    </div>
  );
}
