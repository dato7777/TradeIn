/** Places the home search box fully below the sticky header. */
export function scrollSearchIntoView() {
  const target = document.getElementById("search");
  if (!target) return;
  const header = document.querySelector("header");
  const offset = (header instanceof HTMLElement ? header.offsetHeight : 0) + 16;
  const top = window.scrollY + target.getBoundingClientRect().top - offset;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  window.setTimeout(() => {
    const input = document.getElementById("model-query");
    if (input instanceof HTMLElement) input.focus({ preventScroll: true });
  }, 500);
}
