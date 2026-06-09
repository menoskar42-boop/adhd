import { useEffect } from "react";

// Defense-in-depth alongside robots.txt: if a crawler somehow reaches a
// personal-data screen (deep link from a chat, a misconfigured proxy,
// an aggregator that ignores robots.txt), the rendered DOM also says
// "don't index this." Cleans up on unmount so navigating back to the
// landing leaves it indexable.
export function useNoindex(): void {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow, noarchive";
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);
}
