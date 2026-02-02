# TNS Contract Security Verification Guide

This guide explains how to verify the security of the TNS (Trust Name Service) smart contracts deployed on Intuition Mainnet.

---

## Table of Contents

1. [Source Code Verification](#1-source-code-verification)
2. [ENS Codebase Comparison](#2-ens-codebase-comparison)
3. [Custom Contract Audit](#3-custom-contract-audit)
4. [On-Chain Verification](#4-on-chain-verification)
5. [Common Vulnerability Checklist](#5-common-vulnerability-checklist)
6. [Third-Party Audit Resources](#6-third-party-audit-resources)

---

## 1. Source Code Verification

### Step 1: Verify Contracts on Explorer

All TNS contracts are verified on the Intuition Explorer. You can view the source code directly:

| Contract | Verified Source |
|----------|-----------------|
| TNSRegistry | [View Code](https://explorer.intuition.systems/address/0x34D7648aecc10fd86A53Cdd2436125342f3d7412#code) |
| BaseRegistrar | [View Code](https://explorer.intuition.systems/address/0xc08c5b051a9cFbcd81584Ebb8870ed77eFc5E676#code) |
| TNSRegistrarController | [View Code](https://explorer.intuition.systems/address/0x57C93D875c3D4C8e377DAE5aA7EA06d35C84d044#code) |
| Resolver | [View Code](https://explorer.intuition.systems/address/0x17Adb57047EDe9eBA93A5855f8578A8E512592C5#code) |
| ReverseRegistrar | [View Code](https://explorer.intuition.systems/address/0x5140b65d566DA2d1298fCFE75eA972850bC2E365#code) |
| StablePriceOracle | [View Code](https://explorer.intuition.systems/address/0xeFD11f62A66F39fE5C2A7e43f281FAbaFceed303#code) |
| PaymentForwarder | [View Code](https://explorer.intuition.systems/address/0xB0e22123Ac142e57F56Bc9fEf2077bB2Fa1141a0#code) |

### Step 2: Compare with Repository

Clone and compare the deployed bytecode:

```bash
# Clone the repository
git clone <repository-url>
cd contracts/tns-ens

# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Compare bytecode (example for TNSRegistry)
npx hardhat verify --network intuition 0x34D7648aecc10fd86A53Cdd2436125342f3d7412
```

---

## 2. ENS Codebase Comparison

TNS is forked from the battle-tested ENS contracts. To verify the fork integrity:

### Step 1: Get Original ENS Source

```bash
# Clone official ENS contracts
git clone https://github.com/ensdomains/ens-contracts.git
cd ens-contracts
git checkout v0.0.21  # Version used as base
```

### Step 2: Compare Core Contracts

Use a diff tool to compare TNS contracts with ENS originals:

| TNS Contract | ENS Original | Expected Differences |
|--------------|--------------|---------------------|
| `registry/TNSRegistry.sol` | `registry/ENSRegistry.sol` | Interface name only |
| `ethregistrar/BaseRegistrarImplementation.sol` | `ethregistrar/BaseRegistrarImplementation.sol` | Minimal changes |
| `ethregistrar/TNSRegistrarController.sol` | `ethregistrar/ETHRegistrarController.sol` | TRUST payments, node constants |
| `resolvers/Resolver.sol` | `resolvers/PublicResolver.sol` | Simplified version |
| `reverseRegistrar/ReverseRegistrar.sol` | `reverseRegistrar/ReverseRegistrar.sol` | Minimal changes |

### Step 3: Key Modifications to Review

```bash
# Search for TNS-specific changes
grep -r "TRUST" contracts/
grep -r "0xe16bcebb" contracts/  # TRUST_NODE constant
grep -r "1155" contracts/         # Chain ID
```

**Expected modifications:**
- `ETH_NODE` → `TRUST_NODE` (namehash constant)
- Interface imports: `ENS` → `TNS`
- Token name in comments: ETH → TRUST

---

## 3. Custom Contract Audit

### PaymentForwarder (Custom Contract)

The PaymentForwarder is the **only non-ENS contract**. Review it carefully:

**Location:** `contracts/tns-ens/utils/PaymentForwarder.sol`

#### Security Checklist

```solidity
// ✅ No storage variables (stateless)
TNS public immutable tns;

// ✅ No admin/owner functions (permissionless)
// No onlyOwner modifiers

// ✅ No upgradeable patterns (immutable)
// No proxy, no delegatecall

// ✅ Explicit error handling
error DomainNotRegistered(string name);
error NoResolverSet(string name);
error NoAddressSet(string name);
error PaymentFailed();

// ✅ CEI pattern (Checks-Effects-Interactions)
// All checks happen before the external call

// ✅ Event emission for tracking
event PaymentForwarded(string indexed name, address indexed from, address indexed to, uint256 amount);
```

#### Manual Review Points

1. **Reentrancy Risk**: Low
   - No state changes after external call
   - Uses `call` with empty data (standard transfer)

2. **Resolver Trust**: Medium
   - Trusts resolver to return correct address
   - Resolver is set by domain owner only
   - Malicious resolver could return attacker address

3. **Gas Griefing**: Low
   - Recipient could consume all gas in receive()
   - Mitigated by gas limit in frontend

---

## 4. On-Chain Verification

### Step 1: Verify Contract Relationships

```javascript
const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider("https://intuition.calderachain.xyz");

// Contract addresses
const REGISTRY = "0x34D7648aecc10fd86A53Cdd2436125342f3d7412";
const REGISTRAR = "0xc08c5b051a9cFbcd81584Ebb8870ed77eFc5E676";
const CONTROLLER = "0x57C93D875c3D4C8e377DAE5aA7EA06d35C84d044";
const RESOLVER = "0x17Adb57047EDe9eBA93A5855f8578A8E512592C5";

// Calculate TRUST_NODE
const TRUST_LABEL = ethers.keccak256(ethers.toUtf8Bytes("trust"));
const ROOT_NODE = ethers.ZeroHash;
const TRUST_NODE = ethers.keccak256(
  ethers.solidityPacked(["bytes32", "bytes32"], [ROOT_NODE, TRUST_LABEL])
);

console.log("TRUST_NODE:", TRUST_NODE);
// Expected: 0xe16bcebb9fdd78a351d48e8b8c0efa4a4d222509da29d80bcbb1e2b64eac4985

// Verify .trust TLD owner is BaseRegistrar
const registryAbi = ["function owner(bytes32 node) view returns (address)"];
const registry = new ethers.Contract(REGISTRY, registryAbi, provider);
const trustOwner = await registry.owner(TRUST_NODE);
console.log(".trust TLD owner:", trustOwner);
console.log("Expected (BaseRegistrar):", REGISTRAR);
console.log("Match:", trustOwner === REGISTRAR);
```

### Step 2: Verify Controller Authorization

```javascript
// Check if Controller is authorized on BaseRegistrar
const registrarAbi = ["function controllers(address) view returns (bool)"];
const registrar = new ethers.Contract(REGISTRAR, registrarAbi, provider);
const isController = await registrar.controllers(CONTROLLER);
console.log("Controller authorized:", isController);
// Expected: true
```

### Step 3: Verify Treasury Configuration

```javascript
// Check treasury address in Controller
const controllerAbi = ["function treasury() view returns (address)"];
const controller = new ethers.Contract(CONTROLLER, controllerAbi, provider);
const treasury = await controller.treasury();
console.log("Treasury:", treasury);
// Expected: 0x629A5386F73283F80847154d16E359192a891f86
```

---

## 5. Common Vulnerability Checklist

### Registry (TNSRegistry.sol)

| Vulnerability | Status | Notes |
|---------------|--------|-------|
| Unauthorized ownership changes | ✅ Safe | Only owner can transfer |
| Resolver manipulation | ✅ Safe | Only owner can set |
| Subdomain attacks | ✅ Safe | Requires parent ownership |

### Registrar (BaseRegistrarImplementation.sol)

| Vulnerability | Status | Notes |
|---------------|--------|-------|
| Unauthorized minting | ✅ Safe | Controller-only |
| Transfer during grace | ✅ Safe | NFT frozen during grace |
| Expiry manipulation | ✅ Safe | Only extends, never reduces |

### Controller (TNSRegistrarController.sol)

| Vulnerability | Status | Notes |
|---------------|--------|-------|
| Front-running | ✅ Safe | Commit-reveal scheme |
| Commitment replay | ✅ Safe | Consumed on register |
| Price manipulation | ✅ Safe | Oracle is immutable |
| Reentrancy | ✅ Safe | ReentrancyGuard used |

### Resolver (Resolver.sol)

| Vulnerability | Status | Notes |
|---------------|--------|-------|
| Unauthorized record changes | ✅ Safe | Owner/authorized only |
| Multicall issues | ✅ Safe | Delegatecall protected |

### PaymentForwarder (PaymentForwarder.sol)

| Vulnerability | Status | Notes |
|---------------|--------|-------|
| Reentrancy | ⚠️ Low Risk | No state after call |
| Resolver trust | ⚠️ Medium | Domain owner controls |
| Zero address | ✅ Safe | Explicit revert |

---

## 6. Third-Party Audit Resources

### Automated Analysis Tools

Run static analysis on the contracts:

```bash
# Install Slither
pip install slither-analyzer

# Run analysis
cd contracts/tns-ens
slither . --config-file slither.config.json

# Install Mythril
pip install mythril

# Run symbolic execution
myth analyze registry/TNSRegistry.sol --solc-json solc-input.json
```

---

## Quick Security Summary

| Component | Origin | Security Level | Notes |
|-----------|--------|----------------|-------|
| TNSRegistry | ENS Fork | ✅ High | Battle-tested |
| BaseRegistrar | ENS Fork | ✅ High | ERC-721 standard |
| TNSRegistrarController | ENS Fork | ✅ High | Commit-reveal secure |
| Resolver | ENS Fork | ✅ High | Standard pattern |
| ReverseRegistrar | ENS Fork | ✅ High | Minimal changes |
| StablePriceOracle | ENS Fork | ✅ High | Simple pricing |
| PaymentForwarder | Custom | ⚠️ Medium | Needs review |

**Overall Assessment**: The core TNS contracts inherit the security of the well-audited ENS codebase. The custom PaymentForwarder is simple and low-risk but should be reviewed independently.

---

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** disclose publicly
2. Email security concerns to the project maintainers
3. Include detailed reproduction steps
4. Allow reasonable time for fixes before disclosure
