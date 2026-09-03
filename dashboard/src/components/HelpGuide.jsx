// dashboard/src/components/HelpGuide.jsx
//
// A full documentation modal -- what this app is, what it's for, and
// detailed usage instructions, INSIDE the dashboard itself (not a link out
// to a separate file) so it stays readable even when the dashboard is
// accessed from a LAN/another device with no access to this project's
// folder. Its content lives in content/helpGuide.js, following the active
// language (I18nContext) same as the rest of the dashboard.
//
// Opened via the "?" button in the status bar (see StatusBar.jsx) -- a
// full-screen overlay, closed via the X button, clicking the dark area
// outside the card, or Escape (the same pattern as ServerSwitcher.jsx).
//
// Each section has an `icon` (a string name from content/helpGuide.js,
// looked up to the real component via ICON_MAP here) + a quick-nav chip at
// the top (click -> scroll to that section) -- both purely for ease of
// reading, no new logic.

import { useEffect, useRef } from "react";
import { HELP_GUIDE } from "../content/helpGuide";
import { X, Info, Target, Zap, Plug, LayoutGrid, ShieldAlert, MessageSquare, Wifi, HelpCircle } from "./icons";
import { useI18n } from "../i18n/I18nContext";

const ICON_MAP = { Info, Target, Zap, Plug, LayoutGrid, ShieldAlert, MessageSquare, Wifi, HelpCircle };

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function HelpGuide({ onClose }) {
  const { locale, t } = useI18n();
  const guide = HELP_GUIDE[locale] ?? HELP_GUIDE.id;
  const bodyRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function scrollToSection(id) {
    bodyRef.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="help-guide__overlay" onClick={onClose}>
      <div className="help-guide__card" onClick={(e) => e.stopPropagation()}>
        <div className="help-guide__header">
          <h2 className="help-guide__title">{guide.title}</h2>
          <button type="button" className="help-guide__close" onClick={onClose} title={t("common.close")} aria-label={t("common.close")}>
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Quick-nav chips -- this modal is long (9 sections), without
            these the only way to reach the FAQ section at the very bottom
            would be constant manual scrolling. */}
        <div className="help-guide__nav">
          {guide.sections.map((section) => {
            const Icon = ICON_MAP[section.icon];
            const id = slugify(section.heading);
            return (
              <button key={id} type="button" className="help-guide__nav-chip" title={section.heading} onClick={() => scrollToSection(id)}>
                {Icon ? <Icon size={12} strokeWidth={2} /> : null}
                {section.navLabel ?? section.heading}
              </button>
            );
          })}
        </div>

        <div className="help-guide__body" ref={bodyRef}>
          {guide.sections.map((section) => {
            const Icon = ICON_MAP[section.icon];
            const id = slugify(section.heading);
            return (
              <section key={id} id={id} className="help-guide__section">
                <h3 className="help-guide__heading">
                  <span className="help-guide__heading-icon">{Icon ? <Icon size={14} strokeWidth={2} /> : null}</span>
                  {section.heading}
                </h3>

                {section.paragraphs?.map((p, i) => (
                  <p key={i} className="help-guide__paragraph">
                    {p}
                  </p>
                ))}

                {section.steps ? (
                  <ol className="help-guide__steps">
                    {section.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                ) : null}

                {section.items ? (
                  <dl className="help-guide__items">
                    {section.items.map((item, i) => (
                      <div key={i} className="help-guide__item">
                        <dt className="help-guide__item-label">{item.label}</dt>
                        <dd className="help-guide__item-text">{item.text}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
