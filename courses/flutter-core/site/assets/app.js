const body = document.body, menu = document.querySelector(".menu-button"), scrim = document.querySelector(".scrim");
const progress = document.querySelector(".reading-progress"), topButton = document.querySelector(".back-to-top");
const search = document.querySelector("#lesson-search");
document.querySelectorAll(".article-content pre").forEach(block => {
  const button = document.createElement("button");
  button.className = "copy-code";
  button.type = "button";
  button.textContent = "复制";
  button.addEventListener("click", async () => {
    const value = block.querySelector("code")?.textContent || "";
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else {
        const area = document.createElement("textarea");
        area.value = value; area.style.position = "fixed"; area.style.opacity = "0";
        document.body.append(area); area.select(); document.execCommand("copy"); area.remove();
      }
      button.textContent = "已复制";
      setTimeout(() => button.textContent = "复制", 1400);
    } catch { button.textContent = "复制失败"; }
  });
  block.append(button);
});
function setMenu(open) { body.classList.toggle("sidebar-open", open); menu?.setAttribute("aria-expanded", String(open)); }
menu?.addEventListener("click", () => setMenu(!body.classList.contains("sidebar-open")));
scrim?.addEventListener("click", () => setMenu(false));
function updateScroll() {
  const available = document.documentElement.scrollHeight - innerHeight;
  progress.style.width = `${available > 0 ? Math.min(100, scrollY / available * 100) : 0}%`;
  topButton.classList.toggle("show", scrollY > 600);
}
addEventListener("scroll", updateScroll, { passive: true }); updateScroll();
topButton?.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
search?.addEventListener("input", () => {
  const q = search.value.trim().toLowerCase();
  document.querySelectorAll(".nav-lessons a").forEach(a => a.hidden = !!q && !a.dataset.title.includes(q));
  document.querySelectorAll(".nav-section").forEach(s => s.hidden = !s.querySelector(".nav-lessons a:not([hidden])"));
});
addEventListener("keydown", e => {
  if (e.key === "Escape") setMenu(false);
  if (e.key === "/" && document.activeElement !== search) { e.preventDefault(); search?.focus(); }
});
