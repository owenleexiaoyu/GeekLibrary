const input = document.querySelector(".library-search input");
const cards = [...document.querySelectorAll(".course-card")];
const empty = document.querySelector(".no-results");
input?.addEventListener("input", () => {
  const query = input.value.trim().toLowerCase();
  let visible = 0;
  cards.forEach(card => {
    card.hidden = Boolean(query) && !card.dataset.search.includes(query);
    if (!card.hidden) visible++;
  });
  if (empty) empty.hidden = visible !== 0;
});
