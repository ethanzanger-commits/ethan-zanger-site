# Deploying your career site

You have the code. Here's exactly what to do next.

## 1. Put the code on GitHub
1. Go to github.com, sign up if you don't have an account.
2. Click the **+** in the top right → **New repository**.
3. Name it e.g. `ethan-zanger-site`, set it to **Public**, click **Create repository**.
4. On the new repo page, click **uploading an existing file** and drag in every file from this folder (`index.html`, `styles.css`, `script.js`, `robots.txt`, `sitemap.xml`, and the `assets` folder with your CV PDF inside it).
5. Click **Commit changes**.

## 2. Connect to Vercel
1. Go to vercel.com, sign up using **Continue with GitHub**.
2. Click **Add New… → Project**.
3. Select your `ethan-zanger-site` repo → **Import**.
4. Framework preset: choose **Other** (it's a static site, no build step needed).
5. Click **Deploy**. Vercel gives you a live URL like `ethan-zanger-site.vercel.app` within a minute.

## 3. Add your real domain (optional but recommended)
1. Buy a domain (e.g. `ethanzanger.com`) from Namecheap or Google Domains.
2. In Vercel: **Project → Settings → Domains → Add**, enter your domain.
3. Vercel shows you DNS records to add at your registrar. Add them, wait ~10–30 minutes.
4. Once live, go back into `index.html` and update every `https://ethanzanger.com` reference to your real domain, then re-upload to GitHub — Vercel redeploys automatically.

## 4. Set up PostHog
1. Go to posthog.com → sign up (free tier covers this comfortably).
2. Create a project. Copy your **Project API Key** and **API host** (e.g. `https://us.i.posthog.com`).
3. Open `script.js`, replace `YOUR_POSTHOG_KEY` with your real key.
4. Re-upload `script.js` to GitHub. Vercel redeploys.
5. Visit your live site, then check PostHog's **Activity** tab — you should see a pageview within seconds.

## 5. Set up the contact form (Formspree)
1. Go to formspree.io → sign up free.
2. Create a new form, copy the form endpoint (looks like `https://formspree.io/f/abcd1234`).
3. In `index.html`, find `action="https://formspree.io/f/INSERT-FORM-ID"` and paste your real endpoint.
4. Re-upload to GitHub. Test the form on your live site — you should get an email from Formspree.

## 6. Add LinkedIn and scheduling links
1. In `index.html`, replace `INSERT-LINKEDIN-HANDLE` with your actual LinkedIn username.
2. Set up a free Calendly account, replace `INSERT-YOUR-HANDLE` with your Calendly link.

## 7. Build your PostHog dashboard
In PostHog: **Dashboards → New Dashboard**, then add these insights (each as a separate tile):
- **Total & unique visitors** — Trends insight, event = `$pageview`, breakdown none / by day.
- **Traffic sources** — Trends insight, event = `$pageview`, breakdown by `$referring_domain`.
- **Top landing pages** — Trends insight, event = `$pageview`, breakdown by `$pathname` (only one page here, but useful once you add more).
- **CV downloads** — Trends insight, event = `CV_Download_Clicked`, breakdown by `location` property (hero vs. contact).
- **CV conversion rate** — Funnel insight: `$pageview` → `CV_Download_Clicked`.
- **Contact submissions** — Trends insight, event = `Contact_Form_Submitted`.
- **LinkedIn/email clicks** — Trends insight, events = `LinkedIn_Clicked`, `Email_Clicked`.
- **UTM campaign performance** — Trends insight, event = `$pageview`, breakdown by `utm_campaign`.
- **Geographic traffic** — Trends insight, event = `$pageview`, breakdown by `$geoip_country_name` (PostHog derives this from IP automatically — no code needed).
- **Device breakdown** — Trends insight, event = `$pageview`, breakdown by `$device_type`.

## 8. UTM link examples for your job search
Use these when sharing your site — PostHog will automatically attach these as properties on every `$pageview`:
- LinkedIn profile: `?utm_source=linkedin&utm_medium=profile&utm_campaign=job_search`
- LinkedIn post: `?utm_source=linkedin&utm_medium=post&utm_campaign=job_search`
- Recruiter email/DM: `?utm_source=email&utm_medium=direct&utm_campaign=recruiter_outreach`
- Job board application: `?utm_source=greenhouse&utm_medium=application&utm_campaign=job_search` (swap `greenhouse` for the ATS you're applying through)
- Networking intro: `?utm_source=referral&utm_medium=intro&utm_campaign=networking`

## 9. On identifying companies/organizations visiting your site
Being accurate here matters:
- **PostHog alone cannot reliably identify which company visited** — it can show country/city (from IP) and referring domain, but not "Company X employee."
- **Third-party B2B IP-enrichment tools** (e.g. Clearbit Reveal, Koala, RB2B) attempt to map an IP address to a company using ASN/network-ownership data. This works reasonably well for corporate office networks but **fails for**: VPNs, mobile networks, CGNAT, home broadband, corporate proxies, and remote workers — which will be a large share of your actual traffic.
- Verify current pricing, free-tier limits, and Israeli-company coverage directly on each provider's site before choosing one — this changes frequently.
- Label any result as "organization enrichment" or "inferred organization," never as a confirmed individual visit — that's the technically accurate framing and avoids overclaiming to yourself about who's actually looking.

## 10. Test before sharing
- [ ] CV download works and file opens correctly
- [ ] Contact form submits and you receive the email
- [ ] Site looks right on your phone
- [ ] Paste your URL into LinkedIn's post composer and confirm the preview card looks right (you'll need to create the `og-image.png` referenced in the meta tags — a simple 1200×630px graphic with your name, "Marketing • Growth • Commerce," and "Jerusalem, Israel")
- [ ] PostHog shows a live pageview when you visit the site yourself
