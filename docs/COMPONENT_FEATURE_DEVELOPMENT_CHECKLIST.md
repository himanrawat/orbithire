# Component and Feature Development Checklist

Use this sheet when planning, implementing, and reviewing React components, hooks, Next.js routes, and supporting services. It captures the recurring issues found during the SonarLint cleanup and turns them into preventative rules.

## Quick quality gate

Before marking a feature complete, confirm:

- [ ] Component props use `Readonly<...>`.
- [ ] Page and route functions coordinate work; complex decisions live in small helpers.
- [ ] No function exceeds a cognitive complexity of 15.
- [ ] Every promise is awaited, caught, chained with a rejection handler, or intentionally ignored with `void`.
- [ ] Async helpers that do not depend on component state are declared at module scope.
- [ ] JSX does not contain nested ternaries.
- [ ] Repeated conditional UI is extracted into a component or early-return render function.
- [ ] Interactive controls use semantic HTML and have accessible names.
- [ ] Image alternative text describes content without saying “image”, “photo”, or “picture”.
- [ ] Tailwind classes do not contain conflicting utilities.
- [ ] Database requests are not awaited one-by-one inside loops.
- [ ] API request bodies are schema-validated before use.
- [ ] Regexes avoid ambiguous repetition and unnecessary alternation.
- [ ] Deprecated library APIs are not introduced.
- [ ] Typecheck, targeted lint, tests, and a production build pass.

## 1. Component structure

### Keep props read-only

```tsx
type CardProps = Readonly<{
	title: string;
	onDelete: () => Promise<void>;
}>;

export function Card({ title, onDelete }: CardProps) {
	return <button onClick={() => void onDelete()}>{title}</button>;
}
```

For short prop definitions, inline `Readonly` is acceptable:

```tsx
function EmptyState({ message }: Readonly<{ message: string }>) {
	return <p>{message}</p>;
}
```

### Keep page components declarative

A page component should primarily compose hooks and child components. Extract code when a component contains:

- Multiple API operations.
- More than two UI states such as loading, empty, error, and success.
- Repeated `&&` conditions or ternaries.
- Large tab panels or unrelated cards.
- Business rules mixed into JSX.

Preferred shape:

```tsx
export default function SettingsPage() {
	const settings = useProviderSettings();

	return (
		<SettingsLayout>
			<SettingsNavigation />
			<ProviderSettings {...settings} />
		</SettingsLayout>
	);
}
```

### Move stateless helpers outside components and hooks

If a function does not read local state, props, refs, or another closure variable, declare it at module scope.

```tsx
async function updateVerification(verified: boolean) {
	await fetch("/api/settings", {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ verified }),
	});
}
```

This avoids recreating functions on every render and prevents Sonar rule `S7721`.

## 2. Conditional rendering and complexity

### Do not nest ternaries

Avoid:

```tsx
const color = index < 3 ? "black" : index === 3 ? activeColor : "gray";
```

Prefer a named decision:

```tsx
function getStepColor(index: number, activeColor: string) {
	if (index < 3) return "black";
	if (index === 3) return activeColor;
	return "gray";
}
```

### Use early returns for loading, empty, and populated states

```tsx
function NotificationContent({ loading, items }: Readonly<Props>) {
	if (loading) return <LoadingState />;
	if (items.length === 0) return <EmptyState />;
	return <NotificationList items={items} />;
}
```

Avoid a single nested ternary spanning the entire render tree.

### Split by responsibility before reaching the complexity limit

Extract separate functions for:

- Input parsing and normalization.
- Database reads and writes.
- Status transitions.
- Fallback construction.
- Error-to-response conversion.
- Loading, empty, error, and success panels.

Route handlers should resemble an orchestration pipeline:

```ts
export async function PATCH(request: NextRequest, context: RouteContext) {
	const user = await requireUser();
	const body = await parseRequest(request);
	const update = buildUpdate(body);
	const company = await updateCompany(user.id, context.params.id, update);
	await synchronizeFollowUps(user.id, company, body);
	return NextResponse.json({ company });
}
```

## 3. Promise handling

Every promise must have an explicit lifecycle.

### Await work that affects the result

```ts
await saveSettings();
```

### Mark intentional fire-and-forget work

```tsx
onClick={() => void markAsRead([notification.id])}
```

Use `void` only when:

- The caller does not need the result.
- The async function handles its own errors.
- Continuing immediately is intentional.

### Handle background failures

```ts
void refreshData().catch((error) => {
	console.error("Background refresh failed", error);
});
```

Do not leave a bare promise expression such as `refreshData();`.

## 4. Database and network operations

### Do not await database calls inside loops

Avoid:

```ts
for (const item of items) {
	await database.from("items").insert(item);
}
```

Prefer a batch operation:

```ts
const rows = items.map(buildRow);
if (rows.length > 0) await database.from("items").insert(rows);
```

When calls cannot be batched but are independent, use controlled concurrency rather than an unbounded `Promise.all`.

### Validate API boundaries

