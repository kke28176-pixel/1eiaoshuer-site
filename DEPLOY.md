# Deploying the UZ login backend on Cloudflare

This site is now two things: the static pages you already had, and a small
serverless backend (Cloudflare Pages Functions + a D1 database) that makes
the email + code sign-in actually work. Nothing in `functions/` runs until
you deploy it — until then, the login page's API calls will fail with a
network error. That's expected, not a bug.

You'll need:
- A free Cloudflare account
- Node.js installed on your computer
- A free [Resend](https://resend.com) account (or swap in another email API —
  see "Using a different email provider" below)

Everything below is run from a terminal, inside the `uz-site` folder.

## 1. Install Wrangler (Cloudflare's CLI)

```
npm install -g wrangler
wrangler login
```
This opens a browser window to connect Wrangler to your Cloudflare account.

## 2. Create the D1 database

```
wrangler d1 create uz_db
```
This prints a `database_id`. Copy it into `wrangler.toml`, replacing
`REPLACE_WITH_YOUR_D1_DATABASE_ID`.

Then load the schema (creates the `users`, `verification_codes` and
`sessions` tables):

```
wrangler d1 execute uz_db --remote --file=./schema.sql
```

## 3. Get a Resend API key

1. Sign up at resend.com and create an API key.
2. For real use, verify a sending domain under **Domains** in Resend (so
   email comes from `login@yourdomain.com` instead of a shared test
   address). This takes a few DNS records — Resend walks you through it.
3. If you just want to test quickly first, Resend's default test setup lets
   you send to *your own* verified email address without a custom domain.

## 4. Deploy the site + functions to Cloudflare Pages

```
wrangler pages deploy . --project-name=uz-site
```
First run will ask you to confirm creating the project — say yes. This
uploads both the static files and everything in `functions/`.

## 5. Set your secrets

These are environment variables the functions read, kept out of your code:

```
wrangler pages secret put RESEND_API_KEY --project-name=uz-site
wrangler pages secret put MAIL_FROM --project-name=uz-site
```
- `RESEND_API_KEY`: the key from step 3.
- `MAIL_FROM`: e.g. `UZ <login@yourdomain.com>` — must be an address on a
  domain you verified in Resend.

## 6. Connect the D1 database in the dashboard

`wrangler pages deploy` doesn't automatically wire up the D1 binding — do
this once in the dashboard:

1. Cloudflare dashboard → **Workers & Pages** → your `uz-site` project →
   **Settings** → **Functions** → **D1 database bindings**.
2. Add a binding: variable name `DB`, database `uz_db`.
3. Redeploy (`wrangler pages deploy .` again) so the new binding takes
   effect.

## 7. Test it

Visit `https://uz-site.pages.dev` (or your custom domain), go to **Sign In**,
and try the flow with a real email address you can check. The verification
code should land in your inbox within a few seconds.

## Testing locally before deploying

