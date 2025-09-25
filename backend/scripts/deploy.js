import { ethers } from 'ethers';
import fs from 'fs';
import solc from 'solc';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function main() {
  // 1. Connect to the Polygon Amoy network
  if (!process.env.POLYGON_AMOY_RPC_URL || !process.env.CONTRACT_OWNER_PRIVATE_KEY) {
    throw new Error("Missing POLYGON_AMOY_RPC_URL or CONTRACT_OWNER_PRIVATE_KEY in .env file");
  }
  const provider = new ethers.JsonRpcProvider(process.env.POLYGON_AMOY_RPC_URL);
  const wallet = new ethers.Wallet(process.env.CONTRACT_OWNER_PRIVATE_KEY, provider);

  console.log(`✅ Connected to the Polygon Amoy network.`);
  console.log(`✨ Deploying contracts with the account: ${wallet.address}`);
  
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Account balance: ${ethers.formatEther(balance)} MATIC`);

  if (ethers.formatEther(balance) < 0.01) {
    console.warn("⚠️  Warning: Account balance is very low. Deployment might fail due to insufficient gas.");
  }

  // 2. Load and compile the smart contract
  const contractPath = './contracts/AuditTrail.sol';
  const sourceCode = fs.readFileSync(contractPath, 'utf8');

  const compilerInput = {
    language: 'Solidity',
    sources: {
      'AuditTrail.sol': {
        content: sourceCode,
      },
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode'],
        },
      },
    },
  };

  const compiled = JSON.parse(solc.compile(JSON.stringify(compilerInput)));
  
  // Save the compiled output to a file for the blockchain service to use
  fs.writeFileSync('./contracts/compiled.json', JSON.stringify(compiled, null, 2));
  console.log('📄 Contract compiled and ABI saved to contracts/compiled.json');

  const contract = compiled.contracts['AuditTrail.sol']['AuditTrail'];
  const abi = contract.abi;
  const bytecode = contract.evm.bytecode.object;

  // 3. Deploy the contract
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  console.log('🚀 Deploying AuditTrail contract...');
  
  const auditTrailContract = await factory.deploy();
  await auditTrailContract.waitForDeployment(); // Wait for the transaction to be mined

  const contractAddress = await auditTrailContract.getAddress();
  console.log(`\n🎉 Contract deployed successfully!`);
  console.log(`📜 Contract Address: ${contractAddress}`);
  console.log(`\n➡️ Next Step: Copy this address and paste it into your .env file as SMART_CONTRACT_ADDRESS`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });