/**
 * Brokers Together - Ecosystem Reactive SSoT Client
 * Bridges UI components to backend RemoteConfig & Real-Time WebSocket Store.
 * Enforces Zero Hardcoding & SSoT rules across User App, Admin Panel & Counsellor App.
 */

const API_BASE_URL = window.ENV_API_URL || 'http://localhost:5050';
const WS_BASE_URL = window.ENV_WS_URL || 'ws://localhost:5050';

class EcosystemStore {
  constructor() {
    this.listeners = new Set();
    this.state = {
      settings: {
        appName: "Brokers Together",
        tagline: "The Premier Broker Network & Owner Real Estate Platform",
        primaryColor: "#B89555",
        webDomain: "propertyassist.info",
        configurableClaims: {
          verifiedBrokersCount: "800+",
          appDownloadsCount: "1,600+",
          activeRequirementsCount: "400+",
          satisfactionRate: "96%",
          averageRating: "4.5 / 5.0",
          approvalTimeframe: "Under 24 Hours"
        }
      },
      users: [],
      counsellors: [],
      listings: [],
      deals: [],
      auditLogs: [],
      isConnected: false,
      lastSync: null
    };
    this.ws = null;
    this.initWebSocket();
    this.fetchInitialData();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    // Trigger immediately with current state
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (e) {
        console.error('Listener notification error:', e);
      }
    }
  }

  async fetchInitialData() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/ecosystem`);
      if (res.ok) {
        const data = await res.json();
        this.state = {
          ...this.state,
          settings: data.globalSettings || {},
          users: data.users || [],
          counsellors: data.counsellors || [],
          listings: data.listings || [],
          deals: data.deals || [],
          auditLogs: data.auditLogs || [],
          lastSync: new Date().toISOString()
        };
        this.notify();
      }
    } catch (err) {
      console.warn('Backend connection warning. Retrying in 3s...', err);
      setTimeout(() => this.fetchInitialData(), 3000);
    }
  }

  initWebSocket() {
    try {
      this.ws = new WebSocket(WS_BASE_URL);

      this.ws.onopen = () => {
        console.log('✅ Real-time Ecosystem WebSocket connected');
        this.state.isConnected = true;
        this.notify();
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleRealtimeEvent(payload);
        } catch (err) {
          console.error('Error handling WS event:', err);
        }
      };

      this.ws.onclose = () => {
        console.warn('⚡ Ecosystem WebSocket disconnected. Reconnecting in 2s...');
        this.state.isConnected = false;
        this.notify();
        setTimeout(() => this.initWebSocket(), 2000);
      };
    } catch (e) {
      console.error('WebSocket init error:', e);
    }
  }

  handleRealtimeEvent(payload) {
    const { event, data } = payload;
    console.log(`📡 Real-time Sync Event: ${event}`, data);

    if (event === 'INIT_SYNC') {
      this.state.settings = data.globalSettings || this.state.settings;
      this.state.users = data.users || this.state.users;
      this.state.counsellors = data.counsellors || this.state.counsellors;
      this.state.listings = data.listings || this.state.listings;
      this.state.deals = data.deals || this.state.deals;
      this.state.auditLogs = data.auditLogs || this.state.auditLogs;
    } else if (event === 'SETTINGS_UPDATED') {
      this.state.settings = data;
    } else if (event === 'USER_ADDED') {
      this.state.users = [data, ...this.state.users];
    } else if (event === 'COUNSELLOR_ADDED') {
      this.state.counsellors = [data, ...this.state.counsellors];
    } else if (event === 'COUNSELLOR_UPDATED') {
      const idx = this.state.counsellors.findIndex(c => c.id === data.id);
      if (idx !== -1) this.state.counsellors[idx] = data;
    } else if (event === 'LISTING_ADDED') {
      this.state.listings = [data, ...this.state.listings];
    } else if (event === 'LISTING_UPDATED') {
      const idx = this.state.listings.findIndex(l => l.id === data.id);
      if (idx !== -1) this.state.listings[idx] = data;
    } else if (event === 'DEAL_ADDED') {
      this.state.deals = [data, ...this.state.deals];
    } else if (event === 'DEAL_UPDATED') {
      const idx = this.state.deals.findIndex(d => d.id === data.id);
      if (idx !== -1) this.state.deals[idx] = data;
    } else if (event === 'FORCE_FULL_SYNC') {
      this.fetchInitialData();
    }

    this.state.lastSync = new Date().toISOString();
    this.notify();
  }

  // Action methods
  async updateRemoteSettings(newSettings) {
    const res = await fetch(`${API_BASE_URL}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings)
    });
    return res.json();
  }

  async addListing(listingData) {
    const res = await fetch(`${API_BASE_URL}/api/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(listingData)
    });
    return res.json();
  }

  async addCounsellor(counsellorData) {
    const res = await fetch(`${API_BASE_URL}/api/counsellors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(counsellorData)
    });
    return res.json();
  }

  async updateCounsellorStatus(id, status) {
    const res = await fetch(`${API_BASE_URL}/api/counsellors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    return res.json();
  }

  async createDeal(dealData) {
    const res = await fetch(`${API_BASE_URL}/api/deals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dealData)
    });
    return res.json();
  }

  async updateDealStatus(id, status) {
    const res = await fetch(`${API_BASE_URL}/api/deals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    return res.json();
  }

  async updateListingStatus(id, status) {
    const res = await fetch(`${API_BASE_URL}/api/listings/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    return res.json();
  }

  async replyToDeal(id, replyText) {
    const res = await fetch(`${API_BASE_URL}/api/deals/${id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replyText })
    });
    return res.json();
  }

  async triggerForceSync() {
    const res = await fetch(`${API_BASE_URL}/api/sync-broadcast`, { method: 'POST' });
    return res.json();
  }
}

// Global Singleton Instance
window.ecosystemStore = new EcosystemStore();
