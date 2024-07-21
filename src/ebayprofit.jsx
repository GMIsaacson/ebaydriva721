import React, { useState } from "react";
import "./ebaycalculator.css";

const ProfitCalculator = () => {
  const [cost, setCost] = useState(0);
  const [shippingCharge, setShippingCharge] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [categoryFeePercent, setCategoryFeePercent] = useState(10);
  const [additionalCost, setAdditionalCost] = useState(0);
  const [stateTaxPercent, setStateTaxPercent] = useState(0);

  const calculateDetails = () => {
    const ebayFee = sellingPrice * (categoryFeePercent / 100);
    const paypalFee = sellingPrice * 0.029 + 0.3; // PayPal fee: 2.9% + $0.30
    const stateTax = sellingPrice * (stateTaxPercent / 100);
    const totalCost =
      parseFloat(cost) +
      parseFloat(shippingCharge) +
      parseFloat(additionalCost) +
      ebayFee +
      paypalFee +
      stateTax;
    const profit = sellingPrice - totalCost;

    return {
      ebayFee,
      paypalFee,
      stateTax,
      totalCost,
      profit,
    };
  };

  const details = calculateDetails();

  return (
    <div className="profit-calculator">
      <h2>eBay Profit Calculator</h2>
      <label>
        Cost of Item:
        <input
          type="number"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="Cost of Item"
        />
      </label>
      <label>
        Shipping Charge:
        <input
          type="number"
          value={shippingCharge}
          onChange={(e) => setShippingCharge(e.target.value)}
          placeholder="Shipping Charge"
        />
      </label>
      <label>
        Selling Price:
        <input
          type="number"
          value={sellingPrice}
          onChange={(e) => setSellingPrice(e.target.value)}
          placeholder="Selling Price"
        />
      </label>
      <label>
        Category Fee Percentage:
        <input
          type="number"
          value={categoryFeePercent}
          onChange={(e) => setCategoryFeePercent(e.target.value)}
          placeholder="Category Fee Percentage"
        />
      </label>
      <label>
        Additional Costs (packaging, returns, etc.):
        <input
          type="number"
          value={additionalCost}
          onChange={(e) => setAdditionalCost(e.target.value)}
          placeholder="Additional Costs"
        />
      </label>
      <label>
        State Tax Percentage:
        <input
          type="number"
          value={stateTaxPercent}
          onChange={(e) => setStateTaxPercent(e.target.value)}
          placeholder="State Tax Percentage"
        />
      </label>

      <div className="result-details">
        <h3>Profit Details:</h3>
        <p>Ebay Fee: ${details.ebayFee.toFixed(2)}</p>
        <p>PayPal Fee: ${details.paypalFee.toFixed(2)}</p>
        <p>State Tax: ${details.stateTax.toFixed(2)}</p>
        <p>Total Costs: ${details.totalCost.toFixed(2)}</p>
        <p>Profit: ${details.profit.toFixed(2)}</p>
      </div>
    </div>
  );
};

export default ProfitCalculator;
