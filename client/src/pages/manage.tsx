import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Wallet,
  Search,
  Grid,
  List,
  Filter,
  Calendar,
  Globe,
  TrendingUp,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { WalletConnection } from "@/components/wallet-connection";
import { DomainCard } from "@/components/domain-card";
import { useWallet } from "@/hooks/use-wallet";
import { Link } from "wouter";
import { web3Service } from "@/lib/web3";
import { TNS_BASE_REGISTRAR_ADDRESS } from "@/lib/contracts";
import type { DomainWithRecords } from "@shared/schema";

type ViewMode = "grid" | "list";
type FilterOption = "all" | "active" | "expiring" | "expired";
type SortOption = "name" | "expiry" | "price";

export default function ManagePage() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filterOption, setFilterOption] = useState<FilterOption>("all");
  const [sortOption, setSortOption] = useState<SortOption>("name");
  const [searchQuery, setSearchQuery] = useState("");

  const { isConnected, address, isCorrectNetwork } = useWallet();

  // Fetch user's domains - uses backend API which has domain data from both legacy and ENS migrations
  // The backend stores domain data during registration and migration, so it has all domain names mapped
  const { 
    data: blockchainDomains, 
    isLoading: isLoadingDomains, 
    error: domainsError 
  } = useQuery<DomainWithRecords[]>({
    queryKey: ["blockchain-domains", address],
    queryFn: async () => {
      if (!address) return [];
      console.log("Fetching domains for:", address);
      
      // Primary: Use backend API which stores domain data from registrations
      // This includes both ENS-style registrations and migrated legacy domains
      try {
        const response = await fetch(`/api/domains/owner/${address}`);
        if (response.ok) {
          const data = await response.json();
          if (data.domains && data.domains.length > 0) {
            console.log("Got domains from backend API:", data.domains.length);
            return data.domains;
          }
        }
      } catch (e) {
        console.log("Backend API fallback to ENS registrar");
      }
      
      // Fallback: Query ENS BaseRegistrar for on-chain verification
      try {
        const ensDomains = await web3Service.getOwnerDomainsENS(TNS_BASE_REGISTRAR_ADDRESS, address);
        console.log("Got domains from ENS registrar:", ensDomains.length);
        return ensDomains;
      } catch (e) {
        console.log("Error getting domains from ENS registrar:", e);
        return [];
      }
    },
    enabled: isConnected && isCorrectNetwork && !!address,
    refetchOnWindowFocus: false,
    refetchInterval: 30000, // Refresh every 30 seconds to get latest blockchain data
  });

  // Fetch subdomains from backend for each domain
  const { data: subdomainsData } = useQuery({
    queryKey: ["subdomains", address, blockchainDomains?.map(d => d.id).join(',')],
    queryFn: async () => {
      if (!blockchainDomains || blockchainDomains.length === 0) return {};
      
      const subdomainsByDomain: Record<string, any[]> = {};
      
      // Fetch subdomains for each domain
      await Promise.all(
        blockchainDomains.map(async (domain) => {
          try {
            const response = await fetch(`/api/domains/${domain.name.replace('.trust', '')}/subdomains`);
            if (response.ok) {
              const data = await response.json();
              subdomainsByDomain[domain.id] = data;
            } else {
              subdomainsByDomain[domain.id] = [];
            }
          } catch (error) {
            console.error(`Error fetching subdomains for ${domain.name}:`, error);
            subdomainsByDomain[domain.id] = [];
          }
        })
      );
      
      return subdomainsByDomain;
    },
    enabled: !!blockchainDomains && blockchainDomains.length > 0,
  });

  // Merge blockchain domains with subdomains
  const domains = blockchainDomains?.map(domain => ({
    ...domain,
    subdomains: subdomainsData?.[domain.id] || []
  }));

  // Filter and sort domains
  const filteredAndSortedDomains = domains ? domains.filter((domain) => {
    // Search filter
    if (searchQuery && !domain.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Status filter
    const now = new Date();
    const expiryDate = new Date(domain.expirationDate);
    const isExpired = expiryDate < now;
    const isExpiringSoon = expiryDate < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    switch (filterOption) {
      case "active":
        return !isExpired && !isExpiringSoon;
      case "expiring":
        return isExpiringSoon && !isExpired;
      case "expired":
        return isExpired;
      default:
        return true;
    }
  }).sort((a, b) => {
    switch (sortOption) {
      case "name":
        return a.name.localeCompare(b.name);
      case "expiry":
        return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
      case "price":
        return parseFloat(a.pricePerYear) - parseFloat(b.pricePerYear);
      default:
        return 0;
    }
  }) : [];

  const getStatusCounts = () => {
    if (!domains) return { total: 0, active: 0, expiring: 0, expired: 0 };

    const now = new Date();
    const counts = { total: domains.length, active: 0, expiring: 0, expired: 0 };

    domains.forEach((domain) => {
      const expiryDate = new Date(domain.expirationDate);
      const isExpired = expiryDate < now;
      const isExpiringSoon = expiryDate < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      if (isExpired) {
        counts.expired++;
      } else if (isExpiringSoon) {
        counts.expiring++;
      } else {
        counts.active++;
      }
    });

    return counts;
  };

  const statusCounts = getStatusCounts();

  if (!isConnected || !isCorrectNetwork) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-trust-dark">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
              Manage Your Domains
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 px-4">
              Connect your wallet to view and manage your TNS domains
            </p>
          </div>
          <WalletConnection onConnected={() => {}} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-trust-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 sm:mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
              My Domains
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
              Manage your TNS domains, records, and subdomains
            </p>
            {domains && domains.find(d => d.isPrimary) && (
              <div className="mt-3 flex items-center space-x-2 flex-wrap">
                <Badge className="bg-trust-violet text-white text-xs sm:text-sm px-2 sm:px-3 py-1" data-testid="primary-domain-badge">
                  Primary Domain
                </Badge>
                <span className="text-base sm:text-lg font-semibold text-trust-blue dark:text-trust-blue" data-testid="primary-domain-name">
                  {domains.find(d => d.isPrimary)?.name}
                </span>
              </div>
            )}
          </div>
          <div className="mt-4 lg:mt-0">
            <Link href="/search">
              <Button className="trust-button w-full sm:w-auto min-h-[44px]" data-testid="register-new-domain">
                <Plus className="mr-2 h-4 w-4" />
                Register New Domain
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Card className="trust-card">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <Globe className="h-6 w-6 sm:h-8 sm:w-8 text-trust-blue mr-2 sm:mr-3 flex-shrink-0" />
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white" data-testid="total-domains">
                    {statusCounts.total}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500">Total</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="trust-card">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full"></div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white" data-testid="active-domains">
                    {statusCounts.active}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500">Active</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="trust-card">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-amber-100 dark:bg-amber-900/20 rounded-lg flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                  <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600" />
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white" data-testid="expiring-domains">
                    {statusCounts.expiring}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500">Expiring</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="trust-card">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-red-600" />
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white" data-testid="expired-domains">
                    {statusCounts.expired}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500">Expired</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Controls */}
        <Card className="trust-card mb-6">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col space-y-3 sm:space-y-4">
              {/* Search */}
              <div className="w-full">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search domains..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11"
                    data-testid="domain-search-filter"
                  />
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-2 sm:gap-4">
                <Select value={filterOption} onValueChange={(value: FilterOption) => setFilterOption(value)}>
                  <SelectTrigger className="flex-1 min-w-[120px] h-11" data-testid="status-filter">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All ({statusCounts.total})</SelectItem>
                    <SelectItem value="active">Active ({statusCounts.active})</SelectItem>
                    <SelectItem value="expiring">Expiring ({statusCounts.expiring})</SelectItem>
                    <SelectItem value="expired">Expired ({statusCounts.expired})</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortOption} onValueChange={(value: SortOption) => setSortOption(value)}>
                  <SelectTrigger className="flex-1 min-w-[120px] h-11" data-testid="sort-filter">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="expiry">Expiry Date</SelectItem>
                    <SelectItem value="price">Price</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg h-11">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="rounded-r-none h-full px-4"
                    data-testid="grid-view"
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="rounded-l-none h-full px-4"
                    data-testid="list-view"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        {isLoadingDomains ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-trust-blue mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading your domains...</p>
          </div>
        ) : domainsError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load domains. Please check your connection and try again.
            </AlertDescription>
          </Alert>
        ) : filteredAndSortedDomains.length === 0 ? (
          <Card className="trust-card">
            <CardContent className="p-12 text-center">
              <Globe className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              {domains && domains.length === 0 ? (
                <>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    No domains registered
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    You haven't registered any .trust domains yet. Get started by registering your first domain!
                  </p>
                  <Link href="/search">
                    <Button className="trust-button" data-testid="register-first-domain">
                      <Plus className="mr-2 h-4 w-4" />
                      Register Your First Domain
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    No domains match your filters
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Try adjusting your search or filter criteria to see your domains.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid md:grid-cols-2 xl:grid-cols-3 gap-6"
                : "space-y-4"
            }
          >
            {filteredAndSortedDomains.map((domain, index) => (
              <DomainCard
                key={domain.tokenId || index}
                domain={domain}
                walletAddress={address!}
              />
            ))}
          </div>
        )}

        {/* Expiring Domains Alert */}
        {statusCounts.expiring > 0 && (
          <Alert className="mt-8 border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You have {statusCounts.expiring} domain{statusCounts.expiring > 1 ? 's' : ''} expiring soon. 
              Renew them to keep ownership.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
