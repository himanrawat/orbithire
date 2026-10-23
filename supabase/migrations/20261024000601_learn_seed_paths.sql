-- PRD v2, area 3: seed the 4 launch learning paths and their lessons (8–15 min each).
-- Original short lessons with attributed further reading. Idempotent: re-running updates
-- the copy in place (matched by slug), so progress rows keep pointing at the same lessons.

INSERT INTO public.paths (slug, title, summary, stage, sort) VALUES
  ('web-foundations', 'Web foundations',
   'How the web actually works, from the first request to a painted page: HTML, CSS, JavaScript, HTTP and accessibility basics.',
   'student', 1),
  ('frontend-interview', 'Frontend interview',
   'The questions, coding rounds and stories that show up in most frontend loops, with practice you can do in short sessions.',
   'early', 2),
  ('frontend-system-design', 'Frontend system design',
   'A repeatable way to design large frontend features: rendering, data, performance, reliability and a full worked case.',
   'experienced', 3),
  ('senior-to-lead', 'Senior to lead',
   'The skills that change when you start leading: design docs, reviews, mentoring, priorities, incidents and the lead-level loop.',
   'leader', 4)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, stage = EXCLUDED.stage, sort = EXCLUDED.sort;

INSERT INTO public.path_lessons (path_id, slug, title, minutes, body_md, sort)
SELECT p.id, v.slug, v.title, v.minutes, v.body_md, v.sort
FROM (VALUES

-- ==================== WEB FOUNDATIONS ====================

('web-foundations', 'how-a-page-loads', 'How a page loads', 10, $md$
When you type a URL and press Enter, the browser runs a short, predictable pipeline. Knowing it helps you debug slow pages and answer the classic "what happens when…" question.

## From URL to bytes

1. **DNS lookup.** The browser turns `example.com` into an IP address, checking its own cache, the OS and then a resolver.
2. **Connection.** It opens a TCP connection (or QUIC for HTTP/3) and, for `https`, negotiates TLS so the traffic is encrypted.
3. **Request and response.** It sends an HTTP request (`GET /`) and the server answers with a status code, headers and the HTML.

## From bytes to pixels

1. **Parse HTML into the DOM.** Parsing is incremental: the browser starts building the tree before the whole file arrives.
2. **Parse CSS into the CSSOM.** CSS is render-blocking: the browser waits for stylesheets before painting so the page doesn't flash unstyled.
3. **Run JavaScript.** A plain `<script>` pauses parsing while it downloads and runs. `defer` runs it after parsing; `async` runs it as soon as it arrives.
4. **Render tree, layout, paint, composite.** Visible nodes get their computed styles, the browser works out sizes and positions (layout), fills in pixels (paint) and stacks layers on the GPU (composite).

## Why it matters

- Put `defer` on scripts that don't need to run before first paint.
- Keep critical CSS small; large stylesheets delay the first frame.
- Changing layout properties (`width`, `top`) costs more than changing `transform` or `opacity`, which can skip layout and paint.

## Check yourself

- Why does a big synchronous script in `<head>` delay the page?
- What is the difference between `async` and `defer`?

## Further reading

- [How browsers work: populating the page (MDN)](https://developer.mozilla.org/en-US/docs/Web/Performance/How_browsers_work)
- [Critical rendering path (MDN)](https://developer.mozilla.org/en-US/docs/Web/Performance/Critical_rendering_path)
- [An overview of HTTP (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview)
$md$, 1),

('web-foundations', 'semantic-html', 'Semantic HTML that works for everyone', 10, $md$
Semantic HTML means choosing elements for what they **are**, not how they look. Browsers, screen readers and search engines all read that meaning, and you get keyboard support for free.

## Reach for the native element first

- A thing you click to do something is a `<button>`. A thing that goes somewhere is an `<a href>`.
- Group page regions with `<header>`, `<nav>`, `<main>`, `<aside>` and `<footer>`. Screen reader users jump between these landmarks.
- Use headings in order (`h1`, then `h2`…) to outline the page, not to make text big.
- Lists of things are `<ul>` or `<ol>`. Tabular data is a `<table>` with `<th>` headers.

## Forms

- Every input needs a `<label>`. Connect it with `for` and `id`, or wrap the input inside the label.
- Related controls go in a `<fieldset>` with a `<legend>` (for example, a group of radio buttons).
- Use the right `type` (`email`, `tel`, `number`, `date`) so phones show the right keyboard.

## A common mistake

A `<div onclick>` looks like a button but isn't focusable, doesn't respond to Enter or Space, and isn't announced as a button. Fixing it takes `tabindex`, `role`, and key handlers. A `<button>` does all of that already.

## Try it

Open a page you built, unplug your mouse and use only Tab, Shift+Tab, Enter and Space. Anything you can't reach or operate is a bug.

## Further reading

- [HTML elements reference (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTML/Element)
- [Learn HTML (web.dev)](https://web.dev/learn/html)
- [Semantics (MDN glossary)](https://developer.mozilla.org/en-US/docs/Glossary/Semantics)
$md$, 2),

('web-foundations', 'css-cascade-and-layout', 'The cascade, specificity and layout', 12, $md$
Most CSS confusion comes from two questions: **which rule wins**, and **how boxes are laid out**.

## Which rule wins

When several rules set the same property, the browser decides in this order:

1. **Origin and importance.** Author styles beat browser defaults; `!important` flips the order, so avoid it.
2. **Cascade layers.** Styles in a later `@layer` beat earlier layers.
3. **Specificity.** IDs beat classes, which beat element selectors. `#nav a` beats `.menu a`.
4. **Order.** If everything else ties, the last rule wins.

Keep specificity low and flat (single classes) and most conflicts disappear.

## The box model

Every element is a box: content, padding, border, margin. Set `box-sizing: border-box` globally so `width` includes padding and border; it makes sizing predictable.

## Flexbox or grid?

- **Flexbox** lays items out in one direction. Great for toolbars, nav bars and centering: `display: flex; align-items: center; gap: 1rem;`
- **Grid** lays items out in rows and columns at once. Great for page layouts and card galleries: `grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));`

Rule of thumb: if you are thinking about a row **or** a column, use flex. If you need both, use grid.

## Responsive basics

- Start with the narrow layout, then add `@media (min-width: …)` rules for wider screens.
- Prefer relative units (`rem`, `%`, `fr`) over fixed pixels for type and layout.

## Check yourself

Which wins: `.card .title` or `h2.title`? (Both have one class plus one more selector part; the element counts less than a class, so `.card .title` wins.)

## Further reading

- [Introducing the CSS cascade (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/Cascade)
- [Basic concepts of flexbox (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Basic_concepts_of_flexbox)
- [Basic concepts of grid layout (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Basic_concepts_of_grid_layout)
- [Learn CSS (web.dev)](https://web.dev/learn/css)
$md$, 3),

('web-foundations', 'javascript-essentials', 'JavaScript essentials: scope, closures and this', 12, $md$
Three ideas explain most "why does JavaScript do that?" moments.

## Scope

`let` and `const` are block-scoped: they exist only inside the nearest `{ }`. `var` is function-scoped and hoisted, which is why older code has surprising bugs. Use `const` by default and `let` when you must reassign.

## Closures

A function remembers the variables that were in scope where it was **created**, even after that outer function has returned.

```js
function counter() {
  let count = 0;
  return () => ++count;
}
const next = counter();
next(); // 1
next(); // 2
```

`count` is private: nothing outside can touch it except `next`. Closures power event handlers, React hooks and module patterns.

## this

`this` is decided by **how a function is called**, not where it is written:

- `obj.method()` sets `this` to `obj`.
- A plain call `fn()` gives `undefined` in strict mode.
- `fn.call(x)` or `fn.bind(x)` sets it explicitly.
- Arrow functions don't have their own `this`; they use the surrounding one. That's why they work well as callbacks inside class methods.

## Values and references

Objects and arrays are passed by reference. `const a = [1]; const b = a; b.push(2);` changes `a` too. Copy with spread (`[...a]`, `{ ...obj }`) for a shallow copy, or `structuredClone` for a deep one.

## Try it

Write `once(fn)`: it returns a function that calls `fn` the first time and returns the same result on every later call. (Hint: a closure holding `called` and `result`.)

## Further reading

- [Closures (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures)
- [this (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this)
- [The Modern JavaScript Tutorial (javascript.info)](https://javascript.info/)
$md$, 4),

('web-foundations', 'async-javascript', 'Async JavaScript and the event loop', 12, $md$
JavaScript runs your code on one thread. It stays responsive by handing slow work (timers, network, disk) to the browser and picking up the results later.

## The event loop in one paragraph

The **call stack** runs synchronous code to completion. When it's empty, the loop first drains the **microtask queue** (promise callbacks, `queueMicrotask`), then takes one **task** (a timer, an event, a network callback), runs it, drains microtasks again, and lets the browser render if needed.

## Predict the output

```js
console.log("A");
setTimeout(() => console.log("B"), 0);
Promise.resolve().then(() => console.log("C"));
console.log("D");
```

The answer is `A D C B`. A and D are synchronous. C is a microtask, so it runs before the timer task B, even with a 0 ms delay.

## Promises and async/await

- A promise is a placeholder for a future value: pending, then fulfilled or rejected.
- `async` functions always return a promise. `await` pauses that function (not the whole page) until the promise settles.
- Handle failures with `try { await … } catch (e) { … }` or `.catch()`. An unhandled rejection is a silent bug.

## Run things in parallel

```js
const [user, posts] = await Promise.all([getUser(id), getPosts(id)]);
```

Awaiting one after the other doubles the wait when the calls are independent. Use `Promise.allSettled` when you want every result even if some fail.

## Check yourself

Why does a long `for` loop freeze the page even though it's "just JavaScript"? (It holds the call stack, so no events or rendering can run until it finishes.)

## Further reading

- [The event loop (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Event_loop)
- [Using promises (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises)
- [Event loop: microtasks and macrotasks (javascript.info)](https://javascript.info/event-loop)
$md$, 5),

('web-foundations', 'http-fetch-basics', 'HTTP, fetch and caching basics', 10, $md$
Every frontend talks to servers over HTTP. A few basics cover most day-to-day work.

## Methods and status codes

- `GET` reads, `POST` creates, `PUT`/`PATCH` update, `DELETE` removes. `GET` should never change data.
- `2xx` success, `3xx` redirect, `4xx` the client did something wrong (`401` not signed in, `403` not allowed, `404` not found), `5xx` the server failed.

## fetch

```js
const res = await fetch("/api/notes", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: "Hello" }),
});
if (!res.ok) throw new Error(`Request failed: ${res.status}`);
const data = await res.json();
```

`fetch` only rejects on network errors. A `404` or `500` still resolves, so always check `res.ok`.

## Caching

- `Cache-Control: max-age=31536000, immutable` suits fingerprinted assets like `app.3f9a.js`.
- `Cache-Control: no-cache` means "check with the server first" (it can still use a `304 Not Modified`).
- `ETag` and `If-None-Match` let the server answer `304` with no body when nothing changed.

## CORS in one sentence

Browsers block a page from reading responses from another origin unless that server opts in with `Access-Control-Allow-Origin`. It is enforced by the browser, so fix it on the server, not in frontend code.

## Try it

Open DevTools, Network tab, reload a site you use, and find one response served from cache and one `304`.

## Further reading

- [Using the Fetch API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
- [HTTP caching (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [Cross-Origin Resource Sharing (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
$md$, 6),

('web-foundations', 'accessibility-basics', 'Accessibility basics you can apply today', 10, $md$
About one in four US adults has a disability. Accessible pages also work better on phones, in bright sunlight and for keyboard power users.

## Five checks that catch most issues

1. **Keyboard.** Every action works with Tab, Enter, Space and the arrow keys, and focus is always visible.
2. **Names.** Every control has an accessible name: a `<label>`, visible text, or `aria-label` for icon-only buttons.
3. **Contrast.** Body text needs a contrast ratio of at least 4.5:1 against its background (3:1 for large text).
4. **Images.** Meaningful images get short `alt` text that says what matters; decorative ones get `alt=""`.
5. **Structure.** One `h1`, headings in order, landmarks (`main`, `nav`), and lists for lists.

## ARIA, carefully

The first rule of ARIA is to not use it when a native element does the job. ARIA changes what assistive technology announces but adds no behavior. A `role="button"` still needs focus and key handling.

Useful, low-risk attributes:

- `aria-expanded` on a button that opens a menu or disclosure
- `aria-live="polite"` on a region that announces status updates
- `aria-describedby` to link an input to its hint or error text

## Try it

Turn on your screen reader (VoiceOver: Cmd+F5 on a Mac; Narrator: Ctrl+Win+Enter on Windows) and fill out one form you built. Note every place where what you hear doesn't match what you see.

## Further reading

- [Learn Accessibility (web.dev)](https://web.dev/learn/accessibility)
- [WCAG overview (W3C WAI)](https://www.w3.org/WAI/standards-guidelines/wcag/)
- [ARIA Authoring Practices Guide (W3C WAI)](https://www.w3.org/WAI/ARIA/apg/)
$md$, 7),

-- ==================== FRONTEND INTERVIEW ====================

('frontend-interview', 'the-loop', 'What a frontend loop looks like', 8, $md$
Most US frontend loops have the same building blocks. Knowing them lets you plan your practice instead of guessing.

## The usual rounds

- **Recruiter screen (20–30 min).** Background, motivation, salary range and logistics. Have a 60-second summary of what you do and what you want next.
- **Technical phone screen (45–60 min).** JavaScript questions or a small coding task in a shared editor.
- **Onsite or virtual loop (3–5 rounds).** Usually some mix of: UI coding, JavaScript utilities, a data structures problem, frontend system design (for mid-level and up) and a behavioral round.

## What interviewers score

- **Communication.** Do you clarify the problem, think out loud and explain trade-offs?
- **Problem solving.** Do you break the problem down and test edge cases?
- **Code quality.** Is it readable, correctly named and reasonably structured?
- **Product sense.** Do you notice loading, empty and error states, and accessibility?

## A two-week plan in short sessions

- Days 1–4: one JavaScript concept and one utility function a day.
- Days 5–9: one UI component a day (tabs, modal, autocomplete, star rating, data table).
- Days 10–12: two behavioral stories a day, out loud.
- Days 13–14: one full mock round each day, then rest.

## Further reading

- [Tech Interview Handbook: front end interviews](https://www.techinterviewhandbook.org/)
- [Front End Interview Handbook (GitHub)](https://github.com/yangshun/front-end-interview-handbook)
$md$, 1),

('frontend-interview', 'javascript-questions', 'The JavaScript questions that keep coming up', 12, $md$
These questions appear in most screens. For each, aim for a two-sentence answer plus a tiny example.

## Equality

`===` compares without type conversion; `==` converts first, so `"1" == 1` is `true` and `null == undefined` is `true`. Use `===`. Bonus: `NaN === NaN` is `false`; use `Number.isNaN`.

## Hoisting

Function declarations are hoisted whole. `var` is hoisted as `undefined`. `let` and `const` are hoisted but sit in the **temporal dead zone** until their line runs, so reading them early throws.

## Prototypes

Objects inherit through a prototype chain. `class` is syntax on top of it: methods live on `Class.prototype`, shared by every instance. Property lookup walks the chain until it finds the key or reaches `null`.

## The classic loop bug

```js
for (var i = 0; i < 3; i++) setTimeout(() => console.log(i));
// 3 3 3
```

`var` makes one shared `i`. Switch to `let` and each iteration gets its own binding, printing `0 1 2`.

## Debounce vs throttle

- **Debounce:** wait until calls stop for N ms, then run once (search-as-you-type).
- **Throttle:** run at most once every N ms (scroll and resize handlers).

## Event delegation

Attach one listener to a parent and check `event.target.closest(".item")`. It handles items added later and uses less memory than one listener per child.

## Practice

Explain each answer out loud in under 45 seconds. If you can't, that's the one to study.

## Further reading

- [Equality comparisons and sameness (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Equality_comparisons_and_sameness)
- [Inheritance and the prototype chain (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Inheritance_and_the_prototype_chain)
- [Hoisting (MDN glossary)](https://developer.mozilla.org/en-US/docs/Glossary/Hoisting)
$md$, 2),

('frontend-interview', 'utility-functions', 'Writing utility functions from scratch', 12, $md$
"Implement X without a library" rounds test closures, timing and edge cases. Practice these four until you can write them in under 10 minutes each.

## debounce

```js
function debounce(fn, wait) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}
```

Talk through: why `apply(this, args)`, and how you'd add a `cancel()` method.

## throttle

Run immediately, then ignore calls until `wait` ms have passed. Keep a `lastRun` timestamp and compare it with `Date.now()`.

## Promise.all

```js
function all(promises) {
  return new Promise((resolve, reject) => {
    const results = [];
    let done = 0;
    if (promises.length === 0) return resolve(results);
    promises.forEach((p, i) => {
      Promise.resolve(p).then((value) => {
        results[i] = value;
        if (++done === promises.length) resolve(results);
      }, reject);
    });
  });
}
```

Edge cases interviewers check: empty input, non-promise values, results kept in input order, and rejecting on the first failure.

## deepClone

Handle primitives, arrays and plain objects recursively. Mention what you're skipping (dates, maps, cycles) and that `structuredClone` exists in modern runtimes.

## How to present

1. Restate the behavior and ask about edge cases.
2. Write the simplest correct version.
3. Walk through one example by hand.
4. Then improve (options, cancel, types).

## Further reading

- [Function.prototype.apply (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply)
- [Promise.all (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all)
- [structuredClone (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone)
$md$, 3),

('frontend-interview', 'ui-coding-round', 'Building UI in a live coding round', 12, $md$
UI rounds ask you to build a component in 45–60 minutes: an autocomplete, tabs, a modal, a star rating or a sortable table. The checklist below works for all of them.

## First 5 minutes: clarify

- What data comes in, and from where (props or a fetch)?
- Which interactions matter most: mouse, keyboard, touch?
- Any constraints: no libraries, a specific framework, browser support?

## Build in layers

1. **Static markup** with the right elements (`button`, `ul`, `input` with a `label`).
2. **State**: the smallest set of values that describes the UI. Derive everything else.
3. **Interactions**: click and keyboard handlers.
4. **Edge states**: loading, empty, error, very long text.
5. **Polish**: accessibility attributes and focus management.

## Autocomplete details interviewers love

- Debounce the input so you don't fire a request per keystroke.
- Ignore stale responses: keep the latest query in a ref and drop results for older ones, or use `AbortController`.
- Arrow keys move the highlighted option; Enter selects; Escape closes.
- Use `role="combobox"`, `aria-expanded` and `aria-activedescendant`, or say you would follow the ARIA combobox pattern.

## Talk while you type

Say what you're doing and why ("I'll keep the highlighted index in state so arrow keys can move it"). Silence makes it hard for the interviewer to give you credit or hints.

## Further reading

- [Combobox pattern (W3C ARIA APG)](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- [AbortController (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [Thinking in React (react.dev)](https://react.dev/learn/thinking-in-react)
$md$, 4),

('frontend-interview', 'react-questions', 'React questions: rendering, state and effects', 12, $md$
Most React questions are really about one idea: **UI is a function of state**, and React re-runs that function when state changes.

## When does a component re-render?

When its state changes, when its parent re-renders, or when a context it reads changes. Re-rendering is usually cheap; React only updates the DOM where the output differs.

## Keys

Keys tell React which list item is which between renders. Use a stable id, not the array index, when items can be added, removed or reordered, or state ends up attached to the wrong row.

## State vs derived values

If you can compute a value from props or state, compute it during render instead of storing it. Duplicated state drifts out of sync.

## Effects

`useEffect` is for syncing with something **outside** React: a subscription, a timer, a non-React widget, a network request. Common mistakes:

- Using an effect to transform data for rendering (compute it during render instead).
- Missing dependencies, which leaves stale values in the closure.
- Forgetting cleanup, which leaks timers and listeners.

## Memoization

`useMemo`, `useCallback` and `React.memo` skip work when inputs haven't changed. Reach for them after measuring a real slowdown, not by default.

## Practice question

"A search box fetches results in an effect. Fast typing shows results for an older query. Why, and how do you fix it?" (Responses can arrive out of order; ignore stale ones with a cleanup flag or abort the previous request.)

## Further reading

- [You might not need an effect (react.dev)](https://react.dev/learn/you-might-not-need-an-effect)
- [Preserving and resetting state (react.dev)](https://react.dev/learn/preserving-and-resetting-state)
- [Rendering lists and keys (react.dev)](https://react.dev/learn/rendering-lists)
$md$, 5),

('frontend-interview', 'behavioral-stories', 'Telling your project stories', 10, $md$
Behavioral rounds decide more offers than people expect. Prepare five stories and you can answer almost any prompt.

## The five stories to have ready

1. A project you're proud of (impact)
2. A conflict or disagreement you worked through
3. A mistake or failure and what you changed
4. A time you led without authority
5. A time you learned something quickly

## Shape each one with STAR

- **Situation:** one or two sentences of context.
- **Task:** what you were responsible for.
- **Action:** what **you** did. Most of your time goes here. Say "I", not "we".
- **Result:** the outcome, with a number if you have one, and what you'd do differently.

Keep each story to about two minutes. Write bullet points, not a script, so it sounds natural.

## Frontend-specific angles

- A performance win: what you measured, what you changed, the before and after.
- An accessibility fix: who was blocked and how you found out.
- A trade-off you argued for: shipping sooner versus building it right.

## Practice

Record yourself answering "Tell me about a time you disagreed with a teammate." Listen back for time spent on context versus action.

## Further reading

- [Behavioral interviews (Tech Interview Handbook)](https://www.techinterviewhandbook.org/behavioral-interview/)
$md$, 6),

-- ==================== FRONTEND SYSTEM DESIGN ====================

('frontend-system-design', 'a-framework', 'A framework for frontend system design', 10, $md$
Frontend system design rounds ("design a news feed", "design a chat app") are open ended. A fixed sequence keeps you from rambling and makes sure you hit what's scored.

## Five steps, about 45 minutes

1. **Requirements (5–8 min).** Core features, who uses it, which devices, scale (items per page, update frequency), and non-functional needs: performance, offline, accessibility, international users.
2. **Architecture (8–10 min).** Draw the main pieces: views, a client store, a data layer, the server API. Show how data flows.
3. **Data model (5 min).** The entities and fields the client needs, and where each lives (server cache, client state, URL).
4. **API (5–8 min).** Endpoints or queries, pagination, and how real-time updates arrive (polling, SSE, WebSockets).
5. **Deep dives (rest).** Performance, rendering strategy, accessibility, error handling, security. Let the interviewer pick, or pick the riskiest part.

## Habits that score well

- State assumptions out loud and write them down.
- Offer two options and choose one with a reason ("cursor pagination, because items are inserted at the top").
- Mention what you'd measure after launch.

## Practice

Pick one product you use daily and write just the requirements and API for it in 10 minutes.

## Further reading

- [Front End Interview Handbook: system design (GitHub)](https://github.com/yangshun/front-end-interview-handbook)
- [Patterns.dev](https://www.patterns.dev/)
$md$, 1),

('frontend-system-design', 'rendering-strategies', 'Choosing a rendering strategy', 12, $md$
Where and when HTML is produced shapes speed, cost and complexity. Know the options and when each fits.

## The options

- **Client-side rendering (CSR).** The server sends a shell; JavaScript fetches data and renders. Simple to host, but the first meaningful paint waits for JS. Fits apps behind a login.
- **Server-side rendering (SSR).** The server renders HTML per request, then the client hydrates it. Fast first paint and good SEO, at the cost of server work per request.
- **Static generation (SSG).** HTML built at deploy time and served from a CDN. Fastest and cheapest, but content is only as fresh as the last build.
- **Incremental regeneration.** Static pages rebuilt in the background on a schedule or on demand. Good for large catalogs that change occasionally.
- **Streaming and server components.** Send HTML in chunks as data resolves, and keep non-interactive parts out of the client bundle.

## How to choose

Ask three questions: Does it need SEO or a fast first paint for new visitors? How fresh must the data be? How personalized is each page?

- Marketing pages and docs: static.
- Product listings: static or incremental, with client-side personalization.
- Dashboards behind a login: CSR or SSR with streaming.

## Hydration costs

SSR HTML isn't interactive until the JavaScript loads and hydrates. Keep client bundles small and hydrate only the parts that need interaction.

## Further reading

- [Rendering on the web (web.dev)](https://web.dev/articles/rendering-on-the-web)
- [Rendering patterns (Patterns.dev)](https://www.patterns.dev/)
$md$, 2),

('frontend-system-design', 'data-and-state', 'Data fetching, caching and state', 12, $md$
Most frontend bugs at scale are state bugs. Separate state by **where its source of truth lives**.

## Kinds of state

- **Server state:** data owned by the backend (posts, users). Cache it, refetch it, and treat the client copy as possibly stale.
- **Client state:** UI-only values (open menus, form drafts).
- **URL state:** filters, tabs and pagination that should survive reload and be shareable.

Libraries like TanStack Query or SWR handle server state: caching, deduping requests, background refetch and retries.

## Normalize shared entities

If the same user appears in a feed, a profile and a comment list, store users once by id and reference them. Updating one place then updates every view.

## Pagination

- **Offset** (`?page=3`): simple, but items shift when new ones are inserted at the top, causing duplicates or gaps.
- **Cursor** (`?after=abc123`): stable for feeds and real-time lists. Usually the right answer in interviews.

## Optimistic updates

Update the UI immediately, send the request, and roll back with a clear message if it fails. Good for likes and toggles; risky for payments.

## Real-time updates

- **Polling:** simplest; fine for updates every 30 seconds or more.
- **Server-Sent Events:** one-way server to client, over plain HTTP.
- **WebSockets:** two-way; needed for chat and collaborative editing.

## Further reading

- [Server-sent events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [The WebSocket API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- [TanStack Query overview](https://tanstack.com/query/latest/docs/framework/react/overview)
$md$, 3),

('frontend-system-design', 'designing-for-performance', 'Designing for performance', 12, $md$
Performance is a design decision, not a final polish step. Start from user-centered metrics and a budget.

## Core Web Vitals

- **LCP (Largest Contentful Paint):** main content visible; aim for 2.5 s or less.
- **INP (Interaction to Next Paint):** responsiveness to taps and clicks; aim for 200 ms or less.
- **CLS (Cumulative Layout Shift):** visual stability; aim for 0.1 or less.

Measure at the 75th percentile of real users, not just on your laptop.

## Levers, roughly in order of payoff

1. **Ship less JavaScript.** Split code by route, lazy-load below-the-fold widgets, and audit dependencies.
2. **Images.** Correct sizes with `srcset`, modern formats (AVIF, WebP), `loading="lazy"` below the fold, and explicit `width`/`height` to prevent layout shift.
3. **Critical path.** Inline small critical CSS, preload the LCP image and key fonts, and `defer` scripts.
4. **Long lists.** Virtualize lists with hundreds of rows so only visible rows are in the DOM.
5. **Main thread.** Break long tasks into smaller chunks and move heavy work to a Web Worker.
6. **Caching.** CDN for static assets, long cache lifetimes for fingerprinted files.

## Budgets

Set limits, for example "under 170 KB of compressed JavaScript on the critical path" and "LCP under 2.5 s on a mid-range phone", and fail the build when they're exceeded.

## Further reading

- [Web Vitals (web.dev)](https://web.dev/articles/vitals)
- [Optimize Largest Contentful Paint (web.dev)](https://web.dev/articles/optimize-lcp)
- [Learn Performance (web.dev)](https://web.dev/learn/performance)
$md$, 4),

('frontend-system-design', 'case-news-feed', 'Case study: an infinite news feed', 15, $md$
Put the framework to work on a classic prompt: "Design the frontend for a social news feed."

## Requirements

- Functional: scroll an endless feed of posts (text, images), like a post, create a post, see new posts.
- Non-functional: fast first load on phones, smooth scrolling, works with a keyboard and screen reader, handles flaky networks.

## Architecture

Feed page → `FeedList` (virtualized) → `PostCard`. A server-state cache holds pages of posts; a small client store holds the composer draft. The API layer handles auth and retries.

## Data model

`Post { id, author: UserRef, text, media[], createdAt, likeCount, likedByMe }`, `User { id, name, avatarUrl }`, normalized by id.

## API

`GET /feed?cursor=…&limit=20` returns `{ items, nextCursor }`. `POST /posts/:id/like`. New posts: poll `GET /feed/new?since=…` every 30–60 s and show a "New posts" button rather than shifting the list under the reader.

## Deep dives

- **Infinite scroll:** an `IntersectionObserver` on a sentinel near the bottom loads the next cursor. Keep a "Load more" button as a fallback for keyboard users and to reach the footer.
- **Virtualization:** render only visible posts plus a buffer; measure variable heights and keep scroll position stable when images load (reserve space with aspect ratios).
- **Optimistic likes:** flip `likedByMe` and the count immediately; roll back on error.
- **Images:** responsive `srcset`, lazy loading, blur placeholders.
- **Accessibility:** each post is an `<article>` with a heading; announce new content politely; don't steal focus.
- **Failure modes:** retry with backoff, show cached pages offline, and show an inline error row instead of a blank screen.

## Practice

Redo this design for a chat app. What changes? (Real-time transport, message ordering, unread state, scroll anchored to the bottom.)

## Further reading

- [Intersection Observer API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- [Virtualize large lists (web.dev)](https://web.dev/articles/virtualize-long-lists-react-window)
$md$, 5),

('frontend-system-design', 'reliability-and-security', 'Reliability, security and observability', 10, $md$
Senior frontend designs show how the system fails safely and how you'd know.

## Security

- **XSS** is the big one. Let the framework escape output; never insert untrusted HTML without sanitizing it; avoid `eval` and inline event handlers.
- **Content Security Policy** limits where scripts can load from and blocks inline scripts, so an injection bug is less likely to become an exploit.
- **Tokens:** prefer `HttpOnly`, `Secure`, `SameSite` cookies for sessions over storing tokens in `localStorage`, which any injected script can read.
- **CSRF:** `SameSite` cookies plus checking the `Origin` header on state-changing requests.

## Reliability

- Error boundaries around independent regions so one broken widget doesn't blank the page.
- Timeouts, retries with backoff and jitter, and clear error states for every network call.
- Feature flags to roll out gradually and switch off quickly.

## Observability

- **Real user monitoring:** collect Core Web Vitals from real sessions.
- **Error tracking:** capture unhandled errors and rejections with release versions and source maps.
- **Product signals:** a few events that tell you whether the feature works for people, not just whether it loads.

## In the interview

Spend two minutes on this even if not asked: name the top risk, how you'd prevent it and what you'd alert on.

## Further reading

- [Cross Site Scripting Prevention Cheat Sheet (OWASP)](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Content Security Policy (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [OWASP Top Ten](https://owasp.org/www-project-top-ten/)
$md$, 6),

-- ==================== SENIOR TO LEAD ====================

('senior-to-lead', 'what-changes', 'What changes when you lead', 10, $md$
Moving from senior engineer to lead (tech lead, staff engineer or manager) changes how your work is measured. Your output becomes **the team's output**.

## Three shifts

1. **From doing to multiplying.** A day where you unblocked three people can be worth more than a day of your own code.
2. **From answers to questions.** Your job is often to make sure the right problem is being solved, by the right people, in the right order.
3. **From tasks to outcomes.** You're accountable for results ("checkout errors down by half"), not just tickets closed.

## Where your time goes

A rough starting split many leads use: about a third hands-on technical work, a third reviews, design and unblocking, and a third alignment (planning, stakeholders, mentoring). Adjust to your team, but notice when you drift entirely back to coding.

## Common traps

- Taking the hardest tickets yourself, so nobody else grows and you become the bottleneck.
- Saying yes to every request, so the team's priorities blur.
- Giving feedback only when something goes wrong.

## Try it

Look at last week's calendar and commits. Mark each block as "doing", "multiplying" or "aligning". Pick one doing task to hand off next week, with context and support.

## Further reading

- [StaffEng guides (Will Larson)](https://staffeng.com/guides/)
- [Staff archetypes (StaffEng)](https://staffeng.com/guides/staff-archetypes/)
- [The Manager's Path, Camille Fournier (O'Reilly)](https://www.oreilly.com/library/view/the-managers-path/9781491973882/)
$md$, 1),

('senior-to-lead', 'design-docs', 'Writing design docs people read', 12, $md$
A design doc's job is to get the right people to agree on a direction **before** code is written, and to record why.

## A structure that works

1. **Context:** the problem and why now, in a paragraph.
2. **Goals and non-goals:** non-goals stop scope creep and endless debate.
3. **Proposal:** the design, with a diagram and the key interfaces or data shapes.
4. **Alternatives considered:** at least two, each with why you didn't choose it.
5. **Risks and open questions:** what could go wrong and what you still need to decide.
6. **Rollout:** migration, flags, metrics and how you'd roll back.

## Keep it short and readable

- Lead with a one-paragraph summary a busy director can read.
- Aim for 2–5 pages. Move detail into appendices.
- Write for the reviewer who disagrees with you; answer their objection in the doc.

## Running the review

Share it with a clear ask and deadline ("Please comment by Thursday, especially on the data migration"). Resolve comments in the doc. Record the final decision and who made it, for example in an architecture decision record.

## Try it

Take a change you're planning and write only the goals, non-goals and two alternatives. If that's hard, the problem isn't clear yet.

## Further reading

- [Design docs at Google (Malte Ubl)](https://www.industrialempathy.com/posts/design-docs-at-google/)
- [Architectural decision records](https://adr.github.io/)
$md$, 2),

('senior-to-lead', 'code-review', 'Code review that grows people', 10, $md$
As a lead, code review is one of your biggest levers for quality **and** for growing the team.

## What to look for, in order

1. **Design:** does this change belong here, and does it fit the system?
2. **Correctness:** edge cases, error handling, concurrency, security.
3. **Tests:** do they cover the behavior that matters?
4. **Readability:** names, structure, comments that explain why.
5. **Style:** leave it to linters and formatters wherever you can.

## How to comment

- Label weight: "nit:", "suggestion:", "blocking:". People shouldn't have to guess what must change.
- Ask questions when you're unsure ("What happens if this list is empty?").
- Explain the why, or link to it, so the lesson transfers to the next change.
- Call out good work specifically. It tells people what to repeat.

## Keep the flow moving

Aim to give a first response within one working day. Encourage small pull requests; big ones get shallow reviews. If a thread goes back and forth three times, talk live and write down the outcome.

## Try it

Review your last five review comments. How many explained why? How many were labeled with their weight?

## Further reading

- [Google engineering practices: code review](https://google.github.io/eng-practices/review/)
- [The standard of code review (Google)](https://google.github.io/eng-practices/review/reviewer/standard.html)
$md$, 3),

('senior-to-lead', 'mentoring-and-delegation', 'Mentoring and delegation', 10, $md$
Delegation isn't handing off work you don't want. It's choosing work that grows someone and setting them up to succeed.

## Match support to the person and the task

- **New to the task:** pair, give a worked example, check in often.
- **Some experience:** agree on the goal and the approach, then review at milestones.
- **Experienced:** agree on the outcome and constraints, then get out of the way.

The same person can be at different levels for different tasks.

## A good handoff includes

- The outcome and why it matters
- Constraints (deadline, budget, systems not to touch)
- What "done" looks like
- When you'll check in, and how to reach you if blocked

## Mentoring conversations

- Ask before advising: "What have you tried?" "What options do you see?"
- Share how you think, not just the answer.
- Agree on one growth goal per quarter and look for work that serves it.

## Feedback that lands

Be specific and timely: what you saw, the effect it had, and what you'd like next time. Do it in private for corrections and in public for praise.

## Try it

Pick one task you'd normally do yourself this week. Write a five-line handoff using the list above and give it to someone who would grow from it.

## Further reading

- [StaffEng: being a mentor and sponsor](https://staffeng.com/guides/)
- [The Manager's Path, Camille Fournier (O'Reilly)](https://www.oreilly.com/library/view/the-managers-path/9781491973882/)
$md$, 4),

('senior-to-lead', 'priorities', 'Setting priorities and saying no', 10, $md$
A team that works on everything finishes nothing. Protecting focus is part of the lead's job.

## Make priorities visible

Keep a short, ranked list of the team's current goals and share it widely. When a new request arrives, the question becomes "What does this replace?" instead of "Can you also…?"

## A quick way to rank

For each item, estimate **impact** (users or revenue affected, risk reduced) and **effort** (team weeks). Do high-impact, low-effort items first, plan the high-impact, high-effort ones, and question everything else. Treat estimates as rough and revisit them.

## Saying no without burning bridges

- Acknowledge the need: "I see why this matters for the launch."
- Explain the trade-off: "Taking it on means delaying the payments fix by two weeks."
- Offer an option: a smaller version, a later date or another owner.
- Escalate openly when two leaders want conflicting things; don't decide silently.

## Protect maintenance time

Reserve a steady slice of capacity (many teams use 15–25%) for bugs, upgrades and tech debt, so it doesn't pile up into a crisis.

## Try it

Write your team's top three goals in one sentence each. Ask two teammates to do the same without looking. Compare.

## Further reading

- [StaffEng guides](https://staffeng.com/guides/)
$md$, 5),

('senior-to-lead', 'incidents', 'Running incidents and blameless reviews', 10, $md$
How a team handles outages shapes trust in it. Leads set the tone.

## During an incident

- **Name roles.** One incident lead coordinates and makes decisions; others investigate; one person handles updates to stakeholders.
- **Mitigate first.** Roll back, flip a flag or fail over before hunting for the root cause.
- **Communicate on a schedule.** Short updates every 15–30 minutes, even if the update is "still investigating".
- **Keep a timeline** in one shared doc as you go.

## After: the blameless review

Assume people acted reasonably with the information they had. Ask how the system allowed the failure, not who caused it.

A short template:

1. Summary and user impact (who, how long, how bad)
2. Timeline
3. Contributing factors (usually several)
4. What went well
5. Action items, each with an owner and a date

## Make the action items real

Prefer fixes that make the failure impossible or quickly detectable (tests, alerts, safer defaults) over "be more careful". Track them like any other work.

## Try it

Pick a past incident and rewrite one "human error" conclusion as a system fix.

## Further reading

- [Postmortem culture: learning from failure (Google SRE book)](https://sre.google/sre-book/postmortem-culture/)
- [Managing incidents (Google SRE book)](https://sre.google/sre-book/managing-incidents/)
$md$, 6),

('senior-to-lead', 'lead-level-loop', 'Preparing for a lead-level loop', 12, $md$
Lead, staff and manager loops add rounds that test judgment and influence, not just coding.

## Rounds you'll likely see

- **System design at a higher level:** ambiguous problems, trade-offs across teams, migration plans.
- **Leadership and behavioral:** conflict, influence without authority, growing people, hard decisions.
- **Project deep dive:** walk through a large project you led, end to end.
- **Coding:** often still present, sometimes lighter.

## Prepare these stories

1. A cross-team project you drove, including how you got alignment
2. A technical decision you'd make differently now
3. A person you helped grow, with specifics
4. A time you disagreed with leadership and what happened
5. A time you cut scope or stopped a project

For each, be ready for follow-ups: "What would you do with half the time?", "Who disagreed?", "How did you measure success?"

## The project deep dive

Prepare a one-page outline: problem, constraints, your role, key decisions with alternatives, results with numbers, and what you learned. Practice explaining the architecture in five minutes, then going deep anywhere.

## Show scope honestly

Interviewers calibrate level by the size of problems you owned and the people you influenced. Be clear about what was yours and what was the team's.

## Further reading

- [StaffEng: staff-plus interviews and stories](https://staffeng.com/stories/)
- [Behavioral interviews (Tech Interview Handbook)](https://www.techinterviewhandbook.org/behavioral-interview/)
$md$, 7)

) AS v(path_slug, slug, title, minutes, body_md, sort)
JOIN public.paths p ON p.slug = v.path_slug
ON CONFLICT (path_id, slug) DO UPDATE SET
  title = EXCLUDED.title, minutes = EXCLUDED.minutes, body_md = EXCLUDED.body_md, sort = EXCLUDED.sort;
