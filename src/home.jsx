import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "react-modal";
import "./login.css";
import "./home.css";

const Home = () => {
  const navigate = useNavigate();

  const handleSignupRedirect = () => {
    navigate("/signup");
  };
  const [modalIsOpen, setModalIsOpen] = useState(false);

  const openModal = () => {
    setModalIsOpen(true);
  };

  const closeModal = () => {
    setModalIsOpen(false);
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-background">
          <div className="container">
            <div className="hero-content">
              <h1>Easily Source Products from Alibaba for Your eBay Store</h1>
              <h2>
                Streamline your product sourcing and grow your eBay business
                with ease.
              </h2>
              <button className="cta-btn" onClick={handleSignupRedirect}>
                Get Started for Free
              </button>
            </div>
          </div>
        </div>
      </section>

     
      {/* Features Section */}
{/* Features Section */}
<section className="features-section" id="features">
  <div className="container">
    <h2 className="section-heading">Key Features</h2>
    <div className="features-grid">
      {[
        {
          icon: (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="icon"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 20.5l4.9-3.3a8.38 8.38 0 003.1-6.7V6.75L12 3.5 4 6.75v3.75a8.38 8.38 0 003.1 6.7L12 20.5z"
              />
            </svg>
          ),
          title: "Product Data & Insights",
          description: "Explore detailed product data and market insights.",
        },
        {
          icon: (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="icon"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16m-7 6h7"
              />
            </svg>
          ),
          title: "eBay Profit Calculator",
          description: "Calculate potential profits with our integrated calculator.",
        },
        {
          icon: (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="icon"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.25 6.75a3.75 3.75 0 107.5 0M10.25 6.75h7.5m-7.5 0a3.75 3.75 0 117.5 0m-7.5 0V21M6.75 8.75v8.5m10.5 0V8.75M6.75 17.25h10.5"
              />
            </svg>
          ),
          title: "Category Filters",
          description: "Navigate through products with advanced category filters.",
        },
        {
          icon: (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="icon"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 8H5m14 0v8m0-8l-7 6m0 0l-7-6m7 6v8"
              />
            </svg>
          ),
          title: "Supplier Information",
          description: "Access reliable supplier information for informed decisions.",
        },
      ].map((feature, index) => (
        <div className="feature-item" key={index}>
          <div className="icon-wrapper">{feature.icon}</div>
          <h3>{feature.title}</h3>
          <p>{feature.description}</p>
        </div>
      ))}
    </div>
  </div>
</section>
<section className="demo-section">
      <div className="container">
        <h2>See DataScout in Action</h2>
        <div className="video-wrapper">
          {/* Video Thumbnail */}
          <div
            className="video-thumbnail"
            style={{
              
              backgroundImage: `url('/images/Screenshot 2024-11-27 115031.png')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          >
            <button className="play-video-btn" onClick={openModal}>
              <svg
                height="100%"
                version="1.1"
                viewBox="0 0 68 48"
                width="100%"
              >
                <path
                  className="ytp-large-play-button-bg"
                  d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z"
                  fill="#f00"
                ></path>
                <path d="M 45,24 27,14 27,34" fill="#fff"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Modal for Video */}
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        contentLabel="Video Modal"
        className="video-modal"
        overlayClassName="video-modal-overlay"
      >
        <div className="modal-content">
          <button onClick={closeModal} className="close-modal-btn">
            &times;
          </button>
          <iframe
            width="100%"
            height="100%"
            src="https://www.youtube.com/embed/biou722jhIU?autoplay=1"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="DataScout Demo Video"
          ></iframe>
        </div>
      </Modal>
    </section>



      {/* Testimonials Section */}
      <section className="testimonials-section" id="testimonials">
        <div className="container">
          <h2>What Our Users Say</h2>
          <div className="testimonials-grid">
            <div className="testimonial-item">
              <p>
                "DataScout has transformed my eBay business. The profit
                calculator is a game-changer!"
              </p>
              <h3>John Doe</h3>
              <p>eBay Seller</p>
            </div>
            <div className="testimonial-item">
              <p>
                "I love how easy it is to filter through products. It has helped
                me stay competitive."
              </p>
              <h3>Jane Smith</h3>
              <p>eBay Store Owner</p>
            </div>
            <div className="testimonial-item">
              <p>
                "The supplier information feature gives me peace of mind. I can
                trust the products I source."
              </p>
              <h3>Sam Lee</h3>
              <p>eBay Entrepreneur</p>
            </div>
          </div>
        </div>
      </section>
      

      {/* Pricing Section */}
      <section className="pricing-section" id="pricing">
        <div className="container">
          <h2>Pricing</h2>
          <div className="pricing-table">
            <div className="pricing-tier">
              <h3>Basic</h3>
              <p>$9.99/month</p>
              <ul>
                <li>Product Data & Insights</li>
                <li>eBay Profit Calculator</li>
                <li>Email Support</li>
              </ul>
              <button className="cta-btn">Start Free Trial</button>
            </div>
            <div className="pricing-tier">
              <h3>Pro</h3>
              <p>$19.99/month</p>
              <ul>
                <li>All Basic Features</li>
                <li>Advanced Filters</li>
                <li>Priority Support</li>
              </ul>
              <button className="cta-btn">Start Free Trial</button>
            </div>
            <div className="pricing-tier">
              <h3>Enterprise</h3>
              <p>Contact Us</p>
              <ul>
                <li>All Pro Features</li>
                <li>Supplier Information</li>
                <li>Dedicated Account Manager</li>
              </ul>
              <button className="cta-btn">Contact Sales</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
