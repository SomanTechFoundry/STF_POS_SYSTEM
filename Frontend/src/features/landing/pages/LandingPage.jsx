import { Link } from "react-router-dom";

const COPYRIGHT_TEXT = `Copyright © ${new Date().getFullYear()} Soman Tech Foundry. All rights reserved.`;

const coreModules = [
  "Unified POS for Retail, Wholesale, and Purchase orders",
  "Variant-aware product catalog with unit packs (ml, ltr, g, kg, pcs)",
  "Inventory visibility by location (Main Store / Godown)",
  "Customer search and quick creation during billing",
  "Dashboard KPIs and bill timeline for daily review",
  "Role-based access and admin business impersonation",
  "English/Tamil-ready platform with configurable billing profiles"
];

const pricingPlans = [
  {
    name: "Free Tier",
    label: "Starter",
    value: "₹0",
    caption: "per month",
    points: [
      "Single business setup",
      "Basic POS + product catalog",
      "Customer and inventory essentials",
      "Standard dashboard view"
    ],
    cta: "Get Started"
  },
  {
    name: "Growth Tier",
    label: "Business",
    value: "Contact sales team",
    caption: "custom plan",
    points: [
      "Retail + Wholesale + Purchase workflows",
      "Advanced inventory and variant operations",
      "Configuration and translation controls",
      "Assisted onboarding and support"
    ],
    cta: "Contact Sales",
    featured: true
  },
  {
    name: "Scale Tier",
    label: "Enterprise",
    value: "Contact sales team",
    caption: "custom plan",
    points: [
      "Everything in Growth",
      "Multi-branch rollout guidance",
      "Custom process alignment",
      "Priority success support"
    ],
    cta: "Contact Sales"
  }
];

function LandingPage() {
  return (
    <div id="home-top" className="landing-page sbo-landing sbo-landing-minimal">
      <header className="landing-header sbo-header sbo-header-minimal">
        <div className="sbo-header-inner">
          <div className="sbo-header-left">
            <a href="/" className="landing-brand sbo-brand-link" aria-label="Go to home page">
              <h1 className="sbo-brand-title">SellthruBOS</h1>
              <span className="brand-chip sbo-brand-subtitle">STF - Soman Tech Foundry</span>
            </a>
            <nav className="sbo-header-nav">
              <a href="#features" className="landing-link-btn">Features</a>
              <a href="#pricing" className="landing-link-btn">Pricing</a>
            </nav>
          </div>
          <div className="landing-auth-actions sbo-header-auth">
            <Link to="/login" className="landing-link-btn outline">Login</Link>
            <Link to="/register" className="landing-link-btn primary">Sign Up</Link>
          </div>
        </div>
      </header>

      <main className="landing-main">
        <section className="card sbo-hero sbo-hero-minimal">
          <div className="sbo-hero-copy">
            <p className="sbo-eyebrow">SELLTHRUBOS PLATFORM</p>
            <h2>Control sales, stock, and purchasing from one clean workspace.</h2>
            <p className="muted">
              SellthruBOS unifies retail billing, wholesale invoicing, purchase intake, and inventory visibility in one practical flow.
              Deliver faster checkout, smarter stock control, and secure role-based operations, built by STF for daily business execution.
            </p>
            <div className="landing-hero-cta">
              <Link to="/register" className="landing-link-btn primary">Start Free</Link>
              <a href="#pricing" className="landing-link-btn">Explore Plans</a>
            </div>
          </div>
        </section>

        <section id="features" className="card sbo-feature-block">
          <div className="landing-section-head">
            <h3>What you already get with SellthruBOS</h3>
            <p className="muted">Production-ready capabilities available in your current build.</p>
          </div>
          <div className="sbo-feature-grid">
            {coreModules.map((item) => (
              <article key={item} className="sbo-feature-item sbo-feature-item-minimal">
                <span className="sbo-feature-bullet" aria-hidden="true" />
                <p>{item}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="pricing" className="sbo-pricing-wrap">
          <div className="landing-section-head">
            <h3>Pricing</h3>
            <p className="muted">Start free, scale based on your business requirements.</p>
          </div>

          <div className="sbo-pricing-grid">
            {pricingPlans.map((plan) => (
              <article key={plan.name} className={`card sbo-pricing-card sbo-pricing-card-minimal${plan.featured ? " featured" : ""}`}>
                <p className="sbo-plan-label">{plan.label}</p>
                <h4>{plan.name}</h4>
                <p className="sbo-plan-value">{plan.value}</p>
                <p className="muted small">{plan.caption}</p>
                <div className="sbo-plan-points">
                  {plan.points.map((point) => (
                    <p key={point}>{point}</p>
                  ))}
                </div>
                <Link to="/register" className={`landing-link-btn${plan.featured ? " primary" : ""}`}>
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="card sbo-bottom-cta sbo-bottom-cta-minimal">
          <h3>Run your business operations with confidence.</h3>
          <p className="muted">SellthruBOS is engineered by STF for practical day-to-day execution.</p>
          <div className="landing-hero-cta">
            <Link to="/register" className="landing-link-btn primary">Create Account</Link>
            <Link to="/login" className="landing-link-btn">Client Login</Link>
          </div>
        </section>
      </main>

      <p className="app-copyright centered-copy">{COPYRIGHT_TEXT}</p>
    </div>
  );
}

export default LandingPage;
