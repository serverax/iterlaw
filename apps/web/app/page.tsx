'use client';

import { Header } from '@/components/nav/Header';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const FEATURES = [
  { icon: '🌙', title: 'Available at 9pm', desc: 'When a letter arrives and everything else is closed' },
  { icon: '📄', title: 'Reads your document', desc: 'Upload any letter — get issue-by-issue analysis' },
  { icon: '⚡', title: 'One action, tonight', desc: 'Not a list of options — one concrete next step' },
  { icon: '📌', title: 'Remembers your case', desc: 'Never re-explain yourself from day one to day last' },
  { icon: '☕', title: 'Costs less than coffee', desc: 'Less than 15 minutes of a solicitor per month' },
  { icon: '⚖️', title: 'Official sources first', desc: 'Queries UK Gov APIs before using AI' },
];

const PLANS = [
  {
    name: 'Essential',
    price: '£4.99',
    features: ['30 questions/month', '5 document uploads', 'Deadline alerts', 'Case timeline'],
    highlight: false,
  },
  {
    name: 'Active Case',
    price: '£9.99',
    features: ['Unlimited questions', 'Unlimited uploads', 'Solicitor referral', 'Case summary PDF'],
    highlight: true,
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-night">
      <Header />

      <section className="py-24 text-center">
        <Container>
          <h1 className="font-fraunces text-5xl font-bold leading-tight text-text-primary md:text-6xl">
            Know your rights.
            <br />
            <span className="text-gold">Right now.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl leading-relaxed text-text-secondary">
            When you are facing a workplace dispute, you need answers immediately — not a
            lawyer&apos;s voicemail. RightsNow tells you what the law says, what it means for you,
            and what to do tonight.
          </p>
          <section className="mt-12 flex flex-col justify-center gap-4 sm:flex-row">
            <Button variant="primary" size="lg" href="/case/assessment">
              Start your case
            </Button>
            <Button variant="secondary" size="lg" href="/auth/register">
              Try web version
            </Button>
          </section>
        </Container>
      </section>

      <section className="mb-12 bg-slate/40 py-8">
        <Container className="flex flex-wrap justify-center gap-6 text-sm text-text-secondary">
          {['UK Employment Law', 'Official Gov APIs', 'GDPR Compliant', 'General information only'].map(
            (label, i) => (
              <span key={label} className="flex items-center gap-2">
                <span className="text-xl">{['⚖️', '📖', '🔒', '✨'][i]}</span>
                {label}
              </span>
            )
          )}
        </Container>
      </section>

      <section className="py-24">
        <Container>
          <h2 className="mb-16 text-center font-fraunces text-4xl font-bold text-text-primary">
            Built for you, not lawyers
          </h2>
          <section className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title} variant="interactive">
                <p className="mb-4 text-5xl">{feature.icon}</p>
                <h3 className="mb-3 text-lg font-bold text-text-primary">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-text-secondary">{feature.desc}</p>
              </Card>
            ))}
          </section>
        </Container>
      </section>

      <section className="bg-slate/40 py-24">
        <Container>
          <h2 className="mb-16 text-center font-fraunces text-4xl font-bold text-text-primary">
            Simple pricing
          </h2>
          <section className="mx-auto grid max-w-2xl grid-cols-1 gap-8 md:grid-cols-2">
            {PLANS.map((plan) => (
              <Card
                key={plan.name}
                className={plan.highlight ? 'border-2 border-gold bg-gold/5' : undefined}
              >
                <header className="mb-4 flex items-start justify-between">
                  <h3 className="text-2xl font-bold text-text-primary">{plan.name}</h3>
                  {plan.highlight ? <Badge label="Popular" variant="success" /> : null}
                </header>
                <p className="mb-6 flex items-baseline">
                  <span className="text-4xl font-bold text-gold">{plan.price}</span>
                  <span className="ml-2 text-text-secondary">/month</span>
                </p>
                <ul className="mb-8 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-text-secondary">
                      <span className="text-signal-green">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Button variant={plan.highlight ? 'primary' : 'secondary'} size="lg" fullWidth href="/dashboard">
                  Get Started
                </Button>
              </Card>
            ))}
          </section>
          <p className="mt-8 text-center text-sm text-text-secondary">
            7-day free trial. Cancel any time. No lock-in.
          </p>
        </Container>
      </section>

      <section className="py-24 text-center">
        <Container className="max-w-2xl">
          <h2 className="font-fraunces text-4xl font-bold text-text-primary">
            Ready to understand your rights?
          </h2>
          <p className="mt-6 text-xl text-text-secondary">
            Join UK workers who have found clarity during difficult workplace moments.
          </p>
          <Button variant="primary" size="lg" className="mt-12" href="/answer">
            Ask a question
          </Button>
        </Container>
      </section>

      <footer className="mt-24 border-t border-steel bg-slate/40 py-12">
        <Container>
          <section className="mb-8 grid grid-cols-2 gap-8 md:grid-cols-4">
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'Download'] },
              { title: 'Legal', links: ['Terms', 'Privacy', 'GDPR'] },
              { title: 'Support', links: ['Help Center', 'Contact'] },
              { title: 'Social', links: ['Twitter', 'LinkedIn'] },
            ].map((col) => (
              <section key={col.title}>
                <h4 className="mb-3 font-bold text-text-primary">{col.title}</h4>
                <ul className="space-y-2 text-sm text-text-secondary">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="hover:text-gold">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </section>
          <p className="border-t border-steel pt-8 text-center text-sm text-text-tertiary">
            © 2026 RightsNow. UK GDPR compliant. ICO registered.
          </p>
        </Container>
      </footer>
    </main>
  );
}
