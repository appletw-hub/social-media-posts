import React, { useState, useEffect, useCallback } from 'react';
import { 
  PlatformType, 
  Resolution, 
  GeneratedPost, 
  AppState 
} from './types';
import { generateSocialImages, generateCaption } from './services/geminiService';
import { WatermarkCanvas } from './components/WatermarkCanvas';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    apiKeySelected: false,
    isGenerating: false,
    statusMessage: '',
    posts: [],
    settings: {
      platform: PlatformType.IG_SQUARE,
      resolution: Resolution.RES_1K,
      style: '現代簡約',
      count: 1,
      watermark: '@SocialGenAI',
      watermarkOpacity: 0.6,
      showWatermark: true,
    }
  });

  const [prompt, setPrompt] = useState('');
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    console.log(`[AppDebug] ${msg}`);
    setDebugLog(prev => [...prev.slice(-4), msg]); // Keep last 5 logs
  };

  // Styles presets
  const stylePresets = [
    '現代簡約', '日系雜誌', '底片懷舊', 
    '美式復古', '賽博龐克', '自然清新', 
    '溫馨感', '手繪版', '療癒系'
  ];

  useEffect(() => {
    addLog('組件掛載，開始檢測 API 環境...');
    
    const checkStatus = async () => {
      // 檢查是否已經有 API Key 環境變數 (通常是部署後的狀態)
      const hasEnvKey = !!process.env.API_KEY;
      addLog(`環境變數 API_KEY 存在: ${hasEnvKey}`);

      if (typeof window.aistudio !== 'undefined') {
        addLog('偵測到 window.aistudio 介面');
        if (window.aistudio.hasSelectedApiKey) {
          try {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            addLog(`aistudio.hasSelectedApiKey 返回: ${hasKey}`);
            // 如果 aistudio 說有 key，或者環境變數已有 key，則進入 App
            if (hasKey || hasEnvKey) {
              setState(prev => ({ ...prev, apiKeySelected: true }));
            }
          } catch (err) {
            addLog(`檢測 Key 失敗: ${String(err)}`);
          }
        }
      } else if (hasEnvKey) {
        addLog('未偵測到 aistudio 介面，但偵測到環境變數，直接進入...');
        setState(prev => ({ ...prev, apiKeySelected: true }));
      } else {
        addLog('未偵測到 Key，等待使用者操作');
      }
    };

    checkStatus();
  }, []);

  const handleOpenKeySelector = async () => {
    addLog('觸發設定按鈕...');
    
    if (typeof window.aistudio !== 'undefined' && window.aistudio.openSelectKey) {
      try {
        addLog('正在呼叫 aistudio.openSelectKey()...');
        // 依照規範：呼叫後應立即假設成功並進入，避免 Race Condition
        window.aistudio.openSelectKey();
        addLog('已發送開啟請求，強制進入 App 介面');
        setState(prev => ({ ...prev, apiKeySelected: true }));
      } catch (err) {
        addLog(`呼叫失敗: ${String(err)}`);
        // 即使失敗也嘗試進入，因為 process.env.API_KEY 可能是由外部注入的
        setState(prev => ({ ...prev, apiKeySelected: true }));
      }
    } else {
      addLog('環境不支援 aistudio 介面，嘗試直接進入...');
      setState(prev => ({ ...prev, apiKeySelected: true }));
    }
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    addLog(`開始生成: ${prompt}`);
    
    setState(prev => ({ 
      ...prev, 
      isGenerating: true, 
      statusMessage: 'AI 正在分析主題並設計視覺...',
      posts: [] 
    }));

    try {
      const imageUrls = await generateSocialImages(
        prompt,
        state.settings.platform,
        state.settings.resolution,
        state.settings.style,
        state.settings.count
      );
      
      addLog(`成功獲取 ${imageUrls.length} 張圖片`);

      const newPosts: GeneratedPost[] = await Promise.all(imageUrls.map(async (url, idx) => {
        const caption = await generateCaption(prompt, state.settings.style);
        return {
          id: `${Date.now()}-${idx}`,
          originalUrl: url,
          processedUrl: url,
          prompt: prompt,
          caption: caption
        };
      }));

      setState(prev => ({ 
        ...prev, 
        posts: newPosts, 
        isGenerating: false, 
        statusMessage: '設計完成！' 
      }));

      setTimeout(() => {
        document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (error: any) {
      addLog(`生成失敗: ${error.message}`);
      const isEntityNotFound = error.message?.includes("Requested entity was not found.");
      if (isEntityNotFound) {
        addLog('API Key 失效，重置狀態...');
        setState(prev => ({ ...prev, isGenerating: false, apiKeySelected: false }));
        if (typeof window.aistudio !== 'undefined' && window.aistudio.openSelectKey) {
          window.aistudio.openSelectKey();
        }
      } else {
        setState(prev => ({ ...prev, isGenerating: false, statusMessage: `生成出錯: ${error.message}` }));
      }
    }
  };

  const updateProcessedUrl = useCallback((postId: string, newUrl: string) => {
    setState(prev => ({
      ...prev,
      posts: prev.posts.map(p => p.id === postId ? { ...p, processedUrl: newUrl } : p)
    }));
  }, []);

  const downloadImage = (url: string, format: 'png' | 'jpg') => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `social-post-${Date.now()}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!state.apiKeySelected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
        <div className="max-w-md w-full space-y-8 p-10 bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl animate-in fade-in zoom-in duration-500">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent italic tracking-tight">Social Media Posts</h1>
            <p className="text-slate-400 text-lg font-light">一鍵解鎖您的社群設計影響力</p>
          </div>
          <div className="space-y-4">
            <button 
              onClick={handleOpenKeySelector}
              className="w-full py-5 px-6 bg-blue-600 hover:bg-blue-500 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-blue-900/40 active:scale-95"
            >
              設定 API Key 以開始
            </button>
            <p className="text-xs text-slate-500 leading-relaxed">
              點擊上方按鈕選取具備付款方式的 API Key。<br/>
              如果沒有彈出視窗，請確認瀏覽器未封鎖彈出式視窗。<br/>
              <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline inline-block mt-2"
              >
                查看帳單文件 (Billing)
              </a>
            </p>
          </div>
        </div>
        
        {/* Debug 面板：僅在開發或卡住時參考 */}
        <div className="mt-8 p-4 bg-black/40 border border-slate-800 rounded-xl text-[10px] font-mono text-slate-600 max-w-sm w-full">
          <div className="font-bold mb-1 text-slate-500 uppercase">Initialization Logs:</div>
          {debugLog.map((log, i) => <div key={i}>- {log}</div>)}
          {!debugLog.length && <div>Waiting for mount...</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center font-sans">
      <header className="w-full max-w-5xl px-6 py-12 flex flex-col items-center justify-center text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-b from-white via-white to-slate-500 bg-clip-text text-transparent tracking-tighter">
          Social Media Posts
        </h1>
        <div className="px-6 py-1.5 bg-blue-600/10 rounded-full text-[11px] font-black text-blue-400 border border-blue-500/30 uppercase tracking-[0.4em] backdrop-blur-sm">
          Aesthetic Generator
        </div>
      </header>

      <main className="w-full max-w-4xl px-6 pb-24 space-y-12">
        <section className="bg-slate-900/40 border border-slate-800/60 p-8 rounded-[3rem] shadow-2xl backdrop-blur-md space-y-10">
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">貼文核心主題</label>
              <span className="text-[10px] text-slate-600 font-medium">請詳細描述您想要的畫面感</span>
            </div>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：一位時尚女性在巴黎街頭喝咖啡，午後陽光灑在桌面，膠卷相機質感..."
              className="w-full h-32 bg-slate-950/80 border border-slate-800 rounded-[2rem] p-6 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none text-slate-200 text-lg placeholder:text-slate-800 shadow-inner"
            />
          </div>

          <div className="space-y-10">
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">發布平台尺寸</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { type: PlatformType.IG_SQUARE, label: 'IG 貼文', sub: '1:1' },
                  { type: PlatformType.IG_STORY, label: 'IG 限動', sub: '9:16' },
                  { type: PlatformType.FB_POST, label: 'FB 貼文', sub: '4:3' },
                  { type: PlatformType.X_POST, label: 'X 貼文', sub: '16:9' }
                ].map((item) => (
                  <button
                    key={item.type}
                    onClick={() => setState(prev => ({ ...prev, settings: { ...prev.settings, platform: item.type }}))}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${state.settings.platform === item.type ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-600/20' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                  >
                    <span className="text-sm font-bold">{item.label}</span>
                    <span className="text-[10px] opacity-50 font-mono mt-1">{item.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">設計風格</label>
              <div className="grid grid-cols-3 gap-3">
                {stylePresets.map((style) => (
                  <button
                    key={style}
                    onClick={() => setState(prev => ({ ...prev, settings: { ...prev.settings, style }}))}
                    className={`flex items-center justify-center py-3.5 rounded-2xl border text-[13px] font-bold transition-all ${state.settings.style === style ? 'bg-indigo-600 border-indigo-400 shadow-lg shadow-indigo-600/20' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">生成數量</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map(n => (
                    <button
                      key={n}
                      onClick={() => setState(prev => ({ ...prev, settings: { ...prev.settings, count: n }}))}
                      className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all ${state.settings.count === n ? 'bg-blue-600 border-blue-400' : 'bg-slate-950 border-slate-800'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">浮水印內容</label>
                <input 
                  type="text"
                  value={state.settings.watermark}
                  onChange={(e) => setState(prev => ({ ...prev, settings: { ...prev.settings, watermark: e.target.value }}))}
                  placeholder="@MyBrand"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          <button 
            disabled={state.isGenerating || !prompt}
            onClick={handleGenerate}
            className="w-full py-6 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:cursor-not-allowed text-white font-black text-xl rounded-3xl transition-all shadow-2xl shadow-blue-900/30 active:scale-[0.98]"
          >
            {state.isGenerating ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                正在注入美感靈魂...
              </span>
            ) : (
              '開始設計貼文'
            )}
          </button>
        </section>

        {state.statusMessage && (
          <div className="text-center">
            <p className="text-blue-400 font-bold text-sm tracking-widest animate-pulse">{state.statusMessage}</p>
          </div>
        )}

        <section id="results-section" className="space-y-16">
          {state.posts.map((post, idx) => (
            <div key={post.id} className="animate-in slide-in-from-bottom-10 fade-in duration-1000">
              <div className="flex flex-col lg:flex-row gap-12 items-start">
                <div className="flex-1 space-y-6">
                  <div className="relative rounded-[3rem] overflow-hidden bg-black shadow-[0_40px_80px_-15px_rgba(0,0,0,0.9)] border border-slate-800">
                    <img 
                      src={post.processedUrl} 
                      alt="Result" 
                      className="w-full h-auto object-cover" 
                    />
                    <WatermarkCanvas 
                      imageUrl={post.originalUrl}
                      text={state.settings.watermark}
                      opacity={state.settings.watermarkOpacity}
                      show={state.settings.showWatermark}
                      onProcessed={(url) => updateProcessedUrl(post.id, url)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => downloadImage(post.processedUrl, 'png')} className="py-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-xs font-bold transition-all">
                      下載 PNG
                    </button>
                    <button onClick={() => downloadImage(post.processedUrl, 'jpg')} className="py-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-xs font-bold transition-all">
                      下載 JPG
                    </button>
                  </div>
                </div>
                <div className="w-full lg:w-80 p-8 bg-slate-900/60 rounded-[2.5rem] border border-slate-800/80 space-y-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">AI 撰寫文案</h3>
                  <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{post.caption}</p>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(post.caption);
                      alert('文案已複製！');
                    }}
                    className="w-full py-3 bg-slate-950 hover:bg-black rounded-xl text-[10px] font-bold text-slate-500 hover:text-white transition-all uppercase tracking-widest border border-slate-800"
                  >
                    複製文案
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>
      </main>

      <footer className="w-full py-12 border-t border-slate-900/50 flex flex-col items-center gap-4">
        <p className="text-slate-700 text-[10px] font-black uppercase tracking-[0.4em]">Powered by Gemini AI Studio</p>
      </footer>
    </div>
  );
};

export default App;
