import React from 'react';
import { Point, Spot } from '../types';

interface ControlPanelProps {
  startPoint: Point | null;
  endPoint: Point | null;
  gachaSpots: Spot[];
  allGachaHistory: Spot[];
  isLoading: boolean;
  gachaElapsedTime: number;
  selectedCategory: Spot['category'];
  onCategoryChange: (category: Spot['category']) => void;
  onGachaRoll: () => void;
  onReset: () => void;
  openPopupFunction?: ((spotId: string) => void) | null;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  startPoint,
  endPoint,
  gachaSpots,
  allGachaHistory,
  isLoading,
  gachaElapsedTime,
  selectedCategory,
  onCategoryChange,
  onGachaRoll,
  onReset,
  openPopupFunction,
}) => {

  const canRollGacha = startPoint && endPoint && !isLoading;

  return (
    <div className="bg-white shadow-lg rounded-lg p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">🎲 寄り道ガチャ</h1>
        <p className="text-gray-600">地図をクリックして出発地と目的地を設定し、寄り道スポットをガチャで発見しよう！</p>
        
        {/* プログレス表示 */}
        <div className="mt-4 mb-2">
          <div className="flex items-center justify-center space-x-2 text-sm">
            <div className={`flex items-center space-x-1 px-2 py-1 rounded-full ${
              startPoint ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              <span>🚩</span>
              <span>出発地</span>
              {startPoint && <span className="text-green-600">✓</span>}
            </div>
            <div className="text-gray-400">→</div>
            <div className={`flex items-center space-x-1 px-2 py-1 rounded-full ${
              endPoint ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              <span>🏁</span>
              <span>目的地</span>
              {endPoint && <span className="text-green-600">✓</span>}
            </div>
            <div className="text-gray-400">→</div>
            <div className={`flex items-center space-x-1 px-2 py-1 rounded-full ${
              startPoint && endPoint ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              <span>🎲</span>
              <span>ガチャ</span>
            </div>
          </div>
        </div>
      </div>

      {/* 地点設定状況表示 */}
      <div className="space-y-3">
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">📍 出発地</span>
            {startPoint ? (
              <span className="text-sm text-green-600 font-medium">✓ 設定済み</span>
            ) : (
              <span className="text-sm text-gray-500">地図をクリック</span>
            )}
          </div>
          {startPoint && (
            <p className="text-xs text-gray-600 mt-1">
              {startPoint.lat.toFixed(4)}, {startPoint.lng.toFixed(4)}
            </p>
          )}
        </div>

        <div className="bg-orange-50 p-3 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">🏁 目的地</span>
            {endPoint ? (
              <span className="text-sm text-green-600 font-medium">✓ 設定済み</span>
            ) : (
              <span className="text-sm text-gray-500">地図をクリック</span>
            )}
          </div>
          {endPoint && (
            <p className="text-xs text-gray-600 mt-1">
              {endPoint.lat.toFixed(4)}, {endPoint.lng.toFixed(4)}
            </p>
          )}
        </div>
      </div>

      {/* カテゴリ選択 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          🎯 探すスポットのカテゴリ
        </label>
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value as Spot['category'])}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
        >
          <option value="restaurant">🍽️ 食事・レストラン (和食、洋食、中華など)</option>
          <option value="cafe">☕ カフェ (コーヒー、軽食、デザート)</option>
          <option value="tourist_attraction">🏛️ 観光地 (名所、博物館、公園)</option>
          <option value="shop">🛍️ ショップ (雑貨、衣類、書店など)</option>
          <option value="gas_station">⛽ ガソリンスタンド (給油、コンビニ)</option>
          <option value="all">🎯 すべて (全カテゴリから選択)</option>
        </select>
      </div>

      {/* ガチャボタン */}
      <div className="text-center">
        <button
          onClick={onGachaRoll}
          disabled={!canRollGacha}
          className={`px-8 py-3 rounded-lg font-bold text-lg transition-all transform ${
            canRollGacha
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 hover:scale-105 shadow-lg'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          } ${isLoading ? 'animate-pulse' : ''}`}
        >
          {isLoading ? (
            <span className="flex items-center space-x-2">
              <div className="relative">
                <div className="animate-spin text-2xl">🎲</div>
                <div className="absolute inset-0 animate-ping text-2xl opacity-75">🎲</div>
              </div>
              <span className="animate-bounce">ガチャ中... {gachaElapsedTime}秒 (予想:5-15秒)</span>
            </span>
          ) : (
            <span className="flex items-center justify-center space-x-1">
              <span className="animate-bounce">🎲</span>
              <span>ガチャを回す！</span>
            </span>
          )}
        </button>
      </div>

      {/* ガチャ結果 */}
      {gachaSpots.length > 0 && (
        <div className="border-t pt-4 animate-fadeIn">
          <h3 className="text-lg font-bold text-gray-800 mb-3 animate-bounce">🎉 ガチャ結果</h3>
          <div className="space-y-2">
            {gachaSpots.map((spot, index) => (
              <div 
                key={spot.id} 
                className="bg-gray-50 hover:bg-gray-100 rounded-lg p-3 cursor-pointer transition-all transform hover:scale-102 animate-slideInUp"
                style={{animationDelay: `${index * 0.2}s`}}
                onClick={() => openPopupFunction?.(spot.id)}
              >
                <div className="flex items-start space-x-3">
                  <span className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-800">{spot.name}</h4>
                      <div className="text-yellow-500">
                        {'★'.repeat(spot.stars || 1)}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">
                      {getCategoryEmoji(spot.category)} {getCategoryName(spot.category)}
                      {spot.isChain && <span className="ml-2 text-xs bg-orange-100 text-orange-600 px-1 rounded">チェーン</span>}
                    </p>
                    {spot.description && (
                      <p className="text-xs text-gray-500 mt-1">{spot.description}</p>
                    )}
                    <p className="text-xs text-blue-600 mt-1">📍 クリックして地図で詳細表示</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ガチャ履歴 */}
      {allGachaHistory.length > 0 && (
        <div className="border-t pt-4">
          <h3 className="text-lg font-bold text-gray-800 mb-3">📜 これまでの発見スポット</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {allGachaHistory.map((spot, index) => (
              <div 
                key={`${spot.id}-${index}`} 
                className="bg-gray-50 hover:bg-gray-100 rounded-lg p-2 cursor-pointer transition-colors"
                onClick={() => openPopupFunction?.(spot.id)}
              >
                <div className="flex items-start space-x-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-800 text-sm">{spot.name}</h4>
                      <div className="text-yellow-500 text-xs">
                        {'★'.repeat(spot.stars || 1)}
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">
                      {getCategoryEmoji(spot.category)} {getCategoryName(spot.category)}
                      {spot.isChain && <span className="ml-1 text-xs bg-orange-100 text-orange-600 px-1 rounded">チェーン</span>}
                    </p>
                    {spot.debugInfo && (
                      <p className="text-xs text-gray-500 mt-1 font-mono">
                        {spot.debugInfo}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* リセットボタン */}
      {(startPoint || endPoint || gachaSpots.length > 0) && (
        <div className="text-center border-t pt-4">
          <button
            onClick={onReset}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 underline"
          >
            リセット
          </button>
        </div>
      )}

      {/* 使い方ヒント */}
      <div className="text-xs text-gray-500 border-t pt-4">
        <p><strong>💡 使い方:</strong></p>
        <ul className="list-disc list-inside space-y-1 mt-1">
          <li>地図をクリックして出発地と目的地を設定してください</li>
          <li>ガチャでは最大3つの寄り道スポットが表示されます</li>
          <li>スポットマーカーをクリックすると詳細情報が表示されます</li>
        </ul>
        <p className="mt-3"><strong>⭐ 評価について:</strong></p>
        <ul className="list-disc list-inside space-y-1 mt-1">
          <li><strong>★★★</strong>: 個人店で情報充実、目的地近く</li>
          <li><strong>★★</strong>: 一般的なスポット（大半がこの評価）</li>
          <li><strong>★</strong>: 有名チェーン店、出発地近く</li>
        </ul>
      </div>
    </div>
  );
};

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