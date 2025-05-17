import React, { useState, useMemo } from 'react';
import { Box } from '@mui/material';
import { WatchlistFilter } from './WatchlistFilter';

const Watchlist = () => {
  const [showPrivateOnly, setShowPrivateOnly] = useState(false);
  const [filterStatus, setFilterStatus] = useState([]);
  const [filterTags, setFilterTags] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [allTags, setAllTags] = useState([]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Status Filter
      if (filterStatus.length > 0) {
        const hasMatchingStatus = filterStatus.some(status => {
          const userData = item.userData || {};
          return userData.status === status;
        });
        if (!hasMatchingStatus) return false;
      }

      // Tags Filter
      if (filterTags.length > 0) {
        const hasMatchingTag = filterTags.some(filterTag => {
          const userData = item.userData || {};
          return userData.tags?.some(tag => tag.label === filterTag.label);
        });
        if (!hasMatchingTag) return false;
      }

      // Private Titel Filter
      if (showPrivateOnly) {
        const userData = item.userData || {};
        const isPrivate = userData.isPrivate || userData.tags?.some(tag => 
          tag.label.toLowerCase().includes('privat') || 
          tag.label.toLowerCase().includes('lw')
        );
        if (!isPrivate) return false;
      }

      return true;
    });
  }, [items, filterStatus, filterTags, showPrivateOnly]);

  return (
    <Box sx={{ p: 3 }}>
      <WatchlistFilter
        filterOpen={filterOpen}
        setFilterOpen={setFilterOpen}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        filterTags={filterTags}
        setFilterTags={setFilterTags}
        allTags={allTags}
        showPrivateOnly={showPrivateOnly}
        setShowPrivateOnly={setShowPrivateOnly}
      />
    </Box>
  );
};

export default Watchlist; 