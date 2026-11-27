import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../services/api';

const SettingsContext = createContext(null);

export const DEFAULT_SETTINGS = {
  store_name: 'Majestic Blazer',
  brand_tagline: 'Style That Speaks',
  store_address: 'Majestic Blazer Shop – First Floor, Shop No. 99/6, Sathy Rd, Opp. to Saravana Bhavan Hotel, Kurumbapalayam, Coimbatore - 641107',
  store_phone: '8903238882',
  store_email: 'contact@majesticblazer.com',
  tax_percentage: '0',
  shipping_fee: '0',
  gst_registration_number: '',
  razorpay_key_id: '',
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      // settings endpoint is public read
      const res = await api('/settings', { auth: false });
      if (res.data) {
        setSettings((prev) => ({ ...prev, ...res.data }));
      }
    } catch (err) {
      console.warn('Failed to fetch settings from server, falling back to defaults:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(async (newSettings) => {
    const res = await api.put('/settings', newSettings);
    if (res.data) {
      setSettings((prev) => ({ ...prev, ...res.data }));
    }
    return res.data;
  }, []);

  const value = useMemo(
    () => ({
      settings,
      loading,
      refreshSettings: fetchSettings,
      updateSettings,
    }),
    [settings, loading, fetchSettings, updateSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    return {
      settings: DEFAULT_SETTINGS,
      loading: false,
      refreshSettings: () => {},
      updateSettings: async () => {},
    };
  }
  return ctx;
};
