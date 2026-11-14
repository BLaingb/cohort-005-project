# Research: third-party in-app notification services for Cadence

- Ticket: [#2 Which third-party in-app notification services fit Cadence?](https://github.com/BLaingb/cohort-005-project/issues/2) (map [#1](https://github.com/BLaingb/cohort-005-project/issues/1))
- Checked: 2026-11-14. All prices are list prices on that date, in USD.
- Scope: facts only. This note does not pick a vendor; that is a separate grilling ticket.
- Cadence context: React Router 7 in framework mode with SSR, TypeScript, Node server, React 19, SQLite. Recipients of a Notification are Students, Instructors and Platform Admins.

## Summary table

| | Knock | Novu | MagicBell | Courier | SuprSend |
|---|---|---|---|---|---|
| React feed package | `@knocklabs/react` 0.15.1 | `@novu/react` 3.19.2 | `@magicbell/react` 1.14.0 | `@trycourier/courier-react` 9.3.5 | `@suprsend/react` 1.5.0 |
| Prebuilt bell + feed | Yes | Yes (`<Inbox />`) | Yes (`Inbox`, `FloatingInbox`) | Yes (`CourierInbox`, web component) | Yes (`Inbox`) |
| Prebuilt preferences UI | No. Hooks or client calls, plus a Knock-hosted page | Yes, inside `<Inbox />` | Yes (`UserPreferences`) | Yes (preference center package) | Example UI and headless hooks |
| SSR signal (not run in Cadence) | `"use client"` banners; docs silent | Ships a server build that renders a placeholder | `"use client"` banners; docs silent | Docs say it hydrates client-side, no `ssr:false` needed | Nothing documented |
| Node/TS server SDK | `@knocklabs/node` 1.41.1 | `@novu/api` 3.19.1 | `magicbell-js` | `@trycourier/courier` 10.0.0 | `@suprsend/node-sdk` 1.15.1 |
| Billing unit | Message (one user, one channel) | Workflow run (one subscriber, any number of channels) | Delivery (one user, one channel) | Send (one template, any number of channels) | Notification triggered |
| Free tier | 10,000 messages/mo, Knock branding | 10,000 runs/mo, 5 workflows, 24 h activity log, Novu branding | 1,000 deliveries/mo, 1 project | 10,000 sends/mo | 10,000 notifications/mo, SuprSend branding |
| First paid tier | Starter $250/mo, 50k messages, then $0.005 each | Pro from $30/mo, 30k runs, then $1.20 per 1k | Startup $249/mo, 50k deliveries, then $0.0025 each | Business: $0.005 per send from the first send | Essentials $100/mo, 50k, then $2 per 1k. Batching and preferences need Business ($250/mo). |
| Self-hosting | Not offered. Enterprise has "dedicated infrastructure". | Yes. MIT core ("Community"); enterprise parts are proprietary. | Not offered | Not offered | Enterprise licence only (Kubernetes, or bring your own cloud) |
| Feed auth | RS256 JWT signed by your server; needs "enhanced security mode" turned on (off by default) | HMAC-SHA256 of `subscriberId` with the secret key; optional toggle | HS256 JWT signed by your server with the project secret; always required | JWT minted via the Courier API (`auth.issueToken`) with scopes; always required | ES256 JWT signed by your server; needs "enhanced security mode" turned on |
| Per-type preferences | Per workflow, category, channel type and channel | Per workflow and channel, plus global; "critical" workflows can't be muted | Per category and per channel | Per subscription topic (opted in, opted out or required), plus per-channel routing | Per category and per channel. Business plan or higher. |
| Batching / digest | Batch function on all plans (window up to 90 days) | Digest step; max window 1 day on Free, 7 on Pro, 30 on Team | None documented | Digests (two automations), plus a simpler digest in the Send API | Batch and Digest nodes. Business plan or higher. |
| Email later; Postmark? | Yes; Postmark supported | Yes; Postmark supported | Yes (SES, Mailgun, SendGrid, SMTP...); Postmark not listed (SMTP is) | Yes; Postmark supported | Yes; Postmark supported |

The details, with sources, follow.

## Knock

- **In-app feed and React.** `@knocklabs/react` gives `KnockProvider`, `KnockFeedProvider`, `NotificationIconButton` (the bell, showing an unread or unseen count), `NotificationFeedPopover` and `NotificationFeed`, plus headless hooks. [Feed docs](https://docs.knock.app/in-app-ui/react/feed), [React overview](https://docs.knock.app/in-app-ui/react/overview)
- **SSR.** The docs say nothing about SSR, Remix or React Router. The published bundle (`dist/esm/index.mjs`, `dist/cjs/index.js`) starts with a `"use client"` directive, which is aimed at React Server Components. It also has subpath exports for `./next` and `./tanstack`. The peer dependency is React `^17 || ^18 || ^19`. Source: npm tarball of `@knocklabs/react@0.15.1`, inspected 2026-11-14.
- **Server SDK.** `@knocklabs/node` 1.41.1 (npm, last published 2026-11-10).
- **Pricing.** Free plan: $0, up to 10,000 messages a month, Knock branding shown. Starter: $250 a month with 50,000 messages, then $0.005 each. Enterprise: custom; it can switch to pricing per notified user per month. A message is "a single message delivered to a single user on a single channel". A message that preferences block is not billed. Stored user profiles are unlimited and free. [Pricing](https://knock.app/pricing)
- **Plan gating.** "Preferences" and "Batch and digest notifications" come on every plan. Per-tenant preferences, i18n and SAML need Enterprise. Logs are kept 30 days, or 90 on Enterprise. [Pricing](https://knock.app/pricing)
- **Self-hosting.** The pricing page doesn't mention it. Enterprise lists "dedicated infrastructure".
- **Feed auth.** By default, anyone with the public key can act as any user: "Without enhanced security mode, a request with your public key can act as any user." With enhanced security mode on, the client must send a JWT that your server signs with RS256, using a private signing key, with `sub` set to the user id. The Node SDK has `signUserToken` (default expiry 3600 s) for this. Knock recommends turning the mode on before production. [Security and authentication](https://docs.knock.app/in-app-ui/security-and-authentication)
- **Preferences.** A `PreferenceSet` can hold `workflows`, `categories`, `channel_types` and `channels`. There are defaults at the environment, tenant and recipient level. Knock hosts a preference page you link to with a signed URL. Otherwise you build the UI yourself on the client SDK; there is no prebuilt React component. [Preferences overview](https://docs.knock.app/preferences/overview), [React preferences](https://docs.knock.app/in-app-ui/react/preferences)
- **Batching.** A batch step groups events per recipient, optionally by a batch key such as a Question id. The window can be fixed or sliding, and a batch stays open at most 90 days. An optional activity cap (2 to 1000) closes a batch early. Templates see the first or last 10 activities, plus `total_activities` and `total_actors`. [Batch function](https://docs.knock.app/designing-workflows/batch-function)
- **Email.** Supported, through providers that include Postmark, Resend, SES and SendGrid. [Email integrations](https://docs.knock.app/integrations/email/overview)

## Novu

- **In-app feed and React.** `@novu/react` gives `<Inbox />`, which includes the bell, the feed and a Preferences view, plus hooks. It needs React 18 or later, and supports 19. [Inbox overview](https://docs.novu.co/platform/inbox/overview)
- **SSR.** `@novu/react`'s `package.json` exports a different build depending on the environment. Browsers get the real component. Node gets `dist/esm/server/index.js`, where `Inbox` renders an empty placeholder (`ShadowRootDetector`) and hooks such as `useNovu` return `null`. So under SSR the component renders a placeholder on the server, and the real UI mounts in the browser. The Next.js quickstart uses `'use client'` and the `@novu/nextjs` package. Sources: npm tarball of `@novu/react@3.19.2`; [Next.js quickstart](https://docs.novu.co/platform/quickstart/nextjs)
- **Server SDK.** `@novu/api` 3.19.1 (npm).
- **Pricing.** Free: $0, 10,000 workflow runs a month, up to 5 workflows, 2 environments, 24-hour activity log, 3 team members. Pro: from $30 a month with 30,000+ runs, then $1.20 per 1,000, and no Novu branding. Team: from $250 a month with 250,000+ runs. [Pricing](https://novu.co/pricing)
- **Billing unit.** "A workflow run is one execution of a workflow for one subscriber." Extra channels and steps don't add runs. On the Free plan, new triggers are rejected with HTTP 402 once the cap is reached. [Billing](https://docs.novu.co/platform/account/billing)
- **Self-hosting.** Novu is open core. Everything outside `/enterprise` is MIT; the `enterprise/` packages are under a proprietary licence. [README "License"](https://github.com/novuhq/novu), `LICENSE-MIT`, `LICENSE-ENTERPRISE`. The self-hosted Community edition needs MongoDB, Redis, S3-compatible storage, and the API, Worker, WS and Dashboard services. A single-VM setup is listed at 4 vCPU / 8 GB. Some features stay cloud-only, including "Inbox features, email activity tracking, SSO, RBAC". The pricing page also lists a "Self-hosted (Enterprise)" option. [Self-hosting overview](https://docs.novu.co/community/self-hosting-novu/overview)
- **Feed auth.** HMAC is optional and turned on per environment in the In-App provider settings. The server computes `HMAC-SHA256(secretKey, subscriberId)` as lowercase hex and passes it to `<Inbox subscriberHash>`. Once HMAC is on, the Inbox won't load without the hash. No JWT option is documented. [Prepare for production](https://docs.novu.co/platform/inbox/prepare-for-production)
- **Preferences.** There are three layers: workflow defaults, subscriber global, and subscriber per workflow. The most specific layer wins. A workflow marked "critical" ignores subscriber preferences and is hidden from the preferences UI. Subscribers edit their preferences in the Inbox's Preferences view. [Preferences](https://docs.novu.co/platform/concepts/preferences)
- **Digest.** A digest step groups events per subscriber, optionally by one payload key such as `payload.postId`. The window is either a set duration or a schedule in the subscriber's time zone. The maximum window is "1 day on Free, 7 days on Pro, and 30 days on Team". [Digest step](https://docs.novu.co/platform/workflow/add-and-configure-steps/configure-action-steps/digest)
- **Email.** Supported, through providers that include Postmark, Resend, SES, SendGrid and SMTP. [Email providers](https://docs.novu.co/platform/integrations/email)

## MagicBell

- **In-app feed and React.** `@magicbell/react` gives `ContextProvider`, `Inbox`, `FloatingInbox`, `UserPreferences` ("toggle notification channels per category"), `ToastContainer` and `WebPushButton`. [React docs](https://www.magicbell.com/docs/libraries/magicbell-react)
- **SSR.** The docs say nothing about it. The package is ESM (`"type": "module"`), and 38 of its dist files start with a `"use client"` directive. Source: npm tarball of `@magicbell/react@1.14.0`.
- **Server SDK.** `magicbell-js`, imported from subpaths such as `magicbell-js/project-client`. [Browser/Node client](https://www.magicbell.com/docs/libraries/magicbell-js)
- **Pricing.** Builder: $0, 1,000 deliveries a month, 1 project. Startup: $249 a month with 50,000 deliveries, then $0.0025 each, and $99 per extra project. A delivery is one notification on one channel, so 100 in-app plus 50 email counts as 150. [Pricing](https://www.magicbell.com/pricing)
- **Self-hosting.** Not offered on the pricing page or in the docs.
- **Feed auth.** Always a user JWT. Your server signs it with HS256 using the project's Secret Key. Claims are `user_external_id` and/or `user_email`, plus `api_key`. The docs' example expires after one year. The token is passed to `ContextProvider`'s `token` prop. [User JWT](https://www.magicbell.com/docs/api/authentication/user), [Authentication](https://www.magicbell.com/docs/api/authentication)
- **Preferences.** Per channel and per category ("Category-based subscription management"). [In-app channel](https://www.magicbell.com/docs/channels/in_app), [Channels](https://www.magicbell.com/docs/channels)
- **Batching.** No digest or batching feature found in the docs. The closest is the "Delivery Planner", which picks which channels a notification goes to and in what order. [Channels](https://www.magicbell.com/docs/channels)
- **Email.** Supported through SES, Mailgun, Ping Email, SMTP and SendGrid. Postmark is not listed by name, but SMTP is. [Channels](https://www.magicbell.com/docs/channels)

## Courier

- **In-app feed and React.** `@trycourier/courier-react` v9 (React 18+) wraps Courier's web components (`@trycourier/courier-ui-inbox`, `-ui-toast`, `-ui-preferences`). Older packages such as `@trycourier/react-inbox` are deprecated. [Inbox overview](https://www.courier.com/docs/platform/inbox/inbox-overview)
- **SSR.** The Next.js guide says the inbox "renders as a custom element that only exists in the browser". It says `"use client"` is the whole requirement: "Adding `ssr: false` costs you the prerender and buys nothing." So the page prerenders on the server and the inbox hydrates in the browser. [Next.js guide](https://www.courier.com/docs/guides/add-an-inbox-to-nextjs)
- **Server SDK.** `@trycourier/courier` 10.0.0 (npm).
- **Pricing.** Developer: free, up to 10,000 sends a month. Business: $0.005 per send, pay as you go, "including the first 10,000". Enterprise: volume pricing. One template sent over email, SMS, push, Slack and in-app still counts as one send. [Pricing](https://www.courier.com/pricing)
- **Self-hosting.** Not offered.
- **Feed auth.** Always a JWT. Your server mints it with `POST /auth/issue-token` (`client.auth.issueToken` in the Node SDK) and a space-separated scope string, for example `user_id:<id> inbox:read:messages inbox:write:events`, plus `read:preferences write:preferences` for the preference center. `expires_in` is optional, and a token without it never expires. The SDKs don't refresh tokens, so your server must mint a new one before expiry. [Authenticate users](https://www.courier.com/docs/in-app/authenticate-users)
- **Preferences.** Each subscription topic defaults to `OPTED_IN`, `OPTED_OUT` or `REQUIRED`. Tenant defaults and the user's own choices layer on top, and users can pick channels per topic. Users manage them in an embedded preference center or on a Courier-hosted page. [Preferences overview](https://www.courier.com/docs/platform/preferences/preferences-overview)
- **Digest.** A digest needs two automations, one to collect events and one to release them on a schedule. Each digest keeps 10 events (first, last, highest or lowest by a sort key). The Send API has a simpler digest option. [Digest](https://www.courier.com/docs/platform/automations/digest)
- **Email.** Supported, including Postmark ("Courier sends through your Postmark account"). [Postmark integration](https://www.courier.com/docs/external-integrations/email/postmark)

## SuprSend

- **In-app feed and React.** `@suprsend/react` gives `SuprSendProvider` and `Inbox`, which can be a popover, full-screen or side sheet, plus headless hooks. `@suprsend/react-inbox` is deprecated. [React inbox](https://docs.suprsend.com/docs/inbox-react), [Drop-in feed](https://docs.suprsend.com/docs/react-in-app-feed)
- **SSR.** The docs say nothing about it. The package has no `"use client"` directives, and it depends on `@emotion/react` and `react-popper`. Source: npm tarball of `@suprsend/react@1.5.0`.
- **Server SDK.** `@suprsend/node-sdk` 1.15.1 (npm).
- **Pricing.** Free: $0, 10,000 notifications a month, in-app feed with SuprSend branding. Essentials: $100 a month with 50,000, then $2 per 1,000. Business: $250 a month with 50,000, then $5 per 1,000; this tier adds batching and digest, user preferences and i18n. Notifications that SuprSend drops, for example because the user opted out, are not billed. [Pricing](https://www.suprsend.com/pricing)
- **Self-hosting.** Enterprise licence only. You run both the control plane and the data plane on Kubernetes 1.29+, with PostgreSQL 17+, ClickHouse, two Redis instances and NATS. OpenSearch is optional. Bring-your-own-cloud is in beta. [Self-hosted introduction](https://docs.suprsend.com/docs/self-hosted/introduction)
- **Feed auth.** `SuprSendProvider` takes `publicApiKey`, `distinctId`, `userToken` and `refreshUserToken`. `userToken` is an "ES256 JWT token generated in your server-side", and it is "Mandatory when enhanced security mode is on". `refreshUserToken` lets the SDK fetch a fresh token before the current one expires. Older SDKs used HMAC of `subscriber_id`. [React SDK](https://docs.suprsend.com/docs/react-1), [Migration guide](https://docs.suprsend.com/docs/react-migration-guide)
- **Preferences.** Three levels: channel, category, and the channels picked within a category. SuprSend ships headless hooks and example UI for a preference page embedded in your app. [Embedded preference centre](https://docs.suprsend.com/docs/embedded-preference-centre)
- **Digest.** A Digest node collects events per recipient and workflow on a schedule, which can follow the recipient's time zone. It keeps 1 to 100 events (default 10) and can require a minimum trigger count. A separate Batch node exists. Both need the Business plan or higher. [Digest](https://docs.suprsend.com/docs/digest), [Pricing](https://www.suprsend.com/pricing)
- **Email.** Supported with your own email provider, which you pay directly. Postmark is supported. [Postmark](https://docs.suprsend.com/docs/postmark), [Pricing](https://www.suprsend.com/pricing)

## Other candidates seen, not evaluated

- **Engagespot** and **NotificationAPI** both turned up in searches with roughly 10k-a-month free tiers and React inbox components. Their official pricing pages could not be fetched (Engagespot returned 404), and the only sources were third-party aggregators, so they are left out of the table. Check them first if the shortlist needs widening.

## Which criteria separate the candidates most

1. **What the bill counts.** Novu (workflow run) and Courier (send) charge once per event per recipient, however many channels deliver it. Knock (message) and MagicBell (delivery) charge per channel. That only matters once email is added. MagicBell's free tier is a tenth of the others' (1k against 10k).
2. **Price of the first paid tier.** Novu Pro is $30 a month. Courier charges per send with no base fee. SuprSend Essentials is $100 a month but has no preferences or batching. Knock, MagicBell and SuprSend Business are about $250 a month.
3. **Batching and preferences on cheap plans.** Knock has both on its free plan. Novu has both, with the digest window capped by plan. Courier lists both. SuprSend needs Business ($250). MagicBell has no documented digest.
4. **Self-hosting.** Only Novu has a free, open-source (MIT core) self-hosted option. SuprSend's is Enterprise-only. Knock, MagicBell and Courier are SaaS only.
5. **Feed auth defaults.** Knock and SuprSend leave the feed open unless "enhanced security mode" is turned on. Novu leaves it open unless HMAC is turned on. MagicBell and Courier always need a JWT minted on the server. Each needs one server-side signing step in Cadence's loader.
6. **SSR.** Novu ships a server build. Courier documents server prerender with hydration in the browser. Knock and MagicBell only mark themselves `"use client"`. SuprSend says nothing. None of the five documents React Router 7 specifically, so SSR fit has to be confirmed in a hands-on trial.

## Caveats

- None of the components were rendered in Cadence or in a React Router 7 SSR build. A Node `renderToString` smoke test was written, but the session didn't have permission to run it. The SSR rows come from package metadata and vendor docs only.
- Pricing pages change often, and several comparison tables were flattened when fetched. Re-check numbers before committing to a budget.
- MagicBell's docs may not cover everything the product does; the lack of a digest is an absence in the docs, not a confirmed gap in the product.
