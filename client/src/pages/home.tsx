import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DomainSearch } from "@/components/domain-search";
import { PricingSection } from "@/components/pricing-card";
import { ContractStats } from "@/components/contract-stats";
import { Shield, Coins, Award, ArrowRight, Zap, Users, Globe } from "lucide-react";

export default function Home() {
  const [selectedDomain, setSelectedDomain] = useState<{ name: string; pricing: any } | null>(null);

  const handleDomainSelect = (domain: string, pricing: any) => {
    setSelectedDomain({ name: domain, pricing });
  };

  const features = [
    {
      icon: Shield,
      title: "Decentralized & Secure",
      description: "Powered by Intuition blockchain smart contracts",
      color: "text-trust-blue",
      bgColor: "bg-trust-blue/10",
    },
    {
      icon: Coins,
      title: "Affordable Pricing",
      description: "Starting from 30 TRUST per year",
      color: "text-trust-violet",
      bgColor: "bg-trust-violet/10",
    },
    {
      icon: Award,
      title: "NFT Ownership",
      description: "Your domain is an ERC-721 NFT you truly own",
      color: "text-trust-emerald",
      bgColor: "bg-trust-emerald/10",
    },
  ];

  const howItWorksSteps = [
    {
      step: 1,
      title: "Search & Commit",
      description: "Search for available domains and submit a commit transaction to reserve your choice securely.",
      color: "bg-trust-blue",
    },
    {
      step: 2,
      title: "Wait & Reveal",
      description: "After a 1-minute security delay, reveal your commitment and complete the registration process.",
      color: "bg-trust-violet",
    },
    {
      step: 3,
      title: "Own & Manage",
      description: "Your domain becomes an NFT in your wallet. Set addresses, create subdomains, and transfer ownership freely.",
      color: "bg-trust-emerald",
    },
  ];

  // Remove static stats - now using real-time ContractStats component

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-12 sm:py-20 lg:py-32">
        {/* Background */}
        <div className="absolute inset-0 hero-gradient"></div>
        <div className="absolute inset-0 pattern-dots opacity-30"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
              Your{" "}
              <span className="bg-gradient-to-r from-trust-blue to-trust-violet bg-clip-text text-transparent">
                Web3 Identity
              </span>
              <br />
              Starts with{" "}
              <span className="text-trust-blue">.trust</span>
            </h1>
            <p className="text-base sm:text-xl text-gray-600 dark:text-gray-300 mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed px-4">
              Trust Name Service (TNS) provides decentralized, human-readable names for your crypto addresses 
              on Intuition blockchain. Own your digital identity with .trust domains.
            </p>

            {/* Domain Search */}
            <div className="mb-12 sm:mb-16 px-2">
              <DomainSearch onDomainSelect={handleDomainSelect} autoFocus />
              
              {selectedDomain && (
                <div className="mt-6 flex justify-center">
                  <Link href={`/register?domain=${encodeURIComponent(selectedDomain.name)}`}>
                    <Button className="trust-button text-base sm:text-lg px-6 sm:px-8 py-3 min-h-[44px]" data-testid="proceed-to-register">
                      Register {selectedDomain.name} <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Key Features */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-4xl mx-auto px-4">
              {features.map((feature, index) => (
                <div key={index} className="text-center">
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 ${feature.bgColor} rounded-xl flex items-center justify-center mx-auto mb-3 sm:mb-4`}>
                    <feature.icon className={`${feature.color} h-7 w-7 sm:h-8 sm:w-8`} />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold mb-2" data-testid={`feature-${index}`}>
                    {feature.title}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Real-time Statistics Section */}
      <section className="py-12 sm:py-16 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
              Live Network Statistics
            </h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 px-4">
              Real-time data from the TNS blockchain registry
            </p>
          </div>
          <ContractStats />
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />

      {/* How It Works Section */}
      <section className="py-12 sm:py-20 bg-gray-50 dark:bg-trust-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
              How TNS Works
            </h2>
            <p className="text-base sm:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4">
              Built on proven ENS architecture with commit-reveal security and ERC-721 ownership
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center mb-12 sm:mb-20">
            <div className="space-y-6 sm:space-y-8">
              {howItWorksSteps.map((item) => (
                <div key={item.step} className="flex items-start">
                  <div className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 ${item.color} rounded-xl flex items-center justify-center mr-4 sm:mr-6`}>
                    <span className="text-white font-bold text-sm sm:text-base">{item.step}</span>
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">
                      {item.title}
                    </h3>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <Card className="trust-card">
              <CardContent className="p-6 sm:p-8">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">
                  Domain Architecture
                </h3>
                <div className="space-y-3 sm:space-y-4">
                  <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <div className="flex items-center mb-2">
                      <Globe className="text-trust-blue mr-2 sm:mr-3 h-5 w-5 flex-shrink-0" />
                      <span className="font-semibold text-sm sm:text-base">Registry Contract</span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      Maintains domain ownership and resolver mappings
                    </p>
                  </div>
                  
                  <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <div className="flex items-center mb-2">
                      <Shield className="text-trust-violet mr-2 sm:mr-3 h-5 w-5 flex-shrink-0" />
                      <span className="font-semibold text-sm sm:text-base">Resolver Contract</span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      Translates domains to addresses and resource records
                    </p>
                  </div>
                  
                  <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <div className="flex items-center mb-2">
                      <Award className="text-trust-emerald mr-2 sm:mr-3 h-5 w-5 flex-shrink-0" />
                      <span className="font-semibold text-sm sm:text-base">Registrar Contract</span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      Handles registration, pricing, and renewals
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Network Information */}
          <Card className="trust-card">
            <CardContent className="p-4 sm:p-8">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6 text-center">
                Network Information
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <div className="text-center">
                  <div className="text-trust-blue font-semibold mb-1 text-sm sm:text-base">Chain ID</div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white" data-testid="chain-id">
                    1155
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-trust-blue font-semibold mb-1 text-sm sm:text-base">Network</div>
                  <div className="text-sm sm:text-lg font-bold text-gray-900 dark:text-white">
                    Intuition Mainnet
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-trust-blue font-semibold mb-1 text-sm sm:text-base">Currency</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    TRUST
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-trust-blue font-semibold mb-1 text-sm sm:text-base">RPC URL</div>
                  <div className="text-xs sm:text-sm font-mono text-gray-600 dark:text-gray-400 break-all">
                    intuition.calderachain.xyz
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-12 sm:py-20 bg-trust-dark text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">
            Ready to Get Your .trust Domain?
          </h2>
          <p className="text-base sm:text-xl text-gray-300 mb-6 sm:mb-8 px-2">
            Join thousands of users who trust TNS for their Web3 identity
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
            <Link href="/register" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto bg-white text-trust-dark hover:bg-gray-100 px-6 sm:px-8 py-3 text-base sm:text-lg min-h-[48px]" data-testid="cta-register">
                Register Domain
              </Button>
            </Link>
            <Link href="/manage" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto border-white text-white hover:bg-white hover:text-trust-dark px-6 sm:px-8 py-3 text-base sm:text-lg min-h-[48px]" data-testid="cta-manage">
                Manage Domains
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
