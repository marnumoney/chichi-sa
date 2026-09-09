# Country Club Automation — Research Findings

**Date:** 9 September 2026
**Input:** `countryclubautomationconcept.md` (exploratory concept note)
**Purpose:** Test the concept note's assumptions against evidence, and identify the biggest real problems in this market that we could actually fix.
**Status of numbers below:** every figure is sourced and linked. Nothing here is our own measurement. Same rule as the concept note applies — none of this goes into external material without re-verification.

---

## Summary of what the research changes

The concept note's core structural argument holds: the engine transfers, the buyer has money, the comms layer is separable. Six things it gets wrong or omits, in order of how much they matter:

1. **Direct competitors already exist and are priced 15–50x below the proposed price point.** This is the single biggest omission. The note's competitive risk section looks three years out at the incumbents and misses what shipped this year.
2. **The market is at capacity, not in distress.** Clubs have waitlists. Two of the six proposed modules pitch a problem this market does not currently have.
3. **Labour is the number-one stated pain, not lead response.** The note explicitly de-prioritises the headcount argument. The market is making that argument itself.
4. **The best buyer is a management company, not a club.** This dissolves the note's own top-ranked risk.
5. **"Software fatigue" is a board-level complaint, which makes comms-only an objection, not just a shortcut.**
6. **Vendor data diligence is now a procurement gate we cannot currently pass.**

---

## 1. Competition — already here, already cheap

The note's risk register says *"Clubessential and Jonas will eventually ship their own version. We're betting on being three years faster."* The threat is not three years out and it is not the incumbents.

| Competitor | Positioning | Notable |
|---|---|---|
| GOLF.AI CONCIERGE | 24/7 pro shop call answering, tee-time booking, course-approved Q&A | Launched 2026, voiced by Sir Nick Faldo, **from $99/month for 200 calls**, 30-day free trial, available worldwide, partnered with Proshop Tee Times |
| AceCall.ai | Custom AI agents for golf clubs; answering, routing, feedback, follow-up, tournament and event management | Co-founder is a PGA professional with **23 years in private clubs** — exactly the domain credibility this market buys on |
| Tee Time AI | Named voice agent running the pro shop front desk | Direct overlap with proposed module 2 |
| NeverClosed.AI / MyAIFrontDesk | Golf and country club verticals, membership enquiries, tee times, dining reservations | Generic voice-agent platforms with a club landing page |

Two consequences:

**The $99 anchor is fatal to module 2 as a headline.** A GM who searches "AI phone agent golf club" finds a Nick Faldo-voiced product at $99/month before they finish the first page. Pitching $1,500–5,000/month for "AI answers the member phone line" invites a comparison we lose on the slide, regardless of how much better our shadow-mode deployment and knowledge-base structure actually are. Quality differences do not survive a 15x price gap in a procurement conversation.

**AceCall is the profile we would have to beat on trust.** The note correctly identifies that this market is small and talks to itself constantly. That property cuts both ways: it rewards whoever the market already knows. A 23-year private club insider is the hardest possible competitor in a referral-driven market.

Where competition is thin: **none of these lead with event and banquet RFP response.** They are all pro-shop and tee-sheet oriented. Module 1 remains genuinely underserved. That is a strong signal that the note's instinct about the wedge is right, and its instinct about module 2 being "where the volume is" is a trap.

