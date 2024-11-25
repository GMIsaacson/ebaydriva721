import React, { useState } from "react";
import { CSVLink } from "react-csv";
import "./styles.css";
<css></css>;

// Updated categories with nested structure
const categories = {
    "Home & Garden": {
      Bath: {
        "Bathroom Accessories": [
          "Bathroom Accessory Mixed Lots",
          "Bathroom Accessory Sets",
          "Bathroom Cabinets",
          "Bathroom Cladding Panels",
          "Bathroom Sinks & Vanities",
          "Bathroom Suites",
          "Showers, Bathtubs & Parts",
          "Shower & Bathtub Accessories",
          "Steam Showers",
          "Toilets & Bidets",
        ],
        "Bath Mats, Rugs & Toilet": [
          "Bath Mats, Rugs & Toilet Covers",
          "Bathroom Baskets & Storage",
          "Bathroom Scales",
          "Drain Stoppers & Strainers",
          "Mirrors",
          "Other Bathroom Accessories",
          "Shelves",
          "Soap Dishes & Dispensers",
          "Tile Décor",
          "Tissue Box Covers",
          "Toilet Brushes & Holders",
          "Toilet Paper Holders & Storage",
          "Towel Racks",
          "Towels & Washcloths",
          "Tumblers & Toothbrush Holders",
          "Wall Hooks & Hangers",
        ],
      },
    
      Bedding: {
        "See all in Bedding": [],
        "Bed Pillows": [
          "Down Bed Pillows",
          "Memory Foam Bed Pillows",
          "Standard Bed Pillows",
          "Specialty Bed Pillows",
        ],
        "Bed Skirts": [
          "Dust Ruffles",
          "Pleated Bed Skirts",
          "Ruffled Bed Skirts",
        ],
        "Bed-in-a-Bag": [
          "Complete Bedding Sets",
          "Comforter Sets",
          "Duvet Cover Sets",
        ],
        "Bedding Accessories": [
          "Bed Risers",
          "Bedding Storage Bags",
          "Bed Canopies",
          "Decorative Pillow Inserts",
        ],
        "Blankets & Throws": [
          "Weighted Blankets",
          "Fleece Blankets",
          "Wool Throws",
          "Heated Blankets",
        ],
        "Canopies & Netting": [
          "Mosquito Nets",
          "Four-Poster Canopies",
          "Hanging Canopies",
        ],
        "Comforters & Sets": [
          "Down Comforters",
          "Synthetic Comforters",
          "Reversible Comforters",
        ],
        "Duvet Covers & Sets": [
          "Cotton Duvet Covers",
          "Linen Duvet Covers",
          "Silk Duvet Covers",
        ],
        "Duvet Inserts": [
          "Down Duvet Inserts",
          "Synthetic Duvet Inserts",
          "All-Season Duvet Inserts",
        ],
        "Mattress & Pillow Protectors": [
          "Waterproof Mattress Protectors",
          "Hypoallergenic Mattress Protectors",
          "Zippered Pillow Protectors",
        ],
        "Mattress Pads & Toppers": [
          "Memory Foam Toppers",
          "Cooling Mattress Pads",
          "Featherbed Toppers",
        ],
        "Nursery Bedding": [
          "Crib Bedding Sets",
          "Bassinet Bedding",
          "Changing Table Covers",
        ],
        "Pillow Shams": [
          "Standard Pillow Shams",
          "Euro Pillow Shams",
          "King Pillow Shams",
        ],
        Pillowcases: [
          "Standard Pillowcases",
          "Silk Pillowcases",
          "Cotton Pillowcases",
        ],
        "Quilts, Bedspreads & Coverlets": [
          "Handmade Quilts",
          "Cotton Coverlets",
          "Decorative Bedspreads",
        ],
        Sheets: [
          "Fitted Sheets",
          "Flat Sheets",
          "Sheet Sets",
        ],
      },
      
      "Candles & Home Fragrance": {
        "Candles": [],
        "Candle Holders": [],
        "Reed Diffusers & Oils": [],
        "Other Home Fragrance": [],
      },
      "Food & Beverages": {
        "Coffee & Tea": [],
        "Non-Perishable Items": [],
        "Snacks": [],
      },
      "Fresh Cut Flowers": {
        Bouquets: [],
        Roses: [],
        "Seasonal Flowers": [],
      },
      Furniture: {
        Sofas: [],
        Chairs: [],
        Tables: [],
        "Storage Units": [],
      },
      "Greeting Cards & Party Supply": {
        Cards: [],
        Balloons: [],
        "Party Favors": [],
      },
      "Holiday & Seasonal Décor": {
        "Christmas Decorations": [],
        "Halloween Decorations": [],
        "Easter Decorations": [],
      },
      "Home Décor": {
        "Wall Art": [],
        Mirrors: [],
        Clocks: [],
      },
      "Home Improvement": {
        "Tools & Equipment": [],
        "Paint & Supplies": [],
      },
      "Household Supplies & Cleaning": {
        "Cleaning Tools": [],
        "Laundry Supplies": [],
        "Paper Goods": [],
      },
      "Kids & Teens at Home": {
        "Kids' Furniture": [],
        "Decor for Kids": [],
      },
      "Kitchen, Dining & Bar": {
        "Kitchen Tools": [],
        "Dining Sets": [],
        "Bar Supplies": [],
      },
      "Lamps, Lighting & Ceiling Fans": {
        Lamps: [],
        "Ceiling Fans": [],
        "Outdoor Lighting": [],
      },
      "Major Appliances": {
        Refrigerators: [],
        Dishwashers: [],
        "Washing Machines": [],
      },
      Pillows: {
        "Throw Pillows": [],
        "Decorative Pillows": [],
      },
      "Rugs & Carpets": {
        "Area Rugs": [],
        Carpets: [],
        "Runners": [],
      },
      "School Supplies": {
        "Backpacks": [],
        "Stationery": [],
        "Art Supplies": [],
      },
      "Tools & Workshop Equipment": {
        Drills: [],
        "Tool Kits": [],
      },
      "Wedding Supplies": {
        "Wedding Décor": [],
        "Favors": [],
      },
      "Wholesale Lots": {
        Electronics: [],
        "Home Goods": [],
      },
      "Window Treatments & Hardware": {
        Curtains: [],
        Blinds: [],
        "Curtain Rods": [],
      },
    },
  };
  

