# EvalDesk: Page Viewer Plan (book-flip OCR pages + annotation)

Save as `docs/PAGE_VIEWER_PLAN.md`. This file is self-contained: build only what is in it, in the order given. Everything else in `docs/PLAN.md` and `docs/UI_UX_PLAN.md` waits until these two features are proven.

Rules inherited from the main plan (apply here too): no sample data, no silent fallbacks, errors are shown with the real message and a Retry, the server is the source of truth, every task ends with proof in `docs/proof/`, and "done" needs a UI screenshot or recording, not only passing unit tests.

---

## 1. What we are building

One shared component, the **Page Viewer** (`PageBook`):

1. While OCR runs, the teacher sees the sheet as a **book**. Each time the server finishes a page, that page **flips like a book page** and the next page starts reading.
2. After OCR, the teacher can **flip through all finished pages** like a book.
3. On any finished page the teacher can **annotate** (pen, highlighter, tick, cross, text note) directly on the scan.

## 2. Scope fence

| In scope | Out of scope for now |
|---|---|
| `PageBook` component (flip during OCR, flip to browse afterwards) | New screens, reports, strictness, review changes |
| Per-page progress from the server, page image endpoint, per-page retry | Changes to the marking engine |
| Annotation layer, MVP tools, autosave | Shape recognition, AI-placed ticks, two-teacher live editing |
| | Annotated pages in the report PDF (later) |

**Prerequisite (bug B2):** sheet upload currently ends in `'sqlite3.Row' object has no attribute 'get'`. Page progress only exists when upload and OCR run, so fix this first and prove it with a screenshot of a 9-page PDF reaching `needs_review`, `evaluated`, or a specific `failed` message:

1. List every place that opens a DB connection (request handlers, background worker, startup resume, scripts, tests). All must use the one `get_db_connection()` that sets the row factory.
2. Add a test that opens each path and calls both `row['x']` and `row.get('x')`.
3. Repositories return plain dicts so the rest of the code never sees a raw row.

## 3. Fit-to-screen rules (apply to the viewer)

- The page never scrolls and the viewer has no scrollbars. Use `height: 100dvh; overflow: hidden` on the app shell.
- Size everything from one unit, `--u: min(1vw, 1.6vh)`, with `clamp()` limits (text never below 12 px). The book keeps the page's aspect ratio and scales to its box; images use `object-fit: contain`.
- Window resize, browser zoom (80% to 200%), and device rotation re-layout live without losing the current page or any unsaved ink.
- Test sizes: 1920x1080, 1536x864, 1366x768, 1280x720, 1024x768, 768x1024, 390x844.

## 4. One component, two modes

`PageBook` props: `pages [{n, status, legibility, imageUrl, error}]`, `currentIndex`, `mode` (`progress` or `browse`), `annotatable`, `onPageChange`.

Page status: `waiting`, `reading`, `done`, `failed`.

**Progress mode** (Upload section, while OCR runs)
- The current page shows a soft scan line while reading. When the server reports it `done`, it flips and the next page starts reading.
- The teacher may click an earlier page dot to look back. While the teacher is on an earlier page the book **does not jump forward**; a badge `Page 5 done` with a `Jump to latest` button appears.
- Pages after the last done page are not clickable.
- Under the book: `Page 3 of 9 read`, a progress bar, and the stage name.

**Browse mode** (after OCR, and in the Evaluate full-page popup)
- Flip with arrow keys, a click on the page edge, a swipe, or the page dots.
- Label `p. 3 / 9`; each page shows its legibility chip (for example `95% legible`; below 80% the chip turns yellow with `Hard to read`).

## 5. Flip behaviour

| Situation | Result |
|---|---|
| Page N becomes `done` | Page N turns about its left spine over 450 ms (ease-in-out) with a moving curl shadow; then page N+1 shows the scan line |
| Server reports several pages done at once | Flips play one after another, 450 ms each, never overlapping |
| Teacher presses Next or Previous | Same flip, forwards or backwards |
| A page fails | The book stops on that page: red border, the real error, `Retry this page` |
| `prefers-reduced-motion` | A 150 ms fade replaces the flip; all states stay the same |
| Last page done | The book closes to an `All pages read` state, then the status moves on |