Sources: [GOLF.AI CONCIERGE launch](https://thegolfwire.com/golf-ai-concierge), [GOLF.AI / Proshop Tee Times partnership](https://golfbusinessnetwork.com/gbn-news/gbn-article/golf-ai-and-proshop-tee-times-partner-to-personalize-golf-pro-shops-across-the-u-s-using-the-golf-ai-concierge-agent/2026/04/30/), [AceCall.ai](https://acecall.ai/), [Tee Time AI](https://teetime-ai.com/), [MyAIFrontDesk golf clubs](https://www.myaifrontdesk.com/industries-we-serve/golf-clubs)

---

## 2. The market is full, which breaks two of the six modules

Private club membership demand surged through the Covid era and supply did not follow.

| Metric | Figure |
|---|---|
| US private golf facilities | ~4,800 of 15,963 total courses (~30%) |
| Growth in private club member golfers since 2019 | ~50% |
| On-course golfers added since 2019 | ~5 million |
| Clubs reporting waitlist growth year over year | more than a third |
| Waitlists at top clubs | up to 70 members |
| Average initiation fee increase YoY | 8.7% |
| Average operating dues increase YoY | 6.2% |
| Median initiation fee, top-quartile clubs | over $100,000 |

**What this breaks:**

- **Module 5 (membership pipeline and retention signals) is close to unsellable right now.** The note argues "one saved or one added member covers a year of anything we charge." That logic assumes a club that wants more members. A club with a 70-person waitlist replaces a departing member the same week, at a higher initiation fee than the one who left paid. Churn is not a cost to them, it is a repricing event. Leading with retention signals reads as a vendor who has not understood the market.
- **Module 1's premise needs re-checking per club.** Clubs at capacity have less incentive to chase outside event business, and some actively restrict it to protect member access.

**What this creates:** the real problem a full club has is *service delivery under load* — more members, more rounds, more covers, same or fewer staff. That is a genuine, current, growing pain and it is adjacent to what we sell. It is just not the pain the note describes.

Sources: [NGF — Golf's Private Side](https://www.ngf.org/short-game/golfs-private-side/), [NGF — The Surge's Impact on the Private Side of Golf](https://www.ngf.org/the-surges-impact-on-the-private-side-of-golf/), [Private Club Marketing — 2026 membership trends, 1,200-club study](https://privateclubmarketing.com/the-evolution-of-belonging-10-membership-marketing-trends-reshaping-private-golf-country-clubs-in-2026/)

---

## 3. Labour is the stated number-one problem — and the note argues against leading with it

Every 2026 industry source ranks workforce first.

| Metric | Figure |
|---|---|
| Payroll and benefits as share of club operating budget | 50–55% |
| Labour as share of total expenses at private clubs | 55–62% |
| Average FTEs per private club | 48.3 |
| Average headcount per private club | 101.9 |
| US private club industry direct employment | 334,000+ |
| US private club industry annual economic impact | ~$21.5B |

Club leaders name recruitment, turnover and securing qualified managers as the three areas of mounting pressure. Wage inflation, international visa constraints, staff housing and generational workforce shifts are cited as forcing clubs to rethink staffing models. Consultancy commentary frames the requirement as *reassessing staffing models for efficiency without compromising member experience* — which is, almost word for word, the thing we sell.

The concept note says of the events wedge: *"This is the wedge because it's a revenue argument, not a headcount argument."* That is good sales instinct for the first slide and wrong as a strategy. The revenue argument is what gets the events director excited. The labour argument is what gets it through the finance committee, because it lands against the largest single line in the budget in a year where that line is the board's stated priority.

Both arguments should be in the deck. The note currently discards the stronger one.

Sources: [RSM — Private club 2026 trends](https://rsmus.com/insights/industries/private-clubs/top-2026-trends-private-clubs.html), [RCS — Top concerns for club leaders in 2026](https://blog.consultingrcs.com/blog/top-concerns-for-club-leaders-in-2026-recruitment-retention-and-leadership-capacity), [KK&W — The State of Private Clubs in 2026](https://kkandw.com/the-state-of-private-clubs-in-2026/), [GGA Partners — Golf benchmarking standards](https://ggapartners.com/2018/11/golf-benchmarking-standards/), [Private clubs industry statistics 2026](https://wifitalents.com/private-clubs-industry-statistics/)

---

## 4. The events wedge is well-evidenced, but the buyer is wrong

**The evidence for the wedge is strong.** Independent benchmark data across 1,200+ wedding venues:

| Metric | Figure |
|---|---|
| Median first reply to a wedding enquiry | 11 hours |
| Venues replying within one hour | 37% |
| Typical (non-top-quartile) reply time | 42 hours |
| Top-quartile venue reply time | under 8 minutes |
| Revenue per lost wedding or private event booking | $8,000–20,000 |
| Annual revenue lost to slow response, per venue | $40,000–120,000+ |
| Drop in contact probability, 5 min vs 30 min response | 100x (MIT / HBR lead response study) |
| Lift in qualification odds responding within 5 min | 21x |

This is the note's opening pitch, already measured, by someone else, at a sample size we cannot match in two weeks. **We do not need to run the 40-enquiry sprint to obtain this number.** See section 7.

**The buyer is the problem.** The clubs that publicly market weddings and outside events are overwhelmingly the corporate-managed portfolios, not the independent member-governed clubs the note describes. Nearly every club in search results advertising non-member weddings belonged to Invited (formerly ClubCorp). Independent elite clubs at capacity are the least likely to want outside event volume.

So the note's ICP — an $8–15M revenue member-governed club where the GM signs and a board committee blocks — is simultaneously the hardest sale (3–6 month committee cycle, the note's own top risk) and the least likely to want the wedge product. That is the wrong end of the market to start at.

Sources: [Wedding venue inquiry response time benchmark](https://everybooking.com/blog/wedding-venue-inquiry-response-time-benchmark), [The $120,000 problem — venue booking gaps](https://www.relaylaunch.com/blog/wedding-event-venue-booking-gaps/), [Invited Clubs event pages](https://www.invitedclubs.com/clubs/the-hills-country-club/host-an-event/weddings)

---

## 5. The buyer that dissolves the governance risk

The note's number-one honest risk is committee governance. There is a structural way around it that the note does not consider: **sell to the management companies.**

| Operator | Scale |
|---|---|
| Troon | ~600 golf facilities worldwide, 400+ in the US; brands include Troon Privé, Bobby Jones Links, ClubUp, Eventive Sports, RealFood Hospitality |
| Invited (formerly ClubCorp) | 150+ clubs, 200+ courses |
| Bobby Jones Links | 34 facilities across 13 states (acquired by Troon, August 2026) |
| Concert Golf Partners, Hampton Golf | smaller portfolios, both actively hiring catering and events directors |

Why this is the better entry:

- **One sale covers dozens to hundreds of properties.** It replaces the "three references carry the whole thing" bootstrap with a single reference that is the market.
- **It removes the board.** Portfolio operators have procurement, not committees. Long, but legible, and it does not die because one board member dislikes AI.
- **These are the operators who actually want outside event revenue** — they market weddings publicly across their portfolio, which is precisely the module 1 use case.
- **They have the standardisation problem we solve.** A consistent enquiry-response standard across 150 properties is an operator-level KPI, not a club-level nicety. That is an enterprise argument we can make and a single club cannot buy.

The trade-off is real: enterprise sales cycles, procurement diligence, and a meaningful chance they build or buy it themselves. But the note is already budgeting 3–6 months and a committee for a single club. The same effort aimed one level up has an outcome worth having.

Sources: [Troon acquires Bobby Jones Links](https://troon.com/press-releases/troon-acquires-bobby-jones-links), [Golf Course Industry — Troon / Bobby Jones Links](https://www.golfcourseindustry.com/news/troon-acquires-bobby-jones-links/), [Invited and Troon strategic relationship](https://www.invitedclubs.com/company/news/invited-and-troon-forge-strategic-relationship)

---

## 6. Two objections the note treats as strengths

### 6a. Comms-only is also the main objection

The note frames "no touching their system of record" as pure upside. It is, for delivery speed. But the documented board-level complaint in this market is fragmentation:

> "The tee sheet doesn't talk to the POS, the POS doesn't talk to accounting, and nobody can pull a single report that tells the truth about member behaviour."

A GM describes the condition as *software fatigue* — juggling separate platforms for reservations, restaurant payments, events and member check-ins. The 2026 direction of travel in club software is explicitly toward integration and consolidation.

Selling a new, deliberately disconnected comms layer into a club that is already angry about disconnected systems is the objection we will hit in every meeting. It is answerable — shadow mode, no data migration, no rip-and-replace, and a written integration path — but it has to be answered on the first slide, not discovered in the third meeting.

Note also that Jonas advertises 60+ app integrations and an integration platform (Jonas ARC), so "their APIs are gated and slow" is directionally true for deep bidirectional work but overstated as a blanket claim. Reviewers do confirm the real limitation: limited bidirectional exchange for organisations with existing CRM investments, a closed ecosystem trading integration breadth for club-specific depth.

Sources: [Clubspot — What software should country clubs use in 2026](https://www.blog.theclubspot.com/clubspot-blog-1/what-software-should-country-clubs-use-in-2026nbsp), [Golf Club Ops — 2026 landscape review](https://www.golfclubops.com/golf-software-2026), [Jonas Club Software](https://www.jonasclub.com/jonas-club-software-management-app/), [Clubessential reviews — Capterra](https://www.capterra.com/p/151992/Clubessential/reviews/)

### 6b. Data diligence is a gate we cannot currently pass

The note's risk section covers reputational risk to the GM but not vendor risk to the club. In 2026 that is the harder gate:

- Vendor diligence now routinely demands transparency on **training use, retention and deletion, sub-processing, and data location**, with contract terms covering AI training data, secondary use, audit rights and liability allocation.
- The US DOJ **Data Security Program** bulk data transfer rule restricts transfers of bulk US sensitive personal data to designated countries. Any architecture where US member PII lands offshore needs a defensible answer.
- AI governance moved to board level generally, and technology risk is specifically named as a board-level concern in private clubs this year.

Practical implication: a solo operator processing member names, phone numbers, dining history and spend data for US clubs will be handed a vendor security questionnaire. We need answers ready — US data residency, no training on member data, documented retention and deletion, a sub-processor list, and appropriate insurance. This is cheap to prepare in advance and expensive to improvise at the finish line of a six-month sale.

### 6c. Minor: module 4 has a tone risk

The note says of minimum-spend nudges: *"Members genuinely appreciate the reminder."* Worth pressure-testing. F&B minimums are documented as one of the most disliked charges in club membership — members read the charge as a fine for not spending. A nudge that helps a member *use* money they have already committed is plausibly welcome; a nudge that reads as the club chasing spend is a member-relations incident. The distinction is entirely in the copy, and the copy is the product. Get this one signed off by a GM before it ships, not after.

Sources: [Alston & Bird — 2026 IAPP Global Summit takeaways](https://www.alston.com/en/insights/publications/2026/04/takeaways-from-the-2026-iapp-global-summit), [Nixon Peabody — 2026 privacy, cyber and AI developments](https://www.nixonpeabody.com/insights/alerts/2026/02/09/data-privacy-cybersecurity-ai-developments-shaping-2026), [Morrison Foerster — 2026 predictions](https://www.mofo.com/resources/insights/251218-data-cyber-privacy-predictions-for-2026), [Private Club Marketing — F&B minimums explained](https://privateclubmarketing.com/food-beverage-minimums-explained-2026/), [Club + Resort Chef — what is a member F&B minimum](https://clubandresortchef.com/what-is-a-member-fb-minimum/)

---

## 7. The proposed validation sprint should change

The two-week plan as written spends its effort on the one thing already measured and skips the things that would actually kill this.

**Step 2 (submit realistic wedding enquiries to 40 named clubs) — drop or restructure.** Two problems:

- *It buys a number that already exists.* Median 11 hours, 37% within an hour, 42 hours typical, from a 1,200+ venue dataset. Our n=40 sample is weaker evidence and costs two weeks.
- *It is a reputational liability in a market defined by people talking to each other.* Mystery shopping is a normal research method, but submitting fabricated wedding briefs to 40 named businesses and then approaching those same businesses as the vendor who graded them is a poor opening in a market where GMs move between clubs and compare notes constantly. One GM working out what happened poisons the reference base before it exists.

If we want our own number, take a small sample, disclose it as research when we follow up, and cite the published benchmark for the headline.

**Step 3 (ring 15 pro shops at peak, log hold times) — keep.** This is ordinary observational research on a public phone line, it costs nothing, and it gives us a real number nobody has published.

**Step 4 (5 GM conversations) — keep, and expand the question set.** Add: what they pay for club software today, whether they have already been pitched an AI phone agent, who signs a $3k/month operating expense, and what their vendor security review looks like.

**Add the steps that actually test the thesis:**

1. **Two conversations at Troon or Invited level.** Does a portfolio operator have an enquiry-response standard, and who owns it? This is the highest-information call available and nothing in the current plan attempts it.
2. **Competitive teardown.** Sign up for the GOLF.AI 30-day free trial. Find out exactly what $99/month buys, where it breaks, and whether events RFP is genuinely absent from all four competitors. Our entire pricing argument depends on the answer.
3. **Answer the data question on paper.** One page: residency, retention, deletion, sub-processors, training. Cheap now, blocking later.

That is a one-week sprint, not two, and it tests competition, buyer level and procurement — the three things most likely to kill this — instead of re-measuring response time.

---

## 8. The founder-fit question the note does not ask

The note's honest risks end at focus cost. There is a harder one.

The named go-to-market channels are CMAA chapter meetings, the CMAA annual conference, and referral relationships with search consultancies such as Kopplin Kuebler & Wallace. All three are US, in-person, relationship-driven channels in a market the note itself describes as small, self-referential and trust-based. We would be entering it as a remote solo operator from UTC+2, against a competitor whose co-founder spent 23 years inside private clubs.

That is not disqualifying — the events RFP module is asynchronous, measurable, and can be proven on public information without a relationship. It is precisely the module that survives a remote seller, which is another argument for module 1 as the wedge and against module 2. But it does mean the honest version of the plan starts with a channel that does not require being in the room, and it means the note's implied path (conference presence, consultancy referrals, three good references) is expensive in the one resource that is actually scarce here.

---

## 9. What I would fix, in priority order

| # | Problem | Fix |
|---|---|---|
| 1 | Direct competitors at $99/month invalidate the phone-concierge pricing | Lead with event RFP response only. Never pitch "AI answers the phone" as the headline. Price on recovered booking revenue, not per call, so there is no comparable unit |
| 2 | ICP is the hardest buyer and the least likely to want the product | Target management companies (Troon, Invited, Concert Golf, Hampton Golf) before independent clubs. One sale, no board, and they already want outside event revenue |
| 3 | Retention and membership pipeline modules pitch a problem the market does not have | Drop module 5 from the deck entirely while waitlists hold. Replace with service-delivery-under-load framing |
| 4 | The labour argument is discarded despite being the market's stated top priority | Keep revenue as the opening slide, add labour as the finance-committee slide. Payroll is 50–55% of the budget and it is this year's board priority |
| 5 | Comms-only will read as more software fatigue | Answer it on slide one: shadow mode, no migration, no rip-and-replace, written integration path |
| 6 | No answer for vendor data diligence | Write the one-pager now: US residency, no training on member data, retention and deletion, sub-processors, insurance |
| 7 | Validation sprint measures the wrong things | Cut the 40-enquiry submission. Keep pro shop calls and GM interviews. Add portfolio-operator calls, a GOLF.AI trial teardown, and the data one-pager |

---

## 10. On the question the note actually asks

The note asks whether to run this as a second vertical under a different brand, or park it and revisit.

The research does not settle that, but it changes what the decision rests on. The note's lean — *"run the two-week validation now, because it costs almost nothing and the data is useful either way"* — was reasoned on the assumption that time-to-response is the unknown. It is not the unknown. It is published.

The genuine unknowns are whether a portfolio operator will buy an enquiry-response standard, and whether module 1 survives contact with four funded competitors who have not built it yet but easily could. Both are answerable in about a week of calls and one free trial, at lower cost than the plan as written, and with far less reputational exposure.

So: the sprint is still worth running. It should be a different sprint. Commit to the vertical only if a portfolio operator conversation comes back warm — not if enquiry response comes back slow, because we already know it will.
