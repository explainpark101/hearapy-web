import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Settings, Activity, Play, Square, ExternalLink } from 'lucide-react';
import { FaGithub as Github } from "react-icons/fa";

// iOS 스타일의 스크롤 피커 컴포넌트
const ScrollPicker = ({ value, onChange, min, max, step }) => {
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startScrollTop = useRef(0);
  const itemHeight = 40; // 항목 당 높이 (px)
  const options = [];
  
  for (let i = min; i <= max; i += step) {
    options.push(i);
  }

  // 초기 값 위치로 스크롤 이동
  useEffect(() => {
    if (containerRef.current) {
      const index = options.indexOf(value);
      if (index !== -1) {
        containerRef.current.scrollTop = index * itemHeight;
      }
    }
  }, []);

  // 네이티브 스크롤 이벤트에 따른 값 동기화 (터치 및 휠 스크롤용)
  const handleScroll = (e) => {
    if (isDragging.current) return; // 드래그 중에는 스크롤 이벤트를 통한 값 업데이트 방지
    const index = Math.round(e.target.scrollTop / itemHeight);
    const safeIndex = Math.max(0, Math.min(options.length - 1, index));
    if (options[safeIndex] !== value) {
      onChange(options[safeIndex]);
    }
  };

  // 항목 클릭 시 해당 위치로 부드럽게 스크롤
  const handleItemClick = (index) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: index * itemHeight, behavior: 'smooth' });
      onChange(options[index]);
    }
  };

  // 마우스 드래그 이벤트 (웹 데스크탑 대응)
  const handleMouseDown = (e) => {
    isDragging.current = true;
    startY.current = e.pageY;
    startScrollTop.current = containerRef.current.scrollTop;
    
    // 드래그 중 자연스러운 이동을 위해 스냅 잠시 해제
    if (containerRef.current) {
      containerRef.current.style.scrollSnapType = 'none';
      containerRef.current.style.scrollBehavior = 'auto';
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current || !containerRef.current) return;
    e.preventDefault();
    const y = e.pageY;
    const walk = (startY.current - y) * 1.5; // 스크롤 속도 조절
    containerRef.current.scrollTop = startScrollTop.current + walk;
  };

  const handleMouseUpOrLeave = () => {
    if (!isDragging.current || !containerRef.current) return;
    isDragging.current = false;
    
    // 스냅 재활성화 및 가장 가까운 항목으로 정렬
    containerRef.current.style.scrollSnapType = 'y mandatory';
    containerRef.current.style.scrollBehavior = 'smooth';
    
    const index = Math.round(containerRef.current.scrollTop / itemHeight);
    const safeIndex = Math.max(0, Math.min(options.length - 1, index));
    
    containerRef.current.scrollTo({ top: safeIndex * itemHeight, behavior: 'smooth' });
    onChange(options[safeIndex]);
  };

  return (
    <div className="relative w-full h-[200px] bg-slate-900/50 rounded-2xl overflow-hidden shadow-inner border border-slate-700/50 select-none cursor-grab active:cursor-grabbing">
      {/* 선택 영역 하이라이트 (중앙) */}
      <div className="absolute top-[80px] left-4 right-4 h-[40px] bg-blue-500/10 border-y border-blue-500/30 rounded-lg pointer-events-none" />

      <div
        ref={containerRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
        onScroll={handleScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onTouchStart={() => {
          if (containerRef.current) {
            containerRef.current.style.scrollSnapType = 'y mandatory';
          }
        }}
      >
        {/* 상단 여백 (중앙 정렬을 위함) */}
        <div style={{ height: '80px' }} className="w-full shrink-0" />
        
        {options.map((opt, i) => (
          <div
            key={opt}
            onClick={() => handleItemClick(i)}
            className={`h-[40px] flex items-center justify-center snap-center cursor-pointer transition-all duration-200 shrink-0 ${
              value === opt ? 'text-blue-400 font-medium text-xl scale-110' : 'text-slate-500 text-sm hover:text-slate-400'
            }`}
          >
            {opt}초
          </div>
        ))}
        
        {/* 하단 여백 (중앙 정렬을 위함) */}
        <div style={{ height: '80px' }} className="w-full shrink-0" />
      </div>
    </div>
  );
};

export default function App() {
  // 상태 관리
  const [currentView, setCurrentView] = useState('main'); // 'main' | 'settings'
  const [duration, setDuration] = useState(60); // 기본 60초 (40~120초)
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(duration);

  // Web Audio API 및 타이머 Refs
  const audioCtxRef = useRef(null);
  const oscillatorRef = useRef(null);
  const gainNodeRef = useRef(null);
  const silentAudioRef = useRef(null);
  const endTimeRef = useRef(null); // 백그라운드 스로틀링 방지용 절대 시간

  // duration 변경 시 timeLeft 동기화
  useEffect(() => {
    if (!isPlaying) {
      setTimeLeft(duration);
    }
  }, [duration, isPlaying]);

  // 남은 시간 포맷팅 (MM:SS)
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // 타이머 로직 (절대 시간 기반 계산으로 백그라운드 지연 방지)
  useEffect(() => {
    let interval = null;
    if (isPlaying && endTimeRef.current) {
      interval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.round((endTimeRef.current - now) / 1000));
        
        setTimeLeft(remaining);
        
        if (remaining <= 0) {
          stopTherapy();
        }
      }, 500); // UI 갱신을 위해 0.5초마다 검사
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying]);

  // 컴포넌트 언마운트 시 오디오 정리
  useEffect(() => {
    return () => {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
    };
  }, []);

  const startTherapy = () => {
    if (isPlaying) return;

    // 1. AudioContext 초기화
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    // 2. 모바일 백그라운드 유지를 위한 무음 오디오 재생 (Trick)
    if (silentAudioRef.current) {
      silentAudioRef.current.play().catch(e => console.log('Silent audio playback blocked:', e));
    }

    // 3. 미디어 세션 API 설정 (잠금화면 컨트롤 및 백그라운드 유지 보조)
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'playing';
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: '100Hz 안정화 테라피',
        artist: 'Hearapy',
        album: '멀미 완화'
      });
      // Media Session의 정지 버튼 동작 맵핑
      navigator.mediaSession.setActionHandler('pause', stopTherapy);
      navigator.mediaSession.setActionHandler('stop', stopTherapy);
    }

    // 4. 오실레이터 생성 및 연결
    const osc = audioCtxRef.current.createOscillator();
    const gain = audioCtxRef.current.createGain();

    osc.type = 'sine';
    osc.frequency.value = 100;

    osc.connect(gain);
    gain.connect(audioCtxRef.current.destination);

    // 부드러운 페이드인
    const now = audioCtxRef.current.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.8, now + 1);

    osc.start();

    oscillatorRef.current = osc;
    gainNodeRef.current = gain;

    // 5. 절대 목표 시간 설정 후 상태 업데이트
    endTimeRef.current = Date.now() + duration * 1000;
    setIsPlaying(true);
    setTimeLeft(duration);
  };

  const stopTherapy = () => {
    if (!isPlaying) return;

    // 페이드 아웃
    if (gainNodeRef.current && audioCtxRef.current) {
      const now = audioCtxRef.current.currentTime;
      gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, now);
      gainNodeRef.current.gain.linearRampToValueAtTime(0, now + 1);
    }

    // 무음 오디오 및 미디어 세션 정리 (일시정지 및 초기화)
    if (silentAudioRef.current) {
      silentAudioRef.current.pause();
      silentAudioRef.current.currentTime = 0; // 재생 위치 초기화 추가
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
    }

    setTimeout(() => {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
      }
      setIsPlaying(false);
      setTimeLeft(duration);
      endTimeRef.current = null;
    }, 1000);
  };

  const handleOpenSettings = () => {
    setCurrentView('settings');
  };

  return (
    <div className="bg-slate-950 text-slate-200 min-h-screen flex flex-col font-sans selection:bg-blue-500/30">
      {/* 백그라운드 오디오 세션 유지를 위한 무음(base64) 오디오 태그 */}
      {/* 아주 짧은 빈 WAV 데이터입니다. */}
      <audio 
        ref={silentAudioRef} 
        loop 
        playsInline 
        src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=" 
        className="hidden"
      />

      {/* 커스텀 애니메이션 및 스크롤바 숨김 스타일 */}
      <style>
        {`
          @keyframes ripple {
            0% { transform: scale(0.8); opacity: 1; }
            100% { transform: scale(2.5); opacity: 0; }
          }
          .animate-ripple {
            animation: ripple 2s infinite cubic-bezier(0.65, 0, 0.34, 1);
          }
          .animation-delay-500 {
            animation-delay: 500ms;
          }
          .animation-delay-1000 {
            animation-delay: 1000ms;
          }
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}
      </style>

      {/* 설정 화면 */}
      {currentView === 'settings' && (
        <div className="max-w-md w-full mx-auto p-6 flex-1 flex flex-col">
          <header className="flex items-center mb-8 relative">
            <button 
              onClick={() => setCurrentView('main')}
              className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-medium text-white ml-2">Settings</h1>
          </header>

          <div className="space-y-4 overflow-y-auto pb-8 no-scrollbar">
            {/* Playback Duration 설정 (1초 단위 스크롤 피커 적용) */}
            <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base text-slate-200 font-medium">Playback Duration</h2>
                <span className="text-blue-400 font-medium">{duration}초</span>
              </div>
              <ScrollPicker 
                value={duration} 
                onChange={setDuration} 
                min={40} 
                max={120} 
                step={1} 
              />
            </div>

            {/* Background 정보 */}
            <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700">
              <h2 className="text-base text-slate-200 font-medium mb-3">Background</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Hearapy helps reduce motion sickness. A clear 100 Hz bass sine tone stimulates your balance system and can improve your comfort on the go without taking any medication. Simply open the Hearapy app, put on your Galaxy Buds4 Pro, and enjoy a more relaxed journey.
              </p>
            </div>

            {/* How it works 정보 */}
            <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700">
              <h2 className="text-base text-slate-200 font-medium mb-3">Hearapy: How it works</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Turn on your Galaxy Buds4 Pro and set the volume loud but still comfortable. Listen to the 100 Hz bass sine tone for {duration} seconds before your trip. The effect can last up to two hours. Repeat listening to the tone as needed.
              </p>
            </div>

            {/* Legal 정보 및 면책 조항 */}
            <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700">
              <h2 className="text-base text-slate-200 font-medium mb-3">Legal & Disclaimer</h2>
              <div className="text-slate-400 text-xs leading-relaxed space-y-3">
                <p>
                  본 웹 애플리케이션은 원본 'Hearapy' 앱의 연구 배경과 동작 원리를 참고하여 웹 환경에서 작동하도록 제작된 <strong>비공식 웹 버전</strong>입니다.
                </p>
                <p>
                  제작자:{' '}
                  <a href="https://github.com/explainpark101" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors font-medium">
                    <Github className="w-3.5 h-3.5" />
                    github:explainpark101
                  </a><br/>
                  'Hearapy'는 Samsung의 등록 상표입니다. 본 웹앱의 제작자는 Samsung 및 해당 상표권자와 어떠한 상업적, 법적 관련성도 없으며, 원작의 상표권 및 모든 권리는 원 저작자에게 귀속됩니다.
                </p>
                <div className="pt-2">
                  <p className="mb-2 text-slate-300">공식 Android 앱 다운로드 및 자세한 정보:</p>
                  <a 
                    href="https://play.google.com/store/apps/details?id=com.samsung.a100hz&hl=ko" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    Google Play Store: Hearapy 앱 다운로드
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 메인 화면 */}
      {currentView === 'main' && (
        <main className="max-w-md w-full mx-auto p-6 flex-1 flex flex-col items-center justify-center relative">
          {/* 설정 버튼 */}
          <button 
            onClick={handleOpenSettings}
            className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-slate-800"
          >
            <Settings className="w-6 h-6" />
          </button>

          {/* 헤더 섹션 */}
          <div className="text-center mb-10 w-full">
            <h1 className="text-4xl font-bold text-white tracking-tight mb-2">Hearapy Web</h1>
            <p className="text-slate-400 text-sm">100Hz 전정 기관 안정화 테라피</p>
          </div>

          {/* 메인 컨트롤 카드 */}
          <div className="bg-slate-900 rounded-3xl p-8 shadow-2xl shadow-blue-900/10 border border-slate-800 relative overflow-hidden flex flex-col items-center w-full">
            
            {/* 시각화 영역 */}
            <div className="relative w-40 h-40 flex items-center justify-center mb-8">
              {/* 애니메이션 링 (재생 시 활성화) */}
              {isPlaying && (
                <>
                  <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ripple"></div>
                  <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ripple animation-delay-500"></div>
                  <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ripple animation-delay-1000"></div>
                </>
              )}
              
              {/* 중앙 아이콘 */}
              <div className="relative z-10 w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
                <Activity className="w-10 h-10 text-white" />
              </div>
            </div>

            {/* 타이머 */}
            <div className={`text-5xl font-light mb-8 tracking-wider ${isPlaying ? 'text-blue-400' : 'text-white'}`}>
              {formatTime(timeLeft)}
            </div>

            {/* 컨트롤 버튼 */}
            <div className="flex gap-4 w-full">
              {!isPlaying ? (
                <button 
                  onClick={startTherapy}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-4 px-6 rounded-2xl transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                >
                  <Play className="w-5 h-5 shrink-0 fill-current" />
                  테라피 시작
                </button>
              ) : (
                <button 
                  onClick={stopTherapy}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-red-400 font-medium py-4 px-6 rounded-2xl transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 border border-slate-700"
                >
                  <Square className="w-5 h-5 shrink-0 fill-current" />
                  중지
                </button>
              )}
            </div>
          </div>

          {/* 안내 문구 (논문 기준 반영) */}
          <div className="mt-8 text-center text-slate-500 text-xs px-4 leading-relaxed space-y-2 w-full">
            <p>이어폰이나 헤드폰 착용을 권장합니다. (양쪽 귀에 동일한 소리 노출 필요)</p>
            <p>기기의 볼륨을 <strong>귀가 약간 불편할 정도의 볼륨(약 80-85dB)</strong>으로 조절해 주세요.</p>
            <p>가장 높은 효과를 위해 차량 탑승 전이나 VR/3D 게임 시작 <strong>직전 {duration}초 동안</strong> 청취하십시오.</p>
          </div>

          {/* 공식 앱 안내 및 법적 회피 문구 */}
          <div className="mt-6 pt-6 border-t border-slate-800 text-center text-xs w-full">
            <p className="text-slate-500 mb-2 px-4 leading-relaxed">
              * 'Hearapy'는 Samsung의 등록상표입니다.<br/>
              본 웹앱은 원작의 동작을 웹에서 구현한 비공식 클론 프로젝트이며, 제작자(
              <a href="https://github.com/explainpark101" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-blue-400 hover:text-blue-300 transition-colors font-medium">
                <Github className="w-3.5 h-3.5 shrink-0" />
                explainpark101
              </a>
              )는 Samsung 및 원 저작자와 어떠한 법적 관련도 없음을 명시합니다.
            </p>
            <a 
              href="https://play.google.com/store/apps/details?id=com.samsung.a100hz&hl=ko" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              Google Play Store: 공식 Hearapy 앱 다운로드 (Android 한정)
            </a>
          </div>
        </main>
      )}
    </div>
  );
}