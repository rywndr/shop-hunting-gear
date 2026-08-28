<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# hunting-gear.net

A small storefront for an Indonesian outdoor gear shop. Mobile first, shopping
focused, and fast. Four product categories: Hunting, Fishing, Spareparts,
Hobbies.

## Copy and language

Interface copy is Bahasa Indonesia and `<html lang="id">`. That includes
`aria-label`s, `sr-only` text, and placeholders, so a screen reader stays in one
language. Category labels stay in English because the shop names them that way.

Routes use Bahasa slugs where customers see them: `/masuk`, `/daftar`.

## Stack

Next.js 16 App Router with Turbopack, React 19, Tailwind CSS v4, TypeScript in
strict mode, pnpm. The component library is a custom shadcn preset (`base-rhea`
style, olive base) built on **Base UI**, not Radix. Icons are Phosphor. Forms use
react-hook-form with zod through `@hookform/resolvers/zod`.

Add missing primitives with `pnpm dlx shadcn@latest add <component>`. Never
hand-write a file into `components/ui/`. Editing a generated file afterwards is
fine when the app needs it, for example the Bahasa `sr-only` label on the sheet
close button.

## Base UI, not Radix

- Composition uses a `render` prop, not `asChild`:
  `<SheetTrigger render={<Button />}>`. Base UI merges props into the rendered
  element, so `className` can stay on the outer component.
- State is exposed as `data-*` attributes, so styling hooks look like
  `data-[side=left]:w-3/4` and `data-ending-style:opacity-0`.
- Import Phosphor icons from `@phosphor-icons/react/ssr` in Server Components
  and from `@phosphor-icons/react` in Client Components. Use the `*Icon` names
  (`MagnifyingGlassIcon`); the bare names are deprecated.

## Layout

The home page composes six sections in order: top bar, nav bar, categories,
hero carousel, product list, footer. The hero carousel and product list still
render a `[placeholder]` line.

The shop chrome lives in `app/(shop)/layout.tsx`: the merged dark header, the
category row, and `SiteFooter`. Every storefront page sits in that route group
and renders only its own `<main>` content. Adding a shop page means adding a
folder under `app/(shop)/`, never re-composing the header.

Chrome components live in `components/layout/` and are Server Components unless
they need interaction. `mobile-nav.tsx` and `cart-sheet.tsx` are Client
Components because their drawers hold state.

The top bar and nav bar are one merged dark bar, as in the reference design. The
`<header>` in `app/(shop)/layout.tsx` owns `bg-navbar`; neither row sets its own
background, so no seam can appear between them. The top bar is a utility row
with both groups pushed right: phone first, account links hard right. The only
distinct band is the category row.

The nav bar is one wrapping flex row. `mr-auto` on the brand pushes the search
field and cart together at the right edge, matching the reference. On mobile the
search drops to its own full-width row below via `order-last`.

The brand is a deliberately large lockup: on `md` the mark stacks above the
wordmark at `h-14`, with tight `gap-1`. The nav row drops its top padding and the
brand carries `md:-mt-6`, which pulls the lockup up into the empty left half of
the utility row so it reaches the top of the header. Keep that pull smaller than
the utility row height or the logo collides with the phone number.

There is no cart page. The cart is a sheet on the right, so adding an item never
costs a navigation. Do not add a `/cart` route.

The footer is two rows. The top row is `bg-navbar` with three columns: brand plus
phone and email, then the categories, then the store info pages. The bottom row
is a thin `bg-navbar-accent/75` strip holding only the copyright line, centered.
Both footer navs are labelled with `aria-labelledby` pointing at their visible
heading, so the header's "Kategori produk" landmark label stays unique.

## Auth pages

`/masuk` and `/daftar` live in the `app/(auth)/` route group and share
`app/(auth)/layout.tsx`. That layout deliberately drops the shop chrome. No nav
bar, no category row, no cart, no three-column footer. The frame is a slim
`bg-navbar` bar holding `<BrandLogo layout="inline" />`, the form, and one legal
strip with the copyright and `INFO_LINKS`. The only job on these pages is
finishing the form, so every other exit is gone. Do not import `NavBar` or
`SiteFooter` here.

From `lg` up the layout splits in two: form on the left, `AUTH_SHOWCASE` photo on
the right. The panel is `hidden lg:block` and the image is lazy, so a phone never
downloads a 1920px decoration.

Both auth bars use the opaque `bg-navbar` tokens, not `bg-navbar-accent/75`. The
home page can afford the translucent strip because a dark row sits behind it. On
an auth page the light `bg-background` shows through and it washes out to grey.

The panel is taller than it is wide, so `object-cover` scales the 16:9 source by
its height and the drawn image ends up wider than its column. `sizes` has to
describe that drawn width, so it is `100vw` like the hero, not `50vw`. Getting
this wrong is silent: Next serves a smaller candidate and the browser upscales
it, which is what made the first pass look soft.

`BrandLogo` takes a `layout` prop. `lockup` (the default) is the big stacked
header treatment; `inline` stays one row at every width.

Auth is not wired up. `components/auth/` is UI plus validation only:
`lib/auth/schema.ts` holds the zod schemas, and both forms call
`handleSubmit(() => {})`. Field names already match better-auth's `signIn.email`
and `signUp.email` payloads, so connecting it means filling those handlers and
the Google button's `onClick`, not reshaping the forms.

`components/auth/auth-form.tsx` owns the chrome every auth form shares: the field
stack, submit button, the `atau` separator, and the Google button. Fields come
from `components/form/fields.tsx`, shared with the account pages. Auth controls
run `h-10` instead of the chrome's `h-8` so they stay thumb-sized.