function Csvtool() {
  const [tableData, setTableData] = useState([]);

  // Handle category change for each row
  const handleCategoryChange = (index, e) => {
    const newData = [...tableData];
    newData[index].category = e.target.value;
    newData[index].subCategory = ""; // Reset subcategory
    newData[index].item = ""; // Reset item
    setTableData(newData);
  };

  // Handle subcategory change for each row
  const handleSubCategoryChange = (index, e) => {
    const newData = [...tableData];
    newData[index].subCategory = e.target.value;
    newData[index].item = ""; // Reset item
    setTableData(newData);
  };

  // Handle item change for each row
  const handleItemChange = (index, e) => {
    const newData = [...tableData];
    newData[index].item = e.target.value;
    setTableData(newData);
  };

  // Handle input change in the table for each row
  const handleInputChange = (index, event) => {
    const newData = [...tableData];
    newData[index][event.target.name] = event.target.value;
    setTableData(newData);
  };

  // Add a new row to the table with initial empty data
  const handleAddRow = () => {
    setTableData([
      ...tableData,
      {
        title: "",
        sold: "",
        price: "",
        profit: "",
        dimension: "",
        productOnEbay: "",
        source: "",
        category: "",
        subCategory: "",
        item: "",
      },
    ]);
  };

  // Convert inputs to JSON format
  const handleConvertToJson = () => {
    const jsonData = {
      category: tableData[0].category,
      subcategories: Object.keys(categories[tableData[0].category] || {}).map(
        (subCategory) => ({
          name: subCategory,
          subcategories: Object.keys(
            categories[tableData[0].category][subCategory] || {}
          ).map((subSubCategory) => ({
            name: subSubCategory,
            subcategories:
              categories[tableData[0].category][subCategory][subSubCategory] ||
              [],
          })),
        })
      ),
    };

    const jsonBlob = new Blob([JSON.stringify(jsonData, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(jsonBlob);
    link.download = "category_structure.json";
    link.click();
  };

  // Get subcategories based on selected category for each row
  const getSubCategories = (category) => {
    return category ? Object.keys(categories[category] || {}) : [];
  };

  // Get sub-subcategories based on selected subcategory for each row
  const getSubSubCategories = (category, subCategory) => {
    if (category && subCategory) {
      return Object.keys(categories[category][subCategory] || {});
    }
    return [];
  };

  // Get items based on selected sub-subcategory for each row
  const getItems = (category, subCategory, subSubCategory) => {
    if (category && subCategory && subSubCategory) {
      return categories[category][subCategory][subSubCategory] || [];
    }
    return [];
  };

  return (
    <>
      <div style={{ padding: "20px" }}>
        <h1>CSV Builder</h1>
        <div>
          {/* Add Row Button */}
          <button onClick={handleAddRow} style={{ marginTop: "10px" }}>
            Add Row
          </button>
        </div>

        {/* Table Section */}
        <table
          border="1"
          cellPadding="5"
          style={{ marginTop: "20px", width: "100%" }}
        >
          <thead>
            <tr>
              <th>Title</th>
              <th>Sold</th>
              <th>Price</th>
              <th>Profit</th>
              <th>Dimension</th>
              <th>Product on eBay</th>
              <th>Source</th>
              <th>Category</th>
              <th>SubCategory</th>
              <th>Sub-SubCategory</th>
              <th>Item</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, index) => (
              <tr key={index}>
                {/* Input Fields */}
                <td>
                  <input
                    type="text"
                    name="title"
                    onChange={(e) => handleInputChange(index, e)}
                    value={row.title}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    name="sold"
                    onChange={(e) => handleInputChange(index, e)}
                    value={row.sold}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    name="price"
                    onChange={(e) => handleInputChange(index, e)}
                    value={row.price}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    name="profit"
                    onChange={(e) => handleInputChange(index, e)}
                    value={row.profit}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    name="dimension"
                    onChange={(e) => handleInputChange(index, e)}
                    value={row.dimension}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    name="productOnEbay"
                    onChange={(e) => handleInputChange(index, e)}
                    value={row.productOnEbay}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    name="source"
                    onChange={(e) => handleInputChange(index, e)}
                    value={row.source}
                  />
                </td>
                {/* Category Selection */}
                <td>
                  <select
                    onChange={(e) => handleCategoryChange(index, e)}
                    value={row.category}
                  >
                    <option value="">Select Category</option>
                    {Object.keys(categories).map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </td>
                {/* SubCategory Selection */}
                <td>
                  {row.category && (
                    <select
                      onChange={(e) => handleSubCategoryChange(index, e)}
                      value={row.subCategory}
                    >
                      <option value="">Select Sub-Category</option>
                      {getSubCategories(row.category).map((subCategory) => (
                        <option key={subCategory} value={subCategory}>
                          {subCategory}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                {/* Sub-SubCategory Selection */}
                <td>
                  {row.subCategory && (
                    <select
                      onChange={(e) => {
                        const newData = [...tableData];
                        newData[index].subSubCategory = e.target.value;
                        newData[index].item = ""; // Reset item
                        setTableData(newData);
                      }}
                      value={row.subSubCategory || ""}
                    >
                      <option value="">Select Sub-SubCategory</option>
                      {getSubSubCategories(row.category, row.subCategory).map(
                        (subSubCategory) => (
                          <option key={subSubCategory} value={subSubCategory}>
                            {subSubCategory}
                          </option>
                        )
                      )}
                    </select>
                  )}
                </td>
                {/* Item Selection */}
                <td>
                  {row.subSubCategory && (
                    <select
                      onChange={(e) => handleItemChange(index, e)}
                      value={row.item}
                    >
                      <option value="">Select Item</option>
                      {getItems(
                        row.category,
                        row.subCategory,
                        row.subSubCategory
                      ).map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Export Buttons */}
        <div style={{ marginTop: "20px" }}>
          <CSVLink data={tableData} filename="category_data.csv">
            <button style={{ marginRight: "10px" }}>Export as CSV</button>
          </CSVLink>
          <button onClick={handleConvertToJson}>Convert to JSON</button>
        </div>
      </div>
    </>
  );
}

export default Csvtool;