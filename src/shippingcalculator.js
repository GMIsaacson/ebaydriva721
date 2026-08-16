import React, { useState } from "react";
import "./app6.css";
function ShippingCalculator() {
  const [dimensions, setDimensions] = useState({
    length: "",
    width: "",
    height: "",
  });
  const [weight, setWeight] = useState("");
  const [shippingCosts, setShippingCosts] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "weight") {
      setWeight(value);
    } else {
      setDimensions({ ...dimensions, [name]: value });
    }
  };

  const calculateShipping = () => {
    const { length, width, height } = dimensions;
    const volume = length * width * height;
    const weightNum = parseFloat(weight);
    const dimensionalWeight = volume / 5000; // Dimensional weight calculation (using cm)
    const billableWeight = Math.max(weightNum, dimensionalWeight); // Use the greater of actual weight or dimensional weight

    let uspsCost, upsCost, fedexCost;

    // USPS Cost Calculation
    if (billableWeight <= 0.45) {
      // Under 1 lb (0.45 kg)
      uspsCost = 3.5; // Typical rate for USPS First Class small package
    } else if (billableWeight <= 1) {
      uspsCost = 5; // Slightly higher rate for heavier small packages
    } else if (volume <= 100000 && billableWeight <= 20) {
      uspsCost = 15; // Flat rate for USPS Medium Flat Rate Box
    } else {
      uspsCost = 20 + billableWeight * 0.65; // Base rate plus per kg cost for larger/heavier items
    }

    // UPS Cost Calculation
    if (billableWeight <= 1) {
      upsCost = 10; // Base rate for small packages
    } else {
      upsCost = 15 + billableWeight * 0.75; // Base rate plus per kg cost
    }

    // FedEx Cost Calculation
    if (billableWeight <= 1) {
      fedexCost = 9; // Base rate for small packages
    } else {
      fedexCost = 15 + billableWeight * 0.8; // Base rate plus per kg cost
    }

    setShippingCosts({
      usps: `USPS Estimated Shipping Cost: $${uspsCost.toFixed(2)}`,
      ups: `UPS Estimated Shipping Cost: $${upsCost.toFixed(2)}`,
      fedex: `FedEx Estimated Shipping Cost: $${fedexCost.toFixed(2)}`,
    });
  };

  return (
    <div id="shipping-calculator">
      <h2>Shipping Cost Calculator</h2>
      <div>
        <label>
          Length (cm):
          <input
            type="number"
            name="length"
            value={dimensions.length}
            onChange={handleInputChange}
          />
        </label>
      </div>
      <div>
        <label>
          Width (cm):
          <input
            type="number"
            name="width"
            value={dimensions.width}
            onChange={handleInputChange}
          />
        </label>
      </div>
      <div>
        <label>
          Height (cm):
          <input
            type="number"
            name="height"
            value={dimensions.height}
            onChange={handleInputChange}
          />
        </label>
      </div>
      <div>
        <label>
          Weight (kg):
          <input
            type="number"
            name="weight"
            value={weight}
            onChange={handleInputChange}
          />
        </label>
      </div>
      <button onClick={calculateShipping}>Calculate Shipping Cost</button>
      {shippingCosts && (
        <div>
          <h3>{shippingCosts.usps}</h3>
          <h3>{shippingCosts.ups}</h3>
          <h3>{shippingCosts.fedex}</h3>
        </div>
      )}
    </div>
  );
}

export default ShippingCalculator;