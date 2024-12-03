import React, { useState, useEffect } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import app from "./firebase-config";
import Pagination from "./pagination";
import "./productdata.css";

const ProductData = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [paginatedProducts, setPaginatedProducts] = useState([]);
  const [categoryTree, setCategoryTree] = useState({});
  const [filtersVisible, setFiltersVisible] = useState(false); // New state for toggling filters

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [minBEP, setMinBEP] = useState("");
  const [maxBEP, setMaxBEP] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const db = getFirestore(app);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const productsCol = collection(db, "products");
        const productsSnapshot = await getDocs(productsCol);
        const productList = productsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setProducts(productList);
        buildCategoryTree(productList);
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    };

    fetchProducts();
  }, [db]);

  const buildCategoryTree = (productsList) => {
    const tree = {};
    productsList.forEach((product) => {
      if (!product) return;
      const { Category, SubCategory } = product;

      if (Category) {
        if (!tree[Category]) {
          tree[Category] = {};
        }

        if (SubCategory) {
          if (!tree[Category][SubCategory]) {
            tree[Category][SubCategory] = true;
          }
        }
      }
    });

    setCategoryTree(tree);
  };

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, selectedCategory, selectedSubCategory, minBEP, maxBEP]);

  useEffect(() => {
    paginateProducts();
  }, [filteredProducts, currentPage]);

  const filterProducts = () => {
    let updatedProducts = [...products];

    if (searchTerm) {
      const lowercasedSearch = searchTerm.toLowerCase();
      updatedProducts = updatedProducts.filter((product) =>
        Object.keys(product).some((key) =>
          product[key]?.toString().toLowerCase().includes(lowercasedSearch)
        )
      );
    }

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

    if (minBEP) {
      updatedProducts = updatedProducts.filter(
        (product) => Number(product.BEP) >= Number(minBEP)
      );
    }

    if (maxBEP) {
      updatedProducts = updatedProducts.filter(
        (product) => Number(product.BEP) <= Number(maxBEP)
      );
    }

    setFilteredProducts(updatedProducts);
    setCurrentPage(1);
  };

  const paginateProducts = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginated = filteredProducts.slice(
      startIndex,
      startIndex + itemsPerPage
    );
    setPaginatedProducts(paginated);
  };

  const toggleFilters = () => {
    setFiltersVisible(!filtersVisible);
  };

  const renderFilters = () => (
    <div className={`filter-controls ${filtersVisible ? "visible" : "hidden"}`}>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search products..."
      />
      <select
        onChange={(e) => setSelectedCategory(e.target.value)}
        value={selectedCategory}
      >
        <option value="">All Categories</option>
        {Object.keys(categoryTree).map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
      <select
        onChange={(e) => setSelectedSubCategory(e.target.value)}
        value={selectedSubCategory}
      >
        <option value="">All SubCategories</option>
        {selectedCategory &&
          Object.keys(categoryTree[selectedCategory] || {}).map(
            (subCategory) => (
              <option key={subCategory} value={subCategory}>
                {subCategory}
              </option>
            )
          )}
      </select>
      <div className="range-filter">
        <label>Min BEP:</label>
        <input
          type="number"
          value={minBEP}
          onChange={(e) => setMinBEP(e.target.value)}
        />
        <label>Max BEP:</label>
        <input
          type="number"
          value={maxBEP}
          onChange={(e) => setMaxBEP(e.target.value)}
        />
      </div>
    </div>
  );

  const renderCards = () =>
    paginatedProducts.map((product) => (
      <div className="product-page-card" key={product.id}>
        <div className="product-page-card-title">{product.Title || "N/A"}</div>
        <div className="product-page-card-details">
          Sold: {product.Sold !== undefined ? product.Sold : "N/A"}
        </div>
        <div className="product-page-card-details">
          BEP: {product.BEP !== undefined ? `$${product.BEP.toFixed(2)}` : "N/A"}
        </div>
        <div className="product-page-card-links">
          {product.Buy && (
            <a href={product.Buy} target="_blank" rel="noopener noreferrer">
              Buy
            </a>
          )}
          {product.Sell && (
            <a href={product.Sell} target="_blank" rel="noopener noreferrer">
              Sell
            </a>
          )}
        </div>
      </div>
    ));

  return (
    <div className="product-data-container">
      <button onClick={toggleFilters} className="toggle-filters">
        {filtersVisible ? "Hide Filters" : "Show Filters"}
      </button>
      {renderFilters()}
      <div className="product-page-card-container">{renderCards()}</div>
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


















