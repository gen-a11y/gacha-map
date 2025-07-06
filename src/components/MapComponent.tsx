import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Point, Spot } from '../types';

// カテゴリ絵文字
function getCategoryEmoji(category: Spot['category']): string {
  switch (category) {
    case 'restaurant': return '🍽️';
    case 'cafe': return '☕';
    case 'tourist_attraction': return '🏛️';
    case 'gas_station': return '⛽';
    case 'shop': return '🛍️';
    default: return '📍';
  }
}

// カテゴリ名
function getCategoryName(category: Spot['category']): string {
  switch (category) {
    case 'restaurant': return 'レストラン';
    case 'cafe': return 'カフェ';
    case 'tourist_attraction': return '観光地';
    case 'gas_station': return 'ガソリンスタンド';
    case 'shop': return 'ショップ';
    case 'all': return 'すべて';
    default: return 'その他';
  }
}

// Leafletアイコンの修正
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapComponentProps {
  startPoint: Point | null;
  endPoint: Point | null;
  gachaSpots: Spot[];
  onMapClick: (lat: number, lng: number) => void;
  onSpotClick?: (openPopupFn: (spotId: string) => void) => void;
  className?: string;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  startPoint,
  endPoint,
  gachaSpots,
  onMapClick,
  onSpotClick,
  className = '',
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const userViewRef = useRef<{center: L.LatLng, zoom: number} | null>(null);
  const spotMarkersRef = useRef<Map<string, L.Marker>>(new Map());

  // マップ初期化
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // 地図を初期化（新宿-渋谷エリアをフォーカス）
    const map = L.map(mapRef.current).setView([35.6738, 139.6967], 13);

    // OpenStreetMapタイル追加
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    // マップクリックイベント
    map.on('click', (e) => {
      // クリック前にユーザーの現在の表示状態を保存
      userViewRef.current = {
        center: map.getCenter(),
        zoom: map.getZoom()
      };
      onMapClick(e.latlng.lat, e.latlng.lng);
    });

    // マップの移動・ズーム時にユーザーの表示状態を更新
    map.on('moveend zoomend', () => {
      userViewRef.current = {
        center: map.getCenter(),
        zoom: map.getZoom()
      };
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [onMapClick]);

  // マーカーとルートを更新
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // 既存のマーカーとルートを効率的に削除
    if (markersRef.current.length > 0) {
      markersRef.current.forEach(marker => map.removeLayer(marker));
      markersRef.current = [];
    }
    
    // スポットマーカーのMapもクリア
    spotMarkersRef.current.clear();
    
    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }

    // 出発地マーカー
    if (startPoint) {
      const startMarker = L.marker([startPoint.lat, startPoint.lng])
        .addTo(map)
        .bindPopup(`出発地: ${startPoint.name || '選択した地点'}`);
      markersRef.current.push(startMarker);
    }

    // 目的地マーカー
    if (endPoint) {
      const endMarker = L.marker([endPoint.lat, endPoint.lng])
        .addTo(map)
        .bindPopup(`目的地: ${endPoint.name || '選択した地点'}`);
      markersRef.current.push(endMarker);
    }

    // 直線ルート描画
    if (startPoint && endPoint) {
      const routeLine = L.polyline(
        [[startPoint.lat, startPoint.lng], [endPoint.lat, endPoint.lng]],
        { color: 'blue', weight: 3, opacity: 0.7 }
      ).addTo(map);
      routeLineRef.current = routeLine;

      // 自動的な地図調整を無効化 - ユーザーの表示位置を保持
    }

    // ガチャスポットマーカー
    gachaSpots.forEach((spot, index) => {
      const icon = L.divIcon({
        html: `<div class="bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg">${index + 1}</div>`,
        className: 'custom-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const spotMarker = L.marker([spot.lat, spot.lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div class="p-4 min-w-64 max-w-80">
            <div class="mb-3">
              <div class="flex items-center justify-between mb-1">
                <h3 class="font-bold text-lg text-gray-800">${spot.name}</h3>
                <div class="text-yellow-500">
                  ${'★'.repeat(spot.stars || 1)}
                </div>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xl">${getCategoryEmoji(spot.category)}</span>
                <span class="text-sm text-gray-600 font-medium">${getCategoryName(spot.category)}</span>
                ${spot.isChain ? `<span class="ml-2 text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded">チェーン</span>` : ''}
              </div>
            </div>
            
            ${spot.cuisine ? `
              <div class="mb-2">
                <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                  🍽️ ${spot.cuisine}
                </span>
              </div>
            ` : ''}
            
            ${spot.address ? `
              <div class="mb-2 flex items-start gap-2">
                <span class="text-gray-500 mt-0.5">📍</span>
                <span class="text-sm text-gray-700">${spot.address}</span>
              </div>
            ` : ''}
            
            ${spot.phone ? `
              <div class="mb-2 flex items-center gap-2">
                <span class="text-gray-500">📞</span>
                <a href="tel:${spot.phone}" class="text-sm text-blue-600 hover:text-blue-800">${spot.phone}</a>
              </div>
            ` : ''}
            
            ${spot.website ? `
              <div class="mb-2 flex items-center gap-2">
                <span class="text-gray-500">🌐</span>
                <a href="${spot.website}" target="_blank" rel="noopener noreferrer" class="text-sm text-blue-600 hover:text-blue-800 underline">ウェブサイト</a>
              </div>
            ` : ''}
            
            ${spot.openingHours ? `
              <div class="mb-2 flex items-start gap-2">
                <span class="text-gray-500 mt-0.5">🕒</span>
                <span class="text-sm text-gray-700">${spot.openingHours}</span>
              </div>
            ` : ''}
            
            ${spot.description ? `
              <div class="mt-3 pt-3 border-t border-gray-200">
                <p class="text-xs text-gray-500">${spot.description}</p>
              </div>
            ` : ''}
            
            <div class="mt-3 pt-3 border-t border-gray-200">
              <a href="https://www.google.com/search?q=${encodeURIComponent(spot.name + ' ' + getCategoryName(spot.category))}" target="_blank" rel="noopener noreferrer" 
                 class="inline-flex items-center justify-center w-full px-4 py-3 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors shadow-xl border-2 border-orange-700">
                🔍 Googleで検索
              </a>
            </div>
          </div>
        `, {
          maxWidth: 320,
          className: 'custom-popup'
        });
      
      // スポットマーカーを記録
      spotMarkersRef.current.set(spot.id, spotMarker);
      markersRef.current.push(spotMarker);
    });

    // マーカー追加後にユーザーの表示状態を復元
    if (userViewRef.current && (startPoint || endPoint)) {
      // 出発地または目的地設定後、ユーザーの表示状態を復元
      const { center, zoom } = userViewRef.current;
      map.setView(center, zoom);
    }

  }, [startPoint, endPoint, gachaSpots]);

  // 外部からスポットポップアップを開く関数を公開
  React.useEffect(() => {
    const openSpotPopup = (spotId: string) => {
      const marker = spotMarkersRef.current.get(spotId);
      if (marker && mapInstanceRef.current) {
        marker.openPopup();
        // マーカーの位置を中央下部にフォーカス（ポップアップが見切れないように）
        const markerLatLng = marker.getLatLng();
        const map = mapInstanceRef.current;
        const currentZoom = map.getZoom();
        
        // 画面の高さの1/4下にオフセット（中央下部に配置）
        const containerSize = map.getSize();
        const offsetY = containerSize.y * 0.25; // 画面高さの25%下にオフセット
        const targetPoint = map.latLngToContainerPoint(markerLatLng);
        targetPoint.y -= offsetY;
        const targetLatLng = map.containerPointToLatLng(targetPoint);
        
        map.setView(targetLatLng, currentZoom);
      }
    };
    
    if (onSpotClick) {
      onSpotClick(openSpotPopup as any);
    }
  }, [onSpotClick, gachaSpots]);

  return (
    <div 
      ref={mapRef} 
      className={`w-full h-full ${className}`}
      style={{ minHeight: '400px' }}
    />
  );
};