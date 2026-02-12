import { run } from "hardhat";
import { ethers } from "hardhat";

const DEPLOYED_CONTRACTS = {
  TNSRegistry: "0x34D7648aecc10fd86A53Cdd2436125342f3d7412",
  BaseRegistrar: "0xc08c5b051a9cFbcd81584Ebb8870ed77eFc5E676",
  StablePriceOracle: "0xeFD11f62A66F39fE5C2A7e43f281FAbaFceed303",
  ReverseRegistrar: "0x5140b65d566DA2d1298fCFE75eA972850bC2E365",
  Resolver: "0x17Adb57047EDe9eBA93A5855f8578A8E512592C5",
  TNSRegistrarController: "0x57C93D875c3D4C8e377DAE5aA7EA06d35C84d044",
  PaymentForwarder: "0xB0e22123Ac142e57F56Bc9fEf2077bB2Fa1141a0",
};

const TREASURY = "0x629A5386F73283F80847154d16E359192a891f86";

async function main() {
  console.log("Starting contract verification on Intuition Explorer...\n");

  const TRUST_LABEL = ethers.keccak256(ethers.toUtf8Bytes("trust"));
  const ROOT_NODE = ethers.ZeroHash;
  const TRUST_NODE = ethers.keccak256(ethers.solidityPacked(["bytes32", "bytes32"], [ROOT_NODE, TRUST_LABEL]));

  const rentPrices = [
    ethers.parseEther("1000"),
    ethers.parseEther("500"),
    ethers.parseEther("100"),
    ethers.parseEther("70"),
    ethers.parseEther("30"),
  ];

  const verifications = [
    {
      name: "TNSRegistry",
      address: DEPLOYED_CONTRACTS.TNSRegistry,
      contract: "registry/TNSRegistry.sol:TNSRegistry",
      constructorArguments: [],
    },
    {
      name: "BaseRegistrarImplementation",
      address: DEPLOYED_CONTRACTS.BaseRegistrar,
      contract: "ethregistrar/BaseRegistrarImplementation.sol:BaseRegistrarImplementation",
      constructorArguments: [DEPLOYED_CONTRACTS.TNSRegistry, TRUST_NODE],
    },
    {
      name: "StablePriceOracle",
      address: DEPLOYED_CONTRACTS.StablePriceOracle,
      contract: "ethregistrar/StablePriceOracle.sol:StablePriceOracle",
      constructorArguments: [rentPrices],
    },
    {
      name: "ReverseRegistrar",
      address: DEPLOYED_CONTRACTS.ReverseRegistrar,
      contract: "reverseRegistrar/ReverseRegistrar.sol:ReverseRegistrar",
      constructorArguments: [DEPLOYED_CONTRACTS.TNSRegistry],
    },
    {
      name: "Resolver",
      address: DEPLOYED_CONTRACTS.Resolver,
      contract: "resolvers/Resolver.sol:Resolver",
      constructorArguments: [
        DEPLOYED_CONTRACTS.TNSRegistry,
        DEPLOYED_CONTRACTS.TNSRegistrarController,
        DEPLOYED_CONTRACTS.ReverseRegistrar,
      ],
    },
    {
      name: "TNSRegistrarController",
      address: DEPLOYED_CONTRACTS.TNSRegistrarController,
      contract: "ethregistrar/TNSRegistrarController.sol:TNSRegistrarController",
      constructorArguments: [
        DEPLOYED_CONTRACTS.BaseRegistrar,
        DEPLOYED_CONTRACTS.StablePriceOracle,
        60,
        86400,
        DEPLOYED_CONTRACTS.ReverseRegistrar,
        ethers.ZeroAddress,
        DEPLOYED_CONTRACTS.TNSRegistry,
        TREASURY,
      ],
    },
    {
      name: "PaymentForwarder",
      address: DEPLOYED_CONTRACTS.PaymentForwarder,
      contract: "utils/PaymentForwarder.sol:PaymentForwarder",
      constructorArguments: [DEPLOYED_CONTRACTS.TNSRegistry],
    },
  ];

  for (const verification of verifications) {
    console.log(`\n=== Verifying ${verification.name} ===`);
    console.log(`Address: ${verification.address}`);
    console.log(`Contract: ${verification.contract}`);

    try {
      await run("verify:verify", {
        address: verification.address,
        contract: verification.contract,
        constructorArguments: verification.constructorArguments,
      });
      console.log(`✅ ${verification.name} verified successfully!`);
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log(`✅ ${verification.name} is already verified.`);
      } else {
        console.log(`❌ Failed to verify ${verification.name}:`, error.message);
      }
    }
  }

  console.log("\n========================================");
  console.log("Contract Verification Complete!");
  console.log("========================================");
  console.log("\nView contracts on Intuition Explorer:");
  for (const [name, address] of Object.entries(DEPLOYED_CONTRACTS)) {
    console.log(`${name}: https://explorer.intuition.systems/address/${address}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
