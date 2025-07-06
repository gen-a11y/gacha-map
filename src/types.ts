// 地点の型定義
export interface Point {
  lat: number;
  lng: number;
  name?: string;
}

// スポットの型定義
export interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  category: 'restaurant' | 'tourist_attraction' | 'gas_station' | 'shop' | 'cafe' | 'all';
  description?: string;
  address?: string;
  phone?: string;
  website?: string;
  openingHours?: string;
  cuisine?: string;
  rating?: number;
  isChain?: boolean;
  chainName?: string;
  isMajorChain?: boolean;
  stars?: 1 | 2 | 3;
  distanceFromRoute?: number;
  debugInfo?: string;
}

// Overpass APIレスポンスの型定義
export interface OverpassElement {
  type: string;
  id: number;
  lat: number;
  lon: number;
  tags: {
    name?: string;
    amenity?: string;
    tourism?: string;
    shop?: string;
    cuisine?: string;
    'addr:full'?: string;
    'addr:street'?: string;
    'addr:housenumber'?: string;
    'addr:city'?: string;
    phone?: string;
    website?: string;
    'opening_hours'?: string;
    [key: string]: string | undefined;
  };
}

export interface OverpassResponse {
  version: number;
  generator: string;
  elements: OverpassElement[];
}