import { Link } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, Play, Sparkles, Gift, Zap, Crown } from 'lucide-react';

const Shop = () => {
  // Ad pack types with different rewards
  const adPacks = [
    {
      id: 'daily',
      title: 'Pack Quotidien',
      description: 'Regardez une pub et recevez 1 carte aléatoire',
      reward: '1 carte',
      icon: Gift,
      gradient: 'from-[#2597A6] to-[#636AA2]',
      shadowColor: 'shadow-[0_0_30px_rgba(37,151,166,0.4)]',
      available: true,
    },
    {
      id: 'bonus',
      title: 'Pack Bonus',
      description: 'Regardez 3 pubs et obtenez un pack de 3 cartes',
      reward: '3 cartes',
      icon: Zap,
      gradient: 'from-[#744E90] to-[#662D5E]',
      shadowColor: 'shadow-[0_0_30px_rgba(116,78,144,0.4)]',
      available: true,
    },
    {
      id: 'premium',
      title: 'Pack Premium',
      description: 'Regardez 5 pubs pour une carte rare garantie',
      reward: '1 rare+',
      icon: Crown,
      gradient: 'from-[#EC9884] to-[#662D5E]',
      shadowColor: 'shadow-[0_0_30px_rgba(236,152,132,0.4)]',
      available: false,
    },
  ];

  const handleWatchAd = (packId: string) => {
    // TODO: Implement ad watching logic
    console.log('Watch ad for pack:', packId);
  };

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-[#2F1A4C] via-[#662D5E]/30 to-[#2F1A4C]">
      {/* Header with animated background */}
      <header className="relative pt-12 pb-8 px-4 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-[#2597A6]/20 blur-3xl" />
          <div className="absolute top-10 -left-20 w-40 h-40 rounded-full bg-[#EC9884]/20 blur-3xl" />
          <div className="absolute bottom-0 right-10 w-32 h-32 rounded-full bg-[#744E90]/30 blur-2xl" />
        </div>

        <div className="relative z-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2597A6] to-[#636AA2] mb-4 shadow-[0_0_40px_rgba(37,151,166,0.5)]">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display text-3xl text-white mb-2">Boutique</h1>
          <p className="text-[#636AA2] text-sm">Obtenez des cartes gratuitement</p>
        </div>
      </header>

      <main className="px-4 space-y-8">
        {/* Section: Packs via ads */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Play className="w-5 h-5 text-[#EC9884]" />
            <h2 className="font-display text-lg text-white">Packs Publicitaires</h2>
          </div>

          <div className="grid gap-4">
            {adPacks.map((pack) => {
              const IconComponent = pack.icon;
              return (
                <div
                  key={pack.id}
                  className={`relative rounded-2xl p-[1px] bg-gradient-to-r ${pack.gradient} ${pack.shadowColor} transition-all duration-300 hover:scale-[1.02]`}
                >
                  <div className="relative rounded-2xl bg-[#2F1A4C]/90 backdrop-blur-sm p-5 overflow-hidden">
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 overflow-hidden">
                      <div className="absolute -inset-full animate-[shimmer_3s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                    </div>

                    <div className="relative flex items-center gap-4">
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br ${pack.gradient} flex items-center justify-center`}>
                        <IconComponent className="w-7 h-7 text-white" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display text-white text-base mb-1">{pack.title}</h3>
                        <p className="text-[#636AA2] text-xs leading-relaxed">{pack.description}</p>
                      </div>

                      {/* Reward badge & button */}
                      <div className="flex flex-col items-end gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${pack.gradient} text-white`}>
                          {pack.reward}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => handleWatchAd(pack.id)}
                          disabled={!pack.available}
                          className={`bg-gradient-to-r ${pack.gradient} text-white border-0 hover:opacity-90 transition-opacity disabled:opacity-40`}
                        >
                          <Play className="w-3 h-3 mr-1" />
                          {pack.available ? 'Regarder' : 'Bientôt'}
                        </Button>
                      </div>
                    </div>

                    {/* Unavailable overlay */}
                    {!pack.available && (
                      <div className="absolute inset-0 bg-[#2F1A4C]/60 backdrop-blur-[1px] rounded-2xl flex items-center justify-center">
                        <span className="text-[#636AA2] text-sm font-medium">Disponible bientôt</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Divider */}
        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full h-px bg-gradient-to-r from-transparent via-[#744E90]/50 to-transparent" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-4 bg-[#2F1A4C] text-[#636AA2] text-xs uppercase tracking-wider">ou</span>
          </div>
        </div>

        {/* Section: Exchange Button */}
        <section className="pb-4">
          <Link to="/exchange">
            <div className="relative rounded-2xl p-[2px] bg-gradient-to-r from-[#EC9884] via-[#744E90] to-[#2597A6] shadow-[0_0_40px_rgba(236,152,132,0.3)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_60px_rgba(236,152,132,0.4)]">
              <div className="relative rounded-2xl bg-gradient-to-br from-[#2F1A4C] to-[#662D5E]/50 p-6 overflow-hidden">
                {/* Decorative background */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#EC9884]/10 blur-2xl" />
                  <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-[#2597A6]/10 blur-2xl" />
                </div>

                <div className="relative flex items-center gap-5">
                  {/* Icon */}
                  <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-[#EC9884] to-[#662D5E] flex items-center justify-center shadow-[0_0_20px_rgba(236,152,132,0.4)]">
                    <ArrowRightLeft className="w-8 h-8 text-white" />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="font-display text-xl text-white mb-1">Centre d'Échange</h3>
                    <p className="text-[#EC9884]/80 text-sm">
                      Échangez vos doublons contre de nouvelles cartes
                    </p>
                  </div>

                  {/* Arrow */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>

                {/* Trade info badges */}
                <div className="relative mt-4 flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-full text-xs bg-[#636AA2]/20 text-[#636AA2] border border-[#636AA2]/30">
                    5 communes → 3 cartes
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs bg-[#2597A6]/20 text-[#2597A6] border border-[#2597A6]/30">
                    5 rares → 7 cartes
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs bg-[#744E90]/20 text-[#744E90] border border-[#744E90]/30">
                    5 épiques → 10 cartes
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs bg-[#EC9884]/20 text-[#EC9884] border border-[#EC9884]/30">
                    5 légendaires → 15 cartes
                  </span>
                </div>
              </div>
            </div>
          </Link>
        </section>
      </main>

      <Navigation />
    </div>
  );
};

export default Shop;
