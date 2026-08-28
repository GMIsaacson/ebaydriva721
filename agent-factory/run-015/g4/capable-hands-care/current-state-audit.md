# UIX-G4-CHC-001 — Current-State Audit

Target: https://capablehandscare.com/
Observed: 2026-08-28
Mode: read-only public-site shadow qualification

## Source-verified current structure
The live home page exposes Home, About, Services, Integrated Community Supports (ICS), Special Transportation Services (STS), Client Referral Form, We're Hiring, and Contact as top-level navigation. Its opening hierarchy is “Stellar Service is Our Priority,” immediately followed by a recruiting CTA (“Join Our Team Now”), before service discovery or referral. The home page lists IHS, Respite, Housing Stabilization, Homemaker, Night Supervision, Employment Services, 24-Hour Emergency Assistance and ICS, and identifies the company as a Minnesota-licensed HCBS company.

## UX diagnosis
- Primary audience hierarchy is ambiguous: recruiting is elevated ahead of families/case managers seeking services.
- Navigation exposes too many program names at top level instead of grouping services into a clear information architecture.
- Service content is difficult to scan because program labels are more prominent than user intent.
- Referral begins as a raw PDF rather than a guided referral journey.
- Contact and location information is available, but the site lacks a strong “what should I do next?” decision path.
- The current visual system does not strongly differentiate the organization or communicate person-centered support.
- Mobile users benefit from shorter navigation, larger touch targets, clearer typography and more obvious primary actions.

## Redesign strategy
1. Lead with the user outcome: independence, choice and support at home/community.
2. Separate three major visitor intents: services, case-manager referral, employment.
3. Group service discovery under one clear Services surface.
4. Keep recruiting visible but subordinate to the care/referral journey.
5. Introduce a restrained editorial service aesthetic rather than generic healthcare or SaaS visuals.
6. Preserve source-verified phone, email, hours, locations, service names and official referral/careers/contact links.
7. Collect no real personal or medical information in the shadow preview.

## Screenshot-evidence constraint
The execution container's Chromium networking is policy-blocked from loading the public URL, so a contemporaneous pixel screenshot of the live “before” state could not be captured inside the same trusted runtime. The public URL and contemporaneous rendered text/structure were captured independently. The redesigned “after” state is rendered at desktop, tablet and mobile and hashed in the evidence pack. This constraint prevents a strict final G4 promotion claim under the original mandatory before-screenshot rule; it does not invalidate the redesign artifact itself.
