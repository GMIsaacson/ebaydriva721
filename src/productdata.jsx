import React, { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { useNavigate } from "react-router-dom";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import app from "./firebase-config";
import Pagination from "./pagination";
import "./productdata.css";
import { useAuth } from "./AuthProvider";
import ProfitCalculator from "./ebayprofit";
import "./dashboard.css";

const ProductData = () => {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [sortField, setSortField] = useState("Price");
  const [sortDirection, setSortDirection] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); // Adjust as needed
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalUrl, setModalUrl] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCalculator, setShowCalculator] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minProfit, setMinProfit] = useState("");
  const [maxProfit, setMaxProfit] = useState("");
  const [minSold, setMinSold] = useState("");
  const [maxSold, setMaxSold] = useState("");

  const toggleCalculator = () => {
    setShowCalculator(!showCalculator);
  };

  const { currentUser, logout } = useAuth();

  const db = getFirestore(app);

  useEffect(() => {
    const fetchProducts = async () => {
      const db = getFirestore(app);
      const productsCol = collection(db, "products");
      const productsSnapshot = await getDocs(productsCol);
      const productList = productsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setProducts(productList);
      sortAndFilterProducts(
        productList,
        selectedCategory,
        sortField,
        sortDirection,
        minPrice,
        maxPrice,
        minProfit,
        maxProfit,
        minSold,
        maxSold
      );
    };

    fetchProducts();
  }, [selectedCategory, sortField, sortDirection, minPrice, maxPrice, minProfit, maxProfit, minSold, maxSold]);

  const sortAndFilterProducts = (
    products,
    category,
    sortField,
    direction,
    minPrice,
    maxPrice,
    minProfit,
    maxProfit,
    minSold,
    maxSold
  ) => {
    let sortedProducts = [...products];

    if (sortField && direction) {
      sortedProducts.sort((a, b) => {
        if (direction === "asc") {
          return a[sortField] < b[sortField] ? -1 : 1;
        } else {
          return a[sortField] > b[sortField] ? -1 : 1;
        }
      });
    }

    if (category) {
      sortedProducts = sortedProducts.filter(
        (product) => product.Category?.toLowerCase() === category
      );
    }

    // Filter by Price, Profit, and Sold range if set
    if (minPrice) {
      sortedProducts = sortedProducts.filter((product) => product.Price >= minPrice);
    }
    if (maxPrice) {
      sortedProducts = sortedProducts.filter((product) => product.Price <= maxPrice);
    }
    if (minProfit) {
      sortedProducts = sortedProducts.filter((product) => product.Profit >= minProfit);
    }
    if (maxProfit) {
      sortedProducts = sortedProducts.filter((product) => product.Profit <= maxProfit);
    }
    if (minSold) {
      sortedProducts = sortedProducts.filter((product) => product.Sold >= minSold);
    }
    if (maxSold) {
      sortedProducts = sortedProducts.filter((product) => product.Sold <= maxSold);
    }

    // Pagination logic
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setFilteredProducts(sortedProducts.slice(startIndex, endIndex));
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    filterProducts(event.target.value);
  };

  const filterProducts = (search) => {
    if (!search) {
      sortAndFilterProducts(
        products,
        selectedCategory,
        sortField,
        sortDirection,
        minPrice,
        maxPrice,
        minProfit,
        maxProfit,
        minSold,
        maxSold
      );
    } else {
      const lowercasedFilter = search.toLowerCase();
      const filteredData = products.filter((item) => {
        return Object.keys(item).some((key) =>
          item[key].toString().toLowerCase().includes(lowercasedFilter)
        );
      });
      setFilteredProducts(filteredData);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      alert("Logged out successfully!");
    } catch (error) {
      console.error("Logout Failed", error);
    }
  };

  const handleCategoryChange = (e) => {
    const category = e.target.value.trim().toLowerCase();
    setSelectedCategory(category);
    sortAndFilterProducts(products, category, sortField, sortDirection, minPrice, maxPrice, minProfit, maxProfit, minSold, maxSold);
  };

  const handleSortChange = (field) => {
    setSortField(field);
    setSortDirection(sortDirection === "asc" ? "desc" : "asc"); // Toggle sort direction
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    sortAndFilterProducts(products, selectedCategory, sortField, sortDirection, minPrice, maxPrice, minProfit, maxProfit, minSold, maxSold);
  };

  const handleResetFilters = () => {
    setMinPrice("");
    setMaxPrice("");
    setMinProfit("");
    setMaxProfit("");
    setMinSold("");
    setMaxSold("");
    setSelectedCategory("");
    sortAndFilterProducts(products, "", sortField, sortDirection, "", "", "", "", "", "");
  };

  const renderTableOrCards = () => {
    const isLargeScreen = window.matchMedia("(min-width: 768px)").matches;

    if (isLargeScreen) {
      return (
        <div className="table-responsive">
          <table className="product-table">
            <thead>
              <tr>
                <th onClick={() => handleSortChange("Title")}>
                  Title
                  {sortField === "Title" &&
                    (sortDirection === "asc" ? (
                      <i className="fas fa-sort-up"></i>
                    ) : (
                      <i className="fas fa-sort-down"></i>
                    ))}
                </th>
                <th onClick={() => handleSortChange("Sold")}>
                  Sold
                  {sortField === "Sold" &&
                    (sortDirection === "asc" ? (
                      <i className="fas fa-sort-up"></i>
                    ) : (
                      <i className="fas fa-sort-down"></i>
                    ))}
                </th>
                <th onClick={() => handleSortChange("Dimensions")}>
                  Dimensions
                  {sortField === "Dimensions" &&
                    (sortDirection === "asc" ? (
                      <i className="fas fa-sort-up"></i>
                    ) : (
                      <i className="fas fa-sort-down"></i>
                    ))}
                </th>
                <th onClick={() => handleSortChange("Price")}>
                  Price
                  {sortField === "Price" &&
                    (sortDirection === "asc" ? (
                      <i className="fas fa-sort-up"></i>
                    ) : (
                      <i className="fas fa-sort-down"></i>
                    ))}
                </th>
                <th onClick={() => handleSortChange("Profit")}>
                  Profit
                  {sortField === "Profit" &&
                    (sortDirection === "asc" ? (
                      <i className="fas fa-sort-up"></i>
                    ) : (
                      <i className="fas fa-sort-down"></i>
                    ))}
                </th>
                <th>eBay Link</th>
                <th>Supplier Info</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td>{product.Title}</td>
                  <td>{product.Sold}</td>
                  <td>{product.Dimensions}</td>
                  <td>${product.Price}</td>
                  <td>${product.Profit}</td>
                  <td>
                    <button onClick={() => window.open(product.ProductOnEbay, "_blank")}>View on eBay</button>
                  </td>
                  <td>
                    <button onClick={() => window.open(product.Source, "_blank")}>View on Alibaba</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } else {
      return (
        <div className="product-cards-container">
          {filteredProducts.map((product) => (
            <div className="product-card" key={product.id}>
              <h3>{product.Title}</h3>
              <p>Sold: {product.Sold}</p>
              <p>Dimensions: {product.Dimensions}</p>
              <p>Price: ${product.Price}</p>
              <p>Profit: ${product.Profit}</p>
              <button onClick={() => window.open(product.ProductOnEbay, "_blank")}>View on eBay</button>
              <button onClick={() => handleOpenModal(product.SupplierInfo)}>View Supplier Info</button>
            </div>
          ))}
        </div>
      );
    }
  };

  return (
    <div className="product-data-container">
      <div className="search-container">
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Search..."
        />
      </div>

      {/* Filter Section */}
      <div className="filter-container">
        {/* Price Filter */}
        <div className="filter">
          <label>Min Price</label>
          <input
            type="number"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="Min Price"
          />
        </div>
        <div className="filter">
          <label>Max Price</label>
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Max Price"
          />
        </div>

        {/* Profit Filter */}
        <div className="filter">
          <label>Min Profit</label>
          <input
            type="number"
            value={minProfit}
            onChange={(e) => setMinProfit(e.target.value)}
            placeholder="Min Profit"
          />
        </div>
        <div className="filter">
          <label>Max Profit</label>
          <input
            type="number"
            value={maxProfit}
            onChange={(e) => setMaxProfit(e.target.value)}
            placeholder="Max Profit"
          />
        </div>

        {/* Sold Filter */}
        <div className="filter">
          <label>Min Sold</label>
          <input
            type="number"
            value={minSold}
            onChange={(e) => setMinSold(e.target.value)}
            placeholder="Min Sold"
          />
        </div>
        <div className="filter">
          <label>Max Sold</label>
          <input
            type="number"
            value={maxSold}
            onChange={(e) => setMaxSold(e.target.value)}
            placeholder="Max Sold"
          />
        </div>

        {/* Reset Button */}
        <button onClick={handleResetFilters}>Reset Filters</button>
      </div>

      {renderTableOrCards()}
      <Pagination
        totalItems={products.length}
        itemsPerPage={itemsPerPage}
        onPageChange={handlePageChange}
      />
      {showCalculator && <ProfitCalculator />}
      {isModalOpen && (
        <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
          <iframe
            src={modalUrl}
            title="Supplier Information"
            width="600"
            height="400"
            frameBorder="0"
          ></iframe>
        </Modal>
      )}
    </div>
  );
};

export default ProductData;



