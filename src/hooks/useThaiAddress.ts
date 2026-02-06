'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// ==================== TYPES ====================

interface CompactProvince {
  id: number;
  n: string; // name_th
}

interface CompactDistrict {
  id: number;
  n: string; // name_th
  p: number; // province_id
}

interface CompactSubDistrict {
  id: number;
  n: string; // name_th
  z: number; // zip_code
  d: number; // district_id
}

interface ThaiAddressData {
  provinces: CompactProvince[];
  districts: CompactDistrict[];
  subDistricts: CompactSubDistrict[];
}

export interface Province {
  id: number;
  name: string;
}

export interface District {
  id: number;
  name: string;
  provinceId: number;
}

export interface SubDistrict {
  id: number;
  name: string;
  zipCode: number;
  districtId: number;
}

export interface AddressSelection {
  province: string;
  district: string;
  subDistrict: string;
  zipCode: string;
  detail: string;
}

export interface ZipCodeResult {
  province: string;
  district: string;
  subDistricts: string[];
  provinceId: number;
  districtId: number;
}

// ==================== HOOK ====================

export function useThaiAddress() {
  const [data, setData] = useState<ThaiAddressData | null>(null);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);

  // Load data on demand (lazy)
  const loadData = useCallback(async () => {
    if (loadedRef.current || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/thai-address-data.json');
      const json: ThaiAddressData = await res.json();
      setData(json);
      loadedRef.current = true;
    } catch (err) {
      console.error('Failed to load Thai address data:', err);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // Build lookup maps for fast access
  const maps = useMemo(() => {
    if (!data) return null;

    const provinceMap = new Map<number, string>();
    const districtMap = new Map<number, CompactDistrict>();
    const districtsByProvince = new Map<number, CompactDistrict[]>();
    const subDistrictsByDistrict = new Map<number, CompactSubDistrict[]>();
    const subDistrictsByZip = new Map<number, CompactSubDistrict[]>();

    data.provinces.forEach(p => provinceMap.set(p.id, p.n));
    
    data.districts.forEach(d => {
      districtMap.set(d.id, d);
      const list = districtsByProvince.get(d.p) || [];
      list.push(d);
      districtsByProvince.set(d.p, list);
    });

    data.subDistricts.forEach(s => {
      const distList = subDistrictsByDistrict.get(s.d) || [];
      distList.push(s);
      subDistrictsByDistrict.set(s.d, distList);

      const zipList = subDistrictsByZip.get(s.z) || [];
      zipList.push(s);
      subDistrictsByZip.set(s.z, zipList);
    });

    return {
      provinceMap,
      districtMap,
      districtsByProvince,
      subDistrictsByDistrict,
      subDistrictsByZip,
    };
  }, [data]);

  // Get all provinces
  const provinces = useMemo((): Province[] => {
    if (!data) return [];
    return data.provinces.map(p => ({ id: p.id, name: p.n })).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [data]);

  // Get districts for a province
  const getDistricts = useCallback((provinceId: number): District[] => {
    if (!maps) return [];
    const list = maps.districtsByProvince.get(provinceId) || [];
    return list.map(d => ({ id: d.id, name: d.n, provinceId: d.p })).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [maps]);

  // Get sub-districts for a district
  const getSubDistricts = useCallback((districtId: number): SubDistrict[] => {
    if (!maps) return [];
    const list = maps.subDistrictsByDistrict.get(districtId) || [];
    return list.map(s => ({
      id: s.id,
      name: s.n,
      zipCode: s.z,
      districtId: s.d,
    })).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [maps]);

  // Lookup by zip code → returns matching provinces/districts/subdistricts
  const lookupByZipCode = useCallback((zipCode: string): ZipCodeResult[] => {
    if (!maps || !zipCode || zipCode.length < 5) return [];
    const zip = parseInt(zipCode, 10);
    if (isNaN(zip)) return [];

    const subDistricts = maps.subDistrictsByZip.get(zip) || [];
    if (subDistricts.length === 0) return [];

    // Group by district
    const grouped = new Map<number, CompactSubDistrict[]>();
    subDistricts.forEach(s => {
      const list = grouped.get(s.d) || [];
      list.push(s);
      grouped.set(s.d, list);
    });

    const results: ZipCodeResult[] = [];
    grouped.forEach((subs, districtId) => {
      const district = maps.districtMap.get(districtId);
      if (!district) return;
      const provinceName = maps.provinceMap.get(district.p);
      if (!provinceName) return;

      results.push({
        province: provinceName,
        district: district.n,
        subDistricts: subs.map(s => s.n),
        provinceId: district.p,
        districtId: districtId,
      });
    });

    return results;
  }, [maps]);

  // Find province ID by name
  const findProvinceId = useCallback((name: string): number | null => {
    if (!data) return null;
    const found = data.provinces.find(p => p.n === name);
    return found ? found.id : null;
  }, [data]);

  // Find district ID by name and province
  const findDistrictId = useCallback((name: string, provinceId: number): number | null => {
    if (!maps) return null;
    const list = maps.districtsByProvince.get(provinceId) || [];
    const found = list.find(d => d.n === name);
    return found ? found.id : null;
  }, [maps]);

  // Parse an existing address string into structured parts
  const parseAddress = useCallback((address: string): Partial<AddressSelection> => {
    if (!address || !data) return {};

    // Try to find zip code (5 digits)
    const zipMatch = address.match(/\b(\d{5})\b/);
    const result: Partial<AddressSelection> = {};

    if (zipMatch) {
      result.zipCode = zipMatch[1];
      const lookupResults = lookupByZipCode(zipMatch[1]);
      if (lookupResults.length > 0) {
        const first = lookupResults[0];
        result.province = first.province;
        result.district = first.district;
        if (first.subDistricts.length === 1) {
          result.subDistrict = first.subDistricts[0];
        } else {
          // Try to find sub-district in the address text
          for (const sd of first.subDistricts) {
            if (address.includes(sd)) {
              result.subDistrict = sd;
              break;
            }
          }
        }
      }
    }

    // Try to match province name
    if (!result.province) {
      for (const p of data.provinces) {
        if (address.includes(p.n)) {
          result.province = p.n;
          break;
        }
      }
    }

    return result;
  }, [data, lookupByZipCode]);

  // Compose address string from parts
  const composeAddress = useCallback((selection: AddressSelection): string => {
    const parts: string[] = [];
    if (selection.detail) parts.push(selection.detail.trim());
    if (selection.subDistrict) parts.push(`ต.${selection.subDistrict}`);
    if (selection.district) parts.push(`อ.${selection.district}`);
    if (selection.province) parts.push(`จ.${selection.province}`);
    if (selection.zipCode) parts.push(selection.zipCode);
    return parts.join(' ');
  }, []);

  return {
    loading,
    loadData,
    isLoaded: loadedRef.current,
    provinces,
    getDistricts,
    getSubDistricts,
    lookupByZipCode,
    findProvinceId,
    findDistrictId,
    parseAddress,
    composeAddress,
  };
}
