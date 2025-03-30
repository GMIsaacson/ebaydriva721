import React, { useState, useEffect } from "react";
import "./pagination.css";

const Pagination = ({
  totalItems,
  itemsPerPage: defaultItemsPerPage = 10,
  onPageChange,
  pageRange = 2,
  theme = "light",
  firstLabel = "« First",
  prevLabel = "«",
  nextLabel = "»",
  lastLabel = "Last »",
  loadingMessage = "Loading page...",
  emptyMessage = "No items available.",
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(defaultItemsPerPage);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]); // Store current page data
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Fetch data only for the current page
  const fetchData = async (page) => {
    setLoading(true);
    // Simulate fetching data from a database or API
    const fetchedData = await onPageChange(page, itemsPerPage);
    setData(fetchedData);
    setLoading(false);
  };

  useEffect(() => {
    if (totalPages > 1) fetchData(currentPage);
  }, [currentPage, itemsPerPage]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      fetchData(page);
    }
  };

  const handlePageSizeChange = (newSize) => {
    setItemsPerPage(newSize);
    setCurrentPage(1); // Reset to first page
  };

  const renderPageNumbers = () => {
    const pageNumbers = [];
    const startPage = Math.max(1, currentPage - pageRange);
    const endPage = Math.min(totalPages, currentPage + pageRange);

    if (startPage > 1) {
      pageNumbers.push(
        <a
          key="jump-backward"
          href="#"
          className="page-link"
          onClick={(e) => {
            e.preventDefault();
            handlePageChange(Math.max(1, currentPage - 5));
          }}
        >
          ...
        </a>
      );
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(
        <a
          key={i}
          href="#"
          className={`page-link ${i === currentPage ? "active" : ""}`}
          aria-current={i === currentPage ? "page" : undefined}
          aria-label={`Go to page ${i}`}
          onClick={(e) => {
            e.preventDefault();
            handlePageChange(i);
          }}
        >
          {i}
        </a>
      );
    }

    if (endPage < totalPages) {
      pageNumbers.push(
        <a
          key="jump-forward"
          href="#"
          className="page-link"
          onClick={(e) => {
            e.preventDefault();
            handlePageChange(Math.min(totalPages, currentPage + 5));
          }}
        >
          ...
        </a>
      );
    }

    return pageNumbers;
  };

  // Hide pagination when unnecessary
  if (totalPages < 2) {
    return <div className="pagination-empty">{totalItems > 0 ? null : emptyMessage}</div>;
  }

  return (
    <div className={`pagination ${theme}`}>
      {loading ? (
        <div className="pagination-loader">{`${loadingMessage} ${currentPage}`}</div>
      ) : (
        <>
          <div className="pagination-controls">
            <a
              href="#"
              className={`page-link ${currentPage === 1 ? "disabled" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                handlePageChange(1);
              }}
            >
              {firstLabel}
            </a>
            <a
              href="#"
              className={`page-link ${currentPage === 1 ? "disabled" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                handlePageChange(currentPage - 1);
              }}
            >
              {prevLabel}
            </a>
            {renderPageNumbers()}
            <a
              href="#"
              className={`page-link ${currentPage === totalPages ? "disabled" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                handlePageChange(currentPage + 1);
              }}
            >
              {nextLabel}
            </a>
            <a
              href="#"
              className={`page-link ${currentPage === totalPages ? "disabled" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                handlePageChange(totalPages);
              }}
            >
              {lastLabel}
            </a>
          </div>

          <div className="page-options">
            <label htmlFor="itemsPerPage">Items per page:</label>
            <select
              id="itemsPerPage"
              className="page-size-selector"
              value={itemsPerPage}
              onChange={(e) => handlePageSizeChange(parseInt(e.target.value, 10))}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <label htmlFor="pageInput">Go to page:</label>
            <input
              id="pageInput"
              type="number"
              className="page-input"
              min="1"
              max={totalPages}
              value={currentPage}
              onChange={(e) => handlePageChange(Number(e.target.value))}
              aria-label="Go to page"
            />
          </div>
        </>
      )}
    </div>
  );
};

export default Pagination;



