import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { blockchainService, INTUITION_MULTIVAULT_ADDRESS, INTUITION_MULTIVAULT_ABI } from "./blockchain";
import { intuitionService } from "./intuition";
import { 
  domainSearchSchema, 
  domainRegistrationSchema, 
  insertDomainSchema,
  insertDomainRecordSchema,
  insertDomainCommitSchema
} from "@shared/schema";
import { z } from "zod";
import { createHash } from "crypto";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ethers } from "ethers";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Domain search and availability
  app.get("/api/domains/search/:name", async (req, res) => {
    try {
      const { name } = req.params;
      const parsedName = domainSearchSchema.parse({ name });
      
      // Check blockchain availability as the source of truth
      const blockchainAvailable = await blockchainService.isAvailable(parsedName.name);
      
      const pricing = storage.calculateDomainPrice(parsedName.name);
      
      const fullName = `${parsedName.name}.trust`;
      
      res.json({
        name: fullName,
        available: blockchainAvailable,
        pricing,
        suggestions: blockchainAvailable ? [] : await generateSuggestions(parsedName.name),
      });
    } catch (error) {
      res.status(400).json({ 
        message: error instanceof z.ZodError ? error.errors[0].message : "Invalid domain name" 
      });
    }
  });

  // Get domain details
  app.get("/api/domains/:name", async (req, res) => {
    try {
      const { name } = req.params;
      const domain = await storage.getDomainWithRecords(name);
      
      if (!domain) {
        return res.status(404).json({ message: "Domain not found" });
      }
      
      res.json(domain);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch domain details" });
    }
  });

  // Get domain by token ID (for migrated domains)
  // Build a mapping of labelhash (tokenId) to domain name from migration data
  const migratedDomainNames = [
    "samoris", "intuition", "dsfdfsgfg", "dfhdsgd", "grdgrgdggdv", "grdgrgdggfdgdv",
    "gfybhkgb", "jhgjfgfgdjgf", "ygytfyuhu", "gmjgfc", "sgsfgf", "sgsfgfa",
    "gmjjjkfdhfj", "gmjjjkfdhfjfgjs", "ftvhgjdc", "hoiunljk", "dwadsadw",
    "fsdfdesrsr", "gdfgdfgdh", "gdfgdfgdhgf", "fghkdfhdf", "ufmjfgjhf",
    "dgjdfjffgkghdgdj", "xcxkj", "xcxjgkj", "ghjgkkj", "tfjfthfg", "dsadsadcc", "dsadsadccx"
  ];
  
  // Create labelhash to name mapping (ENS tokenIds are labelhashes)
  const labelhashToName: Record<string, string> = {};
  for (const name of migratedDomainNames) {
    const labelhash = ethers.keccak256(ethers.toUtf8Bytes(name));
    const tokenIdBigInt = ethers.getBigInt(labelhash);
    labelhashToName[tokenIdBigInt.toString()] = name;
  }
  
  app.get("/api/domains/token/:tokenId", async (req, res) => {
    try {
      const { tokenId } = req.params;
      
      // First check storage
      const domain = await storage.getDomainByTokenId(parseInt(tokenId));
      
      if (domain) {
        return res.json({ name: domain.name, tokenId: domain.tokenId });
      }
      
      // Check migrated domains mapping (ENS-style labelhash tokenIds)
      const migratedName = labelhashToName[tokenId];
      if (migratedName) {
        return res.json({ name: `${migratedName}.trust`, tokenId });
      }
      
      // For legacy contracts, try to get from tokenIdToDomain
      try {
        const domainName = await blockchainService.getDomainNameByTokenId(parseInt(tokenId));
        if (domainName) {
          return res.json({ name: domainName.endsWith('.trust') ? domainName : `${domainName}.trust`, tokenId });
        }
      } catch (e) {
        // Legacy contract lookup failed
      }
      
      // Not found in storage or blockchain
      return res.status(404).json({ message: "Domain not found for token ID" });
    } catch (error) {
      console.error("Error fetching domain by token ID:", error);
      res.status(500).json({ message: "Failed to fetch domain" });
    }
  });

  // Get domains by owner
  app.get("/api/domains/owner/:address", async (req, res) => {
    try {
      const { address } = req.params;
      
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return res.status(400).json({ message: "Invalid Ethereum address" });
      }
      
      const domains = await storage.getDomainsByOwner(address);
      const domainsWithRecords = await Promise.all(
        domains.map(async (domain) => {
          const records = await storage.getDomainRecords(domain.id);
          return { ...domain, records, subdomains: [] };
        })
      );
      
      res.json(domainsWithRecords);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch domains" });
    }
  });

  // Commit phase of domain registration
  app.post("/api/domains/commit", async (req, res) => {
    try {
      const { commitment, name, owner, duration, secret } = req.body;
      
      // Validate input
      if (!commitment || !name || !owner || !duration || !secret) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Check if domain is available
      const isAvailable = await storage.isDomainAvailable(name);
      if (!isAvailable) {
        return res.status(400).json({ message: "Domain not available" });
      }
      
      // Check if commitment already exists
      const existingCommit = await storage.getDomainCommit(commitment);
      if (existingCommit) {
        return res.status(400).json({ message: "Commitment already exists" });
      }
      
      const commit = await storage.createDomainCommit({
        commitment,
        name,
        owner,
        duration,
        secret,
      });
      
      res.json({ 
        message: "Commitment created successfully", 
        commitId: commit.id,
        revealAfter: new Date(Date.now() + 60000), // 1 minute delay
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to create commitment" });
    }
  });

  // Direct domain registration (simplified)
  app.post("/api/domains/register", async (req, res) => {
    try {
      const { name, owner, duration, txHash } = req.body;
      
      console.log("Registration request:", { name, owner, duration, txHash });
      
      // Validate input
      if (!name || !owner || !duration || !txHash) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Validate transaction hash format
      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        return res.status(400).json({ message: "Invalid transaction hash format" });
      }
      
      // Validate and normalize domain name
      const normalizedName = name.toLowerCase().replace(/\.trust$/, '');
      if (normalizedName.length < 3 || normalizedName.length > 63) {
        return res.status(400).json({ message: "Domain name must be 3-63 characters" });
      }
      if (!/^[a-z0-9-]+$/.test(normalizedName)) {
        return res.status(400).json({ message: "Invalid domain name format" });
      }
      
      // Validate owner address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(owner)) {
        return res.status(400).json({ message: "Invalid owner address format" });
      }
      
      // Re-check domain availability to prevent race conditions
      const isAvailable = await storage.isDomainAvailable(normalizedName);
      if (!isAvailable) {
        return res.status(400).json({ message: "Domain not available" });
      }
      
      // Calculate pricing and expiration using normalized name
      const pricing = storage.calculateDomainPrice(normalizedName);
      const expirationDate = new Date();
      expirationDate.setFullYear(expirationDate.getFullYear() + duration);
      
      // Create domain with normalized name and real transaction hash
      const domain = await storage.createDomain({
        name: `${normalizedName}.trust`,
        owner,
        registrant: owner,
        resolver: null,
        expirationDate,
        tokenId: `tns_${Date.now()}`,
        pricePerYear: pricing.pricePerYear,
        txHash: txHash, // Store the real blockchain transaction hash
      });
      
      res.json({ 
        message: "Domain registered successfully", 
        domain,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Failed to register domain" });
    }
  });

  // Reveal phase of domain registration
  app.post("/api/domains/reveal", async (req, res) => {
    try {
      const { commitment, name, owner, duration, secret, txHash } = req.body;
      
      console.log("Reveal request data:", { commitment, name, owner, duration, secret });
      
      // Get commitment
      const commit = await storage.getDomainCommit(commitment);
      console.log("Found commitment:", commit);
      
      if (!commit) {
        return res.status(400).json({ message: "Commitment not found" });
      }
      
      if (commit.isRevealed) {
        return res.status(400).json({ message: "Commitment already revealed" });
      }
      
      // Check timing (must wait at least 1 minute)
      const minRevealTime = new Date(commit.createdAt.getTime() + 60000);
      if (new Date() < minRevealTime) {
        return res.status(400).json({ 
          message: "Must wait at least 1 minute before revealing",
          revealAfter: minRevealTime,
        });
      }
      
      // Verify commitment matches
      const expectedCommitment = createHash('sha256')
        .update(`${name}${owner}${duration}${secret}`)
        .digest('hex');
      
      if (commitment !== expectedCommitment) {
        return res.status(400).json({ message: "Invalid commitment data" });
      }
      
      // Check domain is still available
      const isAvailable = await storage.isDomainAvailable(name);
      if (!isAvailable) {
        return res.status(400).json({ message: "Domain no longer available" });
      }
      
      // Calculate pricing and expiration
      const pricing = storage.calculateDomainPrice(name);
      const expirationDate = new Date();
      expirationDate.setFullYear(expirationDate.getFullYear() + duration);
      
      // Create domain
      const domain = await storage.createDomain({
        name: name.endsWith('.trust') ? name : `${name}.trust`,
        owner,
        registrant: owner,
        resolver: null,
        expirationDate,
        tokenId: `tns_${Date.now()}`,
        pricePerYear: pricing.pricePerYear,
        txHash: txHash || null, // Store transaction hash if provided
      });
      
      // Mark commitment as revealed
      await storage.revealDomainCommit(commitment);
      
      res.json({ 
        message: "Domain registered successfully", 
        domain,
        totalCost: (parseFloat(pricing.pricePerYear) * duration).toString(),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to register domain" });
    }
  });

  // Update domain records
  app.post("/api/domains/:name/records", async (req, res) => {
    try {
      const { name } = req.params;
      const { recordType, key, value, owner } = req.body;
      
      const domain = await storage.getDomainByName(name);
      if (!domain) {
        return res.status(404).json({ message: "Domain not found" });
      }
      
      // Check ownership
      if (domain.owner !== owner) {
        return res.status(403).json({ message: "Not domain owner" });
      }
      
      const record = await storage.createDomainRecord({
        domainId: domain.id,
        recordType,
        key,
        value,
      });
      
      res.json(record);
    } catch (error) {
      res.status(500).json({ message: "Failed to create record" });
    }
  });

  // Update domain record
  app.put("/api/domains/:name/records/:recordId", async (req, res) => {
    try {
      const { name, recordId } = req.params;
      const { value, owner } = req.body;
      
      const domain = await storage.getDomainByName(name);
      if (!domain) {
        return res.status(404).json({ message: "Domain not found" });
      }
      
      // Check ownership
      if (domain.owner !== owner) {
        return res.status(403).json({ message: "Not domain owner" });
      }
      
      const record = await storage.updateDomainRecord(recordId, { value });
      if (!record) {
        return res.status(404).json({ message: "Record not found" });
      }
      
      res.json(record);
    } catch (error) {
      res.status(500).json({ message: "Failed to update record" });
    }
  });

  // Set primary domain
  // NOTE: This endpoint trusts the owner field from the request body.
  // In production, this should be replaced with signature verification or session-based auth.
  // This pattern is used across all write endpoints for simplicity in this demo.
  app.post("/api/domains/:name/set-primary", async (req, res) => {
    try {
      const { name } = req.params;
      const { owner } = req.body;
      
      const domain = await storage.getDomainByName(name);
      if (!domain) {
        return res.status(404).json({ message: "Domain not found" });
      }
      
      // Check ownership
      if (domain.owner !== owner) {
        return res.status(403).json({ message: "Not domain owner" });
      }
      
      // Set this domain as primary
      await storage.setPrimaryDomain(owner, name);
      
      res.json({ message: "Primary domain set successfully", domain: name });
    } catch (error) {
      res.status(500).json({ message: "Failed to set primary domain" });
    }
  });

  // Network information
  app.get("/api/network", (req, res) => {
    res.json({
      chainId: 1155,
      networkName: "Intuition mainnet",
      rpcUrl: "https://intuition.calderachain.xyz",
      currencySymbol: "TRUST",
      explorerUrl: "https://explorer.intuition.systems",
      contractAddress: "0xc08c5b051a9cFbcd81584Ebb8870ed77eFc5E676",
    });
  });

  // Pricing information - Fixed TRUST pricing
  app.get("/api/pricing", (req, res) => {
    res.json({
      tiers: [
        { characters: "5+", pricePerYear: "30", description: "5+ characters" },
        { characters: "4", pricePerYear: "70", description: "4 characters" },
        { characters: "3", pricePerYear: "100", description: "3 characters" },
      ],
      currency: "TRUST",
    });
  });

  // NFT Metadata endpoint - ERC-721 compliant
  app.get("/api/metadata/:tokenId", async (req, res) => {
    try {
      const tokenId = parseInt(req.params.tokenId);
      
      if (isNaN(tokenId) || tokenId < 1) {
        return res.status(400).json({ message: "Invalid token ID" });
      }

      // Get domain info from blockchain (not storage)
      const { blockchainService } = await import("./blockchain");
      const domain = await blockchainService.getDomainByTokenId(tokenId);
      
      if (!domain) {
        return res.status(404).json({ message: "Token not found" });
      }

      const domainName = `${domain.name}.trust`;
      const length = domain.name.length;
      
      // Determine pricing tier
      let pricingTier: string;
      let pricePerYear: string;
      if (length === 3) {
        pricingTier = "Premium (3 characters)";
        pricePerYear = "100 TRUST/year";
      } else if (length === 4) {
        pricingTier = "Standard (4 characters)";
        pricePerYear = "70 TRUST/year";
      } else {
        pricingTier = "Basic (5+ characters)";
        pricePerYear = "30 TRUST/year";
      }

      // Determine character set
      const characterSet = /^[a-zA-Z]+$/.test(domain.name) 
        ? "letters" 
        : /^[0-9]+$/.test(domain.name)
        ? "numbers"
        : "mixed";

      // Build ERC-721 compliant metadata
      const metadata = {
        name: domainName,
        description: `${domainName}, a Trust Name Service domain on Intuition mainnet. This NFT represents ownership of the domain name.`,
        image: `${req.protocol}://${req.get("host")}/api/metadata/${tokenId}/image`,
        external_url: `${req.protocol}://${req.get("host")}/manage/${domain.name}`,
        attributes: [
          {
            trait_type: "Domain Length",
            display_type: "number",
            value: length
          },
          {
            trait_type: "Character Set",
            value: characterSet
          },
          {
            trait_type: "Pricing Tier",
            value: pricingTier
          },
          {
            trait_type: "Price Per Year",
            value: pricePerYear
          },
          {
            trait_type: "Expiration Date",
            display_type: "date",
            value: Math.floor(domain.expirationTime.getTime() / 1000)
          },
          {
            trait_type: "Token ID",
            display_type: "number",
            value: tokenId
          }
        ]
      };

      res.json(metadata);
    } catch (error) {
      console.error("Metadata error:", error);
      res.status(500).json({ message: "Failed to generate metadata" });
    }
  });

  // NFT Image endpoint - Dynamic SVG generation
  app.get("/api/metadata/:tokenId/image", async (req, res) => {
    try {
      const tokenId = parseInt(req.params.tokenId);
      
      if (isNaN(tokenId) || tokenId < 1) {
        return res.status(400).json({ message: "Invalid token ID" });
      }

      // Get domain info from blockchain (not storage)
      const { blockchainService } = await import("./blockchain");
      const domain = await blockchainService.getDomainByTokenId(tokenId);
      
      if (!domain) {
        return res.status(404).json({ message: "Token not found" });
      }

      const domainName = `${domain.name}.trust`;
      const length = domain.name.length;
      
      // Determine color based on pricing tier
      let gradientColors: { start: string; end: string };
      if (length === 3) {
        // Premium - Gold gradient
        gradientColors = { start: "#FFD700", end: "#FFA500" };
      } else if (length === 4) {
        // Standard - Blue gradient
        gradientColors = { start: "#4A90E2", end: "#357ABD" };
      } else {
        // Basic - Purple gradient
        gradientColors = { start: "#9B59B6", end: "#8E44AD" };
      }

      // Generate SVG
      const svg = generateDomainSVG(domainName, gradientColors, tokenId);

      res.setHeader("Content-Type", "image/svg+xml");
      res.send(svg);
    } catch (error) {
      console.error("Image generation error:", error);
      res.status(500).send("Failed to generate image");
    }
  });

  // ============================================
  // INTUITION KNOWLEDGE GRAPH INTEGRATION
  // ============================================

  // Get domain atom metadata (for Knowledge Graph)
  app.get("/api/atom/:domain", async (req, res) => {
    try {
      const { domain } = req.params;
      const domainName = domain.replace('.trust', '');
      
      const domainInfo = await blockchainService.getDomainInfoENS(domainName);
      
      if (!domainInfo || !domainInfo.exists) {
        return res.status(404).json({ error: "Domain not found" });
      }
      
      const length = domainName.length;
      let pricingTier: string;
      if (length === 3) {
        pricingTier = "Premium (3 characters)";
      } else if (length === 4) {
        pricingTier = "Standard (4 characters)";
      } else {
        pricingTier = "Basic (5+ characters)";
      }
      
      res.json({
        '@context': 'https://schema.org',
        '@type': 'DigitalDocument',
        '@id': `tns:${domainName}.trust`,
        name: `${domainName}.trust`,
        description: `Trust Name Service domain: ${domainName}.trust`,
        identifier: domainInfo.tokenId.toString(),
        owner: domainInfo.owner,
        expirationDate: new Date(Number(domainInfo.expirationTime) * 1000).toISOString(),
        pricingTier,
        url: `https://tns.intuition.box/domain/${domainName}`,
        atomUri: intuitionService.generateDomainAtomUri(domainName)
      });
    } catch (error) {
      console.error("Atom metadata error:", error);
      res.status(500).json({ error: "Failed to fetch domain atom metadata" });
    }
  });

  // Get domain knowledge graph data
  app.get("/api/domains/:name/graph", async (req, res) => {
    try {
      const { name } = req.params;
      const domainName = name.replace('.trust', '');
      
      // Get owner address from blockchain for CAIP-10 URI
      const domainInfo = await blockchainService.getDomainInfoENS(domainName);
      if (!domainInfo || !domainInfo.exists) {
        return res.status(404).json({ error: "Domain not found" });
      }
      
      const graph = await intuitionService.getDomainGraph(domainName);
      
      res.json(graph);
    } catch (error) {
      console.error("Domain graph error:", error);
      res.status(500).json({ error: "Failed to fetch domain graph" });
    }
  });

  // Get domain reputation from Knowledge Graph
  app.get("/api/domains/:name/reputation", async (req, res) => {
    try {
      const { name } = req.params;
      const domainName = name.replace('.trust', '');
      
      // Get owner address from blockchain for CAIP-10 URI
      const domainInfo = await blockchainService.getDomainInfoENS(domainName);
      if (!domainInfo || !domainInfo.exists) {
        return res.status(404).json({ error: "Domain not found" });
      }
      
      const reputation = await intuitionService.getDomainReputation(domainName);
      
      if (!reputation) {
        return res.json({
          totalStaked: '0',
          totalShares: '0',
          stakeholders: 0,
          reputationScore: 0
        });
      }
      
      res.json(reputation);
    } catch (error) {
      console.error("Domain reputation error:", error);
      res.status(500).json({ error: "Failed to fetch domain reputation" });
    }
  });

  // Search atoms by URI pattern
  app.get("/api/knowledge-graph/atoms", async (req, res) => {
    try {
      const { uri } = req.query;
      
      if (!uri || typeof uri !== 'string') {
        return res.status(400).json({ error: "URI query parameter required" });
      }
      
      const atoms = await intuitionService.searchAtomsByUri(uri);
      
      res.json({ atoms });
    } catch (error) {
      console.error("Atom search error:", error);
      res.status(500).json({ error: "Failed to search atoms" });
    }
  });

  // Get specific atom by ID
  app.get("/api/knowledge-graph/atoms/:atomId", async (req, res) => {
    try {
      const { atomId } = req.params;
      
      const atom = await intuitionService.getAtomById(atomId);
      
      if (!atom) {
        return res.status(404).json({ error: "Atom not found" });
      }
      
      res.json(atom);
    } catch (error) {
      console.error("Atom fetch error:", error);
      res.status(500).json({ error: "Failed to fetch atom" });
    }
  });

  // ============================================
  // AGENT REGISTRY ENDPOINTS
  // ============================================

  // Register an AI agent with a .trust identity
  app.post("/api/agents/register", async (req, res) => {
    try {
      const { 
        domainName, 
        agentType, 
        capabilities, 
        endpoint,
        publicKey,
        owner 
      } = req.body;
      
      if (!domainName || !agentType || !capabilities || !owner) {
        return res.status(400).json({ error: "Missing required fields: domainName, agentType, capabilities, owner" });
      }
      
      const cleanDomainName = domainName.replace(/\.trust$/, '');
      
      const domain = await storage.getDomainByName(`${cleanDomainName}.trust`);
      if (!domain) {
        return res.status(404).json({ error: "Domain not found. Register the domain first." });
      }
      
      if (domain.owner.toLowerCase() !== owner.toLowerCase()) {
        return res.status(403).json({ error: "Not domain owner" });
      }
      
      const agentMetadata = {
        type: 'ai-agent',
        agentType,
        capabilities,
        endpoint: endpoint || null,
        publicKey: publicKey || null,
        version: '1.0',
        registeredAt: Date.now()
      };
      
      await storage.createDomainRecord({
        domainId: domain.id,
        recordType: 'text',
        key: 'agent.metadata',
        value: JSON.stringify(agentMetadata)
      });
      
      res.json({
        success: true,
        domain: `${cleanDomainName}.trust`,
        atomUri: intuitionService.generateAgentAtomUri(cleanDomainName),
        message: 'Agent registered successfully'
      });
    } catch (error) {
      console.error("Agent registration error:", error);
      res.status(500).json({ error: "Failed to register agent" });
    }
  });

  // Discover agents by capability (MUST come before :domain route)
  app.get("/api/agents/discover", async (req, res) => {
    try {
      const { capability, type } = req.query;
      
      const allDomains = await storage.getAllDomains();
      
      const agents = [];
      for (const domain of allDomains) {
        const records = await storage.getDomainRecords(domain.id);
        const agentRecord = records.find(r => r.key === 'agent.metadata');
        
        if (agentRecord) {
          try {
            const metadata = JSON.parse(agentRecord.value);
            
            if (capability && !metadata.capabilities?.includes(capability)) {
              continue;
            }
            if (type && metadata.agentType !== type) {
              continue;
            }
            
            agents.push({
              domain: domain.name,
              atomUri: intuitionService.generateAgentAtomUri(domain.name.replace(/\.trust$/, '')),
              ...metadata
            });
          } catch (e) {
          }
        }
      }
      
      res.json({ agents });
    } catch (error) {
      console.error("Agent discover error:", error);
      res.status(500).json({ error: "Failed to discover agents" });
    }
  });

  // Agent directory listing (MUST come before :domain route)
  app.get("/api/agents/directory", async (req, res) => {
    try {
      const { page = '1', limit = '20' } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      
      const allDomains = await storage.getAllDomains();
      
      const agents = [];
      for (const domain of allDomains) {
        const records = await storage.getDomainRecords(domain.id);
        const agentRecord = records.find(r => r.key === 'agent.metadata');
        
        if (agentRecord) {
          try {
            const metadata = JSON.parse(agentRecord.value);
            agents.push({
              domain: domain.name,
              owner: domain.owner,
              atomUri: intuitionService.generateAgentAtomUri(domain.name.replace(/\.trust$/, '')),
              ...metadata
            });
          } catch (e) {
          }
        }
      }
      
      const start = (pageNum - 1) * limitNum;
      const paginatedAgents = agents.slice(start, start + limitNum);
      
      res.json({
        agents: paginatedAgents,
        page: pageNum,
        limit: limitNum,
        total: agents.length
      });
    } catch (error) {
      console.error("Agent directory error:", error);
      res.status(500).json({ error: "Failed to fetch agent directory" });
    }
  });

  // Resolve agent identity (dynamic route - MUST come after static routes)
  app.get("/api/agents/:domain", async (req, res) => {
    try {
      const { domain } = req.params;
      const domainName = domain.replace(/\.trust$/, '');
      
      const storedDomain = await storage.getDomainByName(`${domainName}.trust`);
      
      if (!storedDomain) {
        return res.status(404).json({ error: "Domain not found" });
      }
      
      const records = await storage.getDomainRecords(storedDomain.id);
      const agentRecord = records.find(r => r.key === 'agent.metadata');
      
      if (!agentRecord) {
        return res.status(404).json({ error: "Agent not found. This domain is not registered as an agent." });
      }
      
      const metadata = JSON.parse(agentRecord.value);
      
      const domainInfo = await blockchainService.getDomainInfoENS(domainName);
      const resolvedAddress = domainInfo?.owner || storedDomain.owner;
      
      res.json({
        domain: `${domainName}.trust`,
        address: resolvedAddress,
        atomUri: intuitionService.generateAgentAtomUri(domainName),
        ...metadata
      });
    } catch (error) {
      console.error("Agent resolve error:", error);
      res.status(500).json({ error: "Failed to resolve agent" });
    }
  });

  // Update agent records
  app.post("/api/agents/:domain/records", async (req, res) => {
    try {
      const { domain } = req.params;
      const { records, owner } = req.body;
      
      const domainName = domain.replace(/\.trust$/, '');
      const storedDomain = await storage.getDomainByName(`${domainName}.trust`);
      
      if (!storedDomain) {
        return res.status(404).json({ error: "Domain not found" });
      }
      
      if (storedDomain.owner.toLowerCase() !== owner.toLowerCase()) {
        return res.status(403).json({ error: "Not domain owner" });
      }
      
      for (const [key, value] of Object.entries(records)) {
        if (key.startsWith('agent.')) {
          await storage.createDomainRecord({
            domainId: storedDomain.id,
            recordType: 'text',
            key,
            value: value as string
          });
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Agent records update error:", error);
      res.status(500).json({ error: "Failed to update agent records" });
    }
  });

  // ============================================
  // KNOWLEDGE GRAPH SYNC ENDPOINTS
  // ============================================

  // Get user's domains with sync status (user-facing endpoint)
  app.get("/api/sync/user/:address", async (req, res) => {
    try {
      const { address } = req.params;
      
      if (!/^0x[a-fA-F0-9]{40}$/i.test(address)) {
        return res.status(400).json({ error: "Invalid Ethereum address" });
      }
      
      console.log(`Getting domains with sync status for user: ${address}`);
      
      // Scan all domains from blockchain
      const allDomains = await blockchainService.scanAllDomains();
      
      // Filter to only this user's domains
      const userDomains = allDomains.filter(
        d => d.owner.toLowerCase() === address.toLowerCase()
      );
      
      const atomCost = await blockchainService.getAtomCost();
      const domainsWithSync = [];
      
      for (const domain of userDomains) {
        const fullName = domain.name.endsWith('.trust') ? domain.name : `${domain.name}.trust`;
        const cleanName = domain.name.replace(/\.trust$/, '');
        // Use CAIP-10 format with owner address for account-type atoms
        const atomUri = intuitionService.generateDomainAtomUri(cleanName);
        
        // Check if atom exists on-chain
        const atomCheck = await blockchainService.checkAtomExists(atomUri);
        
        // Get or create sync status
        let syncStatus = await storage.getDomainSyncStatus(fullName);
        
        if (!syncStatus) {
          syncStatus = await storage.createDomainSyncStatus({
            domainName: fullName,
            atomUri,
            syncStatus: atomCheck.exists ? 'synced' : 'pending',
            atomId: atomCheck.exists ? atomCheck.atomId.toString() : undefined,
          });
        } else if (syncStatus.syncStatus !== 'synced' && atomCheck.exists) {
          // Update to synced if atom now exists
          syncStatus = await storage.updateDomainSyncStatus(fullName, {
            syncStatus: 'synced',
            atomId: atomCheck.atomId.toString(),
            syncedAt: new Date(),
            errorMessage: null
          });
        }
        
        // Build transaction if not synced
        const tx = !atomCheck.exists ? blockchainService.buildCreateAtomTransaction(atomUri) : null;
        
        domainsWithSync.push({
          domainName: fullName,
          owner: domain.owner,
          tokenId: domain.tokenId,
          expirationDate: domain.expirationTime,
          atomUri,
          syncStatus: atomCheck.exists ? 'synced' : (syncStatus?.syncStatus || 'pending'),
          atomId: atomCheck.exists ? atomCheck.atomId.toString() : syncStatus?.atomId,
          txHash: syncStatus?.txHash,
          transaction: tx ? {
            ...tx,
            value: `0x${atomCost.toString(16)}`,
            valueEth: (Number(atomCost) / 1e18).toFixed(6)
          } : null
        });
      }
      
      res.json({
        address,
        totalDomains: domainsWithSync.length,
        synced: domainsWithSync.filter(d => d.syncStatus === 'synced').length,
        pending: domainsWithSync.filter(d => d.syncStatus !== 'synced').length,
        atomCostWei: atomCost.toString(),
        atomCostEth: (Number(atomCost) / 1e18).toFixed(6),
        domains: domainsWithSync
      });
    } catch (error) {
      console.error("User sync status error:", error);
      res.status(500).json({ error: "Failed to get user sync status" });
    }
  });

  // Scan blockchain for registered domains and check sync status
  app.post("/api/sync/scan", async (req, res) => {
    try {
      console.log("Starting blockchain domain scan...");
      
      const domains = await blockchainService.scanAllDomains();
      const syncResults = [];
      
      for (const domain of domains) {
        const fullName = domain.name.endsWith('.trust') ? domain.name : `${domain.name}.trust`;
        const cleanName = domain.name.replace(/\.trust$/, '');
        // Use CAIP-10 format with owner address for account-type atoms
        const atomUri = intuitionService.generateDomainAtomUri(cleanName);
        
        let syncStatus = await storage.getDomainSyncStatus(fullName);
        
        if (!syncStatus) {
          // New domain - check if atom exists on-chain
          const atomCheck = await blockchainService.checkAtomExists(atomUri);
          
          syncStatus = await storage.createDomainSyncStatus({
            domainName: fullName,
            atomUri,
            syncStatus: atomCheck.exists ? 'synced' : 'pending',
            atomId: atomCheck.exists ? atomCheck.atomId.toString() : undefined,
          });
        } else if (syncStatus.syncStatus === 'pending' || syncStatus.syncStatus === 'failed') {
          // Existing pending/failed domain - verify if atom now exists on-chain
          const atomCheck = await blockchainService.checkAtomExists(atomUri);
          
          if (atomCheck.exists) {
            // Atom exists on-chain, update status to synced
            syncStatus = await storage.updateDomainSyncStatus(fullName, {
              syncStatus: 'synced',
              atomId: atomCheck.atomId.toString(),
              syncedAt: new Date(),
              errorMessage: null
            });
          }
        }
        
        syncResults.push({
          domain: fullName,
          owner: domain.owner,
          tokenId: domain.tokenId,
          expirationDate: domain.expirationTime,
          atomUri,
          syncStatus: syncStatus?.syncStatus || 'pending',
          atomId: syncStatus?.atomId
        });
      }
      
      res.json({
        totalDomains: domains.length,
        synced: syncResults.filter(r => r.syncStatus === 'synced').length,
        pending: syncResults.filter(r => r.syncStatus === 'pending').length,
        failed: syncResults.filter(r => r.syncStatus === 'failed').length,
        domains: syncResults
      });
    } catch (error) {
      console.error("Sync scan error:", error);
      res.status(500).json({ error: "Failed to scan domains" });
    }
  });

  // Get sync status for all domains
  app.get("/api/sync/status", async (req, res) => {
    try {
      const allStatuses = await storage.getAllSyncStatuses();
      const atomCost = await blockchainService.getAtomCost();
      
      res.json({
        totalDomains: allStatuses.length,
        synced: allStatuses.filter(s => s.syncStatus === 'synced').length,
        pending: allStatuses.filter(s => s.syncStatus === 'pending').length,
        failed: allStatuses.filter(s => s.syncStatus === 'failed').length,
        atomCostWei: atomCost.toString(),
        atomCostEth: (Number(atomCost) / 1e18).toFixed(6),
        domains: allStatuses
      });
    } catch (error) {
      console.error("Sync status error:", error);
      res.status(500).json({ error: "Failed to get sync status" });
    }
  });

  // Get unsynced domains that need to be added to Knowledge Graph
  app.get("/api/sync/pending", async (req, res) => {
    try {
      const unsyncedDomains = await storage.getUnsyncedDomains();
      const atomCost = await blockchainService.getAtomCost();
      
      const pendingWithTx = unsyncedDomains.map(domain => {
        const tx = blockchainService.buildCreateAtomTransaction(domain.atomUri);
        return {
          ...domain,
          transaction: {
            ...tx,
            value: `0x${atomCost.toString(16)}`,
            valueEth: (Number(atomCost) / 1e18).toFixed(6)
          }
        };
      });
      
      res.json({
        count: pendingWithTx.length,
        totalCostWei: (atomCost * BigInt(pendingWithTx.length)).toString(),
        totalCostEth: (Number(atomCost * BigInt(pendingWithTx.length)) / 1e18).toFixed(6),
        domains: pendingWithTx
      });
    } catch (error) {
      console.error("Pending sync error:", error);
      res.status(500).json({ error: "Failed to get pending domains" });
    }
  });

  // Prepare batch transaction data for syncing multiple domains
  app.post("/api/sync/prepare-batch", async (req, res) => {
    try {
      const { domainNames } = req.body;
      
      if (!domainNames || !Array.isArray(domainNames) || domainNames.length === 0) {
        return res.status(400).json({ error: "domainNames array required" });
      }
      
      const atomCost = await blockchainService.getAtomCost();
      const transactions = [];
      
      for (const domainName of domainNames) {
        const cleanName = domainName.replace(/\.trust$/, '');
        
        // Get owner address from blockchain for CAIP-10 URI
        const domainInfo = await blockchainService.getDomainInfoENS(cleanName);
        if (!domainInfo || !domainInfo.exists) continue;
        
        const atomUri = intuitionService.generateDomainAtomUri(cleanName);
        
        const atomCheck = await blockchainService.checkAtomExists(atomUri);
        
        if (!atomCheck.exists) {
          const tx = blockchainService.buildCreateAtomTransaction(atomUri);
          transactions.push({
            domain: `${cleanName}.trust`,
            atomUri,
            owner: domainInfo.owner,
            transaction: {
              ...tx,
              value: atomCost.toString()
            }
          });
        }
      }
      
      res.json({
        count: transactions.length,
        totalCostWei: (atomCost * BigInt(transactions.length)).toString(),
        totalCostEth: (Number(atomCost * BigInt(transactions.length)) / 1e18).toFixed(6),
        transactions
      });
    } catch (error) {
      console.error("Batch prepare error:", error);
      res.status(500).json({ error: "Failed to prepare batch" });
    }
  });

  // Prepare sync transaction for a single domain (used for auto-sync after registration)
  app.post("/api/sync/prepare", async (req, res) => {
    try {
      const { domainName } = req.body;
      
      if (!domainName) {
        return res.status(400).json({ error: "domainName required" });
      }
      
      const fullName = domainName.endsWith('.trust') ? domainName : `${domainName}.trust`;
      const cleanName = fullName.replace(/\.trust$/, '');
      
      // Get owner address from blockchain for CAIP-10 URI
      const domainInfo = await blockchainService.getDomainInfoENS(cleanName);
      if (!domainInfo || !domainInfo.exists) {
        return res.status(404).json({ error: "Domain not found on blockchain" });
      }
      
      const atomUri = intuitionService.generateDomainAtomUri(cleanName);
      
      // Check if already synced
      const existingStatus = await storage.getDomainSyncStatus(fullName);
      if (existingStatus?.syncStatus === 'synced') {
        return res.json({
          alreadySynced: true,
          atomId: existingStatus.atomId,
          txHash: existingStatus.txHash
        });
      }
      
      // Check if atom already exists on-chain
      const atomCheck = await blockchainService.checkAtomExists(atomUri);
      if (atomCheck.exists) {
        // Mark as synced and return
        await storage.createDomainSyncStatus({
          domainName: fullName,
          atomUri,
          syncStatus: 'synced',
          atomId: atomCheck.atomId.toString()
        });
        return res.json({
          alreadySynced: true,
          atomId: atomCheck.atomId.toString()
        });
      }
      
      // Prepare transaction data
      const atomCost = await blockchainService.getAtomCost();
      const tx = blockchainService.buildCreateAtomTransaction(atomUri);
      
      // Create pending sync status
      if (!existingStatus) {
        await storage.createDomainSyncStatus({
          domainName: fullName,
          atomUri,
          syncStatus: 'pending'
        });
      }
      
      res.json({
        alreadySynced: false,
        domainName: fullName,
        atomUri,
        transaction: {
          ...tx,
          value: `0x${atomCost.toString(16)}`,
          valueEth: (Number(atomCost) / 1e18).toFixed(6)
        }
      });
    } catch (error) {
      console.error("Prepare sync error:", error);
      res.status(500).json({ error: "Failed to prepare sync" });
    }
  });

  // Mark domain as synced (called after transaction is confirmed)
  app.post("/api/sync/confirm", async (req, res) => {
    try {
      const { domainName, atomId, txHash } = req.body;
      
      if (!domainName || !atomId) {
        return res.status(400).json({ error: "domainName and atomId required" });
      }
      
      const fullName = domainName.endsWith('.trust') ? domainName : `${domainName}.trust`;
      
      let syncStatus = await storage.getDomainSyncStatus(fullName);
      
      if (!syncStatus) {
        const cleanName = fullName.replace(/\.trust$/, '');
        // Get owner address from blockchain for CAIP-10 URI
        const domainInfo = await blockchainService.getDomainInfoENS(cleanName);
        const ownerAddress = domainInfo?.owner || '0x0000000000000000000000000000000000000000';
        
        syncStatus = await storage.createDomainSyncStatus({
          domainName: fullName,
          atomUri: intuitionService.generateDomainAtomUri(cleanName),
          syncStatus: 'synced',
          atomId: atomId.toString(),
          txHash
        });
      } else {
        syncStatus = await storage.updateDomainSyncStatus(fullName, {
          syncStatus: 'synced',
          atomId: atomId.toString(),
          txHash,
          syncedAt: new Date(),
          errorMessage: null
        });
      }
      
      res.json({
        success: true,
        domain: fullName,
        atomId,
        txHash,
        syncStatus: 'synced'
      });
    } catch (error) {
      console.error("Sync confirm error:", error);
      res.status(500).json({ error: "Failed to confirm sync" });
    }
  });

  // Mark sync as failed
  app.post("/api/sync/fail", async (req, res) => {
    try {
      const { domainName, errorMessage } = req.body;
      
      if (!domainName) {
        return res.status(400).json({ error: "domainName required" });
      }
      
      const fullName = domainName.endsWith('.trust') ? domainName : `${domainName}.trust`;
      
      let syncStatus = await storage.getDomainSyncStatus(fullName);
      
      if (!syncStatus) {
        const cleanName = fullName.replace(/\.trust$/, '');
        // Get owner address from blockchain for CAIP-10 URI
        const domainInfo = await blockchainService.getDomainInfoENS(cleanName);
        const ownerAddress = domainInfo?.owner || '0x0000000000000000000000000000000000000000';
        
        syncStatus = await storage.createDomainSyncStatus({
          domainName: fullName,
          atomUri: intuitionService.generateDomainAtomUri(cleanName),
          syncStatus: 'failed',
          errorMessage
        });
      } else {
        syncStatus = await storage.updateDomainSyncStatus(fullName, {
          syncStatus: 'failed',
          errorMessage
        });
      }
      
      res.json({
        success: true,
        domain: fullName,
        syncStatus: 'failed',
        errorMessage
      });
    } catch (error) {
      console.error("Sync fail error:", error);
      res.status(500).json({ error: "Failed to mark sync as failed" });
    }
  });

  // Check if a specific domain is synced to Knowledge Graph
  app.get("/api/sync/check/:domain", async (req, res) => {
    try {
      const { domain } = req.params;
      const cleanName = domain.replace(/\.trust$/, '');
      
      // Get owner address from blockchain for CAIP-10 URI
      const domainInfo = await blockchainService.getDomainInfoENS(cleanName);
      if (!domainInfo || !domainInfo.exists) {
        return res.status(404).json({ error: "Domain not found on blockchain" });
      }
      
      const atomUri = intuitionService.generateDomainAtomUri(cleanName);
      
      const atomCheck = await blockchainService.checkAtomExists(atomUri);
      
      const storedStatus = await storage.getDomainSyncStatus(`${cleanName}.trust`);
      
      res.json({
        domain: `${cleanName}.trust`,
        owner: domainInfo.owner,
        atomUri,
        existsOnChain: atomCheck.exists,
        atomId: atomCheck.exists ? atomCheck.atomId.toString() : null,
        storedStatus: storedStatus?.syncStatus || 'unknown'
      });
    } catch (error) {
      console.error("Sync check error:", error);
      res.status(500).json({ error: "Failed to check sync status" });
    }
  });

  // ============================================
  // DOMAIN RECORD SYNC TO KNOWLEDGE GRAPH
  // ============================================

  // Prepare transaction to sync a domain record to the Knowledge Graph
  // Creates atoms for domain (if not exists), predicate, and value, then creates a triple
  app.post("/api/sync/record", async (req, res) => {
    try {
      const { domainName, recordKey, recordValue } = req.body;
      
      if (!domainName || !recordKey || !recordValue) {
        return res.status(400).json({ error: "domainName, recordKey, and recordValue required" });
      }
      
      const cleanName = domainName.replace(/\.trust$/, '').toLowerCase();
      const fullName = `${cleanName}.trust`;
      
      // Generate atom URIs for the triple
      const domainAtomUri = intuitionService.generateDomainAtomUri(cleanName);
      const predicateAtomUri = `tns:predicate:${recordKey}`; // e.g., tns:predicate:email
      const valueAtomUri = `tns:value:${recordKey}:${recordValue}`; // e.g., tns:value:email:user@example.com
      
      console.log(`Preparing record sync for ${fullName}: ${recordKey} = ${recordValue}`);
      console.log(`  Domain atom: ${domainAtomUri}`);
      console.log(`  Predicate atom: ${predicateAtomUri}`);
      console.log(`  Value atom: ${valueAtomUri}`);
      
      // Check which atoms already exist
      const [domainCheck, predicateCheck, valueCheck] = await Promise.all([
        blockchainService.checkAtomExists(domainAtomUri),
        blockchainService.checkAtomExists(predicateAtomUri),
        blockchainService.checkAtomExists(valueAtomUri)
      ]);
      
      const atomsToCreate: string[] = [];
      if (!domainCheck.exists) atomsToCreate.push(domainAtomUri);
      if (!predicateCheck.exists) atomsToCreate.push(predicateAtomUri);
      if (!valueCheck.exists) atomsToCreate.push(valueAtomUri);
      
      const atomCost = await blockchainService.getAtomCost();
      
      // Build batch transaction for all atoms that need to be created
      const transactions: Array<{
        type: string;
        uri?: string;
        subjectId?: string;
        predicateId?: string;
        objectId?: string;
        to: string;
        data: string;
        value: string;
        gasLimit: string;
      }> = [];
      
      if (atomsToCreate.length > 0) {
        // Build batch atom creation transaction
        const iface = new ethers.Interface(INTUITION_MULTIVAULT_ABI);
        const uriBytes = atomsToCreate.map(uri => ethers.toUtf8Bytes(uri));
        const depositAmounts = atomsToCreate.map(() => atomCost);
        
        const data = iface.encodeFunctionData('createAtoms', [uriBytes, depositAmounts]);
        const totalCost = atomCost * BigInt(atomsToCreate.length);
        
        transactions.push({
          type: 'createAtoms',
          uri: atomsToCreate.join(','),
          to: INTUITION_MULTIVAULT_ADDRESS,
          data,
          value: totalCost.toString(),
          gasLimit: '800000'
        });
      }
      
      // Get atom IDs for the triple
      const existingAtomIds = {
        domain: domainCheck.exists ? domainCheck.atomId.toString() : null,
        predicate: predicateCheck.exists ? predicateCheck.atomId.toString() : null,
        value: valueCheck.exists ? valueCheck.atomId.toString() : null
      };
      
      // If all atoms exist, we can create the triple directly
      // Otherwise, atoms need to be created first, then call this endpoint again for the triple
      let tripleTransaction = null;
      if (domainCheck.exists && predicateCheck.exists && valueCheck.exists) {
        // All atoms exist - build the triple transaction
        const tripleTx = blockchainService.buildCreateTripleTransaction(
          domainCheck.atomId,
          predicateCheck.atomId,
          valueCheck.atomId
        );
        
        // Get triple cost (same as atom cost)
        const tripleCost = atomCost;
        
        tripleTransaction = {
          type: 'createTriple',
          subjectId: domainCheck.atomId.toString(),
          predicateId: predicateCheck.atomId.toString(),
          objectId: valueCheck.atomId.toString(),
          to: tripleTx.to,
          data: tripleTx.data,
          value: tripleCost.toString(),
          gasLimit: '500000'
        };
        
        transactions.push(tripleTransaction);
      }
      
      const totalCost = atomCost * BigInt(atomsToCreate.length) + (tripleTransaction ? atomCost : BigInt(0));
      
      res.json({
        success: true,
        domainName: fullName,
        recordKey,
        recordValue,
        atomUris: {
          domain: domainAtomUri,
          predicate: predicateAtomUri,
          value: valueAtomUri
        },
        existingAtoms: {
          domain: domainCheck.exists,
          predicate: predicateCheck.exists,
          value: valueCheck.exists
        },
        existingAtomIds,
        atomsToCreate,
        atomCostWei: atomCost.toString(),
        atomCostEth: (Number(atomCost) / 1e18).toFixed(6),
        totalCostWei: totalCost.toString(),
        totalCostEth: (Number(totalCost) / 1e18).toFixed(6),
        transactions,
        needsAtomCreation: atomsToCreate.length > 0,
        needsTripleCreation: !tripleTransaction && atomsToCreate.length === 0 ? false : true,
        readyForTriple: atomsToCreate.length === 0
      });
    } catch (error) {
      console.error("Record sync prepare error:", error);
      res.status(500).json({ error: "Failed to prepare record sync" });
    }
  });

  // Confirm record sync after transaction (stores the relationship in memory for quick lookups)
  app.post("/api/sync/record/confirm", async (req, res) => {
    try {
      const { domainName, recordKey, recordValue, txHash } = req.body;
      
      if (!domainName || !recordKey) {
        return res.status(400).json({ error: "domainName and recordKey required" });
      }
      
      const cleanName = domainName.replace(/\.trust$/, '').toLowerCase();
      const fullName = `${cleanName}.trust`;
      
      console.log(`Confirmed record sync for ${fullName}: ${recordKey} = ${recordValue}`);
      
      res.json({
        success: true,
        domainName: fullName,
        recordKey,
        recordValue,
        txHash,
        syncedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Record sync confirm error:", error);
      res.status(500).json({ error: "Failed to confirm record sync" });
    }
  });

  // Get all records synced to Knowledge Graph for a domain
  app.get("/api/sync/records/:domain", async (req, res) => {
    try {
      const { domain } = req.params;
      const cleanName = domain.replace(/\.trust$/, '').toLowerCase();
      const fullName = `${cleanName}.trust`;
      
      const domainAtomUri = intuitionService.generateDomainAtomUri(cleanName);
      
      // Check if domain atom exists
      const domainCheck = await blockchainService.checkAtomExists(domainAtomUri);
      
      // Search for related atoms with this domain's records
      const recordTypes = ['email', 'url', 'avatar', 'description', 'com.twitter', 'com.github', 'com.discord', 'org.telegram'];
      const syncedRecords: Array<{
        key: string;
        predicateUri: string;
        exists: boolean;
      }> = [];
      
      for (const recordType of recordTypes) {
        const predicateUri = `tns:predicate:${recordType}`;
        const check = await blockchainService.checkAtomExists(predicateUri);
        syncedRecords.push({
          key: recordType,
          predicateUri,
          exists: check.exists
        });
      }
      
      res.json({
        domainName: fullName,
        domainAtomUri,
        domainSynced: domainCheck.exists,
        domainAtomId: domainCheck.exists ? domainCheck.atomId.toString() : null,
        records: syncedRecords
      });
    } catch (error) {
      console.error("Get synced records error:", error);
      res.status(500).json({ error: "Failed to get synced records" });
    }
  });

  // ============================================
  // OBJECT STORAGE ENDPOINTS
  // ============================================

  // Get presigned URL for uploading domain images
  app.post("/api/objects/upload", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Upload URL error:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Serve uploaded objects (domain images)
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Object fetch error:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Update domain image after upload
  app.put("/api/domains/:name/image", async (req, res) => {
    try {
      const { name } = req.params;
      const { imageURL, owner } = req.body;
      
      if (!imageURL) {
        return res.status(400).json({ error: "imageURL is required" });
      }
      
      const domain = await storage.getDomainByName(name);
      if (!domain) {
        return res.status(404).json({ error: "Domain not found" });
      }
      
      if (domain.owner.toLowerCase() !== owner?.toLowerCase()) {
        return res.status(403).json({ error: "Not domain owner" });
      }
      
      const objectStorageService = new ObjectStorageService();
      const objectPath = objectStorageService.normalizeObjectEntityPath(imageURL);
      
      res.json({
        success: true,
        objectPath,
        imageURL: objectPath.startsWith('/objects/') ? objectPath : imageURL
      });
    } catch (error) {
      console.error("Domain image update error:", error);
      res.status(500).json({ error: "Failed to update domain image" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to generate domain suggestions
async function generateSuggestions(name: string): Promise<string[]> {
  const suggestions = [
    `${name}app`,
    `${name}dao`,
    `${name}web3`,
    `my${name}`,
    `the${name}`,
    `${name}official`,
  ];
  
  const available = [];
  for (const suggestion of suggestions) {
    const isAvailable = await storage.isDomainAvailable(suggestion);
    if (isAvailable) {
      available.push(`${suggestion}.trust`);
    }
  }
  
  return available.slice(0, 3);
}

// Helper function to generate SVG image for domain NFT
function generateDomainSVG(
  domainName: string, 
  gradientColors: { start: string; end: string },
  tokenId: number
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="500" height="500" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${gradientColors.start};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${gradientColors.end};stop-opacity:1" />
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="500" height="500" fill="url(#bgGradient)"/>
  
  <!-- Decorative circles -->
  <circle cx="50" cy="50" r="30" fill="white" opacity="0.1"/>
  <circle cx="450" cy="450" r="40" fill="white" opacity="0.1"/>
  <circle cx="100" cy="400" r="20" fill="white" opacity="0.1"/>
  <circle cx="400" cy="100" r="25" fill="white" opacity="0.1"/>
  
  <!-- Main content card -->
  <rect x="40" y="150" width="420" height="200" rx="20" fill="white" opacity="0.95" filter="url(#shadow)"/>
  
  <!-- TNS Logo/Brand -->
  <text x="250" y="120" font-family="Arial, sans-serif" font-size="32" font-weight="bold" 
        fill="white" text-anchor="middle" opacity="0.9">
    TNS
  </text>
  
  <!-- Domain name - centered and prominent -->
  <text x="250" y="240" font-family="Arial, sans-serif" font-size="36" font-weight="bold" 
        fill="#2C3E50" text-anchor="middle">
    ${domainName}
  </text>
  
  <!-- Subtitle -->
  <text x="250" y="280" font-family="Arial, sans-serif" font-size="16" 
        fill="#7F8C8D" text-anchor="middle">
    Trust Name Service Domain
  </text>
  
  <!-- Token ID badge -->
  <rect x="190" y="300" width="120" height="30" rx="15" fill="${gradientColors.start}" opacity="0.2"/>
  <text x="250" y="320" font-family="Arial, sans-serif" font-size="14" 
        fill="#2C3E50" text-anchor="middle">
    Token #${tokenId}
  </text>
  
  <!-- Bottom text -->
  <text x="250" y="430" font-family="Arial, sans-serif" font-size="14" 
        fill="white" text-anchor="middle" opacity="0.8">
    Intuition Mainnet
  </text>
</svg>`;
}