- Parse JSON through the shared `parseJson` helper.
- Use strict Zod schemas.
- Add maximum lengths and array limits.
- Validate identifiers, URLs, email addresses, and enums.
- Never stringify unknown form or request values without checking their type.

```ts
const consentValue = form.get("consent");
const consent = typeof consentValue === "string" ? consentValue : null;
```

### Prefer current shared clients

Use repository helpers such as `createServerSupabase()` instead of introducing deprecated cookie adapters or duplicating client configuration.

## 5. Accessibility and semantic HTML

Use native elements before ARIA roles:

| Need                        | Preferred element            |
| --------------------------- | ---------------------------- |
| Group of related controls   | `<fieldset>` with `<legend>` |
| Status message              | `<output>`                   |
| Navigation                  | `<nav>`                      |
| Address/contact information | `<address>`                  |
| Expandable disclosure       | `<details>` with `<summary>` |

Additional checks:

- [ ] Icon-only buttons have an `aria-label`.
- [ ] Non-submit buttons explicitly use `type="button"`.
- [ ] Loading and status changes use appropriate live-region behavior.
- [ ] Keyboard focus exposes the same actions as pointer hover.
- [ ] Decorative images use empty alt text; meaningful images use concise descriptive alt text.
- [ ] Alt text does not repeat “image”, “photo”, or “picture”.

## 6. Tailwind and styling

### Use one utility per CSS property and state

Avoid equivalent duplicates:

```tsx
<button className="group-hover:opacity-100 [.group:hover_&]:opacity-100">
	Delete
</button>
```

Prefer:

```tsx
<div className="group">
	<button className="opacity-0 group-hover:opacity-100">Delete</button>
</div>
```

Before adding a `group-hover` utility, confirm an ancestor actually has the `group` class.

### Check conditional class composition

- Do not emit contradictory utilities such as `hidden flex`.
- Keep breakpoint and state variants intentional.
- Use `cn(...)` for optional classes.
- Extract complex class decisions into a named helper.

## 7. TypeScript and language rules

### Prefer concise safe operators

```ts
value ??= fallback;
const label = record?.metadata?.label;
```

Use `??` when empty strings, zero, or `false` are valid values. Use `||` only when all falsy values should trigger the fallback.

### Avoid redundant assignments

Use a lookup table instead of initializing a value and assigning the same value again in one switch branch:

```ts
const reminderConfig = {
	saved: { days: 2, message: "Submit your application" },
	applied: { days: 3, message: "Follow up with recruiter" },
} as const;
```

### Keep regexes linear and readable

- Replace single-character alternations with character classes: `/[\n•]/` instead of `/\n|•/`.
- Avoid nested unbounded quantifiers such as `(.*)+`.
- Prefer string operations for simple prefix, suffix, and delimiter handling.
- Add tests for long non-matching input when a regex processes user-controlled data.

## 8. Definition of done

Run the smallest relevant checks while developing, then the full quality gate before merging:

```bash
npm run typecheck
npm run lint
npm test -- --run
npm run build
git diff --check
```

For a single changed component, run targeted lint first:

```bash
npm run lint -- --file components/path/Component.tsx
```

## Pull request checklist

Copy this into the PR description:

```markdown
### Component and feature quality

- [ ] Props and configuration objects are read-only where appropriate.
- [ ] Page/route functions remain orchestration-focused and under complexity limits.
- [ ] All promises are awaited, caught, or intentionally marked with `void`.
- [ ] No async/stateless helper is unnecessarily nested.
- [ ] No nested ternaries or deeply nested conditional JSX.
- [ ] No await-in-loop database/network operations.
- [ ] Semantic HTML and accessible names are present.
- [ ] Tailwind utilities do not conflict.
- [ ] Request data is schema-validated and safely narrowed.
- [ ] No deprecated APIs, unsafe regexes, or redundant assignments were added.
- [ ] Typecheck, lint, tests, build, and whitespace checks pass.
```

## Sonar rule reference

| Rule              | Prevention                                                                      |
| ----------------- | ------------------------------------------------------------------------------- |
| `S3776`           | Split orchestration, decisions, and render states before complexity exceeds 15. |
| `S6759`           | Declare component props with `Readonly`.                                        |
| `S9383`           | Await, catch, chain, or explicitly `void` every promise.                        |
| `S9382`           | Batch operations or use controlled concurrency outside loops.                   |
| `S7721`           | Move closure-independent functions to module scope.                             |
| `S3358` / `S4624` | Replace nested ternaries and nested template literals with named helpers.       |
| `S6819` / `S6851` | Prefer semantic elements and concise alt text.                                  |
| `S1874`           | Use current shared APIs instead of deprecated signatures.                       |
| `S6035` / `S8786` | Use simple character classes and avoid backtracking-prone regexes.              |
| `S6551`           | Narrow unknown values before converting them to strings.                        |
| `S6582` / `S6606` | Prefer optional chaining and nullish assignment where semantics match.          |
| `S4165`           | Remove redundant assignments; prefer lookup tables for fixed configuration.     |
