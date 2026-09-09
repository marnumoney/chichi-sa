# Country Club Automation — Concept Note

**Status:** exploratory. Nothing committed. Purpose of this doc is to decide whether it's worth two weeks of validation.

---

## The one-line version

Private country clubs are understaffed, seasonally chaotic, and running on legacy software nobody loves. We already own the exact stack that fixes their front line — AI voice and messaging agents over a per-client knowledge base, deployed in shadow mode. It's the StayOps engine pointed at a wealthier, stickier buyer.

---

## Why this vertical, why us

The structural match to what we've already built is close to one-for-one:

| STR operator | Country club |
|---|---|
| Guests messaging at all hours | Members calling the pro shop and dining line |
| PMS (Hostaway, Guesty, Lodgify) | Club platform (Clubessential, Jonas, Northstar, Club Caddie) |
| Seasonal occupancy swings | Seasonal membership activity + seasonal staff |
| Thin margins, low willingness to pay | Fat budgets, high willingness to pay |

That last row is the whole argument. A club doing $8–15M in annual revenue treats a $3k/month operating expense as a rounding error, where an STR operator negotiates over $40 a door.

We do not need to build anything new to start. The voice agent, the knowledge-base structure, the n8n intake kit with the human approval gate, and the shadow-mode deployment method all transfer directly. What changes is the vocabulary and the sales motion, not the engineering.

---

## What we'd actually sell

Ordered by how easy each is to prove and how fast it pays for itself.

**1. Event & banquet RFP response (the wedge)**
Weddings, corporate outings and member private events are the club's largest outside-revenue line. Most clubs take days to reply to a website enquiry, and by then the planner has three other quotes. We answer in under five minutes, qualify the enquiry, and hand the events director a drafted brief.

This is the wedge because it's a *revenue* argument, not a headcount argument, and it needs zero integration with their system of record. It also produces a number we can put on a slide.

**2. Member phone and text concierge**
Tee times, dining reservations, hours, guest policy, dress code, cart rules, event RSVPs. This is where the volume is, and it's identical to guest communication in every meaningful way.

**3. Dining reservation, waitlist and no-show automation**
F&B is the number-one member complaint category at almost every club. Auto-confirm, auto-backfill cancellations from the waitlist, chase no-shows, push accurate cover counts to the kitchen.

**4. Minimum-spend nudges**
"You have $340 of unused quarterly F&B minimum." Members genuinely appreciate the reminder, it drives real covers, and the revenue is directly attributable to us. Best ROI proof we're likely to get.

**5. Membership pipeline and retention signals**
Initiation fees are large. One saved or one added member covers a year of anything we charge. Flag members whose visits or spend have dropped and prompt the GM to reach out.

**6. Seasonal hiring and board reporting**
Applicant screening and interview scheduling for the spring staffing ramp; an auto-assembled monthly board packet pulled from POS, tee sheet and membership data.

We would launch with 1–3 and hold the rest as expansion revenue.

---

## Integration strategy — deliberately avoid it at first

The incumbent platforms have limited, gated APIs and slow partner programmes. Trying to integrate before we have a customer would kill this before it starts.

So: **comms layer only.** Phone number, SMS, email, web form. No touching their system of record. This is the same two-track approach we're already running with NightsBridge — ship the comms-layer version now, pursue formal integration later only if a customer's volume justifies it.

---

## The buyer and the sales cycle

- **Who signs:** General Manager / COO. Sometimes the Membership Director or F&B Director champions it internally first.
- **Who blocks:** the board and the relevant committee. Clubs are governed, not owned, and that slows everything down.
- **Cycle length:** assume 3–6 months. Price for it.
- **Channels worth testing:** CMAA chapter meetings and the annual conference; club search and management consultancies (Kopplin Kuebler & Wallace is the obvious one) as a referral path; direct outreach to GMs at clubs whose event enquiry forms we've already tested.

A nice property of this market: it's small, it talks to itself constantly, and GMs move between clubs. Three good references could carry the whole thing.

---

## Money (assumptions, not claims — all need validating)

- **Price point:** $1,500–5,000/month per club, tiered by which modules are live. Possibly an events-only entry tier at the low end.
- **Target:** 10 clubs in year one. That's a $250k–450k ARR business off a product we've already built.
- **Delivery cost:** the human-in-the-loop overflow layer is the real variable. Model it the way we modelled the BPO side of StayOps.
- **Market size:** several thousand private and semi-private clubs in the US. Needs verifying against NGF data before we put a number in front of anyone.

Nothing above is measured. Same rule as the StayOps ad work — no number goes into external material until it traces back to something we've actually observed.

---

## Honest risks

- **Committee governance.** Long cycles, deals that die because a board member "doesn't like AI answering the phone."
- **Member-facing AI is a reputational risk to the GM.** They're selling exclusivity and personal service. A bot that mishandles a call is a career problem for them, not just a bad ticket. Shadow mode is the answer, and it needs to be the first thing out of our mouths.
- **Incumbents will bolt this on.** Clubessential and Jonas will eventually ship their own version. We're betting on being three years faster, and on the comms layer being separable from the system of record.
- **Focus cost.** StayOps is the main effort. This is a second sales motion, a second knowledge domain, and a second set of references to build from zero.

That last one is the real question for us, not the market.

---

## Proposed validation — two weeks, no build

1. Pull a list of 40 US private clubs with public event enquiry forms.
2. Submit a realistic wedding enquiry to each. Log time-to-first-response and quality. This gives us our entire opening pitch as measured data.
3. Ring 15 pro shops and dining lines at peak times. Log hold times, abandoned calls, whether anyone picks up at all.
4. Get 5 GMs on the phone. Not to sell — to ask what their front desk actually eats in hours per week and what their event enquiry-to-booking rate is.
5. Decide. If time-to-response is as bad as expected and GMs confirm the pain, we build a demo against one real club's public information and run it as our pilot pitch.

Nothing here needs engineering time. It's a research sprint we could largely automate.

---

## The question for you

Not "is this a good market" — I think it clearly is. The question is whether we run it as a **second vertical on the StayOps engine under a different brand**, or park it as a documented opportunity and revisit after StayOps hits its next milestone.

My lean: run the two-week validation now, because it costs almost nothing and the data is useful either way. Commit to the vertical only if step 2 comes back as ugly as I expect it to.
