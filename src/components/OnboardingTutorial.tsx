import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

const ONBOARDING_KEY = 'flipz_onboarding_done';

const LANGUAGES = [
  { code: 'fr', label: '🇫🇷 Français' },
  { code: 'en', label: '🇬🇧 English' },
  { code: 'es', label: '🇪🇸 Español' },
];

interface SpotlightStep {
  selector: string;
  titleKey: string;
  descKey: string;
  position: 'top' | 'bottom';
}

const TOUR_STEPS: SpotlightStep[] = [
  { selector: '[data-tour="logo"]', titleKey: 'onboarding.step1Title', descKey: 'onboarding.step1Desc', position: 'bottom' },
  { selector: '[data-tour="timer"]', titleKey: 'onboarding.step2Title', descKey: 'onboarding.step2Desc', position: 'bottom' },
  { selector: '[data-tour="card"]', titleKey: 'onboarding.step3Title', descKey: 'onboarding.step3Desc', position: 'bottom' },
  { selector: '[data-tour="nav-collection"]', titleKey: 'onboarding.step4Title', descKey: 'onboarding.step4Desc', position: 'top' },
  { selector: '[data-tour="nav-packs"]', titleKey: 'onboarding.step5Title', descKey: 'onboarding.step5Desc', position: 'top' },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const OnboardingTutorial = () => {
  const [phase, setPhase] = useState<'idle' | 'lang' | 'tour' | 'done'>('idle');
  const [tourStep, setTourStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const { t, i18n } = useTranslation();
  const rafRef = useRef<number>();

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) {
      const timer = setTimeout(() => setPhase('lang'), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const measureTarget = useCallback(() => {
    if (phase !== 'tour') return;
    const step = TOUR_STEPS[tourStep];
    const el = document.querySelector(step.selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      const padding = 8;
      setTargetRect({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
    }
    rafRef.current = requestAnimationFrame(measureTarget);
  }, [phase, tourStep]);

  useEffect(() => {
    if (phase === 'tour') {
      rafRef.current = requestAnimationFrame(measureTarget);
      return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }
  }, [phase, tourStep, measureTarget]);

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('i18nextLng', code);
  };

  const handleLangNext = () => setPhase('tour');

  const handleFinish = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setPhase('done');
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  const handleTourNext = () => {
    if (tourStep < TOUR_STEPS.length - 1) {
      setTourStep(tourStep + 1);
    } else {
      handleFinish();
    }
  };

  const handleTourPrev = () => {
    if (tourStep > 0) setTourStep(tourStep - 1);
  };

  // Language dialog
  if (phase === 'lang') {
    return (
      <Dialog open onOpenChange={() => {}}>
        <DialogContent className="max-w-sm rounded-2xl border-primary/30 bg-card p-0 overflow-hidden [&>button]:hidden">
          <div className="flex flex-col items-center text-center px-6 py-8 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Globe className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-xl font-display font-bold text-foreground">
              {t('onboarding.langTitle')}
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t('onboarding.langDesc')}
            </p>
            <div className="flex flex-col gap-2 w-full mt-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={cn(
                    "w-full py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 border",
                    i18n.language?.startsWith(lang.code)
                      ? "bg-primary/15 border-primary text-foreground"
                      : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between px-6 pb-6">
            <Button variant="ghost" size="sm" onClick={handleFinish} className="text-muted-foreground">
              {t('onboarding.skip')}
            </Button>
            <Button variant="default" size="sm" onClick={handleLangNext}>
              {t('common.next')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Interactive spotlight tour
  if (phase === 'tour' && targetRect) {
    const step = TOUR_STEPS[tourStep];
    const isLast = tourStep === TOUR_STEPS.length - 1;

    // Tooltip position
    const tooltipStyle: React.CSSProperties = {};
    if (step.position === 'bottom') {
      tooltipStyle.top = targetRect.top + targetRect.height + 16;
      tooltipStyle.left = '50%';
      tooltipStyle.transform = 'translateX(-50%)';
    } else {
      tooltipStyle.bottom = window.innerHeight - targetRect.top + 16;
      tooltipStyle.left = '50%';
      tooltipStyle.transform = 'translateX(-50%)';
    }

    return (
      <div className="fixed inset-0 z-[100]" onClick={(e) => e.stopPropagation()}>
        {/* Dark overlay with spotlight cutout using CSS clip-path */}
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="12"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0" y="0"
            width="100%" height="100%"
            fill="rgba(0,0,0,0.75)"
            mask="url(#spotlight-mask)"
          />
        </svg>

        {/* Spotlight ring */}
        <div
          className="absolute rounded-xl border-2 border-primary shadow-[0_0_20px_hsl(45_90%_55%_/_0.4)] pointer-events-none transition-all duration-500 ease-out"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
          }}
        />

        {/* Tooltip */}
        <div
          className="absolute w-[85vw] max-w-xs animate-fade-in"
          style={tooltipStyle}
        >
          <div className="bg-card border border-primary/30 rounded-2xl p-5 shadow-[0_0_30px_hsl(45_90%_55%_/_0.15)]">
            {/* Progress dots */}
            <div className="flex gap-1.5 mb-4">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors duration-300",
                    i <= tourStep ? 'bg-primary' : 'bg-muted'
                  )}
                />
              ))}
            </div>

            <h3 className="text-base font-display font-bold text-foreground mb-1">
              {t(step.titleKey)}
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              {t(step.descKey)}
            </p>

            <div className="flex items-center justify-between">
              {tourStep > 0 ? (
                <Button variant="ghost" size="sm" onClick={handleTourPrev}>
                  {t('common.previous')}
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={handleFinish} className="text-muted-foreground">
                  {t('onboarding.skip')}
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                {tourStep + 1} / {TOUR_STEPS.length}
              </span>
              <Button variant={isLast ? 'gold' : 'default'} size="sm" onClick={handleTourNext}>
                {isLast ? t('onboarding.start') : t('common.next')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
