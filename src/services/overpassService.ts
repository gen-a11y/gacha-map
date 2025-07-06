import { OverpassResponse, OverpassElement, Spot, Point } from '../types';

// Overpass APIでスポットを検索
export class OverpassService {
  private static readonly API_URL = 'https://overpass-api.de/api/interpreter';

  // 2点間の中間地点周辺でスポットを検索
  static async searchSpots(startPoint: Point, endPoint: Point, radius: number = 5000, category: Spot['category'] = 'restaurant'): Promise<Spot[]> {
    try {
      // 中間地点を計算
      const midPoint = this.calculateMidPoint(startPoint, endPoint);
      
      // 検索範囲を計算（緯度経度の範囲）
      const bbox = this.calculateBoundingBox(midPoint, radius);
      
      // Overpass QLクエリを構築
      const query = this.buildOverpassQuery(bbox, category);
      
      // APIリクエスト実行
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: query,
      });

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status}`);
      }

      const data: OverpassResponse = await response.json();
      
      // レスポンスをSpot型に変換
      return this.convertToSpots(data.elements);
    } catch (error) {
      console.error('Error fetching spots:', error);
      throw error;
    }
  }

  // 中間地点を計算
  private static calculateMidPoint(start: Point, end: Point): Point {
    return {
      lat: (start.lat + end.lat) / 2,
      lng: (start.lng + end.lng) / 2,
    };
  }

  // 複数の中間地点を計算（ガチャで使用）
  static calculateMultipleMidPoints(start: Point, end: Point, count: number = 3): Point[] {
    const points: Point[] = [];
    
    for (let i = 1; i <= count; i++) {
      const ratio = i / (count + 1);
      points.push({
        lat: start.lat + (end.lat - start.lat) * ratio,
        lng: start.lng + (end.lng - start.lng) * ratio,
      });
    }
    
    return points;
  }

  // ルート沿いの中間地点を計算
  static calculateNearDestinationPoints(start: Point, end: Point, count: number = 3): Point[] {
    const points: Point[] = [];
    
    // ルート全体に完全に均等分散（偏り完全除去）
    for (let i = 0; i < count; i++) {
      const ratio = (i + 1) / (count + 1); // 0.25, 0.5, 0.75で均等
      points.push({
        lat: start.lat + (end.lat - start.lat) * ratio,
        lng: start.lng + (end.lng - start.lng) * ratio,
      });
    }
    
    console.log(`検索地点: ${points.map((_, i) => `地点${i+1}(${(((i+1)/(count+1))*100).toFixed(0)}%)`).join(', ')}`);
    return points;
  }

  // 境界ボックスを計算（緯度経度の概算）
  private static calculateBoundingBox(center: Point, radiusMeters: number) {
    // 1度あたりの距離（概算）
    const latDegreeInMeters = 111000; // 約111km
    const lngDegreeInMeters = latDegreeInMeters * Math.cos((center.lat * Math.PI) / 180);
    
    const latDelta = radiusMeters / latDegreeInMeters;
    const lngDelta = radiusMeters / lngDegreeInMeters;
    
    return {
      south: center.lat - latDelta,
      west: center.lng - lngDelta,
      north: center.lat + latDelta,
      east: center.lng + lngDelta,
    };
  }

  // Overpass QLクエリを構築
  private static buildOverpassQuery(bbox: { south: number; west: number; north: number; east: number }, category: Spot['category'] = 'restaurant'): string {
    const { south, west, north, east } = bbox;
    
    let queries: string[] = [];
    
    switch (category) {
      case 'restaurant':
        queries = [
          `node["amenity"="restaurant"](${south},${west},${north},${east});`,
          `node["amenity"="fast_food"](${south},${west},${north},${east});`
        ];
        break;
      case 'cafe':
        queries = [
          `node["amenity"="cafe"](${south},${west},${north},${east});`
        ];
        break;
      case 'tourist_attraction':
        queries = [
          `node["tourism"="attraction"](${south},${west},${north},${east});`,
          `node["tourism"="museum"](${south},${west},${north},${east});`
        ];
        break;
      case 'gas_station':
        queries = [
          `node["amenity"="fuel"](${south},${west},${north},${east});`
        ];
        break;
      case 'shop':
        queries = [
          `node["shop"](${south},${west},${north},${east});`
        ];
        break;
      case 'all':
      default:
        queries = [
          `node["amenity"="restaurant"](${south},${west},${north},${east});`,
          `node["amenity"="cafe"](${south},${west},${north},${east});`,
          `node["amenity"="fast_food"](${south},${west},${north},${east});`,
          `node["tourism"="attraction"](${south},${west},${north},${east});`,
          `node["tourism"="museum"](${south},${west},${north},${east});`,
          `node["amenity"="fuel"](${south},${west},${north},${east});`,
          `node["shop"](${south},${west},${north},${east});`
        ];
        break;
    }
    
    return `
      [out:json][timeout:25];
      (
        ${queries.join('\n        ')}
      );
      out geom;
    `;
  }

  // Overpass要素をSpot型に変換
  private static convertToSpots(elements: OverpassElement[]): Spot[] {
    return elements
      .filter(element => element.tags.name) // 名前があるもののみ
      .map(element => {
        const chainInfo = this.detectChain(element.tags);
        return {
          id: `${element.type}_${element.id}`,
          name: element.tags.name || 'Unknown',
          lat: element.lat,
          lng: element.lon,
          type: element.tags.amenity || element.tags.tourism || element.tags.shop || 'other',
          category: this.determineCategory(element.tags),
          description: this.generateDescription(element.tags),
          address: this.extractAddress(element.tags),
          phone: element.tags.phone,
          website: element.tags.website,
          openingHours: element.tags['opening_hours'],
          cuisine: element.tags.cuisine,
          isChain: chainInfo.isChain,
          chainName: chainInfo.chainName,
          isMajorChain: chainInfo.isMajorChain,
        };
      });
  }

  // カテゴリを決定
  private static determineCategory(tags: Record<string, string | undefined>): Spot['category'] {
    if (tags.amenity === 'restaurant' || tags.amenity === 'fast_food') return 'restaurant';
    if (tags.amenity === 'cafe') return 'cafe';
    if (tags.tourism === 'attraction' || tags.tourism === 'museum') return 'tourist_attraction';
    if (tags.amenity === 'fuel') return 'gas_station';
    if (tags.shop) return 'shop';
    return 'restaurant'; // デフォルト
  }

  // 説明文を生成
  private static generateDescription(tags: Record<string, string | undefined>): string {
    const parts: string[] = [];
    
    if (tags.amenity) parts.push(tags.amenity);
    if (tags.tourism) parts.push(tags.tourism);
    if (tags.cuisine) parts.push(`料理: ${tags.cuisine}`);
    if (tags.shop) parts.push(`店舗: ${tags.shop}`);
    
    return parts.join(' | ');
  }

  // 住所情報を抽出
  private static extractAddress(tags: Record<string, string | undefined>): string {
    const addressParts: string[] = [];
    
    if (tags['addr:full']) {
      return tags['addr:full'];
    }
    
    if (tags['addr:housenumber']) addressParts.push(tags['addr:housenumber']);
    if (tags['addr:street']) addressParts.push(tags['addr:street']);
    if (tags['addr:city']) addressParts.push(tags['addr:city']);
    
    return addressParts.join(' ') || '';
  }

  // 2点間の距離を計算（Haversine公式）
  static calculateDistance(point1: Point, point2: Point): number {
    const R = 6371; // 地球の半径（km）
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // 距離をkmで返す
  }

  // 距離に応じた適切な検索半径を計算
  static calculateSearchRadius(startPoint: Point, endPoint: Point): number {
    const distance = this.calculateDistance(startPoint, endPoint);
    
    // 距離に応じて検索半径を動的に調整（大幅に広範囲に）
    if (distance <= 1) {
      // 1km以下：非常に近い距離 - 1500m半径（800m→1500m）
      return 1500;
    } else if (distance <= 3) {
      // 1-3km：近い距離 - 2000m半径（1200m→2000m）
      return 2000;
    } else if (distance <= 10) {
      // 3-10km：中距離 - 3000m半径（1800m→3000m）
      return 3000;
    } else if (distance <= 20) {
      // 10-20km：やや長距離 - 5km半径（3km→5km）
      return 5000;
    } else {
      // 20km以上：長距離 - 7km半径（4km→7km）
      return 7000;
    }
  }

  // チェーン店判定
  private static detectChain(tags: Record<string, string | undefined>): {isChain: boolean, chainName?: string, isMajorChain?: boolean} {
    // OSMのbrand/operatorタグチェック
    if (tags.brand) return {isChain: true, chainName: tags.brand, isMajorChain: this.isMajorChain(tags.brand)};
    if (tags.operator) return {isChain: true, chainName: tags.operator, isMajorChain: this.isMajorChain(tags.operator)};
    
    // 店名パターンマッチング
    const name = tags.name || '';
    const commonChains = [
      'マクドナルド', 'McDonald', 'スターバックス', 'Starbucks',
      'セブン-イレブン', '7-Eleven', 'ファミリーマート', 'FamilyMart',
      'ローソン', 'Lawson', 'すき家', '松屋', 'ガスト', 'Gusto',
      'サイゼリヤ', 'ドトール', 'Doutor', 'タリーズ', "Tully's",
      'ケンタッキー', 'KFC', 'バーガーキング', 'Burger King',
      'モスバーガー', 'MOS BURGER', 'ココス', 'COCO\'S',
      'ジョナサン', 'デニーズ', "Denny's", 'びっくりドンキー',
      'はなまるうどん', '丸亀製麺', 'やよい軒', '大戸屋'
    ];
    
    for (const chain of commonChains) {
      if (name.includes(chain)) {
        return {isChain: true, chainName: chain, isMajorChain: this.isMajorChain(chain)};
      }
    }
    
    return {isChain: false, isMajorChain: false};
  }

  // 有名なチェーン店かどうか判定
  private static isMajorChain(chainName: string): boolean {
    const majorChains = [
      'マクドナルド', 'McDonald', '松屋', 'すき家', 'ガスト', 'Gusto',
      'サイゼリヤ', 'ケンタッキー', 'KFC', 'バーガーキング', 'Burger King',
      'セブン-イレブン', '7-Eleven', 'ファミリーマート', 'FamilyMart',
      'ローソン', 'Lawson', 'ココス', 'COCO\'S', 'ジョナサン',
      'デニーズ', "Denny's", 'びっくりドンキー', 'はなまるうどん', '丸亀製麺'
    ];
    
    return majorChains.some(major => chainName.includes(major));
  }

  // ルートからの距離を計算
  private static calculateDistanceFromRoute(spot: Point, startPoint: Point, endPoint: Point): number {
    // 最短距離を計算（点と直線の距離）
    const A = endPoint.lat - startPoint.lat;
    const B = startPoint.lng - endPoint.lng;
    const C = endPoint.lng * startPoint.lat - startPoint.lng * endPoint.lat;
    
    const distance = Math.abs(A * spot.lng + B * spot.lat + C) / Math.sqrt(A * A + B * B);
    
    // 度数を距離（km）に変換
    return distance * 111; // 約111km/度
  }

  // 逆走判定（経路から逆方向に離れているか）
  private static isBackward(spot: Point, startPoint: Point, endPoint: Point): boolean {
    // 出発地→目的地のベクトル
    const routeVector = {
      lat: endPoint.lat - startPoint.lat,
      lng: endPoint.lng - startPoint.lng
    };
    
    // 出発地→スポットのベクトル
    const spotVector = {
      lat: spot.lat - startPoint.lat,
      lng: spot.lng - startPoint.lng
    };
    
    // 内積を計算
    const dotProduct = routeVector.lat * spotVector.lat + routeVector.lng * spotVector.lng;
    
    // ルートベクトルの長さの二乗
    const routeLengthSq = routeVector.lat * routeVector.lat + routeVector.lng * routeVector.lng;
    
    // より厳しい逆走判定：内積が負かつ、スポットが出発地の後方にある場合のみ
    if (dotProduct < 0) {
      // スポットまでの距離がルート長の20%以上後方にある場合のみ逆走と判定
      const spotLengthSq = spotVector.lat * spotVector.lat + spotVector.lng * spotVector.lng;
      const backwardThreshold = routeLengthSq * 0.04; // 20%の二乗 = 4%
      return spotLengthSq > backwardThreshold;
    }
    
    // 目的地からの逆走判定も同様に厳しく
    const endToSpotVector = {
      lat: spot.lat - endPoint.lat,
      lng: spot.lng - endPoint.lng
    };
    
    const endBackwardDot = routeVector.lat * endToSpotVector.lat + routeVector.lng * endToSpotVector.lng;
    if (endBackwardDot > 0) {
      const endSpotLengthSq = endToSpotVector.lat * endToSpotVector.lat + endToSpotVector.lng * endToSpotVector.lng;
      const endBackwardThreshold = routeLengthSq * 0.04; // 20%の二乗 = 4%
      return endSpotLengthSq > endBackwardThreshold;
    }
    
    return false;
  }

  // スポットの評価を計算
  private static calculateSpotRating(spot: Spot, startPoint: Point, endPoint: Point): {stars: 1 | 2 | 3, debugInfo: string} {
    let score = 100; // 基本スコア
    let debugInfo = `基本100点`;
    let penaltyCount = 0; // 減点要素のカウント
    
    // 有名チェーン店は★1固定
    if (spot.isMajorChain) {
      const result = `有名チェーン店 → ★1`;
      return {stars: 1, debugInfo: result};
    }
    
    // 逆走判定
    const isBackward = this.isBackward(spot, startPoint, endPoint);
    if (isBackward) {
      score -= 40; // 50→40点（-10点）
      penaltyCount++;
      debugInfo += `, 経路逆走-40点`;
    }
    
    // ルートからの距離で評価（離れすぎの場合）
    const distanceFromRoute = spot.distanceFromRoute || 0;
    if (distanceFromRoute > 2.5) {
      score -= 30; // 1.5→2.5kmにさらに緩和
      penaltyCount++;
      debugInfo += `, ルート遠い(${distanceFromRoute.toFixed(2)}km)-30点`;
    } else if (distanceFromRoute > 1.8) {
      score -= 20; // 1.0→1.8kmにさらに緩和
      penaltyCount++;
      debugInfo += `, ルートやや遠い-20点`;
    }
    
    // 一般チェーン店の評価
    if (spot.isChain) {
      score -= 20; // 30→20点（-10点）
      penaltyCount++;
      debugInfo += `, 一般チェーン店-20点`;
    }
    
    // 出発地に近すぎる場合の減点
    const distanceFromStart = this.calculateDistance(spot, startPoint);
    if (distanceFromStart <= 0.3) {
      score -= 25; // 35→25点（-10点）
      penaltyCount++;
      debugInfo += `, 出発地近すぎ(${distanceFromStart.toFixed(2)}km)-25点`;
    }
    
    // 目的地近くでは減点しない（要求により削除）
    
    // 情報の充実度を評価
    if (!spot.openingHours) {
      score -= 10; // 20→10点（-10点）
      penaltyCount++;
      debugInfo += `, 営業時間なし-10点`;
    }
    if (!spot.phone) {
      score -= 10; // 20→10点（-10点）
      penaltyCount++;
      debugInfo += `, 電話なし-10点`;
    }
    if (!spot.website) {
      score -= 10; // 20→10点（-10点）
      penaltyCount++;
      debugInfo += `, サイトなし-10点`;
    }
    
    // 減点要素の数は無視（要求により削除）
    
    // 最終評価
    let stars: 1 | 2 | 3;
    if (score >= 70) {
      stars = 3;
    } else if (score >= 30) {
      stars = 2;
    } else {
      stars = 1;
    }
    
    const finalDebugInfo = `${debugInfo} = ${score.toFixed(1)}点 → ★${stars}`;
    return {stars, debugInfo: finalDebugInfo};
  }

  // スポットに評価を追加
  static addRatingsToSpots(spots: Spot[], startPoint: Point, endPoint: Point): Spot[] {
    return spots.map(spot => {
      const distanceFromRoute = this.calculateDistanceFromRoute(spot, startPoint, endPoint);
      const updatedSpot = {
        ...spot,
        distanceFromRoute
      };
      
      const rating = this.calculateSpotRating(updatedSpot, startPoint, endPoint);
      
      return {
        ...updatedSpot,
        stars: rating.stars,
        debugInfo: rating.debugInfo
      };
    });
  }

  // 中間地点からランダム選択
  static selectRandomMidPoints(midPoints: Point[], count: number = 3): Point[] {
    if (midPoints.length <= count) return midPoints;
    
    // Fisher-Yates シャッフルでランダム選択
    const shuffled = [...midPoints];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    const selected = shuffled.slice(0, count);
    console.log(`5地点から${count}地点をランダム選択: ${selected.map((_, i) => `地点${i+1}`).join(', ')}`);
    return selected;
  }

  // 評価を使わずにランダムでスポットを選択
  static selectRandomSpotsWithoutRating(spots: Spot[], count: number = 3): Spot[] {
    if (spots.length <= count) return spots;
    
    // Fisher-Yates シャッフルで完全ランダム選択
    const shuffled = [...spots];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    const selected = shuffled.slice(0, count);
    console.log(`${spots.length}スポットから${count}スポットをランダム選択`);
    return selected;
  }

  // 評価順でスポットを選択（旧版、使用しない）
  static selectRandomSpots(spots: Spot[], count: number = 3): Spot[] {
    if (spots.length <= count) return spots;
    
    // 評価の高い順にソート（同じ評価内ではランダム）
    const sortedSpots = spots.sort((a, b) => {
      if (a.stars !== b.stars) {
        return (b.stars || 1) - (a.stars || 1); // 星の多い順
      }
      return Math.random() - 0.5; // 同じ星数内ではランダム
    });
    
    return sortedSpots.slice(0, count);
  }
}