```
wrangler pages dev . --d1=DB=uz_db
```
This runs the whole site (static pages + functions) on your machine at
`http://localhost:8788`, using the same D1 database. You'll still need the
`RESEND_API_KEY` / `MAIL_FROM` secrets — either export them as environment
variables before running the command, or create a `.dev.vars` file (see
Cloudflare's docs on Pages Functions local development) with:

```
RESEND_API_KEY=your_key_here
MAIL_FROM=UZ <login@yourdomain.com>
```

## Using a different email provider

Everything email-related lives in one place: `sendEmail()` in
`functions/_lib.js`. To swap Resend for SendGrid, Mailgun, or anything else,
you only need to rewrite that one function to call the other provider's API
— nothing else in the codebase needs to change.

## 8. Put it on your own domain

Two separate things need your domain: the **website** (so people visit
`yourdomain.com` instead of `uz-site.pages.dev`) and **email** (so the
verification code is actually allowed to send from an address on your
domain). Do both — email sending won't work without its own DNS records
even if the site itself is already live on your domain.

### 8a. Website: add a custom domain to Pages

**If your domain's nameservers are already pointed at Cloudflare** (check
under **DNS** in the dashboard — if Cloudflare shows your existing records,
you're already set up):
1. Dashboard → **Workers & Pages** → your `uz-site` project → **Custom
   domains** → **Set up a custom domain**.
2. Type the domain or subdomain you want (e.g. `uz.yourdomain.com` or the
   bare `yourdomain.com`). Cloudflare creates the DNS record for you
   automatically.
3. Wait a few minutes for the certificate to issue — the dashboard shows
   "Active" when it's ready.

**If your domain is registered elsewhere and not on Cloudflare DNS yet:**
1. Dashboard → **Add a site** → enter your domain. Cloudflare scans your
   existing DNS records and gives you two nameservers.
2. Go to wherever you registered the domain (GoDaddy, Namecheap, etc.) and
   replace its nameservers with the two Cloudflare gave you. This can take
   anywhere from a few minutes to a few hours to take effect.
3. Once Cloudflare shows the domain as active, follow the steps above
   ("Custom domains" on your Pages project) to attach it.

### 8b. Email: verify a sending domain in Resend

Right now `MAIL_FROM` is probably still pointing at an unverified address,
which is why real delivery doesn't work yet.

1. In Resend → **Domains** → **Add Domain**. You can use your main domain
   (`yourdomain.com`) or a subdomain dedicated to mail (`mail.yourdomain.com`
   — a common choice, keeps mail-sending reputation separate from your main
   domain).
2. Resend shows you a handful of DNS records to add — usually one MX record
   and a couple of TXT records (SPF + DKIM).
3. If your domain is on Cloudflare DNS (from step 8a), add each record
   under Dashboard → your domain → **DNS** → **Add record**, copying the
   type/name/value exactly as Resend shows them.
4. Back in Resend, click **Verify**. This can be instant or take a while
   depending on DNS propagation — Resend will tell you once it's confirmed.
5. Update the secret to use an address on your now-verified domain:
   ```
   wrangler pages secret put MAIL_FROM --project-name=uz-site
   ```
   e.g. `UZ <login@yourdomain.com>` or `UZ <login@mail.yourdomain.com>`.
6. Redeploy so the new secret is picked up:
   ```
   wrangler pages deploy . --project-name=uz-site
   ```

Send yourself a test code from the live site once both are done — that's
the real end-to-end check.

## 9. Turn on "Continue with Discord"

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
   → **New Application** → give it a name (e.g. "UZ").
2. Left sidebar → **OAuth2** → **General**. Copy the **Client ID** and
   (click "Reset Secret" if needed) the **Client Secret**.
3. Still on the OAuth2 page, under **Redirects**, add:
   ```
   https://yourdomain.com/api/auth/discord/callback
   ```
   (use whatever domain the site is actually live on — the `.pages.dev`
   one works too if you haven't attached a custom domain yet).
4. Set the two secrets:
   ```
   wrangler pages secret put DISCORD_CLIENT_ID --project-name=uz-site
   wrangler pages secret put DISCORD_CLIENT_SECRET --project-name=uz-site
   ```
5. Redeploy:
   ```
   wrangler pages deploy . --project-name=uz-site
   ```
6. On the login page, click **Continue with Discord** — it should bounce
   you to Discord, ask you to authorize, then land you back signed in.

If you already had the database running before this feature was added, also
run the two `ALTER TABLE` lines at the bottom of `schema.sql` once against
your live database:
```
wrangler d1 execute uz_db --remote --command="ALTER TABLE users ADD COLUMN discord_id TEXT;"
wrangler d1 execute uz_db --remote --command="ALTER TABLE users ADD COLUMN avatar_url TEXT;"
```

## 10. Set up the admin sign-in shortcut

There's a small "Admin sign in" link at the bottom of the login page that
signs in with a username + password directly, no email code needed —
useful for testing, or for yourself as the site owner.

```
wrangler pages secret put ADMIN_USERNAME --project-name=uz-site
wrangler pages secret put ADMIN_PASSWORD --project-name=uz-site
```
Set these to whatever you want — they don't have to match. Then redeploy.

## What's stored, and how

- **Passwords** are never stored in plain text — they're hashed with
  PBKDF2-SHA256 (100,000 iterations, random salt per user) in
  `functions/_lib.js`.
- **Sessions** are a random token in an `httpOnly` cookie, checked against
  the `sessions` table on every request. They last 30 days and can be
  revoked by signing out (which deletes the row).
- **Verification codes** expire after 10 minutes, allow at most 5 wrong
  guesses, and are deleted the moment they're used.
- The password isn't currently used to sign back in — sign-in is always
  email + code, or Discord. The password is captured and stored for future
  use (e.g. if you later want to add a "sign in with password" option), but
  nothing reads it back yet.
- **Discord accounts**: if Discord shares a verified email with us, that
  account is keyed by that real email (so it merges naturally with an
  email+code account for the same address). If not, it's keyed by a
  placeholder like `discord-123456@discord.local` — fine for sign-in, just
  not a real, emailable address.
