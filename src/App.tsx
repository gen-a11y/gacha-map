import React, { useState, useCallback } from 'react';
import { MapComponent } from './components/MapComponent';
import { ControlPanel } from './components/ControlPanel';
import { OverpassService } from './services/overpassService';
import { Point, Spot } from './types';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  const [startPoint, setStartPoint] = useState<Point | null>({
    lat: 35.6896, lng: 139.6917, name: "新宿駅"
  });
  const [endPoint, setEndPoint] = useState<Point | null>({
    lat: 35.6580, lng: 139.7016, name: "渋谷駅"
  });
  const [gachaSpots, setGachaSpots] = useState<Spot[]>([]);
  const [allGachaHistory, setAllGachaHistory] = useState<Spot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Spot['category']>('restaurant');
  const [openPopupFunction, setOpenPopupFunction] = useState<((spotId: string) => void) | null>(null);
  const [hasShownInitialMessage, setHasShownInitialMessage] = useState(false);
  const [gachaStartTime, setGachaStartTime] = useState<number | null>(null);
  const [gachaElapsedTime, setGachaElapsedTime] = useState(0);

  // 初期メッセージを表示
  React.useEffect(() => {
    if (!hasShownInitialMessage) {
      toast.success('新宿→渋谷ルートが設定されています。ガチャボタンを押してスポットを発見しましょう！');
      setHasShownInitialMessage(true);
    }
  }, [hasShownInitialMessage]);

  // ガチャ進捗タイマー
  React.useEffect(() => {
    let interval: number;
    
    if (isLoading && gachaStartTime) {
      interval = setInterval(() => {
        setGachaElapsedTime(Math.floor((Date.now() - gachaStartTime) / 1000));
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading, gachaStartTime]);

  // ガチャを実行
  const handleGachaRoll = useCallback(async () => {
    if (!startPoint || !endPoint) return;

    setIsLoading(true);
    setGachaSpots([]); // 現在のガチャ結果をクリア
    setGachaStartTime(Date.now());
    setGachaElapsedTime(0);

    try {
      // 出発地と目的地の距離に応じた検索半径を計算
      const distance = OverpassService.calculateDistance(startPoint, endPoint);
      const searchRadius = OverpassService.calculateSearchRadius(startPoint, endPoint);
      
      console.log(`出発地-目的地間距離: ${distance.toFixed(2)}km, 検索半径: ${searchRadius}m`);
      
      // ルート沿いの中間地点を計算（5ポイント生成）
      const allMidPoints = OverpassService.calculateNearDestinationPoints(startPoint, endPoint, 5);
      
      // 5つの中間地点からランダムに3つ選択
      const selectedMidPoints = OverpassService.selectRandomMidPoints(allMidPoints, 3);
      
      // 選択された3地点周辺のスポットを検索
      const allSpots: Spot[] = [];
      
      for (const midPoint of selectedMidPoints) {
        try {
          const spots = await OverpassService.searchSpots(midPoint, midPoint, searchRadius, selectedCategory);
          allSpots.push(...spots);
        } catch (error) {
          console.warn('Error fetching spots for midpoint:', error);
          // 一部のAPIエラーは無視して続行
        }
      }

      // 重複を除去（同じIDのスポットを削除）
      const uniqueSpots = allSpots.filter((spot, index, self) => 
        index === self.findIndex(s => s.id === spot.id)
      );

      // スポットに評価を追加（表示用）
      const ratedSpots = OverpassService.addRatingsToSpots(uniqueSpots, startPoint, endPoint);

      // 評価を使わずにランダムで3つ選択
      const selectedSpots = OverpassService.selectRandomSpotsWithoutRating(ratedSpots, 3);
      
      if (selectedSpots.length === 0) {
        toast.warning('この経路周辺にはスポットが見つかりませんでした。別の地点を試してみてください。');
      } else {
        setGachaSpots(selectedSpots);
        // 履歴にも追加（重複チェック）
        setAllGachaHistory(prev => {
          const newSpots = selectedSpots.filter(spot => 
            !prev.some(existingSpot => existingSpot.id === spot.id)
          );
          return [...prev, ...newSpots];
        });
      }
      
    } catch (error) {
      console.error('Gacha roll error:', error);
      toast.error('スポットの検索中にエラーが発生しました。しばらく待ってから再試行してください。');
    } finally {
      setIsLoading(false);
      setGachaStartTime(null);
      setGachaElapsedTime(0);
    }
  }, [startPoint, endPoint, selectedCategory]);

  // 地図クリックハンドラー
  const handleMapClick = useCallback((lat: number, lng: number) => {
    const point: Point = { lat, lng, name: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
    
    if (!startPoint) {
      setStartPoint(point);
      toast.info('📍 出発地を設定しました。次に目的地をクリックしてください。');
    } else if (!endPoint) {
      setEndPoint(point);
      toast.success('🏁 目的地を設定しました。ガチャボタンを押してスポットを発見しましょう！');
    } else {
      // 両方設定済みの場合は何もしない（リセットボタンを使用してもらう）
      toast.warning('⚠️ 出発地と目的地が設定済みです。変更するにはリセットボタンを押してください。');
    }
  }, [startPoint, endPoint]);

  // リセット
  const handleReset = useCallback(() => {
    setStartPoint(null);
    setEndPoint(null);
    setGachaSpots([]);
    setAllGachaHistory([]);
    
    // リセット後のガイダンスメッセージ
    setTimeout(() => {
      toast.info('🚩 地図をクリックして出発地を設定してください。');
    }, 100);
  }, []);

  return (
    <div className="h-screen flex flex-col lg:flex-row bg-gray-100">
      {/* スマホ用コンパクトコントロール */}
      <div className="lg:hidden bg-white shadow-md p-3">
        <div className="text-center mb-2">
          <h1 className="text-xl font-bold text-gray-800">寄り道ガチャ</h1>
        </div>
        
        {/* カテゴリ選択 */}
        <div className="mb-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as Spot['category'])}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="restaurant">🍽️ 食事・レストラン</option>
            <option value="cafe">☕ カフェ</option>
            <option value="tourist_attraction">🏛️ 観光地</option>
            <option value="shop">🛍️ ショップ</option>
            <option value="gas_station">⛽ ガソリンスタンド</option>
            <option value="all">🎯 すべて</option>
          </select>
        </div>

        {/* ガチャボタン */}
        <div className="flex space-x-2">
          <button
            onClick={handleGachaRoll}
            disabled={!startPoint || !endPoint || isLoading}
            className={`flex-1 px-4 py-2 rounded-md font-medium text-sm transition-all ${
              startPoint && endPoint && !isLoading
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            } ${isLoading ? 'animate-pulse' : ''}`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center space-x-1">
                <span className="animate-spin text-lg">🎲</span>
                <span>ガチャ中... {gachaElapsedTime}秒 (予想:5-15秒)</span>
              </span>
            ) : (
              <span className="flex items-center justify-center space-x-1">
                <span className="animate-bounce">🎲</span>
                <span>ガチャ！</span>
              </span>
            )}
          </button>
          {(startPoint || endPoint) && (
            <button
              onClick={handleReset}
              className="px-3 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md text-sm"
            >
              リセット
            </button>
          )}
        </div>
      </div>

      {/* デスクトップ用フルコントロールパネル */}
      <div className="hidden lg:block lg:w-1/3 lg:max-w-md p-4 overflow-y-auto">
        <ControlPanel
          startPoint={startPoint}
          endPoint={endPoint}
          gachaSpots={gachaSpots}
          allGachaHistory={allGachaHistory}
          isLoading={isLoading}
          gachaElapsedTime={gachaElapsedTime}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          onGachaRoll={handleGachaRoll}
          onReset={handleReset}
          openPopupFunction={openPopupFunction}
        />
      </div>

      {/* 地図エリア */}
      <div className="flex-1 p-2 lg:p-4">
        <div className="h-full bg-white rounded-lg shadow-lg overflow-hidden">
          <MapComponent
            startPoint={startPoint}
            endPoint={endPoint}
            gachaSpots={gachaSpots}
            onMapClick={handleMapClick}
            onSpotClick={(openPopupFn) => {
              // ControlPanelにポップアップ関数を渡す
              setOpenPopupFunction(() => openPopupFn);
            }}
            className="h-full"
          />
        </div>
      </div>

      {/* スマホ用スポット一覧 - メインコンテナの外に移動 */}
      {gachaSpots.length > 0 && (
        <div className="lg:hidden bg-white border-t border-gray-200 p-3 max-h-40 overflow-y-auto">
          <h3 className="text-sm font-bold text-gray-800 mb-2">🎉 発見したスポット ({gachaSpots.length}件)</h3>
          <div className="space-y-2">
            {gachaSpots.map((spot, index) => (
              <div 
                key={spot.id} 
                className="bg-gray-50 hover:bg-gray-100 rounded-md p-2 cursor-pointer transition-colors border border-gray-200"
                onClick={() => openPopupFunction?.(spot.id)}
              >
                <div className="flex items-center space-x-2">
                  <span className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-800 text-sm truncate">{spot.name}</h4>
                      <div className="text-yellow-500 text-xs ml-1">
                        {'★'.repeat(spot.stars || 1)}
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">
                      {spot.category === 'restaurant' && '🍽️ レストラン'}
                      {spot.category === 'cafe' && '☕ カフェ'}
                      {spot.category === 'tourist_attraction' && '🏛️ 観光地'}
                      {spot.category === 'gas_station' && '⛽ ガソリンスタンド'}
                      {spot.category === 'shop' && '🛍️ ショップ'}
                      {spot.category === 'all' && '📍 その他'}
                      {spot.isChain && <span className="ml-1 text-xs bg-orange-100 text-orange-600 px-1 rounded">チェーン</span>}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ToastContainer
        position="top-center"
        autoClose={8000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        className="lg:!top-20 !top-40"
      />
    </div>
  );
}

export default App;