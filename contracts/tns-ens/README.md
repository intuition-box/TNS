# TNS - Trust Name Service

## ENS-Forked Contracts for Intuition Mainnet

TNS is a **full port of ENS (Ethereum Name Service)** contracts, adapted for the Intuition blockchain (Chain ID: 1155) with native TRUST token payments.

---

## Deployed Contracts (Intuition Mainnet)

| Contract | Address | Explorer |
|----------|---------|----------|
| **TNSRegistry** | `0x34D7648aecc10fd86A53Cdd2436125342f3d7412` | [View](https://explorer.intuition.systems/address/0x34D7648aecc10fd86A53Cdd2436125342f3d7412#code) |
| **BaseRegistrar (ERC-721)** | `0xc08c5b051a9cFbcd81584Ebb8870ed77eFc5E676` | [View](https://explorer.intuition.systems/address/0xc08c5b051a9cFbcd81584Ebb8870ed77eFc5E676#code) |
| **TNSRegistrarController** | `0x57C93D875c3D4C8e377DAE5aA7EA06d35C84d044` | [View](https://explorer.intuition.systems/address/0x57C93D875c3D4C8e377DAE5aA7EA06d35C84d044#code) |
| **Resolver** | `0x17Adb57047EDe9eBA93A5855f8578A8E512592C5` | [View](https://explorer.intuition.systems/address/0x17Adb57047EDe9eBA93A5855f8578A8E512592C5#code) |
| **ReverseRegistrar** | `0x5140b65d566DA2d1298fCFE75eA972850bC2E365` | [View](https://explorer.intuition.systems/address/0x5140b65d566DA2d1298fCFE75eA972850bC2E365#code) |
| **StablePriceOracle** | `0xeFD11f62A66F39fE5C2A7e43f281FAbaFceed303` | [View](https://explorer.intuition.systems/address/0xeFD11f62A66F39fE5C2A7e43f281FAbaFceed303#code) |
| **PaymentForwarder** | `0xB0e22123Ac142e57F56Bc9fEf2077bB2Fa1141a0` | [View](https://explorer.intuition.systems/address/0xB0e22123Ac142e57F56Bc9fEf2077bB2Fa1141a0#code) |
| **Treasury** | `0x629A5386F73283F80847154d16E359192a891f86` | [View](https://explorer.intuition.systems/address/0x629A5386F73283F80847154d16E359192a891f86) |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TNS ARCHITECTURE                                │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │   Frontend App   │
                              │   (React/Vite)   │
                              └────────┬─────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
┌───────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│  TNSRegistrarController│  │ PaymentForwarder │  │   ReverseRegistrar   │
│  (Registration)        │  │ (Send Payments)  │  │  (Primary Domain)    │
└───────────┬───────────┘  └────────┬─────────┘  └──────────┬───────────┘
            │                       │                       │
            │ commit/register       │ resolve/sendTo        │ setName
            ▼                       ▼                       ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                              TNSRegistry                                   │
│                   (Core Registry - namehash → owner/resolver)              │
└─────────────────────────────────┬─────────────────────────────────────────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            │                     │                     │
            ▼                     ▼                     ▼
┌───────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│  BaseRegistrar    │  │     Resolver     │  │  StablePriceOracle   │
│  (ERC-721 NFT)    │  │  (Domain Data)   │  │  (Tiered Pricing)    │
└───────────────────┘  └──────────────────┘  └──────────────────────┘
        │                       │
        │ ownerOf/tokenURI      │ addr/text/contenthash
        ▼                       ▼
┌───────────────────┐  ┌──────────────────┐
│   Domain Owner    │  │  Domain Records  │
│   (NFT Holder)    │  │  (ETH, IPFS...)  │
└───────────────────┘  └──────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                           REGISTRATION FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

  User                    Controller              BaseRegistrar        Treasury
   │                          │                        │                   │
   │  1. makeCommitment()     │                        │                   │
   │─────────────────────────>│                        │                   │
   │                          │                        │                   │
   │  2. commit(commitment)   │                        │                   │
   │─────────────────────────>│                        │                   │
   │                          │                        │                   │
   │      ⏳ Wait 60s-24h     │                        │                   │
   │                          │                        │                   │
   │  3. register(name,...)   │                        │                   │
   │  + TRUST payment ────────│                        │                   │
   │─────────────────────────>│                        │                   │
   │                          │  4. register()         │                   │
   │                          │───────────────────────>│                   │
   │                          │                        │                   │
   │                          │  5. Forward TRUST ─────│───────────────────>│
   │                          │                        │                   │
   │                          │  6. Mint NFT           │                   │
   │                          │<───────────────────────│                   │
   │                          │                        │                   │
   │  7. NFT Ownership        │                        │                   │
   │<─────────────────────────│                        │                   │


┌─────────────────────────────────────────────────────────────────────────────┐
│                           PAYMENT FORWARDING                                 │
└─────────────────────────────────────────────────────────────────────────────┘

  Sender              PaymentForwarder           Registry           Resolver
   │                          │                      │                  │
   │  sendTo("alice") + TRUST │                      │                  │
   │─────────────────────────>│                      │                  │
   │                          │  resolver(node)      │                  │
   │                          │─────────────────────>│                  │
   │                          │<─────────────────────│                  │
   │                          │                      │                  │
   │                          │  addr(node)          │                  │
   │                          │─────────────────────────────────────────>│
   │                          │<─────────────────────────────────────────│
   │                          │                      │                  │
   │                          │  Forward TRUST to recipient             │
   │                          │──────────────────────────────────────────────>│
   │                          │                      │                  │    Recipient
   │  Success                 │                      │                  │
   │<─────────────────────────│                      │                  │
```

---

## Directory Structure

```
contracts/tns-ens/
├── registry/
│   ├── TNS.sol                         # Interface (ENS.sol equivalent)
│   └── TNSRegistry.sol                 # Core registry
├── ethregistrar/
│   ├── IBaseRegistrar.sol              # Registrar interface
│   ├── BaseRegistrarImplementation.sol # ERC-721 domain NFT
│   ├── ITNSRegistrarController.sol     # Controller interface
│   ├── TNSRegistrarController.sol      # Registration with commit-reveal
│   ├── IPriceOracle.sol                # Price oracle interface
│   ├── StablePriceOracle.sol           # Tiered pricing in TRUST
│   └── StringUtils.sol                 # String utilities
├── reverseRegistrar/
│   ├── IReverseRegistrar.sol           # Reverse registrar interface
│   ├── ReverseRegistrar.sol            # Address → name resolution
│   └── ReverseClaimer.sol              # Auto-claim for contracts
├── resolvers/
│   ├── Resolver.sol                    # Public resolver (addr, text, etc.)
│   ├── Multicallable.sol               # Batch operations
│   └── profiles/
│       ├── IAddrResolver.sol           # ETH address resolution
│       ├── INameResolver.sol           # Reverse name lookup
│       ├── ITextResolver.sol           # Text records (email, twitter, etc.)
│       └── IContentHashResolver.sol    # IPFS/content hash
├── utils/
│   ├── PaymentForwarder.sol            # Send TRUST to .trust domains ⚠️ CUSTOM
│   └── ERC20Recoverable.sol            # Token recovery utility
├── wrapper/
│   └── INameWrapper.sol                # NameWrapper interface (optional)
├── root/
│   └── Controllable.sol                # Controller access management
└── scripts/
    ├── deploy.ts                       # Full deployment script
    ├── verify-contracts.ts             # Explorer verification
    └── migrate-with-names.ts           # Domain migration script
```

---

## Key Differences from ENS

| Feature | ENS | TNS |
|---------|-----|-----|
| TLD | `.eth` | `.trust` |
| Payment Token | ETH | TRUST (native) |
| Network | Ethereum (Chain ID: 1) | Intuition (Chain ID: 1155) |
| Base Node | `ETH_NODE` | `TRUST_NODE` |
| Payment Forwarding | Not included | PaymentForwarder contract |

---

## PaymentForwarder Contract

### Why Custom?

ENS does not include a payment forwarding contract. The `PaymentForwarder` is a **custom addition** to TNS that enables users to send TRUST tokens directly to `.trust` domain names without needing to know the recipient's address.

**Use Case**: Send 10 TRUST to `alice.trust` instead of `0x1234...abcd`

### How It Works

```solidity
function sendTo(string calldata name) external payable {
    // 1. Calculate namehash for the domain
    bytes32 node = keccak256(abi.encodePacked(TRUST_NODE, keccak256(bytes(name))));
    
    // 2. Get resolver from registry
    address resolverAddr = tns.resolver(node);
    
    // 3. Get recipient address from resolver
    address payable recipient = IAddrResolver(resolverAddr).addr(node);
    
    // 4. Forward payment
    (bool success, ) = recipient.call{value: msg.value}("");
}
```

### Security Analysis

| Risk | Mitigation | Severity |
|------|------------|----------|
| **Resolver returns wrong address** | Resolver is set by domain owner only | Low |
| **Reentrancy attack** | Uses `call` with no state changes after | Low |
| **Domain not registered** | Reverts with `NoResolverSet` error | None |
| **Zero address recipient** | Reverts with `NoAddressSet` error | None |
| **Failed payment** | Reverts with `PaymentFailed` error | None |
| **Front-running** | Not applicable (read-only resolution) | None |

### Code Audit Checklist

- [x] No storage variables (stateless, uses immutable only)
- [x] No owner/admin functions (permissionless)
- [x] No token handling (native TRUST only)
- [x] No external calls before state changes (CEI pattern N/A)
- [x] Explicit error handling with custom errors
- [x] Events emitted for tracking
- [x] View function for off-chain resolution

### Comparison with Industry Patterns

The PaymentForwarder follows the same pattern used by:
- **ENS Reverse Registrar**: Queries registry then resolver
- **Gnosis Safe**: Forward payments to resolved addresses
- **Tornado Cash**: Minimal stateless forwarder pattern

### Recommendations for Production

1. **Consider adding ReentrancyGuard** (optional, low risk without it)
2. **Add rate limiting** if spam becomes an issue
3. **Monitor events** for unusual activity
4. **Consider upgradeable proxy** for future improvements

---

## Pricing

| Name Length | Price (TRUST/year) |
|-------------|-------------------|
| 1 character | 1,000 TRUST |
| 2 characters | 500 TRUST |
| 3 characters | 100 TRUST |
| 4 characters | 70 TRUST |
| 5+ characters | 30 TRUST |

---

## Registration Flow

1. **Commit** - User submits hash of (name + owner + secret) to prevent front-running
2. **Wait** - Minimum 60 seconds, maximum 24 hours
3. **Register** - User reveals name and pays in TRUST
4. **NFT Minted** - Domain issued as ERC-721 token to owner

---

## Grace Period

- **90 days** after expiration
- Only the original owner can renew during grace period
- After grace period, domain becomes available for anyone to register
- Expired NFTs can be burned by anyone after grace period ends

---

## Deployment

### Prerequisites

```bash
cd contracts/tns-ens
npm install
```

### Configure Environment

```bash
cp .env.example .env
# Add DEPLOYER_PRIVATE_KEY to .env
```

### Deploy

```bash
# Intuition Mainnet
npx hardhat run scripts/deploy.ts --network intuition

# Verify contracts
npx hardhat run scripts/verify-contracts.ts --network intuition
```

---

## Contract Verification

All contracts are verified on the Intuition Explorer. Run verification:

```bash
npx hardhat run scripts/verify-contracts.ts --network intuition
```

---

## License

MIT - Forked from [ENS Contracts](https://github.com/ensdomains/ens-contracts)
