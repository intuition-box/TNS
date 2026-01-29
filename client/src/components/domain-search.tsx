import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isValidDomainName, normalizeDomainName, formatPrice } from "@/lib/pricing";

interface DomainSearchResult {
  name: string;
  available: boolean;
  pricing: {
    pricePerYear: string;
    tier: string;
  };
  suggestions: string[];
}

interface DomainSearchProps {
  onDomainSelect?: (domain: string, pricing: any) => void;
  autoFocus?: boolean;
  placeholder?: string;
}

export function DomainSearch({ onDomainSelect, autoFocus = false, placeholder = "Search for your .trust domain" }: DomainSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Get backend data (which checks blockchain for availability)
  const { data: searchResult, isLoading } = useQuery<DomainSearchResult>({
    queryKey: ["/api/domains/search", searchTerm],
    enabled: !!searchTerm && isValidDomainName(searchTerm),
    refetchOnWindowFocus: false,
    staleTime: 5000, // Cache for 5 seconds
  });

  const error = null;

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    
    const normalized = normalizeDomainName(searchQuery.trim());
    const domainName = normalized.replace('.trust', '');
    
    if (isValidDomainName(domainName)) {
      setSearchTerm(domainName);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleDomainSelect = (domain: string, pricing: any) => {
    if (onDomainSelect) {
      onDomainSelect(domain, pricing);
    }
  };

  const isValidSearch = searchQuery.trim() && isValidDomainName(searchQuery.trim());

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Search Input */}
      <div className="relative mb-4 sm:mb-6">
        <div className="flex">
          <Input
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            autoFocus={autoFocus}
            className="trust-input flex-1 text-base sm:text-lg py-3 sm:py-4 pr-16 sm:pr-20 rounded-r-none min-h-[48px]"
            data-testid="domain-search-input"
          />
          <div className="flex items-center px-2 sm:px-4 border-t border-b border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-medium text-sm sm:text-base">
            .trust
          </div>
          <Button
            onClick={handleSearch}
            disabled={!isValidSearch || isLoading}
            className="trust-button text-sm sm:text-lg px-4 sm:px-8 py-3 sm:py-4 rounded-l-none min-h-[48px]"
            data-testid="search-button"
          >
            <Search className="mr-1 sm:mr-2 h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">{isLoading ? "Searching..." : "Search"}</span>
            <span className="inline sm:hidden">{isLoading ? "..." : ""}</span>
          </Button>
        </div>

        {/* Validation Error */}
        {searchQuery && !isValidDomainName(searchQuery.trim()) && (
          <div className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
            <AlertCircle className="mr-1 h-4 w-4" />
            Domain name must be 3-64 characters, lowercase letters, numbers, and hyphens only
          </div>
        )}
      </div>

      {/* Search Results */}
      {error && (
        <Card className="trust-card border-red-200 dark:border-red-800">
          <CardContent className="p-6">
            <div className="flex items-center text-red-600 dark:text-red-400">
              <XCircle className="mr-3 h-5 w-5" />
              <span>Failed to search domain. Please try again.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card className="trust-card">
          <CardContent className="p-6">
            <div className="flex items-center text-gray-600 dark:text-gray-400">
              <Clock className="mr-3 h-5 w-5 animate-spin" />
              <span>Searching for domain availability...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {searchResult && (
        <div className="space-y-3 sm:space-y-4">
          {/* Main Result */}
          <Card className="trust-card">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center">
                  {searchResult.available ? (
                    <CheckCircle className="text-trust-emerald h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3 flex-shrink-0" />
                  ) : (
                    <XCircle className="text-red-500 h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3 flex-shrink-0" />
                  )}
                  <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
                    <span className="font-bold text-base sm:text-lg" data-testid="domain-name">
                      {searchResult.name}
                    </span>
                    <Badge
                      variant={searchResult.available ? "default" : "destructive"}
                      className={`text-xs ${
                        searchResult.available
                          ? "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300"
                          : ""
                      }`}
                      data-testid="availability-status"
                    >
                      {searchResult.available ? "Available" : "Taken"}
                    </Badge>
                  </div>
                </div>
                
                {searchResult.available && (
                  <div className="text-left sm:text-right pl-7 sm:pl-0">
                    <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white" data-testid="domain-price">
                      {formatPrice(searchResult.pricing.pricePerYear)}
                      <span className="text-xs sm:text-sm text-gray-500 ml-1">/year</span>
                    </div>
                    <div className="text-xs sm:text-sm text-gray-500" data-testid="pricing-tier">
                      {searchResult.pricing.tier}
                    </div>
                  </div>
                )}
              </div>
              
              {searchResult.available && (
                <Button
                  onClick={() => handleDomainSelect(searchResult.name, searchResult.pricing)}
                  className="w-full mt-4 trust-button min-h-[44px]"
                  data-testid="register-domain-button"
                >
                  Register Domain
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Suggestions */}
          {searchResult.suggestions && searchResult.suggestions.length > 0 && (
            <Card className="trust-card">
              <CardContent className="p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Alternative Suggestions</h3>
                <div className="space-y-2 sm:space-y-3">
                  {searchResult.suggestions.map((suggestion) => (
                    <div
                      key={suggestion}
                      className="flex items-center justify-between p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded-lg gap-2"
                    >
                      <div className="flex items-center min-w-0 flex-1">
                        <CheckCircle className="text-trust-emerald mr-2 sm:mr-3 h-4 w-4 flex-shrink-0" />
                        <span className="font-medium text-sm sm:text-base truncate" data-testid={`suggestion-${suggestion}`}>
                          {suggestion}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] flex-shrink-0"
                        onClick={() => {
                          setSearchQuery(suggestion.replace('.trust', ''));
                          setSearchTerm(suggestion.replace('.trust', ''));
                        }}
                        data-testid={`search-suggestion-${suggestion}`}
                      >
                        Search
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
