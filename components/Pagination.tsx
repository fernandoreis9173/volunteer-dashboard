import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange, className = '' }) => {
  const [maxVisiblePages, setMaxVisiblePages] = React.useState(5);

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setMaxVisiblePages(3);
      } else {
        setMaxVisiblePages(5);
      }
    };

    // Set initial value
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (totalPages <= 1) {
    return null;
  }

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  };

  const renderPageNumbers = () => {
    const pages: number[] = [];

    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages.map((page) => (
      <li key={page}>
        <button
          onClick={() => handlePageChange(page)}
          className={`flex items-center justify-center px-3 h-8 leading-tight transition-colors duration-150 rounded-lg text-sm font-medium ${currentPage === page
              ? 'bg-blue-600 text-white border border-blue-600 shadow-sm'
              : 'text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 hover:text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white'
            }`}
        >
          {page}
        </button>
      </li>
    ));
  };

  return (
    <nav aria-label="Pagination" className={`flex justify-center mt-8 ${className}`}>
      <ul className="flex justify-center items-center gap-1.5 sm:gap-2">
        {/* First Page */}
        <li>
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
            className="flex items-center justify-center px-3 h-8 leading-tight text-slate-500 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 hover:text-slate-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white dark:disabled:bg-slate-800/50 dark:disabled:text-slate-600 transition-colors duration-150"
          >
            <span className="sr-only">Primeira</span>
            <svg className="w-3.5 h-3.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
            </svg>
          </button>
        </li>

        {/* Previous Page */}
        <li>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center justify-center px-3 h-8 leading-tight text-slate-500 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 hover:text-slate-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white dark:disabled:bg-slate-800/50 dark:disabled:text-slate-600 transition-colors duration-150"
          >
            <span className="sr-only">Anterior</span>
            <svg className="w-3.5 h-3.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 1 1 5l4 4" />
            </svg>
          </button>
        </li>

        {renderPageNumbers()}

        {/* Next Page */}
        <li>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex items-center justify-center px-3 h-8 leading-tight text-slate-500 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 hover:text-slate-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white dark:disabled:bg-slate-800/50 dark:disabled:text-slate-600 transition-colors duration-150"
          >
            <span className="sr-only">Próximo</span>
            <svg className="w-3.5 h-3.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 9 4-4-4-4" />
            </svg>
          </button>
        </li>

        {/* Last Page */}
        <li>
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="flex items-center justify-center px-3 h-8 leading-tight text-slate-500 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 hover:text-slate-700 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white dark:disabled:bg-slate-800/50 dark:disabled:text-slate-600 transition-colors duration-150"
          >
            <span className="sr-only">Última</span>
            <svg className="w-3.5 h-3.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default Pagination;