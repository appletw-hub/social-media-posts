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
  const [showDebug, setShowDebug] = useState(false);

  const addLog = (msg: string) => {
    console.log(`[AppDebug] ${msg}`);
    setDebugLog(prev => [...prev.slice(-9), msg]); 
  };

  // Styles presets
  const stylePresets = [
    '現代簡約', '日系雜誌', '底片懷舊', 
    '美式復古', '賽博龐克', '自然清新', 
    '溫馨感', '手繪版', '療癒系'
  ];

  const checkStatus = useCallback(async () => {
    addLog('正在檢查 API 授權狀態...');
    if (typeof window.aistudio !== 'undefined' && window.aistudio.hasSelectedApiKey) {
      try {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        addLog(`授權狀態: ${hasKey ? '已授權' : '未授權'}`);
        if (hasKey) {
          setState(prev => ({ ...prev, apiKeySelected: true }));
        }
      } catch (err) {
        addLog(`檢查授權失敗: ${String(err)}`);
      }
    } else if (process.env.API_KEY) {
      addLog('偵測到環境變數 API_KEY');
      setState(prev => ({ ...prev, apiKeySelected: true }));
    } else {
      addLog('未偵測到任何 API 授權方式');
    }
  }, []);

  useEffect(() => {
    addLog('應用程式初始化...');
    checkStatus();
  }, [checkStatus]);

  const handleOpenKeySelector = async () => {
    addLog('啟動 API Key 選擇器...');
    if (typeof window.aistudio !== 'undefined' && window.aistudio.openSelectKey) {
      try {
        await window.aistudio.openSelectKey();
        addLog('已開啟對話框，跳過檢查直接進入應用');
        // 依照規範：呼叫後應立即假設成功並進入，避免 Race Condition
        setState(prev => ({ ...prev, apiKeySelected: true }));
      } catch (err) {
        addLog(`呼叫失敗: ${String(err)}`);
        setState(prev => ({ ...prev, apiKeySelected: true }));
      }
    } else {
      addLog('目前環境不支援 aistudio 對話框');
      // 在本地開發或特殊環境，如果沒有 aistudio 但有環境變數也讓它過
      setState(prev => ({ ...prev, apiKeySelected: true }));
    }
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    addLog(`開始生成流程: ${prompt}`);
    
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
      
      addLog(`生成成功，取得 ${imageUrls.length} 張圖`);

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
      addLog(`生成錯誤: ${error.message}`);
      const isEntityNotFound = error.message?.includes("Requested entity was not found.");
      if (isEntityNotFound) {
        addLog('API Key 失效，強制重新認證');
        setState(prev => ({ ...prev, isGenerating: false, apiKeySelected: false }));
        handleOpenKeySelector();
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
          <div className="space-y-6">
            <button 
              onClick={handleOpenKeySelector}
              className="w-full py-5 px-6 bg-blue-600 hover:bg-blue-500 text-white font-black text-xl rounded-2xl transition-all shadow-xl shadow-blue-900/40 active:scale-95 border-2 border-white/10"
            >
              設定 API Key 以開始
            </button>
            <div className="text-xs text-slate-500 space-y-2">
              <p>請點擊上方按鈕，在彈出的官方對話框中選取 API Key。</p>
              <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline block"
              >
                查看帳單文件 (Billing)
              </a>
            </div>
          </div>
        </div>
        
        <button 
          onClick={() => setShowDebug(!showDebug)} 
          className="mt-8 text-[10px] text-slate-700 hover:text-slate-500 font-mono uppercase tracking-widest"
        >
          {showDebug ? '隱藏日誌' : '顯示初始化日誌'}
        </button>
        {showDebug && (
          <div className="mt-4 p-4 bg-black/40 border border-slate-800 rounded-xl text-[10px] font-mono text-slate-600 max-w-sm w-full text-left overflow-hidden">
            {debugLog.map((log, i) => <div key={i} className="truncate">- {log}</div>)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center font-sans selection:bg-blue-500/30">
      <header className="w-full max-w-5xl px-6 py-12 flex flex-col items-center justify-center text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-b from-white via-white to-slate-600 bg-clip-text text-transparent tracking-tighter">
            Social Media Posts
          </h1>
          <div className="px-6 py-1.5 bg-blue-600/10 rounded-full text-[11px] font-black text-blue-400 border border-blue-500/30 uppercase tracking-[0.4em] backdrop-blur-sm mx-auto w-fit">
            Aesthetic Generator
          </div>
        </div>

        {/* 核心功能：API Key 輸入按鍵 */}
        <div className="flex flex-col items-center gap-3 animate-in fade-in duration-700 delay-300">
          <button 
            onClick={handleOpenKeySelector}
            className="group relative px-8 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700/50 rounded-2xl transition-all shadow-lg active:scale-95"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🔑</span>
              <div className="text-left">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Authorization</div>
                <div className="text-xs font-black text-white group-hover:text-blue-400 transition-colors">認證並啟用 AI 生成</div>
              </div>
            </div>
            <div className="absolute inset-0 rounded-2xl bg-blue-500/5 blur-xl group-hover:bg-blue-500/10 transition-all -z-10" />
          </button>
          <div className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter opacity-50">
            請點選按鈕選取金鑰後即可開始創作
          </div>
        </div>
      </header>

      <main className="w-full max-w-4xl px-6 pb-24 space-y-12">
        <section className="bg-slate-900/40 border border-slate-800/60 p-8 rounded-[3rem] shadow-2xl backdrop-blur-md space-y-10 border-t-slate-700/30">
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
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${state.settings.platform === item.type ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-600/20 scale-[1.02]' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
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
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">標示與解析度</label>
                <div className="flex gap-3">
                  <input 
                    type="text"
                    value={state.settings.watermark}
                    onChange={(e) => setState(prev => ({ ...prev, settings: { ...prev.settings, watermark: e.target.value }}))}
                    placeholder="@MyBrand"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <select 
                    value={state.settings.resolution}
                    onChange={(e) => setState(prev => ({ ...prev, settings: { ...prev.settings, resolution: e.target.value as Resolution }}))}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none font-bold"
                  >
                    <option value={Resolution.RES_1K}>1K</option>
                    <option value={Resolution.RES_2K}>2K</option>
                    <option value={Resolution.RES_4K}>4K</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <button 
            disabled={state.isGenerating || !prompt}
            onClick={handleGenerate}
            className="w-full py-6 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:cursor-not-allowed text-white font-black text-xl rounded-3xl transition-all shadow-2xl shadow-blue-900/30 active:scale-[0.98] relative overflow-hidden group"
          >
            <span className="relative z-10">
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
            </span>
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
          </button>
        </section>

        {state.statusMessage && (
          <div className="text-center">
            <p className="text-blue-400 font-bold text-sm tracking-widest animate-pulse uppercase">{state.statusMessage}</p>
          </div>
        )}

        <section id="results-section" className="space-y-16">
          {state.posts.map((post, idx) => (
            <div key={post.id} className="animate-in slide-in-from-bottom-10 fade-in duration-1000">
              <div className="flex flex-col lg:flex-row gap-12 items-start">
                <div className="flex-1 space-y-6">
                  <div className="relative rounded-[3rem] overflow-hidden bg-black shadow-[0_40px_80px_-15px_rgba(0,0,0,0.9)] border border-slate-800 group">
                    <img 
                      src={post.processedUrl} 
                      alt="Result" 
                      className="w-full h-auto object-cover group-hover:scale-[1.01] transition-transform duration-700" 
                    />
                    <WatermarkCanvas 
                      imageUrl={post.originalUrl}
                      text={state.settings.watermark}
                      opacity={state.settings.watermarkOpacity}
                      show={state.settings.showWatermark}
                      onProcessed={(url) => updateProcessedUrl(post.id, url)}
                    />
                    <div className="absolute top-8 left-8 bg-black/40 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest shadow-2xl">
                      Design Option {idx + 1}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => downloadImage(post.processedUrl, 'png')} className="py-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                      下載 PNG
                    </button>
                    <button onClick={() => downloadImage(post.processedUrl, 'jpg')} className="py-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                      下載 JPG
                    </button>
                  </div>
                </div>
                <div className="w-full lg:w-80 p-8 bg-slate-900/60 rounded-[2.5rem] border border-slate-800/80 space-y-6 shadow-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">AI 撰寫文案</h3>
                  </div>
                  <p className="text-slate-200 text-sm leading-[1.8] whitespace-pre-wrap font-medium">{post.caption}</p>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(post.caption);
                      alert('文案已複製！');
                    }}
                    className="w-full py-4 bg-slate-950 hover:bg-black rounded-xl text-[10px] font-bold text-slate-500 hover:text-white transition-all uppercase tracking-widest border border-slate-800 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                    複製文案內容
                  </button>
                </div>
              </div>
            </div>
          ))}
          {state.posts.length === 0 && !state.isGenerating && (
            <div className="py-24 text-center opacity-20 select-none">
              <div className="text-8xl mb-4">✨</div>
              <p className="font-bold uppercase tracking-[0.5em] text-slate-500">Wait for Creativity</p>
            </div>
          )}
        </section>
      </main>

      <footer className="w-full py-12 border-t border-slate-900/50 flex flex-col items-center gap-4">
        <p className="text-slate-700 text-[10px] font-black uppercase tracking-[0.4em]">Powered by Gemini 3.0 Aesthetic Engine</p>
      </footer>
    </div>
  );
};

export default App;
