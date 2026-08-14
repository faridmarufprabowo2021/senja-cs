"use client";

import { SmoothScroll } from "@/components/smooth-scroll";
import { LandingAnalyticsPreview } from "./analytics-preview";
import { LandingBentoFeatures } from "./bento-features";
import { LandingCtaFooter } from "./cta-footer";
import { LandingEngineComparison } from "./engine-comparison";
import { LandingFaqSection } from "./faq-section";
import { LandingHeader } from "./header";
import { LandingHero } from "./hero";
import { LandingLiveSandbox } from "./live-sandbox";
import { LandingPricingSection } from "./pricing-section";
import { LandingUseCases } from "./use-cases";
import { LandingWorkflowSection } from "./workflow-section";

export function LandingPage() {
  return (
    <SmoothScroll>
      <div className="min-h-screen bg-[#faf9f6] font-sans text-slate-900 selection:bg-teal-500 selection:text-white">
        <LandingHeader />
        <LandingHero />
        <LandingBentoFeatures />
        <LandingEngineComparison />
        <LandingUseCases />
        <LandingAnalyticsPreview />
        <LandingWorkflowSection />
        <LandingLiveSandbox />
        <LandingPricingSection />
        <LandingFaqSection />
        <LandingCtaFooter />
      </div>
    </SmoothScroll>
  );
}
