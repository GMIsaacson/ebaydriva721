import React, { useState } from "react";
import "./calculator.css";

function Calculators() {
  const [sellingPrice, setSellingPrice] = useState("");
  const [desiredProfit, setDesiredProfit] = useState("");
  const [weight, setWeight] = useState("");
  const [dimensions, setDimensions] = useState({
    length: "",
    width: "",
    height: "",
  });
  const [packaging, setPackaging] = useState("bubbleMailer");
  const [maxBuyingCost, setMaxBuyingCost] = useState(null);
  const [details, setDetails] = useState(null);

  const ebayFeeRate = 0.13; // eBay fee (13%)
  const paymentProcessingRate = 0.029; // Payment processing fee (2.9%)
  const paymentProcessingFixed = 0.3; // Fixed processing fee ($0.30)

  // Packaging options and their costs
  const packagingCosts = {
    bubbleMailer: 0.5,
    smallBox: 1.0,
    mediumBox: 2.0,
    largeBox: 3.0,
  };

  // Calculate Shipping Cost based on weight and dimensions
  const calculateShippingCost = () => {
    const { length, width, height } = dimensions;
    const volumetricWeight = (length * width * height) / 5000;
    const effectiveWeight = Math.max(weight, volumetricWeight);

    const ratePerPound = effectiveWeight <= 2 ? 3 : 2;
    return effectiveWeight * ratePerPound;
  };

  // Calculate the maximum buying cost to meet the desired profit
  const calculateMaxBuyingCost = () => {
    const sellingPriceNum = parseFloat(sellingPrice);
    const desiredProfitNum = parseFloat(desiredProfit);

    // Calculate fees
    const ebayFee = sellingPriceNum * ebayFeeRate;
    const paymentProcessingFee =
      sellingPriceNum * paymentProcessingRate + paymentProcessingFixed;

    // Calculate shipping and packaging costs
    const shippingCost = calculateShippingCost();
    const packagingCost = packagingCosts[packaging];

    const maxBuyingCost =
      sellingPriceNum -
      ebayFee -
      paymentProcessingFee -
      shippingCost -
      packagingCost -
      desiredProfitNum;

    setMaxBuyingCost(maxBuyingCost.toFixed(2));
    setDetails({
      ebayFee: ebayFee.toFixed(2),
      paymentProcessingFee: paymentProcessingFee.toFixed(2),
      shippingCost: shippingCost.toFixed(2),
      packagingCost: packagingCost.toFixed(2),
      totalCosts: (
        ebayFee +
        paymentProcessingFee +
        shippingCost +
        packagingCost
      ).toFixed(2),
    });
  };

  return (
    <div
      className="calculator"
      style={{ padding: "20px", maxWidth: "500px", margin: "0 auto" }}
    >
      <h2>Profitability Calculator</h2>
      <label>
        Selling Price ($):
        <input
          type="number"
          value={sellingPrice}
          onChange={(e) => setSellingPrice(e.target.value)}
        />
      </label>

      <label>
        Desired Profit ($):
        <input
          type="number"
          value={desiredProfit}
          onChange={(e) => setDesiredProfit(e.target.value)}
        />
      </label>

      <h3>Item Specifications</h3>

      <label>
        Weight (lbs):
        <input
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
      </label>

      <label>
        Dimensions (inches):
        <div style={{ display: "flex", gap: "8px", margin: "8px 0" }}>
          <input
            type="number"
            placeholder="Length"
            value={dimensions.length}
            onChange={(e) =>
              setDimensions({ ...dimensions, length: e.target.value })
            }
          />
          <input
            type="number"
            placeholder="Width"
            value={dimensions.width}
            onChange={(e) =>
              setDimensions({ ...dimensions, width: e.target.value })
            }
          />
          <input
            type="number"
            placeholder="Height"
            value={dimensions.height}
            onChange={(e) =>
              setDimensions({ ...dimensions, height: e.target.value })
            }
          />
        </div>
      </label>

      <label>
        Packaging Type:
        <select
          value={packaging}
          onChange={(e) => setPackaging(e.target.value)}
        >
          <option value="bubbleMailer">Bubble Mailer ($0.50)</option>
          <option value="smallBox">Small Box ($1.00)</option>
          <option value="mediumBox">Medium Box ($2.00)</option>
          <option value="largeBox">Large Box ($3.00)</option>
        </select>
      </label>

      <button onClick={calculateMaxBuyingCost}>
        Calculate Max Buying Cost
      </button>

      {maxBuyingCost !== null && (
        <div className="results">
          <h3>Results</h3>
          <p>Maximum Buying Cost: ${maxBuyingCost}</p>
          <h4>Cost Breakdown</h4>
          <p>eBay Fee: ${details.ebayFee}</p>
          <p>Payment Processing Fee: ${details.paymentProcessingFee}</p>
          <p>Shipping Cost: ${details.shippingCost}</p>
          <p>Packaging Cost: ${details.packagingCost}</p>
          <p>Total Costs (without buying cost): ${details.totalCosts}</p>
        </div>
      )}
    </div>
  );
}

export default Calculators;