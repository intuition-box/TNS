import { ethers } from "ethers";

// Intuition mainnet configuration
const CHAIN_ID = 1155;
const RPC_URL = "https://intuition.calderachain.xyz";

// ============================================
// ENS-FORKED CONTRACT ADDRESSES (DEPLOYED ON INTUITION MAINNET)
// ============================================
const TNS_REGISTRY_ADDRESS_NEW = "0x34D7648aecc10fd86A53Cdd2436125342f3d7412";
const TNS_BASE_REGISTRAR_ADDRESS = "0xc08c5b051a9cFbcd81584Ebb8870ed77eFc5E676";
const TNS_CONTROLLER_ADDRESS = "0x57C93D875c3D4C8e377DAE5aA7EA06d35C84d044";
const TNS_RESOLVER_ADDRESS_NEW = "0x17Adb57047EDe9eBA93A5855f8578A8E512592C5";
const TNS_REVERSE_REGISTRAR_ADDRESS = "0x5140b65d566DA2d1298fCFE75eA972850bC2E365";
const TNS_PRICE_ORACLE_ADDRESS = "0xeFD11f62A66F39fE5C2A7e43f281FAbaFceed303";
const TNS_PAYMENT_FORWARDER_ADDRESS_NEW = "0xB0e22123Ac142e57F56Bc9fEf2077bB2Fa1141a0";
const TRUST_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000"; // Native token (like ETH)

// Intuition EthMultiVault (Knowledge Graph) for creating atoms
// Proxy contract (TransparentUpgradeableProxy) on Intuition mainnet (Chain ID: 1155)
export const INTUITION_MULTIVAULT_ADDRESS = "0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e";
// Implementation (MultiVault): 0xc6f28A5fFe30eee3fadE5080B8930C58187F4903

// ENS-forked contract ABIs
const TNS_REGISTRY_ABI_NEW = [
  "function owner(bytes32 node) view returns (address)",
  "function resolver(bytes32 node) view returns (address)",
  "function ttl(bytes32 node) view returns (uint64)",
  "function recordExists(bytes32 node) view returns (bool)"
];

const TNS_BASE_REGISTRAR_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function nameExpires(uint256 id) view returns (uint256)",
  "function available(uint256 id) view returns (bool)",
  "function GRACE_PERIOD() view returns (uint256)",
  "function baseNode() view returns (bytes32)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "event NameRegistered(uint256 indexed id, address indexed owner, uint256 expires)",
  "event NameRenewed(uint256 indexed id, uint256 expires)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

const TNS_CONTROLLER_ABI = [
  "function available(string name) view returns (bool)",
  "function rentPrice(string name, uint256 duration) view returns (uint256)",
  "function commitments(bytes32) view returns (uint256)",
  "function MIN_COMMITMENT_AGE() view returns (uint256)",
  "function MAX_COMMITMENT_AGE() view returns (uint256)",
  "function MIN_REGISTRATION_DURATION() view returns (uint256)",
  "event NameRegistered(string name, bytes32 indexed label, address indexed owner, uint256 baseCost, uint256 premium, uint256 expires)"
];

const TNS_RESOLVER_ABI_NEW = [
  "function addr(bytes32 node) view returns (address)",
  "function text(bytes32 node, string key) view returns (string)",
  "function contenthash(bytes32 node) view returns (bytes)",
  "function name(bytes32 node) view returns (string)"
];

const TNS_REVERSE_REGISTRAR_ABI = [
  "function node(address addr) pure returns (bytes32)",
  "function defaultResolver() view returns (address)"
];

const TNS_PRICE_ORACLE_ABI = [
  "function price(string name, uint256 duration) view returns (uint256)",
  "function price3Char() view returns (uint256)",
  "function price4Char() view returns (uint256)",
  "function price5PlusChar() view returns (uint256)"
];

