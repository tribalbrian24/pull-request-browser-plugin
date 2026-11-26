// Synthetic fixture modelled on GitHub's automated-review thread markup. Structure and attributes follow the real page; all text and ids are invented.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const ctxRow = (oldN: string, newN: string, text: string) =>
  `<tr><td class="diffLineNumber__GPXhoH"><code>${oldN}</code></td><td class="diffLineNumber__GPXhoH"><code>${newN}</code></td><td class="diffTextCell__t9hCd8"><code class=""><div class="diffTextInner__P-stQx">${esc(text)}</div></code></td></tr>`;

const delRow = (oldN: string, text: string) =>
  `<tr><td class="diffLineNumber__GPXhoH"><code>${oldN}</code></td><td class="diffLineNumber__GPXhoH"><code></code></td><td class="diffTextCell__t9hCd8"><code class="syntaxHighlightedDeletionLine__-8-3eE"><span class="diffTextMarker__0JPPZw">-</span><div class="diffTextInner__P-stQx">${esc(text)}</div></code></td></tr>`;

const addRow = (newN: string, text: string) =>
  `<tr><td class="diffLineNumber__GPXhoH"><code></code></td><td class="diffLineNumber__GPXhoH"><code>${newN}</code></td><td class="diffTextCell__t9hCd8"><code class="syntaxHighlightedAdditionLine__-8-3eE"><span class="diffTextMarker__0JPPZw">+</span><div class="diffTextInner__P-stQx">${esc(text)}</div></code></td></tr>`;

export const COPILOT_SUGGESTION_LINES = [
  ['38', ' ', 'export function formatPrice(cents: number): string {'],
  ['39', ' ', '  const dollars = cents / 100;'],
  ['40', '-', "  return '$' + dollars;"],
  ['40', '+', "  return '$' + dollars.toFixed(2);"],
  ['41', ' ', '}'],
  ['42', ' ', 'export const FREE = formatPrice(0);'],
  ['43', ' ', 'export const TAX_RATE = 0.08;'],
].map(([n, d, t]) => `${n} ${d}${t}`);

export const COPILOT_COMMENT_TITLE = 'Always show two decimal places';
export const COPILOT_COMMENT_MARKDOWN =
  'Prices lose trailing zeros: `formatPrice(1050)` returns "$10.5" because the number is concatenated as is. Use `toFixed(2)` so prices always show cents, for example "$10.50".';

