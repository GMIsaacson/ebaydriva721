import React, { useState } from "react";
import "./pagination.css";

const Pagination = ({ totalItems, itemsPerPage, onPageChange }) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      onPageChange(page); // Notify parent component of the page change
    }
  };

  const handlePrevious = () => {
    handlePageChange(currentPage - 1);
  };

  const handleNext = () => {
    handlePageChange(currentPage + 1);
  };

  const renderPageNumbers = () => {
    const pageNumbers = [];
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.push(
        <a
          key={i}
          href="#"
          className={`page-link ${i === currentPage ? "active" : ""}`}
          onClick={(e) => {
            e.preventDefault(); // Prevent default anchor behavior
            handlePageChange(i);
          }}
        >
          {i}
        </a>,
      );
    }
    return pageNumbers;
  };

  return (
    <div className="pagination">
      <a
        href="#"
        className="page-link"
        onClick={(e) => {
          e.preventDefault();
          handlePrevious();
        }}
        aria-disabled={currentPage === 1}
      >
        «
      </a>
      {renderPageNumbers()}
      <a
        href="#"
        className="page-link"
        onClick={(e) => {
          e.preventDefault();
          handleNext();
        }}
        aria-disabled={currentPage === totalPages}
      >
        »
      </a>
    </div>
  );
};

export default Pagination;
