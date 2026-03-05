import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BookOpen, Package, Store, Sparkles, Trophy, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

const ONBOARDING_KEY = 'flipz_onboarding_done';

const LANGUAGES = [
  { code: 'fr', label: '🇫🇷 Français' },
  { code: 'en', label: '🇬🇧 English' },
  { code: 'es', label: '🇪🇸 Español' },
];

interface Step {
  icon: React.ReactNode;
  titleKey: string;
  descKey: string;
  isLangStep?: boolean;
}

export const OnboardingTutorial = () => {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) {
      const timer = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('i18nextLng', code);
  };

  const steps: Step[] = [
    {
      icon: <Globe className="w-12 h-12 text-primary" />,
      titleKey: 'onboarding.langTitle',
      descKey: 'onboarding.langDesc',
      isLangStep: true,
    },
    {
      icon: <Sparkles className="w-12 h-12 text-primary" />,
      titleKey: 'onboarding.step1Title',
      descKey: 'onboarding.step1Desc',
    },
    {
      icon: <BookOpen className="w-12 h-12 text-primary" />,
      titleKey: 'onboarding.step2Title',
      descKey: 'onboarding.step2Desc',
    },
    {
      icon: <Package className="w-12 h-12 text-primary" />,
      titleKey: 'onboarding.step3Title',
      descKey: 'onboarding.step3Desc',
    },
    {
      icon: <Store className="w-12 h-12 text-primary" />,
      titleKey: 'onboarding.step4Title',
      descKey: 'onboarding.step4Desc',
    },
    {
      icon: <Trophy className="w-12 h-12 text-primary" />,
      titleKey: 'onboarding.step5Title',
      descKey: 'onboarding.step5Desc',
    },
  ];

  const handleFinish = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setOpen(false);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleSkip = () => {
    handleFinish();
  };

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleFinish(); }}>
      <DialogContent className="max-w-sm rounded-2xl border-primary/30 bg-card p-0 overflow-hidden [&>button]:hidden">
        {/* Progress bar */}
        <div className="flex gap-1.5 px-6 pt-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i <= currentStep ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex flex-col items-center text-center px-6 py-8 gap-4">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            {step.icon}
          </div>
          <h2 className="text-xl font-display font-bold text-foreground">
            {t(step.titleKey)}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t(step.descKey)}
          </p>

          {/* Language selector on first step */}
          {step.isLangStep && (
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
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 pb-6">
          {currentStep > 0 ? (
            <Button variant="ghost" size="sm" onClick={handlePrev}>
              {t('common.previous')}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
              {t('onboarding.skip')}
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {currentStep + 1} / {steps.length}
          </span>
          <Button variant={isLast ? 'gold' : 'default'} size="sm" onClick={handleNext}>
            {isLast ? t('onboarding.start') : t('common.next')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
