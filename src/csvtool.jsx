import React, { useState } from "react";
import { CSVLink } from "react-csv";
import "./styles.css";
// Import all categories
import Furniture from "./categories/Furniture";
import HomeAndGarden from "./categories/HomeAndGarden";
import HealthandBeauty from "./categories/HealthandBeauty";


const categories = {
  "Furniture": Furniture,
  "HomeAndGarden": HomeAndGarden,
  "HealthandBeauty": HealthandBeauty,
};

function Csvtool() {
  const [tableData, setTableData] = useState([]);
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);

  // Toggle accordion state
  const toggleAccordion = () => {
    setIsAccordionOpen((prev) => !prev);
  };

  // Add a new row to the table with initial empty data
  const handleAddRow = () => {
    setTableData([
      ...tableData,
      {
        title: "",
        sold: "",
        price: "",
        bep: "",
        dimension: "",
        sell: "",
        buy: "",
        category: "",
        subCategory: "",
        subSubCategory: "",
        item: "",
      },
    ]);
  };

  // Get subcategories based on selected category
  const getSubCategories = (category) => {
    if (categories && categories[category]) {
      return Object.keys(categories[category]);
    }
    return [];
  };

  // Get sub-subcategories based on selected subCategory
  const getSubSubCategories = (category, subCategory) => {
    if (
      categories &&
      categories[category] &&
      categories[category][subCategory]
    ) {
      return Object.keys(categories[category][subCategory]);
    }
    return [];
  };

  // Get items based on selected subSubCategory
  const getItems = (category, subCategory, subSubCategory) => {
    if (
      categories &&
      categories[category] &&
      categories[category][subCategory] &&
      categories[category][subCategory][subSubCategory]
    ) {
      return categories[category][subCategory][subSubCategory];
    }
    return [];
  };

  // Define CSV headers explicitly to ensure correct field names
  const csvHeaders = [
    { label: "title", key: "title" },
    { label: "sold", key: "sold" },
    { label: "price", key: "price" },
    { label: "bep", key: "bep" },
    { label: "dimension", key: "dimension" },
    { label: "sell", key: "sell" },
    { label: "buy", key: "buy" },
    { label: "category", key: "category" },
    { label: "subCategory", key: "subCategory" },
    { label: "subSubCategory", key: "subSubCategory" },
    { label: "item", key: "item" },
  ];

  // CSVLink options to ensure proper formatting
  const csvOptions = {
    headers: csvHeaders,
    enclosingCharacter: '"', // Enclose fields in double quotes
  };

  return (
    <div className="accordion-section">
      <div
        className={`accordion-header ${isAccordionOpen ? "open" : ""}`}
        onClick={toggleAccordion}
      >
        <h1>CSV Builder {isAccordionOpen ? "▲" : "▼"}</h1>
      </div>
      <div
        className={`accordion-content ${isAccordionOpen ? "open" : ""}`}
        style={{ display: isAccordionOpen ? "block" : "none" }}
      >
        <button onClick={handleAddRow} className="btn-add-row">
          Add Row
        </button>
        <table border="1" cellPadding="5" className="csv-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Sold</th>
              <th>Price</th>
              <th>BEP</th>
              <th>Dimension</th>
              <th>Sell</th>
              <th>Buy</th>
              <th>Category</th>
              <th>SubCategory</th>
              <th>SubSubCategory</th>
              <th>Item</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, index) => (
              <tr key={index}>
                {/* Title */}
                <td>
                  <input
                    type="text"
                    name="title"
                    value={row.title}
                    onChange={(e) => {
                      const newData = [...tableData];
                      newData[index].title = e.target.value;
                      setTableData(newData);
                    }}
                  />
                </td>
                {/* Sold */}
                <td>
                  <input
                    type="number"
                    name="sold"
                    value={row.sold}
                    onChange={(e) => {
                      const newData = [...tableData];
                      newData[index].sold = e.target.value;
                      setTableData(newData);
                    }}
                  />
                </td>
                {/* Price */}
                <td>
                  <input
                    type="number"
                    name="price"
                    value={row.price}
                    onChange={(e) => {
                      const newData = [...tableData];
                      newData[index].price = e.target.value;
                      setTableData(newData);
                    }}
                  />
                </td>
                {/* BEP */}
                <td>
                  <input
                    type="number"
                    name="bep"
                    value={row.bep}
                    onChange={(e) => {
                      const newData = [...tableData];
                      newData[index].bep = e.target.value;
                      setTableData(newData);
                    }}
                  />
                </td>
                {/* Dimension */}
                <td>
                  <input
                    type="text"
                    name="dimension"
                    value={row.dimension}
                    onChange={(e) => {
                      const newData = [...tableData];
                      newData[index].dimension = e.target.value;
                      setTableData(newData);
                    }}
                  />
                </td>
                {/* Sell */}
                <td>
                  <input
                    type="text"
                    name="sell"
                    value={row.sell}
                    onChange={(e) => {
                      const newData = [...tableData];
                      newData[index].sell = e.target.value;
                      setTableData(newData);
                    }}
                  />
                </td>
                {/* Buy */}
                <td>
                  <input
                    type="text"
                    name="buy"
                    value={row.buy}
                    onChange={(e) => {
                      const newData = [...tableData];
                      newData[index].buy = e.target.value;
                      setTableData(newData);
                    }}
                  />
                </td>
                {/* Category Select */}
                <td>
                  <select
                    value={row.category}
                    onChange={(e) => {
                      const newData = [...tableData];
                      newData[index].category = e.target.value;
                      newData[index].subCategory = ""; // Reset SubCategory
                      newData[index].subSubCategory = ""; // Reset SubSubCategory
                      newData[index].item = ""; // Reset Item
                      setTableData(newData);
                    }}
                  >
                    <option value="">Select Category</option>
                    {Object.keys(categories).map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </td>
                {/* SubCategory Select */}
                <td>
                  <select
                    value={row.subCategory}
                    onChange={(e) => {
                      const newData = [...tableData];
                      newData[index].subCategory = e.target.value;
                      newData[index].subSubCategory = ""; // Reset SubSubCategory
                      newData[index].item = ""; // Reset Item
                      setTableData(newData);
                    }}
                    disabled={!row.category}
                  >
                    <option value="">Select SubCategory</option>
                    {row.category &&
                      getSubCategories(row.category).map((subCategory) => (
                        <option key={subCategory} value={subCategory}>
                          {subCategory}
                        </option>
                      ))}
                  </select>
                </td>
                {/* SubSubCategory Select */}
                <td>
                  <select
                    value={row.subSubCategory}
                    onChange={(e) => {
                      const newData = [...tableData];
                      newData[index].subSubCategory = e.target.value;
                      newData[index].item = ""; // Reset Item
                      setTableData(newData);
                    }}
                    disabled={!row.subCategory}
                  >
                    <option value="">Select SubSubCategory</option>
                    {row.category &&
                      row.subCategory &&
                      getSubSubCategories(row.category, row.subCategory).map(
                        (subSubCategory) => (
                          <option key={subSubCategory} value={subSubCategory}>
                            {subSubCategory}
                          </option>
                        )
                      )}
                  </select>
                </td>
                {/* Item Select */}
                <td>
                  <select
                    value={row.item}
                    onChange={(e) => {
                      const newData = [...tableData];
                      newData[index].item = e.target.value;
                      setTableData(newData);
                    }}
                    disabled={!row.subSubCategory}
                  >
                    <option value="">Select Item</option>
                    {row.category &&
                      row.subCategory &&
                      row.subSubCategory &&
                      getItems(
                        row.category,
                        row.subCategory,
                        row.subSubCategory
                      ).map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: "20px" }}>
          <CSVLink
            data={tableData}
            headers={csvHeaders}
            filename="category_data.csv"
            enclosingCharacter='"' // Enclose fields in double quotes
          >
            <button className="btn-export-csv">Export as CSV</button>
          </CSVLink>
        </div>
      </div>
    </div>
  );
}

export default Csvtool;












