import React from 'react';
import './footer.css'; // Ensuring the CSS file is properly linked

const Footer = () => {
    return (
        <footer className="footer">
            <div className="footer-content">
                <div className="footer-section about">
                    <h2>SalesScope</h2>
                    <p>SalesScope is a powerful tool designed to enhance your eCommerce operations by providing detailed insights into product performance, market trends, and profitability.</p>
                </div>
                <div className="footer-section links">
    <h3>Quick Links</h3>
    <ul>
        <li>
            <a href="#home" style={{
                color: '#aad3df', // Soft blue for links
                textDecoration: 'none', // No underline by default
                backgroundColor: 'transparent', // Ensure no background color
                padding: '8px', // Padding for better clickability
                borderRadius: '5px', // Rounded corners for visual appeal
                transition: 'color 0.3s ease' // Smooth transition for color change
            }}>Home</a>
        </li>
        <li>
            <a href="#about" style={{
                color: '#aad3df', // Apply same styles as above
                textDecoration: 'none',
                backgroundColor: 'transparent',
                padding: '8px',
                borderRadius: '5px',
                transition: 'color 0.3s ease'
            }}>About Us</a>
        </li>
        <li>
            <a href="#services" style={{
                color: '#aad3df',
                textDecoration: 'none',
                backgroundColor: 'transparent',
                padding: '8px',
                borderRadius: '5px',
                transition: 'color 0.3s ease'
            }}>Services</a>
        </li>
        <li>
            <a href="#contact" style={{
                color: '#aad3df',
                textDecoration: 'none',
                backgroundColor: 'transparent',
                padding: '8px',
                borderRadius: '5px',
                transition: 'color 0.3s ease'
            }}>Contact</a>
        </li>
    </ul>
</div>

                <div className="footer-section contact-form">
                    <h3>Contact Us</h3>
                    <p>If you have any questions, please email us at <a href="mailto:support@salesscope.com">support@salesscope.com</a>.</p>
                </div>
            </div>
            <div className="footer-bottom">
                &copy; {new Date().getFullYear()} SalesScope | All Rights Reserved
            </div>
        </footer>
    );
};

export default Footer;