**Structure:** a stack of page elements with decreasing `z-index`, `transform-origin: left center`, `rotateY(-180deg)` on a flipped page, front and back faces with `backface-visibility: hidden`, `perspective` on the book. Turned pages form a thin stack on the left edge; remaining pages show as a thin edge on the right, so the book looks thicker or thinner as it is read. A library such as `react-pageflip` is acceptable if it supports a controlled `currentIndex`.

**Memory:** only the current page and its neighbours load their image (about 1200 px wide). Others show a light placeholder, so a 40-page sheet stays smooth.

**Truth rule:** flips follow real server progress only. The product never runs a timer to look busy. Tests may replay a recorded progress sequence and must label it as a recording.

## 6. Annotation

Annotations are a **vector layer stored separately from the scan**, saved in page coordinates (0 to 1). The scan is never modified. They stay in place at any zoom or screen size.

**Toolbar:** one slim vertical strip on the left edge of the page box, shown when `Annotate` is on. With it off, the page is clean. On small screens it collapses to one button that opens a tool popover.

| Tool | Use | Key |
|---|---|---|
| Select | Pick, move, resize, delete | V |
| Pen | Freehand ink (mouse, finger, stylus with pressure) | P |
| Highlighter | Wide, see-through stroke | H |
| Tick | One click places a tick | T |
| Cross | One click places a cross | X |
| Text note | Click, type a comment | N |
| Eraser | Remove a stroke by touching it | E |

Also: 4 colours (red default, blue, green, black), 3 line widths, Undo and Redo (Ctrl+Z, Ctrl+Y), Show or Hide toggle, `Clear page` (asks first, undoable for 30 s), Esc leaves the tool.

**Visibility:** each text note carries a switch `For student` or `Private`. Private items show with a dashed border and are never exported or shown to students.

**Later (not in the first release):** circle, box, underline, marks stamp, links to questions, count badges on question cards, annotated pages in the report PDF.

**Interaction with the book**
- The annotation layer is **inside the page element**, so ink turns with the page during a flip and looks like ink on paper.
- While a drawing tool is active, swipes and edge clicks do not flip. Arrow keys and page dots still do. Pending changes are saved before a flip starts.
- When zoomed in, edge clicks do not flip; arrows and dots do.
- Zoom and pan: mouse drags to pan when no drawing tool is active; touch uses one finger to draw and two fingers to pan and pinch. Use `touch-action: none` on the drawing layer.

**Technical choices**

| Decision | Choice | Why |
|---|---|---|
| Rendering | SVG overlay on the page image | Crisp at any zoom, selectable objects |
| Freehand | Pointer Events + `perfect-freehand` | Smooth ink and pen pressure, small library |
| Alternative | `react-konva` or Fabric.js | Use only if SVG proves slow |
| Coordinates | Normalised 0 to 1 against the stored, auto-rotated page image | Independent of screen and image size |
| Stroke size | Simplify to at most 200 points (Ramer-Douglas-Peucker) | Small saves |
| Undo | Client history stack; server keeps soft-deleted rows | Safe undo |

**Data**

`annotations(id, sheet_id, page_no, question_key NULL, kind, data_json, color, width, visibility, created_by, created_at, updated_at, deleted_at, version)`

- `kind`: pen, highlight, tick, cross, text (later: ellipse, rect, underline, stamp).
- `id` is a client UUID so drawing works instantly; the server upserts by `id`.
- If a page is replaced or re-scanned, warn 'Annotations on this page will be archived' and archive them; never drop them silently.

**Autosave:** about 600 ms after the last change. A small status shows `Saving...` or `Saved`. If a save fails, show the error banner with Retry and keep the ink in memory; warn if the teacher tries to leave with unsaved changes. A `version` conflict reloads the page's annotations and says what changed.

