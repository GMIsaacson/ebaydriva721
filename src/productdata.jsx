import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, getFirestore } from "firebase/firestore";
import {
  FaChevronDown,
  FaChevronUp,
  FaDownload,
  FaExternalLinkAlt,
  FaFilter,
  FaSearch,
  FaShoppingCart,
  FaTag,
  FaTimes,
} from "react-icons/fa";
import app from "./firebase-config";
import Pagination from "./pagination";
import "./productdata.css";

const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const researchExportFields = [
  ["Document ID", "id"],
  ["Title", "Title"],
  ["Sold", "Sold"],
  ["Price", "Price"],
  ["BEP", "BEP"],
  ["Category", "Category"],
  ["SubCategory", "SubCategory"],
  ["SubSubCategory", "SubSubCategory"],
  ["Item", "Item"],
  ["Dimensions", "Dimensions"],
  ["Sell URL", "Sell"],
  ["Buy URL", "Buy"],
];

const csvCell = (value) => {
  if (value === null || value === undefined) return '""';
  const normalized = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
};

const downloadCsv = (filename, rows) => {
  const blob = new Blob([`\uFEFF${rows.join("\n")}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const ProductData = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedSubCategory, selectedSubSubCategory, selectedItem, minPrice, maxPrice, minBEP, maxBEP, minSold, maxSold, sortField, sortDirection]);

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
    setMinPrice("");
    setMaxPrice("");
    setMinBEP("");
    setMaxBEP("");
    setMinSold("");
    setMaxSold("");
    setSortField("");
    setSortDirection("asc");
  };

  const exportResearchCatalog = () => {
    const exportedAt = new Date().toISOString();
    const header = ["Exported At", ...researchExportFields.map(([label]) => label)].map(csvCell).join(",");
    const rows = products.map((product) => [
      exportedAt,
      ...researchExportFields.map(([, field]) => product?.[field] ?? ""),
    ].map(csvCell).join(","));

    const dateStamp = exportedAt.slice(0, 10);
    downloadCsv(`datascout-research-export-${dateStamp}.csv`, [header, ...rows]);
  };

  const money = (value) => {
    const parsed = numberValue(value);
    return parsed === null ? "N/A" : `$${parsed.toFixed(2)}`;
  };

  const truncate = (text, limit = 56) => {
    if (!text) return "N/A";
    return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
  };

  const activeFilterCount = [
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
  ].filter((value) => value !== "").length;

  const activeChips = [
    selectedCategory && {
      key: "category",
      label: selectedCategory,
      clear: () => {
        setSelectedCategory("");
        setSelectedSubCategory("");
        setSelectedSubSubCategory("");
        setSelectedItem("");
      },
    },
    selectedSubCategory && {
      key: "subcategory",
      label: selectedSubCategory,
      clear: () => {
        setSelectedSubCategory("");
        setSelectedSubSubCategory("");
        setSelectedItem("");
      },
    },
    selectedSubSubCategory && {
      key: "subsubcategory",
      label: selectedSubSubCategory,
      clear: () => {
        setSelectedSubSubCategory("");
        setSelectedItem("");
      },
    },
    selectedItem && { key: "item", label: selectedItem, clear: () => setSelectedItem("") },
    (minPrice || maxPrice) && {
      key: "price",
      label: `Price ${minPrice ? `$${minPrice}` : "any"}–${maxPrice ? `$${maxPrice}` : "any"}`,
      clear: () => { setMinPrice(""); setMaxPrice(""); },
    },
    (minBEP || maxBEP) && {
      key: "bep",
      label: `BEP ${minBEP ? `$${minBEP}` : "any"}–${maxBEP ? `$${maxBEP}` : "any"}`,
      clear: () => { setMinBEP(""); setMaxBEP(""); },
    },
    (minSold || maxSold) && {
      key: "sold",
      label: `Sold ${minSold || "any"}–${maxSold || "any"}`,
      clear: () => { setMinSold(""); setMaxSold(""); },
    },
  ].filter(Boolean);

  const sortIndicator = (field) => {
    if (sortField !== field) return <span className="ds-sort-indicator">↕</span>;
    return sortDirection === "asc" ? <FaChevronUp className="ds-sort-active" /> : <FaChevronDown className="ds-sort-active" />;
  };

  return (
    <main className="ds-page ds-products-page">
      <header className="ds-products-header ds-products-header-production">
        <div>
          <p className="ds-products-eyebrow">SOURCING INTELLIGENCE</p>
          <h1>Product opportunities</h1>
          <p>{products.length.toLocaleString()} opportunities in the working catalog · {filteredProducts.length.toLocaleString()} currently visible</p>
        </div>
        <button
          className="ds-button ds-button-secondary ds-header-export"
          type="button"
          onClick={exportResearchCatalog}
          disabled={loading || Boolean(error) || products.length === 0}
          title="Export the complete Firestore product catalog, ignoring current filters"
        >
          <FaDownload /> Export catalog
        </button>
      </header>

      <section className="ds-opportunity-commandbar" aria-label="Opportunity search and filters">
        <label className="ds-opportunity-search">
          <FaSearch aria-hidden="true" />
          <span className="ds-sr-only">Search opportunities</span>
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search products, categories, or items…" />
          {searchTerm && <button type="button" onClick={() => setSearchTerm("")} aria-label="Clear search"><FaTimes /></button>}
        </label>

        <label className="ds-opportunity-category">
          <span className="ds-sr-only">Category</span>
          <select
            value={selectedCategory}
            onChange={(event) => {
              setSelectedCategory(event.target.value);
              setSelectedSubCategory("");
              setSelectedSubSubCategory("");
              setSelectedItem("");
            }}
          >
            <option value="">All categories</option>
            {categories.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>

        <button className={`ds-button ds-button-secondary ds-filter-launch ${activeFilterCount ? "active" : ""}`} type="button" onClick={() => setShowFilters(true)}>
          <FaFilter /> Filters {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
        </button>
      </section>

      {(activeChips.length > 0 || searchTerm) && (
        <div className="ds-active-filter-row" aria-label="Active filters">
          <span>Active</span>
          {activeChips.map((chip) => (
            <button type="button" className="ds-filter-chip" key={chip.key} onClick={chip.clear} title={`Remove ${chip.label} filter`}>
              {chip.label}<FaTimes aria-hidden="true" />
            </button>
          ))}
          <button type="button" className="ds-clear-filters" onClick={resetFilters}>Clear all</button>
        </div>
      )}

      <section className="ds-products-results ds-products-results-production">
        <div className="ds-results-toolbar ds-results-toolbar-production">
          <div>
            <strong>{filteredProducts.length.toLocaleString()} results</strong>
            <span>Click a row for full sourcing details</span>
          </div>
          <label className="ds-sort-mobile">
            <span>Sort</span>
            <select value={sortField} onChange={(event) => handleSort(event.target.value)}>
              <option value="">Default</option>
              <option value="Title">Title</option>
              <option value="Sold">Sold</option>
              <option value="Price">Price</option>
              <option value="BEP">BEP</option>
            </select>
          </label>
        </div>

        {loading && (
          <div className="ds-product-skeleton" aria-label="Loading product opportunities">
            {Array.from({ length: 7 }).map((_, index) => <span key={index} />)}
          </div>
        )}

        {!loading && error && (
          <div className="ds-empty ds-empty-production ds-danger-text">
            <strong>Couldn’t load opportunities</strong>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && paginatedProducts.length === 0 && (
          <div className="ds-empty ds-empty-production">
            <strong>No matching opportunities</strong>
            <p>Try adjusting the current filters or clear them to return to the full catalog.</p>
            <button className="ds-button ds-button-secondary" type="button" onClick={resetFilters}>Clear filters</button>
          </div>
        )}

        {!loading && !error && paginatedProducts.length > 0 && (
          <>
            <div className="ds-products-table-wrap ds-products-table-wrap-production">
              <table className="ds-products-table ds-products-table-production">
                <thead>
                  <tr>
                    <th onClick={() => handleSort("Title")}>Product {sortIndicator("Title")}</th>
                    <th className="ds-numeric" onClick={() => handleSort("Sold")}>Sold {sortIndicator("Sold")}</th>
                    <th className="ds-numeric" onClick={() => handleSort("Price")}>Price {sortIndicator("Price")}</th>
                    <th className="ds-numeric" onClick={() => handleSort("BEP")}>BEP {sortIndicator("BEP")}</th>
                    <th>Category</th>
                    <th>Item</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.map((product) => (
                    <tr
                      key={product.id}
                      tabIndex="0"
                      onClick={() => setSelectedProduct(product)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") setSelectedProduct(product);
                      }}
                    >
                      <td className="ds-product-primary" title={product.Title}>
                        <strong>{truncate(product.Title)}</strong>
                        <small>{[product.SubCategory, product.SubSubCategory].filter(Boolean).join(" › ")}</small>
                      </td>
                      <td className="ds-numeric ds-sold-value">{product.Sold ?? "N/A"}</td>
                      <td className="ds-numeric">{money(product.Price)}</td>
                      <td className="ds-numeric">{money(product.BEP)}</td>
                      <td>{product.Category || "N/A"}</td>
                      <td>{product.Item || product.SubSubCategory || "N/A"}</td>
                      <td className="ds-evidence-cell">
                        {product.Sell ? (
                          <a href={product.Sell} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>
                            Sell <FaExternalLinkAlt />
                          </a>
                        ) : <span>Sell —</span>}
                        {product.Buy ? (
                          <a href={product.Buy} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>
                            Source <FaExternalLinkAlt />
                          </a>
                        ) : <span>Source —</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ds-product-cards">
              {paginatedProducts.map((product) => (
                <article className="ds-product-card" key={product.id}>
                  <button className="ds-product-card-title" type="button" onClick={() => setSelectedProduct(product)}>
                    <FaTag />
                    <span>{truncate(product.Title, 80)}</span>
                  </button>
                  <p className="ds-product-card-path">{[product.Category, product.SubCategory, product.Item || product.SubSubCategory].filter(Boolean).join(" › ")}</p>
                  <div className="ds-product-card-stats">
                    <div><span><FaShoppingCart /> Sold</span><strong>{product.Sold ?? "N/A"}</strong></div>
                    <div><span>Price</span><strong>{money(product.Price)}</strong></div>
                    <div><span>BEP</span><strong>{money(product.BEP)}</strong></div>
                  </div>
                  <div className="ds-product-card-actions">
                    <button className="ds-button ds-button-primary" type="button" onClick={() => setSelectedProduct(product)}>View details</button>
                    {product.Sell && <a className="ds-button ds-button-secondary" href={product.Sell} target="_blank" rel="noopener noreferrer">Sell evidence</a>}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {!loading && !error && filteredProducts.length > itemsPerPage && (
          <Pagination totalItems={filteredProducts.length} itemsPerPage={itemsPerPage} currentPage={currentPage} onPageChange={setCurrentPage} />
        )}
      </section>

      {showFilters && (
        <>
          <button className="ds-filter-drawer-scrim" type="button" aria-label="Close filters" onClick={() => setShowFilters(false)} />
          <aside className="ds-filter-drawer" role="dialog" aria-modal="true" aria-label="Filter product opportunities">
            <div className="ds-drawer-head">
              <div><span>FILTER OPPORTUNITIES</span><h2>Refine results</h2></div>
              <button type="button" onClick={() => setShowFilters(false)} aria-label="Close filters"><FaTimes /></button>
            </div>

            <div className="ds-drawer-section">
              <h3>Category hierarchy</h3>
              <label><span>Category</span><select value={selectedCategory} onChange={(event) => { setSelectedCategory(event.target.value); setSelectedSubCategory(""); setSelectedSubSubCategory(""); setSelectedItem(""); }}><option value="">All categories</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label><span>Subcategory</span><select value={selectedSubCategory} disabled={!selectedCategory} onChange={(event) => { setSelectedSubCategory(event.target.value); setSelectedSubSubCategory(""); setSelectedItem(""); }}><option value="">All subcategories</option>{subCategories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label><span>Sub-subcategory</span><select value={selectedSubSubCategory} disabled={!selectedSubCategory} onChange={(event) => { setSelectedSubSubCategory(event.target.value); setSelectedItem(""); }}><option value="">All sub-subcategories</option>{subSubCategories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label><span>Item</span><select value={selectedItem} disabled={!selectedSubSubCategory} onChange={(event) => setSelectedItem(event.target.value)}><option value="">All items</option>{items.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            </div>

            <div className="ds-drawer-section">
              <h3>Economics</h3>
              <div className="ds-range-row">
                <label><span>Min price</span><input type="number" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="$0" /></label>
                <label><span>Max price</span><input type="number" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Any" /></label>
              </div>
              <div className="ds-range-row">
                <label><span>Min BEP</span><input type="number" value={minBEP} onChange={(event) => setMinBEP(event.target.value)} placeholder="$0" /></label>
                <label><span>Max BEP</span><input type="number" value={maxBEP} onChange={(event) => setMaxBEP(event.target.value)} placeholder="Any" /></label>
              </div>
            </div>

            <div className="ds-drawer-section">
              <h3>Demand</h3>
              <div className="ds-range-row">
                <label><span>Min sold</span><input type="number" value={minSold} onChange={(event) => setMinSold(event.target.value)} placeholder="0" /></label>
                <label><span>Max sold</span><input type="number" value={maxSold} onChange={(event) => setMaxSold(event.target.value)} placeholder="Any" /></label>
              </div>
            </div>

            <div className="ds-drawer-actions">
              <button className="ds-button ds-button-secondary" type="button" onClick={resetFilters}>Reset</button>
              <button className="ds-button ds-button-primary" type="button" onClick={() => setShowFilters(false)}>Show {filteredProducts.length.toLocaleString()} results</button>
            </div>
          </aside>
        </>
      )}

      {selectedProduct && (
        <>
          <button className="ds-detail-drawer-scrim" type="button" aria-label="Close product details" onClick={() => setSelectedProduct(null)} />
          <aside className="ds-detail-drawer" role="dialog" aria-modal="true" aria-label={`${selectedProduct.Title || "Product"} details`}>
            <div className="ds-drawer-head ds-detail-head">
              <div><span>OPPORTUNITY DETAILS</span><h2>{selectedProduct.Title || "Untitled product"}</h2></div>
              <button type="button" onClick={() => setSelectedProduct(null)} aria-label="Close product details"><FaTimes /></button>
            </div>

            <p className="ds-detail-path">{[selectedProduct.Category, selectedProduct.SubCategory, selectedProduct.SubSubCategory, selectedProduct.Item].filter(Boolean).join(" › ") || "Uncategorized"}</p>

            <div className="ds-detail-metrics">
              <div><span>Sold</span><strong>{selectedProduct.Sold ?? "N/A"}</strong></div>
              <div><span>Price</span><strong>{money(selectedProduct.Price)}</strong></div>
              <div><span>BEP</span><strong>{money(selectedProduct.BEP)}</strong></div>
            </div>

            <div className="ds-drawer-section ds-detail-evidence">
              <h3>Evidence</h3>
              <div className="ds-evidence-card">
                <div><span>Marketplace</span><strong>Sell evidence</strong></div>
                {selectedProduct.Sell ? <a href={selectedProduct.Sell} target="_blank" rel="noopener noreferrer">Open <FaExternalLinkAlt /></a> : <span className="ds-muted">Not available</span>}
              </div>
              <div className="ds-evidence-card">
                <div><span>Supplier</span><strong>Buy source</strong></div>
                {selectedProduct.Buy ? <a href={selectedProduct.Buy} target="_blank" rel="noopener noreferrer">Open <FaExternalLinkAlt /></a> : <span className="ds-muted">Not available</span>}
              </div>
            </div>

            <div className="ds-drawer-section">
              <h3>Product data</h3>
              <dl className="ds-detail-list">
                <div><dt>Category</dt><dd>{selectedProduct.Category || "N/A"}</dd></div>
                <div><dt>Subcategory</dt><dd>{selectedProduct.SubCategory || "N/A"}</dd></div>
                <div><dt>Sub-subcategory</dt><dd>{selectedProduct.SubSubCategory || "N/A"}</dd></div>
                <div><dt>Item</dt><dd>{selectedProduct.Item || "N/A"}</dd></div>
                <div><dt>Dimensions</dt><dd>{selectedProduct.Dimensions || "N/A"}</dd></div>
              </dl>
            </div>
          </aside>
        </>
      )}
    </main>
  );
};

export default ProductData;
