import React, { useState } from "react";
import { Link } from "react-router-dom";
import Modal from "react-modal";
import "./home.css";

const features = [
  {
    title: "Compare real opportunities",
    copy: "Keep marketplace demand, source links, pricing, break-even economics, and category context together instead of researching in scattered tabs.",
    icon: "↗",
  },
  {
    title: "Filter down to what matters",
    copy: "Search and narrow the catalog by category, subcategory, item, sold volume, price, and break-even thresholds.",
    icon: "⌁",
  },
  {
    title: "Move from research to decision",
    copy: "Use DataScout as a working sourcing database so promising products can be reviewed, compared, and revisited consistently.",
    icon: "✓",
  },
];

const Home = () => {
  const [modalIsOpen, setModalIsOpen] = useState(false);

  return (
    <main className="ds-home">
      <section className="ds-home-hero">
        <div className="ds-shell ds-home-hero-grid">
          <div className="ds-home-hero-copy">
            <div className="ds-home-eyebrow">PRODUCT SOURCING INTELLIGENCE</div>
            <h1>Find better resale opportunities with less manual research.</h1>
            <p>
              DataScout organizes product demand, sourcing links, pricing, break-even economics, and category data into one decision workspace for online resellers.
            </p>
            <div className="ds-home-actions">
              <Link className="ds-button ds-button-primary" to="/signup">Start free</Link>
              <button className="ds-button ds-button-secondary" type="button" onClick={() => setModalIsOpen(true)}>
                Watch the demo
              </button>
            </div>
            <div className="ds-home-proof">
              <span>Structured sourcing data</span>
              <span>Multi-level filters</span>
              <span>Decision-focused economics</span>
            </div>
          </div>

          <div className="ds-home-preview" aria-label="DataScout product research preview">
            <div className="ds-preview-toolbar">
              <span className="ds-preview-dot" />
              <span>Product opportunity view</span>
              <span className="ds-preview-status">Filtered</span>
            </div>
            <div className="ds-preview-filters">
              <span>Home & Garden</span><span>$20–$80</span><span>Sold 50+</span>
            </div>
            <div className="ds-preview-row ds-preview-head"><span>Product</span><span>Sold</span><span>Price</span><span>BEP</span></div>
            <div className="ds-preview-row"><span>Storage organizer</span><strong>184</strong><span>$39.95</span><span>$21.40</span></div>
            <div className="ds-preview-row"><span>Cabinet hardware set</span><strong>129</strong><span>$46.00</span><span>$25.10</span></div>
            <div className="ds-preview-row"><span>Workshop accessory</span><strong>96</strong><span>$58.50</span><span>$31.75</span></div>
            <div className="ds-preview-note">Illustrative interface preview — not live marketplace data.</div>
          </div>
        </div>
      </section>

      <section className="ds-home-section">
        <div className="ds-shell">
          <div className="ds-home-section-heading">
            <div className="ds-home-eyebrow">A CLEANER SOURCING LOOP</div>
            <h2>Research once. Keep the intelligence.</h2>
            <p>DataScout is built around the recurring work of sourcing: collect evidence, compare economics, narrow the field, and keep the best candidates organized.</p>
          </div>
          <div className="ds-home-feature-grid">
            {features.map((feature) => (
              <article className="ds-home-feature" key={feature.title}>
                <span className="ds-feature-icon">{feature.icon}</span>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ds-home-workflow">
        <div className="ds-shell ds-home-workflow-grid">
          <div>
            <div className="ds-home-eyebrow">HOW IT WORKS</div>
            <h2>From candidate to decision in four steps.</h2>
          </div>
          <ol>
            <li><span>1</span><div><strong>Capture</strong><p>Add or import candidate products and their source/marketplace evidence.</p></div></li>
            <li><span>2</span><div><strong>Normalize</strong><p>Keep titles, sold volume, price, break-even economics, dimensions, and category hierarchy in a consistent schema.</p></div></li>
            <li><span>3</span><div><strong>Filter</strong><p>Use search and range filters to surface the opportunities worth deeper review.</p></div></li>
            <li><span>4</span><div><strong>Decide</strong><p>Open the buy and sell evidence, compare economics, and keep the candidate in your research system.</p></div></li>
          </ol>
        </div>
      </section>

      <section className="ds-home-cta">
        <div className="ds-shell ds-home-cta-inner">
          <div>
            <div className="ds-home-eyebrow">START WITH YOUR NEXT PRODUCT IDEA</div>
            <h2>Turn scattered sourcing research into a reusable asset.</h2>
          </div>
          <Link className="ds-button ds-home-light-button" to="/signup">Create an account</Link>
        </div>
      </section>

      <Modal
        isOpen={modalIsOpen}
        onRequestClose={() => setModalIsOpen(false)}
        contentLabel="DataScout demo video"
        className="ds-video-modal"
        overlayClassName="ds-video-overlay"
        ariaHideApp={false}
      >
        <button className="ds-video-close" type="button" onClick={() => setModalIsOpen(false)} aria-label="Close video">×</button>
        <iframe
          src="https://www.youtube.com/embed/biou722jhIU?autoplay=1"
          title="DataScout Demo Video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </Modal>
    </main>
  );
};

export default Home;