Base UI draws a checkbox as a `<span role="checkbox">` with the native input
hidden and `aria-hidden`, so a `<label for>` alone does not name it. Pass
`aria-labelledby` pointing at the label's id, as the remember-me row does.

The Google button uses `components/icons/google-icon.tsx`, the four-colour brand
mark. Phosphor's `GoogleLogoIcon` is a monochrome outline and reads as a generic
glyph next to the real thing. This icon is the one place raw hex belongs, since
Google's guidelines forbid recolouring the mark.

## Form fields

`components/form/fields.tsx` holds every labelled control the app uses:
`TextField`, `PasswordField`, `TextareaField`, and `SelectField`. They all wrap
the same private `FieldFrame`, so the label, description, and error markup is
written once. Auth and account forms both import from here; do not grow a second
copy in a feature folder.

`PasswordField` holds the reveal toggle and takes a `labelAction` slot, which is
where the forgot-password link sits. Controls run `h-10`, exported as `CONTROL`.

`SelectField` is controlled, so it takes react-hook-form's `field` through a
`Controller` rather than `register`.

## Account area

`/akun` and `/history` live in `app/(shop)/` and so keep the full shop chrome.
Both are Server Components: the mock data is read on the server and handed to
client forms as props.

`components/account/account-shell.tsx` is the page frame. Its top padding is
`calc(var(--category-bar-height) + 2rem)` because the category row is out of
flow; a page with no hero behind that row has to pay the space back.

`components/account/section-tabs.tsx` is the tab bar both pages share. It takes
`tabs` as data, each entry carrying its own `panel`, so a page never hand-writes
a `TabsList`. Tabs never wrap: on a phone the row scrolls edge to edge, which is
what keeps six order statuses on one line. It carries two `!` overrides because
the primitive pins its height through `group-data-*` variants that win on
specificity otherwise.

`components/account/account-card.tsx` exports `AccountCard` and, for the
editable sections, `AccountFormCard`, which wraps the card in a `<form>` with
its own submit row. `FLAT_CARD` is the flat hairline border that matches
`AuthCard`; the order cards and empty states reuse it.

The account tabs are `ACCOUNT_TABS` in `lib/account/config.ts`: Info Dasar,
Alamat, Keamanan. The security tab reads `provider` off the account. A Google
account has no password to rotate, so the change-password form is replaced by a
note. Deleting an account goes through an `AlertDialog`.

`REGION_FIELDS` holds the four levels RajaOngkir prices a shipment from —
province, city, district, subdistrict — and the address form maps over it, so
adding a level is a config change. The options are placeholders; the real lists
arrive per parent selection once the API is wired up.

Nothing on these pages is wired up. Forms call `handleSubmit(() => {})` and the
order card actions are inert, the same shape the auth forms use.

## Orders

`lib/orders/config.ts` is the single source of truth for the order lifecycle.
`ORDER_STATUSES` carries each status's label, badge variant, and card actions,
and `ORDER_STATUS_ORDER` fixes the tab order. Add a status there and the history
tabs, the badge, and the card actions all pick it up.

The config stays plain data so a Client Component can import it. Status icons
live in `components/orders/order-status-badge.tsx` instead, next to the
`/ssr` icon imports.

Product photography does not exist yet, so an order item draws a neutral tile
rather than a stand-in someone has to find and remove later.

## Library layout

`lib/` is one folder per domain, not a flat pile: `lib/site/config.ts`,
`lib/auth/schema.ts`, `lib/account/`, `lib/orders/`, `lib/format/`. Storage,
mail, and the real auth client each get their own folder the same way. No barrel
files, import the exact path.

`lib/account/mock.ts` and `lib/orders/mock.ts` are stand-in data kept separate
from the config beside them so the seam is obvious. Every consumer takes them as
props, so both files delete cleanly once the queries land.

`lib/format/intl.ts` pins the locale to `id-ID` rather than leaving it to the
runtime, so a server render and a client render agree.

`lib/utils.ts` stays at the root because `components.json` points the shadcn
`utils` alias at `@/lib/utils`. Moving it breaks every generated component.

## Design tokens

Use tokens, never raw colors. `--radius` is `0`, so the squared look comes for
free and `rounded-*` classes are no-ops.

The store chrome has its own tokens in `app/globals.css`: `--navbar`,
`--navbar-accent`, `--navbar-border` and their foregrounds. They are declared
once for `:root, .dark` because the header stays dark in both themes, matching
the brand. Tint over them with `bg-navbar-foreground/10` rather than
`bg-white/10`, and dim text with `text-navbar-foreground/70`.

The categories row uses `bg-navbar-accent/75`. The transparency is deliberate:
the hero carousel will sit behind that row. Because that row is out of flow,
`--category-bar-height` records its height so pages without a hero can offset by
it instead of guessing.

## Navigation data

`lib/site/config.ts` is the single source of truth for the store name, logo,
phone number, email, categories, and account and info links. Add a category there
and it shows up in the desktop nav row, the mobile drawer, and the footer at once.
The phone number and email are placeholders until the business supplies the real
line and inbox.

Config arrays use `as const satisfies readonly NavLink[]` so literal types
survive while the shape is still checked.

`AUTH_ROUTES` holds the three auth slugs and `ACCOUNT_LINKS` is built from it, so
the header, the drawer, and the cross-links between `/masuk` and `/daftar` cannot
drift apart. `/lupa-sandi` has no page yet. `AUTH_SHOWCASE` holds the auth photo
with its `focus` value for `object-position`, the same shape `HERO_SLIDES` uses.

## Checks

`pnpm typecheck`, `pnpm lint`, `pnpm build`. Verify UI against a running server,
not by reading the JSX.

