# The product: what the automation actually does

**Date:** 10 September 2026
**Follows on from:** `country-club-automation-research.md`, `country-club-automation-troon-path.md`

One sentence: **it catches every event enquiry a venue receives, answers it properly within five minutes, chases it until the venue's events person takes over, and reports what it recovered.**

Nothing else. No tee times, no member concierge, no dining, no membership. Those are year two.

---

## 1. Walk through one wedding enquiry

This is the whole product, end to end.

**Sunday, 9:14pm.** A couple fills in the "Enquire about weddings" form on a resort's website. Name, email, phone, "November 2027", "about 120 guests", "we'd love to see the terrace".

Today that email sits in an inbox until Monday morning. If it is a busy week it sits until Wednesday. Roughly half of these are never answered at all.

**9:14pm — Capture.** The form and the events email address both feed into our system. Phone enquiries come in as voicemail transcripts or missed-call texts.

**9:15pm — Read and extract.** We pull out the structured facts and put them in a record:

| Field | Example |
|---|---|
| Event type | Wedding reception |
| Requested date | November 2027, no firm date |
| Guest count | ~120 |
| Contact | name, email, mobile |
| Stated interest | outdoor terrace |
| Channel | website form |
| Budget signal | none given |
| Missing information | firm date, ceremony or reception or both, catering preference |

**9:16pm — Reply.** A real answer, in the venue's voice, not an autoresponder. It contains:

- Confirmation we received it, by name, referencing what they actually asked for.
- The information they need to keep us on their shortlist: capacity for 120, what the terrace does and does not seat, indicative pricing range, what a package includes.
- The venue's wedding brochure or a link to it.
- Two or three questions that move it forward: is the date firm, ceremony as well as reception, rough budget per head.
- A clear next step: a booking link for a site visit, or an offer of two specific call times.

It does **not** confirm the date is available. That is the one thing it must never do without the venue's calendar. It says the date is being checked and the events team will confirm.

**9:16pm — Alert.** The events director gets a message: new wedding enquiry, 120 guests, November 2027, replied, date needs checking.

**Monday morning.** The events director opens a single page. Every live enquiry, each with a short brief already written: who they are, what they want, what has been said, what is outstanding, how hot it looks. They check the date and take over the ones worth their time.

**Day 2, day 5, day 12.** The couple has not replied. The system follows up three times, spaced out, each one adding something rather than nagging. A photo of the terrace set for 120. A recent real wedding. A note that the November 2027 diary is starting to fill.

This is where most of the money is. Almost no venue follows up more than once, and many never follow up at all.

**Handover or close.** The moment the couple replies with anything substantive, or asks for a site visit, the system stops and hands to the human with the full thread summarised. If they go quiet after the third follow-up, it closes them out and puts them on a long-cycle re-touch.

**End of month.** The venue gets a one-page report. Enquiries received, average time to first reply before and after, how many reached a site visit, how many booked, revenue attributed.

That report is the renewal. It is also the case study for the next property.

---

## 2. The parts you actually build

Seven pieces. Most of this exists already in the lead-agent and agency codebases in this repo.

| # | Piece | What it does | Build state |
|---|---|---|---|
| 1 | Intake | Dedicated email address, a form endpoint or forwarding rule, missed-call and voicemail capture | Mostly new, small |
| 2 | Extractor | Turns a free-text enquiry into structured fields | Same shape as `qualifier.py` in lead-agent |
| 3 | Venue knowledge base | Per-property facts: spaces, capacities, pricing ranges, packages, what is included, blackout periods, house rules, tone of voice, photos | New, and this is the real work |
| 4 | Composer | Writes the reply and the follow-ups from the enquiry plus the knowledge base | Same shape as `composer.py` |
| 5 | Sender | Email and SMS out, threading, reply detection, stop-on-human-reply | `mailer.py` and `reply_checker.py` already do this |
| 6 | Console | One page the events director opens: live enquiries, briefs, approve or edit before send during shadow mode | New, small web app |
| 7 | Reporting | Time to first reply, enquiry volume, progression, attribution, monthly PDF | New, small |

The engineering is not the hard part. Piece 3 is.

---

## 3. Shadow mode, which is how you get in the door

Nobody lets an unknown vendor email their wedding leads on day one. So the rollout has three gears and you say this in the first sentence of the first meeting.

| Gear | What happens | Typical duration |
|---|---|---|
| **Watch** | We receive enquiries and draft replies. Nothing sends. The venue sees what we would have written and how fast. Builds the before-and-after number for free | 1–2 weeks |
| **Approve** | Drafts go to the events director, who clicks send or edits first. One tap on a phone | 2–4 weeks |
| **Auto** | Sends automatically within the agreed rules. Human still owns anything involving a date, a discount, or a complaint | Ongoing |

Two things never go to auto: confirming availability, and anything with a number that binds the venue. Those always route to a human.

Shadow mode is not a concession. It is the reason a nervous general manager says yes, and the watch phase hands you the measurement you need to sell the next property.

---

## 4. The four things that will bite you

Be honest about these in the pitch. Every one of them has an answer.

**Availability is the hard problem.** You cannot confirm a date without the venue's calendar, and you are deliberately not integrating with their booking system. Three options, in order of preference: a shared calendar the events team keeps current, a weekly blackout list, or simply never confirming and always routing date questions to a human. Start with the third. It costs you nothing and it is honest with the couple.

**Pricing.** You need indicative ranges to be useful, and venues are cagey about publishing them. Get a per-property pricing sheet during onboarding, marked clearly as "from" ranges. If they refuse, the reply gives everything except price and asks for the couple's budget instead. Still beats 42 hours of silence.

**Tone.** A wedding enquiry answered in a generic corporate voice is worse than a late reply. The knowledge base has to carry the venue's actual voice, and the first week of drafts must be read by the events director. This is why the watch phase exists.

**Onboarding time.** Piece 3 is the cost. Realistically half a day to a day per property to gather spaces, capacities, packages, pricing, photos and tone. That is your delivery cost and it is what you must model before you price. It is also what makes a portfolio deal attractive, because much of it repeats across properties in the same group.

---

## 5. What you charge

Do not price per call or per month against a feature list. That invites the $99 comparison from the golf voice agents.

Price it as **recovered revenue**, which is a different category of purchase:

- A low monthly base that covers your delivery cost, in the region of a few hundred dollars per property.
- Plus a fee on events that trace back to an enquiry the system answered and progressed.

That structure does three things. It makes the pilot nearly free to say yes to. It aligns you with the number they care about. And it means there is no comparable product to price you against, because nobody else is selling this shape.

For the first two or three pilot properties, weight it almost entirely to the performance side. You are buying a case study, not margin.

---

## 6. Why this one and not the others

Reference back to the earlier research:

- Over half of event enquiries at venues go completely unanswered.
- Six in ten bookings go to one of the first three responders.
- The published median first reply for wedding venues is 11 hours, with typical replies at 42 hours.
- A single booking is worth $8,000–20,000.
- The AI competitors in golf all answer pro shop phones about tee times. None of them do this.
- The hotel tools that do something similar are built for corporate enquiries arriving through Cvent at properties with a full sales desk. A club or resort banquet operation has neither.

That is the gap. It is narrow, it is provable, and it is the only piece of the original concept note that no competitor has already taken.
