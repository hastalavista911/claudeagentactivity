// dashboard/src/components/Legend.jsx
//
// A key explaining the status colors & icons -- aimed at someone seeing
// this dashboard for the FIRST time (e.g. a freelance partner) without
// needing it explained to them directly. Collapsible, floating in a
// corner, CLOSED by default so it doesn't get in the way of people who
// already understand it.

import { useState } from "react";
import { Info, ChevronDown, Bot, FileText, Terminal, MessageSquare } from "./icons";
import { STATUS_COLOR } from "../lib/statusColors";
import { useI18n } from "../i18n/I18nContext";

export default function Legend() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const colorItems = [
    { color: STATUS_COLOR.running, label: t("legend.color.running") },
    { color: STATUS_COLOR.success, label: t("legend.color.success") },
    { color: STATUS_COLOR.error, label: t("legend.color.error") },
    { color: STATUS_COLOR.info, label: t("legend.color.info") },
  ];

  const iconItems = [
    { Icon: Bot, label: t("legend.icon.agent") },
    { Icon: FileText, label: t("legend.icon.file") },
    { Icon: Terminal, label: t("legend.icon.terminal") },
    { Icon: MessageSquare, label: t("legend.icon.chat") },
  ];

  return (
    <div className="legend">
      {open ? (
        <div className="legend__card">
          <div className="legend__title">{t("legend.colorTitle")}</div>
          {colorItems.map((item) => (
            <div key={item.label} className="legend__row">
              <span className="legend__dot" style={{ background: item.color }} />
              {item.label}
            </div>
          ))}
          <div className="legend__title legend__title--second">{t("legend.iconTitle")}</div>
          {iconItems.map((item) => (
            <div key={item.label} className="legend__row">
              <item.Icon size={13} strokeWidth={2} className="legend__icon" />
              {item.label}
            </div>
          ))}
        </div>
      ) : null}
      <button type="button" className="legend__toggle" onClick={() => setOpen((v) => !v)}>
        <Info size={13} strokeWidth={2} />
        {t("legend.toggle")}
        <ChevronDown size={12} strokeWidth={2} className={`legend__chevron${open ? " legend__chevron--open" : ""}`} />
      </button>
    </div>
  );
}
