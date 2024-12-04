import React, { useState, useEffect, useMemo } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import app from "./firebase-config";
import Pagination from "./pagination";
//import { FaFilter, FaTag, FaShoppingCart } from "react-icons/fa6"; // Updated import path for filter icon and added new icons
import { FaFilter, FaTag, FaShoppingCart } from "react-icons/fa"; // Updated import path for filter icon and added new icons
import "./productdata.css";


const ProductData = () => {
  // State variables
  const [products, setProducts] = useState([]); // Full product list from Firestore
  const [filteredProducts, setFilteredProducts] = useState([]); // After filters and sorting
  const [paginatedProducts, setPaginatedProducts] = useState([]); // Products for the current page
  const [categoryTree, setCategoryTree] = useState({}); // Category hierarchy

  // Filter and sort state variables
  const [sortField, setSortField] = useState("");
  const [sortDirection, setSortDirection] = useState("asc");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [selectedSubSubCategory, setSelectedSubSubCategory] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minBEP, setMinBEP] = useState("");
  const [maxBEP, setMaxBEP] = useState("");
  const [minSold, setMinSold] = useState("");
  const [maxSold, setMaxSold] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // You can make this dynamic if needed

  const db = getFirestore(app);

  // Filters toggle state
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);

  // Screen size state
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 800);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 800);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch products from Firestore on component mount
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const productsCol = collection(db, "products");
        const productsSnapshot = await getDocs(productsCol);
        const productList = productsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setProducts(productList);
        buildCategoryTree(productList); // Build category hierarchy from products
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Build category hierarchy from products
  const buildCategoryTree = (productsList) => {
    const tree = {};

    productsList.forEach((product) => {
      if (!product) return; // Added null check to prevent errors
      const { Category, SubCategory, SubSubCategory, Item } = product;

      if (Category) {
        if (!tree[Category]) {
          tree[Category] = {};
        }

        if (SubCategory) {
          if (!tree[Category][SubCategory]) {
            tree[Category][SubCategory] = {};
          }

          if (SubSubCategory) {
            if (!tree[Category][SubCategory][SubSubCategory]) {
              tree[Category][SubCategory][SubSubCategory] = new Set();
            }

            if (Item) {
              tree[Category][SubCategory][SubSubCategory].add(Item);
            }
          }
        }
      }
    });

    // Convert Sets to Arrays
    Object.keys(tree).forEach((category) => {
      Object.keys(tree[category]).forEach((subCategory) => {
        Object.keys(tree[category][subCategory]).forEach((subSubCategory) => {
          tree[category][subCategory][subSubCategory] = Array.from(
            tree[category][subCategory][subSubCategory]
          );
        });
      });
    });

    setCategoryTree(tree);
  };

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
    selectedSubSubCategory,
    selectedItem,
    minPrice,
    maxPrice,
    minBEP,
    maxBEP,
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
    if (selectedSubSubCategory) {
      updatedProducts = updatedProducts.filter(
        (product) => product.SubSubCategory === selectedSubSubCategory
      );
    }
    if (selectedItem) {
      updatedProducts = updatedProducts.filter(
        (product) => product.Item === selectedItem
      );
    }

    // Range filters
    updatedProducts = filterProductByRange(updatedProducts, "Price", minPrice, maxPrice);
    updatedProducts = filterProductByRange(updatedProducts, "BEP", minBEP, maxBEP);
    updatedProducts = filterProductByRange(updatedProducts, "Sold", minSold, maxSold);

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

  // Helper function to filter products by range
  const filterProductByRange = (products, fieldName, minValue, maxValue) => {
    if (minValue) {
      products = products.filter(
        (product) => Number(product[fieldName]) >= Number(minValue)
      );
    }
    if (maxValue) {
      products = products.filter(
        (product) => Number(product[fieldName]) <= Number(maxValue)
      );
    }
    return products;
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
    setSelectedSubSubCategory("");
    setSelectedItem("");
    setMinPrice("");
    setMaxPrice("");
    setMinBEP("");
    setMaxBEP("");
    setMinSold("");
    setMaxSold("");
  };

  // Memoized category data
  const categories = useMemo(() => Object.keys(categoryTree), [categoryTree]);
  const subCategories = useMemo(() => selectedCategory ? Object.keys(categoryTree[selectedCategory] ?? {}) : [], [categoryTree, selectedCategory]);
  const subSubCategories = useMemo(() => selectedCategory && selectedSubCategory ? Object.keys(categoryTree[selectedCategory][selectedSubCategory] ?? {}) : [], [categoryTree, selectedCategory, selectedSubCategory]);
  const items = useMemo(() => selectedCategory && selectedSubCategory && selectedSubSubCategory ? categoryTree[selectedCategory][selectedSubCategory][selectedSubSubCategory] ?? [] : [], [categoryTree, selectedCategory, selectedSubCategory, selectedSubSubCategory]);

  // Render Table
  const renderTable = () => (
    <div className="product-page-table-container">
      {isDesktop && (
        <table className="product-page-table">
          <thead>
            <tr>
              <th onClick={() => handleSortChange("Title")}>Title</th>
              <th onClick={() => handleSortChange("Sold")}>Sold</th>
              <th>Dimensions</th>
              <th onClick={() => handleSortChange("Price")}>Price</th>
              <th onClick={() => handleSortChange("BEP")}>BEP</th>
              <th>Sell</th>
              <th>Buy</th>
              <th>Category</th>
              <th>SubCategory</th>
              <th>SubSubCategory</th>
              <th>Item</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.map((product) => (
              <tr key={product.id}>
                <td title={product.Title || "N/A"} className="truncate-text">
                  {product.Title ? truncateText(product.Title, 3) : "N/A"}
                </td>
                <td>{product.Sold !== undefined ? product.Sold : "N/A"}</td>
                <td title={product.Dimensions || "N/A"} className="truncate-text">
                  {product.Dimensions ? truncateText(product.Dimensions, 3) : "N/A"}
                </td>
                <td>
                  {product.Price !== undefined && !isNaN(product.Price) ? (
                    `$${Number(product.Price).toFixed(2)}`
                  ) : (
                    "N/A"
                  )}
                </td>
                <td>
                  {product.BEP !== undefined && !isNaN(product.BEP) ? (
                    `$${Number(product.BEP).toFixed(2)}`
                  ) : (
                    "N/A"
                  )}
                </td>
                <td>
                  {product.Sell ? (
                    <a href={product.Sell} target="_blank" rel="noopener noreferrer">
                      View Sell
                    </a>
                  ) : (
                    "N/A"
                  )}
                </td>
                <td>
                  {product.Buy ? (
                    <a href={product.Buy} target="_blank" rel="noopener noreferrer">
                      View Buy
                    </a>
                  ) : (
                    "N/A"
                  )}
                </td>
                <td>{product.Category || "N/A"}</td>
                <td>{product.SubCategory || "N/A"}</td>
                <td>{product.SubSubCategory || "N/A"}</td>
                <td>{product.Item || "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!isDesktop && paginatedProducts.map((product) => (
        <div className="product-page-card" key={product.id}>
          {/* Highlight important details first */}
          <div className="product-page-card-item truncate-text" title={product.Title || "N/A"}>
            <span><FaTag /> Title:</span> {product.Title ? truncateText(product.Title, 3) : "N/A"}
          </div>
          <div className="product-page-card-item">
            <span><FaShoppingCart /> Sold:</span> {product.Sold !== undefined ? product.Sold : "N/A"}
          </div>
          <div className="product-page-card-item">
            <span>Price:</span> {product.Price !== undefined && !isNaN(product.Price) ? (`$${Number(product.Price).toFixed(2)}`) : "N/A"}
          </div>
          <div className="product-page-card-item">
            <span>BEP:</span> {product.BEP !== undefined && !isNaN(product.BEP) ? (`$${Number(product.BEP).toFixed(2)}`) : "N/A"}
          </div>
          {/* Action buttons */}
          <div className="product-page-card-item action-buttons">
            {product.Sell ? (
              <a href={product.Sell} target="_blank" rel="noopener noreferrer" className="buy-button">
                Buy
              </a>
            ) : (
              "N/A"
            )}
            {product.Buy ? (
              <a href={product.Buy} target="_blank" rel="noopener noreferrer" className="sell-button">
                Sell
              </a>
            ) : (
              "N/A"
            )}
          </div>
          {/* Expandable details */}
          <details className="product-page-card-details">
            <summary>More Info</summary>
            <div className="product-page-card-item truncate-text" title={product.Dimensions || "N/A"}>
              <span>Dimensions:</span> {product.Dimensions ? truncateText(product.Dimensions, 3) : "N/A"}
            </div>
            <div className="product-page-card-item"><span>Category:</span> {product.Category || "N/A"}</div>
            <div className="product-page-card-item"><span>SubCategory:</span> {product.SubCategory || "N/A"}</div>
            <div className="product-page-card-item"><span>SubSubCategory:</span> {product.SubSubCategory || "N/A"}</div>
            <div className="product-page-card-item"><span>Item:</span> {product.Item || "N/A"}</div>
          </details>
        </div>
      ))}
    </div>
  );

  // Helper function to truncate text
  const truncateText = (text, wordLimit) => {
    const words = text.split(" ");
    if (words.length > wordLimit) {
      return words.slice(0, wordLimit).join(" ") + "...";
    }
    return text;
  };

  return (
    <div className="product-data-container">
      {/* Filters Toggle Button - visible only on smaller screens */}
      {!isDesktop && (
        <button className="filter-toggle-button" onClick={() => setShowFilters((prev) => !prev)}>
          <FaFilter />
          {showFilters ? "Hide Filters" : "Show Filters"}
        </button>
      )}

      {/* Filters Section - conditionally rendered based on screen size and toggle state */}
      <div className="filter-controls">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search products..."
        />
        <select onChange={(e) => setSelectedCategory(e.target.value)} value={selectedCategory}>
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select onChange={(e) => setSelectedSubCategory(e.target.value)} value={selectedSubCategory}>
          <option value="">All SubCategories</option>
          {subCategories.map((subCat) => (
            <option key={subCat} value={subCat}>{subCat}</option>
          ))}
        </select>
        <select onChange={(e) => setSelectedSubSubCategory(e.target.value)} value={selectedSubSubCategory}>
          <option value="">All SubSubCategories</option>
          {subSubCategories.map((subSubCat) => (
            <option key={subSubCat} value={subSubCat}>{subSubCat}</option>
          ))}
        </select>
        <select onChange={(e) => setSelectedItem(e.target.value)} value={selectedItem}>
          <option value="">All Items</option>
          {items.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        {/* Range filters - conditionally visible on small screens */}
        {(!isDesktop && showFilters) || isDesktop ? (
          <>
            <div className="range-filter">
              <label>Min Price:</label>
              <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
              <label>Max Price:</label>
              <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
            </div>
            <div className="range-filter">
              <label>Min BEP:</label>
              <input type="number" value={minBEP} onChange={(e) => setMinBEP(e.target.value)} />
              <label>Max BEP:</label>
              <input type="number" value={maxBEP} onChange={(e) => setMaxBEP(e.target.value)} />
            </div>
            <div className="range-filter">
              <label>Min Sold:</label>
              <input type="number" value={minSold} onChange={(e) => setMinSold(e.target.value)} />
              <label>Max Sold:</label>
              <input type="number" value={maxSold} onChange={(e) => setMaxSold(e.target.value)} />
            </div>
          </>
        ) : null}
        <button onClick={handleResetFilters}>Reset Filters</button>
      </div>

      {/* Render Table */}
      {loading ? <div>Loading...</div> : renderTable()}

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




















