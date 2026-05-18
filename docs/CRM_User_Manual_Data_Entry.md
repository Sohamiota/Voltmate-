# Voltmate CRM — User manual for data entry (Sales)

**Audience:** People who enter and check customer data every day. You do **not** need prior CRM experience.  
**Product:** Voltmate web app (Next.js frontend + API). Dates and numbers in examples follow the **English (India)** style used on screen.

---

## Table of contents

1. [What is this CRM?](#1-what-is-this-crm)
2. [Signing in and opening Sales](#2-signing-in-and-opening-sales)
3. [Who can do what (roles)](#3-who-can-do-what-roles)
4. [Create Lead Report](#4-create-lead-report)
5. [Lead Report (list, filters, preview, CSV)](#5-lead-report-list-filters-preview-csv)
6. [Create Visit Report](#6-create-visit-report)
7. [Visit Report (list, filters, CSV)](#7-visit-report-list-filters-csv)
8. [Sales Performance hub (dashboard)](#8-sales-performance-hub-dashboard)
9. [Daily Target screen](#9-daily-target-screen)
10. [Supervisor / admin tools (overview only)](#10-supervisor--admin-tools-overview-only)
11. [Troubleshooting](#11-troubleshooting)
12. [Glossary](#12-glossary)
13. [Appendix A — Dropdown values (exact labels)](#appendix-a--dropdown-values-exact-labels)
14. [Appendix B — Screenshot checklist (for trainers)](#appendix-b--screenshot-checklist-for-trainers)

---

## 1. What is this CRM?

**Voltmate’s Sales CRM** helps you store two related things:

| Concept | Plain meaning | In the app |
|--------|----------------|------------|
| **Lead** | A **person or business** that might buy a vehicle. You capture their contact details, business type, and how you reached them. | **Create Lead Report** / rows in **Lead Report** |
| **Visit** | A **single follow-up touch** on an existing lead: which salesperson went, which vehicle was discussed, what stage the deal is in, and what to do next. | **Create Visit Report** / rows in **Visit Report** |

Think of it as: **one Lead (customer record) can have many Visits over time**. The system ties visits to the lead using the **customer code** you see on the lead.

```text
Lead (customer code VL-…)
   └── Visit 1 (date, salesperson, status, next step)
   └── Visit 2 …
```

**Customer code (`Cust Code`):** A short ID the system assigns to the lead so every visit lines up with the same person.

---

## 2. Signing in and opening Sales

1. Open your Voltmate website and sign in with the username and password your **administrator** gives you.
2. After login you see the **home dashboard** with a sidebar.
3. Tap **Sales** in the sidebar. You land on **Sales Performance** — the main hub for CRM links, charts, and quick actions.

**`[Screenshot: Home sidebar with Sales highlighted]`**

At the top of Sales Performance you will see buttons similar to:

- **View Lead Report** — browse all leads.
- **View Visit Report** — browse all visits.
- **Daily Target** — opens a **weekly targets** screen (see [§9](#9-daily-target-screen); **admins only**).
- **Create New Lead Report** — add a new lead (**Admin / Sales Admin only**).
- **Create New Visit Report** — log a visit on an existing lead (**Admin / Sales Admin only**).
- **Refresh** — reload charts and lists from the server.

---

## 3. Who can do what (roles)

Exact wording in the app for restricted pages: **“Only Admin and Sales Admin can access this page.”**

| Task | Typical roles |
|------|----------------|
| View **Lead Report** | Any logged-in user who can open Sales (no extra gate on that page in the app) |
| View **Visit Report** | Same |
| **Create / edit / delete** leads and visits | **Admin**, **Sales Admin** |
| **Daily Target** (`/admin/daily-target`) | **Admin** only (others see Access Denied) |
| **Sales Analytics**, admin attendance, admin task manager | **Admin** (sidebar entries when role is admin) |

If you need create/edit access and see “Access Denied”, ask your **Admin** to give you the **Sales Admin** role (or use an admin account per your company policy).

---

## 4. Create Lead Report

**Path:** Sales hub → **Create New Lead Report**, or URL ending in `/sales/create-lead-report`.

**Purpose:** Register a **new prospect** with contact details, business classification, optional location, and optional “buying timeframe / call outcome” CRM fields.

### 4.1 Opening the form

- Use **Add Lead** (or equivalent) to open a blank form.
- To change an existing lead, use **Edit** from the table on the same page.

**`[Screenshot: Create Lead Report — table + Add / Edit]`**

### 4.2 Core fields (what to fill)

Fill fields honestly and consistently so reports stay trustworthy.

| Field | What it means | Rules / tips |
|-------|----------------|--------------|
| **Connect Date** | First meaningful contact date | Required (date picker). Defaults to today when opening a new lead. |
| **Cust. Name** | Customer or contact name | Required. |
| **Business Category** | High-level segment (e.g. Distribution & Logistics) | Pick from searchable list; then pick **Business Type** under it. |
| **Business Type** | Specific line of business | Required indirectly: you must end up with a subtype **or** only a category — the form saves **`Business Type`** if chosen, otherwise the **category** (see validation toast: business must be selected). |
| **Phone No. 1** | Primary mobile | **Required.** Exactly **10 digits**, starting with **6–9** (Indian mobile). |
| **Phone No. 2** | Alternate mobile | Optional; same digit rules if filled. |
| **Lead Type** | Digital vs non-digital source | **Digital Lead** or **Non Digital Lead**. |
| **Location (West Bengal)** | Where they operate / live | Optional. Type at least **2 characters** to search. Suggestions come from **OpenStreetMap (Nominatim)** with **West Bengal, India** bias; only results whose state is **West Bengal** appear. Click a row to paste a short address. You can still type manually. |
| **Note** | Free text | Optional general notes. |

**`Screenshot: Lead form — top section including Location`**

### 4.3 Buying timeframe and call outcome (CRM section)

This block is labeled **Buying timeframe & call outcome**. The form reminds you:

> If buying window is set (except Unknown) or outcome is busy/callback, set **Follow-up from** or **Callback time**.

See exact dropdown wording in [Appendix A](#appendix-a--dropdown-values-exact-labels).

| Field | Purpose |
|-------|---------|
| **Buying timeframe** | When they might buy (bucket). |
| **Call outcome / stall** | What happened on the call (busy, needs time, comparing, etc.). |
| **Follow-up from** | Date — earliest date you should follow up from. |
| **Earliest purchase intent** | Optional date they hinted they might buy by. |
| **They asked to call after** | Date **and time** someone asked you to call back (`datetime-local`). |
| **Customer promised they will call back** | Checkbox — tick if they committed to calling you. |
| **Timing / callback notes** | Short extra context. |

### 4.4 Rules that block Save (important)

**On the form (before sending to server):**

- **Business Category / Type** must be chosen (toast: *Please select a Business Category*).
- **Phone No. 1** required and must pass **10-digit mobile** validation.

**On the server (you’ll see an error toast if violated):**

If **Buying timeframe** is set to anything **except** “Unknown / refused to say”, you **must** fill **either**:

- **Follow-up from**, **or**
- **They asked to call after**

If **Call outcome / stall** is either:

- **Busy — customer will call us back**, or  
- **Busy — asked us to call later**

then you **must** again fill **either** **Follow-up from** **or** **They asked to call after**.

These rules match backend validation (`parseCrmDeferralBody`).

### 4.5 Saving, exporting, deleting

- **Save Lead** / **Update Lead** submits the form; success closes the modal and refreshes the list.
- **Export CSV** on this page downloads **all leads** from the server export endpoint (`/api/v1/leads/export/csv`), **not** a filtered subset from the table search.
- **Delete** (if shown) removes a lead after confirmation.

---

## 5. Lead Report (list, filters, preview, CSV)

**Path:** **View Lead Report** → `/sales/lead-report`.

### 5.1 What this screen shows

Subtitle on screen: **Complete overview of all leads recorded in the system.**

You get:

- Connection status for the backend (**Backend: Connected / Disconnected**) and **Retry**.
- **Filters** row.
- **Summary tiles:** Total Leads, Digital Leads, Non-Digital, This Month (based on **currently filtered** rows).
- A **sortable table** and **Export CSV**.
- **Preview** opens a detailed modal per lead.

**`Screenshot: Lead Report — filters + stats + table`**

### 5.2 Filters

| Control | Behaviour |
|---------|-----------|
| **Search** | Debounced (~200 ms). Matches **name**, **customer code**, **business**, or **phone**. |
| **Lead Type** | All types, Digital Lead, or Non Digital Lead. |
| **Business Category** | Searchable; filters leads whose **business** text matches the category choice. |
| **Date From / Date To** | Filters by **Connect Date** range. Rows without connect date won’t match date filters. |
| **Clear All** | Clears filter UI state. |

When any filter is active, the subtitle says **Filtered results**.

### 5.3 Table columns (quick guide)

| Column | Meaning |
|--------|---------|
| **Cust Code** | System customer ID for linking visits. |
| **Customer Name** | Lead name. |
| **Business** | Stored category/type line. |
| **Phone** | Primary + optional secondary. |
| **Location** | Text location if captured. |
| **Lead Type** | Digital vs Non Digital. |
| **Buy window** | Label from **Buying timeframe** dropdown. |
| **Callback** | Label from **Call outcome / stall**. |
| **Connect Date** | Shown in **en-IN** date format. |
| **Preview** | Opens detail modal. |

Click column headers **Customer Name**, **Business**, **Lead Type**, **Connect Date** to sort; click again to reverse order.

### 5.4 Preview modal

**View** opens:

1. **Lead Details** — full CRM deferral fields, phones, location, notes.  
2. **Record Audit** — **Added by** / **Last edited by** with timestamps.  
3. **Activity History** — timeline from the activity log API (`entity_type=lead`). Shows actions such as create/update with **who** and **when**.

**`Screenshot: Lead Report — Preview modal showing Activity History`**

### 5.5 Export CSV on Lead Report

**Important:** **Export CSV** calls the API **`GET /api/v1/leads/export/csv`** and downloads **the full export the server returns**.  
It does **not** automatically match your **on-screen filters**. To analyze a filtered subset, export everything and filter in Excel, or ask your admin for a report change.

Filename pattern: `lead-report_YYYY-MM-DD.csv`.

---

## 6. Create Visit Report

**Path:** `/sales/create-visit-report`.

**Purpose:** Record **one visit** against an **existing lead**: salesperson, vehicle, pipeline **status**, **next action**, dates, phones, notes, optional **Lost – Not Interested** reason, **hot lead**, optional **GPS ping**, and the same CRM deferral fields as leads.

### 6.1 Before you start

- You must **select the lead** this visit belongs to (search by customer code, name, etc., as implemented on screen).
- Pick **Salesperson** from the staff list loaded from the server.
- Pick **Vehicle** from the long searchable list — always choose the **exact variant** string (battery, cabin, etc.) so inventory reporting stays accurate.

**`Screenshot: Create Visit Report — lead search + vehicle select`**

### 6.2 Main visit fields

| Field | Meaning |
|-------|---------|
| **Connect Date** | Carried from lead / editable per business rules |
| **Visit Date** | When this interaction happened |
| **Status** | Current pipeline stage **for this visit** |
| **Next action** | What should happen next (uses same option list as status) |
| **Next action date** | When that next step is due |
| **Phone No. 1 / 2** | Same **10-digit** rules as leads |
| **Note** | Conversation summary |

**Status vs Next action:**  
**Status** = “where the customer sits **now** in the funnel.” **Next action** = “what we **plan to do next**.” They can match or differ depending on your process.

Visit **status** dropdown in the form uses the list under **Appendix A — Visit status / Next action**.

### 6.3 Lost – Not Interested

When **Status** is **Lost – Not Interested** (Unicode en dash as shown in app):

1. Choose a **reason** from the dropdown (budget, timing, product fit, etc.).  
2. If reason is **Other**, you **must** type an explanation in **Lost reason notes**.

The form shows errors if these are missing.

### 6.4 Hot lead

**Hot lead** marks this customer as high priority on the **lead** record (`is_hot_lead`). Use it consistently so managers can filter hot opportunities.

### 6.5 Capture GPS after save

Checkbox text (paraphrased from UI): after save, **capture my GPS** for this visit — the **browser** will ask for location permission.

- Recording uses the device/browser GPS (same permission idea as attendance).
- If permission is denied, GPS fails, or network fails, you may still see: **Visit saved, but location was not recorded (permission, GPS, or network).**

Only enable when appropriate for your workplace policy.

### 6.6 CRM deferral fields on visits

The visit form repeats **Buying timeframe**, **Call outcome / stall**, **Follow-up from**, **Earliest purchase intent**, **They asked to call after**, **Customer promised…**, **Timing / callback notes** — same meaning as on leads.

The **same server rules** apply: buying timeframe (except Unknown) **or** busy/callback outcomes require **Follow-up from** OR **They asked to call after**.

### 6.7 Export on Create Visit page

The **Export CSV** button on **Create Visit Report** uses **`/api/v1/visits/export/csv`** — a **full server export**, **not** tied to the search box on that page.

---

## 7. Visit Report (list, filters, CSV)

**Path:** `/sales/visit-report`.

### 7.1 Pipeline vs “Show lost / closed”

By default the filter chips focus on **active pipeline** statuses (New Lead through Booking Date Confirmed **including** intermediate stages such as Attempted Contact, Connected, etc., as listed in code).

Turn **Show lost / closed** **on** to include endings such as:

- Lost variants (Price Issue, Competitor, No Response, Not Interested)
- Loan Processing, Booking Amount Received, Order Confirmed, Delivery Scheduled, Delivered (Closed – Won)

**Older visits** may still show statuses from legacy data even if they are not in the **create** dropdown — keep filters aligned with what your managers expect.

**`Screenshot: Visit Report — toggle Show lost / closed`**

### 7.2 Filters and sorting

| Filter | Behaviour |
|--------|-----------|
| **Search** | Name, customer code, salesperson, vehicle, **lead location** |
| **Status** | Exact match on pipeline / extended statuses |
| **Hot lead** | All / Hot only / Not hot |
| **Visit date From / To** | Rows **without** visit date are excluded when dates set |

Sort by clicking column headers (implementation mirrors Lead Report).

### 7.3 Summary tiles

Based on **currently filtered** visits:

- **Total** — row count.
- **Connected** — statuses whose text contains **“connected”** (case-insensitive substring).
- **Test drives / demos** — statuses containing **“demo”**.
- **Won** — statuses containing **“won”**.

These are simple keyword summaries; always verify critical numbers using filters or CSV.

### 7.4 Export CSV (Visit Report page)

This export builds the file **from the rows you currently see** (after filters and sorting).

- If **no rows**, you see **No rows to export for the current filters.**
- If search / status / hot / date filters are active, the filename adds **`_filtered`** before `.csv`.

Column order matches the CRM-wide export schema (IDs, cust_code, deferral fields, `visit_location_captured_at`, audit names, timestamps — see code constant `VISIT_REPORT_CSV_COLUMNS`).

---

## 8. Sales Performance hub (dashboard)

**Path:** Sidebar → **Sales**.

Shows KPI cards (**Total Leads**, **Total Visits**, conversion-style insights), charts (visits per salesperson, lead mix), and **recent** lead/visit snippets.

Use **Refresh** if data looks stale after colleagues entered records.

**`Screenshot: Sales Performance — KPI cards + charts`**

---

## 9. Daily Target screen

Linked from Sales hub as **Daily Target** (`/admin/daily-target`).

**Who can open it:** **Admin only.** Others receive **Access Denied**.

**What it does (conceptually):**

- Loads visits from **`/api/v1/visits/report`**.
- Builds **weekly** buckets (Monday–Sunday) based on **`next_action_date`** falling in that week.
- Excludes rows that look **Lost** (status or next action starting with “lost”).
- Lets admins drill into salesperson cards, days of week, pending vs updated visits.

Use this chapter only if **you are an admin** managing weekly follow-up discipline.

**`Screenshot: Daily Target — week navigator + salesperson cards`**

---

## 10. Supervisor / admin tools (overview only)

These screens exist for oversight — details intentionally brief here:

| Area | Path | Purpose |
|------|------|---------|
| **Sales Analytics** | `/admin/sales-analytics` | Deeper charts / funnel views (**admin** sidebar). |
| **Overdue visits** | `/admin/overdue-visits` | Highlights visits whose **next action date** is behind. |
| **Sales location / map** | `/admin/sales-location` | Geographic views of activity (where implemented). |

Ask your supervisor **which** of these your team uses before training operators.

---

## 11. Troubleshooting

| Problem | What to check |
|---------|----------------|
| **Save failed** with message about **follow_up** / **callback** | Re-read [§4.4](#44-rules-that-block-save-important) and [§6.6](#66-crm-deferral-fields-on-visits). Add **Follow-up from** OR **They asked to call after**. |
| **Phone validation error** | Must be **10 digits**, starting **6–9**. Remove spaces/country code in the mobile fields. |
| **Lost – Not Interested** won’t save | Select a **reason**; if **Other**, fill **notes**. |
| **GPS not recorded** | Browser permission, poor GPS signal, or connection — visit may still be saved; message explains partial success. |
| **Lead CSV doesn’t match filters** | Expected — Lead Report CSV is **full server export**. Use spreadsheet filters or request a feature change. |
| **Visit CSV empty** | Clear overly narrow filters or widen dates on **Visit Report**. |
| **Access Denied** on Create pages | Need **Admin** or **Sales Admin**. Daily Target needs **Admin**. |
| **Location suggestions empty** | Type more letters; confirm area is **West Bengal**; internet required for map search. |

---

## 12. Glossary

| Term | Meaning |
|------|---------|
| **Lead** | Prospect master record (name, phones, business, lead type, CRM deferral fields). |
| **Visit** | One logged interaction tied to a lead (salesperson, vehicle, status, next steps). |
| **Customer code (`cust_code`)** | Stable ID linking visits to the correct lead. |
| **Pipeline / Status** | Stage of the sale for that visit (Demo, Negotiation, Lost, etc.). |
| **Next action** | Planned next stage or activity. |
| **Buying timeframe** | Bucket estimating when the customer might purchase. |
| **Call outcome / stall** | Why conversation paused or how customer behaved on call. |
| **Deferral fields** | Collective name for timeframe + outcome + follow-up/callback fields validated together. |
| **Hot lead** | Priority flag on the customer for sales focus. |
| **Activity History** | Audit timeline on lead preview from server logs. |

---

## Appendix A — Dropdown values (exact labels)

### A.1 Buying timeframe (`Buying timeframe`)

| Stored value | Label shown |
|--------------|-------------|
| *(empty)* | — Not specified — |
| `within_1_month` | Within 1 month |
| `within_2_months` | Within 2 months |
| `within_3_months` | Within 3 months |
| `beyond_3_months` | Beyond 3 months |
| `unknown` | Unknown / refused to say |

### A.2 Call outcome / stall (`Call outcome / stall`)

| Stored value | Label shown |
|--------------|-------------|
| *(empty)* | — Not specified — |
| `busy_will_call_back` | Busy — customer will call us back |
| `requested_callback_later` | Busy — asked us to call later |
| `needs_time_to_decide` | Needs time to decide |
| `travel_or_offline` | Travel / offline / unreachable briefly |
| `talk_to_family_first` | Must discuss with family / partner |
| `comparing_options` | Comparing options / shopping around |

### A.3 Lead type

- Digital Lead  
- Non Digital Lead  

### A.4 Visit status / Next action (Create Visit Report form)

Exact strings as in app (`STATUSES`):

1. New Lead  
2. Demo Scheduled  
3. Demo Completed  
4. Quotation Shared  
5. Catalogue Shared  
6. Demo Follow Up  
7. Follow-Up 2  
8. Negotiation  
9. Booking Date Confirmed  
10. Loan Processing  
11. Booking Amount Received  
12. Order Confirmed  
13. Delivery Scheduled  
14. Delivered (Closed – Won) — *Unicode en dash in product*  
15. Lost – Price Issue  
16. Lost – Competitor  
17. Lost – No Response  
18. Lost – Not Interested  

### A.5 Lost – Not Interested reasons

| Value | Label |
|-------|-------|
| `budget` | Budget / affordability |
| `timing` | Timing — not ready to buy |
| `product_fit` | Product fit / specs mismatch |
| `range_anxiety` | Range / charging concerns |
| `prefers_ice` | Prefers ICE / not convinced on EV |
| `chose_competitor` | Chose a competitor |
| `family_decision` | Family / stakeholder decision |
| `other` | Other (explain below) |

### A.6 Visit Report filter statuses (pipeline + extended)

**Pipeline-focused statuses** (partial list — includes early funnel):

New Lead, Attempted Contact, Connected, Requirement Identified, Qualified Lead, Demo Scheduled, Demo Completed, Quotation Shared, Catalogue Shared, Demo Follow Up, Follow-Up 2, Negotiation, Booking Date Confirmed.

**Additional “lost / closed” statuses** when extended toggle on:

Lost – Price Issue, Lost – Competitor, Lost – No Response, Lost – Not Interested, Loan Processing, Booking Amount Received, Order Confirmed, Delivery Scheduled, Delivered (Closed – Won).

---

## Appendix B — Screenshot checklist (for trainers)

Replace placeholders in §§2–10 with real captures from **production or training**:

1. Login + Sales sidebar.  
2. Sales Performance hub buttons row.  
3. Create Lead Report — empty form + CRM section.  
4. Create Lead Report — location dropdown sample.  
5. Lead Report — filters + stats + table.  
6. Lead Report — Preview modal + Activity History sample.  
7. Create Visit Report — lead picker + vehicle search.  
8. Create Visit Report — Lost NI fields + GPS checkbox.  
9. Visit Report — filters + Show lost / closed + Export CSV row count matching table.  
10. Daily Target — admin view (optional).

**Maintenance:** Whenever [`Voltmate-/lib/crmDeferral.ts`](Voltmate-/lib/crmDeferral.ts) or visit status arrays change, update **Appendix A** and re-export PDF if your company distributes PDFs.

---

*Document generated from Voltmate codebase paths under `Voltmate-/app/sales/*`, `Voltmate-/components/sections/SalesPerformance.tsx`, `Voltmate-/lib/crmDeferral.ts`, `backend/src/utils/crmDeferral.ts`. Review quarterly or after CRM releases.*
