import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Users, Activity } from "lucide-react";
import { useContractStats } from "@/hooks/use-contract-stats";

export function ContractStats() {
  const { data: stats, isLoading, error } = useContractStats();

  if (error) {
    return (
      <Card className="trust-card">
        <CardHeader>
          <CardTitle className="flex items-center text-red-600 dark:text-red-400">
            <Activity className="mr-2 h-5 w-5" />
            Network Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Unable to load real-time stats</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 max-w-3xl mx-auto">
      {/* Total Domains */}
      <Card className="trust-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">Total NFTs</CardTitle>
          <Globe className="h-4 w-4 text-trust-blue" />
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
          <div className="text-xl sm:text-2xl font-bold">
            {isLoading ? (
              <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-6 w-16 rounded"></div>
            ) : (
              stats?.totalDomains.toLocaleString() || "0"
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="block sm:inline">Domain NFTs minted</span>
            <Badge variant="secondary" className="mt-1 ml-0 sm:ml-2">
              <Activity className="mr-1 h-3 w-3" />
              Live
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Active Users */}
      <Card className="trust-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">NFT Holders</CardTitle>
          <Users className="h-4 w-4 text-trust-violet" />
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
          <div className="text-xl sm:text-2xl font-bold">
            {isLoading ? (
              <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-6 w-16 rounded"></div>
            ) : (
              stats?.activeUsers.toLocaleString() || "0"
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="block sm:inline">Unique domain owners</span>
            <Badge variant="secondary" className="mt-1 ml-0 sm:ml-2">
              <Activity className="mr-1 h-3 w-3" />
              Live
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}