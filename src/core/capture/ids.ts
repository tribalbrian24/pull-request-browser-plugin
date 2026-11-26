const ID_FORMS = [/^(?:discussion_)?r(\d{5,})$/, /^(?:issue)?comment-(\d{5,})$/];

/** Numeric comment id from a comment container, when GitHub exposes one. Review ids (pullrequestreview-N) are not comment ids. */
export function idOf(el: Element): string | null {
  const data = el.getAttribute('data-comment-id')?.match(/^\d{5,}$/)?.[0];
  if (data) return data;
  const ids = [el.id, el.closest('[id^="discussion_r"]')?.id, el.querySelector('[id^="discussion_r"]')?.id];
  for (const id of ids) {
    for (const form of ID_FORMS) {
      const m = id?.match(form);
      if (m) return m[1];
    }
  }
  return null;
}

/** Stable key for a review summary: "review-<digits>" from id="pullrequestreview-<digits>". */
export function reviewIdOf(el: Element): string | null {
  const m = el.id.match(/^pullrequestreview-(\d+)$/);
  return m ? `review-${m[1]}` : null;
}
