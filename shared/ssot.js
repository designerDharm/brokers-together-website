/**
 * Brokers Together — Single Source of Truth (SSoT) Module
 * =========================================================
 * Canonical enums, terminology, CTA labels, and formatter utilities.
 * ALL UI components must import from this file — never define independently.
 *
 * India locale: en-IN | Currency: INR (₹) | Phone: +91
 */

(function (global) {
  'use strict';

  /* ============================================================
     1. CANONICAL PROJECT STATUS ENUM
     ============================================================ */
  const PROJECT_STATUS = Object.freeze({
    DRAFT:            'Draft',
    UNDER_REVIEW:     'Under Review',
    LIVE:             'Live',
    REQUIRES_CHANGES: 'Requires Changes',
    INACTIVE:         'Inactive'
  });

  /* Visual mapping for each canonical status */
  const STATUS_DISPLAY = Object.freeze({
    [PROJECT_STATUS.DRAFT]: {
      label: 'Draft',
      cssClass: 'status-draft',
      color: '#94A3B8',
      bg: '#F1F5F9'
    },
    [PROJECT_STATUS.UNDER_REVIEW]: {
      label: 'Under Review',
      cssClass: 'status-review',
      color: '#B89555',
      bg: '#FEF9EC'
    },
    [PROJECT_STATUS.LIVE]: {
      label: 'Live',
      cssClass: 'status-live',
      color: '#059669',
      bg: '#D1FAE5'
    },
    [PROJECT_STATUS.REQUIRES_CHANGES]: {
      label: 'Requires Changes',
      cssClass: 'status-changes',
      color: '#EA580C',
      bg: '#FFF7ED'
    },
    [PROJECT_STATUS.INACTIVE]: {
      label: 'Inactive',
      cssClass: 'status-inactive',
      color: '#9CA3AF',
      bg: '#F9FAFB'
    }
  });

  /* Off-Market is a visibility flag, not a status — display variant */
  const OFF_MARKET_DISPLAY = Object.freeze({
    label: 'Off-Market VIP',
    cssClass: 'status-vip',
    color: '#7C3AED',
    bg: '#EDE9FE'
  });

  /* ============================================================
     2. CANONICAL USER ROLES
     ============================================================ */
  const USER_ROLES = Object.freeze({
    PROPERTY_OWNER: 'Property Owner',
    DEVELOPER:      'Developer',
    BROKER:         'Broker'
  });

  /* ============================================================
     3. CANONICAL CTA LABELS
     ============================================================ */
  const CTA = Object.freeze({
    LIST_NEW_PROJECT:   'List New Project',
    VIEW_INQUIRY:       'View Inquiry',
    REPLY:              'Reply',
    MANAGE_SETTINGS:    'Manage Settings',
    CONTACT_SUPPORT:    'Contact Support',
    BOOK_A_CALL:        'Book a Call',
    VISIT_HELP_CENTER:  'Visit Help Center',
    EDIT_LISTING:       'Edit Listing',
    DEACTIVATE:         'Deactivate',
    VIEW_ALL:           'View All',
    SEND_RESPONSE:      'Send Response',
    SAVE_PREFERENCES:   'Save Preferences',
    LOG_OUT:            'Log Out',
    SIGN_OUT:           'Sign Out'
  });

  /* ============================================================
     4. CANONICAL TERMINOLOGY
     ============================================================ */
  const TERMS = Object.freeze({
    APP_NAME:           'Brokers Together',
    BROKER_NETWORK:     'Broker Network',
    ACTIVE_PROJECTS:    'Active Projects',
    UNDER_REVIEW_KPI:   'Under Review',
    NEW_INQUIRIES:      'New Inquiries',
    UNREAD_MESSAGES:    'Unread Messages',
    RECENT_PROJECTS:    'Recent Projects',
    RECENT_INQUIRIES:   'Recent Broker Inquiries',
    RECENT_ACTIVITY:    'Recent Activity',
    PROJECT_STATUS_OV:  'Project Status Overview',
    PERFORMANCE_CHART:  'Performance & Listing Insights',
    PRIVACY_WIDGET:     'Privacy & Visibility',
    NEED_HELP:          'Need Help?',
    DASHBOARD:          'Dashboard',
    MY_PROJECTS:        'My Projects',
    INQUIRIES:          'Inquiries',
    MESSAGES:           'Messages',
    ANALYTICS:          'Analytics',
    SETTINGS:           'Settings',
    SUPPORT:            'Support',
    LISTING_VIEWS:      'Listing Views',
    BROKER_INQUIRIES:   'Broker Inquiries',
    DEALS_IN_PROGRESS:  'Deals in Progress',
    VISIBLE_TO_NETWORK: 'Visible to Broker Network',
    IN_LAST_7_DAYS:     'In the last 7 days',
    ACTION_REQUIRED:    'Action required'
  });

  /* ============================================================
     5. INDIA LOCALE FORMATTER UTILITIES
     ============================================================ */

  /**
   * Format a number as Indian Rupees.
   * @param {number|string} amount  Raw value in paise or rupees
   * @param {Object} opts
   * @param {boolean} opts.compact  If true, abbreviate: ₹95 Cr, ₹2.5 L
   * @returns {string}
   */
  function formatCurrency(amount, opts = {}) {
    if (amount == null || amount === '') return '—';
    const num = Number(amount);
    if (isNaN(num)) return '—';

    if (opts.compact) {
      if (num >= 1e7) {
        return '₹' + (num / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' Cr';
      } else if (num >= 1e5) {
        return '₹' + (num / 1e5).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' L';
      }
      return '₹' + num.toLocaleString('en-IN');
    }

    return '₹' + num.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  /**
   * Format a date string for Indian locale.
   * Input: ISO string or "12 Mar 2024" → Output: "12 Mar 2024"
   * @param {string} dateStr
   * @returns {string}
   */
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    // Already in display format like "12 Mar 2024"
    if (/^\d{1,2}\s[A-Za-z]{3}\s\d{4}$/.test(dateStr)) return dateStr;
    try {
      const d = new Date(dateStr);
      if (isNaN(d)) return dateStr;
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  /**
   * Format a date range string for Indian locale.
   * @param {string} range  e.g. "10 Mar 2024 – 16 Mar 2024"
   * @returns {string}
   */
  function formatDateRange(range) {
    if (!range) return '—';
    return range;
  }

  /**
   * Format a phone number in Indian standard.
   * @param {string} phone
   * @returns {string}
   */
  function formatPhone(phone) {
    if (!phone) return '—';
    // Already formatted
    if (phone.startsWith('+91')) return phone;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
    }
    return phone;
  }

  /**
   * Format area in sq ft with Indian number formatting.
   * @param {number|string} sqft
   * @returns {string}
   */
  function formatArea(sqft) {
    if (sqft == null || sqft === '') return '—';
    return Number(sqft).toLocaleString('en-IN') + ' sq ft';
  }

  /**
   * Format a large count number using Indian system (L/Cr suffix).
   * @param {number} n
   * @returns {string}
   */
  function formatNumber(n) {
    if (n == null) return '—';
    const num = Number(n);
    if (isNaN(num)) return String(n);
    if (num >= 1e7) return (num / 1e7).toFixed(1).replace(/\.0$/, '') + ' Cr';
    if (num >= 1e5) return (num / 1e5).toFixed(1).replace(/\.0$/, '') + ' L';
    return num.toLocaleString('en-IN');
  }

  /* ============================================================
     6. STATUS DISPLAY HELPER
     ============================================================ */

  /**
   * Get display config for a listing's status.
   * Handles Off-Market VIP as a Live variant.
   * @param {string} status  Canonical status string
   * @param {boolean} isOffMarket  Whether listing is off-market
   * @returns {{ label, cssClass, color, bg }}
   */
  function getStatusDisplay(status, isOffMarket) {
    if (isOffMarket && (status === PROJECT_STATUS.LIVE || !status)) {
      return OFF_MARKET_DISPLAY;
    }
    return STATUS_DISPLAY[status] || STATUS_DISPLAY[PROJECT_STATUS.INACTIVE];
  }

  /**
   * Get a status pill HTML string.
   * @param {string} status
   * @param {boolean} isOffMarket
   * @returns {string} HTML
   */
  function statusPillHTML(status, isOffMarket) {
    const d = getStatusDisplay(status, isOffMarket);
    return `<span class="status-pill ${d.cssClass}" style="color:${d.color};background:${d.bg};">${d.label}</span>`;
  }

  /* ============================================================
     7. COMPUTED METRICS FROM LIVE DATA
     ============================================================ */

  /**
   * Compute owner-specific dashboard metrics from live listings + deals.
   * This ensures no metric duplication across components.
   * @param {Array} listings  All listings from store
   * @param {Array} deals     All deals from store
   * @param {string} ownerId  Current owner's user ID
   * @returns {Object}
   */
  function computeOwnerMetrics(listings, deals, ownerId) {
    const ownerListings = (listings || []).filter(
      l => l.ownerId === ownerId || (!l.ownerId && ownerId === 'usr-101')
    );
    const liveListings = ownerListings.filter(
      l => l.status === PROJECT_STATUS.LIVE
    );
    const underReviewListings = ownerListings.filter(
      l => l.status === PROJECT_STATUS.UNDER_REVIEW
    );
    const draftListings = ownerListings.filter(
      l => l.status === PROJECT_STATUS.DRAFT
    );
    const changesListings = ownerListings.filter(
      l => l.status === PROJECT_STATUS.REQUIRES_CHANGES
    );
    const inactiveListings = ownerListings.filter(
      l => l.status === PROJECT_STATUS.INACTIVE
    );

    const ownerDeals = (deals || []).filter(d =>
      ownerListings.some(l => l.id === d.listingId)
    );
    const newDeals = ownerDeals.filter(
      d => d.status === 'New'
    );
    const unreadDeals = ownerDeals.filter(
      d => d.status === 'New'
    );

    const totalViews = ownerListings.reduce((sum, l) => sum + (l.views || 0), 0);

    return {
      activeProjects: liveListings.length,
      underReview: underReviewListings.length,
      newInquiries: newDeals.length,
      totalInquiries: ownerDeals.length,
      unreadMessages: unreadDeals.length,
      totalViews,
      statusOverview: {
        total: ownerListings.length,
        live: liveListings.length,
        underReview: underReviewListings.length,
        draft: draftListings.length,
        requiresChanges: changesListings.length,
        inactive: inactiveListings.length
      },
      ownerListings,
      ownerDeals
    };
  }

  /* ============================================================
     8. EXPORT GLOBAL NAMESPACE
     ============================================================ */
  global.BTSST = Object.freeze({
    PROJECT_STATUS,
    STATUS_DISPLAY,
    OFF_MARKET_DISPLAY,
    USER_ROLES,
    CTA,
    TERMS,
    formatCurrency,
    formatDate,
    formatDateRange,
    formatPhone,
    formatArea,
    formatNumber,
    getStatusDisplay,
    statusPillHTML,
    computeOwnerMetrics
  });

  console.log('✅ Brokers Together SSoT module loaded (BTSST)');

})(window);
