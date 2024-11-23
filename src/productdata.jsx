import React, { useState, useEffect } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import app from "./firebase-config";
import Pagination from "./pagination";
import "./productdata.css";
import { categoryTree } from "./categoryData"; // Assuming a hierarchical structure for categories

const ProductData = () => {
  // State variables
  const [products, setProducts] = useState([]); // Full product list from Firestore
  const [filteredProducts, setFilteredProducts] = useState([]); // After filters and sorting
  const [paginatedProducts, setPaginatedProducts] = useState([]); // Products for the current page

  // Filter and sort state variables
  const [sortField, setSortField] = useState("");
  const [sortDirection, setSortDirection] = useState("asc");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [selectedSubSubCategory, setSelectedSubSubCategory] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minProfit, setMinProfit] = useState("");
  const [maxProfit, setMaxProfit] = useState("");
  const [minSold, setMinSold] = useState("");
  const [maxSold, setMaxSold] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // You can make this dynamic if needed

  const db = getFirestore(app);

  // Fetch products from Firestore on component mount
  useEffect(() => {
    const fetchProducts = async () => {
      const productsCol = collection(db, "products");
      const productsSnapshot = await getDocs(productsCol);
      const productList = productsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setProducts(productList);
    };

    fetchProducts();
  }, []);

  // Apply filters and sorting whenever relevant state variables change
  useEffect(() => {
    sortAndFilterProducts();
  }, [
    products,
    sortField,
    sortDirection,
    searchTerm,
    selectedCategory,
    selectedSubCategory,
    selectedItem,
    selectedSubSubCategory,
    minPrice,
    maxPrice,
    minProfit,
    maxProfit,
    minSold,
    maxSold,
  ]);

  // Update paginated products whenever filteredProducts or pagination state changes
  useEffect(() => {
    paginateProducts();
  }, [filteredProducts, currentPage]);

  // Function to sort and filter products
  const sortAndFilterProducts = () => {
    let updatedProducts = [...products];

    // Category filters
    if (selectedCategory) {
      updatedProducts = updatedProducts.filter(
        (product) => product.Category === selectedCategory
      );
    }
    if (selectedSubCategory) {
      updatedProducts = updatedProducts.filter(
        (product) => product.SubCategory === selectedSubCategory
      );
    }
    if (selectedItem) {
      updatedProducts = updatedProducts.filter(
        (product) => product.Item === selectedItem
      );
    }
    if (selectedSubSubCategory) {
      updatedProducts = updatedProducts.filter(
        (product) => product.SubSubCategory === selectedSubSubCategory
      );
    }

    // Price, Profit, and Sold range filters
    if (minPrice) {
      updatedProducts = updatedProducts.filter(
        (product) => Number(product.Price) >= Number(minPrice)
      );
    }
    if (maxPrice) {
      updatedProducts = updatedProducts.filter(
        (product) => Number(product.Price) <= Number(maxPrice)
      );
    }
    if (minProfit) {
      updatedProducts = updatedProducts.filter(
        (product) => Number(product.Profit) >= Number(minProfit)
      );
    }
    if (maxProfit) {
      updatedProducts = updatedProducts.filter(
        (product) => Number(product.Profit) <= Number(maxProfit)
      );
    }
    if (minSold) {
      updatedProducts = updatedProducts.filter(
        (product) => Number(product.Sold) >= Number(minSold)
      );
    }
    if (maxSold) {
      updatedProducts = updatedProducts.filter(
        (product) => Number(product.Sold) <= Number(maxSold)
      );
    }

    // Search filter
    if (searchTerm) {
      const lowercasedSearch = searchTerm.toLowerCase();
      updatedProducts = updatedProducts.filter((product) =>
        Object.keys(product).some((key) =>
          product[key]?.toString().toLowerCase().includes(lowercasedSearch)
        )
      );
    }

    // Sorting logic
    if (sortField) {
      updatedProducts.sort((a, b) => {
        const fieldA = a[sortField] ?? "";
        const fieldB = b[sortField] ?? "";
        if (fieldA < fieldB) return sortDirection === "asc" ? -1 : 1;
        if (fieldA > fieldB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    setFilteredProducts(updatedProducts);
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Function to paginate products
  const paginateProducts = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginated = filteredProducts.slice(
      startIndex,
      startIndex + itemsPerPage
    );
    setPaginatedProducts(paginated);
  };

  // Handle sort change
  const handleSortChange = (field) => {
    const newSortDirection =
      sortField === field && sortDirection === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortDirection(newSortDirection);
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedCategory("");
    setSelectedSubCategory("");
    setSelectedItem("");
    setSelectedSubSubCategory("");
    setMinPrice("");
    setMaxPrice("");
    setMinProfit("");
    setMaxProfit("");
    setMinSold("");
    setMaxSold("");
  };

  // Handle filter input changes
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
    setSelectedSubCategory("");
    setSelectedItem("");
    setSelectedSubSubCategory("");
  };

  const handleSubCategoryChange = (e) => {
    setSelectedSubCategory(e.target.value);
    setSelectedItem("");
    setSelectedSubSubCategory("");
  };

  const handleItemChange = (e) => {
    setSelectedItem(e.target.value);
    setSelectedSubSubCategory("");
  };

  const handleSubSubCategoryChange = (e) => {
    setSelectedSubSubCategory(e.target.value);
  };

  // Helper functions to get options for dropdowns
  const getSubCategories = () => {
    if (selectedCategory) {
      return Object.keys(categoryTree[selectedCategory] || {});
    } else {
      // Collect all subcategories across all categories
      return Array.from(
        new Set(
          Object.values(categoryTree)
            .flatMap((subCats) => Object.keys(subCats || {}))
            .filter((subCat) => typeof subCat === "string")
        )
      );
    }
  };

  const getItems = () => {
    if (selectedCategory && selectedSubCategory) {
      return Object.keys(
        categoryTree[selectedCategory][selectedSubCategory] || {}
      );
    } else if (selectedSubCategory) {
      // Collect all items across all categories for the selected subcategory
      return Array.from(
        new Set(
          Object.values(categoryTree)
            .map((subCats) => subCats[selectedSubCategory])
            .filter(Boolean)
            .flatMap((items) => Object.keys(items || {}))
            .filter((item) => typeof item === "string")
        )
      );
    } else {
      // Collect all items across all categories and subcategories
      return Array.from(
        new Set(
          Object.values(categoryTree)
            .flatMap((subCats) =>
              Object.values(subCats || {}).flatMap((items) =>
                Object.keys(items || {})
              )
            )
            .filter((item) => typeof item === "string")
        )
      );
    }
  };

  const getSubSubCategories = () => {
    if (selectedCategory && selectedSubCategory && selectedItem) {
      return (
        categoryTree[selectedCategory][selectedSubCategory][selectedItem] || []
      );
    } else if (selectedItem) {
      // Collect all sub-subcategories across all categories for the selected item
      return Array.from(
        new Set(
          Object.values(categoryTree)
            .flatMap((subCats) =>
              Object.values(subCats || {})
                .map((items) => items[selectedItem])
                .filter(Boolean)
                .flat()
            )
            .filter((subSubCat) => typeof subSubCat === "string")
        )
      );
    } else {
      // Collect all sub-subcategories across all items
      return Array.from(
        new Set(
          Object.values(categoryTree)
            .flatMap((subCats) =>
              Object.values(subCats || {}).flatMap((items) =>
                Object.values(items || {}).flat()
              )
            )
            .filter((subSubCat) => typeof subSubCat === "string")
        )
      );
    }
  };

  // Render table
  const renderTable = () => (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th onClick={() => handleSortChange("Title")}>Title</th>
            <th onClick={() => handleSortChange("Sold")}>Sold</th>
            <th onClick={() => handleSortChange("Dimensions")}>Dimensions</th>
            <th onClick={() => handleSortChange("Price")}>Price</th>
            <th onClick={() => handleSortChange("Profit")}>Profit</th>
            <th>eBay Link</th>
            <th>Supplier Info</th>
            <th onClick={() => handleSortChange("Category")}>Category</th>
            <th onClick={() => handleSortChange("SubCategory")}>SubCategory</th>
            <th onClick={() => handleSortChange("Item")}>Item</th>
            <th onClick={() => handleSortChange("SubSubCategory")}>
              SubSubCategory
            </th>
          </tr>
        </thead>
        <tbody>
          {paginatedProducts.map((product) => (
            <tr key={product.id}>
              <td>{product.Title}</td>
              <td>{product.Sold}</td>
              <td>{product.Dimensions}</td>
              <td>${Number(product.Price).toFixed(2)}</td>
              <td>${Number(product.Profit).toFixed(2)}</td>
              <td>
                <a
                  href={product.ProductOnEbay}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on eBay
                </a>
              </td>
              <td>
                <a
                  href={product.Source}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Supplier Info
                </a>
              </td>
              <td>{product.Category}</td>
              <td>{product.SubCategory}</td>
              <td>{product.Item}</td>
              <td>{product.SubSubCategory}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="product-data-container">
      {/* Filters Section */}
      <div className="filter-controls">
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Search products..."
        />
        <select onChange={handleCategoryChange} value={selectedCategory}>
          <option value="">All Categories</option>
          {Object.keys(categoryTree).map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <select
          onChange={handleSubCategoryChange}
          value={selectedSubCategory}
        >
          <option value="">All SubCategories</option>
          {getSubCategories().map((subCat) => (
            <option key={subCat} value={subCat}>
              {subCat}
            </option>
          ))}
        </select>
        <select onChange={handleItemChange} value={selectedItem}>
          <option value="">All Items</option>
          {getItems().map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          onChange={handleSubSubCategoryChange}
          value={selectedSubSubCategory}
        >
          <option value="">All SubSubCategories</option>
          {getSubSubCategories().map((subSubCat) => (
            <option key={subSubCat} value={subSubCat}>
              {subSubCat}
            </option>
          ))}
        </select>
        {/* Range filters */}
        <div className="range-filter">
          <label>Min Price:</label>
          <input
            type="number"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
          <label>Max Price:</label>
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </div>
        <div className="range-filter">
          <label>Min Profit:</label>
          <input
            type="number"
            value={minProfit}
            onChange={(e) => setMinProfit(e.target.value)}
          />
          <label>Max Profit:</label>
          <input
            type="number"
            value={maxProfit}
            onChange={(e) => setMaxProfit(e.target.value)}
          />
        </div>
        <div className="range-filter">
          <label>Min Sold:</label>
          <input
            type="number"
            value={minSold}
            onChange={(e) => setMinSold(e.target.value)}
          />
          <label>Max Sold:</label>
          <input
            type="number"
            value={maxSold}
            onChange={(e) => setMaxSold(e.target.value)}
          />
        </div>
        <button onClick={handleResetFilters}>Reset Filters</button>
      </div>

      {/* Render Table */}
      {renderTable()}

      {/* Pagination */}
      <Pagination
        totalItems={filteredProducts.length}
        itemsPerPage={itemsPerPage}
        currentPage={currentPage}
        onPageChange={(page) => setCurrentPage(page)}
      />
    </div>
  );
};

export default ProductData;








