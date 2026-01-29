import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { formatPrice } from "@/lib/pricing";

interface PricingTier {
  characters: string;
  pricePerYear: string;
  description: string;
  examples: string[];
  features: string[];
  isPopular?: boolean;
}

interface PricingCardProps {
  tier: PricingTier;
  onSelect?: () => void;
}

export function PricingCard({ tier, onSelect }: PricingCardProps) {
  return (
    <Card
      className={`relative transition-all duration-200 sm:hover:scale-105 ${
        tier.isPopular
          ? "bg-gradient-to-br from-trust-blue to-trust-violet text-white border-trust-blue"
          : "trust-card hover:border-trust-blue"
      }`}
    >
      {tier.isPopular && (
        <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-white/20 backdrop-blur-sm text-white text-xs">
          Premium
        </Badge>
      )}
      
      <CardContent className="p-5 sm:p-8 text-center">
        <div className="mb-4 sm:mb-6">
          <div
            className={`text-3xl sm:text-4xl font-bold mb-2 ${
              tier.isPopular ? "text-white" : "text-trust-blue"
            }`}
            data-testid={`price-${tier.characters}-chars`}
          >
            {formatPrice(tier.pricePerYear).split(' ')[0]}
          </div>
          <div
            className={`mb-4 ${
              tier.isPopular ? "text-blue-100" : "text-gray-600 dark:text-gray-400"
            }`}
          >
            TRUST/year
          </div>
          <div
            className={`text-lg font-semibold mb-2 ${
              tier.isPopular ? "text-white" : "text-gray-900 dark:text-white"
            }`}
            data-testid={`tier-${tier.characters}-chars`}
          >
            {tier.description}
          </div>
          <div
            className={`text-sm mb-6 ${
              tier.isPopular ? "text-blue-100" : "text-gray-500 dark:text-gray-400"
            }`}
          >
            e.g., {tier.examples.join(", ")}
          </div>
        </div>

        <div className="space-y-2 sm:space-y-3 text-left mb-6 sm:mb-8">
          {tier.features.map((feature, index) => (
            <div key={index} className="flex items-center">
              <Check
                className={`mr-2 sm:mr-3 h-4 w-4 flex-shrink-0 ${
                  tier.isPopular ? "text-white" : "text-trust-emerald"
                }`}
              />
              <span
                className={`text-xs sm:text-sm ${
                  tier.isPopular ? "text-white" : "text-gray-700 dark:text-gray-300"
                }`}
              >
                {feature}
              </span>
            </div>
          ))}
        </div>

        {onSelect && (
          <Button
            onClick={onSelect}
            className={`min-h-[44px] ${
              tier.isPopular
                ? "w-full bg-white text-trust-blue hover:bg-gray-100"
                : "w-full trust-button"
            }`}
            data-testid={`select-tier-${tier.characters}-chars`}
          >
            Choose Plan
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function PricingSection() {
  const pricingTiers: PricingTier[] = [
    {
      characters: "5+",
      pricePerYear: "30",
      description: "5+ Characters",
      examples: ["alice.trust", "company.trust"],
      features: [
        "Full ownership control",
        "Subdomain creation",
        "Multi-resource records",
        "NFT ownership",
      ],
    },
    {
      characters: "4",
      pricePerYear: "70",
      description: "4 Characters",
      examples: ["tech.trust", "city.trust"],
      features: [
        "Everything in 5+ chars",
        "Premium visibility",
        "Higher resale value",
        "Brand recognition",
      ],
      isPopular: true,
    },
    {
      characters: "3",
      pricePerYear: "100",
      description: "3 Characters",
      examples: ["web.trust", "nft.trust"],
      features: [
        "Ultra-premium domain",
        "Maximum brandability",
        "Investment grade",
        "Collector status",
      ],
    },
  ];

  return (
    <section className="py-12 sm:py-20 bg-white dark:bg-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Simple & Transparent Pricing
          </h2>
          <p className="text-base sm:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4">
            Domain pricing based on character length, with all fees paid in TRUST tokens
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 max-w-4xl mx-auto">
          {pricingTiers.map((tier) => (
            <PricingCard key={tier.characters} tier={tier} />
          ))}
        </div>

        <div className="text-center mt-8 sm:mt-12">
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 px-4">
            All registrations include a 1-year minimum term. Renewals at the same rate.
          </p>
        </div>
      </div>
    </section>
  );
}
