// dashboard/src/components/ScrollToTopButton.jsx
//
// A floating "scroll to top" button -- only genuinely useful since the
// whole page started fully scrolling at the tablet/mobile breakpoint (see
// the responsive block in App.css, ".app{height:auto}" there). On desktop
// (>1024px) the page does NOT scroll at all (each panel scrolls
// internally on its own) -- so window.scrollY there is almost always 0,
// meaning this button automatically never shows up on desktop WITHOUT
// needing a separate media query, purely from the "already scrolled" condition below.

import { useEffect, useState } from "react";
import { ChevronUp } from "./icons";
import { useI18n } from "../i18n/I18nContext";

const SHOW_AFTER_PX = 300;

export default function ScrollToTopButton() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    }
    onScroll(); // initial position (e.g. after a refresh mid-scroll)
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="scroll-to-top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      title={t("scrollToTop.label")}
      aria-label={t("scrollToTop.label")}
    >
      <ChevronUp size={18} strokeWidth={2} />
    </button>
  );
}
