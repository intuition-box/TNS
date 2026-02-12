import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || "0x629A5386F73283F80847154d16E359192a891f86";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Intuition Mainnet
    intuition: {
      url: "https://intuition.calderachain.xyz",
      chainId: 1155,
      accounts: [PRIVATE_KEY],
    },
    // Local development
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
  etherscan: {
    apiKey: {
      intuition: "no-api-key-needed",
    },
    customChains: [
      {
        network: "intuition",
        chainId: 1155,
        urls: {
          apiURL: "https://explorer.intuition.systems/api",
          browserURL: "https://explorer.intuition.systems",
        },
      },
    ],
  },
  paths: {
    sources: "./",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
