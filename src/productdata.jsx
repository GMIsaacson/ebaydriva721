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

  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [showCalculator, setShowCalculator] = useState(false);
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
      );
    };

    fetchProducts();
  }, [selectedCategory, sortField, sortDirection]);

  const sortAndFilterProducts = (products, category, sortField, direction) => {
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
        (product) => product.Category?.toLowerCase() === category,
      );
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
      );
    } else {
      const lowercasedFilter = search.toLowerCase();
      const filteredData = products.filter((item) => {
        return Object.keys(item).some((key) =>
          item[key].toString().toLowerCase().includes(lowercasedFilter),
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
    sortAndFilterProducts(products, category, sortField, sortDirection);
  };

  const handleSortChange = (field) => {
    setSortField(field);
    setSortDirection(sortDirection === "asc" ? "desc" : "asc"); // Toggle sort direction
  };

  const handleSignUp = () => {
    console.log("Redirecting to sign up...");
    navigate("/signup"); // Use the navigate function here
  };

  const handleOpenModal = (url) => {
    setModalUrl(url);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    sortAndFilterProducts(products, selectedCategory, sortField, sortDirection);
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
                  <td>
                    {currentUser ? (
                      product.Title
                    ) : (
                      <button onClick={handleSignUp}>Sign Up to View</button>
                    )}
                  </td>
                  <td>
                    {currentUser ? (
                      product.Sold
                    ) : (
                      <div className="blur-effect">Sign Up to View</div>
                    )}
                  </td>
                  <td>
                    {currentUser ? (
                      product.Dimensions
                    ) : (
                      <div className="blur-effect">Sign Up to View</div>
                    )}
                  </td>
                  <td>
                    {currentUser ? (
                      `$${product.Price}`
                    ) : (
                      <div className="blur-effect">Sign Up to View</div>
                    )}
                  </td>
                  <td>$${product.Profit}</td>
                  <td>
                    {currentUser ? (
                      <button
                        onClick={() =>
                          window.open(product.ProductOnEbay, "_blank")
                        }
                      >
                        View on eBay
                      </button>
                    ) : (
                      <button onClick={handleSignUp}>Sign Up to View</button>
                    )}
                  </td>
                  <td>
                    {currentUser ? (
                      <button
                        onClick={() => handleOpenModal(product.SupplierInfo)}
                      >
                        View Supplier Info
                      </button>
                    ) : (
                      <button onClick={handleSignUp}>Sign Up to View</button>
                    )}
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
              <button
                onClick={() => window.open(product.ProductOnEbay, "_blank")}
              >
                View on eBay
              </button>
              <button onClick={() => handleOpenModal(product.SupplierInfo)}>
                View Supplier Info
              </button>
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