## 7. Backend needed

| Change | Detail |
|---|---|
| Page progress | `GET /api/sheets/{id}` returns `pages [{n, status, legibility, error, finished_at}]` and `pages_done`. `done` is set only after that page's OCR result is saved |
| Page image | `GET /api/sheets/{id}/pages/{n}/image?w=1200` returns a resized JPEG (correct mime, auto-rotated) |
| Page retry | `POST /api/sheets/{id}/pages/{n}/retry` redoes only that page |
| Annotations load | `GET /api/sheets/{id}/annotations?page=N` |
| Annotations save | `PUT /api/sheets/{id}/annotations` batch upsert (create, update, soft-delete) with `version` checks |
| Annotations clear | `POST /api/sheets/{id}/annotations/clear?page=N` (soft-delete) |
| Polling | The UI polls the sheet once a second while it runs; server-sent events can replace this later |

All routes return data or a typed error `{code, message, stage, retryable}`; the UI shows `message` and uses `retryable` for Retry. Never show raw exceptions.

## 8. Work order (one proof per task)

| Task | What | Proof |
|---|---|---|
| P0 | Fix B2 (sheet upload crash) | Screenshot: 9-page PDF reaches a real end state; regression test |
| P1 | Page progress fields, image endpoint, per-page retry | API trace of a real multi-page sheet showing each page's `done` time in order |
| P2 | `PageBook` in browse mode: pages, arrows, dots, legibility chip, fit-to-screen | Screenshots at three window sizes |
| P3 | Flip animation with queueing and reduced motion | Screen recording; unit test of the flip queue |
| P4 | Progress mode driven by the server, no-jump rule, `Jump to latest` | Recording of a real 9-page read; recording of a page failure and Retry |
| P5 | Annotation table, API, autosave, error banner | API tests plus a forced save failure |
| P6 | Read-only annotation layer inside the page | Same ink in the same place at two window sizes |
| P7 | MVP tools, undo and redo, visibility switch | Recording; reload keeps everything |
| P8 | Flip-and-draw rules (flush on flip, no swipe while drawing, zoom rule) | Test of each rule |

Do them in order. Do not start a task while the previous one lacks proof.

## 9. Tests

- **Unit:** flip queue (given a sequence of server updates, the emitted flips are in order, one at a time); coordinate round trip (normalised to screen and back at several sizes and zoom levels); stroke simplification keeps shape.
- **Playwright (real backend, empty database):** upload a multi-page sheet and assert flips follow the reported pages; look back at page 2 while page 5 finishes and assert no jump; draw a stroke, reload, assert it is still there; resize the window and assert the stroke is on the same spot; assert no scrollbars at every test size.
- **Failure paths:** network cut during a page shows the real error and Retry resumes from that page; a failed annotation save shows the banner and loses nothing.

## 10. Acceptance

1. Upload a 9-page sheet: each page flips exactly when the server reports it done, and the status text and count match.
2. Looking at page 2 while page 5 finishes does not move the book; the badge appears and `Jump to latest` works.
3. Cutting the network during page 4 stops the book on page 4 with the real error; Retry continues from that page.
4. After OCR, the teacher browses all pages by arrows, dots, edge click and swipe.
5. Ink drawn on page 3 turns with the page, is still there after reload, and sits on the same words at a different window size.
6. A `Private` note never appears anywhere a student could see.
7. No scrollbars appear in the viewer at any test size.

## 11. Prompt to paste into the coding agent

```
Read docs/PAGE_VIEWER_PLAN.md completely. Work only on that file's scope. Do not change anything else.
First fix bug B2 (sheet upload) and prove it with a screenshot. Then do tasks P1 to P8 in order.
Flips must follow real server page progress; never use a fake timer. Annotations are a vector layer in normalised page coordinates; never modify the scan.
For each task: save proof in docs/proof/ (recording, screenshots or API trace), commit with the task id, update docs/STATUS.md.
Do not say done without the proof for that task.
```
