# Launch day runbook (Product Sprint 9)

**Product:** IterLaw  
**Reference:** `docs/DISTRIBUTION_PLAN.md` §5

## T-0 schedule (GMT)

| Time | Action | Owner |
|------|--------|-------|
| 08:00 | Press release | Comms |
| 09:00 | Website / blog live | Product |
| 09:30 | LinkedIn | Founder |
| 10:00 | Reddit r/AskUK | Growth |
| 14:00 | Reddit r/BritishProblems | Growth |
| 15:00 | Waitlist email | Product |
| 16:00 | Union partners (if ready) | Partnerships |
| 17:00 | App Store links live | Product |
| EOD | Metrics review | Product |

## Go / no-go (same day 07:00)

- [ ] `/health` and `/ready` green on production
- [ ] Error rate <1% (15 min window)
- [ ] On-call acknowledged
- [ ] 5 solicitor partners reachable
- [ ] Rollback tested in staging in last 7 days

## Incident

1. Page on-call  
2. Status page update if user-visible >5 min  
3. Post-mortem within 48h if Sev-1

## Comms template (outage)

```text
We are investigating elevated errors on IterLaw. Your data is secure.
Updates: [status URL]. Information service only — not legal advice.
```
