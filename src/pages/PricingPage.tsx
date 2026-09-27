import React, { useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { Button } from '../components/ui/Button';
import { Check, Sparkles, Zap, Shield } from 'lucide-react';
import { SegmentedControl } from '../components/ui/SegmentedControl';

export const PricingPage: React.FC = () => {
  const { navigate, addToast } = useAppStore();
  const [cadence, setCadence] = useState<'MONTHLY' | 'ANNUAL'>('ANNUAL');

  const handleSelectPlan = (planName: string) => {
    addToast({
      type: 'info',
      title: `${planName} Selected`,
      message: 'Plan reservation recorded. Payment integration will connect in Phase 02.',
    });
    navigate('/app/create');
  };

  const plans = [
    {
      name: 'Free Exploration',
      subtitle: 'For individual creators experimenting with studio tools',
      priceMonthly: 0,
      priceAnnual: 0,
      badge: null,
      features: [
        '50 standard synthesis credits / month',
        'Standard 1080p still image rendering',
        '4-second video sequence preview',
        'Single active project workspace',
        'Community Discord access',
      ],
      buttonText: 'Current Plan',
      buttonVariant: 'outline' as const,
    },
    {
      name: 'Creator Pro',
      subtitle: 'For directors, designers, and visual artists shipping work',
      priceMonthly: 39,
      priceAnnual: 32,
      badge: 'MOST POPULAR',
      features: [
        '1,000 high-priority synthesis credits / month',
        'Native 4K Ultra HD image exports',
        'Full 16-second continuous video sequences',
        'Full 6-axis camera vector direct controls',
        'Unlimited production projects & library storage',
        'Commercial usage license for all outputs',
      ],
      buttonText: 'Upgrade to Pro',
      buttonVariant: 'primary' as const,
    },
    {
      name: 'Studio Enterprise',
      subtitle: 'For visual production agencies and creative film studios',
      priceMonthly: 129,
      priceAnnual: 99,
      badge: 'STUDIO GRADE',
      features: [
        '5,000 master-grade compute credits / month',
        'Dedicated GPU pipeline queue (zero wait)',
        'Uncompressed master ProRes & PNG exports',
        'Collaborative team workspaces & shared libraries',
        'Custom fine-tuned aesthetic style models',
        '24/7 Priority support & API access in Phase 02',
      ],
      buttonText: 'Contact Studio Team',
      buttonVariant: 'secondary' as const,
    },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 md:px-8 py-16 flex flex-col gap-12">
      {/* Header */}
      <div className="flex flex-col items-center text-center max-w-2xl mx-auto">
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
          Transparent Pricing
        </span>
        <h1 className="text-4xl sm:text-5xl font-display font-extrabold text-white mt-2 tracking-tight">
          Invest in master-quality creative tools
        </h1>
        <p className="text-sm text-slate-400 mt-3 leading-relaxed">
          Simple credit allotments with clear resolution limits and camera direct features.
        </p>

        {/* Cadence switch */}
        <div className="mt-6 flex items-center gap-3">
          <SegmentedControl
            value={cadence}
            onChange={setCadence}
            options={[
              { value: 'MONTHLY', label: 'Billed Monthly' },
              { value: 'ANNUAL', label: 'Annual (Save 20%)' },
            ]}
          />
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {plans.map((plan) => {
          const price = cadence === 'ANNUAL' ? plan.priceAnnual : plan.priceMonthly;

          return (
            <div
              key={plan.name}
              className={`relative flex flex-col justify-between p-6 sm:p-8 rounded-3xl bg-[#0F121C] border transition-all ${
                plan.badge === 'MOST POPULAR'
                  ? 'border-amber-500/40 bg-gradient-to-b from-[#161A28] to-[#0F121C] shadow-2xl shadow-amber-500/10'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] tracking-wider uppercase">
                  {plan.badge}
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <p className="text-xs text-slate-400 mt-1 min-h-[32px]">{plan.subtitle}</p>

                <div className="flex items-baseline gap-1 my-6">
                  <span className="font-display font-extrabold text-4xl text-white font-mono-numbers">
                    ${price}
                  </span>
                  <span className="text-xs text-slate-400">/ user / month</span>
                </div>

                <div className="flex flex-col gap-2.5 pt-4 border-t border-white/10">
                  <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                    Included Capabilities
                  </span>
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8">
                <Button
                  variant={plan.buttonVariant}
                  size="md"
                  onClick={() => handleSelectPlan(plan.name)}
                  className="w-full"
                >
                  {plan.buttonText}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