// Intuition EthMultiVault ABI for atom creation (v1.5 mainnet on Chain 1155)
// The contract uses createAtoms (plural, with curve) instead of createAtom (singular)
export const INTUITION_MULTIVAULT_ABI = [
  "function createAtoms(bytes[] atomUris, uint256[] curveIds) payable returns (uint256[])",
  "function createTriple(uint256 subjectId, uint256 predicateId, uint256 objectId) payable returns (uint256)",
  "function atomsByHash(bytes32) view returns (uint256)",
  "function atoms(uint256) view returns (bytes)",
  "function count() view returns (uint256)",
  "function atomConfig() view returns (uint256 atomWalletInitialDepositAmount, uint256 atomCreationProtocolFee)",
  "function generalConfig() view returns (address admin, address protocolMultisig, uint256 feeDenominator, uint256 minDeposit, uint256 minShare, uint256 atomUriMaxLength, uint256 decimalPrecision, uint256 minDelay)",
  "function vaults(uint256) view returns (uint256 totalAssets, uint256 totalShares)",
  "function getAtomCost() view returns (uint256)",
  "function paused() view returns (bool)"
];

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private multivaultContract: ethers.Contract;
  
  // ENS-forked contracts
  private registry: ethers.Contract;
  private baseRegistrar: ethers.Contract;
  private controller: ethers.Contract;
  private resolver: ethers.Contract;
  private reverseRegistrar: ethers.Contract;
  private priceOracle: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    
    this.multivaultContract = new ethers.Contract(
      INTUITION_MULTIVAULT_ADDRESS,
      INTUITION_MULTIVAULT_ABI,
      this.provider
    );

    // Initialize ENS-forked contracts
    this.registry = new ethers.Contract(TNS_REGISTRY_ADDRESS_NEW, TNS_REGISTRY_ABI_NEW, this.provider);
    this.baseRegistrar = new ethers.Contract(TNS_BASE_REGISTRAR_ADDRESS, TNS_BASE_REGISTRAR_ABI, this.provider);
    this.controller = new ethers.Contract(TNS_CONTROLLER_ADDRESS, TNS_CONTROLLER_ABI, this.provider);
    this.resolver = new ethers.Contract(TNS_RESOLVER_ADDRESS_NEW, TNS_RESOLVER_ABI_NEW, this.provider);
    this.reverseRegistrar = new ethers.Contract(TNS_REVERSE_REGISTRAR_ADDRESS, TNS_REVERSE_REGISTRAR_ABI, this.provider);
    this.priceOracle = new ethers.Contract(TNS_PRICE_ORACLE_ADDRESS, TNS_PRICE_ORACLE_ABI, this.provider);
  }

  /**
   * Calculate namehash for a domain (ENS-style)
   */
  public namehash(domain: string): string {
    let node = ethers.ZeroHash;
    if (domain === "") return node;

    const labels = domain.split(".").reverse();
    for (const label of labels) {
      const labelHash = ethers.keccak256(ethers.toUtf8Bytes(label));
      node = ethers.keccak256(ethers.concat([node, labelHash]));
    }
    return node;
  }

  /**
   * Calculate labelhash for a single label
   */
  public labelhash(label: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(label));
  }

  /**
   * Load migration data to map old tokenIds to domain names
   */
  private async loadMigrationData(): Promise<Map<string, string>> {
    const mapping = new Map<string, string>();
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // Find the latest migration data file
      const scriptsDir = path.join(process.cwd(), 'scripts');
      const files = fs.readdirSync(scriptsDir).filter((f: string) => f.startsWith('migration-data-'));
      
      if (files.length === 0) {
        console.log("No migration data file found");
        return mapping;
      }
      
      const latestFile = files.sort().pop();
      const migrationPath = path.join(scriptsDir, latestFile!);
      const data = JSON.parse(fs.readFileSync(migrationPath, 'utf8'));
      
      // Map both old sequential tokenIds and labelhash-based tokenIds to domain names
      for (const domain of data.domains) {
        const cleanName = domain.name.replace(/\.trust$/, '');
        // Old sequential tokenId (for mint transfers)
        mapping.set(domain.tokenId.toString(), cleanName);
        // New labelhash-based tokenId
        const labelHash = this.labelhash(cleanName);
        const newTokenId = ethers.getBigInt(labelHash).toString();
        mapping.set(newTokenId, cleanName);
      }
      
      console.log(`Loaded migration data: ${mapping.size} mappings`);
    } catch (error) {
      console.error("Error loading migration data:", error);
    }
    return mapping;
  }

  /**
   * Get domain name from token ID using migration data
   */
  async getDomainNameByTokenId(tokenId: number): Promise<string | null> {
    try {
      const migrationData = await this.loadMigrationData();
      const tokenIdStr = tokenId.toString();
      
      // Check migration data first
      if (migrationData.has(tokenIdStr)) {
        return migrationData.get(tokenIdStr) || null;
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting domain name for token ${tokenId}:`, error);
      return null;
    }
  }

  /**
   * Get domain info from ENS-forked BaseRegistrar
   */
  async getDomainInfoENS(domainName: string): Promise<{
    owner: string;
    tokenId: bigint;
    expirationTime: bigint;
    exists: boolean;
  } | null> {
    try {
      const cleanName = domainName.replace(/\.trust$/, '');
      const labelHash = this.labelhash(cleanName);
      const tokenId = ethers.getBigInt(labelHash);
      
      // Check if domain exists in BaseRegistrar
      const [owner, expires] = await Promise.all([
        this.baseRegistrar.ownerOf(tokenId).catch(() => ethers.ZeroAddress),
        this.baseRegistrar.nameExpires(tokenId).catch(() => BigInt(0))
      ]);
      
      // Domain exists if owner is not zero address
      const exists = owner !== ethers.ZeroAddress;
      
      return {
        owner,
        tokenId,
        expirationTime: expires,
        exists
      };
    } catch (error) {
      console.error(`Error getting ENS domain info for ${domainName}:`, error);
      return null;
    }
  }

  /**
   * Get domain data directly from blockchain by token ID
   */
  async getDomainByTokenId(tokenId: number): Promise<{
    name: string;
    owner: string;
    expirationTime: Date;
    tokenId: string;
  } | null> {
    try {
      // First get the domain name from token ID
      const domainName = await this.getDomainNameByTokenId(tokenId);
      
      if (!domainName) {
        console.log(`No domain found for token ID ${tokenId}`);
        return null;
      }

      // Then get the full domain info
      const domainInfo = await this.getDomainInfoENS(domainName);
      
      if (!domainInfo || !domainInfo.exists) {
        console.log(`Domain ${domainName} does not exist`);
        return null;
      }

      return {
        name: domainName,
        owner: domainInfo.owner,
        expirationTime: new Date(Number(domainInfo.expirationTime) * 1000),
        tokenId: domainInfo.tokenId.toString()
      };
    } catch (error) {
      console.error(`Error getting domain by token ID ${tokenId}:`, error);
      return null;
    }
  }

  /**
   * Check if a domain is available for registration on the blockchain
   */
  async isAvailable(domainName: string): Promise<boolean> {
    try {
      const available = await this.controller.available(domainName);
      return available;
    } catch (error) {
      console.error(`Error checking availability for ${domainName}:`, error);
      return false;
    }
  }

  /**
   * Get rental price for a domain using ENS-forked controller
   */
  async getRentPrice(domainName: string, durationSeconds: number): Promise<bigint> {
    try {
      const price = await this.controller.rentPrice(domainName, durationSeconds);
      return price;
    } catch (error) {
      console.error(`Error getting rent price for ${domainName}:`, error);
      return BigInt(0);
    }
  }

  /**
   * Get domain owner using ENS-forked registry (namehash-based)
   */
  async getDomainOwnerENS(domainName: string): Promise<string | null> {
    try {
      const fullName = domainName.endsWith('.trust') ? domainName : `${domainName}.trust`;
      const node = this.namehash(fullName);
      const owner = await this.registry.owner(node);
      return owner === ethers.ZeroAddress ? null : owner;
    } catch (error) {
      console.error(`Error getting domain owner for ${domainName}:`, error);
      return null;
    }
  }

  /**
   * Get resolved address for a domain using ENS-forked resolver
   */
  async getResolvedAddress(domainName: string): Promise<string | null> {
    try {
      const fullName = domainName.endsWith('.trust') ? domainName : `${domainName}.trust`;
      const node = this.namehash(fullName);
      const addr = await this.resolver.addr(node);
      return addr === ethers.ZeroAddress ? null : addr;
    } catch (error) {
      console.error(`Error getting resolved address for ${domainName}:`, error);
      return null;
    }
  }

  /**
   * Get reverse resolved name for an address
   */
  async getReverseName(address: string): Promise<string | null> {
    try {
      const reverseNode = await this.reverseRegistrar.node(address);
      const name = await this.resolver.name(reverseNode);
      return name || null;
    } catch (error) {
      console.error(`Error getting reverse name for ${address}:`, error);
      return null;
    }
  }

  /**
   * Get domain expiration from base registrar (ENS-forked)
   */
  async getDomainExpiration(domainName: string): Promise<Date | null> {
    try {
      const labelHash = this.labelhash(domainName);
      const tokenId = ethers.getBigInt(labelHash);
      const expires = await this.baseRegistrar.nameExpires(tokenId);
      return new Date(Number(expires) * 1000);
    } catch (error) {
      console.error(`Error getting domain expiration for ${domainName}:`, error);
      return null;
    }
  }

  /**
   * Get text record for a domain using ENS-forked resolver
   */
  async getTextRecord(domainName: string, key: string): Promise<string | null> {
    try {
      const fullName = domainName.endsWith('.trust') ? domainName : `${domainName}.trust`;
      const node = this.namehash(fullName);
      const value = await this.resolver.text(node, key);
      return value || null;
    } catch (error) {
      console.error(`Error getting text record ${key} for ${domainName}:`, error);
      return null;
    }
  }

  /**
   * Get total supply of registered domain NFTs (from event scanning)
   */
  async getTotalSupply(): Promise<number> {
    try {
      // Scan domains to get count - ENS contracts don't have totalSupply
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 1000000);
      const transferFilter = this.baseRegistrar.filters.Transfer();
      const transferEvents = await this.baseRegistrar.queryFilter(transferFilter, fromBlock, currentBlock);
      return transferEvents.length;
    } catch (error) {
      console.error('Error getting total supply:', error);
      return 0;
    }
  }

  /**
   * Scan all registered domains from the blockchain
   * Uses ENS-style event scanning when new contracts are enabled
   */
  async scanAllDomains(onProgress?: (current: number, total: number) => void): Promise<Array<{
    name: string;
    owner: string;
    expirationTime: Date;
    tokenId: string;
  }>> {
    const domains: Array<{
      name: string;
      owner: string;
      expirationTime: Date;
      tokenId: string;
    }> = [];

    try {
      // Use ENS-style event scanning
      console.log("Scanning domains from ENS-forked contracts...");
      
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 1000000); // Look back 1M blocks
      
      const seenDomains = new Set<string>();
      const seenTokenIds = new Set<string>();
      
      // Query NameRegistered events from Controller (domains registered via controller)
      const controllerFilter = this.controller.filters.NameRegistered();
      const controllerEvents = await this.controller.queryFilter(controllerFilter, fromBlock, currentBlock);
      console.log(`Found ${controllerEvents.length} NameRegistered events from Controller`);
      
      for (const event of controllerEvents) {
        const args = (event as any).args;
        if (args && args.name) {
          const domainName = args.name as string;
          if (seenDomains.has(domainName)) continue;
          seenDomains.add(domainName);
          
          try {
            const labelHash = this.labelhash(domainName);
            const tokenId = ethers.getBigInt(labelHash);
            seenTokenIds.add(tokenId.toString());
            
            const [owner, expires] = await Promise.all([
              this.baseRegistrar.ownerOf(tokenId).catch(() => ethers.ZeroAddress),
              this.baseRegistrar.nameExpires(tokenId).catch(() => BigInt(0))
            ]);
            
            if (owner !== ethers.ZeroAddress) {
              domains.push({
                name: domainName,
                owner: owner,
                expirationTime: new Date(Number(expires) * 1000),
                tokenId: tokenId.toString()
              });
            }
          } catch (error) {
            console.error(`Error getting domain info for ${domainName}:`, error);
          }
        }
      }
      
      // Also scan BaseRegistrar Transfer events for migrated domains
      // Migrated domains were imported directly without going through Controller
      const transferFilter = this.baseRegistrar.filters.Transfer();
      const transferEvents = await this.baseRegistrar.queryFilter(transferFilter, fromBlock, currentBlock);
      console.log(`Found ${transferEvents.length} Transfer events from BaseRegistrar`);
      
      // Load migration data to map tokenIds to names for migrated domains
      const migrationData = await this.loadMigrationData();
      
      for (const event of transferEvents) {
        const args = (event as any).args;
        if (args && args.tokenId) {
          const tokenId = args.tokenId.toString();
          
          // Skip if we already have this domain from Controller events
          if (seenTokenIds.has(tokenId)) continue;
          seenTokenIds.add(tokenId);
          
          try {
            const [owner, expires] = await Promise.all([
              this.baseRegistrar.ownerOf(args.tokenId).catch(() => ethers.ZeroAddress),
              this.baseRegistrar.nameExpires(args.tokenId).catch(() => BigInt(0))
            ]);
            
            if (owner !== ethers.ZeroAddress) {
              // Look up domain name from migration data
              const domainName = migrationData.get(tokenId);
              
              if (domainName && !seenDomains.has(domainName)) {
                seenDomains.add(domainName);
                domains.push({
                  name: domainName,
                  owner: owner,
                  expirationTime: new Date(Number(expires) * 1000),
                  tokenId: tokenId
                });
              }
            }
          } catch (error) {
            console.error(`Error getting domain info for tokenId ${tokenId}:`, error);
          }
        }
      }
      
      console.log(`Found ${domains.length} valid domains from ENS contracts`);
      return domains;
    } catch (error) {
      console.error('Error scanning domains:', error);
      return domains;
    }
  }

  /**
   * Get the cost to create an atom in Intuition (in wei)
   * Uses the getAtomCost() view function which returns the total cost including all fees
   */
  async getAtomCost(): Promise<bigint> {
    try {
      // The getAtomCost() function returns the total cost directly
      const totalCost = await this.multivaultContract.getAtomCost();
      console.log(`Atom cost: ${totalCost} wei (${Number(totalCost) / 1e18} TRUST)`);
      return BigInt(totalCost);
    } catch (error) {
      console.error('Error getting atom cost:', error);
      // Return a reasonable default (~0.1 TRUST) if unable to fetch from contract
      return BigInt("100000000001000000");
    }
  }

  /**
   * Get the total count of atoms created
   */
  async getAtomCount(): Promise<bigint> {
    try {
      const count = await this.multivaultContract.count();
      return count;
    } catch (error) {
      console.error('Error getting atom count:', error);
      return BigInt(0);
    }
  }

  /**
   * Check if an atom exists in Intuition by URI
   * Note: When atom doesn't exist, the contract may return empty data (0x)
   * which causes a CALL_EXCEPTION - we treat this as "atom does not exist"
   */
  async checkAtomExists(atomUri: string): Promise<{ exists: boolean; atomId: bigint }> {
    try {
      const uriBytes = ethers.toUtf8Bytes(atomUri);
      const hash = ethers.keccak256(uriBytes);
      const atomId = await this.multivaultContract.atomsByHash(hash);
      return {
        exists: atomId > BigInt(0),
        atomId
      };
    } catch (error: unknown) {
      const ethersError = error as { code?: string; value?: string; data?: string };
      // Handle both BAD_DATA and CALL_EXCEPTION with empty data - both mean atom doesn't exist
      if (
        (ethersError.code === 'BAD_DATA' && ethersError.value === '0x') ||
        (ethersError.code === 'CALL_EXCEPTION' && ethersError.data === '0x')
      ) {
        // Atom doesn't exist - this is expected, not an error
        return { exists: false, atomId: BigInt(0) };
      }
      // Only log unexpected errors
      console.error('Unexpected error checking atom existence:', error);
      return { exists: false, atomId: BigInt(0) };
    }
  }

  /**
   * Build transaction data for creating an atom (user signs this)
   * Uses createAtoms(bytes[], uint256[]) on v1.5 mainnet
   * The second parameter is the stake/deposit amount per atom (same as atomCost)
   */
  async buildCreateAtomTransactionAsync(atomUri: string): Promise<{
    to: string;
    data: string;
    value: string;
    valueWei: bigint;
    gasLimit: string;
  }> {
    const atomCost = await this.getAtomCost();
    const iface = new ethers.Interface(INTUITION_MULTIVAULT_ABI);
    const uriBytes = ethers.toUtf8Bytes(atomUri);
    
    // createAtoms expects: bytes[] atomUris, uint256[] depositAmounts
    // The deposit amount should match the atomCost
    const atomUris = [uriBytes];
    const depositAmounts = [atomCost];
    
    const data = iface.encodeFunctionData('createAtoms', [atomUris, depositAmounts]);
    
    console.log(`Built createAtoms tx for: ${atomUri}`);
    console.log(`  Selector: ${data.slice(0, 10)}`);
    console.log(`  Deposit: ${atomCost.toString()} wei (${Number(atomCost) / 1e18} TRUST)`);
    
    return {
      to: INTUITION_MULTIVAULT_ADDRESS,
      data,
      value: atomCost.toString(),
      valueWei: atomCost,
      gasLimit: '500000' // Increased gas limit for createAtoms
    };
  }

  /**
   * Synchronous version for backward compatibility (uses default atom cost)
   */
  buildCreateAtomTransaction(atomUri: string): {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
  } {
    // Use the default atom cost
    const atomCost = BigInt("100000000001000000"); // ~0.1 TRUST
    const iface = new ethers.Interface(INTUITION_MULTIVAULT_ABI);
    const uriBytes = ethers.toUtf8Bytes(atomUri);
    
    // createAtoms expects: bytes[] atomUris, uint256[] depositAmounts
    const atomUris = [uriBytes];
    const depositAmounts = [atomCost];
    
    const data = iface.encodeFunctionData('createAtoms', [atomUris, depositAmounts]);
    
    console.log(`Built createAtoms tx for: ${atomUri}`);
    console.log(`  Selector: ${data.slice(0, 10)}`);
    console.log(`  Deposit: ${atomCost.toString()} wei`);
    
    return {
      to: INTUITION_MULTIVAULT_ADDRESS,
      data,
      value: atomCost.toString(),
      gasLimit: '500000'
    };
  }

  /**
   * Build transaction data for creating a triple (relationship)
   */
  buildCreateTripleTransaction(subjectId: bigint, predicateId: bigint, objectId: bigint): {
    to: string;
    data: string;
    value: string;
  } {
    const iface = new ethers.Interface(INTUITION_MULTIVAULT_ABI);
    const data = iface.encodeFunctionData('createTriple', [subjectId, predicateId, objectId]);
    
    return {
      to: INTUITION_MULTIVAULT_ADDRESS,
      data,
      value: '0' // Caller needs to add triple cost
    };
  }
}

export const blockchainService = new BlockchainService();