export function copilotThread(opts: { hamburger?: boolean; resolved?: boolean; collapsed?: boolean } = {}): string {
  const { hamburger = true, resolved = false, collapsed = false } = opts;
  return `<turbo-frame id="review-thread-or-comment-id-2000001" target="_top">
<review-thread-collapsible class="review-thread-component js-comment-container js-resolvable-timeline-thread-container border rounded-2 d-block tmp-mb-3 open" data-resolved="${resolved}" data-catalyst="">
 <div class="d-flex flex-items-start p-2 rounded-top-2 bgColor-muted">
  <button data-target="review-thread-collapsible.button" data-action="click:review-thread-collapsible#toggle" aria-expanded="${!collapsed}" type="button" class="Button Button--iconOnly review-thread-chevron"><svg></svg></button>
  <span class="flex-auto flex-self-center d-flex flex-wrap flex-items-center"><a href="/acme/widgets/pull/12/files/0123456789abcdef0123456789abcdef01234567#diff-0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0" class="text-mono text-small Link--primary wb-break-all mr-2">src/utils/format.ts</a></span>
 </div>
 <div data-target="review-thread-collapsible.body">
  <div class="blob-wrapper border-bottom"><table class="diff-table tab-size js-diff-table" data-tab-size="4" data-paste-markdown-skip=""><tbody>
   <tr><td class="blob-num blob-num-addition empty-cell"></td><td data-line-number="37" class="blob-num blob-num-addition"></td><td class="blob-code blob-code-addition"><span class="blob-code-inner blob-code-marker-addition"><br></span></td></tr>
   <tr><td class="blob-num blob-num-addition empty-cell"></td><td data-line-number="38" class="blob-num blob-num-addition"></td><td class="blob-code blob-code-addition"><span class="blob-code-inner blob-code-marker-addition">export function formatPrice(cents: number): string {</span></td></tr>
   <tr><td class="blob-num blob-num-addition empty-cell"></td><td data-line-number="39" class="blob-num blob-num-addition"></td><td class="blob-code blob-code-addition"><span class="blob-code-inner blob-code-marker-addition">  const dollars = cents / 100;</span></td></tr>
   <tr><td class="blob-num blob-num-addition empty-cell"></td><td data-line-number="40" class="blob-num blob-num-addition"></td><td class="blob-code blob-code-addition"><span class="blob-code-inner blob-code-marker-addition">  return '$' + dollars;</span></td></tr>
  </tbody></table></div>
  <div class="js-inline-comments-container"><div class="js-line-comments js-suggested-changes-container js-suggested-changes-contents js-quote-selection-container" data-quote-markdown=".js-comment-body">
   <div class="js-comments-holder"><div id="discussion_r1000001">
    <react-partial partial-name="automated-review-comment" class="loaded"><div data-target="react-partial.reactRoot">
     <div class="automatedComment__HTpuBI" data-first-thread-comment="true" data-marker-navigation-comment-thread-id="2000001" data-marker-navigation-comment-id="PRRC_example" data-testid="automated-review-comment">
      <div class="automatedComment__headerContainer__dWR42D"><div data-testid="comment-header" class="ActivityHeaderContainer__sf0_ID"><div class="activityHeader__V45NcJ ActivityHeaderGridLayout__Ip6-X-">
       <h3 class="sr-only">Copilot commented <relative-time datetime="2025-01-15T12:00:00.000Z">on Jan 15, 2025</relative-time></h3>
       <div class="narrowViewportWrapper__C5cNkS CommentHeaderContentContainer__qvr9Sa" data-testid="comment-header-left-side-items">
        <div class="TitleContainer__9rC_Bh"><span data-testid="avatar-name" data-hovercard-type="copilot" class="AuthorName__V4JPE4 color-fg-default">Copilot</span><span class="ml-1 prc-Label-Label-qG-Zu" data-component="Label">AI</span></div>
       </div>
       <div data-testid="comment-header-right-side-items" class="narrowViewportWrapper__C5cNkS ActionsContainer__acCGII">
        <div class="BadgesContainer__muaZQX"><ul class="prc-LabelGroup-Container-E-ePP"><li></li><li><span class="prc-Label-Label-qG-Zu" data-variant="danger" data-component="Label">High</span></li></ul>
        <div class="ActionsButtonsContainer__ZaEPJ0">${hamburger ? `<button data-component="IconButton" type="button" aria-label="Actions for Copilot's comment" data-testid="comment-header-hamburger" aria-haspopup="true" aria-expanded="false" class="prc-Button-ButtonBase-9n-Xk CommentActionsIconButton__rdmp8b"><svg></svg></button>` : ''}</div></div>
       </div>
      </div></div></div>
      <div class="automatedComment__bodyContainer__b1nmhE"><div class="automatedComment__body__AlBj0F">
       <div class="automatedComment__content__B_OcSK">
        <div class="d-flex flex-wrap flex-items-center"><h3 class="automatedComment__title__Z_yn87">${COPILOT_COMMENT_TITLE}</h3></div>
        <span class="automatedComment__message__toDg44 markdown-body prc-Text-Text-9mHv3" data-component="Text" comment-testid="Comment message html for automated comment 1000001"><p>Prices lose trailing zeros: <code class="notranslate">formatPrice(1050)</code> returns "$10.5" because the number is concatenated as is. Use <code class="notranslate">toFixed(2)</code> so prices always show cents, for example "$10.50".</p></span>
       </div>
       <div class="d-flex flex-column color-fg-default suggestion__g-7Pdj" data-testid="automated-review-suggestion">
        <div class="d-flex flex-items-center flex-justify-between text-small color-fg-muted pt-1"><div>Suggested changeset <span data-component="CounterLabel">1</span></div></div>
        <div class="d-flex flex-column overflow-hidden">
         <div class="d-flex flex-items-center tmp-px-3 py-2 text-small gap-2 text-mono Header__1hVsNj"><button data-component="IconButton" type="button" aria-expanded="true"><svg></svg></button>src/utils/format.ts</div>
         <div class="StaticDiffPreview__-_EcEK m-0 border-bottom borderColor-default overflow-hidden automatedReviewDiff__bj31lr"><table class="unifiedDiffLines__k0eV89 borderColor-default tab-size" data-tab-size="4">
          <thead class="sr-only"><tr><th scope="col">Original file line number</th><th scope="col">Diff line number</th><th scope="col">Diff line change</th></tr></thead>
          <colgroup><col width="40"><col width="40"><col width="100%"></colgroup>
          <tbody>
           <tr><td colspan="3" class="diffHunkCell__uwimRp" valign="top"><div class="d-flex flex-row"><div class="pr-2 pb-1 hunkKebabIcon__sOjCqe" data-hunk-kebab="true"><svg></svg></div><code class="diffHunkText__DvTZFH"><div class="diffTextInner__P-stQx color-fg-muted">@@ -38,6 +38,6 @@</div></code></div></td></tr>
            ${ctxRow('38', '38', 'export function formatPrice(cents: number): string {')}
            ${ctxRow('39', '39', '  const dollars = cents / 100;')}
            ${delRow('40', "  return '$' + dollars;")}
            ${addRow('40', "  return '$' + dollars.toFixed(2);")}
            ${ctxRow('41', '41', '}')}
            ${ctxRow('42', '42', 'export const FREE = formatPrice(0);')}
            ${ctxRow('43', '43', 'export const TAX_RATE = 0.08;')}
          </tbody></table></div>
        </div>
        <div class="d-flex gap-2 flex-items-center flex-justify-end flex-wrap" data-testid="automated-review-actions"><button type="button" aria-label="Ask Copilot"><span>Ask</span></button><button type="button" data-testid="commit-suggestion-button"><span>Commit suggestion</span></button><button type="button" data-testid="add-suggestion-to-batch-button"><span>Add suggestion to batch</span></button></div>
       </div>
       <div class="d-flex flex-items-center flex-justify-between gap-2 mb-1"><div role="toolbar" aria-label="Reactions"><button type="button" aria-haspopup="true">React</button></div><div class="text-small color-fg-muted">Copilot uses AI. Check for mistakes.</div></div>
      </div></div>
     </div>
    </div></react-partial>
   </div></div>
   <copilot-comment-mention-telemetry data-catalyst=""><div class="review-thread-reply border-bottom border-top"><button type="button" class="review-thread-reply-button">Reply...</button></div></copilot-comment-mention-telemetry>
  </div>
  <div class="d-flex flex-justify-between flex-wrap tmp-m-3"><button type="submit" class="Button--secondary Button--medium Button">Resolve conversation</button></div></div>
 </div>
</review-thread-collapsible></turbo-frame>`;
}
