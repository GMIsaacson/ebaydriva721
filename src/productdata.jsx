import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, getFirestore } from "firebase/firestore";
import { FaFilter, FaTag, FaShoppingCart } from "react-icons/fa";
import app from "./firebase-config";
import Pagination from "./pagination";
import "./productdata.css";

const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const ProductData = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  const db = getFirestore(app);

  useEffect(() => {
    let cancelled = false;
    const fetchProducts = async () => {
      setLoading(true);
      setError("");
      try {
        const snapshot = await getDocs(collection(db, "products"));
        if (!cancelled) {
          setProducts(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
        }
      } catch (fetchError) {
        console.error("Error fetching products:", fetchError);
        if (!cancelled) setError("We could not load product data. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchProducts();
    return () => { cancelled = true; };
  }, [db]);

  const categoryTree = useMemo(() => {
    const tree = {};
    products.forEach((product) => {
      const { Category, SubCategory, SubSubCategory, Item } = product || {};
      if (!Category) return;
      tree[Category] ||= {};
      if (!SubCategory) return;
      tree[Category][SubCategory] ||= {};
      if (!SubSubCategory) return;
      tree[Category][SubCategory][SubSubCategory] ||= new Set();
      if (Item) tree[Category][SubCategory][SubSubCategory].add(Item);
    });
    return tree;
  }, [products]);

  const categories = useMemo(() => Object.keys(categoryTree).sort(), [categoryTree]);
  const subCategories = useMemo(
    () => (selectedCategory ? Object.keys(categoryTree[selectedCategory] || {}).sort() : []),
    [categoryTree, selectedCategory]
  );
  const subSubCategories = useMemo(
    () => (selectedCategory && selectedSubCategory
      ? Object.keys(categoryTree[selectedCategory]?.[selectedSubCategory] || {}).sort()
      : []),
    [categoryTree, selectedCategory, selectedSubCategory]
  );
  const items = useMemo(() => {
    if (!selectedCategory || !selectedSubCategory || !selectedSubSubCategory) return [];
    return Array.from(categoryTree[selectedCategory]?.[selectedSubCategory]?.[selectedSubSubCategory] || []).sort();
  }, [categoryTree, selectedCategory, selectedSubCategory, selectedSubSubCategory]);

  const filteredProducts = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();
    const rangeMatch = (product, field, min, max) => {
      const value = numberValue(product[field]);
      if (min !== "" && (value === null || value < Number(min))) return false;
      if (max !== "" && (value === null || value > Number(max))) return false;
      return true;
    };

    const result = products.filter((product) => {
      if (selectedCategory && product.Category !== selectedCategory) return false;
      if (selectedSubCategory && product.SubCategory !== selectedSubCategory) return false;
      if (selectedSubSubCategory && product.SubSubCategory !== selectedSubSubCategory) return false;
      if (selectedItem && product.Item !== selectedItem) return false;
      if (!rangeMatch(product, "Price", minPrice, maxPrice)) return false;
      if (!rangeMatch(product, "BEP", minBEP, maxBEP)) return false;
      if (!rangeMatch(product, "Sold", minSold, maxSold)) return false;
      if (lowerSearch) {
        const searchable = [product.Title, product.Category, product.SubCategory, product.SubSubCategory, product.Item]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(lowerSearch)) return false;
      }
      return true;
    });

    if (!sortField) return result;
    return [...result].sort((a, b) => {
      const aValue = a[sortField] ?? "";
      const bValue = b[sortField] ?? "";
      const numeric = ["Price", "BEP", "Sold"].includes(sortField);
      const comparison = numeric
        ? (Number(aValue) || 0) - (Number(bValue) || 0)
        : String(aValue).localeCompare(String(bValue));
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [products, searchTerm, selectedCategory, selectedSubCategory, selectedSubSubCategory, selectedItem, minPrice, maxPrice, minBEP, maxBEP, minSold, maxSold, sortField, sortDirection]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedCategory, selectedSubCategory, selectedSubSubCategory, selectedItem, minPrice, maxPrice, minBEP, maxBEP, minSold, maxSold, sortField, sortDirection]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const handleSort = (field) => {
    if (sortField === field) setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedCategory("");
    setSelectedSubCategory("");
    setSelectedSubSubCategory("");
    setSelectedItem("");
    setMinPrice(""); setMaxPrice("");
    setMinBEP(""); setMaxBEP("");
    setMinSold(""); setMaxSold("");
    setSortField(""); setSortDirection("asc");
  };

  const money = (value) => {
    const parsed = numberValue(value);
    return parsed === null ? "N/A" : `$${parsed.toFixed(2)}`;
  };

  const truncate = (text, limit = 48) => {
    if (!text) return "N/A";
    return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
  };

  return (
    <main className="ds-page ds-products-page">
      <header className="ds-products-header">
        <div>
          <p className="ds-products-eyebrow">SOURCING DATABASE</p>
          <h1>Product opportunities</h1>
          <p>Search, filter, compare, and open the underlying buy/sell evidence.</p>
        </div>
        <div className="ds-products-count"><strong>{filteredProducts.length}</strong><span>matches</span></div>
      </header>

      <section className="ds-panel ds-products-filters">
        <div className="ds-filter-topline">
          <div>
            <h2 className="ds-section-title">Filters</h2>
            <p className="ds-section-copy">Narrow the catalog without losing the underlying sourcing evidence.</p>
          </div>
          <button className="ds-filter-toggle ds-button ds-button-secondary" type="button" onClick={() => setShowFilters((value) => !value)}>
            <FaFilter /> {showFilters ? "Hide advanced" : "Advanced filters"}
          </button>
        </div>

        <div className="ds-filter-grid ds-filter-grid-primary">
          <label><span>Search</span><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Title or category..." /></label>
          <label><span>Category</span><select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setSelectedSubCategory(""); setSelectedSubSubCategory(""); setSelectedItem(""); }}><option value="">All categories</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>Subcategory</span><select value={selectedSubCategory} disabled={!selectedCategory} onChange={(e) => { setSelectedSubCategory(e.target.value); setSelectedSubSubCategory(""); setSelectedItem(""); }}><option value="">All subcategories</option>{subCategories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>Item</span><select value={selectedItem} disabled={!selectedSubSubCategory} onChange={(e) => setSelectedItem(e.target.value)}><option value="">All items</option>{items.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        </div>

        <div className={`ds-advanced-filters ${showFilters ? "open" : ""}`}>
          <div className="ds-filter-grid">
            <label><span>Sub-subcategory</span><select value={selectedSubSubCategory} disabled={!selectedSubCategory} onChange={(e) => { setSelectedSubSubCategory(e.target.value); setSelectedItem(""); }}><option value="">All sub-subcategories</option>{subSubCategories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label><span>Min price</span><input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="$0" /></label>
            <label><span>Max price</span><input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Any" /></label>
            <label><span>Min BEP</span><input type="number" value={minBEP} onChange={(e) => setMinBEP(e.target.value)} placeholder="$0" /></label>
            <label><span>Max BEP</span><input type="number" value={maxBEP} onChange={(e) => setMaxBEP(e.target.value)} placeholder="Any" /></label>
            <label><span>Min sold</span><input type="number" value={minSold} onChange={(e) => setMinSold(e.target.value)} placeholder="0" /></label>
            <label><span>Max sold</span><input type="number" value={maxSold} onChange={(e) => setMaxSold(e.target.value)} placeholder="Any" /></label>
          </div>
        </div>

        <div className="ds-filter-footer">
          <span>{filteredProducts.length} of {products.length} products</span>
          <button className="ds-button ds-button-secondary" type="button" onClick={resetFilters}>Reset filters</button>
        </div>
      </section>

      <section className="ds-panel ds-products-results">
        <div className="ds-results-toolbar">
          <div>
            <h2 className="ds-section-title">Results</h2>
            <p className="ds-section-copy">Click sortable column headings to change ranking.</p>
          </div>
          <label className="ds-sort-mobile"><span>Sort</span><select value={sortField} onChange={(e) => handleSort(e.target.value)}><option value="">Default</option><option value="Title">Title</option><option value="Sold">Sold</option><option value="Price">Price</option><option value="BEP">BEP</option></select></label>
        </div>

        {loading && <div className="ds-empty">Loading product data…</div>}
        {!loading && error && <div className="ds-empty ds-danger-text">{error}</div>}
        {!loading && !error && paginatedProducts.length === 0 && <div className="ds-empty">No products match these filters.</div>}

        {!loading && !error && paginatedProducts.length > 0 && (
          <>
            <div className="ds-products-table-wrap">
              <table className="ds-products-table">
                <thead><tr>
                  <th onClick={() => handleSort("Title")}>Title</th>
                  <th onClick={() => handleSort("Sold")}>Sold</th>
                  <th onClick={() => handleSort("Price")}>Price</th>
                  <th onClick={() => handleSort("BEP")}>BEP</th>
                  <th>Category</th><th>Item</th><th>Sell evidence</th><th>Buy source</th>
                </tr></thead>
                <tbody>{paginatedProducts.map((product) => (
                  <tr key={product.id}>
                    <td title={product.Title}>{truncate(product.Title)}</td>
                    <td>{product.Sold ?? "N/A"}</td>
                    <td>{money(product.Price)}</td>
                    <td>{money(product.BEP)}</td>
                    <td>{product.Category || "N/A"}<small>{product.SubCategory || ""}</small></td>
                    <td>{product.Item || product.SubSubCategory || "N/A"}</td>
                    <td>{product.Sell ? <a className="ds-evidence-link" href={product.Sell} target="_blank" rel="noopener noreferrer">View sell ↗</a> : "N/A"}</td>
                    <td>{product.Buy ? <a className="ds-evidence-link" href={product.Buy} target="_blank" rel="noopener noreferrer">View buy ↗</a> : "N/A"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>

            <div className="ds-product-cards">
              {paginatedProducts.map((product) => (
                <article className="ds-product-card" key={product.id}>
                  <div className="ds-product-card-title"><FaTag /><span>{truncate(product.Title, 80)}</span></div>
                  <div className="ds-product-card-stats">
                    <div><span><FaShoppingCart /> Sold</span><strong>{product.Sold ?? "N/A"}</strong></div>
                    <div><span>Price</span><strong>{money(product.Price)}</strong></div>
                    <div><span>BEP</span><strong>{money(product.BEP)}</strong></div>
                  </div>
                  <div className="ds-product-card-actions">
                    {product.Sell ? <a className="ds-button ds-button-primary" href={product.Sell} target="_blank" rel="noopener noreferrer">View sell evidence</a> : <span className="ds-muted">No sell link</span>}
                    {product.Buy ? <a className="ds-button ds-button-secondary" href={product.Buy} target="_blank" rel="noopener noreferrer">View buy source</a> : <span className="ds-muted">No buy link</span>}
                  </div>
                  <details><summary>More details</summary><dl>
                    <div><dt>Dimensions</dt><dd>{product.Dimensions || "N/A"}</dd></div>
                    <div><dt>Category</dt><dd>{product.Category || "N/A"}</dd></div>
                    <div><dt>Subcategory</dt><dd>{product.SubCategory || "N/A"}</dd></div>
                    <div><dt>Sub-subcategory</dt><dd>{product.SubSubCategory || "N/A"}</dd></div>
                    <div><dt>Item</dt><dd>{product.Item || "N/A"}</dd></div>
                  </dl></details>
                </article>
              ))}
            </div>
          </>
        )}

        {!loading && !error && filteredProducts.length > itemsPerPage && (
          <Pagination totalItems={filteredProducts.length} itemsPerPage={itemsPerPage} currentPage={currentPage} onPageChange={setCurrentPage} />
        )}
      </section>
    </main>
  );
};

export default ProductData;
