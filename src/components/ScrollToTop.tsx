import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }

    // The target element may not be in the DOM yet (e.g. it's rendered
    // after an async data fetch), so retry for a bit before giving up.
    const id = hash.slice(1);
    let attempts = 0;
    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (attempts++ < 20) {
        requestAnimationFrame(tryScroll);
      }
    };
    tryScroll();
  }, [pathname, hash]);

  return null;
}
